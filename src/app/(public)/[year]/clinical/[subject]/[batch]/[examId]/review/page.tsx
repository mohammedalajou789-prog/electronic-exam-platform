import SharedReviewPage from '@/components/exam/shared/SharedReviewPage'

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