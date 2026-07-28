import { createServerSupabaseClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import QuestionEditor from '@/components/admin/QuestionEditor'

interface PageProps {
  params: Promise<{ id: string }>
}

async function getQuestion(id: string) {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('questions')
    .select('*')
    .eq('id', id)
    .single()
  return data
}

export default async function EditQuestionPage({ params }: PageProps) {
  const { id } = await params
  const question = await getQuestion(id)
  if (!question) notFound()

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Edit Question</h1>
      <QuestionEditor question={question} />
    </div>
  )
}