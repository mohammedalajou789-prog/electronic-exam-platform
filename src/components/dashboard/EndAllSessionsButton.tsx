'use client'
// src/components/dashboard/EndAllSessionsButton.tsx
//
// "End all" in the Continue studying card: ends every unfinished exam at once.
// Each exam is ended exactly like pressing Finish (finish_exam_attempt), one
// after the other. A popup then lists the result of each exam; closing it
// refreshes the dashboard data in place (no full page reload).

import { useCallback, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { finishAttempt } from '@/features/exam-engine/attempt-client'
import DashModal from '@/components/dashboard/DashModal'

interface OpenSession {
  attemptId: string
  title: string
  /** e.g. "Internal Medicine · Vein" */
  subtitle: string
}

interface Props {
  sessions: OpenSession[]
}

interface EndResult {
  attemptId: string
  title: string
  subtitle: string
  /** null when this exam could not be ended */
  percentage: number | null
  correct: number
  total: number
}

const stagger = (i: number): React.CSSProperties =>
  ({ ['--i' as string]: i } as React.CSSProperties)

const smallBtn: React.CSSProperties = {
  padding: '7px 12px', borderRadius: 9, fontSize: 12.5, fontWeight: 700,
  fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0,
}

export default function EndAllSessionsButton({ sessions }: Props) {
  const [confirm, setConfirm] = useState(false)
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(0)
  const [results, setResults] = useState<EndResult[] | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  async function endAll(): Promise<void> {
    setRunning(true)
    setDone(0)
    const list: EndResult[] = []
    // One after the other: the same call as Finish for every exam
    for (const s of sessions) {
      try {
        const r = await finishAttempt(s.attemptId, [], 0)
        list.push({ ...s, percentage: r.percentage, correct: r.correct, total: r.total })
      } catch (err) {
        console.error('Could not end session:', err)
        list.push({ ...s, percentage: null, correct: 0, total: 0 })
      }
      setDone(list.length)
    }
    setResults(list)
  }

  const closeResults = useCallback(() => {
    setResults(null)
    setConfirm(false)
    setRunning(false)
    // While the fresh data loads, "Updating..." is shown; then the ended
    // exams leave the list (and this button with them)
    startTransition(() => router.refresh())
  }, [router])

  if (results) {
    const failed = results.filter(r => r.percentage === null).length
    return (
      <DashModal
        open
        onClose={closeResults}
        title={`${results.length - failed} session${results.length - failed === 1 ? '' : 's'} ended`}
        subtitle={failed > 0 ? `${failed} could not be ended. Try again later.` : 'Each exam was ended like pressing Finish'}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {results.map((r, i) => (
            <div
              key={r.attemptId}
              className="a-rise"
              style={{ ...stagger(Math.min(i, 8)), display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 0', borderTop: i === 0 ? 'none' : '1px solid var(--bd)' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                <span style={{ fontSize: 13.5, fontWeight: 700 }}>{r.title}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.subtitle}</span>
              </div>
              {r.percentage === null ? (
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--clr-primary)', flexShrink: 0 }}>Not ended</span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexShrink: 0 }}>
                  <span className="dash-mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-muted)' }}>{r.correct}/{r.total}</span>
                  <b style={{ fontSize: 18, fontWeight: 800, color: 'var(--clr-primary)' }}>{r.percentage}%</b>
                </span>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={closeResults}
            className="press"
            style={{ ...smallBtn, alignSelf: 'flex-end', marginTop: 14, padding: '10px 18px', fontSize: 13.5, border: 'none', background: 'var(--clr-primary)', color: '#fff' }}
          >
            Done
          </button>
        </div>
      </DashModal>
    )
  }

  if (running || isPending) {
    return (
      <span role="status" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--fg-muted)' }}>
        {running ? `Ending ${Math.min(done + 1, sessions.length)} of ${sessions.length}...` : 'Updating...'}
      </span>
    )
  }

  if (confirm) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--fg-muted)' }}>End all {sessions.length}?</span>
        <button type="button" onClick={endAll} title="Ends every exam in this list, like pressing Finish in each" style={{ ...smallBtn, border: 'none', background: '#ef4444', color: '#fff' }}>
          Confirm
        </button>
        <button type="button" onClick={() => setConfirm(false)} style={{ ...smallBtn, border: '1px solid var(--bd)', background: 'var(--bg-soft)', color: 'var(--fg)' }}>
          Cancel
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setConfirm(true)}
      className="press"
      title="Finish every exam in this list now"
      style={{
        ...smallBtn,
        border: '1px solid color-mix(in srgb, #ef4444 35%, var(--bd))',
        background: 'color-mix(in srgb, #ef4444 8%, var(--bg-soft))',
        color: '#ef4444',
      }}
    >
      End all sessions
    </button>
  )
}