'use client'
import { useParams } from 'next/navigation'
import SharedPdfPage from '@/components/exam/shared/SharedPdfPage'

export default function Page() {
  const { batch: examId } = useParams() as { batch: string }
  return <SharedPdfPage examId={examId} />
}