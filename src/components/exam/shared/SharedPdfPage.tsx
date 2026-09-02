// src/components/exam/shared/SharedPdfPage.tsx
'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ExplanationRenderer } from '@/components/exam/ExplanationRenderer'

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
  chapter: { id: string; name: string } | null
  lecture: { id: string; name: string } | null
  image_url: string | null
}

interface ExamInfo {
  title: string
  doctor_name: string
  subject_name: string
  batch_name: string
}

type PdfMode = 'questions_only' | 'with_answers' | 'with_answers_and_explanation'

const PDF_OPTIONS: { value: PdfMode; label: string }[] = [
  { value: 'questions_only',               label: 'Questions only'                    },
  { value: 'with_answers',                 label: 'Questions with answers'            },
  { value: 'with_answers_and_explanation', label: 'Questions, answers & explanations' },
]

interface Props {
  // إذا examId → نجلب من exams
  // إذا customExamId → نجلب من custom_exams
  examId?: string
  customExamId?: string
}

export default function SharedPdfPage({ examId, customExamId }: Props) {
  const [questions,  setQuestions] = useState<Question[]>([])
  const [examInfo,   setExamInfo]  = useState<ExamInfo>({
    title: 'Custom Exam', doctor_name: '', subject_name: '', batch_name: '',
  })
  const [loading,  setLoading]  = useState(true)
  const [pdfMode,  setPdfMode]  = useState<PdfMode>('with_answers')
  const printRef = useRef<HTMLDivElement>(null)

  const showAnswers     = pdfMode === 'with_answers' || pdfMode === 'with_answers_and_explanation'
  const showExplanation = pdfMode === 'with_answers_and_explanation'

  useEffect(() => {
    const style = document.createElement('style')
    style.id = 'pdf-hide-nav'
    style.innerHTML = `@media print { header { display: none !important; } nav { display: none !important; } }`
    document.head.appendChild(style)
    return () => { document.getElementById('pdf-hide-nav')?.remove() }
  }, [])

  useEffect(() => {
    loadData()
  }, [examId, customExamId])

  async function loadData() {
    const supabase = createClient()

    if (examId) {
      // ── Regular exam ──────────────────────────────────────
      const { data: exam } = await supabase
        .from('exams')
        .select('title, exam_doctors(doctor:doctors(name)), batch:batches(name, subject:subjects(name))')
        .eq('id', examId)
        .single()

      if (exam) {
        const doctors = (exam.exam_doctors as any[])
          ?.map((ed: any) => ed.doctor?.name).filter(Boolean) || []
        setExamInfo({
          title:        exam.title,
          doctor_name:  doctors.join(', '),
          subject_name: (exam.batch as any)?.subject?.name || '',
          batch_name:   (exam.batch as any)?.name || '',
        })
      }

      const { data: rows } = await supabase
        .from('questions')
        .select(`
          id, question_text,
          choice_a, choice_b, choice_c, choice_d, choice_e,
          correct_answer, explanation,
          chapter:chapters(id, name), lecture:lectures(id, name),
          question_images ( image_url, display_order )
        `)
        .eq('exam_id', examId)
        .is('deleted_at', null)
        .order('question_order', { ascending: true })

      if (rows) {
        setQuestions(rows.map((r: any) => ({
          ...r,
          chapter: Array.isArray(r.chapter) ? r.chapter[0] || null : r.chapter,
          lecture: Array.isArray(r.lecture) ? r.lecture[0] || null : r.lecture,
          image_url: (r.question_images as any[])?.[0]?.image_url || null,
        })))
      }

    } else if (customExamId) {
      // ── Custom exam ───────────────────────────────────────
      const { data: customExam } = await supabase
        .from('custom_exams')
        .select('*')
        .eq('id', customExamId)
        .single()

      if (!customExam) { setLoading(false); return }

      const { data: rows } = await supabase
        .from('questions')
        .select(`
          id, question_text,
          choice_a, choice_b, choice_c, choice_d, choice_e,
          correct_answer, explanation,
          chapter:chapters(id, name), lecture:lectures(id, name),
          question_images ( image_url, display_order )
        `)
        .in('id', customExam.question_ids)
        .is('deleted_at', null)

      if (rows) {
        setQuestions(rows.map((r: any) => ({
          ...r,
          chapter: Array.isArray(r.chapter) ? r.chapter[0] || null : r.chapter,
          lecture: Array.isArray(r.lecture) ? r.lecture[0] || null : r.lecture,
          image_url: (r.question_images as any[])?.[0]?.image_url || null,
        })))
      }
    }

    setLoading(false)
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
      <div style={{ display: 'flex', height: '60vh', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-muted)', fontSize: 15, fontWeight: 600 }}>
        Preparing PDF...
      </div>
    )
  }

  return (
    <>
      <style>{`
        @media print {
          .no-print   { display: none !important; }
          .print-area { margin: 0 !important; padding: 0 !important; }
          body        { background: white !important; }
          @page       { margin: 1.5cm; }
          body > div > footer { display: none !important; }
        }
        @media screen {
          .print-area { padding: 32px 28px 80px; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="no-print" style={{ position: 'sticky', top: 0, zIndex: 40, background: 'var(--bg-elev)', borderBottom: '1px solid var(--bd)', backdropFilter: 'blur(10px)' }}>
        <div style={{ padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {PDF_OPTIONS.map(opt => (
              <label key={opt.value} onClick={() => setPdfMode(opt.value)} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
                <span style={{
                  width: 17, height: 17, borderRadius: '50%', flexShrink: 0,
                  border: pdfMode === opt.value ? '5px solid var(--clr-primary)' : '1.5px solid var(--bd)',
                  background: 'transparent', display: 'inline-block', transition: 'border 0.15s ease',
                }} />
                <span style={{ fontSize: 13.5, fontWeight: pdfMode === opt.value ? 600 : 400, color: pdfMode === opt.value ? 'var(--fg)' : 'var(--fg-muted)', transition: 'color 0.15s ease' }}>
                  {opt.label}
                </span>
              </label>
            ))}
          </div>
          <button onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 22px', borderRadius: 11, border: 'none', background: 'var(--clr-primary)', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" rx="1" />
            </svg>
            Print / Save PDF
          </button>
        </div>
      </div>

      {/* PDF Content */}
      <div ref={printRef} className="print-area">

        {/* Cover */}
        <div style={{ textAlign: 'center', padding: '40px 24px 32px', borderBottom: '2px solid var(--bd)', marginBottom: 32 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
            <img src="/images/logo.jpg" alt="Medical Club logo" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', marginBottom: 10 }} />
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--fg)' }}>Medical Club</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-muted)', marginTop: 3 }}>Electronic Exam Platform Team</div>
          </div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '2px', color: 'var(--fg-muted)', textTransform: 'uppercase', marginBottom: 12 }}>
            MEDICAL CLUB — EXAM PLATFORM
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--fg)', marginBottom: 8 }}>{examInfo.title}</div>
          {examInfo.doctor_name && (
            <div style={{ fontSize: 15, color: 'var(--fg-muted)', fontWeight: 600 }}>Dr. {examInfo.doctor_name}</div>
          )}
          {(examInfo.subject_name || examInfo.batch_name) && (
            <div style={{ fontSize: 13, color: 'var(--fg-muted)', fontWeight: 600, marginTop: 4 }}>
              {examInfo.subject_name}{examInfo.batch_name && ` · ${examInfo.batch_name}`}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 20, flexWrap: 'wrap' }}>
            <div style={{ padding: '8px 18px', borderRadius: 10, background: 'var(--bg-soft)', border: '1px solid var(--bd)', fontSize: 13, fontWeight: 700, color: 'var(--fg-muted)' }}>
              {questions.length} Questions
            </div>
            {showAnswers && (
              <div style={{ padding: '8px 18px', borderRadius: 10, background: 'color-mix(in srgb, var(--accent-green) 12%, var(--bg-soft))', border: '1px solid var(--accent-green)', fontSize: 13, fontWeight: 700, color: 'var(--accent-green)' }}>
                Includes Answers
              </div>
            )}
          </div>
        </div>

        {/* Questions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {questions.map((q, i) => (
            <div key={q.id} style={{ border: '1px solid var(--bd)', borderRadius: 16, padding: '20px 24px', pageBreakInside: 'avoid' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: 'var(--clr-soft)', color: 'var(--clr-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 }}>
                  {i + 1}
                </span>
                {q.chapter && <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: 'color-mix(in srgb, var(--accent-blue) 12%, var(--bg-soft))', color: 'var(--accent-blue)' }}>{q.chapter.name}</span>}
                {q.lecture && <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: 'var(--bg-soft)', color: 'var(--fg-muted)' }}>{q.lecture.name}</span>}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg)', lineHeight: 1.6, marginBottom: 14 }}>{q.question_text}</div>
              {q.image_url && (
                <div style={{ marginBottom: 14, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--bd)' }}>
                  <img src={q.image_url} alt="Question image" style={{ width: '100%', maxHeight: 300, objectFit: 'contain', display: 'block' }} />
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {choices(q).map(opt => {
                  const isCorrect = showAnswers && opt.key === q.correct_answer
                  return (
                    <div key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, border: isCorrect ? '1.5px solid var(--accent-green)' : '1px solid var(--bd)', background: isCorrect ? 'color-mix(in srgb, var(--accent-green) 10%, white)' : 'var(--bg-soft)', opacity: showAnswers && !isCorrect ? 0.6 : 1 }}>
                      <span style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, background: isCorrect ? 'var(--accent-green)' : 'var(--bg-elev)', color: isCorrect ? 'white' : 'var(--fg-muted)', border: isCorrect ? 'none' : '1px solid var(--bd)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>
                        {isCorrect ? '✓' : opt.key.toUpperCase()}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg)' }}>{opt.text}</span>
                    </div>
                  )
                })}
              </div>
              {showExplanation && q.explanation && (
                <div style={{ marginTop: 12 }}>
                  <ExplanationRenderer content={q.explanation} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 48, paddingTop: 24, borderTop: '2px solid var(--bd)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/images/logo.jpg" alt="logo" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
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
          <div style={{ fontSize: 11, color: 'var(--fg-muted)', fontWeight: 600, textAlign: 'right' }}>
            © {new Date().getFullYear()} Medical Club<br />Exam Platform
          </div>
        </div>
      </div>
    </>
  )
}