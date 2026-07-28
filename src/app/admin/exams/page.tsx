
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

export default async function AdminExamsPage() {
  const exams = await getExams()

  // استخراج القيم الفريدة للفلاتر
  const academicYears = [...new Set(
    exams.map((e: any) => e.batch?.subject?.semester?.academic_year?.name).filter(Boolean)
  )] as string[]

  const semesters = [...new Set(
    exams.map((e: any) => e.batch?.subject?.semester?.name).filter(Boolean)
  )] as string[]

  const batches = [...new Set(
    exams.map((e: any) => e.batch?.name).filter(Boolean)
  )] as string[]

  return (
    <ExamsClientPage
      exams={exams}
      academicYears={academicYears}
      semesters={semesters}
      batches={batches}
    />
  )
}