// src/components/exam/shared/SharedSubjectPage.tsx
//
// Shared subject dashboard. Shows the list of batches + CustomExamBuilder.
// Used by both pre-clinical and clinical routes.

import Link from 'next/link'
import { ChevronRight, ArrowUpRight } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import CustomExamBuilder from '@/components/exam/CustomExamBuilder'

interface Props {
  subjectId: string
  subjectName: string
  basePath: string                     // e.g. /first-year/basic/first-semester/anatomy
  breadcrumbs: { label: string; href?: string }[]
}

/** Stagger index for the shared animation classes in globals.css */
const stagger = (i: number): React.CSSProperties =>
  ({ ['--i' as string]: i } as React.CSSProperties)

// ── Styles ─────────────────────────────────────────────────────────────────────

const SUBJECT_CSS = `
  .sp { background: var(--bg); color: var(--fg); font-family: "Plus Jakarta Sans", system-ui, sans-serif; }
  .sp-wrap { max-width: 1120px; margin: 0 auto; padding: 0 24px; }

  /* ── Cover ── */
  .sp-band { position: relative; overflow: hidden; background-color: var(--bg-elev); border-bottom: 1px solid var(--bd); padding: 22px 0 28px; }
  .sp-band::before {
    content: ''; position: absolute; inset: 0; pointer-events: none;
    background-image: radial-gradient(color-mix(in srgb, var(--clr-primary) 9%, transparent) 1px, transparent 1px);
    background-size: 26px 26px;
    -webkit-mask-image: linear-gradient(180deg, #000 0%, transparent 85%);
            mask-image: linear-gradient(180deg, #000 0%, transparent 85%);
  }
  .sp-glow {
    position: absolute; top: -220px; right: -120px; width: 620px; height: 620px; border-radius: 50%;
    background: radial-gradient(circle, color-mix(in srgb, var(--clr-primary) 14%, transparent), transparent 68%);
    pointer-events: none;
  }
  .sp-head { position: relative; display: flex; flex-direction: column; gap: 22px; }
  .sp-crumbs { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: var(--fg-muted); }
  .sp-crumbs a { color: var(--fg-muted); transition: color var(--dur-2); }
  .sp-crumbs a:hover { color: var(--clr-primary); }
  .sp-crumbs b { color: var(--fg); font-weight: 700; }
  .sp-crumbs svg { flex-shrink: 0; }

  .sp-cover { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 40px; align-items: end; }
  .sp-title { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
  .sp-eyebrow { display: inline-flex; align-items: center; gap: 10px; font-size: 12.5px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--clr-primary); }
  .sp-eyebrow::before { content: ''; width: 22px; height: 2px; border-radius: 2px; background: currentColor; }
  .sp-h1 { margin: 0; font-size: clamp(32px, 4.6vw, 52px); line-height: 1; font-weight: 800; letter-spacing: -0.045em; overflow-wrap: anywhere; }

  .sp-spec { display: flex; align-items: stretch; }
  .sp-spec-item { display: flex; flex-direction: column; gap: 6px; padding: 0 26px; border-left: 1px solid var(--bd); }
  .sp-spec-item:first-child { padding-left: 0; border-left: none; }
  .sp-spec-item:last-child { padding-right: 0; }
  .sp-spec-value { font-size: 34px; font-weight: 800; letter-spacing: -0.04em; line-height: 1; white-space: nowrap; }
  .sp-spec-label { font-size: 11.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--fg-muted); white-space: nowrap; }

  /* ── Content: batches + custom exam side by side ── */
  .sp-main { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 28px; align-items: start; padding-top: 28px; padding-bottom: 80px; }
  .sp-section { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
  .sp-aside { position: sticky; top: 88px; display: flex; flex-direction: column; gap: 14px; }
  .sp-section-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
  .sp-h2 { margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.01em; }
  .sp-hint { font-size: 13px; font-weight: 600; color: var(--fg-muted); }

  /* Batches */
  .sp-batches { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .sp-batch {
    display: flex; flex-direction: column; gap: 14px; padding: 18px;
    border-radius: 18px; background: var(--bg-elev); border: 1px solid var(--bd);
    color: var(--fg); text-decoration: none;
  }
  .sp-batch-top { display: flex; align-items: center; gap: 14px; }
  .sp-batch-num {
    width: 44px; height: 44px; flex-shrink: 0; border-radius: 13px; background: var(--clr-soft); color: var(--clr-primary);
    display: flex; align-items: center; justify-content: center;
    font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 15px; font-weight: 600;
  }
  .sp-batch-text { flex: 1 1 auto; min-width: 0; }
  .sp-batch-go {
    width: 32px; height: 32px; flex-shrink: 0; border-radius: 50%; border: 1px solid var(--bd); color: var(--fg-muted);
    display: flex; align-items: center; justify-content: center;
    transition: background-color var(--dur-2), color var(--dur-2), border-color var(--dur-2), transform var(--dur-2) var(--ease-out);
  }
  .sp-batch:hover .sp-batch-go { background: var(--clr-primary); border-color: var(--clr-primary); color: #fff; transform: rotate(45deg); }
  .sp-batch-name { display: block; font-size: 17px; font-weight: 800; letter-spacing: -0.015em; line-height: 1.25; overflow-wrap: anywhere; }
  .sp-batch-meta { display: block; margin-top: 3px; font-size: 12.5px; font-weight: 600; color: var(--fg-muted); }
  .sp-batch-empty { color: var(--fg-faint); }
  .sp-track { height: 5px; border-radius: 999px; background: var(--track); overflow: hidden; }
  .sp-fill { display: block; height: 100%; border-radius: 999px; background: var(--clr-primary); }

  .sp-empty {
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
    border-radius: 18px; border: 1.5px dashed var(--bd-strong); padding: 56px 24px; text-align: center;
  }
  .sp-empty h3 { margin: 0; font-size: 17px; font-weight: 800; }
  .sp-empty p { margin: 0; font-size: 14px; color: var(--fg-muted); }

  /* ── Responsive ── */
  @media (max-width: 1000px) {
    .sp-main { grid-template-columns: 1fr; gap: 22px; }
    .sp-aside { position: static; order: -1; }
  }
  @media (max-width: 900px) {
    .sp-cover { grid-template-columns: 1fr; gap: 22px; align-items: start; }
  }
  @media (max-width: 640px) {
    .sp-wrap { padding: 0 16px; }
    .sp-band { padding: 18px 0 22px; }
    .sp-head { gap: 18px; }
    .sp-spec { display: grid; grid-template-columns: repeat(4, auto); justify-content: start; gap: 0; }
    .sp-spec-item { padding: 0 14px; }
    .sp-spec-value { font-size: 22px; }
    .sp-spec-label { font-size: 10px; letter-spacing: 0.06em; }
    .sp-main { padding-top: 18px; padding-bottom: 56px; }
    .sp-h2 { font-size: 18px; }
    .sp-hint { display: none; }
    .sp-batches { grid-template-columns: 1fr; gap: 10px; }
    .sp-batch { padding: 14px; gap: 12px; }
    .sp-batch-num { width: 40px; height: 40px; border-radius: 12px; font-size: 14px; }
    .sp-batch-name { font-size: 16px; }
  }
`

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function SharedSubjectPage({
  subjectId,
  subjectName,
  basePath,
  breadcrumbs,
}: Props) {
  const supabase = await createServerSupabaseClient()

  // Batches
  const { data: rawBatches } = await supabase
    .from('batches')
    .select('id, name, slug, display_order, exams(id, question_count, status, deleted_at)')
    .eq('subject_id', subjectId)
    .order('display_order', { ascending: true })

  const batches = (rawBatches || []).map((b: any) => {
    const pub = (b.exams ?? []).filter(
      (e: any) => e.status === 'published' && !e.deleted_at
    )
    return {
      ...b,
      examCount: pub.length,
      totalQuestions: pub.reduce((n: number, e: any) => n + (e.question_count ?? 0), 0),
    }
  })

  const totalExams = batches.reduce((n: number, b: any) => n + b.examCount, 0)
  const totalQuestions = batches.reduce((n: number, b: any) => n + b.totalQuestions, 0)

  // Doctors & chapters for Custom Exam Builder
  const allExamIds = batches.flatMap((b: any) =>
    (b.exams ?? [])
      .filter((e: any) => e.status === 'published' && !e.deleted_at)
      .map((e: any) => e.id)
  )

  const [doctorsRes, qMeta] = await Promise.all([
    allExamIds.length > 0
      ? supabase.from('exam_doctors').select('doctor:doctors(id, name)').in('exam_id', allExamIds)
      : Promise.resolve({ data: [] }),
    allExamIds.length > 0
      ? supabase.from('questions').select('chapter_id, lecture_id, chapter:chapters(id, name), lecture:lectures(id, name)').in('exam_id', allExamIds).is('deleted_at', null)
      : Promise.resolve({ data: [] }),
  ])

  const doctorMap = new Map<string, string>()
  ;(doctorsRes.data ?? []).forEach((r: any) => {
    if (r.doctor) doctorMap.set(r.doctor.id, r.doctor.name)
  })
  const doctors = Array.from(doctorMap, ([id, name]) => ({ id, name }))
  const chapterMap = new Map<string, string>()
  const lectureMap = new Map<string, string>()
  ;(qMeta.data ?? []).forEach((q: any) => {
    const ch = Array.isArray(q.chapter) ? q.chapter[0] : q.chapter
    const le = Array.isArray(q.lecture) ? q.lecture[0] : q.lecture
    if (ch?.id) chapterMap.set(ch.id, ch.name)
    if (le?.id) lectureMap.set(le.id, le.name)
  })
  const chapters = Array.from(chapterMap, ([id, name]) => ({ id, name }))
  const lectures = Array.from(lectureMap, ([id, name]) => ({ id, name }))

  // ── Derived values ─────────────────────────────────────────
  const maxQuestions = Math.max(1, ...batches.map((b: any) => b.totalQuestions))
  const spec = [
    { value: batches.length, label: batches.length === 1 ? 'Batch' : 'Batches' },
    { value: totalExams, label: totalExams === 1 ? 'Exam' : 'Exams' },
    { value: totalQuestions, label: totalQuestions === 1 ? 'Question' : 'Questions' },
    ...(doctors.length > 0 ? [{ value: doctors.length, label: doctors.length === 1 ? 'Doctor' : 'Doctors' }] : []),
  ]

  return (
    <div className="sp">
      {/* dangerouslySetInnerHTML keeps quotes and '>' in the CSS unescaped */}
      <style dangerouslySetInnerHTML={{ __html: SUBJECT_CSS }} />

      {/* ── Cover ───────────────────────────────────────────────────── */}
      <section className="sp-band">
        <div className="sp-glow" />
        <div className="sp-wrap sp-head">
          <nav aria-label="Breadcrumb" className="sp-crumbs a-fade">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {i > 0 && <ChevronRight size={12} strokeWidth={2.4} />}
                {crumb.href
                  ? <Link href={crumb.href}>{crumb.label}</Link>
                  : <b>{crumb.label}</b>}
              </span>
            ))}
          </nav>

          <div className="sp-cover">
            <div className="sp-title">
              <span className="sp-eyebrow a-rise">Subject</span>
              <h1 className="sp-h1 a-rise" style={stagger(1)}>{subjectName}</h1>
            </div>

            <div className="sp-spec a-rise" style={stagger(2)}>
              {spec.map(item => (
                <div key={item.label} className="sp-spec-item">
                  <span className="sp-spec-value">{item.value.toLocaleString()}</span>
                  <span className="sp-spec-label">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <main className="sp-wrap sp-main">

        {/* ── Batches ─────────────────────────────────────────────── */}
        <section className="sp-section">
          <div className="sp-section-head a-rise" style={stagger(1)}>
            <h2 className="sp-h2">Batches</h2>
            {batches.length > 0 && <span className="sp-hint">Pick a batch to see its exams</span>}
          </div>

          {batches.length > 0 ? (
            <div className="sp-batches">
              {batches.map((batch: any, i: number) => {
                const share = Math.round((batch.totalQuestions / maxQuestions) * 100)
                return (
                  <Link
                    key={batch.id}
                    href={`${basePath}/${batch.slug}`}
                    className="sp-batch lift a-rise"
                    style={stagger(Math.min(i + 2, 10))}
                  >
                    <div className="sp-batch-top">
                      <span className="sp-batch-num">{String(i + 1).padStart(2, '0')}</span>
                      <span className="sp-batch-text">
                        <span className="sp-batch-name">{batch.name}</span>
                        {batch.examCount > 0 ? (
                          <span className="sp-batch-meta">
                            {batch.examCount} exam{batch.examCount !== 1 ? 's' : ''} · {batch.totalQuestions.toLocaleString()} questions
                          </span>
                        ) : (
                          <span className="sp-batch-meta sp-batch-empty">No exams yet</span>
                        )}
                      </span>
                      <span className="sp-batch-go"><ArrowUpRight size={15} strokeWidth={2.4} /></span>
                    </div>
                    <div className="sp-track">
                      <i className="sp-fill a-grow" style={{ ...stagger(i), width: `${share}%` }} />
                    </div>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="sp-empty">
              <h3>No batches available</h3>
              <p>Batches will appear here once added by an administrator.</p>
            </div>
          )}
        </section>

        {/* ── Custom exam (always visible beside the batches) ───────── */}
        {allExamIds.length > 0 && (
          <aside className="sp-aside">
            <CustomExamBuilder
              subjectId={subjectId}
              batches={batches.map((b: any) => ({ id: b.id, name: b.name }))}
              doctors={doctors}
              chapters={chapters}
              lectures={lectures}
              basePath={basePath}
            />
          </aside>
        )}
      </main>
    </div>
  )
}