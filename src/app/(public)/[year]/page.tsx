// src/app/(public)/[year]/page.tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ChevronRight, ArrowUpRight, ArrowRight, BookOpen, Leaf, Flower2, Sun } from 'lucide-react'

interface PageProps {
  params: Promise<{ year: string }>
}

/** Stagger index for the shared animation classes in globals.css */
const stagger = (i: number): React.CSSProperties =>
  ({ ['--i' as string]: i } as React.CSSProperties)

/** Subject cards: one accent per card, cycling brand → blue → purple (same as the semester page) */
const TONES = [
  { fg: 'var(--clr-primary)', bg: 'var(--clr-soft)' },
  { fg: 'var(--tone-blue-fg)', bg: 'var(--tone-blue-bg)' },
  { fg: 'var(--tone-purple-fg)', bg: 'var(--tone-purple-bg)' },
]

/** Semester cards: each term gets its own season — autumn, spring, summer */
const TERMS = {
  first:  { Icon: Leaf,    tone: 'var(--clr-primary)',    season: 'Autumn term' },
  second: { Icon: Flower2, tone: 'var(--tone-green-fg)',  season: 'Spring term' },
  summer: { Icon: Sun,     tone: 'var(--tone-amber-fg)',  season: 'Summer term' },
}
const termOf = (sem: { name?: string; slug?: string }, i: number) => {
  if (/summer|صيف/i.test(`${sem.name ?? ''} ${sem.slug ?? ''}`)) return TERMS.summer
  return i === 0 ? TERMS.first : i === 1 ? TERMS.second : TERMS.summer
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const YEAR_CSS = `
  .sm { min-height: 100vh; background: var(--bg); color: var(--fg); font-family: "Plus Jakarta Sans", system-ui, sans-serif; }
  .sm-wrap { max-width: 1120px; margin: 0 auto; padding: 0 24px; }

  /* ── Cover ── */
  .sm-band { position: relative; overflow: hidden; background-color: var(--bg-elev); border-bottom: 1px solid var(--bd); padding: 22px 0 28px; }
  .sm-band::before {
    content: ''; position: absolute; inset: 0; pointer-events: none;
    background-image: radial-gradient(color-mix(in srgb, var(--clr-primary) 9%, transparent) 1px, transparent 1px);
    background-size: 26px 26px;
    -webkit-mask-image: linear-gradient(180deg, #000 0%, transparent 85%);
            mask-image: linear-gradient(180deg, #000 0%, transparent 85%);
  }
  .sm-glow {
    position: absolute; top: -220px; right: -120px; width: 620px; height: 620px; border-radius: 50%;
    background: radial-gradient(circle, color-mix(in srgb, var(--clr-primary) 14%, transparent), transparent 68%);
    pointer-events: none;
  }
  .sm-head { position: relative; display: flex; flex-direction: column; gap: 22px; }
  .sm-crumbs { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: var(--fg-muted); }
  .sm-crumbs a { color: var(--fg-muted); text-decoration: none; transition: color var(--dur-2); }
  .sm-crumbs a:hover { color: var(--clr-primary); }
  .sm-crumbs b { color: var(--fg); font-weight: 700; }
  .sm-crumbs svg { flex-shrink: 0; }

  .sm-cover { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 40px; align-items: end; }
  .sm-title { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
  .sm-eyebrow { display: inline-flex; align-items: center; gap: 10px; font-size: 12.5px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--clr-primary); }
  .sm-eyebrow::before { content: ''; width: 22px; height: 2px; border-radius: 2px; background: currentColor; }
  .sm-eyebrow span { margin-left: -4px; color: var(--fg-muted); }
  .sm-h1 { margin: 0; font-size: clamp(32px, 4.6vw, 52px); line-height: 1; font-weight: 800; letter-spacing: -0.045em; overflow-wrap: anywhere; }
  .sm-lead { margin: 0; font-size: 15px; font-weight: 500; color: var(--fg-muted); }

  .sm-spec { display: flex; align-items: stretch; }
  .sm-spec-item { display: flex; flex-direction: column; gap: 6px; padding: 0 26px; border-left: 1px solid var(--bd); }
  .sm-spec-item:first-child { padding-left: 0; border-left: none; }
  .sm-spec-item:last-child { padding-right: 0; }
  .sm-spec-value { font-size: 34px; font-weight: 800; letter-spacing: -0.04em; line-height: 1; white-space: nowrap; }
  .sm-spec-label { font-size: 11.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--fg-muted); white-space: nowrap; }

  /* ── Subjects ── */
  .sm-main { display: flex; flex-direction: column; gap: 16px; padding-top: 32px; padding-bottom: 80px; }
  .sm-section-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
  .sm-h2 { margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.01em; }
  .sm-hint { font-size: 13px; font-weight: 600; color: var(--fg-muted); }

  .sm-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; }

  .sm-card {
    position: relative; overflow: hidden; isolation: isolate;
    display: flex; flex-direction: column; gap: 22px; min-height: 290px; padding: 24px;
    border-radius: 24px; background: var(--bg-elev); border: 1px solid var(--bd);
    color: var(--fg); text-decoration: none;
    transition: border-color var(--dur-2), box-shadow var(--dur-3) var(--ease-out);
  }
  .sm-card:hover { border-color: color-mix(in srgb, var(--tone) 45%, var(--bd)); box-shadow: 0 22px 48px var(--shadow); }
  /* soft tinted light in the top corner */
  .sm-card::before {
    content: ''; position: absolute; z-index: -1; top: -120px; right: -90px; width: 300px; height: 300px; border-radius: 50%;
    background: radial-gradient(circle, color-mix(in srgb, var(--tone) 16%, transparent), transparent 70%);
    transition: transform var(--dur-4) var(--ease-out);
  }
  .sm-card:hover::before { transform: scale(1.25); }
  /* oversized watermark number */
  .sm-mark {
    position: absolute; z-index: -1; right: 14px; bottom: -34px;
    font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 170px; font-weight: 600; line-height: 1; letter-spacing: -0.06em;
    color: color-mix(in srgb, var(--tone) 6%, transparent); pointer-events: none; user-select: none;
    transition: color var(--dur-3), transform var(--dur-4) var(--ease-out);
  }
  .sm-card:hover .sm-mark { color: color-mix(in srgb, var(--tone) 11%, transparent); transform: translateY(-6px); }
  .dark .sm-mark { color: color-mix(in srgb, var(--tone) 4%, transparent); }
  .dark .sm-card:hover .sm-mark { color: color-mix(in srgb, var(--tone) 8%, transparent); }
  .sm-stats, .sm-soon { position: relative; }

  .sm-card-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .sm-icon {
    width: 50px; height: 50px; border-radius: 15px; background: var(--tone-bg); color: var(--tone);
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .sm-go {
    width: 40px; height: 40px; border-radius: 50%; border: 1px solid var(--bd); color: var(--fg-muted); background: var(--bg-elev);
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    transition: background-color var(--dur-2), color var(--dur-2), border-color var(--dur-2), transform var(--dur-3) var(--ease-spring);
  }
  .sm-card:hover .sm-go { background: var(--tone); border-color: var(--tone); color: #fff; transform: rotate(45deg); }

  .sm-card-body { display: flex; flex-direction: column; gap: 8px; flex: 1 1 auto; }
  .sm-num { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 12.5px; font-weight: 600; letter-spacing: 0.04em; color: var(--tone); }
  .sm-name { font-size: 24px; font-weight: 800; letter-spacing: -0.03em; line-height: 1.15; overflow-wrap: anywhere; }

  .sm-stats { display: grid; grid-template-columns: 1fr 1fr; padding-top: 18px; border-top: 1px solid var(--bd); }
  .sm-stat { display: flex; flex-direction: column; gap: 4px; }
  .sm-stat + .sm-stat { padding-left: 18px; border-left: 1px solid var(--bd); }
  .sm-stat-value { font-size: 26px; font-weight: 800; letter-spacing: -0.04em; line-height: 1; }
  .sm-stat-label { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--fg-muted); }
  .sm-soon { display: inline-flex; align-items: center; gap: 8px; padding-top: 18px; border-top: 1px solid var(--bd); font-size: 13px; font-weight: 700; color: var(--fg-faint); }
  .sm-soon::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: var(--bd-strong); }

  .sm-empty {
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
    border-radius: 20px; border: 1.5px dashed var(--bd-strong); padding: 64px 24px; text-align: center;
  }
  .sm-empty-icon {
    width: 52px; height: 52px; border-radius: 15px; background: var(--bg-soft); color: var(--fg-faint);
    display: flex; align-items: center; justify-content: center; margin-bottom: 4px;
  }
  .sm-empty h3 { margin: 0; font-size: 17px; font-weight: 800; }
  .sm-empty p { margin: 0; font-size: 14px; color: var(--fg-muted); }

  /* ── Semester (term) cards ── */
  .ys-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; }
  .ys-card {
    position: relative; overflow: hidden; isolation: isolate;
    display: flex; flex-direction: column; min-height: 380px; padding: 26px;
    border-radius: 26px; background: var(--bg-elev); border: 1px solid var(--bd);
    color: var(--fg); text-decoration: none;
    transition: border-color var(--dur-2), box-shadow var(--dur-3) var(--ease-out);
  }
  .ys-card:hover { border-color: color-mix(in srgb, var(--tone) 45%, var(--bd)); box-shadow: 0 26px 56px var(--shadow); }
  /* seasonal wash: tinted light from the top + a faint band at the bottom */
  .ys-card::before {
    content: ''; position: absolute; inset: 0; z-index: -2; pointer-events: none;
    background:
      radial-gradient(120% 70% at 100% 0%, color-mix(in srgb, var(--tone) 17%, transparent), transparent 60%),
      linear-gradient(180deg, transparent 55%, color-mix(in srgb, var(--tone) 5%, transparent));
    transition: opacity var(--dur-3);
  }
  /* big seasonal icon drifting in the corner */
  .ys-art {
    position: absolute; z-index: -1; top: -34px; right: -34px; color: var(--tone); opacity: .11; pointer-events: none;
    transition: transform var(--dur-4) var(--ease-out), opacity var(--dur-3);
  }
  .ys-card:hover .ys-art { transform: rotate(-12deg) scale(1.08); opacity: .18; }
  .dark .ys-art { opacity: .09; }
  .dark .ys-card:hover .ys-art { opacity: .15; }

  .ys-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .ys-icon {
    width: 52px; height: 52px; border-radius: 16px; background: var(--tone); color: #fff;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    box-shadow: 0 10px 22px color-mix(in srgb, var(--tone) 30%, transparent);
  }
  .ys-steps { display: flex; align-items: center; gap: 5px; }
  .ys-steps i { width: 18px; height: 5px; border-radius: 999px; background: var(--bd-strong); }
  .ys-steps i.on { width: 30px; background: var(--tone); }

  .ys-body { display: flex; flex-direction: column; justify-content: flex-end; gap: 8px; flex: 1 1 auto; padding: 34px 0 24px; }
  .ys-kicker { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 12.5px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--tone); }
  .ys-name { font-size: 30px; font-weight: 800; letter-spacing: -0.035em; line-height: 1.08; overflow-wrap: anywhere; }
  .ys-season { font-size: 13.5px; font-weight: 600; color: var(--fg-muted); }

  .ys-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); padding: 18px 0; border-top: 1px solid var(--bd); }
  .ys-stat { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .ys-stat + .ys-stat { padding-left: 16px; border-left: 1px solid var(--bd); }
  .ys-stat-value { font-size: 24px; font-weight: 800; letter-spacing: -0.04em; line-height: 1; }
  .ys-stat-label { font-size: 10.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--fg-muted); }

  .ys-cta {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    padding: 12px 12px 12px 18px; border-radius: 16px; background: var(--bg-soft); border: 1px solid var(--bd);
    font-size: 14px; font-weight: 800; white-space: nowrap; transition: background-color var(--dur-2), border-color var(--dur-2), color var(--dur-2);
  }
  .ys-cta-go {
    width: 34px; height: 34px; border-radius: 50%; background: var(--bg-elev); border: 1px solid var(--bd); color: var(--fg);
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    transition: transform var(--dur-3) var(--ease-spring), background-color var(--dur-2), color var(--dur-2);
  }
  .ys-card:hover .ys-cta { background: var(--tone); border-color: var(--tone); color: #fff; }
  .ys-card:hover .ys-cta-go { background: #fff; border-color: #fff; color: var(--tone); transform: translateX(2px) rotate(-45deg); }
  /* dark mode tones are light, so put dark ink on them */
  .dark .ys-icon { color: var(--bg); }
  .dark .ys-card:hover .ys-cta { color: var(--bg); }
  .dark .ys-card:hover .ys-cta-go { background: var(--bg); border-color: var(--bg); color: var(--tone); }

  /* ── Responsive ── */
  @media (max-width: 960px) {
    .sm-cover { grid-template-columns: 1fr; gap: 22px; align-items: start; }
    .sm-grid { gap: 14px; }
    .sm-card { min-height: 250px; padding: 20px; }
    .sm-name { font-size: 21px; }
    .ys-grid { gap: 14px; }
    .ys-card { min-height: 340px; padding: 20px; }
    .ys-name { font-size: 24px; }
    .ys-stat + .ys-stat { padding-left: 10px; }
    .ys-stat-value { font-size: 20px; }
    .ys-stat-label { font-size: 9.5px; letter-spacing: 0.05em; }
  }
  @media (max-width: 760px) {
    .sm-grid, .ys-grid { grid-template-columns: 1fr; }
    .sm-card, .ys-card { min-height: 0; }
    .ys-body { padding: 26px 0 18px; }
    .ys-stat + .ys-stat { padding-left: 16px; }
    .ys-stat-value { font-size: 22px; }
    .ys-stat-label { font-size: 10px; }
  }
  @media (max-width: 640px) {
    .sm-wrap { padding: 0 16px; }
    .sm-band { padding: 18px 0 22px; }
    .sm-head { gap: 18px; }
    .sm-lead { font-size: 14px; }
    .sm-spec-item { padding: 0 16px; }
    .sm-spec-value { font-size: 24px; }
    .sm-spec-label { font-size: 10px; letter-spacing: 0.06em; }
    .sm-main { padding-top: 20px; padding-bottom: 56px; gap: 12px; }
    .sm-h2 { font-size: 18px; }
    .sm-hint { display: none; }

    .sm-grid, .ys-grid { gap: 12px; }
    .sm-card { gap: 18px; padding: 18px; border-radius: 20px; }
    .sm-icon { width: 44px; height: 44px; border-radius: 13px; }
    .sm-go { width: 36px; height: 36px; }
    .sm-name { font-size: 20px; }
    .sm-mark { font-size: 120px; bottom: -24px; }
    .sm-stats, .sm-soon { padding-top: 14px; }
    .sm-stat-value { font-size: 22px; }

    .ys-card { padding: 18px; border-radius: 22px; }
    .ys-icon { width: 46px; height: 46px; border-radius: 14px; }
    .ys-body { padding: 22px 0 16px; }
    .ys-name { font-size: 24px; }
    .ys-stats { padding: 14px 0; }
    .ys-art svg { width: 150px; height: 150px; }
  }
`

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function YearPage({ params }: PageProps) {
  const { year: yearSlug } = await params
  const supabase = await createServerSupabaseClient()

  const { data: academicYear } = await supabase
    .from('academic_years')
    .select('id, name, is_clinical')
    .eq('slug', yearSlug)
    .single()

  if (!academicYear) notFound()

  // ── PRE-CLINICAL → show semesters ─────────────────────────────────────────
  if (!academicYear.is_clinical) {
    const { data: semesters } = await supabase
      .from('semesters')
      .select('id, name, slug, display_order')
      .eq('academic_year_id', academicYear.id)
      .order('display_order', { ascending: true })

    const semList = semesters || []

    // Numbers for each semester card (subjects / exams / questions).
    // Separate query so the semester list above never depends on it.
    const { data: semSubjects } = semList.length > 0
      ? await supabase
          .from('subjects')
          .select('id, semester_id, batches(id, exams(id, question_count, status, deleted_at))')
          .in('semester_id', semList.map(s => s.id))
      : { data: [] as any[] }

    const statsBySem = new Map<string, { subjects: number; exams: number; questions: number }>()
    ;(semSubjects ?? []).forEach((s: any) => {
      const exams = (s.batches ?? [])
        .flatMap((b: any) => b.exams ?? [])
        .filter((e: any) => e.status === 'published' && !e.deleted_at)
      const cur = statsBySem.get(s.semester_id) ?? { subjects: 0, exams: 0, questions: 0 }
      cur.subjects += 1
      cur.exams += exams.length
      cur.questions += exams.reduce((n: number, e: any) => n + (e.question_count ?? 0), 0)
      statsBySem.set(s.semester_id, cur)
    })
    const totals = Array.from(statsBySem.values()).reduce(
      (t, s) => ({ subjects: t.subjects + s.subjects, exams: t.exams + s.exams, questions: t.questions + s.questions }),
      { subjects: 0, exams: 0, questions: 0 }
    )
    const spec = [
      { value: semList.length, label: semList.length === 1 ? 'Semester' : 'Semesters' },
      { value: totals.subjects, label: totals.subjects === 1 ? 'Subject' : 'Subjects' },
      { value: totals.exams, label: totals.exams === 1 ? 'Exam' : 'Exams' },
      { value: totals.questions, label: totals.questions === 1 ? 'Question' : 'Questions' },
    ]

    return (
      <PageShell>
        <Cover
          yearName={academicYear.name}
          kind="Pre-clinical"
          lead="Select a semester to browse subjects"
          spec={semList.length > 0 ? spec : []}
        />

        <main className="sm-wrap sm-main">
          <div className="sm-section-head a-rise" style={stagger(2)}>
            <h2 className="sm-h2">Semesters</h2>
            {semList.length > 0 && <span className="sm-hint">Pick a semester to start</span>}
          </div>

          {semList.length > 0 ? (
            <div className="ys-grid">
              {semList.map((sem, i) => {
                const term = termOf(sem, i)
                const st = statsBySem.get(sem.id) ?? { subjects: 0, exams: 0, questions: 0 }
                return (
                  <Link
                    key={sem.id}
                    href={`/${yearSlug}/basic/${sem.slug}`}
                    className="ys-card lift a-rise"
                    style={{ ...stagger(Math.min(i + 3, 12)), ['--tone' as string]: term.tone } as React.CSSProperties}
                  >
                    <span className="ys-art" aria-hidden="true"><term.Icon size={200} strokeWidth={1.25} /></span>

                    <span className="ys-top">
                      <span className="ys-icon"><term.Icon size={23} /></span>
                      <span className="ys-steps" aria-label={`Semester ${i + 1} of ${semList.length}`}>
                        {semList.map((_, k) => <i key={k} className={k === i ? 'on' : undefined} />)}
                      </span>
                    </span>

                    <span className="ys-body">
                      <span className="ys-kicker">Term {String(i + 1).padStart(2, '0')}</span>
                      <span className="ys-name">{sem.name}</span>
                      <span className="ys-season">{term.season}</span>
                    </span>

                    <span className="ys-stats">
                      <span className="ys-stat">
                        <span className="ys-stat-value">{st.subjects.toLocaleString()}</span>
                        <span className="ys-stat-label">{st.subjects === 1 ? 'Subject' : 'Subjects'}</span>
                      </span>
                      <span className="ys-stat">
                        <span className="ys-stat-value">{st.exams.toLocaleString()}</span>
                        <span className="ys-stat-label">{st.exams === 1 ? 'Exam' : 'Exams'}</span>
                      </span>
                      <span className="ys-stat">
                        <span className="ys-stat-value">{st.questions.toLocaleString()}</span>
                        <span className="ys-stat-label">Questions</span>
                      </span>
                    </span>

                    <span className="ys-cta">
                      Browse subjects
                      <span className="ys-cta-go"><ArrowRight size={16} strokeWidth={2.4} /></span>
                    </span>
                  </Link>
                )
              })}
            </div>
          ) : <EmptyState title="No semesters available" />}
        </main>
      </PageShell>
    )
  }

  // ── CLINICAL → show subjects directly ─────────────────────────────────────
  const { data: rawSubjects } = await supabase
    .from('subjects')
    .select('id, name, slug, display_order, batches(id, exams(id, question_count, status, deleted_at))')
    .eq('year_id', academicYear.id)
    .order('display_order', { ascending: true })

  const subjects = (rawSubjects || []).map(s => {
    const exams = (s.batches ?? [])
      .flatMap((b: any) => b.exams ?? [])
      .filter((e: any) => e.status === 'published' && !e.deleted_at)
    return { ...s, examCount: exams.length, questionCount: exams.reduce((n: number, e: any) => n + (e.question_count ?? 0), 0) }
  })

  const totalExams = subjects.reduce((n: number, s: any) => n + s.examCount, 0)
  const totalQuestions = subjects.reduce((n: number, s: any) => n + s.questionCount, 0)
  const spec = [
    { value: subjects.length, label: subjects.length === 1 ? 'Subject' : 'Subjects' },
    { value: totalExams, label: totalExams === 1 ? 'Exam' : 'Exams' },
    { value: totalQuestions, label: totalQuestions === 1 ? 'Question' : 'Questions' },
  ]

  return (
    <PageShell>
      <Cover
        yearName={academicYear.name}
        kind="Clinical"
        lead="Select a subject to browse exams"
        spec={subjects.length > 0 ? spec : []}
      />

      <main className="sm-wrap sm-main">
        <div className="sm-section-head a-rise" style={stagger(2)}>
          <h2 className="sm-h2">Subjects</h2>
          {subjects.length > 0 && <span className="sm-hint">Pick a subject to start</span>}
        </div>

        {subjects.length > 0 ? (
          <div className="sm-grid">
            {subjects.map((sub: any, i: number) => {
              const tone = TONES[i % TONES.length]
              const num = String(i + 1).padStart(2, '0')
              return (
                <Link
                  key={sub.id}
                  href={`/${yearSlug}/clinical/${sub.slug}`}
                  className="sm-card lift a-rise"
                  style={{ ...stagger(Math.min(i + 3, 12)), ['--tone' as string]: tone.fg, ['--tone-bg' as string]: tone.bg } as React.CSSProperties}
                >
                  <span className="sm-mark" aria-hidden="true">{num}</span>

                  <span className="sm-card-top">
                    <span className="sm-icon"><BookOpen size={22} /></span>
                    <span className="sm-go"><ArrowUpRight size={17} strokeWidth={2.4} /></span>
                  </span>

                  <span className="sm-card-body">
                    <span className="sm-num">SUBJECT {num}</span>
                    <span className="sm-name">{sub.name}</span>
                  </span>

                  {sub.examCount > 0 ? (
                    <span className="sm-stats">
                      <span className="sm-stat">
                        <span className="sm-stat-value">{sub.examCount.toLocaleString()}</span>
                        <span className="sm-stat-label">{sub.examCount === 1 ? 'Exam' : 'Exams'}</span>
                      </span>
                      <span className="sm-stat">
                        <span className="sm-stat-value">{sub.questionCount.toLocaleString()}</span>
                        <span className="sm-stat-label">Questions</span>
                      </span>
                    </span>
                  ) : (
                    <span className="sm-soon">No exams yet</span>
                  )}
                </Link>
              )
            })}
          </div>
        ) : <EmptyState title="No subjects available" />}
      </main>
    </PageShell>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="sm">
      {/* dangerouslySetInnerHTML keeps quotes and '>' in the CSS unescaped */}
      <style dangerouslySetInnerHTML={{ __html: YEAR_CSS }} />
      {children}
    </div>
  )
}

function Cover({ yearName, kind, lead, spec }: {
  yearName: string
  kind: string
  lead: string
  spec: { value: number; label: string }[]
}) {
  return (
    <section className="sm-band">
      <div className="sm-glow" />
      <div className="sm-wrap sm-head">
        <nav aria-label="Breadcrumb" className="sm-crumbs a-fade">
          <Link href="/">Home</Link>
          <ChevronRight size={12} strokeWidth={2.4} />
          <b>{yearName}</b>
        </nav>

        <div className="sm-cover">
          <div className="sm-title">
            <span className="sm-eyebrow a-rise">Academic year <span>· {kind}</span></span>
            <h1 className="sm-h1 a-rise" style={stagger(1)}>{yearName}</h1>
            <p className="sm-lead a-rise" style={stagger(2)}>{lead}</p>
          </div>

          {spec.length > 0 && (
            <div className="sm-spec a-rise" style={stagger(2)}>
              {spec.map(item => (
                <div key={item.label} className="sm-spec-item">
                  <span className="sm-spec-value">{item.value.toLocaleString()}</span>
                  <span className="sm-spec-label">{item.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function EmptyState({ title }: { title: string }) {
  return (
    <div className="sm-empty a-rise" style={stagger(3)}>
      <span className="sm-empty-icon"><BookOpen size={22} /></span>
      <h3>{title}</h3>
      <p>Content will appear here once added by an administrator.</p>
    </div>
  )
}