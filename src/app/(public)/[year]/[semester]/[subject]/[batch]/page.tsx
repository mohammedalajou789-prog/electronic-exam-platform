import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'

interface PageProps {
  params: Promise<{ year: string; semester: string; subject: string; batch: string }>
}

function slugToName(slug: string): string {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

async function getBatchData(yearSlug: string, semesterSlug: string, subjectSlug: string, batchSlug: string) {
  const supabase = await createServerSupabaseClient()

  const { data: academicYear } = await supabase
    .from('academic_years').select('*').eq('name', slugToName(yearSlug)).single()
  if (!academicYear) return null

  const { data: semester } = await supabase
    .from('semesters').select('*')
    .eq('academic_year_id', academicYear.id).eq('name', slugToName(semesterSlug)).single()
  if (!semester) return null

  const { data: subjects } = await supabase
    .from('subjects').select('*').eq('semester_id', semester.id)
  const subject = subjects?.find(s => s.name.toLowerCase().replace(/\s+/g, '-') === subjectSlug)
  if (!subject) return null

  const { data: batches } = await supabase
    .from('batches').select('*').eq('subject_id', subject.id)
  const batch = batches?.find(b => b.name.toLowerCase().replace(/\s+/g, '-') === batchSlug)
  if (!batch) return null

  const { data: exams } = await supabase
    .from('exams')
    .select('*, exam_doctors(doctor:doctors(name))')
    .eq('batch_id', batch.id)
    .eq('status', 'published')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  return { academicYear, semester, subject, batch, exams: exams || [] }
}

export default async function BatchPage({ params }: PageProps) {
  const { year, semester, subject, batch } = await params
  const data = await getBatchData(year, semester, subject, batch)
  if (!data) notFound()

  const { academicYear, semester: semesterData, subject: subjectData, batch: batchData, exams } = data

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
          <Link href={`/${year}/${semester}/${subject}`} style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>{subjectData.name}</Link>
          <span>›</span>
          <span style={{ color: 'var(--fg)', fontWeight: 700 }}>{batchData.name}</span>
        </div>

        {/* Header */}
        <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 800, color: 'var(--fg)' }}>
          {batchData.name}
        </h1>
        <p style={{ margin: '0 0 28px', fontSize: 14.5, color: 'var(--fg-muted)' }}>
          {subjectData.name} — {exams.length} exam{exams.length !== 1 ? 's' : ''} available
        </p>

        {/* Exams */}
        {exams.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {exams.map((exam, index) => {
              const doctors = exam.exam_doctors?.map((ed: any) => ed.doctor?.name).filter(Boolean) || []
              const estimatedTime = exam.question_count

              return (
                <div
                  key={exam.id}
                  style={{ opacity: 0, animation: `0.5s ease-out ${index * 70}ms 1 normal forwards running fadeInUp`, background: 'var(--bg-elev)', border: '1px solid var(--bd)', borderRadius: 16, padding: 22, display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}
                >
                  {/* Icon */}
                  <div style={{ width: 46, height: 46, borderRadius: 13, background: 'var(--clr-soft)', color: 'var(--clr-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                  </div>

                  {/* Info */}
                  <div style={{ flex: '1 1 0%', minWidth: 200 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--fg)', marginBottom: 4 }}>{exam.title}</div>
                    {exam.exam_type && (
                      <div style={{ fontSize: 12.5, color: 'var(--fg-muted)', marginBottom: 8, textTransform: 'capitalize' }}>
                        {exam.exam_type}{exam.calendar_year ? ` · ${exam.calendar_year}` : ''}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--fg-muted)' }}>
                      {doctors.length > 0 && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
                          </svg>
                          {doctors.join(', ')}
                        </span>
                      )}
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        </svg>
                        {exam.question_count} questions
                      </span>
                      {estimatedTime > 0 && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                          </svg>
                          {estimatedTime} min
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Start button */}
                  <Link
                    href={`/${year}/${semester}/${subject}/${batch}/${exam.id}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 22px', borderRadius: 12, border: 'none', background: 'var(--clr-primary)', color: '#fff', fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 14, fontWeight: 700, cursor: 'pointer', flexShrink: 0, textDecoration: 'none' }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    Start Exam
                  </Link>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 18, border: '1px dashed var(--bd)', padding: '64px 24px', textAlign: 'center' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--fg-muted)" strokeWidth="1.5" style={{ marginBottom: 16, opacity: 0.5 }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
            </svg>
            <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: 'var(--fg)' }}>No exams available</h3>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--fg-muted)' }}>Exams will appear here once they are published by an administrator.</p>
          </div>
        )}
      </main>
    </div>
  )
}