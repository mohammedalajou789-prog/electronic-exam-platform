'use client'

// src/components/dashboard/ReviewQuestionList.tsx
//
// Shared question list for the dashboard review pages (Wrong Questions + Bookmarks).
// Each card is a small practice round: the answer stays hidden until the student
// picks an option (or reveals it), and the explanation stays closed until asked for.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Check, X, Eye, Lightbulb, ChevronDown, Trash2, BookmarkMinus,
  Layers, Clock3, RotateCcw, Loader2, FileText,
} from 'lucide-react'
import { ExplanationRenderer } from '@/components/exam/ExplanationRenderer'

// ── Types ──────────────────────────────────────────────────────────────────────

type Named = { id?: string; name: string } | { id?: string; name: string }[] | null | undefined

export interface ReviewQuestion {
  id: string
  question_text: string
  choice_a: string | null
  choice_b: string | null
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
  chapter?: Named
  lecture?: Named
  exam?: any
}

export interface ReviewItem {
  id: string               // row id in wrong_answers / bookmarks
  question_id: string
  created_at: string
  question: ReviewQuestion | null
}

interface Props {
  items: ReviewItem[]
  variant: 'wrong' | 'bookmark'
  /** Remove one row. Resolve true on success, false on failure. */
  onRemove: (item: ReviewItem) => Promise<boolean>
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const one = (v: Named) => (Array.isArray(v) ? v[0] : v) ?? null
const nameOf = (v: Named) => one(v)?.name ?? null
const pick = (v: any) => (Array.isArray(v) ? v[0] : v) ?? null

const stagger = (i: number): React.CSSProperties =>
  ({ ['--i' as string]: i } as React.CSSProperties)

function optionsOf(q: ReviewQuestion) {
  return [
    { key: 'a', text: q.choice_a, note: q.incorrect_explanation_a },
    { key: 'b', text: q.choice_b, note: q.incorrect_explanation_b },
    { key: 'c', text: q.choice_c, note: q.incorrect_explanation_c },
    { key: 'd', text: q.choice_d, note: q.incorrect_explanation_d },
    { key: 'e', text: q.choice_e, note: q.incorrect_explanation_e },
  ].filter(o => !!o.text) as { key: string; text: string; note: string | null }[]
}

function timeAgo(iso: string) {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return ''
  const s = Math.max(0, (Date.now() - t) / 1000)
  if (s < 60) return 'just now'
  const m = s / 60, h = m / 60, d = h / 24
  if (m < 60) return `${Math.floor(m)}m ago`
  if (h < 24) return `${Math.floor(h)}h ago`
  if (d < 7) return `${Math.floor(d)}d ago`
  if (d < 30) return `${Math.floor(d / 7)}w ago`
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const CSS = `
  .rq { display: flex; flex-direction: column; gap: 14px; }

  /* Toolbar */
  .rq-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  .rq-seg { display: inline-flex; gap: 4px; padding: 4px; border-radius: 12px; background: var(--bg-elev); border: 1px solid var(--bd); }
  .rq-seg button {
    display: inline-flex; align-items: center; gap: 7px; padding: 7px 12px; border: 0; border-radius: 9px; background: transparent;
    font: inherit; font-size: 12.5px; font-weight: 700; color: var(--fg-muted); cursor: pointer;
    transition: background-color var(--dur-2), color var(--dur-2);
  }
  .rq-seg button:hover { color: var(--fg); }
  .rq-seg button[aria-pressed="true"] { background: var(--fg); color: var(--bg-elev); }
  .rq-bar-note { font-size: 12.5px; font-weight: 600; color: var(--fg-muted); }

  /* Chapter group header */
  .rq-group { display: flex; align-items: center; gap: 10px; margin-top: 10px; }
  .rq-group:first-of-type { margin-top: 0; }
  .rq-group-name { font-size: 14px; font-weight: 800; letter-spacing: -0.01em; }
  .rq-group-count {
    padding: 1px 8px; border-radius: 999px; background: var(--clr-soft); color: var(--clr-ink);
    font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 11.5px; font-weight: 600;
  }
  .rq-group-line { flex: 1 1 auto; height: 1px; background: var(--bd); }

  /* Card */
  .rq-card {
    position: relative; display: flex; flex-direction: column;
    border-radius: 20px; background: var(--bg-elev); border: 1px solid var(--bd);
    box-shadow: 0 1px 0 var(--shadow);
    transition: border-color var(--dur-2), box-shadow var(--dur-3) var(--ease-out), opacity .28s ease, transform .28s var(--ease-out);
  }
  .rq-card:hover { border-color: var(--bd-strong); box-shadow: 0 16px 40px var(--shadow); }
  .rq-card.is-leaving { opacity: 0; transform: translateX(24px) scale(.98); pointer-events: none; }
  .rq-card-in { display: flex; flex-direction: column; gap: 16px; padding: 22px 24px; }

  .rq-head { display: flex; align-items: flex-start; gap: 12px; }
  .rq-num {
    flex-shrink: 0; min-width: 40px; height: 28px; padding: 0 8px; border-radius: 9px; background: var(--bg-soft); border: 1px solid var(--bd);
    display: inline-flex; align-items: center; justify-content: center;
    font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 12px; font-weight: 600; color: var(--fg-muted);
  }
  .rq-meta { display: flex; flex-direction: column; gap: 5px; min-width: 0; flex: 1 1 auto; }
  .rq-crumb { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 8px; font-size: 12.5px; font-weight: 700; color: var(--fg-2); }
  .rq-crumb i { width: 3px; height: 3px; border-radius: 50%; background: var(--fg-faint); }
  .rq-crumb .rq-subj { color: var(--clr-primary); }
  .rq-sub { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 12px; font-size: 12px; font-weight: 600; color: var(--fg-muted); }
  .rq-sub span { display: inline-flex; align-items: center; gap: 5px; }
  .rq-sub svg { flex-shrink: 0; opacity: .8; }

  .rq-remove {
    flex-shrink: 0; display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 10px; border-radius: 10px;
    border: 1px solid var(--bd); background: var(--bg-elev); color: var(--fg-muted);
    font: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer; white-space: nowrap;
    transition: background-color var(--dur-2), color var(--dur-2), border-color var(--dur-2);
  }
  .rq-remove:hover { color: var(--clr-primary); border-color: color-mix(in srgb, var(--clr-primary) 40%, var(--bd)); }
  .rq-remove.is-confirm { background: var(--clr-primary); border-color: var(--clr-primary); color: #fff; }
  .rq-remove span { display: none; }
  .rq-remove.is-confirm span { display: inline; }

  .rq-q { margin: 0; font-size: 17px; font-weight: 700; line-height: 1.55; letter-spacing: -0.005em; overflow-wrap: anywhere; }

  /* Options */
  .rq-opts { display: flex; flex-direction: column; gap: 8px; }
  .rq-opt {
    display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px 14px; text-align: left;
    border-radius: 14px; border: 1.5px solid var(--bd); background: var(--bg-soft); color: var(--fg);
    font: inherit; font-size: 14.5px; font-weight: 600; line-height: 1.45; cursor: pointer;
    transition: border-color var(--dur-2), background-color var(--dur-2), opacity var(--dur-2), transform var(--dur-1);
  }
  .rq-opt:not(:disabled):hover { border-color: var(--bd-strong); background: var(--bg-elev); }
  .rq-opt:not(:disabled):active { transform: scale(.995); }
  .rq-opt:disabled { cursor: default; }
  .rq-key {
    width: 28px; height: 28px; flex-shrink: 0; border-radius: 50%; background: var(--bg-elev); border: 1px solid var(--bd);
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 800; color: var(--fg-muted); text-transform: uppercase;
  }
  .rq-opt-text { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; }
  .rq-opt-tag { flex-shrink: 0; font-size: 11px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }

  .rq-opt.is-correct { border-color: var(--ok); background: var(--ok-soft); }
  .rq-opt.is-correct .rq-key { background: var(--ok); border-color: var(--ok); color: #fff; }
  .rq-opt.is-correct .rq-opt-tag { color: var(--ok-ink); }
  .rq-opt.is-wrong { border-color: var(--clr-primary); background: var(--clr-soft); }
  .rq-opt.is-wrong .rq-key { background: var(--clr-primary); border-color: var(--clr-primary); color: #fff; }
  .rq-opt.is-wrong .rq-opt-tag { color: var(--clr-ink); }
  .rq-opt.is-dim { opacity: .55; }
  .rq-note { margin: 2px 4px 2px 54px; font-size: 13px; font-weight: 600; line-height: 1.5; color: var(--clr-ink); }

  /* Footer */
  .rq-foot {
    display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
    padding: 14px 24px; border-top: 1px solid var(--bd); background: color-mix(in srgb, var(--bg-soft) 60%, var(--bg-elev));
    border-radius: 0 0 20px 20px;
  }
  .rq-card.is-open .rq-foot { border-radius: 0; }
  .rq-status { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; color: var(--fg-muted); }
  .rq-status-dot { width: 22px; height: 22px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; background: var(--bg-elev); border: 1px solid var(--bd); }
  .rq-status.ok { color: var(--ok-ink); }
  .rq-status.ok .rq-status-dot { background: var(--ok); border-color: var(--ok); color: #fff; }
  .rq-status.bad { color: var(--clr-ink); }
  .rq-status.bad .rq-status-dot { background: var(--clr-primary); border-color: var(--clr-primary); color: #fff; }
  .rq-actions { display: flex; align-items: center; gap: 8px; }
  .rq-btn {
    display: inline-flex; align-items: center; gap: 7px; height: 38px; padding: 0 14px; border-radius: 11px;
    border: 1px solid var(--bd); background: var(--bg-elev); color: var(--fg);
    font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; white-space: nowrap;
    transition: background-color var(--dur-2), color var(--dur-2), border-color var(--dur-2);
  }
  .rq-btn:hover { border-color: var(--bd-strong); }
  .rq-btn-ghost { background: transparent; border-color: transparent; color: var(--fg-muted); }
  .rq-btn-ghost:hover { color: var(--fg); background: var(--bg-elev); border-color: var(--bd); }
  .rq-btn-expl { background: var(--fg); border-color: var(--fg); color: var(--bg-elev); }
  .rq-btn-expl:hover { border-color: var(--fg); opacity: .92; }
  .rq-btn-expl[aria-expanded="true"] { background: var(--ok-soft); border-color: var(--ok-bd); color: var(--ok-ink); }
  .rq-btn-expl .rq-chev { transition: transform var(--dur-3) var(--ease-out); }
  .rq-btn-expl[aria-expanded="true"] .rq-chev { transform: rotate(180deg); }

  /* Explanation drawer (height animates via grid rows) */
  .rq-expl { display: grid; grid-template-rows: 0fr; transition: grid-template-rows var(--dur-4) var(--ease-out); }
  .rq-card.is-open .rq-expl { grid-template-rows: 1fr; }
  .rq-expl-clip { overflow: hidden; min-height: 0; }
  .rq-expl-body {
    display: flex; flex-direction: column; gap: 18px; padding: 22px 24px 24px;
    border-top: 1px solid var(--bd); border-radius: 0 0 20px 20px;
    background: linear-gradient(180deg, color-mix(in srgb, var(--ok) 6%, var(--bg-elev)), var(--bg-elev) 140px);
  }
  .rq-expl-title { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--ok-ink); }
  .rq-why { display: flex; flex-direction: column; gap: 10px; padding-top: 18px; border-top: 1px dashed var(--bd-strong); }
  .rq-why-title { font-size: 13px; font-weight: 800; color: var(--fg-2); }
  .rq-why-row { display: flex; gap: 10px; align-items: flex-start; font-size: 13.5px; line-height: 1.55; color: var(--fg-2); }
  .rq-why-row .rq-key { width: 24px; height: 24px; font-size: 11px; }

  .rq-empty {
    display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 56px 24px; text-align: center;
    border-radius: 20px; border: 1.5px dashed var(--bd-strong);
  }
  .rq-empty strong { font-size: 16px; font-weight: 800; }
  .rq-empty span { font-size: 13.5px; color: var(--fg-muted); }
  .rq-error { padding: 10px 14px; border-radius: 12px; background: var(--clr-soft); color: var(--clr-ink); font-size: 13px; font-weight: 700; }

  @media (max-width: 640px) {
    .rq-card-in { padding: 16px; gap: 14px; }
    .rq-q { font-size: 16px; }
    .rq-opt { padding: 11px 12px; font-size: 14px; gap: 10px; }
    .rq-opt-tag { display: none; }
    .rq-note { margin-left: 42px; }
    .rq-foot { padding: 12px 16px; }
    .rq-status { flex-basis: 100%; }
    .rq-actions { width: 100%; }
    .rq-actions .rq-btn { flex: 1 1 0; justify-content: center; }
    .rq-expl-body { padding: 18px 16px 20px; }
    .rq-remove { padding: 0 9px; }
  }
`

// ── Card ───────────────────────────────────────────────────────────────────────

function QuestionCard({
  item, index, variant, onRemove,
}: { item: ReviewItem; index: number; variant: Props['variant']; onRemove: Props['onRemove'] }) {
  const q = item.question!
  const correct = String(q.correct_answer ?? '').toLowerCase()
  const options = useMemo(() => optionsOf(q), [q])

  const [picked, setPicked] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [open, setOpen] = useState(false)
  const [everOpened, setEverOpened] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [error, setError] = useState('')

  const shown = revealed || picked !== null
  const gotIt = picked !== null && picked === correct

  const exam = pick(q.exam)
  const batch = pick(exam?.batch)
  const subject = pick(batch?.subject)?.name ?? null
  const chapter = nameOf(q.chapter)
  const lecture = nameOf(q.lecture)
  const wrongNotes = options.filter(o => o.key !== correct && o.note)

  function toggleExplanation() {
    setOpen(o => !o)
    setEverOpened(true)
    if (!shown) setRevealed(true)
  }

  function reset() {
    setPicked(null)
    setRevealed(false)
    setOpen(false)
  }

  async function remove() {
    if (!confirm) {
      setConfirm(true)
      window.setTimeout(() => setConfirm(false), 3500)
      return
    }
    setBusy(true)
    setError('')
    const ok = await onRemove(item)
    if (ok) {
      setLeaving(true)
    } else {
      setBusy(false)
      setConfirm(false)
      setError('Could not remove this question. Please try again.')
    }
  }

  const RemoveIcon = variant === 'wrong' ? Trash2 : BookmarkMinus
  const removeLabel = variant === 'wrong' ? 'Remove from wrong questions' : 'Remove bookmark'

  let status: React.ReactNode
  if (picked !== null && gotIt) {
    status = <span className="rq-status ok a-pop"><span className="rq-status-dot"><Check size={13} strokeWidth={3} /></span>Correct — you’ve got this one now</span>
  } else if (picked !== null) {
    status = <span className="rq-status bad a-pop"><span className="rq-status-dot"><X size={13} strokeWidth={3} /></span>Not quite — the answer is {correct.toUpperCase()}</span>
  } else if (revealed) {
    status = <span className="rq-status ok"><span className="rq-status-dot"><Eye size={12} /></span>Answer: {correct.toUpperCase()}</span>
  } else {
    status = <span className="rq-status"><span className="rq-status-dot"><Lightbulb size={12} /></span>Pick an answer to test yourself</span>
  }

  return (
    <article
      className={`rq-card a-rise${open ? ' is-open' : ''}${leaving ? ' is-leaving' : ''}`}
      style={stagger(Math.min(index, 8))}
    >
      <div className="rq-card-in">
        {/* Head */}
        <div className="rq-head">
          <span className="rq-num">Q{String(index + 1).padStart(2, '0')}</span>
          <div className="rq-meta">
            <div className="rq-crumb">
              {subject && <span className="rq-subj">{subject}</span>}
              {subject && chapter && <i />}
              {chapter && <span>{chapter}</span>}
              {lecture && <><i /><span>{lecture}</span></>}
            </div>
            <div className="rq-sub">
              {exam?.title && <span><FileText size={12} />{exam.title}{batch?.name ? ` · ${batch.name}` : ''}</span>}
              {item.created_at && (
                <span><Clock3 size={12} />{variant === 'wrong' ? 'Missed' : 'Saved'} {timeAgo(item.created_at)}</span>
              )}
            </div>
          </div>
          <button
            type="button"
            className={`rq-remove press${confirm ? ' is-confirm' : ''}`}
            onClick={remove}
            disabled={busy}
            aria-label={confirm ? 'Confirm removal' : removeLabel}
            title={removeLabel}
          >
            {busy ? <Loader2 size={15} className="a-spin" /> : <RemoveIcon size={15} />}
            <span>{confirm ? 'Remove?' : ''}</span>
          </button>
        </div>

        {/* Question */}
        <p className="rq-q">{q.question_text}</p>

        {/* Options */}
        <div className="rq-opts" role="group" aria-label="Answer choices">
          {options.map(opt => {
            const isCorrect = shown && opt.key === correct
            const isWrong = picked === opt.key && opt.key !== correct
            const cls = isCorrect ? ' is-correct' : isWrong ? ' is-wrong' : shown ? ' is-dim' : ''
            return (
              <div key={opt.key}>
                <button
                  type="button"
                  className={`rq-opt${cls}`}
                  disabled={shown}
                  onClick={() => setPicked(opt.key)}
                >
                  <span className={`rq-key${isCorrect || isWrong ? ' a-pop' : ''}`}>
                    {isCorrect ? <Check size={14} strokeWidth={3} /> : isWrong ? <X size={14} strokeWidth={3} /> : opt.key}
                  </span>
                  <span className="rq-opt-text">{opt.text}</span>
                  {isCorrect && <span className="rq-opt-tag">Correct</span>}
                  {isWrong && <span className="rq-opt-tag">Your pick</span>}
                </button>
                {isWrong && opt.note && <p className="rq-note a-rise">{opt.note}</p>}
              </div>
            )
          })}
        </div>

        {error && <div className="rq-error" role="alert">{error}</div>}
      </div>

      {/* Footer */}
      <div className="rq-foot">
        {status}
        <div className="rq-actions">
          {shown ? (
            <button type="button" className="rq-btn rq-btn-ghost press" onClick={reset}>
              <RotateCcw size={14} />Try again
            </button>
          ) : (
            <button type="button" className="rq-btn rq-btn-ghost press" onClick={() => setRevealed(true)}>
              <Eye size={14} />Reveal answer
            </button>
          )}
          {(q.explanation || wrongNotes.length > 0) && (
            <button
              type="button"
              className="rq-btn rq-btn-expl press"
              aria-expanded={open}
              onClick={toggleExplanation}
            >
              <Lightbulb size={14} />
              {open ? 'Hide explanation' : 'Show explanation'}
              <ChevronDown size={14} className="rq-chev" />
            </button>
          )}
        </div>
      </div>

      {/* Explanation — closed by default */}
      <div className="rq-expl" aria-hidden={!open}>
        <div className="rq-expl-clip">
          {everOpened && (
            <div className="rq-expl-body">
              <span className="rq-expl-title"><Lightbulb size={14} />Explanation</span>
              {q.explanation && <ExplanationRenderer content={q.explanation} />}
              {wrongNotes.length > 0 && (
                <div className="rq-why">
                  <span className="rq-why-title">Why the other options are wrong</span>
                  {wrongNotes.map(o => (
                    <div key={o.key} className="rq-why-row">
                      <span className="rq-key">{o.key}</span>
                      <span>{o.note}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

// ── List ───────────────────────────────────────────────────────────────────────

export default function ReviewQuestionList({ items, variant, onRemove }: Props) {
  const router = useRouter()
  const [removed, setRemoved] = useState<Set<string>>(() => new Set())
  const [grouped, setGrouped] = useState(false)

  const visible = items.filter(it => it.question && !removed.has(it.id))

  async function handleRemove(item: ReviewItem) {
    const ok = await onRemove(item)
    if (ok) {
      // let the card slide out, then drop it and refresh the page counts
      window.setTimeout(() => {
        setRemoved(prev => new Set(prev).add(item.id))
        router.refresh()
      }, 280)
    }
    return ok
  }

  const groups = useMemo(() => {
    if (!grouped) return null
    const map = new Map<string, ReviewItem[]>()
    for (const it of visible) {
      const ch = nameOf(it.question?.chapter) ?? 'Other'
      if (!map.has(ch)) map.set(ch, [])
      map.get(ch)!.push(it)
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length)
  }, [grouped, visible])

  if (visible.length === 0) {
    return (
      <div className="rq">
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="rq-empty a-pop">
          <strong>{variant === 'wrong' ? 'All cleared' : 'No bookmarks left'}</strong>
          <span>{variant === 'wrong' ? 'Nice work — nothing left to review here.' : 'Bookmark questions during an exam to see them here.'}</span>
        </div>
      </div>
    )
  }

  let n = 0
  return (
    <div className="rq">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="rq-bar a-rise" style={stagger(3)}>
        <div className="rq-seg" role="group" aria-label="Order">
          <button type="button" aria-pressed={!grouped} onClick={() => setGrouped(false)}>
            <Clock3 size={13} />Newest first
          </button>
          <button type="button" aria-pressed={grouped} onClick={() => setGrouped(true)}>
            <Layers size={13} />By chapter
          </button>
        </div>
        <span className="rq-bar-note">Answers stay hidden until you pick one</span>
      </div>

      {groups
        ? groups.map(([chapter, list]) => (
            <section key={chapter} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="rq-group a-fade">
                <span className="rq-group-name">{chapter}</span>
                <span className="rq-group-count">{list.length}</span>
                <span className="rq-group-line" />
              </div>
              {list.map(it => (
                <QuestionCard key={it.id} item={it} index={n++} variant={variant} onRemove={handleRemove} />
              ))}
            </section>
          ))
        : visible.map((it, i) => (
            <QuestionCard key={it.id} item={it} index={i} variant={variant} onRemove={handleRemove} />
          ))}
    </div>
  )
}