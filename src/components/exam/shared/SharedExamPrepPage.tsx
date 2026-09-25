// src/components/exam/shared/SharedExamPrepPage.tsx
export const dynamic = 'force-dynamic'
export const revalidate = 0

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  Clock, Play, Eye, Download,
  RotateCcw, ArrowRight, ChevronRight, Check,
} from 'lucide-react'

interface Breadcrumb {
  label: string
  href?: string
}

interface Props {
  examId?: string
  customExamId?: string
  basePath: string
  breadcrumbs: Breadcrumb[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** 1130 → "18:50", 4000 → "1:06:40" */
function formatElapsed(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m)
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`
}

/** 100 → [["1","h"],["40","m"]], 45 → [["45","min"]] */
function durationParts(total: number): [string, string][] {
  if (total < 60) return [[String(total), 'min']]
  const h = Math.floor(total / 60)
  const m = total % 60
  return m ? [[String(h), 'h'], [String(m), 'm']] : [[String(h), 'h']]
}

function initialsOf(name: string): string {
  return name
    .replace(/^dr\.?\s+/i, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()
}

/** Stagger index for the shared animation classes in globals.css */
const stagger = (i: number): React.CSSProperties =>
  ({ ['--i' as string]: i } as React.CSSProperties)

// ── Styles ─────────────────────────────────────────────────────────────────────

const PREP_CSS = `
  .pp { background: var(--bg); color: var(--fg); font-family: "Plus Jakarta Sans", system-ui, sans-serif; }
  .pp-wrap { max-width: 1120px; margin: 0 auto; padding: 0 24px; }

  /* ── Top: the exam "cover" ── */
  .pp-band {
    position: relative; overflow: hidden;
    background-color: var(--bg-elev); border-bottom: 1px solid var(--bd);
    padding: 26px 0 36px;
  }
  .pp-band::before {
    content: ''; position: absolute; inset: 0; pointer-events: none;
    background-image: radial-gradient(color-mix(in srgb, var(--clr-primary) 9%, transparent) 1px, transparent 1px);
    background-size: 26px 26px;
    -webkit-mask-image: linear-gradient(180deg, #000 0%, transparent 85%);
            mask-image: linear-gradient(180deg, #000 0%, transparent 85%);
  }
  .pp-glow {
    position: absolute; top: -220px; right: -120px; width: 620px; height: 620px; border-radius: 50%;
    background: radial-gradient(circle, color-mix(in srgb, var(--clr-primary) 14%, transparent), transparent 68%);
    pointer-events: none;
  }
  .pp-head { position: relative; display: flex; flex-direction: column; gap: 28px; }
  .pp-crumbs { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: var(--fg-muted); }
  .pp-crumbs a { color: var(--fg-muted); transition: color var(--dur-2); }
  .pp-crumbs a:hover { color: var(--clr-primary); }
  .pp-crumbs b { color: var(--fg); font-weight: 700; }
  .pp-crumbs svg { flex-shrink: 0; }

  .pp-cover { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 40px; align-items: end; }
  .pp-title { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
  .pp-eyebrow { display: inline-flex; align-items: center; gap: 10px; font-size: 12.5px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--clr-primary); }
  .pp-eyebrow::before { content: ''; width: 22px; height: 2px; border-radius: 2px; background: currentColor; }
  .pp-h1 { margin: 0; font-size: clamp(34px, 5.4vw, 60px); line-height: 1; font-weight: 800; letter-spacing: -0.045em; overflow-wrap: anywhere; }

  .pp-by { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; }
  .pp-avs { display: flex; padding-left: 8px; }
  .pp-av {
    width: 34px; height: 34px; margin-left: -8px; flex-shrink: 0; border-radius: 50%;
    border: 2px solid var(--bg-elev); background: var(--clr-soft); color: var(--clr-primary);
    display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800;
  }
  .pp-av:nth-child(2n) { background: var(--tone-blue-bg); color: var(--tone-blue-fg); }
  .pp-av:nth-child(3n) { background: var(--tone-purple-bg); color: var(--tone-purple-fg); }
  .pp-av-more { background: var(--fg) !important; color: var(--bg-elev) !important; font-size: 10.5px; }
  .pp-by-text { font-size: 14px; font-weight: 600; color: var(--fg-muted); line-height: 1.5; }
  .pp-by-text b { color: var(--fg); font-weight: 700; text-transform: capitalize; }
  .pp-more { display: inline; }
  .pp-more summary {
    display: inline; list-style: none; cursor: pointer; font-weight: 700; color: var(--clr-primary);
    text-decoration: underline; text-decoration-style: dotted; text-underline-offset: 3px;
  }
  .pp-more summary::-webkit-details-marker { display: none; }
  .pp-more[open] summary { display: none; }
  .pp-doc-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
  .pp-doc { display: inline-flex; align-items: center; padding: 5px 11px; border-radius: 999px; background: var(--bg-sunk); font-size: 12.5px; font-weight: 700; color: var(--fg-2); text-transform: capitalize; }

  /* Key numbers: typographic, no boxes */
  .pp-spec { display: flex; align-items: stretch; }
  .pp-spec-item { display: flex; flex-direction: column; gap: 6px; padding: 0 26px; border-left: 1px solid var(--bd); }
  .pp-spec-item:first-child { padding-left: 0; border-left: none; }
  .pp-spec-item:last-child { padding-right: 0; }
  .pp-spec-value { font-size: 34px; font-weight: 800; letter-spacing: -0.04em; line-height: 1; white-space: nowrap; }
  .pp-spec-value small { font-size: 17px; font-weight: 700; color: var(--fg-muted); letter-spacing: 0; margin-left: 1px; }
  .pp-spec-label { font-size: 11.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--fg-muted); white-space: nowrap; }

  /* Syllabus: numbered chapter list */
  .pp-syllabus { background: var(--bg-elev); border: 1px solid var(--bd); border-radius: 20px; box-shadow: 0 14px 40px var(--shadow); padding: 20px 24px 8px; }
  .pp-syl-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 6px; }
  .pp-syl-title { font-size: 15px; font-weight: 800; }
  .pp-syl-count { font-size: 12.5px; font-weight: 600; color: var(--fg-muted); }
  .pp-syl-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 40px; }
  .pp-syl-item { display: flex; align-items: baseline; gap: 14px; padding: 12px 0; border-top: 1px solid var(--bd); min-width: 0; }
  .pp-syl-num { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 12px; font-weight: 600; color: var(--clr-primary); flex-shrink: 0; }
  .pp-syl-name { font-size: 14px; font-weight: 600; color: var(--fg); line-height: 1.4; }
  .pp-syl-more { grid-column: 1 / -1; }
  .pp-syl-more summary {
    list-style: none; cursor: pointer; padding: 12px 0 14px; border-top: 1px solid var(--bd);
    font-size: 13px; font-weight: 700; color: var(--clr-primary);
  }
  .pp-syl-more summary::-webkit-details-marker { display: none; }
  .pp-syl-more[open] summary { display: none; }
  .pp-syl-more .pp-syl-grid { padding-bottom: 4px; }

