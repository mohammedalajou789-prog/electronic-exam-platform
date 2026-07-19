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

  const yearName     = slugToName(yearSlug)
  const semesterName = slugToName(semesterSlug)

  // query واحد يجيب كل شيء
  const { data: academicYear } = await supabase
    .from('academic_years')
    .select(`
      *,
      semesters!inner(
        *,
        subjects(
          *,
          batches(
            *,
            exams(id, question_count, doctor_id, status, deleted_at)
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

  const subject = (semester.subjects ?? []).find(
    (s: { name: string }) => s.name.toLowerCase().replace(/\s+/g, '-') === subjectSlug
  )
  if (!subject) return null

  // حساب الإحصائيات من البيانات المجلوبة
  const batches = (subject.batches ?? [])
    .sort((a: { display_order: number }, b: { display_order: number }) => a.display_order - b.display_order)
    .map((batch: { exams?: { id: string; question_count: number; doctor_id: string; status: string; deleted_at: string | null }[]; [key: string]: unknown }) => {
      const publishedExams = (batch.exams ?? []).filter(e => e.status === 'published' && !e.deleted_at)
      return {
        ...batch,
        examCount:      publishedExams.length,
        totalQuestions: publishedExams.reduce((sum, e) => sum + (e.question_count ?? 0), 0),
      }
    })

  const totalExams     = batches.reduce((sum: number, b: { examCount: number }) => sum + b.examCount, 0)
  const totalQuestions = batches.reduce((sum: number, b: { totalQuestions: number }) => sum + b.totalQuestions, 0)

  // جمع doctor IDs من الـ exams
  const allExams = batches.flatMap((b: { exams?: { id: string; doctor_id: string; status: string; deleted_at: string | null }[] }) =>
    (b.exams ?? []).filter((e: { status: string; deleted_at: string | null }) => e.status === 'published' && !e.deleted_at)
  )
  const doctorIds = [...new Set(allExams.map((e: { doctor_id: string }) => e.doctor_id).filter(Boolean))] as string[]
  const examIds   = allExams.map((e: { id: string }) => e.id) as string[]

  // جلب الدكاترة والـ chapters/lectures بالتوازي
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

  return {
    academicYear,
    semester,
    subject,
    batches,
    totalExams,
    totalQuestions,
    doctors: doctorsRes.data ?? [],
    chapters,
    lectures,
  }
}

export default async function SubjectPage({ params }: PageProps) {
  const { year, semester, subject: subjectSlug } = await params
  const data = await getSubjectData(year, semester, subjectSlug)
  if (!data) notFound()

  const { academicYear, semester: semesterData, subject, batches,
          totalExams, totalQuestions, doctors, chapters, lectures } = data

  const basePath = `/${year}/${semester}/${subjectSlug}`

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--fg)', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
  <main style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 24px 24px', animation: '0.45s ease-out 0s 1 normal none running fadeSlideIn' }}>

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
            batches={batches.map((b: { id: string; name: string }) => ({ id: b.id, name: b.name }))}
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
            {batches.map((batch: { id: string; name: string; examCount: number; totalQuestions: number }, index: number) => (
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