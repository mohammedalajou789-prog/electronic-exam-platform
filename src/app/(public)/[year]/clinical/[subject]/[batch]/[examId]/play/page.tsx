import SharedPlayPage from '@/components/exam/shared/SharedPlayPage'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ examId: string }>
  searchParams: Promise<{ resume?: string; set?: string }>
}

export default async function Page({ params, searchParams }: PageProps) {
  const { examId } = await params
  const { resume, set } = await searchParams
  return <SharedPlayPage examId={examId} resume={resume} set={set} />
}