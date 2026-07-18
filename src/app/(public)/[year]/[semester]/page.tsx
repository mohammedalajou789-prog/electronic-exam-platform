import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ChevronRight } from 'lucide-react'


interface PageProps {
  params: Promise<{ year: string; semester: string }>
}

function slugToName(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

async function getSemesterWithSubjects(
  yearSlug: string,
  semesterSlug: string
) {
  const supabase = await createServerSupabaseClient()

  const yearName     = slugToName(yearSlug)
  const semesterName = slugToName(semesterSlug)

  const { data: academicYear } = await supabase
    .from('academic_years')
    .select(`
      *,
      semesters!inner(
        *,
        subjects(
          *,
          batches(
            id,
            exams(id, question_count)
          )
        )
      )
    `)
    .eq('name', yearName)
    .eq('semesters.name', semesterName)
    .single()

  if (!academicYear) return null

  const semester = academicYear.semesters?.[0]
  if (!semester) return null

  const subjects = (semester.subjects ?? [])
    .sort((a: { display_order: number }, b: { display_order: number }) => a.display_order - b.display_order)
    .map((subject: {
      batches?: { exams?: { id: string; question_count: number }[] }[]
      [key: string]: unknown
    }) => {
      const allExams = (subject.batches ?? []).flatMap(b => b.exams ?? [])
      return {
        ...subject,
        examCount:     allExams.length,
        questionCount: allExams.reduce((sum, e) => sum + (e.question_count ?? 0), 0),
      }
    })

  return { academicYear, semester, subjects }
}

export default async function SemesterPage({ params }: PageProps) {
  const { year, semester } = await params
  const result = await getSemesterWithSubjects(year, semester)

  if (!result) notFound()

  const { academicYear, semester: semesterData, subjects } = result

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--fg)', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
      <main style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 24px 80px', animation: '0.45s ease-out 0s 1 normal none running fadeSlideIn' }}>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontSize: 13, color: 'var(--fg-muted)', marginBottom: 18 }}>
          <Link href="/" style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>Home</Link>
          <span>›</span>
          <Link href={`/${year}`} style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>{academicYear.name}</Link>
          <span>›</span>
          <span style={{ color: 'var(--fg)', fontWeight: 700 }}>{semesterData.name}</span>
        </div>

        {/* Header */}
        <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 800, color: 'var(--fg)' }}>
          {semesterData.name} — {academicYear.name}
        </h1>
        <p style={{ margin: '0 0 28px', fontSize: 14.5, color: 'var(--fg-muted)' }}>
          Select a subject to browse batches and exams
        </p>

        {/* Subject Cards */}
        {subjects.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 16 }}>
            {subjects.map((subject: { id: string; name: string; examCount: number; questionCount: number; display_order: number }, index: number) => (
              <Link
                key={subject.id}
                href={`/${year}/${semester}/${subject.name.toLowerCase().replace(/\s+/g, '-')}`}
                className="year-card"
                style={{ animationDelay: `${index * 60}ms`, flexDirection: 'column', alignItems: 'flex-start' }}
              >
                {/* Icon */}
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--clr-soft)', color: 'var(--clr-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, flexShrink: 0 }}>
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  </svg>
                </div>

                {/* Subject name */}
                <div style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--fg)', marginBottom: 6 }}>
                  {subject.name}
                </div>

                {/* Stats */}
                <div style={{ fontSize: 12.5, color: 'var(--fg-muted)' }}>
                  {subject.examCount} exam{subject.examCount !== 1 ? 's' : ''} · {subject.questionCount} questions
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 18, border: '1px dashed var(--bd)', padding: '64px 24px', textAlign: 'center' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--fg-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 16, opacity: 0.5 }}>
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: 'var(--fg)' }}>No subjects available</h3>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--fg-muted)' }}>Subjects will appear here once they are added by an administrator.</p>
          </div>
        )}
      </main>
    </div>
  )
}