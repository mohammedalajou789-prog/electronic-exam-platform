// src/components/exam/shared/SharedPlayPage.tsx
//
// Interactive exam page. It is NOT cached: when a logged-in student presses "Continue",
// it loads their own saved progress. To keep it fast, the regular-exam data is fetched in parallel.

import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import InteractiveExam from '@/components/exam/InteractiveExam'

/** Saved progress handed to the exam screen when the student resumes */
interface ResumeProgress {
  current_question: number
  answers_json: Record<string, string>
  flags_json: string[]
  elapsed_seconds: number | null
}

type ServerSupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>

/**
 * Returns the logged-in student's unfinished attempt at this exam, or null
 * (guest, no attempt yet, or an attempt with no answers).
 *
 * getClaims() checks the session locally with the project's public signing key,
 * so it does not need a network call to Supabase Auth (unlike getUser()).
 */
async function loadResumeProgress(
  supabase: ServerSupabaseClient,
  examId: string
): Promise<ResumeProgress | null> {
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = typeof claimsData?.claims?.sub === 'string' ? claimsData.claims.sub : null
  if (!userId) return null

  const { data } = await supabase
    .from('study_progress')
    .select('current_question, answers_json, flags_json, elapsed_seconds')
    .eq('user_id', userId)
    .eq('exam_id', examId)
    .eq('completed', false)
    .maybeSingle()

  if (!data || Object.keys(data.answers_json || {}).length === 0) return null

  return {
    current_question: data.current_question ?? 0,
    answers_json: data.answers_json ?? {},
    flags_json: data.flags_json ?? [],
    elapsed_seconds: data.elapsed_seconds ?? null,
  }
}

interface Props {
  examId?: string
  customExamId?: string
  resume?: string
}

export default async function SharedPlayPage({ examId, customExamId, resume }: Props) {
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

  // The exam, its questions and the saved progress don't depend on each other,
  // so they are fetched at the same time: one round trip instead of up to four in a row.
  const [examRes, questionsRes, savedProgress] = await Promise.all([
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
  ])

  const { data: exam, error } = examRes
  if (error || !exam) notFound()

  const { data: questions } = questionsRes

  return (
    <InteractiveExam
      exam={exam as any}
      questions={(questions || []) as any}
      savedProgress={savedProgress}
      target={{ examId, customExamId: null }}
      resume={isResume}
      subjectName={(exam as any).subject?.name ?? ''}
      batchName={(exam as any).batch?.name ?? ''}
    />
  )
}
