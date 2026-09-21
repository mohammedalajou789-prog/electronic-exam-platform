'use client'
import { useParams } from 'next/navigation'
import SharedPdfPage from '@/components/exam/shared/SharedPdfPage'

export default function Page() {
  const { customExamId } = useParams() as { customExamId: string }
  return <SharedPdfPage customExamId={customExamId} />
}