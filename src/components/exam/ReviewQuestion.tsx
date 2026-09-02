'use client'

import { useState } from 'react'
import { ExplanationRenderer } from '@/components/exam/ExplanationRenderer'
import ReportButton from '@/components/exam/ReportButton'

const choices = ['a', 'b', 'c', 'd', 'e'] as const

interface Question {
  id: string
  question_text: string
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
  chapter: { id: string; name: string } | null
  lecture: { id: string; name: string } | null
  question_statistics?: { attempts: number; correct_answers: number }[]
  [key: string]: unknown
}

export default function ReviewQuestion({ question, index }: { question: Question; index: number }) {
  const [showExplanation, setShowExplanation] = useState(false)

  const stats = question.question_statistics?.[0]
  const correctPercent = stats && stats.attempts > 0
    ? Math.round((stats.correct_answers / stats.attempts) * 100)
    : null

  return (
    <div
      style={{
        background: 'var(--bg-elev)',
        border: '1px solid var(--border)',
        borderRadius: 18,
        padding: 24,
        boxShadow: '0 1px 3px var(--shadow)',
      }}
    >
      {/* Question header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{
          width: 26, height: 26, borderRadius: 8,
          background: 'var(--primary-soft)', color: 'var(--primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12.5, fontWeight: 800, flexShrink: 0,
        }}>
          {index + 1}
        </span>
        {question.chapter && (
          <span style={{
            padding: '4px 10px', borderRadius: 999,
            background: 'color-mix(in srgb, var(--accent-blue) 15%, var(--bg-soft))',
            color: 'var(--accent-blue)', fontSize: 12, fontWeight: 700,
          }}>
            {question.chapter?.name}
          </span>
        )}
        {question.lecture && (
          <span style={{
            padding: '4px 10px', borderRadius: 999,
            background: 'var(--bg-soft)',
            color: 'var(--fg-muted)', fontSize: 12, fontWeight: 700,
          }}>
            {question.lecture?.name}
          </span>
        )}
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
          const text = question[`choice_${letter}`] as string | null
          if (!text) return null
          const isCorrect = question.correct_answer === letter
          const wrongExpl = question[`incorrect_explanation_${letter}`] as string | null

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
              }}>
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
              {!isCorrect && wrongExpl && (
                <div style={{
                  margin: '6px 2px 0 42px',
                  fontSize: 13, fontWeight: 600, color: 'var(--primary)',
                }}>
                  {wrongExpl}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Bottom bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)',
      }}>
        <ReportButton questionId={question.id} />

        {question.explanation && (
          <button
            onClick={() => setShowExplanation(prev => !prev)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 16px', borderRadius: 11,
              border: showExplanation ? '1px solid var(--accent-green)' : '1px solid var(--border)',
              background: showExplanation
                ? 'color-mix(in srgb, var(--accent-green) 12%, var(--bg-elev))'
                : 'var(--bg-soft)',
              color: showExplanation ? 'var(--accent-green)' : 'var(--fg)',
              fontWeight: 700, fontSize: 13.5, cursor: 'pointer',
              transition: 'all .2s ease',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8h.01M12 12v4" />
            </svg>
            {showExplanation ? 'Hide Explanation' : 'Show Explanation'}
          </button>
        )}
      </div>

      {/* Explanation */}
      {showExplanation && question.explanation && (
        <div style={{ marginTop: 16 }}>
          <ExplanationRenderer content={question.explanation} />
        </div>
      )}
    </div>
  )
}