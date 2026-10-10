// src/features/exam-engine/custom-exam.ts
//
// Finds a custom exam from the last part of its link.
//   - A student's exam is opened by its name in the link (".../custom/cardio-review").
//     The database only returns a student's own exams (RLS), so another
//     student opening the same link gets "not found".
//   - A guest's temporary exam has no name and is opened by its id.
// Works with the server client and with the browser client.

import { isUuid } from '@/lib/uuid'
import type { createClient } from '@/lib/supabase/client'
import type { createServerSupabaseClient } from '@/lib/supabase/server'

/** Either Supabase client (type-only imports: nothing server-side reaches the browser) */
type AnySupabaseClient =
  | ReturnType<typeof createClient>
  | Awaited<ReturnType<typeof createServerSupabaseClient>>

/** The filters chosen when the exam was created (stored by create_custom_exam) */
export interface CustomExamFilters {
  requested_count?: number
  randomize?: boolean
  batch_ids?: string[]
  doctor_ids?: string[]
  chapter_ids?: string[]
  lecture_ids?: string[]
  not_answered?: boolean
  first_wrong?: boolean
}

export interface CustomExamRow {
  id: string
  subject_id: string
  user_id: string | null
  /** null for a guest's temporary exam */
  name: string | null
  /** The name used in the link; null for a guest's temporary exam */
  slug: string | null
  /** In the order the questions are shown */
  question_ids: string[]
  question_count: number
  filters: CustomExamFilters | null
  created_at: string
}

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

const COLUMNS = 'id, subject_id, user_id, name, slug, question_ids, question_count, filters, created_at'

/** Loads a custom exam by its link name (slug) or id; null when it does not exist or is not yours. */
export async function loadCustomExam(
  supabase: AnySupabaseClient,
  key: string
): Promise<CustomExamRow | null> {
  let query
  if (isUuid(key)) {
    query = supabase.from('custom_exams').select(COLUMNS).eq('id', key)
  } else if (key.length <= 60 && SLUG_PATTERN.test(key)) {
    query = supabase.from('custom_exams').select(COLUMNS).eq('slug', key)
  } else {
    return null
  }

  const { data, error } = await query.maybeSingle()
  if (error) {
    console.error('[custom-exam] Could not load the custom exam:', error.message)
    return null
  }
  return (data as CustomExamRow | null) ?? null
}

/** Puts rows in the order of the exam's question list (the database returns them unordered). */
export function inExamOrder<T extends { id: string }>(rows: T[], questionIds: string[]): T[] {
  const position = new Map(questionIds.map((id, i) => [id, i]))
  return [...rows].sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0))
}