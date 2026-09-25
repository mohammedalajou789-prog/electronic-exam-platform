import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'

interface AcademicYearsSectionProps {
  title?: string
  subtitle?: string
}

interface YearCard {
  id: string
  name: string
  slug: string
  num: string
  stage: string
  clinical: boolean
}

interface Phase {
  name: string
  range: string
  clinical: boolean
  years: YearCard[]
}

export default async function AcademicYearsSection({
  title = 'Academic years',
  subtitle = 'Pick your year to get started',
}: AcademicYearsSectionProps): Promise<React.JSX.Element> {
  const supabase = await createServerSupabaseClient()

  const { data } = await supabase
    .from('academic_years')
    .select('id, name, slug, display_order, is_clinical')
    .order('display_order')

  const years: YearCard[] = (data ?? []).map((y, i) => ({
    id: y.id,
    name: y.name,
    slug: y.slug,
    num: String(i + 1).padStart(2, '0'),
    stage: y.is_clinical ? 'Clinical' : 'Pre-Clinical',
    clinical: Boolean(y.is_clinical),
  }))

  const preYears = years.filter(y => !y.clinical)
  const cliYears = years.filter(y => y.clinical)

  const phases: Phase[] = []
  if (preYears.length > 0) {
    phases.push({
      name: 'Pre-Clinical',
      range: `Years 1â€“${preYears.length}`,
      clinical: false,
      years: preYears,
    })
  }
  if (cliYears.length > 0) {
    phases.push({
      name: 'Clinical',
      range: `Years ${preYears.length + 1}â€“${years.length}`,
      clinical: true,
      years: cliYears,
    })
  }

  return (
    <section id="years" className="ay-section">
      <style>{`
        .ay-section {
          padding: 72px 40px;
          background: var(--bg-elev);
          border-top: 1px solid var(--bd);
          font-family: "Plus Jakarta Sans", system-ui, sans-serif;
        }
        .ay-inner { max-width: 1280px; margin: 0 auto; display: flex; flex-direction: column; gap: 36px; }
        .ay-mono  { font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace; }

        /* â”€â”€ Head â”€â”€ */
        .ay-head    { display: flex; align-items: flex-end; justify-content: space-between; gap: 40px; flex-wrap: wrap; }
        .ay-eyebrow { font-size: 12.5px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--clr-primary); }
        .ay-title   { margin: 0; font-size: 36px; font-weight: 800; letter-spacing: -0.03em; line-height: 1.1; }
        .ay-sub     { margin: 0; font-size: 15px; color: var(--fg-muted); }
        .ay-legend  { display: flex; align-items: center; gap: 18px; font-size: 13px; font-weight: 600; color: var(--fg-muted); }
        .ay-legend span { display: inline-flex; align-items: center; gap: 8px; }
        .ay-swatch  { width: 12px; height: 12px; border-radius: 4px; border: 2px solid; }

        /* â”€â”€ Layout â”€â”€ */
        .ay-grid  { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 16px; align-items: start; }
        .ay-phase { display: flex; flex-direction: column; gap: 10px; }
        .ay-phase-head { display: flex; align-items: baseline; justify-content: space-between; padding: 0 2px; }
        .ay-phase-name { font-size: 12.5px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
        .ay-phase-range { font-size: 12px; font-weight: 600; color: var(--fg-muted); }
        .ay-phase-bar  { height: 4px; border-radius: 999px; }
        .ay-phase-years { display: grid; gap: 16px; }

        /* â”€â”€ Card â”€â”€ */
        .ay-card {
          position: relative; overflow: hidden; box-sizing: border-box;
          height: 236px; padding: 20px; border-radius: 20px;
          text-decoration: none; border: 1px solid;
          display: grid; grid-template-columns: 1fr auto;
          grid-template-areas: "label arrow" "num num" "meta meta";
          align-content: space-between;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .ay-card:hover { transform: translateY(-3px); }

        .ay-card-pre {
          background: var(--bg-elev); color: var(--fg);
          border-color: var(--bd); box-shadow: 0 10px 26px var(--shadow);
        }
        .ay-card-cli {
          background: var(--panel-dark); color: var(--panel-dark-fg);
          border-color: var(--panel-dark); box-shadow: 0 14px 30px var(--shadow);
        }

        .ay-glow { position: absolute; right: -40px; bottom: -40px; width: 140px; height: 140px; border-radius: 50%; pointer-events: none; }

        .ay-label { grid-area: label; position: relative; font-size: 11.5px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; }
        .ay-arrow { grid-area: arrow; position: relative; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
        .ay-num   { grid-area: num; position: relative; font-size: 76px; font-weight: 800; letter-spacing: -0.05em; line-height: 0.9; }
        .ay-meta  { grid-area: meta; position: relative; display: flex; flex-direction: column; gap: 3px; min-width: 0; }
        .ay-name  { font-size: 16px; font-weight: 800; letter-spacing: -0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ay-stage { font-size: 12.5px; font-weight: 600; }

        .ay-icon-desktop { display: block; }
        .ay-icon-mobile  { display: none; }

        /* â”€â”€ Empty â”€â”€ */
        .ay-empty {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 8px; padding: 64px 24px; border: 1.5px dashed var(--bd);
          border-radius: 20px; text-align: center;
        }

        /* â”€â”€ Mobile â”€â”€ */
        @media (max-width: 860px) {
          .ay-section { padding: 36px 18px 40px; }
          .ay-inner   { gap: 26px; }
          .ay-title   { font-size: 26px; }
          .ay-sub     { font-size: 14px; }
          .ay-legend  { display: none; }

          .ay-grid    { grid-template-columns: 1fr; gap: 26px; }
          .ay-phase   { grid-column: span 1 !important; }
          .ay-phase-years { grid-template-columns: 1fr !important; gap: 8px; }
          .ay-phase-bar   { display: none; }

          .ay-card {
            height: auto; min-height: 64px; padding: 10px 12px 10px 10px;
            border-radius: 16px; align-items: center;
            grid-template-columns: auto minmax(0, 1fr) auto;
            grid-template-areas: "num meta arrow";
            gap: 14px;
          }
          .ay-card:hover { transform: none; }
          .ay-label { display: none; }
          .ay-glow  { display: none; }
          .ay-num {
            width: 46px; height: 46px; border-radius: 13px;
            display: flex; align-items: center; justify-content: center;
            font-size: 20px; letter-spacing: -0.04em; line-height: 1;
          }
          .ay-arrow { width: 32px; height: 32px; }
          .ay-name  { font-size: 15px; }
          .ay-stage { font-size: 12px; }

          .ay-icon-desktop { display: none; }
          .ay-icon-mobile  { display: block; }
        }
      `}</style>

      <div className="ay-inner">
        <div className="ay-head">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="ay-eyebrow">Choose your year</span>
            <h2 className="ay-title">{title}</h2>
            <p className="ay-sub">{subtitle}</p>
          </div>
          <div className="ay-legend">
            <span>
              <span className="ay-swatch" style={{ background: 'var(--bg-elev)', borderColor: 'var(--clr-primary)' }} />
              Pre-Clinical
            </span>
            <span>
              <span className="ay-swatch" style={{ background: 'var(--panel-dark)', borderColor: 'var(--panel-dark)' }} />
              Clinical
            </span>
          </div>
        </div>

        {years.length > 0 ? (
          <div className="ay-grid">
            {phases.map(phase => {
              const accent = phase.clinical ? 'var(--panel-dark)' : 'var(--clr-primary)'
              return (
                <div
                  key={phase.name}
                  className="ay-phase"
                  style={{ gridColumn: `span ${phase.years.length}` }}
                >
                  <div className="ay-phase-head">
                    <span className="ay-phase-name" style={{ color: accent }}>{phase.name}</span>
                    <span className="ay-phase-range ay-mono">{phase.range}</span>
                  </div>
                  <div className="ay-phase-bar" style={{ background: accent }} />

                  <div
                    className="ay-phase-years"
                    style={{ gridTemplateColumns: `repeat(${phase.years.length}, minmax(0, 1fr))` }}
                  >
                    {phase.years.map(y => (
                      <Link
                        key={y.id}
                        href={`/${encodeURIComponent(y.slug)}`}
                        className={`ay-card ${y.clinical ? 'ay-card-cli' : 'ay-card-pre'}`}
                      >
                        <span
                          className="ay-glow"
                          style={{
                            background: y.clinical
                              ? 'radial-gradient(circle, color-mix(in srgb, var(--panel-accent) 30%, transparent), transparent 70%)'
                              : 'radial-gradient(circle, color-mix(in srgb, var(--clr-primary) 10%, transparent), transparent 70%)',
                          }}
                        />
                        <span
                          className="ay-label"
                          style={{ color: y.clinical ? 'var(--panel-dark-mut)' : 'var(--fg-muted)' }}
                        >
                          Year
                        </span>
                        <span
                          className="ay-arrow"
                          style={{
                            background: y.clinical
                              ? 'color-mix(in srgb, var(--panel-dark-fg) 12%, transparent)'
                              : 'var(--clr-soft)',
                            color: y.clinical ? 'var(--panel-dark-fg)' : 'var(--clr-primary)',
                          }}
                        >
                          <svg className="ay-icon-desktop" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M7 17L17 7" /><path d="M8 7h9v9" />
                          </svg>
                          <svg className="ay-icon-mobile" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 6l6 6-6 6" />
                          </svg>
                        </span>
                        <span
                          className="ay-num"
                          style={{
                            color: y.clinical ? 'var(--panel-dark-fg)' : 'var(--clr-primary)',
                            background: y.clinical ? undefined : undefined,
                          }}
                        >
                          {y.num}
                        </span>
                        <span className="ay-meta">
                          <span className="ay-name">{y.name}</span>
                          <span
                            className="ay-stage"
                            style={{ color: y.clinical ? 'var(--panel-dark-mut)' : 'var(--fg-muted)' }}
                          >
                            {y.stage}
                          </span>
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="ay-empty">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--fg-muted)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10L12 5 2 10l10 5 10-5z" /><path d="M6 12v5c3 2 9 2 12 0v-5" />
            </svg>
            <span style={{ fontSize: 17, fontWeight: 800 }}>No academic years available</span>
            <span style={{ fontSize: 14, color: 'var(--fg-muted)' }}>
              Content will appear here once it is added by an administrator.
            </span>
          </div>
        )}
      </div>
    </section>
  )
}
