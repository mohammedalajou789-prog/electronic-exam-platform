import SharedExamPrepPage from '@/components/exam/shared/SharedExamPrepPage'

interface PageProps {
  params: Promise<{ year: string; subject: string; batch: string; examId: string }>
}

export default async function Page({ params }: PageProps) {
  const { year, subject, batch, examId } = await params
  const basePath = `/${year}/clinical/${subject}/${batch}/${examId}`

  return (
    <SharedExamPrepPage
      examId={examId}
      basePath={basePath}
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: 'Exam' },
      ]}
    />
  )
}