import SharedExamPrepPage from '@/components/exam/shared/SharedExamPrepPage'

interface PageProps {
  params: Promise<{ year: string; subject: string; customExamId: string }>
}

export default async function Page({ params }: PageProps) {
  const { year, subject, customExamId } = await params
  const basePath = `/${year}/clinical/${subject}/custom/${customExamId}`

  return (
    <SharedExamPrepPage
      customExamId={customExamId}
      basePath={basePath}
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: 'Custom Exam' },
      ]}
    />
  )
}