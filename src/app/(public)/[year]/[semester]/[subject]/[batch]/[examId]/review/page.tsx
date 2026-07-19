import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import Breadcrumb from '@/components/shared/Breadcrumb'
import { ArrowLeft, BookOpen } from 'lucide-react'
import ReportButton from '@/components/exam/ReportButton'
import Link from 'next/link'

interface PageProps {
  params: Promise<{
    year: string; semester: string; subject: string
    batch: string; examId: string
  }>
}

function slugToName(slug: string): string {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

async function getExamWithQuestions(examId: string) {
  const supabase = await createServerSupabaseClient()

  const { data: exam } = await supabase
    .from('exams')
    .select('*, exam_doctors(doctor:doctors(name))')
    .eq('id', examId)
    .eq('status', 'published')
    .is('deleted_at', null)
    .single()

  if (!exam) return null

  const { data: questions } = await supabase
    .from('questions')
    .select('*, question_statistics(*)')
    .eq('exam_id', examId)
    .is('deleted_at', null)
    .order('question_order', { ascending: true })

  return { exam, questions: questions || [] }
}

export default async function ReviewPage({ params }: PageProps) {
  const { year, semester, subject, batch, examId } = await params
  const data = await getExamWithQuestions(examId)

  if (!data) notFound()

  const { exam, questions } = data
  const choices = ['a', 'b', 'c', 'd', 'e'] as const

  return (
    <div
      style={{
        ['--bg' as string]: 'oklch(98% 0.006 55)',
        ['--bg-elev' as string]: 'oklch(100% 0 0)',
        ['--bg-soft' as string]: 'oklch(96% 0.009 55)',
        ['--fg' as string]: 'oklch(22% 0.02 50)',
        ['--fg-muted' as string]: 'oklch(46% 0.02 50)',
        ['--border' as string]: 'oklch(89% 0.012 50)',
        ['--primary' as string]: 'oklch(50% 0.19 25)',
        ['--primary-soft' as string]: 'oklch(94% 0.035 25)',
        ['--accent-green' as string]: 'oklch(60% 0.14 145)',
        ['--accent-blue' as string]: 'oklch(58% 0.13 250)',
        ['--shadow' as string]: 'rgba(20,10,10,.08)',
        minHeight: '100vh',
        background: 'var(--bg)',
        color: 'var(--fg)',
        fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
      }}
    >
      <style>{`
        @keyframes examFadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes noteSlide { from { opacity: 0; max-height: 0; } to { opacity: 1; max-height: 120px; } }
      `}</style>

      {/* Sticky Header */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        background: 'var(--bg-elev)',
        borderBottom: '1px solid var(--border)',
        backdropFilter: 'blur(10px)',
      }}>
        <div style={{
          maxWidth: 1180,
          margin: '0 auto',
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}>
          {/* Back button */}
          <Link
            href={`/${year}/${semester}/${subject}/${batch}/${examId}`}
            style={{
              width: 38, height: 38, flexShrink: 0,
              borderRadius: 11,
              border: '1px solid var(--border)',
              background: 'var(--bg-soft)',
              color: 'var(--fg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              textDecoration: 'none',
            }}
          >
            <ArrowLeft size={17} strokeWidth={2.2} />
          </Link>

          {/* Title */}
          <div style={{ minWidth: 0, flex: '1 1 auto' }}>
            <div style={{
              fontSize: 13, color: 'var(--fg-muted)', fontWeight: 600,
              letterSpacing: '0.2px', whiteSpace: 'nowrap',
              overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              Review Mode
            </div>
            <div style={{
              fontSize: 17, fontWeight: 800, color: 'var(--fg)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {exam.title}
            </div>
          </div>

          {/* Take Exam button */}
          <Link
            href={`/${year}/${semester}/${subject}/${batch}/${examId}/play`}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 16px', borderRadius: 11,
              background: 'var(--primary)', color: '#fff',
              fontSize: 13, fontWeight: 700, textDecoration: 'none', flexShrink: 0,
            }}
          >
            <BookOpen size={15} />
            Take Exam
          </Link>
        </div>
      </header>

      {/* Main */}
      <main style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 24px 80px' }}>

        {/* Breadcrumb */}
        <div style={{ marginBottom: 24 }}>
          <Breadcrumb items={[
            { label: slugToName(year), href: `/${year}` },
            { label: slugToName(semester), href: `/${year}/${semester}` },
            { label: exam.title, href: `/${year}/${semester}/${subject}/${batch}/${examId}` },
            { label: 'Review Mode' },
          ]} />
        </div>

        {/* Question list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {questions.map((question, index) => {
            const stats = question.question_statistics?.[0]
            const correctPercent = stats && stats.attempts > 0
              ? Math.round((stats.correct_answers / stats.attempts) * 100)
              : null

            return (
              <div
                key={question.id}
                style={{
                  background: 'var(--bg-elev)',
                  border: '1px solid var(--border)',
                  borderRadius: 18,
                  padding: 24,
                  boxShadow: '0 1px 3px var(--shadow)',
                  animation: 'examFadeIn 0.3s ease',
                }}
              >
                {/* Question header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  {/* Number badge */}
                  <span style={{
                    width: 26, height: 26, borderRadius: 8,
                    background: 'var(--primary-soft)', color: 'var(--primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12.5, fontWeight: 800, flexShrink: 0,
                  }}>
                    {index + 1}
                  </span>

                  {/* Chapter pill */}
                  {question.chapter && (
                    <span style={{
                      padding: '4px 10px', borderRadius: 999,
                      background: 'color-mix(in srgb, var(--accent-blue) 15%, var(--bg-soft))',
                      color: 'var(--accent-blue)', fontSize: 12, fontWeight: 700,
                    }}>
                      {question.chapter}
                    </span>
                  )}

                  {/* Lecture pill */}
                  {question.lecture && (
                    <span style={{
                      padding: '4px 10px', borderRadius: 999,
                      background: 'var(--bg-soft)',
                      color: 'var(--fg-muted)', fontSize: 12, fontWeight: 700,
                    }}>
                      {question.lecture}
                    </span>
                  )}

                  {/* Correct % */}
                  {correctPercent !== null && (
                    <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: 'var(--fg-muted)' }}>
                      {correctPercent}% correct
                    </span>
                  )}
                </div>

                {/* Question text */}
                <div style={{
                  fontSize: 17.5, fontWeight: 700, color: 'var(--fg)',
                  lineHeight: 1.6, letterSpacing: '-0.1px', marginBottom: 16,
                }}>
                  {question.question_text}
                </div>

                {/* Choices */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {choices.map(letter => {
                    const text = question[`choice_${letter}`]
                    if (!text) return null

                    const isCorrect = question.correct_answer === letter
                    const wrongExpl = question[`incorrect_explanation_${letter}`]

                    return (
                      <div key={letter}>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '14px 16px', borderRadius: 13,
                          border: isCorrect ? '1.5px solid var(--accent-green)' : '1.5px solid var(--border)',
                          background: isCorrect
                            ? 'color-mix(in srgb, var(--accent-green) 16%, var(--bg-elev))'
                            : 'var(--bg-soft)',
                          opacity: isCorrect ? 1 : 0.55,
                          transition: 'background 0.2s, border-color 0.2s, opacity 0.2s',
                        }}>
                          {/* Letter/check badge */}
                          <span style={{
                            width: 26, height: 26, borderRadius: '50%',
                            background: isCorrect ? 'var(--accent-green)' : 'var(--bg-elev)',
                            color: isCorrect ? '#fff' : 'var(--fg-muted)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 12.5, fontWeight: 800, flexShrink: 0,
                            border: isCorrect ? '1px solid var(--accent-green)' : '1px solid var(--border)',
                          }}>
                            {isCorrect ? '✓' : letter.toUpperCase()}
                          </span>

                          <span style={{ flex: '1 1 auto', fontSize: 15, fontWeight: 600 }}>
                            {text}
                          </span>
                        </div>

                        {/* Wrong answer note */}
                        {!isCorrect && wrongExpl && (
                          <div style={{
                            margin: '6px 2px 0 42px',
                            fontSize: 13, fontWeight: 600, color: 'var(--primary)',
                            overflow: 'hidden', animation: 'noteSlide 0.25s ease',
                          }}>
                            {wrongExpl}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Explanation block */}
                {question.explanation && (
                  <div style={{
                    marginTop: 16, padding: '14px 16px', borderRadius: 13,
                    background: 'color-mix(in srgb, var(--accent-green) 12%, var(--bg-elev))',
                    border: '1px solid var(--accent-green)',
                    animation: 'examFadeIn 0.25s ease',
                  }}>
                    <div style={{
                      fontSize: 11.5, fontWeight: 800, letterSpacing: '0.5px',
                      color: 'var(--accent-green)', marginBottom: 4, textTransform: 'uppercase',
                    }}>
                      Explanation
                    </div>
                    <div style={{ fontSize: 14.5, color: 'var(--fg)', lineHeight: 1.55 }}>
                      {question.explanation}
                    </div>
                  </div>
                )}

                {/* Report button */}
                <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                  <ReportButton questionId={question.id} />
                </div>
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}