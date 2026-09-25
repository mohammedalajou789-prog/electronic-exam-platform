'use server'
// src/app/actions/compute-study-tip.ts
//
// Creates or refreshes the study tip for the subject of an exam.
// Called when a student finishes an exam or leaves it with "Continue Later".
// The student is identified from their session, never from the browser.
//
// Rules:
//   - A "session" = continuous study of one subject. After 30 days without
//     answering any question in the subject, a new session starts from zero.
//     (Computed by the get_my_study_tip_data database function.)
//   - Only ANSWERED questions count. Skipped questions never count as solved.
//     Answers from unfinished exams count too.
//   - Each question counts once; its LATEST answer in the session decides
//     whether it is currently right or wrong.
//   - First tip appears after 50 solved questions in the session.
//   - The tip refreshes every 25 additional solved questions.
//   - A tip expires 7 days after it was created or refreshed.
//   - Only chapters with an error rate >= 40% AND >= 3 questions are shown.
//   - Top 3 chapters, each with its top 3 lectures (>= 2 questions).

import { createServerSupabaseClient } from '@/lib/supabase/server'

const MIN_QUESTIONS_FOR_FIRST_TIP = 50
const QUESTIONS_PER_REFRESH        = 25
const ERROR_RATE_THRESHOLD         = 0.40   // 40%
const MIN_ATTEMPTS_PER_CHAPTER     = 3
const MIN_ATTEMPTS_PER_LECTURE     = 2
const MAX_CHAPTERS_IN_TIP          = 3
const MAX_LECTURES_PER_CHAPTER     = 3
const TIP_LIFETIME_DAYS            = 7

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ── Shapes returned by the get_my_study_tip_data database function ───────────

interface TipLectureData {
  lecture_id: string
  lecture: string
  total: number
  wrong: number
}

interface TipChapterData {
  chapter_id: string
  chapter: string
  total: number
  wrong: number
  lectures: TipLectureData[]
}

interface TipData {
  session_start: string | null
  questions_solved: number
  chapters: TipChapterData[]
}

// ── Shape stored in study_tips.weak_chapters (unchanged, for compatibility) ──

interface WeakChapter {
  chapter: string
  chapterId: string
  error_rate: number
  wrong_count: number
  total_count: number
  lectures: { lecture: string; lectureId: string; wrong_count: number; total_count: number }[]
}

interface SubjectInfo {
  id: string
  name: string
}

/** Supabase may return a joined row as an object or as a one-item array. */
function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

/** 50 → 0, 75 → 1, 100 → 2, ... (which refresh step the student has reached) */
function milestoneOf(questionsSolved: number): number {
  return Math.floor((questionsSolved - MIN_QUESTIONS_FOR_FIRST_TIP) / QUESTIONS_PER_REFRESH)
}

function findWeakChapters(chapters: TipChapterData[]): WeakChapter[] {
  return chapters
    .filter(ch => ch.total >= MIN_ATTEMPTS_PER_CHAPTER && ch.wrong / ch.total >= ERROR_RATE_THRESHOLD)
    .map(ch => ({
      chapter: ch.chapter,
      chapterId: ch.chapter_id,
      error_rate: ch.wrong / ch.total,
      wrong_count: ch.wrong,
      total_count: ch.total,
      lectures: ch.lectures
        .filter(l => l.total >= MIN_ATTEMPTS_PER_LECTURE)
        .sort((a, b) => b.wrong - a.wrong)
        .slice(0, MAX_LECTURES_PER_CHAPTER)
        .map(l => ({
          lecture: l.lecture,
          lectureId: l.lecture_id,
          wrong_count: l.wrong,
          total_count: l.total,
        })),
    }))
    .sort((a, b) => b.error_rate - a.error_rate)
    .slice(0, MAX_CHAPTERS_IN_TIP)
}

function buildMessage(subjectName: string, weakChapters: WeakChapter[], questionsSolved: number): string {
  const chapterLines = weakChapters.map(ch => {
    const pct = Math.round(ch.error_rate * 100)
    if (ch.lectures.length > 0) {
      const lectureNames = ch.lectures.map(l => l.lecture).join(', ')
      return `${ch.chapter} (${pct}%) — ${lectureNames}`
    }
    return `${ch.chapter} (${pct}%)`
  })

  return (
    `In ${subjectName}, you're struggling most with:\n` +
    chapterLines.map(line => `• ${line}`).join('\n') +
    `\n\nBased on the ${questionsSolved} questions you have solved in this subject recently.`
  )
}

/**
 * Creates or refreshes the study tip for the subject of the given exam.
 * Does nothing for guests, or when the student has not reached a new milestone.
 */
export async function refreshStudyTip(examId: string): Promise<void> {
  if (!UUID_PATTERN.test(examId)) return

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  // ── 1. Subject of this exam ───────────────────────────────────────────────
  const { data: exam } = await supabase
    .from('exams')
    .select('batch:batches(subject:subjects(id, name))')
    .eq('id', examId)
    .maybeSingle()

  // The joined batch may come back as an object or a one-item array
  type BatchJoin = { subject: SubjectInfo | SubjectInfo[] | null }
  const batch = firstOf(exam?.batch as unknown as BatchJoin | BatchJoin[] | null)
  const subject = firstOf(batch?.subject)
  if (!subject) return

  // ── 2. Current session numbers (computed in the database) ─────────────────
  const { data, error } = await supabase.rpc('get_my_study_tip_data', { p_subject_id: subject.id })
  if (error || !data) {
    if (error) console.error('get_my_study_tip_data failed:', error.message)
    return
  }
  const tipData = data as TipData

  if (!tipData.session_start || tipData.questions_solved < MIN_QUESTIONS_FOR_FIRST_TIP) return

  // ── 3. Has this milestone already produced a tip in this session? ─────────
  const milestone = milestoneOf(tipData.questions_solved)

  const { data: existingTip } = await supabase
    .from('study_tips')
    .select('id, questions_solved')
    .eq('user_id', user.id)
    .eq('subject_id', subject.id)
    .gte('session_start', tipData.session_start)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingTip && milestoneOf(existingTip.questions_solved ?? 0) >= milestone) return

  // ── 4. Weak chapters ──────────────────────────────────────────────────────
  const weakChapters = findWeakChapters(tipData.chapters)
  if (weakChapters.length === 0) return

  // ── 5. Save the tip ───────────────────────────────────────────────────────
  const message = buildMessage(subject.name, weakChapters, tipData.questions_solved)
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + TIP_LIFETIME_DAYS)

  if (existingTip) {
    const { error: updateError } = await supabase
      .from('study_tips')
      .update({
        message,
        weak_chapters: weakChapters,
        questions_solved: tipData.questions_solved,
        expires_at: expiresAt.toISOString(),
        dismissed_at: null, // show again if it was dismissed before
      })
      .eq('id', existingTip.id)
    if (updateError) console.error('Could not update study tip:', updateError.message)
  } else {
    const { error: insertError } = await supabase
      .from('study_tips')
      .insert({
        user_id: user.id,
        subject_id: subject.id,
        subject_name: subject.name,
        message,
        weak_chapters: weakChapters,
        questions_solved: tipData.questions_solved,
        session_start: tipData.session_start,
        expires_at: expiresAt.toISOString(),
      })
    if (insertError) console.error('Could not create study tip:', insertError.message)
  }
}