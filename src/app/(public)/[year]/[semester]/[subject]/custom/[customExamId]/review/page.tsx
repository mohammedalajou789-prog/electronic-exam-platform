import SharedReviewPage from '@/components/exam/shared/SharedReviewPage'

interface PageProps {
  params: Promise<{ year: string; semester: string; customExamId: string; subject?: string }>
}

export default async function Page({ params }: PageProps) {
  const { year, semester, customExamId, subject } = await params
  const subjectSlug = subject || semester
  const basePath = subject
    ? `/${year}/${semester}/${subjectSlug}/custom/${customExamId}`
    : `/${year}/${subjectSlug}/custom/${customExamId}`

  return (
    <SharedReviewPage
      customExamId={customExamId}
      playPath={`${basePath}/play`}
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: 'Custom Exam', href: basePath },
        { label: 'Review Mode' },
      ]}
      backPath={basePath}
    />
  )
}