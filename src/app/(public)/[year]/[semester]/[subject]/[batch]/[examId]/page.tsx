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
    .select(`*, batch:batches(name, subject:subjects(name, semester:semesters(name, academic_year:academic_years(name)))), exam_doctors(doctor:doctors(name))`)
    .eq('id', examId).eq('status', 'published').is('deleted_at', null).single()

  if (!exam) return null

  const { data: chapters } = await supabase
    .from('questions').select('chapter, lecture')
    .eq('exam_id', examId).not('chapter', 'is', null)

  const uniqueChapters = [...new Set((chapters || []).map(q => q.chapter).filter(Boolean))]

  const { data: { user } } = await supabase.auth.getUser()
  let savedProgress: { current_question: number; answers_json: Record<string, string>; remaining_time: number | null } | null = null

  if (user) {
    const { data: progress } = await supabase
      .from('study_progress').select('current_question, answers_json, remaining_time')
      .eq('user_id', user.id).eq('exam_id', examId).eq('completed', false).maybeSingle()
    if (progress && Object.keys(progress.answers_json || {}).length > 0) savedProgress = progress
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
  const answeredCount = savedProgress ? Object.keys(savedProgress.answers_json || {}).length : 0

  const yearName     = exam.batch?.subject?.semester?.academic_year?.name || slugToName(year)
  const semesterName = exam.batch?.subject?.semester?.name || slugToName(semester)
  const subjectName  = exam.batch?.subject?.name || subject
  const batchName    = exam.batch?.name || batch

  const firstDoctor    = doctors[0] as string | undefined
  const doctorInitials = firstDoctor
    ? firstDoctor.split(' ').filter(Boolean).slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
    : null

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--fg)', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
      <style>{`
        .prep-main { max-width: 1180px; margin: 0 auto; padding: 32px 24px 80px; }
        .prep-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 22px; }
        .prep-modes { display: flex; flex-direction: column; gap: 12px; }
        .prep-resume { display: flex; align-items: center; gap: 16px; }
        .prep-resume-actions { display: flex; gap: 8px; flex-shrink: 0; }
        .prep-mode-card { display: flex; align-items: center; gap: 16px; padding: 20px; border-radius: 16px; text-decoration: none; box-shadow: 0 1px 2px var(--shadow); }

        @media (max-width: 768px) {
          .prep-main  { padding: 20px 16px 60px; }

          /* Stats: 2x2 grid on mobile */
          .prep-stats { grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 16px; }

          /* Resume banner: stack on mobile */
          .prep-resume { flex-direction: column; align-items: flex-start; gap: 12px; }
          .prep-resume-actions { width: 100%; }
          .prep-resume-actions a { flex: 1; justify-content: center; }

          /* Mode cards: smaller padding */
          .prep-mode-card { padding: 14px 16px; gap: 12px; border-radius: 14px; }
          .prep-mode-icon { width: 38px !important; height: 38px !important; border-radius: 10px !important; }
          .prep-mode-title { font-size: 14.5px !important; }
          .prep-mode-desc  { font-size: 12.5px !important; }
          .prep-recommended { display: none; }

          /* Hero card */
          .prep-hero-inner { padding: 20px 18px 18px !important; }
          .prep-hero-title { font-size: 22px !important; margin-bottom: 14px !important; }

          /* Breadcrumb: scroll horizontally */
          .prep-breadcrumb { overflow-x: auto; white-space: nowrap; padding-bottom: 4px; flex-wrap: nowrap !important; }
        }
      `}</style>

      <main className="prep-main">

        {/* Breadcrumb */}
        <div className="prep-breadcrumb" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontSize: 13, color: 'var(--fg-muted)', marginBottom: 18 }}>
          <Link href="/" style={{ color: 'var(--fg-muted)', textDecoration: 'none', flexShrink: 0 }}>Home</Link>
          <span>›</span>
          <Link href={`/${year}`} style={{ color: 'var(--fg-muted)', textDecoration: 'none', flexShrink: 0 }}>{yearName}</Link>
          <span>›</span>
          <Link href={`/${year}/${semester}`} style={{ color: 'var(--fg-muted)', textDecoration: 'none', flexShrink: 0 }}>{semesterName}</Link>
          <span>›</span>
          <Link href={`/${year}/${semester}/${subject}`} style={{ color: 'var(--fg-muted)', textDecoration: 'none', flexShrink: 0 }}>{subjectName}</Link>
          <span>›</span>
          <Link href={`/${year}/${semester}/${subject}/${batch}`} style={{ color: 'var(--fg-muted)', textDecoration: 'none', flexShrink: 0 }}>{batchName}</Link>
          <span>›</span>
          <span style={{ color: 'var(--fg)', fontWeight: 700, flexShrink: 0 }}>{exam.title}</span>
        </div>

        {/* Resume Banner */}
        {savedProgress && (
          <div style={{ marginBottom: 20, background: 'var(--bg-elev)', border: '1.5px solid var(--accent-blue)', borderRadius: 16, padding: '18px 20px', boxShadow: '0 1px 3px var(--shadow)' }}>
            <div className="prep-resume">
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'color-mix(in srgb, var(--accent-blue) 18%, var(--bg-soft))', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <RotateCcw size={20} />
              </div>
              <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg)' }}>You have an unfinished session</div>
                <div style={{ fontSize: 13, color: 'var(--fg-muted)', marginTop: 2 }}>
                  {answeredCount} of {exam.question_count} answered — resume from question {savedProgress.current_question + 1}
                </div>
              </div>
              <div className="prep-resume-actions" style={{ display: 'flex', gap: 8 }}>
                <Link href={`${basePath}/play?resume=true`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, background: 'var(--accent-blue)', color: 'white', fontSize: 13.5, fontWeight: 700, textDecoration: 'none' }}>
                  <Play size={14} />Continue
                </Link>
                <Link href={`${basePath}/play`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: '1.5px solid var(--bd)', background: 'var(--bg-soft)', color: 'var(--fg-muted)', fontSize: 13.5, fontWeight: 700, textDecoration: 'none' }}>
                  Start Over
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Hero Card */}
        <div style={{ background: 'var(--bg-elev)', border: '1px solid var(--bd)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 1px 3px var(--shadow)', marginBottom: 20 }}>
          <div style={{ height: 5, background: 'linear-gradient(90deg, var(--clr-primary), oklch(56% 0.14 300))' }} />
          <div className="prep-hero-inner" style={{ padding: '28px 28px 24px' }}>
            <h1 className="prep-hero-title" style={{ margin: '0 0 18px', fontSize: 28, fontWeight: 800, letterSpacing: '-0.3px', color: 'var(--fg)' }}>
              {exam.title}
            </h1>

            {/* Stats */}
            <div className="prep-stats">
              {[
                { icon: <FileText size={18} color="oklch(58% 0.13 250)" />, value: exam.question_count, label: 'Questions' },
                { icon: <Clock size={18} color="oklch(56% 0.14 300)" />,    value: estimatedTime,       label: 'Minutes'   },
                { icon: <BookOpen size={18} color="oklch(60% 0.14 145)" />, value: chapters.length,     label: 'Chapters'  },
                { icon: <User size={18} color="var(--clr-primary)" />,      value: doctors.length || '—', label: doctors.length === 1 ? 'Doctor' : 'Doctors' },
              ].map(s => (
                <div key={s.label} style={{ background: 'var(--bg-soft)', border: '1px solid var(--bd)', borderRadius: 14, padding: '14px 10px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  {s.icon}
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--fg)' }}>{s.value}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--fg-muted)', fontWeight: 600 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Doctor */}
            {firstDoctor && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: 'var(--bg-soft)', border: '1px solid var(--bd)', borderRadius: 12, marginBottom: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--clr-soft)', color: 'var(--clr-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                  {doctorInitials}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg)' }}>{doctors.join(', ')}</div>
              </div>
            )}

            {/* Chapters */}
            {chapters.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {chapters.map(chapter => (
                  <span key={chapter as string} style={{ padding: '5px 11px', borderRadius: 999, background: 'var(--bg-soft)', border: '1px solid var(--bd)', fontSize: 12.5, fontWeight: 600, color: 'var(--fg-muted)' }}>
                    {chapter as string}
                  </span>
                ))}
              </div>
            )}

            {exam.description && (
              <p style={{ marginTop: 14, fontSize: 14, color: 'var(--fg-muted)', lineHeight: 1.6, marginBottom: 0 }}>
                {exam.description}
              </p>
            )}
          </div>
        </div>

        {/* Mode heading */}
        <div style={{ margin: '0 0 12px', fontSize: 17, fontWeight: 800, color: 'var(--fg)' }}>
          Choose how to begin
        </div>

        {/* Mode Cards */}
        <div className="prep-modes">

          <Link href={`${basePath}/play`} className="prep-mode-card" style={{ border: '1.5px solid var(--clr-primary)', background: 'var(--bg-elev)' }}>
            <div className="prep-mode-icon" style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--clr-soft)', color: 'var(--clr-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Play size={20} />
            </div>
            <div style={{ flex: '1 1 auto', minWidth: 0 }}>
              <div className="prep-mode-title" style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg)' }}>Interactive Exam</div>
              <div className="prep-mode-desc" style={{ fontSize: 13, color: 'var(--fg-muted)', marginTop: 2 }}>Simulate a real exam with a countdown timer and instant scoring</div>
            </div>
            <span className="prep-recommended" style={{ padding: '5px 11px', borderRadius: 999, background: 'var(--clr-primary)', color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>Recommended</span>
          </Link>

          <Link href={`${basePath}/review`} className="prep-mode-card" style={{ border: '1px solid var(--bd)', background: 'var(--bg-elev)' }}>
            <div className="prep-mode-icon" style={{ width: 44, height: 44, borderRadius: 12, background: 'oklch(92% 0.04 250)', color: 'oklch(58% 0.13 250)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Eye size={20} />
            </div>
            <div style={{ flex: '1 1 auto', minWidth: 0 }}>
              <div className="prep-mode-title" style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg)' }}>Review Mode</div>
              <div className="prep-mode-desc" style={{ fontSize: 13, color: 'var(--fg-muted)', marginTop: 2 }}>Browse every question with answers and explanations, no timer</div>
            </div>
          </Link>

          <Link href={`${basePath}/pdf`} className="prep-mode-card" style={{ border: '1px solid var(--bd)', background: 'var(--bg-elev)' }}>
            <div className="prep-mode-icon" style={{ width: 44, height: 44, borderRadius: 12, background: 'oklch(92% 0.04 300)', color: 'oklch(56% 0.14 300)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Download size={20} />
            </div>
            <div style={{ flex: '1 1 auto', minWidth: 0 }}>
              <div className="prep-mode-title" style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg)' }}>Export as PDF</div>
              <div className="prep-mode-desc" style={{ fontSize: 13, color: 'var(--fg-muted)', marginTop: 2 }}>Download a printable version of this exam</div>
            </div>
          </Link>

        </div>
      </main>
    </div>
  )
}