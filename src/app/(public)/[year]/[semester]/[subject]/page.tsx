import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import CustomExamBuilder from '@/components/exam/CustomExamBuilder'
import { ChevronRight } from 'lucide-react'

interface PageProps {
  params: Promise<{ year: string; semester: string; subject: string }>
}

function slugToName(slug: string): string {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

async function getSubjectData(yearSlug: string, semesterSlug: string, subjectSlug: string) {
  const supabase = await createServerSupabaseClient()

  const yearName = slugToName(yearSlug)
  const semesterName = slugToName(semesterSlug)

  const { data: academicYear } = await supabase
    .from('academic_years').select('*').eq('name', yearName).single()
  if (!academicYear) return null

  const { data: semester } = await supabase
    .from('semesters').select('*')
    .eq('academic_year_id', academicYear.id).eq('name', semesterName).single()
  if (!semester) return null

  const { data: subjects } = await supabase
    .from('subjects').select('*').eq('semester_id', semester.id)
  if (!subjects) return null

  const subject = subjects.find(s =>
    s.name.toLowerCase().replace(/\s+/g, '-') === subjectSlug
  )
  if (!subject) return null

  const { data: batches } = await supabase
    .from('batches').select('*').eq('subject_id', subject.id).order('display_order')

  const batchesWithCounts = await Promise.all(
    (batches || []).map(async batch => {
      const { count: examCount } = await supabase
        .from('exams').select('*', { count: 'exact', head: true })
        .eq('batch_id', batch.id).eq('status', 'published').is('deleted_at', null)
      const { data: exams } = await supabase
        .from('exams').select('question_count')
        .eq('batch_id', batch.id).eq('status', 'published').is('deleted_at', null)
      const totalQuestions = (exams || []).reduce((sum: number, e: { question_count: number }) => sum + (e.question_count || 0), 0)
      return { ...batch, examCount: examCount || 0, totalQuestions }
    })
  )

  const totalExams = batchesWithCounts.reduce((sum, b) => sum + b.examCount, 0)
  const totalQuestions = batchesWithCounts.reduce((sum, b) => sum + b.totalQuestions, 0)

  const allExamIds = (await supabase
    .from('exams').select('id, doctor_id')
    .in('batch_id', (batches || []).map(b => b.id))
    .eq('status', 'published').is('deleted_at', null)
  ).data || []

  const doctorIds = [...new Set(allExamIds.map((e: { doctor_id: string }) => e.doctor_id).filter(Boolean))]
  const { data: doctors } = await supabase
    .from('doctors').select('id, name')
    .in('id', doctorIds.length > 0 ? doctorIds : ['00000000-0000-0000-0000-000000000000'])

  const examIds = allExamIds.map((e: { id: string }) => e.id)
  const { data: questionMeta } = examIds.length > 0
    ? await supabase.from('questions').select('chapter, lecture')
        .in('exam_id', examIds).is('deleted_at', null)
    : { data: [] }

  const chapters = [...new Set((questionMeta || []).map((q: { chapter: string }) => q.chapter).filter(Boolean))] as string[]
  const lectures = [...new Set((questionMeta || []).map((q: { lecture: string }) => q.lecture).filter(Boolean))] as string[]

  return { academicYear, semester, subject, batches: batchesWithCounts, totalExams, totalQuestions, doctors: doctors || [], chapters, lectures }
}

export default async function SubjectPage({ params }: PageProps) {
  const { year, semester, subject: subjectSlug } = await params
  const data = await getSubjectData(year, semester, subjectSlug)
  if (!data) notFound()

  const { academicYear, semester: semesterData, subject, batches,
          totalExams, totalQuestions, doctors, chapters, lectures } = data

  const basePath = `/${year}/${semester}/${subjectSlug}`

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--fg)', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
      <main style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 24px 80px', animation: '0.45s ease-out 0s 1 normal none running fadeSlideIn' }}>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontSize: 13, color: 'var(--fg-muted)', marginBottom: 18 }}>
          <Link href="/" style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>Home</Link>
          <span>›</span>
          <Link href={`/${year}`} style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>{academicYear.name}</Link>
          <span>›</span>
          <Link href={`/${year}/${semester}`} style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>{semesterData.name}</Link>
          <span>›</span>
          <span style={{ color: 'var(--fg)', fontWeight: 700 }}>{subject.name}</span>
        </div>

        {/* Header */}
        <h1 style={{ margin: '0 0 8px', fontSize: 26, fontWeight: 800, color: 'var(--fg)' }}>
          {subject.name}
        </h1>
        <div style={{ display: 'flex', gap: 16, fontSize: 13.5, color: 'var(--fg-muted)', marginBottom: 26 }}>
          <span>{totalExams} exams</span>
          <span>{totalQuestions} questions</span>
        </div>

        {/* Custom Exam Builder */}
        <div style={{ background: 'var(--bg-elev)', border: '1px solid var(--bd)', borderRadius: 18, marginBottom: 24, overflow: 'hidden' }}>
          <CustomExamBuilder
            subjectId={subject.id}
            batches={batches.map(b => ({ id: b.id, name: b.name }))}
            doctors={doctors}
            chapters={chapters}
            lectures={lectures}
            basePath={basePath}
          />
        </div>

        {/* Batches heading */}
        <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 800, color: 'var(--fg)' }}>Batches</h2>

        {/* Batch Cards */}
        {batches.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
            {batches.map((batch, index) => (
              <Link
                key={batch.id}
                href={`${basePath}/${batch.name.toLowerCase().replace(/\s+/g, '-')}`}
                className="year-card"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                {/* Icon */}
                <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--clr-soft)', color: 'var(--clr-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--fg)' }}>{batch.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 2 }}>
                    {batch.examCount} exam{batch.examCount !== 1 ? 's' : ''} · {batch.totalQuestions} questions
                  </div>
                </div>

                <ChevronRight size={16} color="var(--fg-muted)" style={{ flexShrink: 0 }} />
              </Link>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 18, border: '1px dashed var(--bd)', padding: '64px 24px', textAlign: 'center' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--fg-muted)" strokeWidth="1.5" style={{ marginBottom: 16, opacity: 0.5 }}>
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
            </svg>
            <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: 'var(--fg)' }}>No batches available</h3>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--fg-muted)' }}>Batches will appear here once they are added by an administrator.</p>
          </div>
        )}
      </main>
    </div>
  )
}