'use client'
// src/components/dashboard/EndSessionButton.tsx
//
// Ends an unfinished exam from the dashboard:
//   1. The open attempt is closed on the server ("abandoned").
//      Answers the student already gave still count in their statistics.
//   2. The saved position is removed, so the card disappears from the list.

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { abandonAttempt } from '@/features/exam-engine/attempt-client'

interface Props {
  progressId: string
  examId: string
  userId: string
}

export default function EndSessionButton({ progressId, examId, userId }: Props) {
  const [loading, setLoading] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [failed, setFailed] = useState(false)

  async function handleEndSession(): Promise<void> {
    setLoading(true)
    setFailed(false)
    try {
      await abandonAttempt({ examId, customExamId: null })

      const supabase = createClient()
      const { error } = await supabase
        .from('study_progress')
        .delete()
        .eq('id', progressId)
        .eq('user_id', userId)
      if (error) throw new Error(error.message)

      // Reload the page so the card disappears
      window.location.reload()
    } catch (err) {
      console.error('Could not end session:', err)
      setFailed(true)
      setLoading(false)
    }
  }

  if (confirm) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={handleEndSession}
            disabled={loading}
            title="Your answers so far still count in your statistics"
            style={{
              padding: '8px 13px', borderRadius: 10, border: 'none',
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
              padding: '8px 10px', borderRadius: 10,
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
      style={{
        padding: '8px 13px', borderRadius: 10,
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