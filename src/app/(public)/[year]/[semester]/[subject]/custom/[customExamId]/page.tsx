import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import InteractiveExam from '@/components/exam/InteractiveExam'

interface PageProps {
  params: Promise<{
    year: string
    semester: string
    subject: string
    customExamId: string
  }>
}

export default async function CustomExamPlayPage({ params }: PageProps) {
  const { customExamId } = await params
  const supabase = await createServerSupabaseClient()

  // Load the custom exam record
  const { data: customExam } = await supabase
    .from('custom_exams')
    .select('*')
    .eq('id', customExamId)
    .single()

  if (!customExam) notFound()

  // Load the actual questions
  const { data: questions } = await supabase
    .from('questions')
    .select('*, question_images(*), question_statistics(*)')
    .in('id', customExam.question_ids)
    .is('deleted_at', null)

  if (!questions || questions.length === 0) notFound()

  // Build a fake exam object so InteractiveExam works without changes
  const fakeExam = {
    id: customExam.id,
    title: 'Custom Exam',
    question_count: questions.length,
    duration_minutes: null,
    timer_mode: 'none',
  }

  return (
    <InteractiveExam
      exam={fakeExam}
      questions={questions as any}
      savedProgress={null}
    />
  )
}