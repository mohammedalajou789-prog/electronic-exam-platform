// src/app/dashboard/custom/[customExamId]/page.tsx
//
// The dashboard links here for custom exams ("Continue" and "My custom exams").
// Finds the exam's real URL (under its subject) and opens it:
//   ?resume=true -> continues the open attempt; otherwise the preparation page.

import { notFound, redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCustomExamPrepPath } from '@/lib/exam-path'
import { isUuid } from '@/lib/uuid'

interface PageProps {
  params: Promise<{ customExamId: string }>
  searchParams: Promise<{ resume?: string }>
}

export default async function OpenCustomExamPage({ params, searchParams }: PageProps): Promise<never> {
  const { customExamId } = await params
  const { resume } = await searchParams
  if (!isUuid(customExamId)) notFound()

  const supabase = await createServerSupabaseClient()
  const prepPath = await getCustomExamPrepPath(supabase, customExamId)
  if (!prepPath) notFound()

  redirect(resume === 'true' ? `${prepPath}/play?resume=true` : prepPath)
}