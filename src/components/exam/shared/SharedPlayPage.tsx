// src/components/exam/shared/SharedPlayPage.tsx
//
// Interactive exam page. It is NOT cached: it loads the logged-in student's own data
// ("Continue" restores the open attempt; "unanswered only" picks the questions never
// answered). To keep it fast, the regular-exam data is fetched in parallel.

import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import InteractiveExam from '@/components/exam/InteractiveExam'

/** Progress handed to the exam screen when the student resumes */
interface ResumeProgress {
  currentIndex: number
  answers: Record<string, string>
  flaggedIds: string[]
  viewedIds: string[]
  elapsedSeconds: number
  /** null = the whole exam; otherwise the attempt covers only these questions */
  questionIds: string[] | null
}

/** Row shape of the open attempt query below */
interface OpenAttemptRow {
  current_index: number
  viewed_ids: string[] | null
  flagged_ids: string[] | null
  time_spent: number
  question_ids: string[] | null
  attempt_answers: { question_id: string; chosen_answer: string | null }[] | null
}

/** Shape of the JSON returned by get_my_exam_progress (only the part used here) */
interface ExamProgressRow {
  unanswered_ids: string[]
}

type ServerSupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>

/** The logged-in student's id, or null for guests. */
async function currentUserId(supabase: ServerSupabaseClient): Promise<string | null> {
  // getClaims() checks the session locally with the project's public signing key,
  // so it does not need a network call to Supabase Auth (unlike getUser()).
  const { data: claimsData } = await supabase.auth.getClaims()
  return typeof claimsData?.claims?.sub === 'string' ? claimsData.claims.sub : null
}

/**
 * Returns the logged-in student's open attempt at this exam, or null
 * (guest, or no open attempt). Answers come from the answer log, so they are
 * exactly what the database recorded.
 */
async function loadResumeProgress(
  supabase: ServerSupabaseClient,
  examId: string
): Promise<ResumeProgress | null> {
  const userId = await currentUserId(supabase)
  if (!userId) return null

  const { data, error } = await supabase
    .from('exam_attempts')
    .select('current_index, viewed_ids, flagged_ids, time_spent, question_ids, attempt_answers(question_id, chosen_answer)')
    .eq('user_id', userId)
    .eq('exam_id', examId)
    .eq('status', 'in_progress')
    .not('attempt_answers.chosen_answer', 'is', null)
    .maybeSingle()

  if (error) console.error('[SharedPlayPage] Could not load the open attempt:', error.message)
  if (!data) return null

  const attempt = data as unknown as OpenAttemptRow
  const answers: Record<string, string> = {}
  for (const row of attempt.attempt_answers ?? []) {
    if (row.chosen_answer) answers[row.question_id] = row.chosen_answer
  }

  return {
    currentIndex: attempt.current_index ?? 0,
    answers,
    flaggedIds: attempt.flagged_ids ?? [],
    viewedIds: attempt.viewed_ids ?? [],
    elapsedSeconds: attempt.time_spent ?? 0,
    questionIds: attempt.question_ids,
  }
}

/**
 * Questions of this exam the student has never answered (skipped + unsolved),
 * in exam order. Null for guests (they have no history, so they get the whole exam).
 */
async function loadUnansweredIds(
  supabase: ServerSupabaseClient,
  examId: string
): Promise<string[] | null> {
  const userId = await currentUserId(supabase)
  if (!userId) return null

  const { data, error } = await supabase.rpc('get_my_exam_progress', { p_exam_id: examId })
  if (error) {
    console.error('[SharedPlayPage] Could not load unanswered questions:', error.message)
    return null
  }
  return (data as ExamProgressRow | null)?.unanswered_ids ?? null
}

interface Props {
  examId?: string
  customExamId?: string
  resume?: string
  /** 'unanswered' = only the questions never answered before */
  set?: string
}

export default async function SharedPlayPage({ examId, customExamId, resume, set }: Props) {
  const supabase = await createServerSupabaseClient()

  // ── Custom Exam ───────────────────────────────────────────
  if (customExamId) {
    const { data: customExam } = await supabase
      .from('custom_exams')
      .select('*')
      .eq('id', customExamId)
      .single()

    if (!customExam) notFound()

    const { data: questions } = await supabase
      .from('questions')
      .select('*, question_images(*), question_statistics(*), chapter:chapters(id, name), lecture:lectures(id, name)')
      .in('id', customExam.question_ids)
      .is('deleted_at', null)

    if (!questions || questions.length === 0) notFound()

    const fakeExam = {
      id: customExam.id,
      title: 'Custom Exam',
      question_count: questions.length,
      duration_minutes: null,
      timer_mode: 'none' as const,
    }

    return (
      <InteractiveExam
        exam={fakeExam as any}
        questions={questions as any}
        savedProgress={null}
        target={{ examId: null, customExamId: customExam.id }}
        resume={false}
      />
    )
  }

  // ── Regular Exam ──────────────────────────────────────────
  if (!examId) notFound()

  // Saved progress is loaded only when the student pressed "Continue".
  // Starting over is handled by the exam screen itself, so simply opening
  // this page never deletes anything.
  const isResume = resume === 'true'
  const wantsUnanswered = !isResume && set === 'unanswered'

  // The exam, its questions and the student's data don't depend on each other,
  // so they are fetched at the same time: one round trip instead of several in a row.
  const [examRes, questionsRes, savedProgress, unansweredIds] = await Promise.all([
    supabase
      .from('exams')
      .select(`
        *,
        exam_doctors(doctor:doctors(name)),
        batch:batches(name),
        subject:subjects(name)
      `)
      .eq('id', examId)
      .eq('status', 'published')
      .is('deleted_at', null)
      .single(),
    supabase
      .from('questions')
      .select('*, question_images(*), question_statistics(*), doctor:doctors(name), chapter:chapters(id, name), lecture:lectures(id, name)')
      .eq('exam_id', examId)
      .is('deleted_at', null)
      .order('question_order', { ascending: true }),
    isResume ? loadResumeProgress(supabase, examId) : Promise.resolve(null),
    wantsUnanswered ? loadUnansweredIds(supabase, examId) : Promise.resolve(null),
  ])

  const { data: exam, error } = examRes
  if (error || !exam) notFound()

  const allQuestions = (questionsRes.data || []) as { id: string }[]

  // Part of the exam: the open attempt's own questions when resuming,
  // or the questions never answered ("unanswered only", signed-in students)
  const partIds = savedProgress?.questionIds ?? unansweredIds
  const partSet = partIds ? new Set(partIds) : null
  const questions = partSet ? allQuestions.filter(q => partSet.has(q.id)) : allQuestions

  return (
    <InteractiveExam
      exam={exam as any}
      questions={questions as any}
      savedProgress={savedProgress}
      target={{ examId, customExamId: null }}
      resume={isResume}
      questionSet={partSet ? 'unanswered' : 'all'}
      subjectName={(exam as any).subject?.name ?? ''}
      batchName={(exam as any).batch?.name ?? ''}
    />
  )
}
