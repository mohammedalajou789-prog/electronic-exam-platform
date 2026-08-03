// src/app/(public)/[year]/[semester]/[subject]/page.tsx

import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import SharedSubjectPage from '@/components/exam/shared/SharedSubjectPage'

function slugToName(s: string) {
  return s.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
}
function nameToSlug(s: string) {
  return s.toLowerCase().replace(/\s+/g, '-')
}

export default async function SubjectPage({
  params,
}: {
  params: Promise<{ year: string; semester: string; subject: string }>
}) {
  const { year: yearSlug, semester: semSlug, subject: subjectSlug } = await params
  const supabase = await createServerSupabaseClient()

  const { data: academicYear } = await supabase
    .from('academic_years')
    .select('id, name, is_clinical')
    .eq('name', slugToName(yearSlug))
    .single()

  if (!academicYear) notFound()

  // ── CLINICAL: [semester]=subject, [subject]=batch ─────────────
  if (academicYear.is_clinical) {
    const { data: allSubjects } = await supabase
      .from('subjects')
      .select('id, name')
      .eq('year_id', academicYear.id)

    const subject = allSubjects?.find(
      (s: any) => nameToSlug(s.name) === semSlug
    )
    if (!subject) notFound()

    const { data: allBatches } = await supabase
      .from('batches')
      .select('id, name')
      .eq('subject_id', subject.id)

    const batch = allBatches?.find(
      (b: any) => nameToSlug(b.name) === subjectSlug
    )
    if (!batch) notFound()

    // Clinical: [subject] = batch slug → show exam list
    const { data: exams } = await supabase
      .from('exams')
      .select('*, exam_doctors(doctor:doctors(name))')
      .eq('batch_id', batch.id)
      .eq('status', 'published')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    const examList = exams || []
    const basePath = `/${yearSlug}/${semSlug}/${subjectSlug}`

    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--fg)', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
        <main style={{ padding: '32px 28px 80px' }}>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontSize: 13, color: 'var(--fg-muted)', marginBottom: 18 }}>
            {[
              { label: 'Home', href: '/' },
              { label: academicYear.name, href: `/${yearSlug}` },
              { label: subject.name, href: `/${yearSlug}/${semSlug}` },
              { label: batch.name },
            ].map((crumb, i) => (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {i > 0 && <span>›</span>}
                {crumb.href
                  ? <a href={crumb.href} style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>{crumb.label}</a>
                  : <span style={{ color: 'var(--fg)', fontWeight: 700 }}>{crumb.label}</span>
                }
              </span>
            ))}
          </div>

          <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 800 }}>{batch.name}</h1>
          <p style={{ margin: '0 0 28px', fontSize: 14.5, color: 'var(--fg-muted)' }}>
            {subject.name} — {examList.length} exam{examList.length !== 1 ? 's' : ''} available
          </p>

          {examList.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {examList.map((exam: any, index: number) => {
                const doctors = exam.exam_doctors?.map((ed: any) => ed.doctor?.name).filter(Boolean) || []
                return (
                  <div key={exam.id} style={{ opacity: 0, animation: `0.5s ease-out ${index * 70}ms 1 normal forwards running fadeInUp`, background: 'var(--bg-elev)', border: '1px solid var(--bd)', borderRadius: 16, padding: 22, display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
                    <div style={{ width: 46, height: 46, borderRadius: 13, background: 'var(--clr-soft)', color: 'var(--clr-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
                      </svg>
                    </div>
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
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>
                            {doctors.join(', ')}
                          </span>
                        )}
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /></svg>
                          {exam.question_count} questions
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                          ~{exam.question_count} min
                        </span>
                      </div>
                    </div>
                    <a href={`${basePath}/${exam.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 22px', borderRadius: 12, background: 'var(--clr-primary)', color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                      View Exam
                    </a>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 18, border: '1px dashed var(--bd)', padding: '64px 24px', textAlign: 'center' }}>
              <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700 }}>No exams available</h3>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--fg-muted)' }}>Exams will appear here once published by an administrator.</p>
            </div>
          )}
        </main>
      </div>
    )
  }

  // ── PRE-CLINICAL ──────────────────────────────────────────────
  const { data: semesterData } = await supabase
    .from('semesters')
    .select('id, name')
    .eq('academic_year_id', academicYear.id)
    .eq('name', slugToName(semSlug))
    .single()

  if (!semesterData) notFound()

  const { data: allSubjects } = await supabase
    .from('subjects')
    .select('id, name')
    .eq('semester_id', semesterData.id)

  const subject = allSubjects?.find(
    (s: any) => nameToSlug(s.name) === subjectSlug
  )
  if (!subject) notFound()

  return (
    <SharedSubjectPage
      subjectId={subject.id}
      subjectName={subject.name}
      basePath={`/${yearSlug}/${semSlug}/${subjectSlug}`}
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: academicYear.name, href: `/${yearSlug}` },
        { label: semesterData.name, href: `/${yearSlug}/${semSlug}` },
        { label: subject.name },
      ]}
    />
  )
}