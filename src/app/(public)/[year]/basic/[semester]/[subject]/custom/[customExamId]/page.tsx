// src/app/(public)/[year]/basic/[semester]/[subject]/custom/[customExamId]/page.tsx
import SharedExamPrepPage from '@/components/exam/shared/SharedExamPrepPage'

interface PageProps {
  params: Promise<{ year: string; semester: string; subject: string; customExamId: string }>
}

export default async function Page({ params }: PageProps) {
  const { year, semester, subject, customExamId } = await params
  const basePath = `/${year}/basic/${semester}/${subject}/custom/${customExamId}`
  return (
    <SharedExamPrepPage
      customExamId={customExamId}
      basePath={basePath}
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: year, href: `/${year}` },
        { label: semester, href: `/${year}/basic/${semester}` },
        { label: subject, href: `/${year}/basic/${semester}/${subject}` },
        { label: 'Custom Exam' },
      ]}
    />
  )
}