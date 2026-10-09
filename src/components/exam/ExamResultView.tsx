'use client'

// src/components/exam/ExamResultView.tsx
//
// The result screen shown after the student presses Finish (rendered by
// InteractiveExam). It only displays what it is given: every number comes from
// the exam screen, and saving happens there. The design comes from the old
// /results page (removed on 9 Oct 2026, it was never linked).

import { useEffect, useState } from 'react'
import {
  ArrowLeft, Eye, RotateCcw, Check, X, Minus, EyeOff, Timer, CircleDashed,
  Trophy, ThumbsUp, BookOpen, Dumbbell, Loader2,
} from 'lucide-react'

const RADIUS = 86
const CIRC = 2 * Math.PI * RADIUS

/** Stagger index for the shared animation classes in globals.css */
const stagger = (i: number): React.CSSProperties =>
  ({ ['--i' as string]: i } as React.CSSProperties)

// ── Styles ─────────────────────────────────────────────────────────────────────

const RESULTS_CSS = `
  .rs { min-height: 100vh; background: var(--bg); color: var(--fg); font-family: "Plus Jakarta Sans", system-ui, sans-serif; }
  .rs-wrap { max-width: 1040px; margin: 0 auto; padding: 0 24px; }

  /* Top bar */
  .rs-bar { position: sticky; top: 0; z-index: 40; background: color-mix(in srgb, var(--bg-elev) 88%, transparent); border-bottom: 1px solid var(--bd); backdrop-filter: blur(12px); }
  .rs-bar-in { display: flex; align-items: center; gap: 14px; padding-top: 12px; padding-bottom: 12px; }
  .rs-back {
    width: 40px; height: 40px; flex-shrink: 0; border-radius: 12px; border: 1px solid var(--bd); background: var(--bg-soft); color: var(--fg);
    display: flex; align-items: center; justify-content: center; cursor: pointer;
  }
  .rs-back:hover { border-color: var(--bd-strong); }
  .rs-bar-text { min-width: 0; flex: 1 1 auto; }
  .rs-bar-kicker { font-size: 12px; font-weight: 700; color: var(--fg-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rs-bar-title { font-size: 16px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .rs-main { display: flex; flex-direction: column; gap: 20px; padding-top: 32px; padding-bottom: 80px; }

  /* ── Score hero ── */
  .rs-hero {
    position: relative; overflow: hidden; isolation: isolate;
    display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 40px; align-items: center;
    padding: 36px; border-radius: 28px; background: var(--bg-elev); border: 1px solid var(--bd);
    box-shadow: 0 24px 60px var(--shadow);
  }
  .rs-hero::before {
    content: ''; position: absolute; z-index: -1; top: -200px; left: -160px; width: 560px; height: 560px; border-radius: 50%;
    background: radial-gradient(circle, color-mix(in srgb, var(--tone) 16%, transparent), transparent 68%);
  }
  .rs-hero::after {
    content: ''; position: absolute; z-index: -1; inset: 0; pointer-events: none;
    background-image: radial-gradient(color-mix(in srgb, var(--tone) 12%, transparent) 1px, transparent 1px);
    background-size: 24px 24px;
    -webkit-mask-image: radial-gradient(60% 80% at 0% 50%, #000, transparent 70%);
            mask-image: radial-gradient(60% 80% at 0% 50%, #000, transparent 70%);
  }

  .rs-gauge { position: relative; width: 200px; height: 200px; }
  .rs-gauge svg { display: block; }
  .rs-gauge-val { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; }
  .rs-gauge-val b { font-size: 50px; font-weight: 800; letter-spacing: -0.05em; line-height: 1; }
  .rs-gauge-val b small { font-size: 24px; letter-spacing: -0.02em; }
  .rs-gauge-val span { font-size: 12.5px; font-weight: 700; color: var(--fg-muted); }

  .rs-verdict { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
  .rs-grade {
    align-self: flex-start; display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px 6px 6px; border-radius: 999px;
    background: color-mix(in srgb, var(--tone) 12%, var(--bg-elev)); color: var(--tone);
    font-size: 12px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase;
  }
  .rs-grade i { width: 26px; height: 26px; border-radius: 50%; background: var(--tone); color: #fff; display: inline-flex; align-items: center; justify-content: center; }
  .rs-h1 { margin: 0; font-size: clamp(30px, 4vw, 44px); font-weight: 800; letter-spacing: -0.04em; line-height: 1.05; }
  .rs-summary { margin: 0; font-size: 15.5px; line-height: 1.6; color: var(--fg-muted); }
  .rs-summary b { color: var(--fg); }

  /* stacked answer bar */
  .rs-split { display: flex; flex-direction: column; gap: 8px; }
  .rs-split-bar { display: flex; height: 10px; border-radius: 999px; overflow: hidden; background: var(--track); gap: 2px; }
  .rs-split-bar i { display: block; height: 100%; transition: width .8s var(--ease-out); }
  .rs-split-legend { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 12px; font-weight: 700; color: var(--fg-muted); }
  .rs-split-legend span { display: inline-flex; align-items: center; gap: 6px; }
  .rs-split-legend span::before { content: ''; width: 8px; height: 8px; border-radius: 50%; background: var(--dot); }

  .rs-actions { display: flex; flex-wrap: wrap; gap: 10px; padding-top: 6px; }
  .rs-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 46px; padding: 0 20px; border-radius: 13px;
    font: inherit; font-size: 14px; font-weight: 800; cursor: pointer; white-space: nowrap; border: 1px solid var(--bd);
    background: var(--bg-elev); color: var(--fg);
  }
  .rs-btn:hover { border-color: var(--bd-strong); }
  .rs-btn-solid { background: var(--clr-primary); border-color: var(--clr-primary); color: #fff; box-shadow: 0 10px 24px var(--clr-glow); }
  .rs-btn-solid:hover { border-color: var(--clr-primary); }
  .rs-btn-ghost { background: transparent; border-color: transparent; color: var(--fg-muted); }
  .rs-btn-ghost:hover { color: var(--fg); background: var(--bg-soft); border-color: var(--bd); }
  .rs-btn-blue { background: color-mix(in srgb, var(--accent-blue) 12%, var(--bg-elev)); border-color: color-mix(in srgb, var(--accent-blue) 45%, var(--bd)); color: var(--accent-blue); }
  .rs-btn-blue:hover { border-color: var(--accent-blue); }
  .rs-btn:disabled { opacity: .7; cursor: not-allowed; }

  /* Saving the result */
  .rs-note { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 12px 16px; border-radius: 14px; font-size: 13.5px; font-weight: 700; }
  .rs-note-saving { background: color-mix(in srgb, var(--accent-blue) 12%, var(--bg-elev)); border: 1px solid var(--accent-blue); color: var(--accent-blue); }
  .rs-note-error { background: color-mix(in srgb, var(--clr-primary) 12%, var(--bg-elev)); border: 1px solid var(--clr-primary); color: var(--clr-primary); }
  .rs-note span { display: inline-flex; align-items: center; gap: 8px; }

  /* ── Stat tiles ── */
  .rs-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
  .rs-stat {
    display: flex; flex-direction: column; gap: 14px; padding: 18px; border-radius: 20px;
    background: var(--bg-elev); border: 1px solid var(--bd);
  }
  .rs-stat-ic { width: 34px; height: 34px; border-radius: 11px; display: inline-flex; align-items: center; justify-content: center; background: var(--ic-bg); color: var(--ic-fg); }
  .rs-stat-val { font-size: 30px; font-weight: 800; letter-spacing: -0.04em; line-height: 1; font-variant-numeric: tabular-nums; }
  .rs-stat-lbl { display: flex; flex-direction: column; gap: 2px; }
  .rs-stat-lbl b { font-size: 12px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--fg-2); }
  .rs-stat-lbl span { font-size: 12px; font-weight: 600; color: var(--fg-muted); }

  /* ── Chapters ── */
  .rs-card { padding: 26px; border-radius: 24px; background: var(--bg-elev); border: 1px solid var(--bd); }
  .rs-card-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 20px; }
  .rs-card-title { margin: 0; font-size: 19px; font-weight: 800; letter-spacing: -0.02em; }
  .rs-card-note { font-size: 12.5px; font-weight: 600; color: var(--fg-muted); }
  .rs-chapters { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px 36px; }
  .rs-ch { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
  .rs-ch-top { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
  .rs-ch-name { font-size: 14px; font-weight: 700; line-height: 1.35; min-width: 0; overflow-wrap: anywhere; }
  .rs-ch-score { flex-shrink: 0; display: inline-flex; align-items: baseline; gap: 8px; font-size: 12.5px; font-weight: 700; color: var(--fg-muted); }
  .rs-ch-score b { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 13px; font-weight: 600; color: var(--c); }
  .rs-ch-track { height: 8px; border-radius: 999px; background: var(--track); overflow: hidden; }
  .rs-ch-track i { display: block; height: 100%; border-radius: 999px; background: var(--c); transition: width .7s var(--ease-out); }
  .rs-ch-flag { align-self: flex-start; font-size: 11px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--clr-ink); background: var(--clr-soft); padding: 2px 8px; border-radius: 999px; }

  .rs-loading { display: flex; height: 60vh; align-items: center; justify-content: center; color: var(--fg-muted); font-family: "Plus Jakarta Sans", system-ui, sans-serif; font-weight: 600; }

  /* ── Responsive ── */
  @media (max-width: 860px) {
    .rs-hero { grid-template-columns: minmax(0, 1fr); justify-items: center; text-align: center; gap: 24px; padding: 28px 22px; }
    .rs-hero::after { -webkit-mask-image: radial-gradient(70% 50% at 50% 0%, #000, transparent 70%); mask-image: radial-gradient(70% 50% at 50% 0%, #000, transparent 70%); }
    .rs-verdict { align-items: center; width: 100%; }
    .rs-grade { align-self: center; }
    .rs-split { width: 100%; }
    .rs-split-legend { justify-content: center; }
    .rs-actions { width: 100%; justify-content: center; }
    .rs-chapters { grid-template-columns: minmax(0, 1fr); }
  }
  @media (max-width: 560px) {
    .rs-wrap { padding: 0 16px; }
    .rs-main { padding-top: 18px; padding-bottom: 56px; gap: 14px; }
    .rs-hero { padding: 24px 16px; border-radius: 24px; }
    .rs-gauge { width: 170px; height: 170px; }
    .rs-gauge svg { width: 170px; height: 170px; }
    .rs-gauge-val b { font-size: 42px; }
    .rs-gauge-val span { font-size: 11.5px; }
    .rs-summary { font-size: 14.5px; }
    .rs-actions { flex-direction: column; }
    .rs-actions .rs-btn { width: 100%; }
    .rs-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .rs-stat:last-child { grid-column: 1 / -1; }
    .rs-stat { padding: 14px; gap: 10px; border-radius: 18px; }
    .rs-stat-val { font-size: 24px; }
    .rs-card { padding: 18px; border-radius: 20px; }
  }
`

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ChapterResult {
  name: string
  correct: number
  total: number
}

