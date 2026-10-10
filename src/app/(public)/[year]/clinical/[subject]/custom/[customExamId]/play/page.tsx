import SharedPlayPage from '@/components/exam/shared/SharedPlayPage'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ customExamId: string }>
  searchParams: Promise<{ resume?: string }>
}

export default async function Page({ params, searchParams }: PageProps) {
  // customExamId is the exam's name in the link (or the id of a guest's exam)
  const { customExamId } = await params
  const { resume } = await searchParams
  return <SharedPlayPage customExamId={customExamId} resume={resume} />
}