import SharedExamPrepPage from '@/components/exam/shared/SharedExamPrepPage'

export default async function CustomExamPrepPage({
  params,
}: {
  params: Promise<{
    year: string
    semester: string
    subject: string
    customExamId: string
  }>
}) {
  const { year, semester, subject, customExamId } = await params

  return (
    <SharedExamPrepPage
      customExamId={customExamId}
      basePath={`/${year}/${semester}/${subject}/custom/${customExamId}`}
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: year, href: `/${year}` },
        { label: semester, href: `/${year}/${semester}` },
        { label: subject, href: `/${year}/${semester}/${subject}` },
        { label: 'Custom Exam' },
      ]}
    />
  )
}