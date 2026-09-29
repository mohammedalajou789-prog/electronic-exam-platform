import { notFound } from 'next/navigation'
import { createPublicSupabaseClient, assertQuerySucceeded } from '@/lib/supabase/public'
import SharedBatchPage from '@/components/exam/shared/SharedBatchPage'

/**
 * Caching: this page only shows public academic content (no user data),
 * so it is built once and served from cache to every student.
 * It is rebuilt at most every 5 minutes, so new content from admins appears within 5 minutes.
 */
export const revalidate = 300

/**
 * No batch pages are built during `npm run build`.
 * Each batch page is built on its first visit, then cached (see `revalidate` above).
 */
export async function generateStaticParams(): Promise<{ year: string; subject: string; batch: string }[]> {
  return []
}

interface PageProps {
  params: Promise<{ year: string; subject: string; batch: string }>
}

export default async function Page({ params }: PageProps) {
  const { year, subject, batch } = await params
  const supabase = createPublicSupabaseClient()

  // maybeSingle(): "no row" is not an error (it returns null), so any error here is a real failure
  const { data: academicYear, error: yearError } = await supabase
    .from('academic_years')
    .select('id, name, is_clinical')
    .eq('slug', year)
    .maybeSingle()

  assertQuerySucceeded(yearError, 'academic year')
  if (!academicYear || !academicYear.is_clinical) notFound()

  const { data: subjectRow, error: subjectError } = await supabase
    .from('subjects')
    .select('id, name')
    .eq('year_id', academicYear.id)
    .eq('slug', subject)
    .maybeSingle()

  assertQuerySucceeded(subjectError, 'subject')
  if (!subjectRow) notFound()

  // The batch must be linked to this subject; otherwise the URL does not exist
  const { data: link, error: batchError } = await supabase
    .from('subject_batches')
    .select('batches!inner(name)')
    .eq('subject_id', subjectRow.id)
    .eq('batches.slug', batch)
    .maybeSingle()

  assertQuerySucceeded(batchError, 'batch')
  const batchRow = (link as unknown as { batches: { name: string } | null } | null)?.batches
  if (!batchRow) notFound()

  const basePath = `/${year}/clinical/${subject}/${batch}`

  return (
    <SharedBatchPage
      subjectId={subjectRow.id}
      batchSlug={batch}
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