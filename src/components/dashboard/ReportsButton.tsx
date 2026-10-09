'use client'

// src/components/dashboard/ReportsButton.tsx
//
// "My reports" button on the dashboard. The student's recent question reports
// open in a popup instead of taking a card on the page.

import { useCallback, useState } from 'react'
import { Flag } from 'lucide-react'
import DashModal from '@/components/dashboard/DashModal'

export interface DashboardReport {
  id: string
  category: string
  status: string
  created_at: string
}

interface Props {
  reports: DashboardReport[]
}

const REPORT_TONE: Record<string, { bg: string; fg: string; label: string }> = {
  resolved:     { bg: 'var(--tone-green-bg)', fg: 'var(--tone-green-fg)', label: 'Resolved'    },
  under_review: { bg: 'var(--tone-navy-bg)',  fg: 'var(--tone-navy-fg)',  label: 'In progress' },
  new:          { bg: 'var(--tone-amber-bg)', fg: 'var(--tone-amber-fg)', label: 'New'         },
  rejected:     { bg: 'var(--bg-soft)',       fg: 'var(--fg-muted)',      label: 'Rejected'    },
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const stagger = (i: number): React.CSSProperties =>
  ({ ['--i' as string]: i } as React.CSSProperties)

export default function ReportsButton({ reports }: Props) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const openCount = reports.filter(r => r.status === 'new' || r.status === 'under_review').length

  return (
    <>
      <button type="button" className="dash-btn dash-btn-ghost press" onClick={() => setOpen(true)}>
        <Flag size={15} strokeWidth={2.2} />
        My reports
        {openCount > 0 && <span className="dash-btn-count">{openCount}</span>}
      </button>

      <DashModal
        open={open}
        onClose={close}
        title="My reports"
        subtitle={reports.length > 0 ? 'Questions you reported, newest first' : undefined}
      >
        {reports.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 13.5, color: 'var(--fg-muted)' }}>
            You haven&apos;t reported any questions yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {reports.map((r, i) => {
              const tone = REPORT_TONE[r.status] ?? REPORT_TONE.new
              return (
                <div
                  key={r.id}
                  className="a-rise"
                  style={{ ...stagger(Math.min(i, 8)), display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '13px 0', borderTop: i === 0 ? 'none' : '1px solid var(--bd)' }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700, textTransform: 'capitalize' }}>{r.category.replace(/_/g, ' ')}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-muted)' }}>{formatDate(r.created_at)}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: tone.bg, color: tone.fg, flexShrink: 0 }}>
                    {tone.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </DashModal>
    </>
  )
}