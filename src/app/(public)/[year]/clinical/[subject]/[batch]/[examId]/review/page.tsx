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
export async function generateStaticParams(): Promise<{ year: string; subject: string; batch: string; examId: string }[]> {
  return []
}

interface PageProps {
  params: Promise<{ year: string; subject: string; batch: string; examId: string }>
}

export default async function Page({ params }: PageProps) {
  const { year, subject, batch, examId } = await params
  const basePath = `/${year}/clinical/${subject}/${batch}/${examId}`
  return (
    <SharedReviewPage
      examId={examId}
      playPath={`${basePath}/play`}
      backPath={basePath}
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: 'Exam', href: basePath },
        { label: 'Review Mode' },
      ]}
    />
  )
}