  .tone-blue    { background: var(--tone-blue-bg);   color: var(--tone-blue-fg); }
  .tone-purple  { background: var(--tone-purple-bg); color: var(--tone-purple-fg); }

  /* ── Bottom: ways to start ── */
  .pp-main { display: flex; flex-direction: column; gap: 14px; padding-top: 32px; padding-bottom: 72px; }
  .pp-h2 { margin: 0 0 2px; font-size: 20px; font-weight: 800; letter-spacing: -0.01em; }

  .pp-hero {
    position: relative; overflow: hidden;
    display: grid; grid-template-columns: minmax(0, 1fr) 260px; gap: 24px; align-items: center;
    padding: 24px; border-radius: 20px; background: var(--bg-elev);
    border: 1.5px solid var(--clr-primary); box-shadow: 0 18px 44px var(--clr-glow);
  }
  .pp-hero-glow {
    position: absolute; top: -80px; right: 180px; width: 240px; height: 240px; border-radius: 50%;
    background: radial-gradient(circle, color-mix(in srgb, var(--clr-primary) 12%, transparent), transparent 70%);
    pointer-events: none;
  }
  .pp-hero-body { position: relative; display: flex; flex-direction: column; gap: 16px; min-width: 0; }
  .pp-hero-top { display: flex; align-items: flex-start; gap: 14px; }
  .pp-hero-icon {
    width: 48px; height: 48px; flex-shrink: 0; border-radius: 14px; background: var(--clr-primary); color: #fff;
    display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 22px var(--clr-glow);
  }
  .pp-hero-title { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .pp-hero-title strong { font-size: 19px; font-weight: 800; letter-spacing: -0.01em; }
  .pp-hero-desc { margin: 4px 0 0; font-size: 13.5px; line-height: 1.55; color: var(--fg-muted); }
  .pp-tag { font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 999px; white-space: nowrap; }
  .pp-tag-progress { background: var(--clr-soft); color: var(--clr-ink); }
  .pp-tag-ok { background: var(--ok-soft); color: var(--ok-ink); }

  .pp-progress { display: flex; flex-direction: column; gap: 9px; }
  .pp-progress-row { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; font-size: 13px; font-weight: 700; color: var(--fg-2); }
  .pp-progress-row b { font-size: 20px; font-weight: 800; color: var(--fg); letter-spacing: -0.02em; }
  .pp-mono { font-family: "JetBrains Mono", ui-monospace, monospace; font-weight: 600; }
  .pp-track { height: 8px; border-radius: 999px; background: var(--track); overflow: hidden; }
  .pp-fill { display: block; height: 100%; border-radius: 999px; background: var(--clr-primary); }
  .pp-progress-meta { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 12.5px; font-weight: 600; color: var(--fg-muted); }
  .pp-progress-meta span { display: inline-flex; align-items: center; gap: 6px; }

  .pp-actions { position: relative; display: flex; flex-direction: column; gap: 10px; }
  .pp-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: 100%;
    padding: 14px 20px; border-radius: 13px; font-size: 15px; font-weight: 700; white-space: nowrap;
    border: 1px solid transparent; text-decoration: none;
  }
  .pp-btn svg { flex-shrink: 0; }
  .pp-btn-solid { background: var(--clr-primary); color: #fff; box-shadow: 0 8px 20px var(--clr-glow); }
  .pp-btn-ghost { background: var(--bg-elev); border-color: var(--bd-strong); color: var(--fg); }
  .pp-note { display: flex; align-items: flex-start; justify-content: center; gap: 6px; text-align: center; font-size: 11.5px; line-height: 1.45; font-weight: 600; color: var(--fg-faint); }
  .pp-note svg { flex-shrink: 0; margin-top: 1px; }

  .pp-modes-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .pp-mode {
    display: flex; align-items: center; gap: 14px; padding: 18px 20px; border-radius: 18px;
    background: var(--bg-elev); border: 1px solid var(--bd); color: var(--fg); text-decoration: none;
  }
  .pp-mode-icon { width: 44px; height: 44px; flex-shrink: 0; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
  .pp-mode-text { flex: 1 1 auto; min-width: 0; }
  .pp-mode strong { display: block; font-size: 15px; font-weight: 800; }
  .pp-mode-desc { display: block; margin-top: 3px; font-size: 12.5px; line-height: 1.45; color: var(--fg-muted); }
  .pp-mode-arrow { color: var(--fg-faint); display: flex; flex-shrink: 0; }

  /* ── Responsive ── */
  @media (max-width: 900px) {
    .pp-cover { grid-template-columns: 1fr; gap: 24px; align-items: start; }
    .pp-hero { grid-template-columns: 1fr; }
    .pp-actions { flex-direction: row; flex-wrap: wrap; }
    .pp-actions .pp-btn { flex: 1 1 140px; width: auto; }
    .pp-note { flex-basis: 100%; }
    .pp-hero-glow { right: -80px; }
  }
  @media (max-width: 640px) {
    .pp-wrap { padding: 0 16px; }
    .pp-band { padding: 20px 0 24px; }
    .pp-head { gap: 20px; }
    .pp-spec { display: grid; grid-template-columns: 1fr 1fr; gap: 16px 0; }
    .pp-spec-item { padding: 0 16px; }
    .pp-spec-item:nth-child(odd) { padding-left: 0; border-left: none; }
    .pp-spec-value { font-size: 28px; }
    .pp-syllabus { padding: 16px 16px 4px; border-radius: 18px; }
    .pp-syl-grid { grid-template-columns: 1fr; }
    .pp-main { padding-top: 22px; padding-bottom: 48px; }
    .pp-h2 { font-size: 18px; }
    .pp-hero { padding: 18px; gap: 18px; }
    .pp-hero-title strong { font-size: 17px; }
    .pp-modes-2 { grid-template-columns: 1fr; }
    .pp-mode { padding: 16px; }
  }

`

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function SharedExamPrepPage({
  examId,
  customExamId,
  basePath,
  breadcrumbs,
}: Props) {
  const supabase = await createServerSupabaseClient()

  // ── بيانات الامتحان ───────────────────────────────────────
  let title = 'Custom Exam'
  let questionCount = 0
  let examType: string | null = null
  let calendarYear: number | null = null
  let doctors: string[] = []
  let chapters: string[] = []
  let savedProgress: any = null

  if (examId) {
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .select('*, exam_doctors(doctor:doctors(name))')
      .eq('id', examId)
      .eq('status', 'published')
      .is('deleted_at', null)
      .single()

    if (!exam) {
      console.error('[SharedExamPrepPage] Exam query failed:', examError)
      notFound()
    }

    title = exam.title
    questionCount = exam.question_count
    examType = exam.exam_type ?? null
    calendarYear = exam.calendar_year ?? null
    doctors = exam.exam_doctors
      ?.map((ed: any) => ed.doctor?.name)
      .filter(Boolean) || []

    const { data: qChapters } = await supabase
      .from('questions')
      .select('chapter:chapters(id, name)')
      .eq('exam_id', examId)
      .not('chapter_id', 'is', null)

    const chapterNames = new Set<string>()
    ;(qChapters || []).forEach((q: any) => {
      const ch = Array.isArray(q.chapter) ? q.chapter[0] : q.chapter
      if (ch?.name) chapterNames.add(ch.name)
    })
    chapters = Array.from(chapterNames)

    // saved progress
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: prog } = await supabase
        .from('study_progress')
        .select('current_question, answers_json, elapsed_seconds')
        .eq('user_id', user.id)
        .eq('exam_id', examId)
        .eq('completed', false)
        .maybeSingle()
      if (prog && Object.keys(prog.answers_json || {}).length > 0) {
        savedProgress = prog
      }
    }

  } else if (customExamId) {
    const { data: customExam } = await supabase
      .from('custom_exams')
      .select('*')
      .eq('id', customExamId)
      .single()

    if (!customExam) notFound()

    questionCount = customExam.question_count

    const { data: qData } = await supabase
      .from('questions')
      .select('chapter:chapters(id, name)')
      .in('id', customExam.question_ids)
      .is('deleted_at', null)

    if (!qData || qData.length === 0) notFound()

    const chapterNames2 = new Set<string>()
    ;(qData || []).forEach((q: any) => {
      const ch = Array.isArray(q.chapter) ? q.chapter[0] : q.chapter
      if (ch?.name) chapterNames2.add(ch.name)
    })
    chapters = Array.from(chapterNames2)
  }

  // ── Derived values ─────────────────────────────────────────
  const isCustom = !examId && !!customExamId
  const answeredCount = savedProgress
    ? Object.keys(savedProgress.answers_json || {}).length
    : 0
  const progressPct = questionCount > 0
    ? Math.min(100, Math.round((answeredCount / questionCount) * 100))
    : 0
  const nextQuestion = savedProgress ? (savedProgress.current_question ?? 0) + 1 : 1
  const elapsedLabel = savedProgress?.elapsed_seconds
    ? formatElapsed(savedProgress.elapsed_seconds)
    : null

  const badgeLabel = isCustom
    ? 'Custom exam'
    : [examType, calendarYear].filter(Boolean).join(' · ') || null

  const SYLLABUS_VISIBLE = 10
  const visibleChapters = chapters.slice(0, SYLLABUS_VISIBLE)
  const hiddenChapters = chapters.slice(SYLLABUS_VISIBLE)

  const spec = [
    { parts: [[String(questionCount), '']] as [string, string][], label: questionCount === 1 ? 'Question' : 'Questions' },
    { parts: durationParts(questionCount), label: 'Suggested time' },
    ...(chapters.length > 0 ? [{ parts: [[String(chapters.length), '']] as [string, string][], label: chapters.length === 1 ? 'Chapter' : 'Chapters' }] : []),
    ...(doctors.length > 0 ? [{ parts: [[String(doctors.length), '']] as [string, string][], label: doctors.length === 1 ? 'Doctor' : 'Doctors' }] : []),
  ]

  const AVATARS = 4
  const namedDoctors = doctors.slice(0, 2)
  const otherDoctors = doctors.slice(2)

  const chapterItem = (name: string, index: number) => (
    <div key={name} className="pp-syl-item">
      <span className="pp-syl-num">{String(index + 1).padStart(2, '0')}</span>
      <span className="pp-syl-name">{name}</span>
    </div>
  )

  return (
    <div className="pp">
      {/* dangerouslySetInnerHTML keeps quotes and '>' in the CSS unescaped */}
      <style dangerouslySetInnerHTML={{ __html: PREP_CSS }} />

      {/* ── Top: everything about the exam ─────────────────────────── */}
      <section className="pp-band">
        <div className="pp-glow" />
        <div className="pp-wrap pp-head">
          <nav aria-label="Breadcrumb" className="pp-crumbs a-fade">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {i > 0 && <ChevronRight size={12} strokeWidth={2.4} />}
                {crumb.href
                  ? <Link href={crumb.href}>{crumb.label}</Link>
                  : <b>{crumb.label}</b>}
              </span>
            ))}
          </nav>

          <div className="pp-cover">
            <div className="pp-title">
              {badgeLabel && <span className="pp-eyebrow a-rise">{badgeLabel}</span>}
              <h1 className="pp-h1 a-rise" style={stagger(1)}>{title}</h1>

              {doctors.length > 0 && (
                <div className="pp-by a-rise" style={stagger(2)}>
                  <div className="pp-avs" aria-hidden="true">
                    {doctors.slice(0, AVATARS).map(name => (
                      <span key={name} className="pp-av">{initialsOf(name)}</span>
                    ))}
                    {doctors.length > AVATARS && (
                      <span className="pp-av pp-av-more">+{doctors.length - AVATARS}</span>
                    )}
                  </div>
                  <div className="pp-by-text">
                    By{' '}
                    {namedDoctors.map((name, i) => (
                      <span key={name}>
                        {i > 0 && (otherDoctors.length > 0 ? ', ' : ' and ')}
                        <b>{name}</b>
                      </span>
                    ))}
                    {otherDoctors.length > 0 && (
                      <>
                        {' '}and{' '}
                        <details className="pp-more">
                          <summary>{otherDoctors.length} more</summary>
                          <div className="pp-doc-list">
                            {otherDoctors.map(name => <span key={name} className="pp-doc">{name}</span>)}
                          </div>
                        </details>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="pp-spec a-rise" style={stagger(2)}>
              {spec.map(item => (
                <div key={item.label} className="pp-spec-item">
                  <span className="pp-spec-value">
                    {item.parts.map(([num, unit], k) => (
                      <span key={k}>{k > 0 && ' '}{num}{unit && <small>{unit}</small>}</span>
                    ))}
                  </span>
                  <span className="pp-spec-label">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {chapters.length > 0 && (
            <div className="pp-syllabus a-rise" style={stagger(3)}>
              <div className="pp-syl-head">
                <span className="pp-syl-title">Chapters covered</span>
                <span className="pp-syl-count">{chapters.length} chapter{chapters.length === 1 ? '' : 's'}</span>
              </div>
              <div className="pp-syl-grid">
                {visibleChapters.map((ch, i) => chapterItem(ch, i))}
                {hiddenChapters.length > 0 && (
                  <details className="pp-syl-more">
                    <summary>Show {hiddenChapters.length} more chapter{hiddenChapters.length === 1 ? '' : 's'}</summary>
                    <div className="pp-syl-grid">
                      {hiddenChapters.map((ch, i) => chapterItem(ch, i + SYLLABUS_VISIBLE))}
                    </div>
                  </details>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Bottom: ways to start ──────────────────────────────────── */}
      <main className="pp-wrap pp-main">
        <h2 className="pp-h2 a-rise" style={stagger(3)}>Choose how to begin</h2>

        {/* Interactive exam */}
        <div className="pp-hero a-rise" style={stagger(4)}>
          <span className="pp-hero-glow a-float" />

          <div className="pp-hero-body">
            <div className="pp-hero-top">
              <span className="pp-hero-icon"><Play size={18} fill="currentColor" /></span>
              <div style={{ minWidth: 0 }}>
                <div className="pp-hero-title">
                  <strong>Interactive exam</strong>
                  {savedProgress
                    ? <span className="pp-tag pp-tag-progress">In progress</span>
                    : <span className="pp-tag pp-tag-ok">Recommended</span>}
                </div>
                <p className="pp-hero-desc">
                  {savedProgress
                    ? 'Pick up where you left off — your answers, flags and timer were saved.'
                    : 'One question at a time, with instant feedback, explanations and a running timer.'}
                </p>
              </div>
            </div>

            {savedProgress && (
              <div className="pp-progress">
                <div className="pp-progress-row">
                  <span><b>{answeredCount}</b> of {questionCount} answered</span>
                  <span className="pp-mono" style={{ color: 'var(--clr-primary)' }}>{progressPct}%</span>
                </div>
                <div className="pp-track">
                  <i className="pp-fill a-grow" style={{ width: `${progressPct}%` }} />
                </div>
                <div className="pp-progress-meta">
                  <span><ArrowRight size={13} />Next: question {nextQuestion}</span>
                  {elapsedLabel && <span><Clock size={13} /><span className="pp-mono">{elapsedLabel}</span> spent</span>}
                </div>
              </div>
            )}
          </div>

          <div className="pp-actions">
            {savedProgress ? (
              <>
                <Link href={`${basePath}/play?resume=true`} className="pp-btn pp-btn-solid press a-pulse">
                  <Play size={14} fill="currentColor" />Continue
                </Link>
                <Link href={`${basePath}/play`} className="pp-btn pp-btn-ghost press">
                  <RotateCcw size={15} />Start over
                </Link>
              </>
            ) : (
              <Link href={`${basePath}/play`} className="pp-btn pp-btn-solid press a-pulse">
                <Play size={14} fill="currentColor" />Start exam
              </Link>
            )}
            {!isCustom && (
              <span className="pp-note">
                <Check size={13} />
                Progress saves automatically
              </span>
            )}
          </div>
        </div>

        {/* Review + PDF */}
        <div className="pp-modes-2">
          <Link href={`${basePath}/review`} className="pp-mode lift nudge a-rise" style={stagger(5)}>
            <span className="pp-mode-icon tone-blue"><Eye size={19} /></span>
            <span className="pp-mode-text">
              <strong>Review mode</strong>
              <span className="pp-mode-desc">Every question with its answer and explanation. No timer.</span>
            </span>
            <span className="pp-mode-arrow"><ArrowRight size={17} /></span>
          </Link>

          <Link href={`${basePath}/pdf`} className="pp-mode lift nudge a-rise" style={stagger(6)}>
            <span className="pp-mode-icon tone-purple"><Download size={19} /></span>
            <span className="pp-mode-text">
              <strong>Export as PDF</strong>
              <span className="pp-mode-desc">Print or save a copy — with or without answers.</span>
            </span>
            <span className="pp-mode-arrow"><ArrowRight size={17} /></span>
          </Link>
        </div>
      </main>
    </div>
  )
}