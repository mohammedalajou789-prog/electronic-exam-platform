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
export async function generateStaticParams(): Promise<{ year: string; semester: string; subject: string; batch: string }[]> {
  return []
}

interface PageProps {
  params: Promise<{ year: string; semester: string; subject: string; batch: string }>
}

export default async function BasicBatchPage({ params }: PageProps) {
  const { year: yearSlug, semester: semSlug, subject: subSlug, batch: batchSlug } = await params
  const supabase = createPublicSupabaseClient()

  // maybeSingle(): "no row" is not an error (it returns null), so any error here is a real failure
  const { data: academicYear, error: yearError } = await supabase
    .from('academic_years')
    .select('id, name, is_clinical')
    .eq('slug', yearSlug)
    .maybeSingle()

  assertQuerySucceeded(yearError, 'academic year')
  if (!academicYear || academicYear.is_clinical) notFound()

  const { data: semesterData, error: semesterError } = await supabase
    .from('semesters')
    .select('id, name')
    .eq('academic_year_id', academicYear.id)
    .eq('slug', semSlug)
    .maybeSingle()

  assertQuerySucceeded(semesterError, 'semester')
  if (!semesterData) notFound()

  const { data: subject, error: subjectError } = await supabase
    .from('subjects')
    .select('id, name')
    .eq('semester_id', semesterData.id)
    .eq('slug', subSlug)
    .maybeSingle()

  assertQuerySucceeded(subjectError, 'subject')
  if (!subject) notFound()

  // The batch must be linked to this subject; otherwise the URL does not exist
  const { data: link, error: batchError } = await supabase
    .from('subject_batches')
    .select('batches!inner(name)')
    .eq('subject_id', subject.id)
    .eq('batches.slug', batchSlug)
    .maybeSingle()

  assertQuerySucceeded(batchError, 'batch')
  const batch = (link as unknown as { batches: { name: string } | null } | null)?.batches
  if (!batch) notFound()

  return (
    <SharedBatchPage
      subjectId={subject.id}
      batchSlug={batchSlug}
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