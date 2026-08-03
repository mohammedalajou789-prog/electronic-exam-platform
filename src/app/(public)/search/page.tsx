// src/app/(public)/search/page.tsx
import { createServerSupabaseClient } from '@/lib/supabase/server'
import SearchClient from '@/components/search/SearchClient'

interface PageProps {
  searchParams: Promise<{ q?: string }>
}

export default async function SearchPage({ searchParams }: PageProps) {
  const { q } = await searchParams
  const query  = q?.trim() ?? ''

  const supabase = await createServerSupabaseClient()

  // Fetch all filter options server-side (small datasets — fine to load all)
  const [
    { data: academicYears },
    { data: semesters     },
    { data: subjectsRaw   },
    { data: batches       },
    { data: examsRaw      },
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
  ])

  // Fetch initial results if there's a query in the URL
  let initialResults: any[] = []
  let initialTotal = 0

  if (query.length >= 2) {
    const terms = query.split('+').map((t: string) => t.trim()).filter((t: string) => t.length >= 2)

    const { data: raw } = await supabase
      .from('questions')
      .select(`
        id, question_text, question_order,
        choice_a, choice_b, choice_c, choice_d, choice_e,
        correct_answer, explanation, chapter, lecture,
        exam:exams(
          id, title, calendar_year, status,
          batch:batches(
            id, name,
            subject:subjects(
              id, name,
              semester_id,
              academic_year_id,
              semester:semesters(id, name, academic_year:academic_years!semesters_academic_year_id_fkey(id, name)),
              academic_year:academic_years!subjects_academic_year_id_fkey(id, name)
            )
          )
        ),
        doctor:doctors(id, name)
      `)
      .is('deleted_at', null)
      .limit(2000)

    initialResults = (raw ?? []).filter((q: any) => {
      if (q.exam?.status !== 'published') return false

      const exam    = q.exam as any
      const batch   = exam?.batch as any
      const subject = batch?.subject as any
      const doctor  = q.doctor as any

      const academicYear = subject?.semester?.academic_year ?? subject?.academic_year

      const haystack = [
        q.question_text, q.chapter, q.lecture, q.correct_answer, q.explanation,
        q.choice_a, q.choice_b, q.choice_c, q.choice_d, q.choice_e,
        exam?.title, exam?.calendar_year?.toString(),
        batch?.name, subject?.name,
        subject?.semester?.name,
        academicYear?.name,
        doctor?.name,
      ].filter(Boolean).join(' ').toLowerCase()

      return terms.every((term: string) => haystack.includes(term.toLowerCase()))
    })

    initialTotal = initialResults.length
  }

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