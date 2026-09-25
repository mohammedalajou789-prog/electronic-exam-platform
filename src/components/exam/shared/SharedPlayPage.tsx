// src/components/exam/shared/SharedPlayPage.tsx
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import InteractiveExam from '@/components/exam/InteractiveExam'

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

  const { data: exam, error } = await supabase
    .from('exams')
    .select(`
      *,
      exam_doctors(doctor:doctors(name)),
      batch:batches(name, subject:subjects(name))
    `)
    .eq('id', examId)
    .eq('status', 'published')
    .is('deleted_at', null)
    .single()

  if (error || !exam) notFound()

  const { data: questions } = await supabase
    .from('questions')
    .select('*, question_images(*), question_statistics(*), doctor:doctors(name), chapter:chapters(id, name), lecture:lectures(id, name)')
    .eq('exam_id', examId)
    .is('deleted_at', null)
    .order('question_order', { ascending: true })

  // ── Saved Progress (only when the student pressed "Continue") ─────────────
  // Starting over is handled by the exam screen itself, so simply opening
  // this page never deletes anything.
  const isResume = resume === 'true'
  const { data: { user } } = await supabase.auth.getUser()

  let savedProgress: {
    current_question: number
    answers_json: Record<string, string>
    flags_json: string[]
    elapsed_seconds: number | null
  } | null = null

  if (user && isResume) {
    const { data } = await supabase
      .from('study_progress')
      .select('current_question, answers_json, flags_json, elapsed_seconds')
      .eq('user_id', user.id)
      .eq('exam_id', examId)
      .eq('completed', false)
      .maybeSingle()

    if (data && Object.keys(data.answers_json || {}).length > 0) {
      savedProgress = {
        current_question: data.current_question ?? 0,
        answers_json: data.answers_json ?? {},
        flags_json: data.flags_json ?? [],
        elapsed_seconds: data.elapsed_seconds ?? null,
      }
    }
  }

  return (
    <InteractiveExam
      exam={exam as any}
      questions={(questions || []) as any}
      savedProgress={savedProgress}
      target={{ examId, customExamId: null }}
      resume={isResume}
      subjectName={(exam as any).batch?.subject?.name ?? ''}
      batchName={(exam as any).batch?.name ?? ''}
    />
  )
}
