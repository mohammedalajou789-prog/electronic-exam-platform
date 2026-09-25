'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Shuffle, Play, X, Check, Sparkles, Loader2, AlertCircle, ArrowRight, Layers, BookOpen, ListChecks } from 'lucide-react'

interface Batch { id: string; name: string }
interface Doctor { id: string; name: string }
interface ChapterItem { id: string; name: string }
interface LectureItem { id: string; name: string }
interface Props {
  subjectId: string
  batches: Batch[]
  doctors: Doctor[]
  chapters: ChapterItem[]
  lectures: LectureItem[]
  basePath: string
}

const COUNT_PRESETS = [10, 20, 30, 50, 100]
const PILLS_VISIBLE = 12

/** Stagger index for the shared animation classes in globals.css */
const stagger = (i: number): React.CSSProperties =>
  ({ ['--i' as string]: i } as React.CSSProperties)

// ── Styles ─────────────────────────────────────────────────────────────────────

const BUILDER_CSS = `
  /* ── Teaser card (always visible next to the batches) ── */
  .cb-teaser {
    position: relative; overflow: hidden; display: flex; flex-direction: column; gap: 18px;
    padding: 24px; border-radius: 22px; background: var(--panel-dark); color: var(--panel-dark-fg);
    box-shadow: 0 22px 50px var(--shadow-lg);
  }
  .cb-teaser > * { position: relative; }
  .cb-teaser-glow {
    position: absolute !important; top: -110px; right: -110px; width: 300px; height: 300px; border-radius: 50%;
    background: radial-gradient(circle, color-mix(in srgb, var(--panel-accent) 40%, transparent), transparent 70%);
    pointer-events: none;
  }
  .cb-teaser-grid {
    position: absolute !important; inset: 0; pointer-events: none; opacity: .5;
    background-image: radial-gradient(color-mix(in srgb, var(--panel-dark-fg) 12%, transparent) 1px, transparent 1px);
    background-size: 18px 18px;
    -webkit-mask-image: linear-gradient(200deg, #000, transparent 60%);
            mask-image: linear-gradient(200deg, #000, transparent 60%);
  }
  .cb-teaser-top { display: flex; align-items: center; justify-content: space-between; }
  .cb-teaser-icon {
    width: 50px; height: 50px; border-radius: 15px; background: var(--panel-accent); color: #fff;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 12px 26px color-mix(in srgb, var(--panel-accent) 45%, transparent);
  }
  .cb-teaser-tag {
    font-size: 11.5px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase;
    padding: 5px 10px; border-radius: 999px; border: 1px solid var(--panel-dark-bd); color: var(--panel-accent-2);
  }
  .cb-teaser-title { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.025em; line-height: 1.15; }
  .cb-teaser-desc { margin: 8px 0 0; font-size: 14px; line-height: 1.6; color: var(--panel-dark-mut); }
  .cb-teaser-list { display: flex; flex-direction: column; gap: 10px; margin: 0; padding: 0; list-style: none; }
  .cb-teaser-list li { display: flex; align-items: center; gap: 10px; font-size: 13.5px; font-weight: 600; }
  .cb-teaser-list li span {
    width: 28px; height: 28px; flex-shrink: 0; border-radius: 9px; display: flex; align-items: center; justify-content: center;
    background: color-mix(in srgb, var(--panel-dark-fg) 9%, transparent); color: var(--panel-accent-2);
  }
  .cb-teaser-cta {
    display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%;
    padding: 15px 18px; border-radius: 14px; border: none; cursor: pointer;
    background: var(--panel-dark-fg); color: var(--panel-dark); font-family: inherit; font-size: 15px; font-weight: 800;
  }
  .cb-teaser-cta svg { transition: transform var(--dur-2) var(--ease-out); }
  .cb-teaser-cta:hover svg { transform: translateX(4px); }

  /* ── Dialog ── */
  .cb-overlay {
    position: fixed; inset: 0; z-index: 200; display: flex; align-items: center; justify-content: center;
    padding: 24px;
  }
  .cb-scrim { position: absolute; inset: 0; background: var(--scrim); backdrop-filter: blur(3px); }
  .cb-dialog {
    position: relative; width: min(1040px, 100%); max-height: calc(100vh - 48px);
    display: flex; flex-direction: column; overflow: hidden;
    border-radius: 24px; background: var(--bg-elev); border: 1px solid var(--bd);
    box-shadow: 0 40px 100px var(--shadow-lg);
  }
  .cb-dialog-head {
    display: flex; align-items: center; gap: 14px; padding: 20px 22px;
    border-bottom: 1px solid var(--bd); flex-shrink: 0;
  }
  .cb-icon {
    width: 44px; height: 44px; flex-shrink: 0; border-radius: 13px; background: var(--clr-primary); color: #fff;
    display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 22px var(--clr-glow);
  }
  .cb-titles { flex: 1 1 auto; min-width: 0; }
  .cb-title { display: block; font-size: 18px; font-weight: 800; letter-spacing: -0.01em; }
  .cb-desc { display: block; margin-top: 2px; font-size: 13px; line-height: 1.5; color: var(--fg-muted); }
  .cb-close {
    width: 38px; height: 38px; flex-shrink: 0; border-radius: 11px; border: 1px solid var(--bd);
    background: var(--bg-soft); color: var(--fg-muted); display: flex; align-items: center; justify-content: center; cursor: pointer;
  }
  .cb-scroll { overflow-y: auto; overscroll-behavior: contain; }

  /* Body */
  .cb-body { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 24px; padding: 22px; align-items: start; }
  .cb-filters { display: flex; flex-direction: column; gap: 22px; min-width: 0; }
  .cb-group { display: flex; flex-direction: column; gap: 10px; }
  .cb-group-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .cb-group-title { font-size: 13.5px; font-weight: 800; }
  .cb-group-hint { font-size: 12px; font-weight: 600; color: var(--fg-faint); }
  .cb-clear { border: none; background: none; padding: 0; cursor: pointer; font-family: inherit; font-size: 12px; font-weight: 700; color: var(--clr-primary); }
  .cb-count { font-size: 12px; font-weight: 700; padding: 2px 9px; border-radius: 999px; background: var(--clr-soft); color: var(--clr-ink); }
  .cb-pills { display: flex; flex-wrap: wrap; gap: 8px; }
  .cb-pill {
    display: inline-flex; align-items: center; gap: 6px; padding: 7px 13px; border-radius: 999px;
    border: 1px solid var(--bd); background: var(--bg-soft); color: var(--fg);
    font-family: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer;
    transition: background-color var(--dur-2), border-color var(--dur-2), color var(--dur-2), transform var(--dur-1) var(--ease-out);
  }
  .cb-pill:hover { border-color: var(--clr-primary); }
  .cb-pill:active { transform: scale(.96); }
  .cb-pill.on { background: var(--clr-primary); border-color: var(--clr-primary); color: #fff; }
  .cb-caps .cb-pill { text-transform: capitalize; }
  .cb-more { border: 1px dashed var(--bd-strong); background: transparent; color: var(--clr-primary); font-weight: 700; }

  /* Settings panel */
  .cb-side { position: sticky; top: 0; display: flex; flex-direction: column; gap: 16px; padding: 18px; border-radius: 16px; background: var(--bg-soft); border: 1px solid var(--bd); }
  .cb-panel { display: flex; flex-direction: column; gap: 16px; }
  .cb-label { font-size: 13.5px; font-weight: 800; }
  .cb-seg { display: flex; gap: 2px; padding: 4px; border-radius: 12px; background: var(--bg-sunk); }
  .cb-seg button {
    flex: 1; padding: 8px 0; border: none; border-radius: 9px; background: transparent; color: var(--fg-muted);
    font-family: inherit; font-size: 13px; font-weight: 700; cursor: pointer; transition: background-color var(--dur-2), color var(--dur-2);
  }
  .cb-seg button.on { background: var(--bg-elev); color: var(--fg); box-shadow: 0 1px 3px var(--shadow-lg); }
  .cb-custom { display: flex; align-items: center; gap: 10px; font-size: 12.5px; font-weight: 600; color: var(--fg-muted); }
  .cb-custom input {
    width: 76px; padding: 8px 10px; border-radius: 10px; border: 1px solid var(--bd-strong);
    background: var(--bg-elev); color: var(--fg); font-family: inherit; font-size: 13px; font-weight: 700; text-align: center; outline: none;
  }
  .cb-custom input:focus { border-color: var(--clr-primary); }

  .cb-switch {
    display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px;
    border-radius: 12px; background: var(--bg-elev); border: 1px solid var(--bd); cursor: pointer;
  }
  .cb-switch strong { display: block; font-size: 13px; font-weight: 700; }
  .cb-switch small { display: block; margin-top: 2px; font-size: 11.5px; font-weight: 600; color: var(--fg-muted); }
  .cb-switch input { position: absolute; opacity: 0; width: 1px; height: 1px; }
  .cb-track {
    position: relative; width: 44px; height: 26px; flex-shrink: 0; border-radius: 999px; background: var(--bd-strong);
    transition: background-color var(--dur-2);
  }
  .cb-track::after {
    content: ''; position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%;
    background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.3); transition: transform var(--dur-2) var(--ease-spring);
  }
  .cb-switch input:checked + .cb-track { background: var(--clr-primary); }
  .cb-switch input:checked + .cb-track::after { transform: translateX(18px); }
  .cb-switch input:focus-visible + .cb-track { outline: 2px solid var(--clr-primary); outline-offset: 2px; }

  .cb-summary { display: flex; align-items: flex-start; gap: 9px; padding: 12px 14px; border-radius: 12px; background: var(--clr-soft); color: var(--clr-ink); font-size: 12.5px; font-weight: 700; line-height: 1.5; }
  .cb-summary svg { flex-shrink: 0; margin-top: 2px; }
  .cb-error { display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; border-radius: 11px; background: var(--clr-soft); border: 1px solid var(--clr-primary); color: var(--clr-ink); font-size: 13px; font-weight: 600; }
  .cb-error svg { flex-shrink: 0; margin-top: 1px; }

  .cb-actions { display: flex; gap: 10px; }
  .cb-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 13px 18px; border-radius: 12px;
    font-family: inherit; font-size: 14px; font-weight: 700; cursor: pointer; border: 1px solid transparent; white-space: nowrap;
  }
  .cb-btn svg { flex-shrink: 0; }
  .cb-btn-solid { flex: 1; background: var(--clr-primary); color: #fff; box-shadow: 0 8px 20px var(--clr-glow); }
  .cb-btn-solid:disabled { opacity: .7; cursor: not-allowed; }
  .cb-btn-ghost { background: var(--bg-elev); border-color: var(--bd-strong); color: var(--fg-muted); }

  @media (max-width: 900px) {
    .cb-body { display: flex; flex-direction: column; align-items: stretch; }
    .cb-side { display: contents; }
    .cb-panel { padding: 16px; border-radius: 16px; background: var(--bg-soft); border: 1px solid var(--bd); }
    /* Generate stays reachable while scrolling the filters */
    .cb-actions {
      position: sticky; bottom: 0; z-index: 2; margin: 0 -22px -22px; max-width: none;
      padding: 12px 22px calc(12px + env(safe-area-inset-bottom));
      background: var(--bg-elev); border-top: 1px solid var(--bd); box-shadow: 0 -12px 24px var(--shadow);
    }
  }
  @media (max-width: 640px) {
    .cb-teaser { padding: 18px; gap: 14px; border-radius: 20px; }
    .cb-teaser-title { font-size: 20px; }
    .cb-teaser-list { display: none; }
    .cb-overlay { padding: 0; align-items: flex-end; }
    .cb-dialog { width: 100%; max-height: 94vh; border-radius: 24px 24px 0 0; animation: mc-sheet .42s var(--ease-out) both; }
    .cb-dialog-head { padding: 16px; }
    .cb-desc { display: none; }
    .cb-body { padding: 16px; gap: 18px; }
    .cb-panel { padding: 14px; }
    .cb-actions { margin: 0 -16px -16px; padding-left: 16px; padding-right: 16px; }
  }
`

