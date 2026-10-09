'use client'
// src/components/dashboard/EndSessionButton.tsx
//
// Ends an unfinished exam from the dashboard exactly like pressing Finish in the
// exam: the same database function (finish_exam_attempt) closes the attempt as
// "completed", grades it, marks seen-but-unanswered questions as skipped and
// counts the exam in "Completed exams". Answers and time were already saved
// while the student was solving, so nothing has to be sent again.
// A popup then shows the result. Closing it refreshes the dashboard data in
// place (no full page reload): the card leaves and the numbers update.

import { useCallback, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { finishAttempt, type AttemptSummary } from '@/features/exam-engine/attempt-client'
import DashModal from '@/components/dashboard/DashModal'

interface Props {
  attemptId: string
  examTitle: string
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

const stagger = (i: number): React.CSSProperties =>
  ({ ['--i' as string]: i } as React.CSSProperties)

export default function EndSessionButton({ attemptId, examTitle }: Props) {
  const [loading, setLoading] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [failed, setFailed] = useState(false)
  const [summary, setSummary] = useState<AttemptSummary | null>(null)
  const [ended, setEnded] = useState(false)
  const [, startTransition] = useTransition()
  const router = useRouter()

  async function handleEndSession(): Promise<void> {
    setLoading(true)
    setFailed(false)
    try {
      // Same call as Finish. The answers are already in the database, and the
      // saved time is kept (the database never lowers it).
      const result = await finishAttempt(attemptId, [], 0)
      setSummary(result)
    } catch (err) {
      console.error('Could not end session:', err)
      setFailed(true)
      setLoading(false)
    }
  }

  // Re-fetch the dashboard data without reloading the page: the card
  // disappears and the statistics update, the scroll position stays.
  const closeResult = useCallback(() => {
    setSummary(null)
    setEnded(true)
    startTransition(() => router.refresh())
  }, [router])

  // Shown for the moment between closing the popup and the card leaving
  if (ended) {
    return (
      <span style={{ padding: '8px 4px', fontSize: 12.5, fontWeight: 700, color: 'var(--fg-muted)', flexShrink: 0 }}>
        Ended
      </span>
    )
  }

  if (summary) {
    const tiles = [
      { label: 'Correct', value: summary.correct, color: 'var(--ok)' },
      { label: 'Wrong', value: summary.incorrect, color: 'var(--clr-primary)' },
      { label: 'Skipped', value: summary.skipped, color: 'var(--warn)' },
      { label: 'Not seen', value: summary.notSeen, color: 'var(--fg-muted)' },
    ]
    return (
      <DashModal open onClose={closeResult} title="Session ended" subtitle={examTitle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="a-rise" style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, color: 'var(--clr-primary)' }}>
              {summary.percentage}%
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-muted)' }}>
              {summary.correct} of {summary.total} correct · {formatTime(summary.timeSpentSeconds)}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            {tiles.map((t, i) => (
              <div
                key={t.label}
                className="a-rise"
                style={{ ...stagger(i + 1), padding: 14, borderRadius: 14, background: 'var(--bg-soft)', border: '1px solid var(--bd)', display: 'flex', flexDirection: 'column', gap: 6 }}
              >
                <b style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, color: t.color }}>{t.value}</b>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{t.label}</span>
              </div>
            ))}
          </div>

          {summary.examUnanswered !== null && summary.examUnanswered > 0 && (
            <p className="a-rise" style={{ ...stagger(5), margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--fg-muted)' }}>
              {summary.examUnanswered} question{summary.examUnanswered === 1 ? '' : 's'} of this exam {summary.examUnanswered === 1 ? 'is' : 'are'} still
              unanswered. Open the exam page and choose <b>Solve unanswered</b> to practise only those.
            </p>
          )}

          <button
            type="button"
            onClick={closeResult}
            className="press"
            style={{
              alignSelf: 'flex-end', padding: '10px 18px', borderRadius: 10, border: 'none',
              background: 'var(--clr-primary)', color: '#fff', fontSize: 13.5, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Done
          </button>
        </div>
      </DashModal>
    )
  }

  if (confirm) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={handleEndSession}
            disabled={loading}
            title="Ends the exam exactly like pressing Finish"
            style={{
              padding: '7px 11px', borderRadius: 9, border: 'none',
              background: '#ef4444', color: 'white',
              fontSize: 12.5, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1, fontFamily: 'inherit',
            }}
          >
            {loading ? 'Ending...' : 'Confirm'}
          </button>
          <button
            onClick={() => { setConfirm(false); setFailed(false) }}
            disabled={loading}
            style={{
              padding: '7px 10px', borderRadius: 9,
              border: '1px solid var(--bd)', background: 'var(--bg-soft)',
              color: 'var(--fg)', fontSize: 12.5, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
        </div>
        {failed && (
          <span role="alert" style={{ fontSize: 12, fontWeight: 600, color: '#ef4444' }}>
            Could not end the session. Please try again.
          </span>
        )}
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirm(true)}
      title="Finish this exam now and see your result"
      style={{
        padding: '7px 11px', borderRadius: 9,
        border: '1px solid color-mix(in srgb, #ef4444 35%, var(--bd))',
        background: 'color-mix(in srgb, #ef4444 8%, var(--bg-soft))',
        color: '#ef4444', fontSize: 12.5, fontWeight: 700,
        cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
      }}
    >
      End Session
    </button>
  )
}