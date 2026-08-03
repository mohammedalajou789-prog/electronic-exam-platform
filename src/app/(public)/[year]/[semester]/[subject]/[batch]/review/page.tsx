import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import SharedReviewPage from '@/components/exam/shared/SharedReviewPage'

interface PageProps {
  params: Promise<{ year: string; semester: string; subject: string; batch: string }>
}

export default async function Page({ params }: PageProps) {
  const { year, semester, subject, batch: examId } = await params
  const supabase = await createServerSupabaseClient()
  const { data: exam } = await supabase.from('exams').select('title, batch:batches(name, subject:subjects(name))').eq('id', examId).single()
  if (!exam) notFound()

  return (
    <SharedReviewPage
      examId={examId}
      playPath={`/${year}/${semester}/${subject}/${examId}/play`}
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: (exam.batch as any)?.subject?.name || semester, href: `/${year}/${semester}` },
        { label: (exam.batch as any)?.name || subject, href: `/${year}/${semester}/${subject}` },
        { label: exam.title, href: `/${year}/${semester}/${subject}/${examId}` },
        { label: 'Review Mode' },
      ]}
      backPath={`/${year}/${semester}/${subject}/${examId}`}
    />
  )
}