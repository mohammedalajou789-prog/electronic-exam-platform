'use client'
// src/components/search/SearchResults.tsx
//
// Displays search results grouped by subject.
// Each subject is an accordion — click to expand and see questions.
// Each question shows full answer + metadata + a "Go to Exam" button.

import { useState } from 'react'
import Link from 'next/link'

interface Props {
  results: any[]
  total:   number
  query:   string
}

// Highlight matching terms in text
function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (!text) return null
  let result = text
  // Build a regex that matches any of the terms (case-insensitive)
  const escaped = terms
    .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .filter(t => t.length >= 2)
    .join('|')
  if (!escaped) return <>{text}</>

  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
  return (
    <>
      {parts.map((part, i) => {
        const isMatch = terms.some(t => part.toLowerCase() === t.toLowerCase())
        return isMatch
          ? <mark key={i} style={{ background: 'color-mix(in srgb, var(--clr-primary) 18%, transparent)', color: 'var(--clr-primary)', borderRadius: 3, padding: '0 1px' }}>{part}</mark>
          : <span key={i}>{part}</span>
      })}
    </>
  )
}

export default function SearchResults({ results, total, query }: Props) {
  const terms = query.split('+').map(t => t.trim()).filter(t => t.length >= 2)

  // Group results by subject name
  const grouped: Record<string, { subjectName: string; questions: any[] }> = {}
  for (const q of results) {
    const subjectName = q.exam?.batch?.subject?.name ?? 'Other'
    if (!grouped[subjectName]) grouped[subjectName] = { subjectName, questions: [] }
    grouped[subjectName].questions.push(q)
  }
  const groups = Object.values(grouped).sort((a, b) => b.questions.length - a.questions.length)

  // Track which subjects are expanded
  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    // Auto-expand first group
    groups.length > 0 ? { [groups[0].subjectName]: true } : {}
  )

  function toggle(name: string) {
    setExpanded(prev => ({ ...prev, [name]: !prev[name] }))
  }

  return (
    <div>
      {/* Summary */}
      <div style={{ marginBottom: 16, fontSize: 13.5, color: 'var(--fg-muted)', fontWeight: 600 }}>
        {total} question{total !== 1 ? 's' : ''} found across {groups.length} subject{groups.length !== 1 ? 's' : ''}
      </div>

      {/* Subject groups */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {groups.map(group => (
          <div key={group.subjectName} style={{
            border: '1px solid var(--bd)', borderRadius: 16,
            background: 'var(--bg-elev)', overflow: 'hidden',
          }}>
            {/* Subject header — clickable */}
            <button
              onClick={() => toggle(group.subjectName)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', padding: '16px 20px',
                background: 'transparent', border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--fg)' }}>
                  {group.subjectName}
                </span>
                <span style={{
                  fontSize: 12, fontWeight: 700, padding: '3px 10px',
                  borderRadius: 999,
                  background: 'color-mix(in srgb, var(--clr-primary) 12%, var(--bg-soft))',
                  color: 'var(--clr-primary)',
                }}>
                  {group.questions.length} question{group.questions.length !== 1 ? 's' : ''}
                </span>
              </div>
              <svg
                width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="var(--fg-muted)" strokeWidth="2.5" strokeLinecap="round"
                style={{
                  flexShrink: 0,
                  transform: expanded[group.subjectName] ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform .2s ease',
                }}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {/* Questions list */}
            {expanded[group.subjectName] && (
              <div style={{ borderTop: '1px solid var(--bd)' }}>
                {group.questions.map((q: any, index: number) => {
                  const exam    = q.exam
                  const batch   = exam?.batch
                  const choices = [
                    { key: 'a', text: q.choice_a },
                    { key: 'b', text: q.choice_b },
                    { key: 'c', text: q.choice_c },
                    { key: 'd', text: q.choice_d },
                    { key: 'e', text: q.choice_e },
                  ].filter(c => !!c.text)

                  // Build exam prep URL
                  // We use the exam id — the prep page handles the routing
                  const examUrl = exam?.id ? `/search/go?exam_id=${exam.id}` : null

                  return (
                    <div
                      key={q.id}
                      style={{
                        padding: '18px 20px',
                        borderBottom: index < group.questions.length - 1
                          ? '1px solid var(--bd)' : 'none',
                      }}
                    >
                      {/* Question meta */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                        <span style={{
                          width: 24, height: 24, borderRadius: 7, flexShrink: 0,
                          background: 'var(--clr-soft)', color: 'var(--clr-primary)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11.5, fontWeight: 800,
                        }}>
                          {q.question_order ?? index + 1}
                        </span>
                        {q.chapter && (
                          <span style={{
                            padding: '2px 9px', borderRadius: 999, fontSize: 11.5, fontWeight: 700,
                            background: 'color-mix(in srgb, #60a5fa 14%, var(--bg-soft))',
                            color: '#2563eb',
                          }}>
                            <Highlight text={q.chapter} terms={terms} />
                          </span>
                        )}
                        {q.lecture && (
                          <span style={{
                            padding: '2px 9px', borderRadius: 999, fontSize: 11.5, fontWeight: 700,
                            background: 'var(--bg-soft)', color: 'var(--fg-muted)',
                          }}>
                            <Highlight text={q.lecture} terms={terms} />
                          </span>
                        )}
                      </div>

                      {/* Question text */}
                      <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.6, marginBottom: 12, color: 'var(--fg)' }}>
                        <Highlight text={q.question_text} terms={terms} />
                      </div>

                      {/* Choices */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                        {choices.map(opt => {
                          const isCorrect = opt.key === q.correct_answer
                          return (
                            <div key={opt.key} style={{
                              display: 'flex', alignItems: 'center', gap: 9,
                              padding: '9px 12px', borderRadius: 10,
                              border: isCorrect ? '1.5px solid #4ade80' : '1px solid var(--bd)',
                              background: isCorrect
                                ? 'color-mix(in srgb, #4ade80 10%, var(--bg-soft))'
                                : 'var(--bg-soft)',
                              opacity: isCorrect ? 1 : 0.6,
                            }}>
                              <span style={{
                                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 11, fontWeight: 800,
                                background: isCorrect ? '#4ade80' : 'var(--bg-elev)',
                                color: isCorrect ? 'white' : 'var(--fg-muted)',
                                border: isCorrect ? 'none' : '1px solid var(--bd)',
                              }}>
                                {isCorrect ? '✓' : opt.key.toUpperCase()}
                              </span>
                              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--fg)' }}>
                                <Highlight text={opt.text!} terms={terms} />
                              </span>
                            </div>
                          )
                        })}
                      </div>

                      {/* Footer: metadata + Go to Exam button */}
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        flexWrap: 'wrap', gap: 10,
                        paddingTop: 10, borderTop: '1px solid var(--bd)',
                      }}>
                        {/* Metadata */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 12, color: 'var(--fg-muted)', fontWeight: 600 }}>
                          {exam?.title && (
                            <span style={{ padding: '2px 8px', borderRadius: 6, background: 'var(--bg-soft)', border: '1px solid var(--bd)' }}>
                              📋 {exam.title}
                            </span>
                          )}
                          {batch?.name && (
                            <span style={{ padding: '2px 8px', borderRadius: 6, background: 'var(--bg-soft)', border: '1px solid var(--bd)' }}>
                              🎓 {batch.name}
                            </span>
                          )}
                          {exam?.calendar_year && (
                            <span style={{ padding: '2px 8px', borderRadius: 6, background: 'var(--bg-soft)', border: '1px solid var(--bd)' }}>
                              📅 {exam.calendar_year}
                            </span>
                          )}
                          {q.question_order && (
                            <span style={{ padding: '2px 8px', borderRadius: 6, background: 'var(--bg-soft)', border: '1px solid var(--bd)' }}>
                              Q{q.question_order}
                            </span>
                          )}
                        </div>

                        {/* Go to Exam button */}
                        {examUrl && (
                          <Link
                            href={examUrl}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 6,
                              padding: '7px 14px', borderRadius: 9,
                              border: '1px solid var(--bd)',
                              background: 'var(--bg-soft)', color: 'var(--fg)',
                              fontSize: 12.5, fontWeight: 700, textDecoration: 'none',
                              flexShrink: 0,
                            }}
                          >
                            Go to Exam
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                              <path d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                          </Link>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}