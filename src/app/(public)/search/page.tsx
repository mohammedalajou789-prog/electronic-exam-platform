// src/app/(public)/search/page.tsx
import { createPublicSupabaseClient } from '@/lib/supabase/public'
import { parseSearchTerms, searchQuestions, type SearchResponse } from '@/features/search/search-questions'
import SearchClient from '@/components/search/SearchClient'
import { compareBatches } from '@/lib/batch-order'

interface BatchLink {
  subject_id: string
  batch: { id: string; name: string; slug: string; graduation_year: number | null } | null
}

interface ExamOption {
  id: string
  title: string
  subject_id: string | null
  /** The exam's batch; matched to the batch filter by slug (every batch name has one slug) */
  batches: { slug: string } | null
}

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
    { data: batchLinks    },
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

    // Which batches each subject is shown to
    supabase
      .from('subject_batches')
      .select('subject_id, batch:batches(id, name, slug, graduation_year)'),

    supabase
      .from('exams')
      .select('id, title, subject_id, batches(slug)')
      .eq('status', 'published')
      .is('deleted_at', null)
      .order('title', { ascending: true }),

    initialSearch,
  ])

  // One option per subject + batch link, newest graduation year first
  const batchOptions = ((batchLinks ?? []) as unknown as BatchLink[])
    .flatMap(link => (link.batch ? [{ ...link.batch, subject_id: link.subject_id }] : []))
    .sort(compareBatches)

  return (
    <SearchClient
      initialQuery={query}
      initialResults={initialResults}
      initialTotal={initialTotal}
      academicYears={(academicYears ?? []).map(y => ({ id: y.id, name: y.name }))}
      semesters={(semesters ?? []).map(s => ({ id: s.id, name: s.name, academic_year_id: s.academic_year_id }))}
      subjects={(subjectsRaw ?? []).map(s => ({ id: s.id, name: s.name, semester_id: s.semester_id, academic_year_id: s.academic_year_id }))}
      batches={batchOptions.map(b => ({ id: b.id, name: b.name, subject_id: b.subject_id, slug: b.slug }))}
      exams={((examsRaw ?? []) as unknown as ExamOption[]).map(e => ({ id: e.id, name: e.title, subject_id: e.subject_id, batch_slug: e.batches?.slug ?? null }))}
    />
  )
}