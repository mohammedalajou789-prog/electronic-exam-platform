export const dynamic = 'force-dynamic'
export const revalidate = 0

import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import InteractiveExam from '@/components/exam/InteractiveExam'

interface PageProps {
  params: Promise<{
    year: string
    semester: string
    subject: string
    batch: string
    examId: string
  }>
  searchParams: Promise<{ resume?: string }>
}

// ── Data fetchers ─────────────────────────────────────────────────────────────

async function getExamWithQuestions(examId: string) {
  const supabase = await createServerSupabaseClient()

  const { data: exam, error } = await supabase
    .from('exams')
    .select(`
      *,
      exam_doctors:exam_doctors(doctor:doctors(name)),
      batch:batches(name, subject:subjects(name))
    `)
    .eq('id', examId)
    .is('deleted_at', null)
    .single()

  if (error || !exam) return null

  const { data: questions } = await supabase
    .from('questions')
    .select('*, question_images(*), question_statistics(*), doctor:doctors(name)')
    .eq('exam_id', examId)
    .is('deleted_at', null)
    .order('question_order', { ascending: true })

  return { exam, questions: questions || [] }
}

/**
 * Returns the saved progress row only when resume=true is in the URL
 * AND a real in-progress row exists (completed = false).
 *
 * When resume is absent (fresh start / start-over), we delete any stale row
 * so the database is clean before the client component mounts.
 */
async function resolveProgress(
  examId: string,
  resume: string | undefined
): Promise<{
  current_question: number
  answers_json: Record<string, string>
  flags_json: string[]
  remaining_time: number | null
} | null> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  if (resume === 'true') {
    // Try to load saved progress
    const { data } = await supabase
      .from('study_progress')
      .select('current_question, answers_json, flags_json, remaining_time')
      .eq('user_id', user.id)
      .eq('exam_id', examId)
      .eq('completed', false)
      .maybeSingle()

    // Only resume if the student actually answered at least one question
    if (data && Object.keys(data.answers_json || {}).length > 0) {
      return {
        current_question: data.current_question ?? 0,
        answers_json: data.answers_json ?? {},
        flags_json: data.flags_json ?? [],
        remaining_time: data.remaining_time ?? null,
      }
    }

    // Row exists but is effectively empty — treat as fresh start
    return null
  }

  // Fresh start or start-over: wipe any existing session now
  await supabase
    .from('study_progress')
    .delete()
    .eq('user_id', user.id)
    .eq('exam_id', examId)

  return null
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PlayPage({ params, searchParams }: PageProps) {
  const { examId } = await params
  const { resume } = await searchParams

  const [data, savedProgress] = await Promise.all([
    getExamWithQuestions(examId),
    resolveProgress(examId, resume),
  ])

  if (!data) notFound()

  return (
    <InteractiveExam
      exam={data.exam as any}
      questions={data.questions as any}
      savedProgress={savedProgress}
      subjectName={(data.exam as any).batch?.subject?.name ?? ''}
      batchName={(data.exam as any).batch?.name ?? ''}
    />
  )
}