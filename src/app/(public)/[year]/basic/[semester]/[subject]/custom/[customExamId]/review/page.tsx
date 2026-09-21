import SharedReviewPage from '@/components/exam/shared/SharedReviewPage'

interface PageProps {
  params: Promise<{ year: string; semester: string; subject: string; customExamId: string }>
}

export default async function Page({ params }: PageProps) {
  const { year, semester, subject, customExamId } = await params
  const basePath = `/${year}/basic/${semester}/${subject}/custom/${customExamId}`
  return (
    <SharedReviewPage
      customExamId={customExamId}
      playPath={`${basePath}/play`}
      backPath={basePath}
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: 'Custom Exam', href: basePath },
        { label: 'Review Mode' },
      ]}
    />
  )
}