'use client'

// src/components/dashboard/SubjectProgressList.tsx
//
// "Progress by subject" on the dashboard: one row per subject with its first-try
// accuracy, inside the dark panel (same colors as "Overall accuracy"). Clicking a
// subject opens a popup with the details (solved / skipped / not solved yet out
// of all its questions).

import { useCallback, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import DashModal from '@/components/dashboard/DashModal'

export interface SubjectProgress {
  name: string
  /** First-try accuracy, 0-100 */
  pct: number
  /** Solved questions whose first answer was right */
  correct: number
  total: number
  solved: number
  skipped: number
  unsolved: number
}

interface Props {
  subjects: SubjectProgress[]
}

/** Colors for the rows on the dark panel (bright enough to read on it) */
function rowColor(pct: number): string {
  if (pct >= 70) return 'var(--sp-high)'
  if (pct >= 40) return 'var(--sp-mid)'
  return 'var(--sp-low)'
}

/** Colors for the popup (light card, follows the theme) */
function perfColor(pct: number): string {
  if (pct >= 70) return 'var(--perf-high)'
  if (pct >= 40) return 'var(--perf-mid)'
  return 'var(--perf-low)'
}

const stagger = (i: number): React.CSSProperties =>
  ({ ['--i' as string]: i } as React.CSSProperties)

const LIST_CSS = `
  .sp-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 380px), 1fr)); gap: 6px 28px; }
  .sp-row {
    display: grid; grid-template-columns: minmax(90px, 150px) minmax(0, 1fr) 52px 18px; align-items: center; gap: 14px;
    width: 100%; padding: 12px 12px; border-radius: 12px; border: 1px solid transparent; background: transparent;
    color: var(--panel-dark-fg); font: inherit; text-align: left; cursor: pointer;
    transition: background-color var(--dur-2), border-color var(--dur-2);
  }
  .sp-row:hover { background: color-mix(in srgb, var(--panel-dark-fg) 7%, transparent); border-color: var(--panel-dark-bd); }
  .sp-row:focus-visible { outline: 2px solid var(--panel-accent); outline-offset: 2px; }
  .sp-name { font-size: 14px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sp-track { position: relative; height: 12px; border-radius: 999px; background: color-mix(in srgb, var(--panel-dark-fg) 12%, transparent); overflow: hidden; }
  .sp-mark { position: absolute; top: 0; bottom: 0; width: 1px; background: color-mix(in srgb, var(--panel-dark-fg) 24%, transparent); }
  .sp-fill { position: relative; height: 100%; border-radius: 999px; }
  .sp-pct { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 13.5px; font-weight: 600; text-align: right; }
  .sp-go { color: var(--panel-dark-mut); }

  .sp-detail-num { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .sp-tile { padding: 14px; border-radius: 14px; background: var(--bg-soft); border: 1px solid var(--bd); display: flex; flex-direction: column; gap: 6px; }
  .sp-tile b { font-size: 26px; font-weight: 800; letter-spacing: -0.03em; line-height: 1; }
  .sp-tile span { font-size: 12px; font-weight: 700; color: var(--fg-muted); text-transform: uppercase; letter-spacing: .06em; }
  .sp-split { display: flex; height: 10px; border-radius: 999px; overflow: hidden; background: var(--track); gap: 2px; }
  .sp-split i { display: block; height: 100%; }
  .sp-legend { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 12px; font-weight: 700; color: var(--fg-muted); }
  .sp-legend span { display: inline-flex; align-items: center; gap: 6px; }
  .sp-legend span::before { content: ''; width: 8px; height: 8px; border-radius: 50%; background: var(--dot); }

  @media (max-width: 640px) {
    .sp-row { grid-template-columns: minmax(70px, 110px) minmax(0, 1fr) 46px 14px; gap: 10px; padding: 10px 6px; }
  }
`

export default function SubjectProgressList({ subjects }: Props) {
  const [selected, setSelected] = useState<SubjectProgress | null>(null)
  const close = useCallback(() => setSelected(null), [])

  const share = (n: number, s: SubjectProgress): string => (s.total > 0 ? `${(n / s.total) * 100}%` : '0%')

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: LIST_CSS }} />
      <div className="sp-list">
        {subjects.map((s, i) => {
          const color = rowColor(s.pct)
          return (
            <button
              key={s.name}
              type="button"
              className="sp-row a-rise"
              style={stagger(Math.min(i, 10))}
              onClick={() => setSelected(s)}
              title="Show details"
            >
              <span className="sp-name">{s.name}</span>
              <span className="sp-track">
                <span className="sp-mark" style={{ left: '40%' }} />
                <span className="sp-mark" style={{ left: '70%' }} />
                <span className="sp-fill a-grow" style={{ ...stagger(Math.min(i, 10)), display: 'block', width: `${s.pct}%`, background: color }} />
              </span>
              <span className="sp-pct" style={{ color }}>{s.pct}%</span>
              <ChevronRight size={16} className="sp-go" />
            </button>
          )
        })}
      </div>

      <DashModal
        open={selected !== null}
        onClose={close}
        title={selected?.name ?? ''}
        subtitle={selected ? `${selected.total.toLocaleString()} questions in this subject` : undefined}
      >
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="a-rise" style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, color: perfColor(selected.pct) }}>
                {selected.pct}%
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-muted)' }}>accuracy on the first try</span>
            </div>

            <div className="a-rise" style={{ ...stagger(1), display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="sp-split" aria-hidden="true">
                <i className="a-grow" style={{ width: share(selected.solved, selected), background: 'var(--clr-primary)' }} />
                <i className="a-grow" style={{ width: share(selected.skipped, selected), background: 'var(--warn)' }} />
              </div>
              <div className="sp-legend">
                <span style={{ ['--dot' as string]: 'var(--clr-primary)' } as React.CSSProperties}>{selected.solved} solved</span>
                <span style={{ ['--dot' as string]: 'var(--warn)' } as React.CSSProperties}>{selected.skipped} skipped</span>
                <span style={{ ['--dot' as string]: 'var(--track)' } as React.CSSProperties}>{selected.unsolved} not solved yet</span>
              </div>
            </div>

            <div className="sp-detail-num">
              {[
                { label: 'Solved', value: selected.solved },
                { label: 'Skipped', value: selected.skipped },
                { label: 'Not solved yet', value: selected.unsolved },
                { label: 'All questions', value: selected.total },
              ].map((t, i) => (
                <div key={t.label} className="sp-tile a-rise" style={stagger(i + 2)}>
                  <b>{t.value.toLocaleString()}</b>
                  <span>{t.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </DashModal>
    </>
  )
}