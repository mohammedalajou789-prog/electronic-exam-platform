'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Question {
  id: string
  question_text: string
  choice_a: string
  choice_b: string
  choice_c: string
  choice_d: string
  choice_e: string | null
  correct_answer: string
  explanation: string | null
  chapter: string | null
  lecture: string | null
  image_url: string | null
}

interface ExamInfo {
  title: string
  doctor_name: string
  subject_name: string
  batch_name: string
}

export default function PdfPage() {
  const params  = useParams()
  const router  = useRouter()
  const examId  = params.examId as string

  const [questions,  setQuestions]  = useState<Question[]>([])
  const [examInfo,   setExamInfo]   = useState<ExamInfo>({ title: '', doctor_name: '', subject_name: '', batch_name: '' })
  const [loading,    setLoading]    = useState(true)
  const [showAnswer, setShowAnswer] = useState(true)
  const printRef = useRef<HTMLDivElement>(null)
// إخفاء الـ Navbar عند الطباعة فقط
  useEffect(() => {
    const style = document.createElement('style')
    style.id = 'pdf-hide-nav'
    style.innerHTML = `@media print { header { display: none !important; } nav { display: none !important; } }`
    document.head.appendChild(style)

    

    return () => {
      document.getElementById('pdf-hide-nav')?.remove()
      
    }
  }, [])
  useEffect(() => {
    if (!examId) return
    loadData()
  }, [examId])

  async function loadData() {
    const supabase = createClient()

    const { data: exam } = await supabase
      .from('exams')
      .select('title, doctors ( name ), batches ( name, subjects ( name ) )')
      .eq('id', examId)
      .single()

    if (exam) {
      setExamInfo({
        title: exam.title,
        doctor_name: (exam.doctors as any)?.name || '',
        subject_name: (exam.batches as any)?.subjects?.name || '',
        batch_name: (exam.batches as any)?.name || '',
      })
    }

    const { data: rows } = await supabase
      .from('questions')
      .select(`
        id, question_text,
        choice_a, choice_b, choice_c, choice_d, choice_e,
        correct_answer, explanation, chapter, lecture,
        question_images ( image_url, display_order )
      `)
      .eq('exam_id', examId)
      .is('deleted_at', null)
      .order('question_order', { ascending: true })

    if (rows) {
      setQuestions(rows.map(r => ({
        ...r,
        image_url: (r.question_images as any[])?.[0]?.image_url || null,
      })))
    }

    setLoading(false)
  }

  function handlePrint() {
    window.print()
  }

  const choices = (q: Question) => [
    { key: 'a', text: q.choice_a },
    { key: 'b', text: q.choice_b },
    { key: 'c', text: q.choice_c },
    { key: 'd', text: q.choice_d },
    ...(q.choice_e ? [{ key: 'e', text: q.choice_e }] : []),
  ]

  if (loading) {
    return (
      <div style={{
        display: 'flex', height: '60vh',
        alignItems: 'center', justifyContent: 'center',
        color: 'var(--fg-muted)', fontSize: 15, fontWeight: 600,
      }}>
        Preparing PDF...
      </div>
    )
  }

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-area { margin: 0 !important; padding: 0 !important; }
          body { background: white !important; }
          @page { margin: 1.5cm; }
          body > div > footer { display: none !important; }
        }
        @media screen {
          .print-area { max-width: 1180px; margin: 0 auto; padding: 32px 24px 80px; }
        }
      `}</style>

      {/* Toolbar — hidden on print */}
      <div className="no-print" style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'var(--bg-elev)', borderBottom: '1px solid var(--bd)',
        backdropFilter: 'blur(10px)',
      }}>
        <div style={{
          maxWidth: 1180, margin: '0 auto', padding: '14px 24px',
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          {/* Back */}
          <button onClick={() => router.back()} style={{
            width: 38, height: 38, flexShrink: 0,
            borderRadius: 11, border: '1px solid var(--bd)',
            background: 'var(--bg-soft)', color: 'var(--fg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Title */}
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            <div style={{ fontSize: 12, color: 'var(--fg-muted)', fontWeight: 600 }}>
              PDF Export
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--fg)' }}>
              {examInfo.title}
            </div>
          </div>

          {/* Toggle answers */}
          <label style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 13.5, fontWeight: 600, color: 'var(--fg)',
            cursor: 'pointer',
          }}>
            <input
              type="checkbox"
              checked={showAnswer}
              onChange={e => setShowAnswer(e.target.checked)}
              style={{ width: 16, height: 16, cursor: 'pointer' }}
            />
            Show answers & explanations
          </label>

          {/* Print button */}
          <button onClick={handlePrint} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', borderRadius: 11, border: 'none',
            background: 'var(--primary)', color: 'white',
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            Print / Save PDF
          </button>
        </div>
      </div>

      {/* Print content */}
      <div ref={printRef} className="print-area">

        {/* Cover */}
        <div style={{
          textAlign: 'center', padding: '40px 24px 32px',
          borderBottom: '2px solid var(--bd)', marginBottom: 32,
        }}>
          {/* Logo + Team name */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
            <img
              src="/images/logo.jpg"
              alt="Medical Club logo"
              style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', marginBottom: 10 }}
            />
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--fg)' }}>Medical Club</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-muted)', marginTop: 3 }}>
              Electronic Exam Platform Team
            </div>
          </div>

          <div style={{
            fontSize: 11, fontWeight: 800, letterSpacing: '2px',
            color: 'var(--fg-muted)', textTransform: 'uppercase', marginBottom: 12,
          }}>
            MEDICAL CLUB — EXAM PLATFORM
          </div>
          <div style={{
            fontSize: 28, fontWeight: 800, color: 'var(--fg)', marginBottom: 8,
          }}>
            {examInfo.title}
          </div>
          {examInfo.doctor_name && (
            <div style={{ fontSize: 15, color: 'var(--fg-muted)', fontWeight: 600 }}>
              Dr. {examInfo.doctor_name}
            </div>
          )}
          {(examInfo.subject_name || examInfo.batch_name) && (
            <div style={{ fontSize: 13, color: 'var(--fg-muted)', fontWeight: 600, marginTop: 4 }}>
              {examInfo.subject_name} {examInfo.batch_name && `· ${examInfo.batch_name}`}
            </div>
          )}
          <div style={{
            display: 'flex', justifyContent: 'center', gap: 24,
            marginTop: 20, flexWrap: 'wrap',
          }}>
            <div style={{
              padding: '8px 18px', borderRadius: 10,
              background: 'var(--bg-soft)', border: '1px solid var(--bd)',
              fontSize: 13, fontWeight: 700, color: 'var(--fg-muted)',
            }}>
              {questions.length} Questions
            </div>
            {showAnswer && (
              <div style={{
                padding: '8px 18px', borderRadius: 10,
                background: 'color-mix(in srgb, var(--accent-green) 12%, var(--bg-soft))',
                border: '1px solid var(--accent-green)',
                fontSize: 13, fontWeight: 700, color: 'var(--accent-green)',
              }}>
                Includes Answers
              </div>
            )}
          </div>
        </div>

        {/* Questions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {questions.map((q, i) => (
            <div key={q.id} style={{
              border: '1px solid var(--bd)', borderRadius: 16,
              padding: '20px 24px', pageBreakInside: 'avoid',
            }}>
              {/* Question header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  background: 'var(--primary-soft)', color: 'var(--primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 800,
                }}>
                  {i + 1}
                </span>
                {q.chapter && (
                  <span style={{
                    padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                    background: 'color-mix(in srgb, var(--accent-blue) 12%, var(--bg-soft))',
                    color: 'var(--accent-blue)',
                  }}>
                    {q.chapter}
                  </span>
                )}
                {q.lecture && (
                  <span style={{
                    padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                    background: 'var(--bg-soft)', color: 'var(--fg-muted)',
                  }}>
                    {q.lecture}
                  </span>
                )}
              </div>

              {/* Question text */}
              <div style={{
                fontSize: 16, fontWeight: 700, color: 'var(--fg)',
                lineHeight: 1.6, marginBottom: 14,
              }}>
                {q.question_text}
              </div>

              {/* Image */}
              {q.image_url && (
                <div style={{ marginBottom: 14, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--bd)' }}>
                  <img
                    src={q.image_url}
                    alt="Question image"
                    style={{ width: '100%', maxHeight: 300, objectFit: 'contain', display: 'block' }}
                  />
                </div>
              )}

              {/* Choices */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {choices(q).map(opt => {
                  const isCorrect = showAnswer && opt.key === q.correct_answer
                  return (
                    <div key={opt.key} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 14px', borderRadius: 10,
                      border: isCorrect
                        ? '1.5px solid var(--accent-green)'
                        : '1px solid var(--bd)',
                      background: isCorrect
                        ? 'color-mix(in srgb, var(--accent-green) 10%, white)'
                        : 'var(--bg-soft)',
                      opacity: showAnswer && !isCorrect ? 0.6 : 1,
                    }}>
                      <span style={{
                        width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                        background: isCorrect ? 'var(--accent-green)' : 'var(--bg-elev)',
                        color: isCorrect ? 'white' : 'var(--fg-muted)',
                        border: isCorrect ? 'none' : '1px solid var(--bd)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 800,
                      }}>
                        {isCorrect ? '✓' : opt.key.toUpperCase()}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg)' }}>
                        {opt.text}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Explanation */}
              {showAnswer && q.explanation && (
                <div style={{
                  marginTop: 12, padding: '12px 14px', borderRadius: 10,
                  background: 'color-mix(in srgb, var(--accent-green) 8%, white)',
                  border: '1px solid var(--accent-green)',
                }}>
                  <div style={{
                    fontSize: 10, fontWeight: 800, letterSpacing: '0.5px',
                    color: 'var(--accent-green)', marginBottom: 4,
                    textTransform: 'uppercase',
                  }}>
                    Explanation
                  </div>
                  <div style={{ fontSize: 13.5, color: 'var(--fg)', lineHeight: 1.55 }}>
                    {q.explanation}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          marginTop: 48, paddingTop: 24,
          borderTop: '2px solid var(--bd)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/images/logo.jpg" alt="logo"
              style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--fg)' }}>Medical Club</div>
              <div style={{ fontSize: 11, color: 'var(--fg-muted)', fontWeight: 500 }}>Hashemite University</div>
            </div>
          </div>
          <div style={{ textAlign: 'center', flex: '1 1 auto' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg)' }}>{examInfo.title}</div>
            <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>
              {examInfo.subject_name && `${examInfo.subject_name} · `}{questions.length} Questions
            </div>
          </div>
          <div style={{
            fontSize: 11, color: 'var(--fg-muted)', fontWeight: 600,
            textAlign: 'right',
          }}>
            © {new Date().getFullYear()} Medical Club<br />
            Exam Platform
          </div>
        </div>
      </div>
    </>
  )
}