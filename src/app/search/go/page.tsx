// src/app/search/go/page.tsx
//
// Redirect helper: given an exam_id, finds the correct prep page URL
// and redirects the user there.
// Used by the "Go to Exam" button in search results.

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'

interface Props {
  searchParams: Promise<{ exam_id?: string }>
}

function nameToSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-')
}

export default async function SearchGoPage({ searchParams }: Props) {
  const { exam_id } = await searchParams
  if (!exam_id) notFound()

  const supabase = await createServerSupabaseClient()

  const { data: exam } = await supabase
    .from('exams')
    .select(`
      id,
      batch:batches(
        name,
        subject:subjects(
          name,
          semester:semesters(
            name,
            academic_year:academic_years!semesters_academic_year_id_fkey(name, is_clinical)
          ),
          academic_year:academic_years!subjects_academic_year_id_fkey(name, is_clinical)
        )
      )
    `)
    .eq('id', exam_id)
    .eq('status', 'published')
    .is('deleted_at', null)
    .single()

  if (!exam) notFound()

  const batch   = (exam.batch as any)
  const subject = batch?.subject
  const semester = subject?.semester
  const academicYear = semester?.academic_year ?? subject?.academic_year

  if (!academicYear || !subject || !batch) notFound()

  const yearSlug    = nameToSlug(academicYear.name)
  const subjectSlug = nameToSlug(subject.name)
  const batchSlug   = nameToSlug(batch.name)
  const isClinical  = academicYear.is_clinical

  let prepUrl: string

  if (isClinical) {
    // /[year]/[subject]/[batch]/[examId]
    prepUrl = `/${yearSlug}/${subjectSlug}/${batchSlug}/${exam_id}`
  } else {
    // /[year]/[semester]/[subject]/[batch]/[examId]
    const semesterSlug = nameToSlug(semester.name)
    prepUrl = `/${yearSlug}/${semesterSlug}/${subjectSlug}/${batchSlug}/${exam_id}`
  }

  redirect(prepUrl)
}