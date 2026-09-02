'use server'
// src/app/actions/compute-study-tip.ts
//
// Called after every exam completion for logged-in users.
// Determines whether a new study tip should be created or updated
// based on the student's performance in the current session.
//
// Rules:
//   - A "session" = continuous activity within 30 days.
//     If the student hasn't answered questions in this subject for 30+ days,
//     a new session starts and counts reset.
//   - First tip appears after 50 questions solved in the session.
//   - Tip refreshes every 25 additional questions after that.
//   - Tip expires 7 days after creation.
//   - Only chapters with error_rate >= 40% AND >= 3 attempts are shown.
//   - Top 3 chapters shown, each with top 3 lectures (>= 2 attempts).

import { createServerSupabaseClient } from '@/lib/supabase/server'

const MIN_QUESTIONS_FOR_FIRST_TIP = 50
const QUESTIONS_PER_REFRESH        = 25
const ERROR_RATE_THRESHOLD         = 0.40   // 40%
const MIN_ATTEMPTS_PER_CHAPTER     = 3
const MIN_ATTEMPTS_PER_LECTURE     = 2
const MAX_CHAPTERS_IN_TIP          = 3
const MAX_LECTURES_PER_CHAPTER     = 3
const TIP_LIFETIME_DAYS            = 7
const SESSION_GAP_DAYS             = 30

interface WeakChapter {
  chapter: string
  chapterId: string
  error_rate: number
  wrong_count: number
  total_count: number
  lectures: { lecture: string; lectureId: string; wrong_count: number; total_count: number }[]
}

