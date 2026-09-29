// src/lib/exam-path.ts
//
// Builds the URL of an exam's preparation page from its id.
//   Basic (years 1-3):    /[year]/basic/[semester]/[subject]/[batch]/[examId]
//   Clinical (years 4-6): /[year]/clinical/[subject]/[batch]/[examId]
//
// Every URL segment comes from the `slug` column, which the database
// generates automatically from the name ("Internal Medicine" -> "internal-medicine").

import type { SupabaseClient } from '@supabase/supabase-js'

interface SubjectRow {
  id: string
  slug: string
  semester_id: string | null
  year_id: string | null
}
interface ExamRow {
  id: string
  batch: { slug: string } | null
  subject: SubjectRow | null
}
interface SemesterRow {
  id: string
  slug: string
  academic_year_id: string | null
}
interface AcademicYearRow {
  id: string
  slug: string
  is_clinical: boolean
}

/**
 * Returns the preparation page path of a published exam,
 * or null if the exam (or any part of its hierarchy) cannot be found.
 */
export async function getExamPrepPath(
  supabase: SupabaseClient,
  examId: string
): Promise<string | null> {
  // The exam, its batch and its subject come back in one request
  const { data: exam } = await supabase
    .from('exams')
    .select('id, batch:batches(slug), subject:subjects(id, slug, semester_id, year_id)')
    .eq('id', examId)
    .eq('status', 'published')
    .is('deleted_at', null)
    .maybeSingle<ExamRow>()
  const batch = exam?.batch
  const subject = exam?.subject
  if (!exam || !batch || !subject) return null

  // Basic subjects sit under a semester; clinical subjects sit directly under a year
  let semester: SemesterRow | null = null
  let yearId: string | null = subject.year_id

  if (subject.semester_id) {
    const { data } = await supabase
      .from('semesters')
      .select('id, slug, academic_year_id')
      .eq('id', subject.semester_id)
      .maybeSingle<SemesterRow>()
    semester = data
    yearId = semester?.academic_year_id ?? yearId
  }
  if (!yearId) return null

  const { data: year } = await supabase
    .from('academic_years')
    .select('id, slug, is_clinical')
    .eq('id', yearId)
    .maybeSingle<AcademicYearRow>()
  if (!year) return null

  if (year.is_clinical) {
    return `/${year.slug}/clinical/${subject.slug}/${batch.slug}/${exam.id}`
  }
  if (!semester) return null
  return `/${year.slug}/basic/${semester.slug}/${subject.slug}/${batch.slug}/${exam.id}`
}