// ── Component ──────────────────────────────────────────────────────────────────

export default function CustomExamBuilder({ subjectId, batches, doctors, chapters, lectures, basePath }: Props) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [selectedBatches, setSelectedBatches] = useState<string[]>([])
  const [selectedDoctors, setSelectedDoctors] = useState<string[]>([])
  const [selectedChapters, setSelectedChapters] = useState<string[]>([])
  const [selectedLectures, setSelectedLectures] = useState<string[]>([])
  const [questionCount, setQuestionCount] = useState(20)
  const [randomize, setRandomize] = useState(true)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  // Close with Escape and lock the page scroll while the builder is open
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !isGenerating) setIsOpen(false) }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [isOpen, isGenerating])

  function toggleItem(id: string, selected: string[], setSelected: (v: string[]) => void) {
    setSelected(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])
  }

  async function handleGenerate() {
    setIsGenerating(true)
    setError('')
    try {
      const params = new URLSearchParams()
      params.set('subjectId', subjectId)
      params.set('count', questionCount.toString())
      params.set('randomize', randomize.toString())
      if (selectedBatches.length > 0) params.set('batches', selectedBatches.join(','))
      if (selectedDoctors.length > 0) params.set('doctors', selectedDoctors.join(','))
      if (selectedChapters.length > 0) params.set('chapters', selectedChapters.join(','))
      if (selectedLectures.length > 0) params.set('lectures', selectedLectures.join(','))
      const res = await fetch(`/api/custom-exam?${params.toString()}`)
      const data = await res.json()
      if (!res.ok || !data.examId) {
        setError(data.error || 'Failed to generate exam. Please try again.')
        setIsGenerating(false)
        return
      }
      router.push(`${basePath}/custom/${data.examId}`)
    } catch {
      setError('Something went wrong. Please try again.')
      setIsGenerating(false)
    }
  }

  function reset() {
    setSelectedBatches([])
    setSelectedDoctors([])
    setSelectedChapters([])
    setSelectedLectures([])
    setQuestionCount(20)
    setRandomize(true)
    setError('')
  }

  // ── Summary line ─────────────────────────────────────────
  const scope = (n: number, total: number, word: string) =>
    n === 0 || n === total ? `all ${word}s` : `${n} ${word}${n === 1 ? '' : 's'}`
  const summaryParts = [
    batches.length > 0 && scope(selectedBatches.length, batches.length, 'batch'),
    doctors.length > 0 && scope(selectedDoctors.length, doctors.length, 'doctor'),
    chapters.length > 0 && scope(selectedChapters.length, chapters.length, 'chapter'),
    lectures.length > 0 && scope(selectedLectures.length, lectures.length, 'lecture'),
  ].filter(Boolean) as string[]
  const summary = `${questionCount} question${questionCount === 1 ? '' : 's'} from ${summaryParts.join(' · ')}`
    .replace('all batchs', 'all batches')
  const totalSelected = selectedBatches.length + selectedDoctors.length + selectedChapters.length + selectedLectures.length

  // ── Filter group ─────────────────────────────────────────
  function Group({ id, title, items, selected, setSelected, index }: {
    id: string
    title: string
    items: { id: string; name: string }[]
    selected: string[]
    setSelected: (v: string[]) => void
    index: number
  }) {
    if (items.length === 0) return null
    const showAll = expanded[id] || items.length <= PILLS_VISIBLE
    const visible = showAll ? items : items.slice(0, PILLS_VISIBLE)
    return (
      <div className={`cb-group a-rise${id === 'doctors' ? ' cb-caps' : ''}`} style={stagger(index)}>
        <div className="cb-group-head">
          <span className="cb-group-title">{title}</span>
          {selected.length > 0 ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              <span className="cb-count">{selected.length} selected</span>
              <button type="button" className="cb-clear" onClick={() => setSelected([])}>Clear</button>
            </span>
          ) : (
            <span className="cb-group-hint">All if none selected</span>
          )}
        </div>
        <div className="cb-pills">
          {visible.map(item => {
            const on = selected.includes(item.id)
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={on}
                className={`cb-pill${on ? ' on' : ''}`}
                onClick={() => toggleItem(item.id, selected, setSelected)}
              >
                {on && <Check size={12} strokeWidth={3} />}
                {item.name}
              </button>
            )
          })}
          {items.length > PILLS_VISIBLE && (
            <button
              type="button"
              className="cb-pill cb-more"
              onClick={() => setExpanded(e => ({ ...e, [id]: !e[id] }))}
            >
              {showAll ? 'Show less' : `Show all ${items.length}`}
            </button>
          )}
        </div>
      </div>
    )
  }

  const poolParts = [
    batches.length > 0 && `${batches.length} batch${batches.length === 1 ? '' : 'es'}`,
    chapters.length > 0 && `${chapters.length} chapter${chapters.length === 1 ? '' : 's'}`,
    lectures.length > 0 && `${lectures.length} lecture${lectures.length === 1 ? '' : 's'}`,
  ].filter(Boolean) as string[]

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: BUILDER_CSS }} />

      {/* ── Teaser card ─────────────────────────────────────────── */}
      <div className="cb-teaser a-rise" style={stagger(2)}>
        <span className="cb-teaser-glow a-float" />
        <span className="cb-teaser-grid" />

        <div className="cb-teaser-top">
          <span className="cb-teaser-icon"><Shuffle size={22} /></span>
          <span className="cb-teaser-tag">Custom exam</span>
        </div>

        <div>
          <h3 className="cb-teaser-title">Build your own exam</h3>
          <p className="cb-teaser-desc">
            Mix questions from any batch, doctor, chapter or lecture — then solve them like a real exam.
          </p>
        </div>

        <ul className="cb-teaser-list">
          {poolParts.length > 0 && (
            <li><span><Layers size={15} /></span>Pick from {poolParts.join(' · ')}</li>
          )}
          <li><span><ListChecks size={15} /></span>Choose 10 to 100 questions</li>
          <li><span><BookOpen size={15} /></span>Instant feedback and explanations</li>
        </ul>

        <button type="button" className="cb-teaser-cta press" onClick={() => setIsOpen(true)} aria-haspopup="dialog">
          Start building
          <ArrowRight size={17} />
        </button>
      </div>

      {/* ── Builder dialog ──────────────────────────────────────── */}
      {isOpen && (
        <div className="cb-overlay">
          <div className="cb-scrim a-fade" onClick={() => !isGenerating && setIsOpen(false)} />

          <div className="cb-dialog a-pop" role="dialog" aria-modal="true" aria-labelledby="cb-dialog-title">
            <div className="cb-dialog-head">
              <span className="cb-icon"><Shuffle size={19} /></span>
              <span className="cb-titles">
                <span id="cb-dialog-title" className="cb-title">Create a custom exam</span>
                <span className="cb-desc">Leave a group empty to include all of it.</span>
              </span>
              <button type="button" className="cb-close press" aria-label="Close" onClick={() => setIsOpen(false)} disabled={isGenerating}>
                <X size={17} />
              </button>
            </div>

            <div className="cb-scroll">
              <div className="cb-body">
                <div className="cb-filters">
                  {Group({ id: 'batches', title: 'Batch', items: batches, selected: selectedBatches, setSelected: setSelectedBatches, index: 0 })}
                  {Group({ id: 'doctors', title: 'Doctor', items: doctors, selected: selectedDoctors, setSelected: setSelectedDoctors, index: 1 })}
                  {Group({ id: 'chapters', title: 'Chapter', items: chapters, selected: selectedChapters, setSelected: setSelectedChapters, index: 2 })}
                  {Group({ id: 'lectures', title: 'Lecture', items: lectures, selected: selectedLectures, setSelected: setSelectedLectures, index: 3 })}
                </div>

                <div className="cb-side a-rise" style={stagger(2)}>
                  <div className="cb-panel">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <span className="cb-label">Number of questions</span>
                      <div className="cb-seg" role="group" aria-label="Number of questions">
                        {COUNT_PRESETS.map(n => (
                          <button
                            key={n}
                            type="button"
                            aria-pressed={questionCount === n}
                            className={questionCount === n ? 'on' : undefined}
                            onClick={() => setQuestionCount(n)}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                      <label className="cb-custom">
                        Custom
                        <input
                          type="number"
                          min={1}
                          value={questionCount}
                          onChange={e => setQuestionCount(Math.max(1, parseInt(e.target.value) || 1))}
                        />
                      </label>
                    </div>

                    <label className="cb-switch">
                      <span>
                        <strong>Randomize question order</strong>
                        <small>Shuffle so position gives nothing away</small>
                      </span>
                      <input type="checkbox" checked={randomize} onChange={e => setRandomize(e.target.checked)} />
                      <span className="cb-track" aria-hidden="true" />
                    </label>

                    <div className="cb-summary" aria-live="polite">
                      <Sparkles size={15} />
                      <span>{summary}</span>
                    </div>

                    {error && (
                      <div className="cb-error a-rise" role="alert">
                        <AlertCircle size={15} />
                        {error}
                      </div>
                    )}
                  </div>

                  <div className="cb-actions">
                    <button
                      type="button"
                      className="cb-btn cb-btn-solid press"
                      onClick={handleGenerate}
                      disabled={isGenerating}
                    >
                      {isGenerating
                        ? <><Loader2 size={15} className="a-spin" />Generating…</>
                        : <><Play size={14} fill="currentColor" />Generate exam</>}
                    </button>
                    <button
                      type="button"
                      className="cb-btn cb-btn-ghost press"
                      onClick={reset}
                      disabled={isGenerating}
                      title={totalSelected > 0 ? 'Clear all selections' : 'Reset'}
                    >
                      <X size={15} />
                      Reset
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}