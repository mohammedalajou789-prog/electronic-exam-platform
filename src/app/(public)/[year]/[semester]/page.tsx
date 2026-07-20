import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import CustomExamBuilder from '@/components/exam/CustomExamBuilder'
import { ChevronRight } from 'lucide-react'

interface PageProps {
  params: Promise<{ year: string; semester: string }>
}

function slugToName(slug: string): string {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

export default async function SemesterOrSubjectPage({ params }: PageProps) {
  const { year, semester: semesterSlug } = await params
  const supabase = await createServerSupabaseClient()

  const yearName = slugToName(year)

  // جلب السنة مع is_clinical
  const { data: academicYear } = await supabase
    .from('academic_years')
    .select('*, semesters(*)')
    .eq('name', yearName)
    .order('display_order', { referencedTable: 'semesters', ascending: true })
    .single()

  if (!academicYear) notFound()

  // ══ CLINICAL: الـ slug هو اسم مادة ══
  if (academicYear.is_clinical) {
    const { data: allSubjects } = await supabase
      .from('subjects')
      .select('*, batches(*, exams(id, question_count, doctor_id, status, deleted_at))')
      .eq('year_id', academicYear.id)

    const subject = allSubjects?.find(
      s => s.name.toLowerCase().replace(/\s+/g, '-') === semesterSlug
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

    const totalExams = batches.reduce((sum: number, b: { examCount: number }) => sum + b.examCount, 0)
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
    const basePath = `/${year}/${semesterSlug}`

    return (
      <div style={{ background: 'var(--bg)', color: 'var(--fg)', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
        <main style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 24px 24px' }}>

          {/* Breadcrumb */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontSize: 13, color: 'var(--fg-muted)', marginBottom: 18 }}>
            <Link href="/" style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>Home</Link>
            <span>›</span>
            <Link href={`/${year}`} style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>{academicYear.name}</Link>
            <span>›</span>
            <span style={{ color: 'var(--fg)', fontWeight: 700 }}>{subject.name}</span>
          </div>

          {/* Header */}
          <h1 style={{ margin: '0 0 8px', fontSize: 26, fontWeight: 800 }}>{subject.name}</h1>
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
          <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 800 }}>Batches</h2>
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
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', borderRadius: 18, border: '1px dashed var(--bd)', padding: '64px 24px', textAlign: 'center' }}>
              <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700 }}>No batches available</h3>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--fg-muted)' }}>Batches will appear here once added by an administrator.</p>
            </div>
          )}
        </main>
      </div>
    )
  }

  // ══ PRE-CLINICAL: الـ slug هو فصل دراسي ══
  const semesterName = slugToName(semesterSlug)
  const { data: semesterData } = await supabase
    .from('semesters')
    .select(`*, subjects(*, batches(id, exams(id, question_count, status, deleted_at)))`)
    .eq('academic_year_id', academicYear.id)
    .eq('name', semesterName)
    .single()

  if (!semesterData) notFound()

  const subjects = (semesterData.subjects ?? [])
    .sort((a: { display_order: number }, b: { display_order: number }) => a.display_order - b.display_order)
    .map((subject: { batches?: { exams?: { id: string; question_count: number; status: string; deleted_at: string | null }[] }[]; [key: string]: unknown }) => {
      const allExams = (subject.batches ?? [])
        .flatMap((b: { exams?: { id: string; question_count: number; status: string; deleted_at: string | null }[] }) => b.exams ?? [])
        .filter((e: { status: string; deleted_at: string | null }) => e.status === 'published' && !e.deleted_at)
      return {
        ...subject,
        examCount: allExams.length,
        questionCount: allExams.reduce((sum: number, e: { question_count: number }) => sum + (e.question_count ?? 0), 0),
      }
    })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--fg)', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
      <main style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 24px 80px' }}>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontSize: 13, color: 'var(--fg-muted)', marginBottom: 18 }}>
          <Link href="/" style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>Home</Link>
          <span>›</span>
          <Link href={`/${year}`} style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>{academicYear.name}</Link>
          <span>›</span>
          <span style={{ color: 'var(--fg)', fontWeight: 700 }}>{semesterData.name}</span>
        </div>

        {/* Header */}
        <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 800 }}>
          {semesterData.name} — {academicYear.name}
        </h1>
        <p style={{ margin: '0 0 28px', fontSize: 14.5, color: 'var(--fg-muted)' }}>
          Select a subject to browse batches and exams
        </p>

        {/* Subject Cards */}
        {subjects.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 16 }}>
            {subjects.map((subject: { id: string; name: string; examCount: number; questionCount: number }, index: number) => (
              <Link
                key={subject.id}
                href={`/${year}/${semesterSlug}/${subject.name.toLowerCase().replace(/\s+/g, '-')}`}
                className="year-card"
                style={{ animationDelay: `${index * 60}ms`, flexDirection: 'column', alignItems: 'flex-start' }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--clr-soft)', color: 'var(--clr-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, flexShrink: 0 }}>
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  </svg>
                </div>
                <div style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--fg)', marginBottom: 6 }}>{subject.name}</div>
                <div style={{ fontSize: 12.5, color: 'var(--fg-muted)' }}>
                  {subject.examCount} exam{subject.examCount !== 1 ? 's' : ''} · {subject.questionCount} questions
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 18, border: '1px dashed var(--bd)', padding: '64px 24px', textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700 }}>No subjects available</h3>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--fg-muted)' }}>Subjects will appear here once they are added by an administrator.</p>
          </div>
        )}
      </main>
    </div>
  )
}