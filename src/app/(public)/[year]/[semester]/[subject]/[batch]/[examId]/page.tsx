import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { BookOpen, Clock, FileText, User, Play, Eye, Download, RotateCcw } from 'lucide-react'

interface PageProps {
  params: Promise<{
    year: string; semester: string; subject: string
    batch: string; examId: string
  }>
}

function slugToName(slug: string): string {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

async function getExamData(examId: string) {
  const supabase = await createServerSupabaseClient()

  const { data: exam } = await supabase
    .from('exams')
    .select(`
      *,
      batch:batches(
        name,
        subject:subjects(
          name,
          semester:semesters(
            name,
            academic_year:academic_years(name)
          )
        )
      ),
      exam_doctors(
        doctor:doctors(name)
      )
    `)
    .eq('id', examId)
    .eq('status', 'published')
    .is('deleted_at', null)
    .single()

  if (!exam) return null

  const { data: chapters } = await supabase
    .from('questions')
    .select('chapter, lecture')
    .eq('exam_id', examId)
    .not('chapter', 'is', null)

  const uniqueChapters = [
    ...new Set((chapters || []).map(q => q.chapter).filter(Boolean))
  ]

  const { data: { user } } = await supabase.auth.getUser()
  let savedProgress: {
    current_question: number
    answers_json: Record<string, string>
    remaining_time: number | null
  } | null = null

  if (user) {
    const { data: progress } = await supabase
      .from('study_progress')
      .select('current_question, answers_json, remaining_time')
      .eq('user_id', user.id)
      .eq('exam_id', examId)
      .eq('completed', false)
      .maybeSingle()

    if (progress && Object.keys(progress.answers_json || {}).length > 0) {
      savedProgress = progress
    }
  }

  return { exam, chapters: uniqueChapters, savedProgress }
}

export default async function ExamPrepPage({ params }: PageProps) {
  const { year, semester, subject, batch, examId } = await params
  const data = await getExamData(examId)

  if (!data) notFound()

  const { exam, chapters, savedProgress } = data
  const doctors = exam.exam_doctors?.map((ed: any) => ed.doctor?.name).filter(Boolean) || []
  const estimatedTime = exam.question_count
  const basePath = `/${year}/${semester}/${subject}/${batch}/${examId}`

  const answeredCount = savedProgress
    ? Object.keys(savedProgress.answers_json || {}).length
    : 0

  const yearName = exam.batch?.subject?.semester?.academic_year?.name || slugToName(year)
  const semesterName = exam.batch?.subject?.semester?.name || slugToName(semester)
  const subjectName = exam.batch?.subject?.name || subject
  const batchName = exam.batch?.name || batch

  const firstDoctor = doctors[0] as string | undefined
  const doctorInitials = firstDoctor
    ? firstDoctor.split(' ').filter(Boolean).slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
    : null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--fg)', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
      <main style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 24px 80px' }}>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontSize: 13, color: 'var(--fg-muted)', marginBottom: 18 }}>
          <Link href="/" style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>Home</Link>
          <span>›</span>
          <Link href={`/${year}`} style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>{yearName}</Link>
          <span>›</span>
          <Link href={`/${year}/${semester}`} style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>{semesterName}</Link>
          <span>›</span>
          <Link href={`/${year}/${semester}/${subject}`} style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>{subjectName}</Link>
          <span>›</span>
          <Link href={`/${year}/${semester}/${subject}/${batch}`} style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>{batchName}</Link>
          <span>›</span>
          <span style={{ color: 'var(--fg)', fontWeight: 700 }}>{exam.title}</span>
        </div>

        {/* ── Resume Banner ── */}
        {savedProgress && (
          <div style={{
            marginBottom: 24,
            background: 'var(--bg-elev)',
            border: '1.5px solid var(--accent-blue)',
            borderRadius: 16,
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            boxShadow: '0 1px 3px var(--shadow)',
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'color-mix(in srgb, var(--accent-blue) 18%, var(--bg-soft))',
              color: 'var(--accent-blue)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <RotateCcw size={20} />
            </div>
            <div style={{ flex: '1 1 auto', minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg)' }}>
                You have an unfinished session
              </div>
              <div style={{ fontSize: 13.5, color: 'var(--fg-muted)', marginTop: 2 }}>
                {answeredCount} of {exam.question_count} answered — resume from question {savedProgress.current_question + 1}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <Link href={`${basePath}/play?resume=true`} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 10,
                background: 'var(--accent-blue)', color: 'white',
                fontSize: 13.5, fontWeight: 700, textDecoration: 'none',
              }}>
                <Play size={14} />Continue
              </Link>
              <Link href={`${basePath}/play`} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 10,
                border: '1.5px solid var(--border)',
                background: 'var(--bg-soft)', color: 'var(--fg-muted)',
                fontSize: 13.5, fontWeight: 700, textDecoration: 'none',
              }}>
                Start Over
              </Link>
            </div>
          </div>
        )}

        {/* ── Exam Hero Card ── */}
        <div style={{
          background: 'var(--bg-elev)',
          border: '1px solid var(--bd)',
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: '0 1px 3px var(--shadow)',
          marginBottom: 24,
        }}>
          <div style={{ height: 5, background: 'linear-gradient(90deg, var(--clr-primary), oklch(56% 0.14 300))' }} />

          <div style={{ padding: '30px 30px 26px' }}>
            <h1 style={{ margin: '0 0 20px', fontSize: 30, fontWeight: 800, letterSpacing: '-0.3px', color: 'var(--fg)' }}>
              {exam.title}
            </h1>

            {/* Stat tiles */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 22 }}>
              <div style={{ background: 'var(--bg-soft)', border: '1px solid var(--bd)', borderRadius: 14, padding: '16px 12px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <FileText size={18} color="var(--accent-blue, oklch(58% 0.13 250))" />
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--fg)' }}>{exam.question_count}</div>
                <div style={{ fontSize: 12, color: 'var(--fg-muted)', fontWeight: 600 }}>Questions</div>
              </div>
              <div style={{ background: 'var(--bg-soft)', border: '1px solid var(--bd)', borderRadius: 14, padding: '16px 12px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <Clock size={18} color="oklch(56% 0.14 300)" />
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--fg)' }}>{estimatedTime}</div>
                <div style={{ fontSize: 12, color: 'var(--fg-muted)', fontWeight: 600 }}>Minutes</div>
              </div>
              <div style={{ background: 'var(--bg-soft)', border: '1px solid var(--bd)', borderRadius: 14, padding: '16px 12px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <BookOpen size={18} color="oklch(60% 0.14 145)" />
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--fg)' }}>{chapters.length}</div>
                <div style={{ fontSize: 12, color: 'var(--fg-muted)', fontWeight: 600 }}>Chapters</div>
              </div>
              <div style={{ background: 'var(--bg-soft)', border: '1px solid var(--bd)', borderRadius: 14, padding: '16px 12px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <User size={18} color="var(--clr-primary)" />
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--fg)' }}>{doctors.length || '—'}</div>
                <div style={{ fontSize: 12, color: 'var(--fg-muted)', fontWeight: 600 }}>{doctors.length === 1 ? 'Doctor' : 'Doctors'}</div>
              </div>
            </div>

            {/* Doctor row */}
            {firstDoctor && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'var(--bg-soft)', border: '1px solid var(--bd)', borderRadius: 12, marginBottom: 14 }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--clr-soft)', color: 'var(--clr-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                  {doctorInitials}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg)' }}>{doctors.join(', ')}</div>
              </div>
            )}

            {/* Chapter tags */}
            {chapters.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {chapters.map(chapter => (
                  <span key={chapter as string} style={{ padding: '6px 12px', borderRadius: 999, background: 'var(--bg-soft)', border: '1px solid var(--bd)', fontSize: 13, fontWeight: 600, color: 'var(--fg-muted)' }}>
                    {chapter as string}
                  </span>
                ))}
              </div>
            )}

            {exam.description && (
              <p style={{ marginTop: 16, fontSize: 14, color: 'var(--fg-muted)', lineHeight: 1.6 }}>
                {exam.description}
              </p>
            )}
          </div>
        </div>

        {/* ── Study Mode heading ── */}
        <div style={{ margin: '0 0 14px', fontSize: 18, fontWeight: 800, color: 'var(--fg)' }}>
          Choose how to begin
        </div>

        {/* ── Mode Cards ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          <Link href={`${basePath}/play`} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 20, borderRadius: 16, border: '1.5px solid var(--clr-primary)', background: 'var(--bg-elev)', textDecoration: 'none', boxShadow: '0 1px 2px var(--shadow)' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--clr-soft)', color: 'var(--clr-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Play size={20} />
            </div>
            <div style={{ flex: '1 1 auto' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg)' }}>Interactive Exam</div>
              <div style={{ fontSize: 13.5, color: 'var(--fg-muted)', marginTop: 2 }}>Simulate a real exam with a countdown timer and instant scoring</div>
            </div>
            <span style={{ padding: '5px 11px', borderRadius: 999, background: 'var(--clr-primary)', color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>Recommended</span>
          </Link>

          <Link href={`${basePath}/review`} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 20, borderRadius: 16, border: '1px solid var(--bd)', background: 'var(--bg-elev)', textDecoration: 'none', boxShadow: '0 1px 2px var(--shadow)' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'oklch(92% 0.04 250)', color: 'oklch(58% 0.13 250)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Eye size={20} />
            </div>
            <div style={{ flex: '1 1 auto' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg)' }}>Review Mode</div>
              <div style={{ fontSize: 13.5, color: 'var(--fg-muted)', marginTop: 2 }}>Browse every question with answers and explanations, no timer</div>
            </div>
          </Link>

          <Link href={`${basePath}/pdf`} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 20, borderRadius: 16, border: '1px solid var(--bd)', background: 'var(--bg-elev)', textDecoration: 'none', boxShadow: '0 1px 2px var(--shadow)' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'oklch(92% 0.04 300)', color: 'oklch(56% 0.14 300)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Download size={20} />
            </div>
            <div style={{ flex: '1 1 auto' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg)' }}>Export as PDF</div>
              <div style={{ fontSize: 13.5, color: 'var(--fg-muted)', marginTop: 2 }}>Download a printable version of this exam</div>
            </div>
          </Link>

        </div>
      </main>
    </div>
  )
}