'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// ── Types ──────────────────────────────────────────────────────
interface Option {
  key: string
  text: string
  note: string | null
}

interface Question {
  id: string
  chapter: string
  topic: string
  text: string
  options: Option[]
  correct_answer: string
  explanation: string | null
  image_url: string | null
}

// ── Report Modal ───────────────────────────────────────────────
function ReportModal({ questionId, onClose }: { questionId: string; onClose: () => void }) {
  const [selected, setSelected] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const categories = [
    { value: 'wrong_answer',      label: 'Wrong answer' },
    { value: 'typo',              label: 'Typo' },
    { value: 'wrong_explanation', label: 'Wrong explanation' },
    { value: 'missing_image',     label: 'Missing image' },
    { value: 'wrong_image',       label: 'Wrong image' },
    { value: 'wrong_chapter',     label: 'Wrong chapter' },
    { value: 'duplicate',         label: 'Duplicate question' },
    { value: 'other',             label: 'Other' },
  ]

  async function handleSubmit() {
    if (!selected) return
    const supabase = createClient()
    await supabase.from('reports').insert({
      question_id: questionId,
      category: selected,
      status: 'new',
    })
    setSubmitted(true)
    setTimeout(onClose, 1200)
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-elev)', border: '1px solid var(--bd)',
          borderRadius: 18, padding: 28,
          width: '100%', maxWidth: 400,
          boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {submitted ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg)' }}>Report submitted</div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--fg)', marginBottom: 4 }}>
              Report an Issue
            </div>
            <div style={{ fontSize: 13, color: 'var(--fg-muted)', marginBottom: 20 }}>
              Select the type of issue with this question.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {categories.map(cat => (
                <button
                  key={cat.value}
                  onClick={() => setSelected(cat.value)}
                  style={{
                    padding: '10px 14px', borderRadius: 10, textAlign: 'left',
                    border: selected === cat.value ? '1.5px solid var(--primary)' : '1.5px solid var(--bd)',
                    background: selected === cat.value
                      ? 'color-mix(in srgb, var(--primary) 10%, var(--bg-elev))'
                      : 'var(--bg-soft)',
                    color: selected === cat.value ? 'var(--primary)' : 'var(--fg)',
                    fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={onClose}
                style={{
                  flex: 1, padding: '11px 0', borderRadius: 11,
                  border: '1px solid var(--bd)', background: 'var(--bg-soft)',
                  color: 'var(--fg)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!selected}
                style={{
                  flex: 1, padding: '11px 0', borderRadius: 11, border: 'none',
                  background: selected ? 'var(--primary)' : 'var(--bg-soft)',
                  color: selected ? 'white' : 'var(--fg-muted)',
                  fontSize: 14, fontWeight: 700,
                  cursor: selected ? 'pointer' : 'not-allowed',
                  opacity: selected ? 1 : 0.6,
                }}
              >
                Submit
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Question Card ──────────────────────────────────────────────
function QuestionCard({ q, index }: { q: Question; index: number }) {
  const [bookmarked, setBookmarked] = useState(false)
  const [flagged, setFlagged]       = useState(false)
  const [showReport, setShowReport] = useState(false)

  return (
    <div
      id={`q-${index}`}
      style={{
        background: 'var(--bg-elev)', border: '1px solid var(--bd)',
        borderRadius: 18, padding: 24,
        boxShadow: '0 1px 3px var(--shadow)',
        animation: 'examFadeIn 0.3s ease',
      }}
    >
      {/* Header: number + chapter + topic + actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{
          width: 26, height: 26, borderRadius: 8,
          background: 'var(--primary-soft)', color: 'var(--primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12.5, fontWeight: 800, flexShrink: 0,
        }}>
          {index + 1}
        </span>

        {q.chapter && (
          <span style={{
            padding: '4px 10px', borderRadius: 999,
            background: 'color-mix(in srgb, var(--accent-blue) 15%, var(--bg-soft))',
            color: 'var(--accent-blue)', fontSize: 12, fontWeight: 700,
          }}>
            {q.chapter}
          </span>
        )}

        {q.topic && (
          <span style={{
            padding: '4px 10px', borderRadius: 999,
            background: 'var(--bg-soft)', color: 'var(--fg-muted)',
            fontSize: 12, fontWeight: 700,
          }}>
            {q.topic}
          </span>
        )}

        <div style={{ flex: '1 1 auto' }} />

        {/* Bookmark */}
        <button
          onClick={() => setBookmarked(b => !b)}
          title="Bookmark"
          style={{
            width: 34, height: 34, borderRadius: 10, border: '1px solid var(--bd)',
            background: bookmarked ? 'var(--primary-soft)' : 'var(--bg-soft)',
            color: bookmarked ? 'var(--primary)' : 'var(--fg-muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24"
            fill={bookmarked ? 'currentColor' : 'none'}
            stroke="currentColor" strokeWidth="2.2"
            strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
        </button>

        {/* Flag */}
        <button
          onClick={() => setFlagged(f => !f)}
          title="Flag for review"
          style={{
            width: 34, height: 34, borderRadius: 10, border: '1px solid var(--bd)',
            background: flagged
              ? 'color-mix(in srgb, #f97316 15%, var(--bg-soft))'
              : 'var(--bg-soft)',
            color: flagged ? '#f97316' : 'var(--fg-muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24"
            fill={flagged ? 'currentColor' : 'none'}
            stroke="currentColor" strokeWidth="2.2"
            strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
            <line x1="4" y1="22" x2="4" y2="15" />
          </svg>
        </button>

        {/* Report */}
        <button
          onClick={() => setShowReport(true)}
          title="Report an issue"
          style={{
            width: 34, height: 34, borderRadius: 10, border: '1px solid var(--bd)',
            background: 'var(--bg-soft)', color: 'var(--fg-muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.2"
            strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </button>
      </div>

      {/* Question text */}
      <div style={{
        fontSize: 17.5, fontWeight: 700, color: 'var(--fg)',
        lineHeight: 1.6, letterSpacing: '-0.1px', marginBottom: 16,
      }}>
        {q.text}
      </div>

      {/* Image */}
      {q.image_url && (
        <div style={{
          marginBottom: 16, borderRadius: 14,
          overflow: 'hidden', border: '1px solid var(--bd)',
        }}>
          <img
            src={q.image_url}
            alt="Question"
            style={{ width: '100%', height: 220, objectFit: 'cover', display: 'block' }}
          />
        </div>
      )}

      {/* Options */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {q.options.map(opt => {
          const isCorrect = opt.key === q.correct_answer
          return (
            <div key={opt.key}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 16px', borderRadius: 13,
                border: isCorrect
                  ? '1.5px solid var(--accent-green)'
                  : '1.5px solid var(--bd)',
                background: isCorrect
                  ? 'color-mix(in srgb, var(--accent-green) 16%, var(--bg-elev))'
                  : 'var(--bg-soft)',
                color: 'var(--fg)',
                opacity: isCorrect ? 1 : 0.55,
                transition: 'background 0.2s, border-color 0.2s, opacity 0.2s',
              }}>
                <span style={{
                  width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                  background: isCorrect ? 'var(--accent-green)' : 'var(--bg-elev)',
                  color: isCorrect ? 'white' : 'var(--fg-muted)',
                  border: isCorrect ? '1px solid var(--accent-green)' : '1px solid var(--bd)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12.5, fontWeight: 800,
                }}>
                  {isCorrect ? '✓' : opt.key.toUpperCase()}
                </span>
                <span style={{ flex: '1 1 auto', fontSize: 15, fontWeight: 600 }}>
                  {opt.text}
                </span>
              </div>
              {/* Wrong answer note */}
              {opt.note && !isCorrect && (
                <div style={{
                  margin: '6px 2px 0 42px',
                  fontSize: 13, fontWeight: 600,
                  color: 'var(--primary)',
                  animation: 'noteSlide 0.25s ease',
                }}>
                  {opt.note}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Explanation */}
      {q.explanation && (
        <div style={{
          marginTop: 16, padding: '14px 16px', borderRadius: 13,
          background: 'color-mix(in srgb, var(--accent-green) 12%, var(--bg-elev))',
          border: '1px solid var(--accent-green)',
          animation: 'examFadeIn 0.25s ease',
        }}>
          <div style={{
            fontSize: 11.5, fontWeight: 800,
            letterSpacing: '0.5px', color: 'var(--accent-green)', marginBottom: 4,
          }}>
            EXPLANATION
          </div>
          <div style={{ fontSize: 14.5, color: 'var(--fg)', lineHeight: 1.55 }}>
            {q.explanation}
          </div>
        </div>
      )}

      {showReport && (
        <ReportModal questionId={q.id} onClose={() => setShowReport(false)} />
      )}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────
export default function ReviewPage() {
  const params  = useParams()
  const router  = useRouter()
  const examId  = params.examId as string

  const [questions,  setQuestions]  = useState<Question[]>([])
  const [examTitle,  setExamTitle]  = useState('Exam')
  const [doctorName, setDoctorName] = useState('')
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')

  useEffect(() => {
    if (!examId) return
    loadData()
  }, [examId])

  async function loadData() {
    const supabase = createClient()

    // جلب بيانات الامتحان
    const { data: exam } = await supabase
      .from('exams')
      .select('title, doctors ( name )')
      .eq('id', examId)
      .single()

    if (exam) {
      setExamTitle(exam.title)
      const doc = exam.doctors as any
      setDoctorName(doc?.name || '')
    }

    // جلب الأسئلة
    const { data: rows } = await supabase
      .from('questions')
      .select(`
        id, question_text,
        choice_a, choice_b, choice_c, choice_d, choice_e,
        correct_answer, explanation,
        incorrect_explanation_a, incorrect_explanation_b,
        incorrect_explanation_c, incorrect_explanation_d,
        incorrect_explanation_e,
        chapter, lecture,
        question_images ( image_url, display_order )
      `)
      .eq('exam_id', examId)
      .is('deleted_at', null)
      .order('question_order', { ascending: true })

    if (rows) {
      const mapped: Question[] = rows.map(r => ({
        id:             r.id,
        chapter:        r.chapter  || '',
        topic:          r.lecture  || '',
        text:           r.question_text,
        correct_answer: r.correct_answer,
        explanation:    r.explanation || null,
        image_url:      (r.question_images as any[])?.[0]?.image_url || null,
        options: [
          { key: 'a', text: r.choice_a, note: r.incorrect_explanation_a || null },
          { key: 'b', text: r.choice_b, note: r.incorrect_explanation_b || null },
          { key: 'c', text: r.choice_c, note: r.incorrect_explanation_c || null },
          { key: 'd', text: r.choice_d, note: r.incorrect_explanation_d || null },
          ...(r.choice_e ? [{ key: 'e', text: r.choice_e, note: r.incorrect_explanation_e || null }] : []),
        ],
      }))
      setQuestions(mapped)
    }

    setLoading(false)
  }

  // فلترة البحث
  const filtered = search.trim().length < 2
    ? questions
    : questions.filter(q => {
        const term = search.toLowerCase()
        return (
          q.text.toLowerCase().includes(term) ||
          q.options.some(o => o.text.toLowerCase().includes(term)) ||
          (q.explanation ?? '').toLowerCase().includes(term) ||
          q.chapter.toLowerCase().includes(term) ||
          q.topic.toLowerCase().includes(term)
        )
      })

  if (loading) {
    return (
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 24px' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{
            background: 'var(--bg-elev)', border: '1px solid var(--bd)',
            borderRadius: 18, padding: 24, marginBottom: 20,
          }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <div style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--bg-soft)' }} />
              <div style={{ width: 80, height: 26, borderRadius: 999, background: 'var(--bg-soft)' }} />
            </div>
            <div style={{ height: 20, borderRadius: 8, background: 'var(--bg-soft)', marginBottom: 8, width: '70%' }} />
            <div style={{ height: 20, borderRadius: 8, background: 'var(--bg-soft)', marginBottom: 20, width: '40%' }} />
            {[1, 2, 3, 4].map(j => (
              <div key={j} style={{ height: 52, borderRadius: 13, background: 'var(--bg-soft)', marginBottom: 10 }} />
            ))}
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      <style>{`
        @keyframes examFadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes noteSlide {
          from { opacity: 0; max-height: 0; }
          to   { opacity: 1; max-height: 120px; }
        }
        .review-search:focus { outline: none; }
        .review-search::placeholder { color: var(--fg-muted); opacity: 0.7; }
      `}</style>

      {/* Sticky Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'var(--bg-elev)',
        borderBottom: '1px solid var(--bd)',
        backdropFilter: 'blur(10px)',
      }}>
        <div style={{
          maxWidth: 1180, margin: '0 auto', padding: '14px 24px',
          display: 'flex', alignItems: 'center', gap: 16,
          flexWrap: 'wrap',
        }}>
          {/* Back */}
          <button
            onClick={() => router.back()}
            style={{
              width: 38, height: 38, flexShrink: 0,
              borderRadius: 11, border: '1px solid var(--bd)',
              background: 'var(--bg-soft)', color: 'var(--fg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Title */}
          <div style={{ minWidth: 0, flex: '1 1 auto' }}>
            <div style={{
              fontSize: 13, color: 'var(--fg-muted)', fontWeight: 600,
              letterSpacing: '0.2px', whiteSpace: 'nowrap',
              overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {doctorName ? `Review Mode · ${doctorName}` : 'Review Mode'}
            </div>
            <div style={{
              fontSize: 17, fontWeight: 800, color: 'var(--fg)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {examTitle}
            </div>
          </div>

          {/* Count */}
          <div style={{
            padding: '6px 12px', borderRadius: 8,
            background: 'var(--bg-soft)', border: '1px solid var(--bd)',
            fontSize: 13, fontWeight: 700, color: 'var(--fg-muted)',
            flexShrink: 0, whiteSpace: 'nowrap',
          }}>
            {questions.length} questions
          </div>
        </div>
      </header>

      {/* Main */}
      <main style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 24px 80px' }}>
        {questions.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', height: '40vh',
            alignItems: 'center', justifyContent: 'center',
            gap: 12, color: 'var(--fg-muted)',
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <div style={{ fontSize: 15, fontWeight: 600 }}>No questions to review.</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', height: '30vh',
            alignItems: 'center', justifyContent: 'center',
            gap: 12, color: 'var(--fg-muted)',
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <div style={{ fontSize: 15, fontWeight: 600 }}>No matching questions found.</div>
            <button
              onClick={() => setSearch('')}
              style={{
                padding: '8px 18px', borderRadius: 9,
                border: '1px solid var(--bd)', background: 'var(--bg-soft)',
                color: 'var(--fg)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Clear search
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {filtered.map((q, i) => (
              <QuestionCard
                key={q.id}
                q={q}
                index={questions.indexOf(q)}
              />
            ))}
          </div>
        )}
      </main>
    </>
  )
}