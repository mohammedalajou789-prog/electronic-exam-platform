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

export default async function SubjectOrBatchPage({ params }: PageProps) {
  const { year, semester: semesterSlug, subject: subjectSlug } = await params
  const supabase = await createServerSupabaseClient()

  const yearName = slugToName(year)

  const { data: academicYear } = await supabase
    .from('academic_years')
    .select('id, name, is_clinical')
    .eq('name', yearName)
    .single()

  if (!academicYear) notFound()

  // ══ CLINICAL: semester=مادة، subject=دفعة → عرض الامتحانات ══
  if (academicYear.is_clinical) {
    const { data: allSubjects } = await supabase
      .from('subjects')
      .select('id, name')
      .eq('year_id', academicYear.id)

    const subject = allSubjects?.find(
      s => s.name.toLowerCase().replace(/\s+/g, '-') === semesterSlug
    )
    if (!subject) notFound()

    const { data: allBatches } = await supabase
      .from('batches')
      .select('id, name')
      .eq('subject_id', subject.id)

    const batch = allBatches?.find(
      b => b.name.toLowerCase().replace(/\s+/g, '-') === subjectSlug
    )
    if (!batch) notFound()

    const { data: exams } = await supabase
      .from('exams')
      .select('*, exam_doctors(doctor:doctors(name))')
      .eq('batch_id', batch.id)
      .eq('status', 'published')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--fg)', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
        <main style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 24px 80px' }}>

          {/* Breadcrumb */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontSize: 13, color: 'var(--fg-muted)', marginBottom: 18 }}>
            <Link href="/" style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>Home</Link>
            <span>›</span>
            <Link href={`/${year}`} style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>{academicYear.name}</Link>
            <span>›</span>
            <Link href={`/${year}/${semesterSlug}`} style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>{subject.name}</Link>
            <span>›</span>
            <span style={{ color: 'var(--fg)', fontWeight: 700 }}>{batch.name}</span>
          </div>

          {/* Header */}
          <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 800 }}>{batch.name}</h1>
          <p style={{ margin: '0 0 28px', fontSize: 14.5, color: 'var(--fg-muted)' }}>
            {subject.name} — {(exams ?? []).length} exam{(exams ?? []).length !== 1 ? 's' : ''} available
          </p>

          {/* Exams */}
          {(exams ?? []).length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {(exams ?? []).map((exam, index) => {
                const doctors = exam.exam_doctors?.map((ed: { doctor?: { name: string } }) => ed.doctor?.name).filter(Boolean) || []
                return (
                  <div key={exam.id} style={{ opacity: 0, animation: `0.5s ease-out ${index * 70}ms 1 normal forwards running fadeInUp`, background: 'var(--bg-elev)', border: '1px solid var(--bd)', borderRadius: 16, padding: 22, display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
                    <div style={{ width: 46, height: 46, borderRadius: 13, background: 'var(--clr-soft)', color: 'var(--clr-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    </div>
                    <div style={{ flex: '1 1 0%', minWidth: 200 }}>
                      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>{exam.title}</div>
                      {exam.exam_type && (
                        <div style={{ fontSize: 12.5, color: 'var(--fg-muted)', marginBottom: 8, textTransform: 'capitalize' }}>
                          {exam.exam_type}{exam.calendar_year ? ` · ${exam.calendar_year}` : ''}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--fg-muted)' }}>
                        {doctors.length > 0 && <span>👤 {doctors.join(', ')}</span>}
                        <span>📄 {exam.question_count} questions</span>
                        <span>⏱ {exam.question_count} min</span>
                      </div>
                    </div>
                    <Link
                      href={`/${year}/${semesterSlug}/${subjectSlug}/${exam.id}`}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 22px', borderRadius: 12, background: 'var(--clr-primary)', color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                      Start Exam
                    </Link>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', borderRadius: 18, border: '1px dashed var(--bd)', padding: '64px 24px', textAlign: 'center' }}>
              <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700 }}>No exams available</h3>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--fg-muted)' }}>Exams will appear here once published by an administrator.</p>
            </div>
          )}
        </main>
      </div>
    )
  }

  // ══ PRE-CLINICAL: semester=فصل، subject=مادة → عرض الدفعات ══
  const semesterName = slugToName(semesterSlug)

  const { data: semesterData } = await supabase
    .from('semesters')
    .select('id, name')
    .eq('academic_year_id', academicYear.id)
    .eq('name', semesterName)
    .single()

  if (!semesterData) notFound()

  const { data: allSubjects } = await supabase
    .from('subjects')
    .select('*, batches(*, exams(id, question_count, doctor_id, status, deleted_at))')
    .eq('semester_id', semesterData.id)

  const subject = allSubjects?.find(
    s => s.name.toLowerCase().replace(/\s+/g, '-') === subjectSlug
  )
  if (!subject) notFound()

  const batches = (subject.batches ?? [])
    .sort((a: { display_order: number }, b: { display_order: number }) => a.display_order - b.display_order)
    .map((batch: { exams?: { id: string; question_count: number; doctor_id: string; status: string; deleted_at: string | null }[]; [key: string]: unknown }) => {
      const publishedExams = (batch.exams ?? []).filter((e: { status: string; deleted_at: string | null }) => e.status === 'published' && !e.deleted_at)
      return {
        ...batch,
        examCount: publishedExams.length,
        totalQuestions: publishedExams.reduce((sum: number, e: { question_count: number }) => sum + (e.question_count ?? 0), 0),
      }
    })

  const totalExams     = batches.reduce((sum: number, b: { examCount: number }) => sum + b.examCount, 0)
  const totalQuestions = batches.reduce((sum: number, b: { totalQuestions: number }) => sum + b.totalQuestions, 0)

  const allExams = batches.flatMap((b: { exams?: { id: string; doctor_id: string; status: string; deleted_at: string | null }[] }) =>
    (b.exams ?? []).filter((e: { status: string; deleted_at: string | null }) => e.status === 'published' && !e.deleted_at)
  )
  const doctorIds = [...new Set(allExams.map((e: { doctor_id: string }) => e.doctor_id).filter(Boolean))] as string[]
  const examIds   = allExams.map((e: { id: string }) => e.id) as string[]

  const [doctorsRes, questionMetaRes] = await Promise.all([
    doctorIds.length > 0
      ? supabase.from('doctors').select('id, name').in('id', doctorIds)
      : Promise.resolve({ data: [] }),
    examIds.length > 0
      ? supabase.from('questions').select('chapter, lecture').in('exam_id', examIds).is('deleted_at', null)
      : Promise.resolve({ data: [] }),
  ])

  const chapters = [...new Set((questionMetaRes.data ?? []).map((q: { chapter: string }) => q.chapter).filter(Boolean))] as string[]
  const lectures = [...new Set((questionMetaRes.data ?? []).map((q: { lecture: string }) => q.lecture).filter(Boolean))] as string[]
  const basePath = `/${year}/${semesterSlug}/${subjectSlug}`

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--fg)', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
      <main style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 24px 24px' }}>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontSize: 13, color: 'var(--fg-muted)', marginBottom: 18 }}>
          <Link href="/" style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>Home</Link>
          <span>›</span>
          <Link href={`/${year}`} style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>{academicYear.name}</Link>
          <span>›</span>
          <Link href={`/${year}/${semesterSlug}`} style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>{semesterData.name}</Link>
          <span>›</span>
          <span style={{ color: 'var(--fg)', fontWeight: 700 }}>{subject.name}</span>
        </div>

        {/* Header */}
        <h1 style={{ margin: '0 0 8px', fontSize: 26, fontWeight: 800, color: 'var(--fg)' }}>{subject.name}</h1>
        <div style={{ display: 'flex', gap: 16, fontSize: 13.5, color: 'var(--fg-muted)', marginBottom: 26 }}>
          <span>{totalExams} exams</span>
          <span>{totalQuestions} questions</span>
        </div>

        {/* Custom Exam Builder */}
        <div style={{ background: 'var(--bg-elev)', border: '1px solid var(--bd)', borderRadius: 18, marginBottom: 24, overflow: 'hidden' }}>
          <CustomExamBuilder
            subjectId={subject.id}
            batches={batches.map((b: { id: string; name: string }) => ({ id: b.id, name: b.name }))}
            doctors={doctorsRes.data ?? []}
            chapters={chapters}
            lectures={lectures}
            basePath={basePath}
          />
        </div>

        {/* Batches */}
        <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 800, color: 'var(--fg)' }}>Batches</h2>
        {batches.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
            {batches.map((batch: { id: string; name: string; examCount: number; totalQuestions: number }, index: number) => (
              <Link
                key={batch.id}
                href={`${basePath}/${batch.name.toLowerCase().replace(/\s+/g, '-')}`}
                className="year-card"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--clr-soft)', color: 'var(--clr-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
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
            <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: 'var(--fg)' }}>No batches available</h3>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--fg-muted)' }}>Batches will appear here once they are added by an administrator.</p>
          </div>
        )}
      </main>
    </div>
  )
}