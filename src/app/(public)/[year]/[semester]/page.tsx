import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ChevronRight } from 'lucide-react'
import type { AcademicYear, Semester, Subject } from '@/types/database'

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
): Promise<{
  academicYear: AcademicYear
  semester: Semester
  subjects: (Subject & { examCount: number; questionCount: number })[]
} | null> {
  const supabase = await createServerSupabaseClient()

  const yearName = slugToName(yearSlug)
  const semesterName = slugToName(semesterSlug)

  const { data: academicYear, error: yearError } = await supabase
    .from('academic_years').select('*').eq('name', yearName).single()
  if (yearError || !academicYear) return null

  const { data: semester, error: semesterError } = await supabase
    .from('semesters').select('*')
    .eq('academic_year_id', academicYear.id)
    .eq('name', semesterName).single()
  if (semesterError || !semester) return null

  const { data: subjects, error: subjectsError } = await supabase
    .from('subjects').select('*')
    .eq('semester_id', semester.id)
    .order('display_order', { ascending: true })
  if (subjectsError) return null

  const subjectsWithCounts = await Promise.all(
    (subjects || []).map(async (subject) => {
      const { data: batches } = await supabase
        .from('batches').select('id').eq('subject_id', subject.id)
      const batchIds = (batches || []).map((b: { id: string }) => b.id)

      let examCount = 0
      let questionCount = 0

      if (batchIds.length > 0) {
        const { data: exams } = await supabase
          .from('exams').select('id, question_count').in('batch_id', batchIds)
        examCount = exams?.length || 0
        questionCount = exams?.reduce((sum: number, e: { question_count: number }) => sum + (e.question_count || 0), 0) || 0
      }

      return { ...subject, examCount, questionCount }
    })
  )

  return { academicYear, semester, subjects: subjectsWithCounts }
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
            {subjects.map((subject, index) => (
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