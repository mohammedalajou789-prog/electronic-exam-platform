// src/app/(public)/[year]/basic/[semester]/[subject]/[batch]/[examId]/play/page.tsx
import SharedPlayPage from '@/components/exam/shared/SharedPlayPage'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ examId: string }>
  searchParams: Promise<{ resume?: string }>
}

export default async function Page({ params, searchParams }: PageProps) {
  const { examId } = await params
  const { resume } = await searchParams
  return <SharedPlayPage examId={examId} resume={resume} />
}