'use client'
// src/components/dashboard/BookmarksClient.tsx

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ExplanationRenderer } from '@/components/exam/ExplanationRenderer'

interface BookmarkedQuestion {
  id: string            // bookmarks.id
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
  questions: BookmarkedQuestion[]
  userId: string
}

export default function BookmarksClient({ questions: initial, userId }: Props) {
  const [questions, setQuestions] = useState(initial)
  const [deleting, setDeleting]   = useState<string | null>(null)

  async function handleRemove(bookmarkId: string) {
    setDeleting(bookmarkId)
    const supabase = createClient()
    await supabase
      .from('bookmarks')
      .delete()
      .eq('id', bookmarkId)
      .eq('user_id', userId)

    setQuestions(prev => prev.filter(q => q.id !== bookmarkId))
    setDeleting(null)
  }

  if (questions.length === 0) {
    return (
      <div style={{
        padding: '64px 24px', textAlign: 'center',
        border: '1px dashed var(--bd)', borderRadius: 16,
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>All cleared!</div>
        <div style={{ fontSize: 13.5, color: 'var(--fg-muted)' }}>No bookmarks remaining in this view.</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {questions.map((b, index) => {
        const q = b.question
        const choices = [
          { key: 'a', text: q.choice_a, note: q.incorrect_explanation_a },
          { key: 'b', text: q.choice_b, note: q.incorrect_explanation_b },
          { key: 'c', text: q.choice_c, note: q.incorrect_explanation_c },
          { key: 'd', text: q.choice_d, note: q.incorrect_explanation_d },
          { key: 'e', text: q.choice_e, note: q.incorrect_explanation_e },
        ].filter(c => !!c.text)

        return (
          <div key={b.id} style={{
            background: 'var(--bg-elev)',
            border: '1px solid var(--bd)',
            borderRadius: 18,
            padding: '20px 22px',
          }}>
            {/* Header */}
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

              {/* Remove bookmark button */}
              <button
                onClick={() => handleRemove(b.id)}
                disabled={deleting === b.id}
                title="Remove bookmark"
                style={{
                  width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                  border: '1px solid color-mix(in srgb, var(--clr-primary) 30%, var(--bd))',
                  background: 'color-mix(in srgb, var(--clr-primary) 8%, var(--bg-soft))',
                  color: 'var(--clr-primary)',
                  cursor: deleting === b.id ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: deleting === b.id ? 0.5 : 1,
                  fontFamily: 'inherit',
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
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
                      border: isCorrect ? '1.5px solid #4ade80' : '1px solid var(--bd)',
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