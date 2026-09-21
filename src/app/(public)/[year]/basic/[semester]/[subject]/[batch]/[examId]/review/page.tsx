// src/app/(public)/[year]/basic/[semester]/[subject]/[batch]/[examId]/review/page.tsx
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

  const basePath = `/${year}/basic/${semester}/${subject}/${batch}/${examId}`

  return (
    <SharedReviewPage
      examId={examId}
      playPath={`${basePath}/play`}
      backPath={basePath}
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: semester, href: `/${year}/basic/${semester}` },
        { label: subject, href: `/${year}/basic/${semester}/${subject}` },
        { label: batch, href: `/${year}/basic/${semester}/${subject}/${batch}` },
        { label: exam.title, href: basePath },
        { label: 'Review Mode' },
      ]}
    />
  )
}