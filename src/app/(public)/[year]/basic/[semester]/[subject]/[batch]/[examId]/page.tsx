// src/app/(public)/[year]/basic/[semester]/[subject]/[batch]/[examId]/page.tsx
import SharedExamPrepPage from '@/components/exam/shared/SharedExamPrepPage'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: Promise<{ year: string; semester: string; subject: string; batch: string; examId: string }>
}

export default async function Page({ params }: PageProps) {
  const { year, semester, subject, batch, examId } = await params
  const basePath = `/${year}/basic/${semester}/${subject}/${batch}/${examId}`
  return (
    <SharedExamPrepPage
      examId={examId}
      basePath={basePath}
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: year, href: `/${year}` },
        { label: semester, href: `/${year}/basic/${semester}` },
        { label: subject, href: `/${year}/basic/${semester}/${subject}` },
        { label: batch, href: `/${year}/basic/${semester}/${subject}/${batch}` },
        { label: 'Exam' },
      ]}
    />
  )
}