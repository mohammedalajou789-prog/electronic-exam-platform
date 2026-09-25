// src/app/dashboard/bookmarks/page.tsx
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, SlidersHorizontal, Bookmark } from 'lucide-react'
import BookmarksClient from '@/components/dashboard/BookmarksClient'

/** Stagger index for the shared animation classes in globals.css */
const stagger = (i: number): React.CSSProperties =>
  ({ ['--i' as string]: i } as React.CSSProperties)

/** Colour dot per subject in the filter */
const TONES = ['var(--clr-primary)', 'var(--tone-blue-fg)', 'var(--tone-purple-fg)', 'var(--tone-green-fg)', 'var(--tone-amber-fg)']

const REVIEW_CSS = `
  .rv { min-height: 100vh; background: var(--bg); color: var(--fg); font-family: "Plus Jakarta Sans", system-ui, sans-serif; }
  .rv-wrap { max-width: 1120px; margin: 0 auto; padding: 0 24px; }

  /* ── Cover ── */
  .rv-band { position: relative; overflow: hidden; background-color: var(--bg-elev); border-bottom: 1px solid var(--bd); padding: 22px 0 28px; }
  .rv-band::before {
    content: ''; position: absolute; inset: 0; pointer-events: none;
    background-image: radial-gradient(color-mix(in srgb, var(--clr-primary) 9%, transparent) 1px, transparent 1px);
    background-size: 26px 26px;
    -webkit-mask-image: linear-gradient(180deg, #000 0%, transparent 85%);
            mask-image: linear-gradient(180deg, #000 0%, transparent 85%);
  }
  .rv-glow {
    position: absolute; top: -220px; right: -120px; width: 620px; height: 620px; border-radius: 50%;
    background: radial-gradient(circle, color-mix(in srgb, var(--clr-primary) 14%, transparent), transparent 68%);
    pointer-events: none;
  }
  .rv-head { position: relative; display: flex; flex-direction: column; gap: 22px; }
  .rv-crumbs { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: var(--fg-muted); }
  .rv-crumbs a { color: var(--fg-muted); text-decoration: none; transition: color var(--dur-2); }
  .rv-crumbs a:hover { color: var(--clr-primary); }
  .rv-crumbs b { color: var(--fg); font-weight: 700; }
  .rv-crumbs svg { flex-shrink: 0; }

  .rv-cover { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 40px; align-items: end; }
  .rv-title { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
  .rv-eyebrow { display: inline-flex; align-items: center; gap: 10px; font-size: 12.5px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--clr-primary); }
  .rv-eyebrow::before { content: ''; width: 22px; height: 2px; border-radius: 2px; background: currentColor; }
  .rv-h1 { margin: 0; font-size: clamp(32px, 4.6vw, 52px); line-height: 1; font-weight: 800; letter-spacing: -0.045em; }
  .rv-lead { margin: 0; max-width: 520px; font-size: 15px; font-weight: 500; line-height: 1.55; color: var(--fg-muted); }

  .rv-spec { display: flex; align-items: stretch; }
  .rv-spec-item { display: flex; flex-direction: column; gap: 6px; padding: 0 26px; border-left: 1px solid var(--bd); min-width: 0; }
  .rv-spec-item:first-child { padding-left: 0; border-left: none; }
  .rv-spec-item:last-child { padding-right: 0; }
  .rv-spec-value { font-size: 34px; font-weight: 800; letter-spacing: -0.04em; line-height: 1; white-space: nowrap; }
  .rv-spec-text { font-size: 19px; letter-spacing: -0.02em; line-height: 1.2; max-width: 220px; white-space: normal; padding-top: 6px; }
  .rv-spec-label { font-size: 11.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--fg-muted); white-space: nowrap; }

  /* ── Layout ── */
  .rv-main { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 28px; align-items: start; padding-top: 28px; padding-bottom: 80px; }
  .rv-main-full { grid-template-columns: minmax(0, 1fr); }
  .rv-col { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
  .rv-list { min-width: 0; }
  .rv-aside { position: sticky; top: 88px; display: flex; flex-direction: column; gap: 14px; }

  /* ── Subject filter ── */
  .rv-filter { display: flex; flex-direction: column; gap: 10px; }
  .rv-filter-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .rv-filter-label { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 800; color: var(--fg-2); }
  .rv-filter-label svg { color: var(--fg-muted); }
  .rv-filter-clear { font-size: 12.5px; font-weight: 700; color: var(--clr-primary); text-decoration: none; }
  .rv-filter-clear:hover { text-decoration: underline; text-underline-offset: 3px; }
  .rv-rail-wrap { position: relative; }
  .rv-rail {
    display: flex; flex-wrap: wrap; gap: 6px; padding: 6px;
    background: var(--bg-elev); border: 1px solid var(--bd); border-radius: 14px;
  }
  .rv-tab {
    display: inline-flex; align-items: center; gap: 8px; padding: 9px 14px; border-radius: 10px;
    font-size: 13px; font-weight: 700; color: var(--fg-2); text-decoration: none; white-space: nowrap; flex-shrink: 0;
    transition: background-color var(--dur-2), color var(--dur-2);
  }
  .rv-tab:hover { background: var(--bg-soft); color: var(--fg); }
  .rv-tab:focus { outline: none; }
  .rv-tab:focus-visible { outline: 2px solid var(--clr-primary); outline-offset: 2px; }
  .rv-tab-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--tone, var(--fg-faint)); flex-shrink: 0; }
  .rv-tab-count {
    min-width: 22px; padding: 1px 7px; border-radius: 999px; background: var(--bg-soft); color: var(--fg-muted);
    font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 11.5px; font-weight: 600; text-align: center;
  }
  .rv-tab[aria-current="page"] { background: var(--clr-primary); color: #fff; box-shadow: 0 6px 16px var(--clr-glow); }
  .rv-tab[aria-current="page"] .rv-tab-dot { background: #fff; }
  .rv-tab[aria-current="page"] .rv-tab-count { background: rgba(255, 255, 255, .2); color: #fff; }

  .rv-result { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 4px 2px 0; }
  .rv-result-title { margin: 0; font-size: 18px; font-weight: 800; letter-spacing: -0.01em; }
  .rv-result-meta { font-size: 13px; font-weight: 600; color: var(--fg-muted); }

  /* ── Side cards ── */
  .rv-card { padding: 20px; border-radius: 20px; background: var(--bg-elev); border: 1px solid var(--bd); }
  .rv-card-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 4px; }
  .rv-card-title { margin: 0; font-size: 16px; font-weight: 800; }
  .rv-card-note { font-size: 12px; font-weight: 600; color: var(--fg-muted); }
  .rv-card-desc { margin: 0 0 16px; font-size: 12.5px; line-height: 1.55; color: var(--fg-muted); }
  .rv-weak { display: flex; flex-direction: column; gap: 16px; }
  .rv-weak-item { display: flex; flex-direction: column; gap: 7px; }
  .rv-weak-row { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
  .rv-weak-name { font-size: 13.5px; font-weight: 700; line-height: 1.35; }
  .rv-weak-count { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 12px; font-weight: 600; color: var(--clr-primary); flex-shrink: 0; }
  .rv-track { height: 5px; border-radius: 999px; background: var(--track); overflow: hidden; }
  .rv-fill { display: block; height: 100%; border-radius: 999px; background: var(--clr-primary); }
  .rv-weak-lec { font-size: 12px; font-weight: 600; line-height: 1.45; color: var(--fg-muted); }

  .rv-info {
    display: flex; align-items: flex-start; gap: 12px; padding: 16px; border-radius: 18px;
    background: var(--bg-elev); border: 1px solid var(--bd);
  }
  .rv-info-icon {
    width: 34px; height: 34px; flex-shrink: 0; border-radius: 10px; background: var(--clr-soft); color: var(--clr-primary);
    display: flex; align-items: center; justify-content: center;
  }
  .rv-info p { margin: 0; font-size: 12.5px; line-height: 1.6; color: var(--fg-muted); }

  /* ── Empty ── */
  .rv-empty {
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
    border-radius: 20px; border: 1.5px dashed var(--bd-strong); padding: 64px 24px; text-align: center;
  }
  .rv-empty-icon {
    width: 56px; height: 56px; border-radius: 16px; background: var(--bg-soft); color: var(--fg-faint);
    display: flex; align-items: center; justify-content: center; margin-bottom: 4px;
  }
  .rv-empty h3 { margin: 0; font-size: 17px; font-weight: 800; }
  .rv-empty p { margin: 0; max-width: 360px; font-size: 14px; line-height: 1.55; color: var(--fg-muted); }

  /* ── Responsive ── */
  @media (max-width: 1000px) {
    .rv-main { grid-template-columns: minmax(0, 1fr); }
    /* mobile order: filter → weak areas → results → questions */
    .rv-col { display: contents; }
    .rv-filter { order: 1; }
    .rv-aside { position: static; order: 2; }
    .rv-result { order: 3; }
    .rv-list { order: 4; min-width: 0; }
    .rv-main { gap: 16px; }
    .rv-weak-item:nth-child(n + 4) { display: none; }
    .rv-aside .rv-info { display: none; }
  }
  @media (max-width: 900px) {
    .rv-cover { grid-template-columns: 1fr; gap: 22px; align-items: start; }
  }
  @media (max-width: 640px) {
    .rv-wrap { padding: 0 16px; }
    .rv-band { padding: 18px 0 22px; }
    .rv-head { gap: 18px; }
    .rv-lead { font-size: 14px; }
    .rv-spec-item { padding: 0 16px; }
    .rv-spec-value { font-size: 24px; }
    .rv-spec-text { font-size: 15px; max-width: 150px; padding-top: 0; }
    .rv-spec-label { font-size: 10px; letter-spacing: 0.06em; }
    .rv-main { padding-top: 18px; padding-bottom: 56px; }
    .rv-card { padding: 16px; }

    /* one swipeable row instead of wrapping chips */
    .rv-rail-wrap { margin: 0 -16px; }
    .rv-rail-wrap::after {
      content: ''; position: absolute; top: 0; right: 0; bottom: 0; width: 40px; pointer-events: none;
      background: linear-gradient(90deg, transparent, var(--bg));
    }
    .rv-rail {
      flex-wrap: nowrap; overflow-x: auto; scroll-snap-type: x proximity; scrollbar-width: none;
      margin: 0 16px; padding-right: 40px; max-width: none;
    }
    .rv-rail::-webkit-scrollbar { display: none; }
    .rv-tab { scroll-snap-align: start; }
    /* keep the selected subject in view without scrolling */
    .rv-tab[aria-current="page"] { order: -1; }
  }
`

