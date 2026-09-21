import SharedPlayPage from '@/components/exam/shared/SharedPlayPage'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ customExamId: string }>
}

export default async function Page({ params }: PageProps) {
  const { customExamId } = await params
  return <SharedPlayPage customExamId={customExamId} />
}