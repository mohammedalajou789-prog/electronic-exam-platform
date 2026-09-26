// src/app/(public)/search/page.tsx
import { createPublicSupabaseClient } from '@/lib/supabase/public'
import { parseSearchTerms, searchQuestions, type SearchResponse } from '@/features/search/search-questions'
import SearchClient from '@/components/search/SearchClient'

interface PageProps {
  searchParams: Promise<{ q?: string }>
}

export default async function SearchPage({ searchParams }: PageProps) {
  const { q } = await searchParams
  const query  = q?.trim() ?? ''

  // Public content only, so the cookie-less client is enough
  const supabase = createPublicSupabaseClient()

  // Results for a query already in the URL (e.g. /search?q=heart).
  // Runs in parallel with the filter options below; a failed search just shows no results.
  const terms = query.length >= 2 ? parseSearchTerms(query) : []
  const initialSearch: Promise<SearchResponse> = searchQuestions(terms).catch((error: unknown) => {
    console.error('Search error:', error)
    return { results: [], total: 0 }
  })

  // Fetch all filter options server-side (small datasets — fine to load all)
  const [
    { data: academicYears },
    { data: semesters     },
    { data: subjectsRaw   },
    { data: batches       },
    { data: examsRaw      },
    { results: initialResults, total: initialTotal },
  ] = await Promise.all([

    supabase
      .from('academic_years')
      .select('id, name')
      .order('display_order', { ascending: true }),

    supabase
      .from('semesters')
      .select('id, name, academic_year_id')
      .order('display_order', { ascending: true }),

    supabase
      .from('subjects')
      .select('id, name, semester_id, academic_year_id')
      .order('display_order', { ascending: true }),

    supabase
      .from('batches')
      .select('id, name, subject_id')
      .order('display_order', { ascending: true }),

    supabase
      .from('exams')
      .select('id, title, batch_id')
      .eq('status', 'published')
      .is('deleted_at', null)
      .order('title', { ascending: true }),

    initialSearch,
  ])

  return (
    <SearchClient
      initialQuery={query}
      initialResults={initialResults}
      initialTotal={initialTotal}
      academicYears={(academicYears ?? []).map(y => ({ id: y.id, name: y.name }))}
      semesters={(semesters ?? []).map(s => ({ id: s.id, name: s.name, academic_year_id: s.academic_year_id }))}
      subjects={(subjectsRaw ?? []).map(s => ({ id: s.id, name: s.name, semester_id: s.semester_id, academic_year_id: s.academic_year_id }))}
      batches={(batches ?? []).map(b => ({ id: b.id, name: b.name, subject_id: b.subject_id }))}
      exams={(examsRaw ?? []).map(e => ({ id: e.id, name: e.title, batch_id: e.batch_id }))}
    />
  )
}