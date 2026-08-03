// src/app/(public)/[year]/[semester]/page.tsx

import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import SharedSubjectPage from '@/components/exam/shared/SharedSubjectPage'
import Link from 'next/link'

function slugToName(s: string) {
  return s.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
}
function nameToSlug(s: string) {
  return s.toLowerCase().replace(/\s+/g, '-')
}

export default async function SemesterPage({
  params,
}: {
  params: Promise<{ year: string; semester: string }>
}) {
  const { year: yearSlug, semester: semesterSlug } = await params
  const supabase = await createServerSupabaseClient()

  const { data: academicYear } = await supabase
    .from('academic_years')
    .select('id, name, is_clinical')
    .eq('name', slugToName(yearSlug))
    .single()

  if (!academicYear) notFound()

  // ── CLINICAL: [semester] = subject slug ───────────────────────
  if (academicYear.is_clinical) {
    const { data: allSubjects } = await supabase
      .from('subjects')
      .select('id, name')
      .eq('year_id', academicYear.id)

    const subject = allSubjects?.find(
      (s: any) => nameToSlug(s.name) === semesterSlug
    )
    if (!subject) notFound()

    return (
      <SharedSubjectPage
        subjectId={subject.id}
        subjectName={subject.name}
        basePath={`/${yearSlug}/${semesterSlug}`}
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: academicYear.name, href: `/${yearSlug}` },
          { label: subject.name },
        ]}
      />
    )
  }

  // ── PRE-CLINICAL: show subjects in semester ───────────────────
  const { data: semesterData } = await supabase
    .from('semesters')
    .select('id, name')
    .eq('academic_year_id', academicYear.id)
    .eq('name', slugToName(semesterSlug))
    .single()

  if (!semesterData) notFound()

  const { data: rawSubjects } = await supabase
    .from('subjects')
    .select('id, name, display_order, batches(id, exams(id, question_count, status, deleted_at))')
    .eq('semester_id', semesterData.id)
    .order('display_order', { ascending: true })

  const subjects = (rawSubjects || []).map((s: any) => {
    const exams = (s.batches ?? [])
      .flatMap((b: any) => b.exams ?? [])
      .filter((e: any) => e.status === 'published' && !e.deleted_at)
    return {
      ...s,
      examCount: exams.length,
      questionCount: exams.reduce((n: number, e: any) => n + (e.question_count ?? 0), 0),
    }
  })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--fg)', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
      <main style={{ padding: '32px 28px 80px' }}>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontSize: 13, color: 'var(--fg-muted)', marginBottom: 18 }}>
          <Link href="/" style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>Home</Link>
          <span>›</span>
          <Link href={`/${yearSlug}`} style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>{academicYear.name}</Link>
          <span>›</span>
          <span style={{ color: 'var(--fg)', fontWeight: 700 }}>{semesterData.name}</span>
        </div>

        <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 800 }}>
          {semesterData.name} — {academicYear.name}
        </h1>
        <p style={{ margin: '0 0 28px', fontSize: 14.5, color: 'var(--fg-muted)' }}>
          Select a subject to browse batches and exams
        </p>

        {subjects.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 16 }}>
            {subjects.map((subject: any, i: number) => (
              <Link
                key={subject.id}
                href={`/${yearSlug}/${semesterSlug}/${nameToSlug(subject.name)}`}
                className="year-card"
                style={{ animationDelay: `${i * 60}ms`, flexDirection: 'column', alignItems: 'flex-start' }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--clr-soft)', color: 'var(--clr-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, flexShrink: 0 }}>
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  </svg>
                </div>
                <div style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--fg)', marginBottom: 6 }}>{subject.name}</div>
                <div style={{ fontSize: 12.5, color: 'var(--fg-muted)' }}>
                  {subject.examCount} exams · {subject.questionCount} questions
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 18, border: '1px dashed var(--bd)', padding: '64px 24px', textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700 }}>No subjects available</h3>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--fg-muted)' }}>Subjects will appear here once added by an administrator.</p>
          </div>
        )}
      </main>
    </div>
  )
}