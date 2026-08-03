import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import SharedReviewPage from '@/components/exam/shared/SharedReviewPage'

interface PageProps {
  params: Promise<{ year: string; semester: string; subject: string; batch: string; examId: string }>
}

export default async function Page({ params }: PageProps) {
  const { year, semester, subject, batch, examId } = await params
  const supabase = await createServerSupabaseClient()
  const { data: exam } = await supabase.from('exams').select('title').eq('id', examId).single()
  if (!exam) notFound()

  return (
    <SharedReviewPage
      examId={examId}
      playPath={`/${year}/${semester}/${subject}/${batch}/${examId}/play`}
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: semester, href: `/${year}/${semester}` },
        { label: subject, href: `/${year}/${semester}/${subject}` },
        { label: batch, href: `/${year}/${semester}/${subject}/${batch}` },
        { label: exam.title, href: `/${year}/${semester}/${subject}/${batch}/${examId}` },
        { label: 'Review Mode' },
      ]}
      backPath={`/${year}/${semester}/${subject}/${batch}/${examId}`}
    />
  )
}