import { createServerSupabaseClient } from '@/lib/supabase/server'
import ExamsClientPage from '@/components/admin/ExamsClientPage'

async function getExams() {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('exams')
    .select(`
      *,
      batch:batches(
        name,
        subject:subjects(
          name,
          academic_year_id,
          direct_year:academic_years(name),
          semester:semesters(
            name,
            academic_year:academic_years(name)
          )
        )
      ),
      doctor:doctors(name)
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching exams:', error)
    return []
  }

  return data || []
}

async function getFilterOptions() {
  const supabase = await createServerSupabaseClient()

  const { data: years } = await supabase
    .from('academic_years')
    .select('name')
    .order('display_order')

  const { data: semesters } = await supabase
    .from('semesters')
    .select('name')
    .order('display_order')

  const { data: batches } = await supabase
    .from('batches')
    .select('name')
    .order('display_order')

  return {
    academicYears: [...new Set(years?.map(y => y.name) ?? [])] as string[],
    semesters: [...new Set(semesters?.map(s => s.name) ?? [])] as string[],
    batches: [...new Set(batches?.map(b => b.name) ?? [])] as string[],
  }
}

export default async function AdminExamsPage() {
  const [exams, { academicYears, semesters, batches }] = await Promise.all([
    getExams(),
    getFilterOptions(),
  ])

  return (
    <ExamsClientPage
      exams={exams}
      academicYears={academicYears}
      semesters={semesters}
      batches={batches}
    />
  )
}