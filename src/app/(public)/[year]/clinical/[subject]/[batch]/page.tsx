import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import SharedBatchPage from '@/components/exam/shared/SharedBatchPage'

interface PageProps {
  params: Promise<{ year: string; subject: string; batch: string }>
}

export default async function Page({ params }: PageProps) {
  const { year, subject, batch } = await params
  const supabase = await createServerSupabaseClient()

  const { data: academicYear } = await supabase
    .from('academic_years')
    .select('id, name, is_clinical')
    .eq('slug', year)
    .single()

  if (!academicYear || !academicYear.is_clinical) notFound()

  const { data: subjectRow } = await supabase
    .from('subjects')
    .select('id, name')
    .eq('year_id', academicYear.id)
    .eq('slug', subject)
    .single()

  if (!subjectRow) notFound()

  const { data: batchRow } = await supabase
    .from('batches')
    .select('id, name')
    .eq('subject_id', subjectRow.id)
    .eq('slug', batch)
    .single()

  if (!batchRow) notFound()

  const basePath = `/${year}/clinical/${subject}/${batch}`

  return (
    <SharedBatchPage
      batchId={batchRow.id}
      batchName={batchRow.name}
      subjectName={subjectRow.name}
      basePath={basePath}
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: academicYear.name, href: `/${year}` },
        { label: subjectRow.name, href: `/${year}/clinical/${subject}` },
        { label: batchRow.name },
      ]}
    />
  )
}
