// src/app/(public)/[year]/basic/[semester]/[subject]/[batch]/[examId]/review/page.tsx
import { notFound } from 'next/navigation'
import { createPublicSupabaseClient, assertQuerySucceeded } from '@/lib/supabase/public'
import { isUuid } from '@/lib/uuid'
import SharedReviewPage from '@/components/exam/shared/SharedReviewPage'

/**
 * Caching: the review of a regular exam is public content (no user data),
 * so it is built once and served from cache to every student.
 * It is rebuilt at most every 5 minutes, so admin edits to questions appear within 5 minutes.
 */
export const revalidate = 300

/**
 * No review pages are built during `npm run build`.
 * Each exam's review page is built on its first visit, then cached (see `revalidate` above).
 */
export async function generateStaticParams(): Promise<{ year: string; semester: string; subject: string; batch: string; examId: string }[]> {
  return []
}

interface PageProps {
  params: Promise<{ year: string; semester: string; subject: string; batch: string; examId: string }>
}

export default async function Page({ params }: PageProps) {
  const { year, semester, subject, batch, examId } = await params
  if (!isUuid(examId)) notFound()

  const supabase = createPublicSupabaseClient()
  // maybeSingle(): "no row" is not an error (it returns null), so any error here is a real failure
  const { data: exam, error: examError } = await supabase.from('exams').select('title').eq('id', examId).maybeSingle()
  assertQuerySucceeded(examError, 'exam')
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