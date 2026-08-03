export const dynamic = 'force-dynamic'
import SharedPlayPage from '@/components/exam/shared/SharedPlayPage'

interface PageProps {
  params: Promise<{ batch: string }>
  searchParams: Promise<{ resume?: string }>
}

export default async function Page({ params, searchParams }: PageProps) {
  const { batch: examId } = await params
  const { resume } = await searchParams
  return <SharedPlayPage examId={examId} resume={resume} />
}