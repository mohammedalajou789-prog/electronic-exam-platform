// src/features/search/search-questions.ts
//
// One place for question search, used by the search page (first load) and by
// /api/search/results (every search after that).
//
// The searching itself happens inside the database, in the SQL function
// public.search_questions. It looks through ALL questions and returns only the matches,
// instead of downloading ~1000 questions and filtering them in JavaScript.

import { createPublicSupabaseClient } from '@/lib/supabase/public'
import { isUuid } from '@/lib/uuid'

/** Optional filters; each one is an id, or null for "any" */
export interface SearchFilters {
  yearId?: string | null
  semesterId?: string | null
  subjectId?: string | null
  batchId?: string | null
  examId?: string | null
}

/** What the search page and the API return: the matching questions and how many there are */
export interface SearchResponse {
  results: unknown[]
  total: number
}

/** Terms shorter than this are ignored (same rule as before) */
const MIN_TERM_LENGTH = 2

/**
 * Splits a query into terms: "Medicine + Hypertension + 2024" → ["Medicine", "Hypertension", "2024"].
 * Every term must match (logical AND).
 */
export function parseSearchTerms(query: string): string[] {
  return query
    .split('+')
    .map(term => term.trim())
    .filter(term => term.length >= MIN_TERM_LENGTH)
}

/** Returns the value if it is a well-formed UUID, otherwise null (so bad filter values are ignored) */
export function toUuidOrNull(value: string | null | undefined): string | null {
  return value && isUuid(value) ? value : null
}

/**
 * Searches all questions of published exams. Throws if the database call fails,
 * so the caller decides what the student sees.
 */
export async function searchQuestions(
  terms: string[],
  filters: SearchFilters = {}
): Promise<SearchResponse> {
  if (terms.length === 0) return { results: [], total: 0 }

  const supabase = createPublicSupabaseClient()
  const { data, error } = await supabase.rpc('search_questions', {
    search_terms: terms,
    filter_year_id: toUuidOrNull(filters.yearId),
    filter_semester_id: toUuidOrNull(filters.semesterId),
    filter_subject_id: toUuidOrNull(filters.subjectId),
    filter_batch_id: toUuidOrNull(filters.batchId),
    filter_exam_id: toUuidOrNull(filters.examId),
  })

  if (error) {
    throw new Error(`Question search failed: ${error.message}`)
  }

  const response = data as Partial<SearchResponse> | null
  return {
    results: response?.results ?? [],
    total: response?.total ?? 0,
  }
}