export async function computeStudyTip(
  userId: string,
  examId: string
): Promise<void> {
  const supabase = await createServerSupabaseClient()

  // ── 1. Get subject info for this exam ─────────────────────────────────────
  const { data: exam } = await supabase
    .from('exams')
    .select('batch:batches(subject:subjects(id, name))')
    .eq('id', examId)
    .single()

  const subjectId   = (exam?.batch as any)?.subject?.id   as string | undefined
  const subjectName = (exam?.batch as any)?.subject?.name as string | undefined

  if (!subjectId || !subjectName) return

  // ── 2. Determine session start ────────────────────────────────────────────
  // A new session starts if the student hasn't answered questions in this
  // subject for SESSION_GAP_DAYS days.
  // We look at exam_attempts to find the most recent gap.

  const { data: attempts } = await supabase
    .from('exam_attempts')
    .select('completed_at, exam:exams(batch:batches(subject_id))')
    .eq('user_id', userId)
    .order('completed_at', { ascending: false })

  // Filter to attempts for this subject only
  const subjectAttempts = (attempts ?? []).filter(
    (a: any) => a.exam?.batch?.subject_id === subjectId
  )

  // Find the session start: walk back through attempts looking for a 30-day gap
  let sessionStart = new Date()
  sessionStart.setFullYear(sessionStart.getFullYear() - 10) // default: all time

  if (subjectAttempts.length >= 2) {
    const gapMs = SESSION_GAP_DAYS * 24 * 60 * 60 * 1000
    for (let i = 0; i < subjectAttempts.length - 1; i++) {
      const newer = new Date(subjectAttempts[i].completed_at).getTime()
      const older = new Date(subjectAttempts[i + 1].completed_at).getTime()
      if (newer - older > gapMs) {
        // Gap found — session starts after the older attempt
        sessionStart = new Date(subjectAttempts[i].completed_at)
        break
      }
    }
  }

  // ── 3. Count questions answered in this session ───────────────────────────
  // We join attempt_answers through exam_attempts scoped to this session
  const { data: sessionAttempts } = await supabase
    .from('exam_attempts')
    .select('id, total_questions, exam:exams(batch:batches(subject_id))')
    .eq('user_id', userId)
    .gte('completed_at', sessionStart.toISOString())

  const sessionSubjectAttempts = (sessionAttempts ?? []).filter(
    (a: any) => a.exam?.batch?.subject_id === subjectId
  )

  const totalQuestionsInSession = sessionSubjectAttempts.reduce(
    (sum: number, a: any) => sum + (a.total_questions ?? 0), 0
  )

  // ── 4. Check if we should create/update a tip ─────────────────────────────
  // Milestones: 50, 75, 100, 125, ...
  if (totalQuestionsInSession < MIN_QUESTIONS_FOR_FIRST_TIP) return

  const milestone = Math.floor(
    (totalQuestionsInSession - MIN_QUESTIONS_FOR_FIRST_TIP) / QUESTIONS_PER_REFRESH
  )
  // milestone 0 = first tip (at 50), milestone 1 = second (at 75), etc.

  // Check if we already have a tip for this exact milestone in this session
  const { data: existingTip } = await supabase
    .from('study_tips')
    .select('id, questions_solved')
    .eq('user_id', userId)
    .eq('subject_id', subjectId)
    .gte('session_start', sessionStart.toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const existingMilestone = existingTip
    ? Math.floor(
        ((existingTip.questions_solved ?? 0) - MIN_QUESTIONS_FOR_FIRST_TIP) /
          QUESTIONS_PER_REFRESH
      )
    : -1

  // No update needed — already at this milestone
  if (existingTip && existingMilestone >= milestone) return

  // ── 5. Fetch all answers for this session to compute error rates ───────────
  const sessionAttemptIds = sessionSubjectAttempts.map((a: any) => a.id)

  if (sessionAttemptIds.length === 0) return

  const { data: answers } = await supabase
    .from('attempt_answers')
    .select('is_correct, question:questions(chapter_id, lecture_id, chapter:chapters(id, name), lecture:lectures(id, name))')
    .in('attempt_id', sessionAttemptIds)
    .not('chosen_answer', 'is', null) // exclude skipped

  if (!answers || answers.length === 0) return

  // ── 6. Compute chapter error rates ────────────────────────────────────────
  const chapterMap: Record<string, {
    id: string
    wrong: number
    total: number
    lectures: Record<string, { id: string; wrong: number; total: number }>
  }> = {}

  for (const ans of answers) {
    const qData = ans.question as any
    const chapterObj = Array.isArray(qData?.chapter) ? qData.chapter[0] : qData?.chapter
    const lectureObj = Array.isArray(qData?.lecture) ? qData.lecture[0] : qData?.lecture
    const chapter = chapterObj?.name as string | null
    const chapterId = chapterObj?.id as string | null
    const lecture = lectureObj?.name as string | null
    const lectureId = lectureObj?.id as string | null
    if (!chapter) continue

    if (!chapterMap[chapter]) {
      chapterMap[chapter] = { id: chapterId || chapter, wrong: 0, total: 0, lectures: {} }
    }
    chapterMap[chapter].total++
    if (!ans.is_correct) chapterMap[chapter].wrong++

    if (lecture) {
      if (!chapterMap[chapter].lectures[lecture]) {
          chapterMap[chapter].lectures[lecture] = { id: lectureId || lecture, wrong: 0, total: 0 }
        }
      chapterMap[chapter].lectures[lecture].total++
      if (!ans.is_correct) chapterMap[chapter].lectures[lecture].wrong++
    }
  }

  // ── 7. Filter and rank weak chapters ──────────────────────────────────────
  const weakChapters: WeakChapter[] = Object.entries(chapterMap)
    .filter(([, v]) => {
      const rate = v.total > 0 ? v.wrong / v.total : 0
      return v.total >= MIN_ATTEMPTS_PER_CHAPTER && rate >= ERROR_RATE_THRESHOLD
    })
    .map(([chapter, v]) => {
      const error_rate = v.wrong / v.total
      const lectures = Object.entries(v.lectures)
        .filter(([, lv]) => lv.total >= MIN_ATTEMPTS_PER_LECTURE)
        .sort(([, a], [, b]) => b.wrong - a.wrong)
        .slice(0, MAX_LECTURES_PER_CHAPTER)
        .map(([lecture, lv]) => ({
          lecture,
          lectureId: lv.id,
          wrong_count: lv.wrong,
          total_count: lv.total,
        }))
      return {
        chapter,
        chapterId: v.id,
        error_rate,
        wrong_count: v.wrong,
        total_count: v.total,
        lectures,
      }
    })
    .sort((a, b) => b.error_rate - a.error_rate)
    .slice(0, MAX_CHAPTERS_IN_TIP)

  // If no weak chapters found — no tip needed
  if (weakChapters.length === 0) return

  // ── 8. Build the tip message ──────────────────────────────────────────────
  const chapterLines = weakChapters.map(ch => {
    const pct = Math.round(ch.error_rate * 100)
    if (ch.lectures.length > 0) {
      const lectureNames = ch.lectures.map(l => l.lecture).join(', ')
      return `${ch.chapter} (${pct}%) — ${lectureNames}`
    }
    return `${ch.chapter} (${pct}%)`
  })

  const message =
    `In ${subjectName}, you're struggling most with:\n` +
    chapterLines.map(l => `• ${l}`).join('\n') +
    `\n\nBased on your last ${totalQuestionsInSession} questions in this subject.`

  // ── 9. Upsert the tip ─────────────────────────────────────────────────────
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + TIP_LIFETIME_DAYS)

  if (existingTip) {
    // Update existing tip — reset expiry and refresh content
    await supabase
      .from('study_tips')
      .update({
        message,
        weak_chapters: weakChapters,
        questions_solved: totalQuestionsInSession,
        expires_at: expiresAt.toISOString(),
        dismissed_at: null, // re-show if previously dismissed
      })
      .eq('id', existingTip.id)
  } else {
    // Create new tip for this session
    await supabase
      .from('study_tips')
      .insert({
        user_id: userId,
        subject_id: subjectId,
        subject_name: subjectName,
        message,
        weak_chapters: weakChapters,
        questions_solved: totalQuestionsInSession,
        session_start: sessionStart.toISOString(),
        expires_at: expiresAt.toISOString(),
      })
  }
}