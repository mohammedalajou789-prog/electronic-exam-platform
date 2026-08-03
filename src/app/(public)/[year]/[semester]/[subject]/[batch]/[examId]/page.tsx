import SharedExamPrepPage from '@/components/exam/shared/SharedExamPrepPage'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ExamPrepPage({
  params,
}: {
  params: Promise<{
    year: string
    semester: string
    subject: string
    batch: string
    examId: string
  }>
}) {
  const { year, semester, subject, batch, examId } = await params

  return (
    <SharedExamPrepPage
      examId={examId}
      basePath={`/${year}/${semester}/${subject}/${batch}/${examId}`}
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: year, href: `/${year}` },
        { label: semester, href: `/${year}/${semester}` },
        { label: subject, href: `/${year}/${semester}/${subject}` },
        { label: batch, href: `/${year}/${semester}/${subject}/${batch}` },
        { label: 'Exam' },
      ]}
    />
  )
}