import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import SharedSubjectPage from '@/components/exam/shared/SharedSubjectPage'

interface PageProps {
  params: Promise<{ year: string; subject: string }>
}

function slugToName(slug: string): string {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

export default async function Page({ params }: PageProps) {
  const { year, subject } = await params
  const supabase = await createServerSupabaseClient()

  const { data: academicYear } = await supabase
    .from('academic_years')
    .select('id, name, is_clinical')
    .eq('name', slugToName(year))
    .single()

  if (!academicYear || !academicYear.is_clinical) notFound()

  const { data: subjectRow } = await supabase
    .from('subjects')
    .select('id, name')
    .eq('year_id', academicYear.id)
    .eq('name', slugToName(subject))
    .single()

  if (!subjectRow) notFound()

  const basePath = `/${year}/clinical/${subject}`

  return (
    <SharedSubjectPage
      subjectId={subjectRow.id}
      subjectName={subjectRow.name}
      basePath={basePath}
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: academicYear.name, href: `/${year}` },
        { label: subjectRow.name },
      ]}
    />
  )
}