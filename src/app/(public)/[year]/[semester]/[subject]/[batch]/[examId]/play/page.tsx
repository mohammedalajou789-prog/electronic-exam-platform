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

async function getExamWithQuestions(examId: string) {
  const supabase = await createServerSupabaseClient()

  const { data: exam, error } = await supabase
    .from('exams')
    .select(`*, exam_doctors:exam_doctors(doctor:doctors(name))`)
    .eq('id', examId)
    .is('deleted_at', null)
    .single()

  if (error || !exam) return null

  const { data: questions } = await supabase
    .from('questions')
    .select('*, question_images(*), question_statistics(*)')
    .eq('exam_id', examId)
    .is('deleted_at', null)
    .order('question_order', { ascending: true })

  return { exam, questions: questions || [] }
}

async function getSavedProgress(examId: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: progress } = await supabase
    .from('study_progress')
    .select('current_question, answers_json, remaining_time')
    .eq('user_id', user.id)
    .eq('exam_id', examId)
    .eq('completed', false)
    .maybeSingle()

  return progress ?? null
}

export default async function PlayPage({ params, searchParams }: PageProps) {
  const { examId } = await params
  const { resume } = await searchParams

  const data = await getExamWithQuestions(examId)
  if (!data) notFound()

  const savedProgress = resume === 'true'
    ? await getSavedProgress(examId)
    : null

  return (
    <InteractiveExam
      exam={data.exam as any}
      questions={data.questions as any}
      savedProgress={savedProgress}
    />
  )
}