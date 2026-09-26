// src/app/(public)/[year]/basic/[semester]/[subject]/page.tsx
import { notFound } from 'next/navigation'
import { createPublicSupabaseClient, assertQuerySucceeded } from '@/lib/supabase/public'
import SharedSubjectPage from '@/components/exam/shared/SharedSubjectPage'

/**
 * Caching: this page only shows public academic content (no user data),
 * so it is built once and served from cache to every student.
 * It is rebuilt at most every 5 minutes, so new content from admins appears within 5 minutes.
 */
export const revalidate = 300

/**
 * No subject pages are built during `npm run build`.
 * Each subject page is built on its first visit, then cached (see `revalidate` above).
 */
export async function generateStaticParams(): Promise<{ year: string; semester: string; subject: string }[]> {
  return []
}

interface PageProps {
  params: Promise<{ year: string; semester: string; subject: string }>
}

export default async function BasicSubjectPage({ params }: PageProps) {
  const { year: yearSlug, semester: semSlug, subject: subjectSlug } = await params
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
    .eq('slug', subjectSlug)
    .maybeSingle()

  assertQuerySucceeded(subjectError, 'subject')
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