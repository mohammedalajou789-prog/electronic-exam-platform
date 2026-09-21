'use client'
import { useParams } from 'next/navigation'
import SharedPdfPage from '@/components/exam/shared/SharedPdfPage'

export default function Page() {
  const { examId } = useParams() as { examId: string }
  return <SharedPdfPage examId={examId} />
}