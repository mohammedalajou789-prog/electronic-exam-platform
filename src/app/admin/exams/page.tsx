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
          ),
          direct_year:academic_years(name)
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

  // دالة مساعدة لاستخراج اسم السنة (من semester أو مباشرة)
  function getYearName(e: any): string {
    return e.batch?.subject?.semester?.academic_year?.name
      ?? e.batch?.subject?.direct_year?.name
      ?? ''
  }

  function getSemesterName(e: any): string {
    return e.batch?.subject?.semester?.name ?? ''
  }

  const academicYears = [...new Set(
    exams.map((e: any) => getYearName(e)).filter(Boolean)
  )] as string[]

  const semesters = [...new Set(
    exams.map((e: any) => getSemesterName(e)).filter(Boolean)
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