export default async function BookmarksPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string }>
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: bookmarksRaw } = await supabase
    .from('bookmarks')
    .select(`
      id, question_id, created_at,
      question:questions(
        id, question_text, chapter_id, lecture_id, chapter:chapters(id, name), lecture:lectures(id, name),
        choice_a, choice_b, choice_c, choice_d, choice_e,
        correct_answer, explanation,
        incorrect_explanation_a, incorrect_explanation_b,
        incorrect_explanation_c, incorrect_explanation_d,
        incorrect_explanation_e,
        exam:exams(
          id, title,
          batch:batches(name, subject:subjects(name))
        )
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const bookmarks = bookmarksRaw ?? []

  const subjects = [...new Set(
    bookmarks
      .map((b: any) => b.question?.exam?.batch?.subject?.name)
      .filter(Boolean)
  )] as string[]

  const activeSubject = (await searchParams).subject ?? null

  const filtered = activeSubject
    ? bookmarks.filter((b: any) => b.question?.exam?.batch?.subject?.name === activeSubject)
    : bookmarks

  // ── Derived values for the layout ─────────────────────────
  const subjectCounts = subjects
    .map(subj => ({
      name: subj,
      count: bookmarks.filter((b: any) => b.question?.exam?.batch?.subject?.name === subj).length,
    }))
    .sort((a, b) => b.count - a.count)
  const chapterCount = new Set(
    bookmarks
      .map((b: any) => {
        const ch = b.question?.chapter
        return Array.isArray(ch) ? ch[0]?.name : ch?.name
      })
      .filter(Boolean)
  ).size
  const spec = [
    { value: bookmarks.length.toLocaleString(), label: 'Saved' },
    { value: String(subjects.length), label: subjects.length === 1 ? 'Subject' : 'Subjects' },
    ...(chapterCount > 0 ? [{ value: String(chapterCount), label: chapterCount === 1 ? 'Chapter' : 'Chapters' }] : []),
  ]
  const basePath = '/dashboard/bookmarks'

  return (
    <div className="rv">
      {/* dangerouslySetInnerHTML keeps quotes and '>' in the CSS unescaped */}
      <style dangerouslySetInnerHTML={{ __html: REVIEW_CSS }} />

      {/* ── Cover ───────────────────────────────────────────────── */}
      <section className="rv-band">
        <div className="rv-glow" />
        <div className="rv-wrap rv-head">
          <nav aria-label="Breadcrumb" className="rv-crumbs a-fade">
            <Link href="/dashboard">Dashboard</Link>
            <ChevronRight size={12} strokeWidth={2.4} />
            <b>Bookmarks</b>
          </nav>

          <div className="rv-cover">
            <div className="rv-title">
              <span className="rv-eyebrow a-rise">Review</span>
              <h1 className="rv-h1 a-rise" style={stagger(1)}>Bookmarked Questions</h1>
              <p className="rv-lead a-rise" style={stagger(2)}>
                The questions you saved during exams, in one place — ready for a quick revision before the real one.
              </p>
            </div>

            {bookmarks.length > 0 && (
              <div className="rv-spec a-rise" style={stagger(2)}>
                {spec.map(item => (
                  <div key={item.label} className="rv-spec-item">
                    <span className="rv-spec-value">{item.value}</span>
                    <span className="rv-spec-label">{item.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <main className="rv-wrap rv-main rv-main-full">
        <div className="rv-col">

          {/* ── Subject filter ──────────────────────────────────── */}
          {subjects.length > 0 && (
            <div className="rv-filter a-rise" style={stagger(2)}>
              <div className="rv-filter-head">
                <span className="rv-filter-label"><SlidersHorizontal size={14} />Filter by subject</span>
                {activeSubject && <Link href={basePath} className="rv-filter-clear">Clear filter</Link>}
              </div>
              <div className="rv-rail-wrap">
                <nav className="rv-rail" aria-label="Filter by subject">
                  <Link
                    href={basePath}
                    className="rv-tab press"
                    aria-current={!activeSubject ? 'page' : undefined}
                  >
                    All subjects
                    <span className="rv-tab-count">{bookmarks.length}</span>
                  </Link>
                  {subjectCounts.map((subj, i) => (
                    <Link
                      key={subj.name}
                      href={`${basePath}?subject=${encodeURIComponent(subj.name)}`}
                      className="rv-tab press"
                      aria-current={activeSubject === subj.name ? 'page' : undefined}
                      style={{ ['--tone' as string]: TONES[i % TONES.length] } as React.CSSProperties}
                    >
                      <span className="rv-tab-dot" />
                      {subj.name}
                      <span className="rv-tab-count">{subj.count}</span>
                    </Link>
                  ))}
                </nav>
              </div>
            </div>
          )}

          {bookmarks.length > 0 && (
            <div className="rv-result a-rise" style={stagger(3)}>
              <h2 className="rv-result-title">{activeSubject ?? 'All subjects'}</h2>
              <span className="rv-result-meta">
                {filtered.length} question{filtered.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}

          <div className="rv-list">
            {/* Questions */}
            {filtered.length === 0 ? (
              <div className="rv-empty a-rise" style={stagger(3)}>
                <span className="rv-empty-icon"><Bookmark size={24} /></span>
                <h3>No bookmarks here</h3>
                <p>
                  {activeSubject
                    ? 'Try selecting a different subject.'
                    : 'Bookmark questions during an exam to see them here.'}
                </p>
              </div>
            ) : (
              <BookmarksClient questions={filtered as any} userId={user.id} />
            )}
          </div>
        </div>
      </main>
    </div>
  )
}