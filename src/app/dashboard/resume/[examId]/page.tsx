// src/app/dashboard/resume/[examId]/page.tsx
//
// "Continue" buttons on the dashboard link here.
// Finds the exam's real URL and opens it in resume mode.

import { notFound, redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getExamPrepPath } from '@/lib/exam-path'

interface PageProps {
  params: Promise<{ examId: string }>
}

export default async function ResumeExamPage({ params }: PageProps): Promise<never> {
  const { examId } = await params
  const supabase = await createServerSupabaseClient()

  const prepPath = await getExamPrepPath(supabase, examId)
  if (!prepPath) notFound()

  redirect(`${prepPath}/play?resume=true`)
}
