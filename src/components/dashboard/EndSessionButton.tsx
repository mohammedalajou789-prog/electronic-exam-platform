'use client'
// src/components/dashboard/EndSessionButton.tsx
//
// Deletes a study_progress row — equivalent to pressing "Finish" on the exam.
// After deletion the page reloads so the card disappears from the list.

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  progressId: string
  examId: string
  userId: string
}

export default function EndSessionButton({ progressId, examId, userId }: Props) {
  const [loading, setLoading]     = useState(false)
  const [confirm, setConfirm]     = useState(false)

  async function handleEndSession() {
    setLoading(true)
    const supabase = createClient()
    await supabase
      .from('study_progress')
      .delete()
      .eq('id', progressId)
      .eq('user_id', userId)

    // Reload the page so the card disappears
    window.location.reload()
  }

  if (confirm) {
    return (
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={handleEndSession}
          disabled={loading}
          style={{
            padding: '8px 13px', borderRadius: 10, border: 'none',
            background: '#ef4444', color: 'white',
            fontSize: 12.5, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1, fontFamily: 'inherit',
          }}
        >
          {loading ? '...' : 'Confirm'}
        </button>
        <button
          onClick={() => setConfirm(false)}
          style={{
            padding: '8px 10px', borderRadius: 10,
            border: '1px solid var(--bd)', background: 'var(--bg-soft)',
            color: 'var(--fg)', fontSize: 12.5, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Cancel
        </button>
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