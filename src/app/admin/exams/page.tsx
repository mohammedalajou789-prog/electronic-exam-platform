import { createServerSupabaseClient } from '@/lib/supabase/server'
import ExamsClientPage from '@/components/admin/ExamsClientPage'

export default async function AdminExamsPage() {
  const supabase = await createServerSupabaseClient()

  const { data: exams } = await supabase
    .from('exams')
    .select(`
      id, title, exam_type, calendar_year, question_count, status,
      academic_year:academic_years(name),
      batch:batches(name),
      doctor:doctors(name),
      batch_detail:batches(
        subject:subjects(name)
      )
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

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

  const academicYears = [...new Set(years?.map(y => y.name) ?? [])] as string[]
  const semesterNames = [...new Set(semesters?.map(s => s.name) ?? [])] as string[]
  const batchNames = [...new Set(batches?.map(b => b.name) ?? [])] as string[]

  return (
    <ExamsClientPage
      exams={(exams ?? []) as any}
      academicYears={academicYears}
      semesters={semesterNames}
      batches={batchNames}
    />
  )
}