interface Props {
  examTitle: string
  /** Small line above the title, e.g. "Internal Medicine · Hayat · Results" */
  kicker: string
  total: number
  correct: number
  wrong: number
  /** Seen but not answered */
  skipped: number
  /** Never shown on screen */
  notSeen: number
  timeSeconds: number
  suggestedSeconds: number
  chapters: ChapterResult[]
  /** Questions of this exam never answered in any attempt (null = no button) */
  unansweredCount: number | null
  isSaving: boolean
  saveError: boolean
  onRetrySave: () => void
  onReview: () => void
  onRetake: () => void
  onSolveUnanswered: () => void
  onExit: () => void
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function ExamResultView({
  examTitle,
  kicker,
  total,
  correct,
  wrong,
  skipped,
  notSeen,
  timeSeconds,
  suggestedSeconds,
  chapters,
  unansweredCount,
  isSaving,
  saveError,
  onRetrySave,
  onReview,
  onRetake,
  onSolveUnanswered,
  onExit,
}: Props) {
  // Bars and the gauge grow in shortly after the screen appears
  const [animated, setAnimated] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 120)
    return () => clearTimeout(t)
  }, [])

  const answered = correct + wrong
  // Same score as the one saved on the attempt: right answers out of all questions
  const scorePct = total > 0 ? Math.round((correct / total) * 100) : 0
  const gaugeOffset = animated ? CIRC - (scorePct / 100) * CIRC : CIRC

  // Tone + verdict by score band
  const band =
    scorePct >= 80 ? { tone: 'var(--ok)',          grade: 'Excellent',      title: 'Excellent work!',  Icon: Trophy }   :
    scorePct >= 60 ? { tone: 'var(--accent-blue)', grade: 'Good',           title: 'Good job!',        Icon: ThumbsUp } :
    scorePct >= 40 ? { tone: 'var(--warn)',        grade: 'Getting there',  title: 'Keep going!',      Icon: BookOpen } :
                     { tone: 'var(--clr-primary)', grade: 'Needs practice', title: 'Keep practicing!', Icon: Dumbbell }

  // Weakest chapters first
  const chapterRows = chapters
    .filter(c => c.total > 0)
    .map(c => ({ ...c, pct: Math.round((c.correct / c.total) * 100) }))
    .sort((a, b) => a.pct - b.pct)

  const barColor = (pct: number): string =>
    pct >= 80 ? 'var(--ok)' : pct >= 50 ? 'var(--accent-blue)' : pct >= 40 ? 'var(--warn)' : 'var(--clr-primary)'

  const perQuestion = answered > 0 ? Math.round(timeSeconds / answered) : 0
  const share = (n: number): string => (total > 0 && animated ? `${(n / total) * 100}%` : '0%')
  const withinTime = timeSeconds <= suggestedSeconds

  const stats = [
    { label: 'Correct', sub: total ? `${Math.round((correct / total) * 100)}% of all questions` : '-', value: correct, Icon: Check, bg: 'var(--ok-soft)', fg: 'var(--ok-ink)' },
    { label: 'Wrong', sub: wrong > 0 ? 'Worth a second look' : 'No mistakes', value: wrong, Icon: X, bg: 'var(--clr-soft)', fg: 'var(--clr-primary)' },
    { label: 'Skipped', sub: skipped > 0 ? 'Seen, not answered' : 'Nothing skipped', value: skipped, Icon: Minus, bg: 'var(--bg-soft)', fg: 'var(--fg-muted)' },
    { label: 'Not seen', sub: notSeen > 0 ? 'Never opened' : 'You saw every question', value: notSeen, Icon: EyeOff, bg: 'var(--bg-soft)', fg: 'var(--fg-muted)' },
    {
      label: 'Time',
      sub: `${Math.round(suggestedSeconds / 60)} min suggested${answered > 0 ? ` · ~${formatTime(perQuestion)} per answer` : ''}`,
      value: formatTime(timeSeconds),
      Icon: Timer,
      bg: withinTime ? 'color-mix(in srgb, var(--accent-blue) 14%, var(--bg-elev))' : 'var(--clr-soft)',
      fg: withinTime ? 'var(--accent-blue)' : 'var(--clr-primary)',
    },
  ]

  const showUnanswered = unansweredCount !== null && unansweredCount > 0

  return (
    <div className="rs" style={{ ['--tone' as string]: band.tone } as React.CSSProperties}>
      {/* dangerouslySetInnerHTML keeps quotes and '>' in the CSS unescaped */}
      <style dangerouslySetInnerHTML={{ __html: RESULTS_CSS }} />

      {/* ── Top bar ─────────────────────────────────────────────── */}
      <header className="rs-bar">
        <div className="rs-wrap rs-bar-in">
          <button type="button" onClick={onExit} className="rs-back press" aria-label="Back to exam page">
            <ArrowLeft size={18} strokeWidth={2.2} />
          </button>
          <div className="rs-bar-text">
            <div className="rs-bar-kicker">{kicker}</div>
            <div className="rs-bar-title">{examTitle}</div>
          </div>
        </div>
      </header>

      <main className="rs-wrap rs-main">

        {/* ── Score hero ──────────────────────────────────────────── */}
        <section className="rs-hero a-pop">
          <div className="rs-gauge">
            <svg width="200" height="200" viewBox="0 0 200 200" aria-hidden="true">
              <circle cx="100" cy="100" r={RADIUS} fill="none" stroke="var(--track)" strokeWidth="16" />
              <circle
                cx="100" cy="100" r={RADIUS} fill="none" stroke={band.tone} strokeWidth="16" strokeLinecap="round"
                transform="rotate(-90 100 100)"
                style={{ strokeDasharray: CIRC, strokeDashoffset: gaugeOffset, transition: 'stroke-dashoffset 1.1s var(--ease-out)' }}
              />
            </svg>
            <div className="rs-gauge-val">
              <b>{scorePct}<small>%</small></b>
              <span>{correct}/{total} correct</span>
            </div>
          </div>

          <div className="rs-verdict">
            <span className="rs-grade a-rise" style={stagger(1)}>
              <i><band.Icon size={14} strokeWidth={2.4} /></i>
              {band.grade}
            </span>
            <h1 className="rs-h1 a-rise" style={stagger(2)}>{band.title}</h1>
            <p className="rs-summary a-rise" style={stagger(3)}>
              You got <b>{correct}</b> of <b>{total}</b> questions right in <b>{formatTime(timeSeconds)}</b>
              {skipped > 0 ? <>, skipped <b>{skipped}</b></> : null}
              {notSeen > 0 ? <> and did not reach <b>{notSeen}</b></> : null}.
            </p>

            <div className="rs-split a-rise" style={stagger(4)}>
              <div className="rs-split-bar" aria-hidden="true">
                <i style={{ width: share(correct), background: 'var(--ok)' }} />
                <i style={{ width: share(wrong), background: 'var(--clr-primary)' }} />
                <i style={{ width: share(skipped), background: 'var(--warn)' }} />
                <i style={{ width: share(notSeen), background: 'var(--bd-strong)' }} />
              </div>
              <div className="rs-split-legend">
                <span style={{ ['--dot' as string]: 'var(--ok)' } as React.CSSProperties}>{correct} correct</span>
                <span style={{ ['--dot' as string]: 'var(--clr-primary)' } as React.CSSProperties}>{wrong} wrong</span>
                <span style={{ ['--dot' as string]: 'var(--warn)' } as React.CSSProperties}>{skipped} skipped</span>
                <span style={{ ['--dot' as string]: 'var(--bd-strong)' } as React.CSSProperties}>{notSeen} not seen</span>
              </div>
            </div>

            {isSaving && (
              <div className="rs-note rs-note-saving" role="status">
                <span><Loader2 size={16} className="a-spin" />Saving your results...</span>
              </div>
            )}
            {saveError && (
              <div className="rs-note rs-note-error" role="alert">
                <span>Could not save your results. Check your connection and try again.</span>
                <button type="button" onClick={onRetrySave} disabled={isSaving} className="rs-btn rs-btn-solid press">
                  Retry
                </button>
              </div>
            )}

            <div className="rs-actions a-rise" style={stagger(5)}>
              <button type="button" onClick={onReview} className="rs-btn rs-btn-solid press">
                <Eye size={16} />Review answers
              </button>
              <button type="button" onClick={onRetake} className="rs-btn press">
                <RotateCcw size={15} />Retake
              </button>
              {showUnanswered && (
                <button
                  type="button"
                  onClick={onSolveUnanswered}
                  className="rs-btn rs-btn-blue press"
                  title="Questions of this exam you have never answered (skipped or not seen yet)"
                >
                  <CircleDashed size={15} />Solve unanswered ({unansweredCount})
                </button>
              )}
              <button type="button" onClick={onExit} className="rs-btn rs-btn-ghost press">
                <ArrowLeft size={15} />Back to exam page
              </button>
            </div>
          </div>
        </section>

        {/* ── Stat tiles ──────────────────────────────────────────── */}
        <section className="rs-stats">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className="rs-stat a-rise"
              style={{ ...stagger(i + 3), ['--ic-bg' as string]: s.bg, ['--ic-fg' as string]: s.fg } as React.CSSProperties}
            >
              <span className="rs-stat-ic"><s.Icon size={17} strokeWidth={2.4} /></span>
              <span className="rs-stat-val">{s.value}</span>
              <span className="rs-stat-lbl"><b>{s.label}</b><span>{s.sub}</span></span>
            </div>
          ))}
        </section>

        {/* ── By chapter ──────────────────────────────────────────── */}
        {chapterRows.length > 0 && (
          <section className="rs-card a-rise" style={stagger(6)}>
            <div className="rs-card-head">
              <h2 className="rs-card-title">By chapter</h2>
              <span className="rs-card-note">Weakest first</span>
            </div>
            <div className="rs-chapters">
              {chapterRows.map(row => (
                <div key={row.name} className="rs-ch" style={{ ['--c' as string]: barColor(row.pct) } as React.CSSProperties}>
                  <div className="rs-ch-top">
                    <span className="rs-ch-name">{row.name}</span>
                    <span className="rs-ch-score">{row.correct}/{row.total}<b>{row.pct}%</b></span>
                  </div>
                  <div className="rs-ch-track"><i style={{ width: animated ? `${row.pct}%` : '0%' }} /></div>
                  {row.pct < 50 && <span className="rs-ch-flag">Review this chapter</span>}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}