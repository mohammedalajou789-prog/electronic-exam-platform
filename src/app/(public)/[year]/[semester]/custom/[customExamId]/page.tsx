import SharedExamPrepPage from '@/components/exam/shared/SharedExamPrepPage'

export default async function ClinicalCustomExamPrepPage({
  params,
}: {
  params: Promise<{
    year: string
    semester: string
    customExamId: string
  }>
}) {
  const { year, semester: subjectSlug, customExamId } = await params

  return (
    <SharedExamPrepPage
      customExamId={customExamId}
      basePath={`/${year}/${subjectSlug}/custom/${customExamId}`}
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: year, href: `/${year}` },
        { label: subjectSlug, href: `/${year}/${subjectSlug}` },
        { label: 'Custom Exam' },
      ]}
    />
  )
}