// src/app/(public)/[year]/basic/[semester]/[subject]/page.tsx
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import SharedSubjectPage from '@/components/exam/shared/SharedSubjectPage'

function slugToName(s: string) {
  return s.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
}
function nameToSlug(s: string) {
  return s.toLowerCase().replace(/\s+/g, '-')
}

interface PageProps {
  params: Promise<{ year: string; semester: string; subject: string }>
}

export default async function BasicSubjectPage({ params }: PageProps) {
  const { year: yearSlug, semester: semSlug, subject: subjectSlug } = await params
  const supabase = await createServerSupabaseClient()

  const { data: academicYear } = await supabase
    .from('academic_years')
    .select('id, name, is_clinical')
    .eq('name', slugToName(yearSlug))
    .single()

  if (!academicYear || academicYear.is_clinical) notFound()

  const { data: semesterData } = await supabase
    .from('semesters')
    .select('id, name')
    .eq('academic_year_id', academicYear.id)
    .eq('name', slugToName(semSlug))
    .single()

  if (!semesterData) notFound()

  const { data: allSubjects } = await supabase
    .from('subjects')
    .select('id, name')
    .eq('semester_id', semesterData.id)

  const subject = allSubjects?.find((s: any) => nameToSlug(s.name) === subjectSlug)
  if (!subject) notFound()

  return (
    <SharedSubjectPage
      subjectId={subject.id}
      subjectName={subject.name}
      basePath={`/${yearSlug}/basic/${semSlug}/${subjectSlug}`}
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: academicYear.name, href: `/${yearSlug}` },
        { label: semesterData.name, href: `/${yearSlug}/basic/${semSlug}` },
        { label: subject.name },
      ]}
    />
  )
}