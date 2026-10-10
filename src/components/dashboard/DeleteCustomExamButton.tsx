'use client'
// src/components/dashboard/DeleteCustomExamButton.tsx
//
// "Delete" on a row of "My custom exams". Deletes the exam for good
// (delete_my_custom_exam): an open attempt is ended first like pressing Finish,
// and the solved / skipped state of its questions stays as it is.
// The dashboard data is then refreshed in place (no full page reload).

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  customExamId: string
  name: string
}

const smallBtn: React.CSSProperties = {
  padding: '7px 11px', borderRadius: 9, fontSize: 12.5, fontWeight: 700,
  fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0,
}

export default function DeleteCustomExamButton({ customExamId, name }: Props) {
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  async function remove(): Promise<void> {
    setBusy(true)
    setFailed(false)
    const { error } = await createClient().rpc('delete_my_custom_exam', { p_custom_exam_id: customExamId })
    if (error) {
      console.error('Could not delete the custom exam:', error.message)
      setFailed(true)
      setBusy(false)
      return
    }
    // The row leaves when the refreshed list arrives
    startTransition(() => router.refresh())
  }

  if (busy || isPending) {
    return <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--fg-muted)', flexShrink: 0 }}>Deleting...</span>
  }

  if (confirm) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            onClick={remove}
            title={`Delete "${name}" for good. Your solved and skipped questions stay as they are.`}
            style={{ ...smallBtn, border: 'none', background: '#ef4444', color: '#fff' }}
          >
            Delete
          </button>
          <button
            type="button"
            onClick={() => { setConfirm(false); setFailed(false) }}
            style={{ ...smallBtn, border: '1px solid var(--bd)', background: 'var(--bg-soft)', color: 'var(--fg)' }}
          >
            Cancel
          </button>
        </div>
        {failed && (
          <span role="alert" style={{ fontSize: 12, fontWeight: 600, color: '#ef4444' }}>
            Could not delete. Please try again.
          </span>
        )}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setConfirm(true)}
      aria-label={`Delete ${name}`}
      title="Delete this exam"
      className="press"
      style={{
        ...smallBtn, padding: 7, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        border: '1px solid color-mix(in srgb, #ef4444 35%, var(--bd))',
        background: 'color-mix(in srgb, #ef4444 8%, var(--bg-soft))', color: '#ef4444',
      }}
    >
      <Trash2 size={15} />
    </button>
  )
}