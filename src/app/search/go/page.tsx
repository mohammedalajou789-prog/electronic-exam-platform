// src/app/search/go/page.tsx
//
// Redirect helper used by the "Go to Exam" button in search results:
// given an exam_id, opens that exam's preparation page.

import { notFound, redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getExamPrepPath } from '@/lib/exam-path'

interface Props {
  searchParams: Promise<{ exam_id?: string }>
}

export default async function SearchGoPage({ searchParams }: Props): Promise<never> {
  const { exam_id } = await searchParams
  if (!exam_id) notFound()

  const supabase = await createServerSupabaseClient()
  const prepPath = await getExamPrepPath(supabase, exam_id)
  if (!prepPath) notFound()

  redirect(prepPath)
}