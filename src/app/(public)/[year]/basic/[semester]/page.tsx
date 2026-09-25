import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronRight, ArrowUpRight, BookOpen } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase/server'

interface PageProps {
  params: Promise<{ year: string; semester: string }>
}

/** Stagger index for the shared animation classes in globals.css */
const stagger = (i: number): React.CSSProperties =>
  ({ ['--i' as string]: i } as React.CSSProperties)

/** One accent per card, cycling: brand → blue → purple */
const TONES = [
  { fg: 'var(--clr-primary)', bg: 'var(--clr-soft)' },
  { fg: 'var(--tone-blue-fg)', bg: 'var(--tone-blue-bg)' },
  { fg: 'var(--tone-purple-fg)', bg: 'var(--tone-purple-bg)' },
]

// ── Styles ─────────────────────────────────────────────────────────────────────

const SEMESTER_CSS = `
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

  /* ── Responsive ── */
  @media (max-width: 960px) {
    .sm-cover { grid-template-columns: 1fr; gap: 22px; align-items: start; }
    .sm-grid { gap: 14px; }
    .sm-card { min-height: 250px; padding: 20px; }
    .sm-name { font-size: 21px; }
  }
  @media (max-width: 760px) {
    .sm-grid { grid-template-columns: 1fr; }
    .sm-card { min-height: 0; }
  }
  @media (max-width: 640px) {
    .sm-wrap { padding: 0 16px; }
    .sm-band { padding: 18px 0 22px; }
    .sm-head { gap: 18px; }
    .sm-lead { font-size: 14px; }
    .sm-spec-item { padding: 0 18px; }
    .sm-spec-value { font-size: 24px; }
    .sm-spec-label { font-size: 10px; letter-spacing: 0.06em; }
    .sm-main { padding-top: 20px; padding-bottom: 56px; gap: 12px; }
    .sm-h2 { font-size: 18px; }
    .sm-hint { display: none; }

    .sm-grid { grid-template-columns: 1fr; gap: 12px; }
    .sm-card { min-height: 0; gap: 18px; padding: 18px; border-radius: 20px; }
    .sm-icon { width: 44px; height: 44px; border-radius: 13px; }
    .sm-go { width: 36px; height: 36px; }
    .sm-name { font-size: 20px; }
    .sm-mark { font-size: 120px; bottom: -24px; }
    .sm-stats, .sm-soon { padding-top: 14px; }
    .sm-stat-value { font-size: 22px; }
  }
`

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function BasicSemesterPage({ params }: PageProps) {
  const { year: yearSlug, semester: semSlug } = await params
  const supabase = await createServerSupabaseClient()

  const { data: academicYear } = await supabase
    .from('academic_years')
    .select('id, name, is_clinical')
    .eq('slug', yearSlug)
    .single()

  if (!academicYear || academicYear.is_clinical) notFound()

  const { data: semesterData } = await supabase
    .from('semesters')
    .select('id, name')
    .eq('academic_year_id', academicYear.id)
    .eq('slug', semSlug)
    .single()

  if (!semesterData) notFound()

  const { data: rawSubjects } = await supabase
    .from('subjects')
    .select('id, name, slug, display_order, batches(id, exams(id, question_count, status, deleted_at))')
    .eq('semester_id', semesterData.id)
    .order('display_order', { ascending: true })

  const subjects = (rawSubjects || []).map((s: any) => {
    const exams = (s.batches ?? [])
      .flatMap((b: any) => b.exams ?? [])
      .filter((e: any) => e.status === 'published' && !e.deleted_at)
    return {
      ...s,
      examCount: exams.length,
      questionCount: exams.reduce((n: number, e: any) => n + (e.question_count ?? 0), 0),
    }
  })

  // ── Derived values ─────────────────────────────────────────
  const totalExams = subjects.reduce((n: number, s: any) => n + s.examCount, 0)
  const totalQuestions = subjects.reduce((n: number, s: any) => n + s.questionCount, 0)
  const spec = [
    { value: subjects.length, label: subjects.length === 1 ? 'Subject' : 'Subjects' },
    { value: totalExams, label: totalExams === 1 ? 'Exam' : 'Exams' },
    { value: totalQuestions, label: totalQuestions === 1 ? 'Question' : 'Questions' },
  ]

  return (
    <div className="sm">
      {/* dangerouslySetInnerHTML keeps quotes and '>' in the CSS unescaped */}
      <style dangerouslySetInnerHTML={{ __html: SEMESTER_CSS }} />

      {/* ── Cover ───────────────────────────────────────────────────── */}
      <section className="sm-band">
        <div className="sm-glow" />
        <div className="sm-wrap sm-head">
          <nav aria-label="Breadcrumb" className="sm-crumbs a-fade">
            <Link href="/">Home</Link>
            <ChevronRight size={12} strokeWidth={2.4} />
            <Link href={`/${yearSlug}`}>{academicYear.name}</Link>
            <ChevronRight size={12} strokeWidth={2.4} />
            <b>{semesterData.name}</b>
          </nav>

          <div className="sm-cover">
            <div className="sm-title">
              <span className="sm-eyebrow a-rise">Semester <span>· {academicYear.name}</span></span>
              <h1 className="sm-h1 a-rise" style={stagger(1)}>{semesterData.name}</h1>
              <p className="sm-lead a-rise" style={stagger(2)}>Select a subject to browse batches and exams</p>
            </div>

            {subjects.length > 0 && (
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

      {/* ── Subjects ────────────────────────────────────────────────── */}
      <main className="sm-wrap sm-main">
        <div className="sm-section-head a-rise" style={stagger(2)}>
          <h2 className="sm-h2">Subjects</h2>
          {subjects.length > 0 && <span className="sm-hint">Pick a subject to start</span>}
        </div>

        {subjects.length > 0 ? (
          <div className="sm-grid">
            {subjects.map((subject: any, i: number) => {
              const tone = TONES[i % TONES.length]
              const num = String(i + 1).padStart(2, '0')
              return (
                <Link
                  key={subject.id}
                  href={`/${yearSlug}/basic/${semSlug}/${subject.slug}`}
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
                    <span className="sm-name">{subject.name}</span>
                  </span>

                  {subject.examCount > 0 ? (
                    <span className="sm-stats">
                      <span className="sm-stat">
                        <span className="sm-stat-value">{subject.examCount.toLocaleString()}</span>
                        <span className="sm-stat-label">{subject.examCount === 1 ? 'Exam' : 'Exams'}</span>
                      </span>
                      <span className="sm-stat">
                        <span className="sm-stat-value">{subject.questionCount.toLocaleString()}</span>
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
        ) : (
          <div className="sm-empty a-rise" style={stagger(3)}>
            <span className="sm-empty-icon"><BookOpen size={22} /></span>
            <h3>No subjects available</h3>
            <p>Subjects will appear here once added by an administrator.</p>
          </div>
        )}
      </main>
    </div>
  )
}