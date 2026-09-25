// src/components/exam/shared/SharedBatchPage.tsx
//
// Shared component for the "batch page" — shows the list of exams inside a batch.
// Used by both pre-clinical and clinical routes.

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronRight, ArrowRight, FileText, Clock } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase/server'

interface Breadcrumb {
  label: string
  href?: string
}

interface Props {
  batchId: string
  batchName: string
  subjectName: string
  basePath: string                // e.g. /first-year/basic/first-semester/anatomy/wared
  breadcrumbs: Breadcrumb[]
}

/** Stagger index for the shared animation classes in globals.css */
const stagger = (i: number): React.CSSProperties =>
  ({ ['--i' as string]: i } as React.CSSProperties)

/** "Dr. Sameer Haddad" → "SH" */
const initials = (name: string) =>
  name
    .replace(/^dr\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0])
    .join('')
    .toUpperCase()

/** 100 → "1h 40m", 45 → "45m" */
const formatMinutes = (min: number) => {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

const AVATAR_TONES = [
  { bg: 'var(--clr-soft)', fg: 'var(--clr-primary)' },
  { bg: 'var(--tone-blue-bg)', fg: 'var(--tone-blue-fg)' },
  { bg: 'var(--tone-purple-bg)', fg: 'var(--tone-purple-fg)' },
]

// ── Styles ─────────────────────────────────────────────────────────────────────

const BATCH_CSS = `
  .bp { min-height: 100vh; background: var(--bg); color: var(--fg); font-family: "Plus Jakarta Sans", system-ui, sans-serif; }
  .bp-wrap { max-width: 1120px; margin: 0 auto; padding: 0 24px; }

  /* ── Cover ── */
  .bp-band { position: relative; overflow: hidden; background-color: var(--bg-elev); border-bottom: 1px solid var(--bd); padding: 22px 0 28px; }
  .bp-band::before {
    content: ''; position: absolute; inset: 0; pointer-events: none;
    background-image: radial-gradient(color-mix(in srgb, var(--clr-primary) 9%, transparent) 1px, transparent 1px);
    background-size: 26px 26px;
    -webkit-mask-image: linear-gradient(180deg, #000 0%, transparent 85%);
            mask-image: linear-gradient(180deg, #000 0%, transparent 85%);
  }
  .bp-glow {
    position: absolute; top: -220px; right: -120px; width: 620px; height: 620px; border-radius: 50%;
    background: radial-gradient(circle, color-mix(in srgb, var(--clr-primary) 14%, transparent), transparent 68%);
    pointer-events: none;
  }
  .bp-head { position: relative; display: flex; flex-direction: column; gap: 22px; }
  .bp-crumbs { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: var(--fg-muted); }
  .bp-crumbs a { color: var(--fg-muted); text-decoration: none; transition: color var(--dur-2); }
  .bp-crumbs a:hover { color: var(--clr-primary); }
  .bp-crumbs b { color: var(--fg); font-weight: 700; }
  .bp-crumbs svg { flex-shrink: 0; }

  .bp-cover { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 40px; align-items: end; }
  .bp-title { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
  .bp-eyebrow { display: inline-flex; align-items: center; gap: 10px; font-size: 12.5px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--clr-primary); }
  .bp-eyebrow::before { content: ''; width: 22px; height: 2px; border-radius: 2px; background: currentColor; }
  .bp-eyebrow span { margin-left: -4px; color: var(--fg-muted); }
  .bp-h1 { margin: 0; font-size: clamp(32px, 4.6vw, 52px); line-height: 1; font-weight: 800; letter-spacing: -0.045em; overflow-wrap: anywhere; }

  .bp-spec { display: flex; align-items: stretch; }
  .bp-spec-item { display: flex; flex-direction: column; gap: 6px; padding: 0 26px; border-left: 1px solid var(--bd); }
  .bp-spec-item:first-child { padding-left: 0; border-left: none; }
  .bp-spec-item:last-child { padding-right: 0; }
  .bp-spec-value { font-size: 34px; font-weight: 800; letter-spacing: -0.04em; line-height: 1; white-space: nowrap; }
  .bp-spec-label { font-size: 11.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--fg-muted); white-space: nowrap; }

  /* ── Exams list ── */
  .bp-main { display: flex; flex-direction: column; gap: 14px; padding-top: 28px; padding-bottom: 80px; }
  .bp-section-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
  .bp-h2 { margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.01em; }
  .bp-hint { font-size: 13px; font-weight: 600; color: var(--fg-muted); }
  .bp-list { display: flex; flex-direction: column; gap: 12px; }

  .bp-exam {
    display: grid; grid-template-columns: auto 48px minmax(0, 1fr) auto; align-items: center; gap: 20px;
    padding: 20px 24px; border-radius: 18px; background: var(--bg-elev); border: 1px solid var(--bd);
    color: var(--fg); text-decoration: none;
    transition: border-color var(--dur-2);
  }
  .bp-exam:hover { border-color: var(--bd-strong); }
  .bp-num {
    width: 40px; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 26px; font-weight: 600;
    letter-spacing: -0.04em; color: var(--fg-faint); transition: color var(--dur-2);
  }
  .bp-exam:hover .bp-num { color: var(--clr-primary); }
  .bp-icon {
    width: 48px; height: 48px; border-radius: 13px; background: var(--clr-soft); color: var(--clr-primary);
    display: flex; align-items: center; justify-content: center;
  }
  .bp-body { display: flex; flex-direction: column; gap: 9px; min-width: 0; }
  .bp-name-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 10px; }
  .bp-name { font-size: 17px; font-weight: 800; letter-spacing: -0.01em; line-height: 1.3; overflow-wrap: anywhere; }
  .bp-tag {
    display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 999px;
    background: var(--bg-soft); color: var(--fg-2); border: 1px solid var(--bd);
    font-size: 11.5px; font-weight: 700; text-transform: capitalize; white-space: nowrap;
  }
  .bp-tag-final { background: var(--clr-soft); color: var(--clr-ink); border-color: transparent; }

  .bp-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 18px; font-size: 12.5px; font-weight: 600; color: var(--fg-muted); }
  .bp-meta-item { display: inline-flex; align-items: center; gap: 6px; }
  .bp-meta-item svg { flex-shrink: 0; }
  .bp-docs { display: inline-flex; align-items: center; gap: 8px; min-width: 0; }
  .bp-avatars { display: inline-flex; flex-shrink: 0; padding-left: 7px; }
  .bp-avatar {
    width: 26px; min-width: 26px; height: 26px; margin-left: -7px; border-radius: 50%; border: 2px solid var(--bg-elev);
    display: inline-flex; align-items: center; justify-content: center; font-size: 9.5px; font-weight: 800; flex-shrink: 0; letter-spacing: -0.02em;
  }
  .bp-avatar-more { background: var(--fg); color: var(--bg-elev); }
  .bp-doc-names { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 420px; text-transform: capitalize; }

  .bp-cta {
    display: inline-flex; align-items: center; gap: 8px; padding: 11px 18px; border-radius: 12px;
    background: var(--clr-primary); color: #fff; font-size: 14px; font-weight: 700; white-space: nowrap;
  }
  .bp-cta svg { transition: transform var(--dur-2) var(--ease-out); }
  .bp-exam:hover .bp-cta svg { transform: translateX(3px); }

  .bp-empty {
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
    border-radius: 18px; border: 1.5px dashed var(--bd-strong); padding: 64px 24px; text-align: center;
  }
  .bp-empty-icon {
    width: 52px; height: 52px; border-radius: 15px; background: var(--bg-soft); color: var(--fg-faint);
    display: flex; align-items: center; justify-content: center; margin-bottom: 4px;
  }
  .bp-empty h3 { margin: 0; font-size: 17px; font-weight: 800; }
  .bp-empty p { margin: 0; font-size: 14px; color: var(--fg-muted); }

  /* ── Responsive ── */
  @media (max-width: 900px) {
    .bp-cover { grid-template-columns: 1fr; gap: 22px; align-items: start; }
    .bp-exam { grid-template-columns: 48px minmax(0, 1fr) auto; gap: 16px; }
    .bp-num { display: none; }
  }
  @media (max-width: 640px) {
    .bp-wrap { padding: 0 16px; }
    .bp-band { padding: 18px 0 22px; }
    .bp-head { gap: 18px; }
    .bp-spec { display: grid; grid-template-columns: repeat(4, auto); justify-content: start; gap: 0; }
    .bp-spec-item { padding: 0 14px; }
    .bp-spec-value { font-size: 22px; }
    .bp-spec-label { font-size: 10px; letter-spacing: 0.06em; }
    .bp-main { padding-top: 18px; padding-bottom: 56px; gap: 12px; }
    .bp-h2 { font-size: 18px; }
    .bp-hint { display: none; }
    .bp-list { gap: 10px; }

    .bp-exam { grid-template-columns: minmax(0, 1fr); gap: 14px; padding: 16px; }
    .bp-icon { display: none; }
    .bp-name { font-size: 16px; }
    .bp-meta { gap: 8px 14px; }
    .bp-docs { flex-basis: 100%; }
    .bp-doc-names { max-width: none; }
    .bp-cta { justify-content: center; padding: 12px 18px; }
  }
`

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function SharedBatchPage({
  batchId,
  batchName,
  subjectName,
  basePath,
  breadcrumbs,
}: Props) {
  const supabase = await createServerSupabaseClient()

  const { data: exams } = await supabase
    .from('exams')
    .select('*, exam_doctors(doctor:doctors(name))')
    .eq('batch_id', batchId)
    .eq('status', 'published')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  const examList = exams || []

  if (examList.length === 0 && !batchName) notFound()

  // ── Derived values ─────────────────────────────────────────
  const totalQuestions = examList.reduce((n: number, e: any) => n + (e.question_count ?? 0), 0)
  const doctorSet = new Set<string>()
  examList.forEach((e: any) =>
    e.exam_doctors?.forEach((ed: any) => ed.doctor?.name && doctorSet.add(ed.doctor.name))
  )
  const spec = [
    { value: examList.length.toLocaleString(), label: examList.length === 1 ? 'Exam' : 'Exams' },
    { value: totalQuestions.toLocaleString(), label: totalQuestions === 1 ? 'Question' : 'Questions' },
    ...(doctorSet.size > 0 ? [{ value: String(doctorSet.size), label: doctorSet.size === 1 ? 'Doctor' : 'Doctors' }] : []),
    ...(totalQuestions > 0 ? [{ value: formatMinutes(totalQuestions), label: 'Total time' }] : []),
  ]

  return (
    <div className="bp">
      {/* dangerouslySetInnerHTML keeps quotes and '>' in the CSS unescaped */}
      <style dangerouslySetInnerHTML={{ __html: BATCH_CSS }} />

      {/* ── Cover ───────────────────────────────────────────────────── */}
      <section className="bp-band">
        <div className="bp-glow" />
        <div className="bp-wrap bp-head">
          <nav aria-label="Breadcrumb" className="bp-crumbs a-fade">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {i > 0 && <ChevronRight size={12} strokeWidth={2.4} />}
                {crumb.href
                  ? <Link href={crumb.href}>{crumb.label}</Link>
                  : <b>{crumb.label}</b>}
              </span>
            ))}
          </nav>

          <div className="bp-cover">
            <div className="bp-title">
              <span className="bp-eyebrow a-rise">Batch <span>· {subjectName}</span></span>
              <h1 className="bp-h1 a-rise" style={stagger(1)}>{batchName}</h1>
            </div>

            {examList.length > 0 && (
              <div className="bp-spec a-rise" style={stagger(2)}>
                {spec.map(item => (
                  <div key={item.label} className="bp-spec-item">
                    <span className="bp-spec-value">{item.value}</span>
                    <span className="bp-spec-label">{item.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Exams ───────────────────────────────────────────────────── */}
      <main className="bp-wrap bp-main">
        <div className="bp-section-head a-rise" style={stagger(2)}>
          <h2 className="bp-h2">Exams</h2>
          {examList.length > 0 && <span className="bp-hint">Newest first</span>}
        </div>

        {examList.length > 0 ? (
          <div className="bp-list">
            {examList.map((exam: any, index: number) => {
              const doctors: string[] = exam.exam_doctors?.map((ed: any) => ed.doctor?.name).filter(Boolean) || []
              const isFinal = String(exam.exam_type ?? '').toLowerCase() === 'final'
              return (
                <Link
                  key={exam.id}
                  href={`${basePath}/${exam.id}`}
                  className="bp-exam lift a-rise"
                  style={stagger(Math.min(index + 3, 12))}
                >
                  <span className="bp-num" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                  <span className="bp-icon" aria-hidden="true"><FileText size={20} /></span>

                  <span className="bp-body">
                    <span className="bp-name-row">
                      <span className="bp-name">{exam.title}</span>
                      {exam.exam_type && (
                        <span className={`bp-tag${isFinal ? ' bp-tag-final' : ''}`}>
                          {exam.exam_type}{exam.calendar_year ? ` · ${exam.calendar_year}` : ''}
                        </span>
                      )}
                    </span>

                    <span className="bp-meta">
                      <span className="bp-meta-item"><FileText size={14} />{exam.question_count} questions</span>
                      <span className="bp-meta-item"><Clock size={14} />~{exam.question_count} min</span>
                      {doctors.length > 0 && (
                        <span className="bp-docs">
                          <span className="bp-avatars" aria-hidden="true">
                            {doctors.slice(0, 3).map((d, k) => (
                              <span
                                key={d}
                                className="bp-avatar"
                                style={{ background: AVATAR_TONES[k].bg, color: AVATAR_TONES[k].fg }}
                              >
                                {initials(d)}
                              </span>
                            ))}
                            {doctors.length > 3 && (
                              <span className="bp-avatar bp-avatar-more">+{doctors.length - 3}</span>
                            )}
                          </span>
                          <span className="bp-doc-names" title={doctors.join(', ')}>{doctors.join(', ')}</span>
                        </span>
                      )}
                    </span>
                  </span>

                  <span className="bp-cta press">
                    View exam
                    <ArrowRight size={15} strokeWidth={2.4} />
                  </span>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="bp-empty a-rise" style={stagger(3)}>
            <span className="bp-empty-icon"><FileText size={22} /></span>
            <h3>No exams available</h3>
            <p>Exams will appear here once published by an administrator.</p>
          </div>
        )}
      </main>
    </div>
  )
}