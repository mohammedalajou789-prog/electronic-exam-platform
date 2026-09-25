import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import SharedBatchPage from '@/components/exam/shared/SharedBatchPage'

interface PageProps {
  params: Promise<{ year: string; semester: string; subject: string; batch: string }>
}

export default async function BasicBatchPage({ params }: PageProps) {
  const { year: yearSlug, semester: semSlug, subject: subSlug, batch: batchSlug } = await params
  const supabase = await createServerSupabaseClient()

  const { data: academicYear } = await supabase
    .from('academic_years')
    .select('id, name, is_clinical')
    .eq('slug', yearSlug)
    .single()

  if (!academicYear || academicYear.is_clinical) notFound()

  const { data: semesterData } = await supabase
    .from('semesters')
    .select('id, name')
    .eq('academic_year_id', academicYear.id)
    .eq('slug', semSlug)
    .single()

  if (!semesterData) notFound()

  const { data: subject } = await supabase
    .from('subjects')
    .select('id, name')
    .eq('semester_id', semesterData.id)
    .eq('slug', subSlug)
    .maybeSingle()

  if (!subject) notFound()

  const { data: batch } = await supabase
    .from('batches')
    .select('id, name')
    .eq('subject_id', subject.id)
    .eq('slug', batchSlug)
    .maybeSingle()

  if (!batch) notFound()

  return (
    <SharedBatchPage
      batchId={batch.id}
      batchName={batch.name}
      subjectName={subject.name}
      basePath={`/${yearSlug}/basic/${semSlug}/${subSlug}/${batchSlug}`}
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: academicYear.name, href: `/${yearSlug}` },
        { label: semesterData.name, href: `/${yearSlug}/basic/${semSlug}` },
        { label: subject.name, href: `/${yearSlug}/basic/${semSlug}/${subSlug}` },
        { label: batch.name },
      ]}
    />
  )
}
