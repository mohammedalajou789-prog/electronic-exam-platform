'use client'
// src/components/dashboard/WrongQuestionsClient.tsx
//
// Renders wrong questions in Review-style layout.
// Each question can be deleted individually.
// Deletion only removes from the wrong_answers table — accuracy is unaffected.

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ExplanationRenderer } from '@/components/exam/ExplanationRenderer'

interface WrongQuestion {
  id: string            // wrong_answers.id
  question_id: string
  question: {
    id: string
    question_text: string
    chapter: { id: string; name: string } | null
    lecture: { id: string; name: string } | null
    choice_a: string
    choice_b: string
    choice_c: string | null
    choice_d: string | null
    choice_e: string | null
    correct_answer: string
    explanation: string | null
    incorrect_explanation_a: string | null
    incorrect_explanation_b: string | null
    incorrect_explanation_c: string | null
    incorrect_explanation_d: string | null
    incorrect_explanation_e: string | null
    exam: {
      id: string
      title: string
      batch: { name: string; subject: { name: string } }
    }
  }
}

interface Props {
  questions: WrongQuestion[]
  userId: string
}

export default function WrongQuestionsClient({ questions: initial, userId }: Props) {
  const [questions, setQuestions] = useState(initial)
  const [deleting, setDeleting]   = useState<string | null>(null)

  async function handleDelete(wrongId: string) {
    setDeleting(wrongId)
    const supabase = createClient()
    await supabase
      .from('wrong_answers')
      .delete()
      .eq('id', wrongId)
      .eq('user_id', userId)

    setQuestions(prev => prev.filter(q => q.id !== wrongId))
    setDeleting(null)
  }

  if (questions.length === 0) {
    return (
      <div style={{
        padding: '64px 24px', textAlign: 'center',
        border: '1px dashed var(--bd)', borderRadius: 16,
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>All cleared!</div>
        <div style={{ fontSize: 13.5, color: 'var(--fg-muted)' }}>No wrong questions remaining in this view.</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {questions.map((w, index) => {
        const q = w.question
        const choices = [
          { key: 'a', text: q.choice_a, note: q.incorrect_explanation_a },
          { key: 'b', text: q.choice_b, note: q.incorrect_explanation_b },
          { key: 'c', text: q.choice_c, note: q.incorrect_explanation_c },
          { key: 'd', text: q.choice_d, note: q.incorrect_explanation_d },
          { key: 'e', text: q.choice_e, note: q.incorrect_explanation_e },
        ].filter(c => !!c.text)

        return (
          <div key={w.id} style={{
            background: 'var(--bg-elev)',
            border: '1px solid var(--bd)',
            borderRadius: 18,
            padding: '20px 22px',
          }}>
            {/* Question header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{
                  width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                  background: 'var(--clr-soft)', color: 'var(--clr-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12.5, fontWeight: 800,
                }}>
                  {index + 1}
                </span>
                {q.chapter && (
                  <span style={{
                    padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                    background: 'color-mix(in srgb, #60a5fa 14%, var(--bg-soft))',
                    color: '#2563eb',
                  }}>
                    {q.chapter.name}
                  </span>
                )}
                {q.lecture && (
                  <span style={{
                    padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                    background: 'var(--bg-soft)', color: 'var(--fg-muted)',
                  }}>
                    {q.lecture.name}
                  </span>
                )}
                <span style={{
                  padding: '3px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 600,
                  background: 'var(--bg-soft)', color: 'var(--fg-muted)',
                }}>
                  {q.exam?.title}
                </span>
              </div>

              {/* Delete button */}
              <button
                onClick={() => handleDelete(w.id)}
                disabled={deleting === w.id}
                title="Remove from wrong questions"
                style={{
                  width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                  border: '1px solid color-mix(in srgb, #ef4444 30%, var(--bd))',
                  background: 'color-mix(in srgb, #ef4444 8%, var(--bg-soft))',
                  color: '#ef4444', cursor: deleting === w.id ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: deleting === w.id ? 0.5 : 1,
                  fontFamily: 'inherit',
                }}
              >
                {deleting === w.id ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0" />
                  </svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                )}
              </button>
            </div>

            {/* Question text */}
            <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.6, marginBottom: 14, color: 'var(--fg)' }}>
              {q.question_text}
            </div>

            {/* Choices */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              {choices.map(opt => {
                const isCorrect = opt.key === q.correct_answer
                return (
                  <div key={opt.key}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '11px 14px', borderRadius: 11,
                      border: isCorrect
                        ? '1.5px solid #4ade80'
                        : '1px solid var(--bd)',
                      background: isCorrect
                        ? 'color-mix(in srgb, #4ade80 12%, var(--bg-soft))'
                        : 'var(--bg-soft)',
                      opacity: isCorrect ? 1 : 0.55,
                    }}>
                      <span style={{
                        width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 800,
                        background: isCorrect ? '#4ade80' : 'var(--bg-elev)',
                        color: isCorrect ? 'white' : 'var(--fg-muted)',
                        border: isCorrect ? 'none' : '1px solid var(--bd)',
                      }}>
                        {isCorrect ? '✓' : opt.key.toUpperCase()}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg)' }}>
                        {opt.text}
                      </span>
                    </div>
                    {/* Wrong answer note */}
                    {!isCorrect && opt.note && (
                      <div style={{ margin: '4px 2px 0 46px', fontSize: 12.5, color: 'var(--fg-muted)', fontWeight: 600 }}>
                        {opt.note}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Explanation */}
            {q.explanation && (
              <div style={{ borderTop: '1px solid var(--bd)', paddingTop: 14 }}>
                <ExplanationRenderer content={q.explanation} />
              </div>
            )}
          </div>
        )
      })}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}