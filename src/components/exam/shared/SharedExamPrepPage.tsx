// src/components/exam/shared/SharedExamPrepPage.tsx
export const dynamic = 'force-dynamic'
export const revalidate = 0

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { BookOpen, Clock, FileText, User, Play, Eye, Download } from 'lucide-react'

interface Breadcrumb {
  label: string
  href?: string
}

interface Props {
  examId?: string
  customExamId?: string
  basePath: string
  breadcrumbs: Breadcrumb[]
}

export default async function SharedExamPrepPage({
  examId,
  customExamId,
  basePath,
  breadcrumbs,
}: Props) {
  const supabase = await createServerSupabaseClient()

  // ── بيانات الامتحان ───────────────────────────────────────
  let title = 'Custom Exam'
  let questionCount = 0
  let doctors: string[] = []
  let chapters: string[] = []
  let savedProgress: any = null

  if (examId) {
    const { data: exam } = await supabase
      .from('exams')
      .select('*, exam_doctors(doctor:doctors(name))')
      .eq('id', examId)
      .eq('status', 'published')
      .is('deleted_at', null)
      .single()

    if (!exam) notFound()

    title = exam.title
    questionCount = exam.question_count
    doctors = exam.exam_doctors
      ?.map((ed: any) => ed.doctor?.name)
      .filter(Boolean) || []

    const { data: qChapters } = await supabase
      .from('questions')
      .select('chapter')
      .eq('exam_id', examId)
      .not('chapter', 'is', null)

    chapters = [...new Set((qChapters || []).map((q: any) => q.chapter).filter(Boolean))] as string[]

    // saved progress
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: prog } = await supabase
        .from('study_progress')
        .select('current_question, answers_json, remaining_time')
        .eq('user_id', user.id)
        .eq('exam_id', examId)
        .eq('completed', false)
        .maybeSingle()
      if (prog && Object.keys(prog.answers_json || {}).length > 0) {
        savedProgress = prog
      }
    }

  } else if (customExamId) {
    const { data: customExam } = await supabase
      .from('custom_exams')
      .select('*')
      .eq('id', customExamId)
      .single()

    if (!customExam) notFound()

    questionCount = customExam.question_count

    const { data: qData } = await supabase
      .from('questions')
      .select('chapter')
      .in('id', customExam.question_ids)
      .is('deleted_at', null)

    if (!qData || qData.length === 0) notFound()

    chapters = [...new Set(qData.map((q: any) => q.chapter).filter(Boolean))] as string[]
  }

  const answeredCount = savedProgress
    ? Object.keys(savedProgress.answers_json || {}).length
    : 0

  const doctorInitials = doctors[0]
    ? doctors[0].split(' ').filter(Boolean).slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
    : null

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--fg)', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
      <style>{`
        .prep-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 22px; }
        @media (max-width: 600px) {
          .prep-stats { grid-template-columns: repeat(2, 1fr); }
          .prep-main  { padding: 20px 16px 60px !important; }
        }
      `}</style>

      <main className="prep-main" style={{ padding: '32px 28px 80px' }}>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontSize: 13, color: 'var(--fg-muted)', marginBottom: 18 }}>
          {breadcrumbs.map((crumb, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {i > 0 && <span>›</span>}
              {crumb.href
                ? <Link href={crumb.href} style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>{crumb.label}</Link>
                : <span style={{ color: 'var(--fg)', fontWeight: 700 }}>{crumb.label}</span>
              }
            </span>
          ))}
        </div>

        {/* Hero Card */}
        <div style={{ background: 'var(--bg-elev)', border: '1px solid var(--bd)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 1px 3px var(--shadow)', marginBottom: 20 }}>
          <div style={{ height: 5, background: 'linear-gradient(90deg, var(--clr-primary), oklch(56% 0.14 300))' }} />
          <div style={{ padding: '28px 28px 24px' }}>

            <h1 style={{ margin: '0 0 18px', fontSize: 28, fontWeight: 800, letterSpacing: '-0.3px' }}>
              {title}
            </h1>

            {/* Stats */}
            <div className="prep-stats">
              {[
                { icon: <FileText size={18} color="oklch(58% 0.13 250)" />, value: questionCount, label: 'Questions' },
                { icon: <Clock size={18} color="oklch(56% 0.14 300)" />,    value: questionCount, label: 'Minutes'   },
                { icon: <BookOpen size={18} color="oklch(60% 0.14 145)" />, value: chapters.length, label: 'Chapters' },
                { icon: <User size={18} color="var(--clr-primary)" />,
                  value: doctors.length || (customExamId ? '—' : '—'),
                  label: doctors.length === 1 ? 'Doctor' : 'Doctors' },
              ].map(s => (
                <div key={s.label} style={{ background: 'var(--bg-soft)', border: '1px solid var(--bd)', borderRadius: 14, padding: '14px 10px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  {s.icon}
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{s.value}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--fg-muted)', fontWeight: 600 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Doctor */}
            {doctors[0] && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: 'var(--bg-soft)', border: '1px solid var(--bd)', borderRadius: 12, marginBottom: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--clr-soft)', color: 'var(--clr-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                  {doctorInitials}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{doctors.join(', ')}</div>
              </div>
            )}

            {/* Chapters */}
            {chapters.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {chapters.map(ch => (
                  <span key={ch} style={{ padding: '5px 11px', borderRadius: 999, background: 'var(--bg-soft)', border: '1px solid var(--bd)', fontSize: 12.5, fontWeight: 600, color: 'var(--fg-muted)' }}>
                    {ch}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Mode heading */}
        <div style={{ margin: '0 0 12px', fontSize: 17, fontWeight: 800 }}>Choose how to begin</div>

        {/* Mode Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Interactive */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 20, borderRadius: 16, border: '1.5px solid var(--clr-primary)', background: 'var(--bg-elev)', boxShadow: '0 1px 2px var(--shadow)' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--clr-soft)', color: 'var(--clr-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Play size={20} />
            </div>
            <div style={{ flex: '1 1 auto', minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Interactive Exam</div>
              <div style={{ fontSize: 13, color: 'var(--fg-muted)', marginTop: 2 }}>
                {savedProgress
                  ? `${answeredCount} of ${questionCount} answered — continue from question ${savedProgress.current_question + 1}`
                  : 'Simulate a real exam with a countdown timer and instant scoring'
                }
              </div>
            </div>
            {savedProgress ? (
              <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
                <Link href={`${basePath}/play?resume=true`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 11, background: 'var(--clr-primary)', color: 'white', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
                  <Play size={14} />Continue
                </Link>
                <Link href={`${basePath}/play`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 11, border: '1px solid var(--bd)', background: 'var(--bg-soft)', color: 'var(--fg)', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                  Start over
                </Link>
              </div>
            ) : (
              <Link href={`${basePath}/play`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 11, background: 'var(--clr-primary)', color: 'white', fontSize: 14, fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}>
                <Play size={14} />Start Exam
              </Link>
            )}
          </div>

          {/* Review */}
          <Link href={`${basePath}/review`} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 20, borderRadius: 16, border: '1px solid var(--bd)', background: 'var(--bg-elev)', textDecoration: 'none', boxShadow: '0 1px 2px var(--shadow)' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'oklch(92% 0.04 250)', color: 'oklch(58% 0.13 250)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Eye size={20} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg)' }}>Review Mode</div>
              <div style={{ fontSize: 13, color: 'var(--fg-muted)', marginTop: 2 }}>Browse every question with answers and explanations, no timer</div>
            </div>
          </Link>

          {/* PDF */}
          <Link href={`${basePath}/pdf`} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 20, borderRadius: 16, border: '1px solid var(--bd)', background: 'var(--bg-elev)', textDecoration: 'none', boxShadow: '0 1px 2px var(--shadow)' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'oklch(92% 0.04 300)', color: 'oklch(56% 0.14 300)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Download size={20} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg)' }}>Export as PDF</div>
              <div style={{ fontSize: 13, color: 'var(--fg-muted)', marginTop: 2 }}>Download a printable version of this exam</div>
            </div>
          </Link>

        </div>
      </main>
    </div>
  )
}