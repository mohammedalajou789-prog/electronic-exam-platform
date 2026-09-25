// src/app/dashboard/page.tsx
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import EndSessionButton from '@/components/dashboard/EndSessionButton'
import StatInfo from '@/components/dashboard/StatInfo'

import AcademicYearsSection from '@/components/shared/AcademicYearsSection'
import { dismissStudyTip } from '@/app/actions/dismiss-study-tip'

// ── Statistics (computed live by the get_my_study_stats database function) ───

interface SubjectStats {
  subject: string
  answered: number
  correct: number
}

interface StudyStats {
  questions_solved: number
  first_attempt_correct: number
  /** Seen in a finished exam, left unanswered, and never answered anywhere. */
  skipped: number
  study_seconds: number
  completed_exams: number
  by_subject: SubjectStats[]
}

// Explanations shown when a student clicks the "?" next to each statistic
const STAT_HELP = {
  accuracy:
    'The share of questions you got right on your first try. Only your first answer to each question counts, so retaking an exam you have already seen will not inflate it. Skipped questions are shown separately: a question counts as skipped when you saw it in a finished exam and never answered it. It stops being skipped as soon as you answer it anywhere, for example in a retake or a custom exam. Questions you never reached are not counted.',
  solved:
    'The number of different questions you have answered in interactive exams, including exams you did not finish. Answering the same question again does not add to this number.',
  time:
    'Time spent solving questions in interactive exams, including exams you did not finish. The timer pauses while you are on another tab or window.',
  completed:
    'The number of different exams you finished by pressing Finish. Retaking the same exam does not add to this number.',
} as const

// ── Data fetching ──────────────────────────────────────────────────────────────

async function getDashboardData(userId: string) {
  const supabase = await createServerSupabaseClient()

  const [
    { data: user },
    { data: statsRaw },
    { data: progressRaw },
    { data: wrongRaw },
    { data: bookmarksRaw },
    { data: recentReports },
    { data: studyTipsRaw },
  ] = await Promise.all([
    supabase.from('users').select('display_name').eq('id', userId).single(),

    supabase.rpc('get_my_study_stats'),

    supabase
      .from('study_progress')
      .select(`
        id, current_question, updated_at, exam_id,
        exam:exams(
          id, title, question_count,
          batch:batches(name, subject:subjects(name))
        )
      `)
      .eq('user_id', userId)
      .eq('completed', false)
      .order('updated_at', { ascending: false }),

    supabase
      .from('wrong_answers')
      .select(`
        id, question_id, exam_id,
        question:questions(
          question_text,
          chapter:chapters(name),
          lecture:lectures(name),
          exam:exams(
            title,
            batch:batches(subject:subjects(name))
          )
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),

    supabase
      .from('bookmarks')
      .select(`
        id, question_id,
        question:questions(
          question_text,
          chapter:chapters(name),
          exam:exams(
            title,
            batch:batches(subject:subjects(name))
          )
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),

    supabase
      .from('reports')
      .select('id, category, status, created_at')
      .eq('reporter_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(4),

    supabase
      .from('study_tips')
      .select('id, subject_name, message, weak_chapters, questions_solved, expires_at')
      .eq('user_id', userId)
      .is('dismissed_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }),
  ])

  const stats = (statsRaw as StudyStats | null) ?? null

  // ── Performance by subject (first-attempt accuracy, same rule as the ring) ─
  const subjectChart = (stats?.by_subject ?? [])
    .map(s => ({
      name: s.subject,
      pct: s.answered > 0 ? Math.round((s.correct / s.answered) * 100) : 0,
    }))
    .sort((a, b) => b.pct - a.pct)

  // ── Wrong answers grouped by subject ──────────────────────────────────────
  const wrongBySubject: Record<string, { subjectName: string; count: number }> = {}
  for (const w of wrongRaw ?? []) {
    const subj = (w.question as any)?.exam?.batch?.subject?.name ?? 'Other'
    if (!wrongBySubject[subj]) wrongBySubject[subj] = { subjectName: subj, count: 0 }
    wrongBySubject[subj].count++
  }

  // ── Weakest chapter (focus area) ──────────────────────────────────────────
  const chapterMap: Record<string, {
    chapter: string
    subject: string
    lectures: Set<string>
    count: number
  }> = {}
  for (const w of wrongRaw ?? []) {
    const ch = (w.question as any)?.chapter?.name
    const lec = (w.question as any)?.lecture?.name
    const subj = (w.question as any)?.exam?.batch?.subject?.name ?? ''
    if (!ch) continue
    if (!chapterMap[ch]) chapterMap[ch] = { chapter: ch, subject: subj, lectures: new Set(), count: 0 }
    chapterMap[ch].count++
    if (lec) chapterMap[ch].lectures.add(lec)
  }
  const weakestRaw = Object.values(chapterMap).sort((a, b) => b.count - a.count)[0] ?? null
  const weakestChapter = weakestRaw
    ? {
        chapter: weakestRaw.chapter,
        subject: weakestRaw.subject,
        count: weakestRaw.count,
        lectures: Array.from(weakestRaw.lectures).slice(0, 3),
      }
    : null

  // ── Bookmarks grouped by subject ──────────────────────────────────────────
  const bookmarksBySubject: Record<string, { subjectName: string; count: number }> = {}
  for (const b of bookmarksRaw ?? []) {
    const subj = (b.question as any)?.exam?.batch?.subject?.name ?? 'Other'
    if (!bookmarksBySubject[subj]) bookmarksBySubject[subj] = { subjectName: subj, count: 0 }
    bookmarksBySubject[subj].count++
  }

  return {
    user,
    stats,
    progress: progressRaw ?? [],
    subjectChart,
    wrongBySubject: Object.values(wrongBySubject),
    totalWrong: (wrongRaw ?? []).length,
    weakestChapter,
    bookmarksBySubject: Object.values(bookmarksBySubject),
    totalBookmarks: (bookmarksRaw ?? []).length,
    recentReports: recentReports ?? [],
    studyTips: studyTipsRaw ?? [],
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days} days ago`
  const months = Math.floor(days / 30)
  return `${months} month${months === 1 ? '' : 's'} ago`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function initialsOf(text: string): string {
  const clean = (text || '').trim()
  if (!clean) return '??'
  return clean.slice(0, 2).toUpperCase()
}

function perfColor(pct: number): string {
  if (pct >= 70) return 'var(--perf-high)'
  if (pct >= 40) return 'var(--perf-mid)'
  return 'var(--perf-low)'
}

const REPORT_TONE: Record<string, { bg: string; fg: string; label: string }> = {
  resolved:     { bg: 'var(--tone-green-bg)', fg: 'var(--tone-green-fg)', label: 'Resolved'    },
  under_review: { bg: 'var(--tone-navy-bg)',  fg: 'var(--tone-navy-fg)',  label: 'In progress' },
  new:          { bg: 'var(--tone-amber-bg)', fg: 'var(--tone-amber-fg)', label: 'New'         },
  rejected:     { bg: 'var(--bg-soft)',       fg: 'var(--fg-muted)',      label: 'Rejected'    },
}

function withShare<T extends { count: number }>(list: T[]): (T & { share: number })[] {
  const max = Math.max(1, ...list.map(x => x.count))
  return list.map(x => ({ ...x, share: Math.round((x.count / max) * 100) }))
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const {
    user: profile,
    stats,
    progress,
    subjectChart,
    wrongBySubject,
    totalWrong,
    weakestChapter,
    bookmarksBySubject,
    totalBookmarks,
    recentReports,
    studyTips,
  } = await getDashboardData(user.id)

  const answered = stats?.questions_solved ?? 0
  const correct = stats?.first_attempt_correct ?? 0
  const skipped = stats?.skipped ?? 0
  const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0
  const ringOffset = 226.2 - (226.2 * accuracy / 100)

  const totalMinutes = Math.floor((stats?.study_seconds ?? 0) / 60)
  const studyHours = Math.floor(totalMinutes / 60)
  const studyMins = totalMinutes % 60

  const displayName = profile?.display_name || user.email?.split('@')[0] || 'Student'
  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  const hasAnswers = answered > 0
  const standing = !hasAnswers
    ? 'No data yet'
    : accuracy >= 70 ? 'Good standing' : accuracy >= 40 ? 'Keep pushing' : 'Needs work'
  const wrongRanked = withShare(wrongBySubject)
  const bookmarksRanked = withShare(bookmarksBySubject)
  const resumeHref = progress.length > 0 ? `/dashboard/resume/${(progress[0] as any).exam_id}` : '#continue'

  return (
    <div className="dash-root">
      <style>{`
        .dash-root { min-height: 100vh; background: var(--bg); color: var(--fg); font-family: "Plus Jakarta Sans", system-ui, sans-serif; }
        .dash-mono { font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace; }

        .dash-hero {
          position: relative; padding: 52px 40px 132px;
          background: var(--bg-elev); border-bottom: 1px solid var(--bd);
          background-image: radial-gradient(color-mix(in srgb, var(--clr-primary) 14%, transparent) 1px, transparent 1px);
          background-size: 26px 26px;
        }
        .dash-hero-inner { max-width: 1280px; margin: 0 auto; display: flex; align-items: flex-start; justify-content: space-between; gap: 40px; flex-wrap: wrap; }
        .dash-hero-text  { display: flex; flex-direction: column; gap: 14px; max-width: 700px; }
        .dash-badge {
          align-self: flex-start; display: inline-flex; align-items: center; gap: 8px;
          padding: 6px 14px; border-radius: 999px; background: var(--bg-elev);
          border: 1px solid var(--bd); font-size: 12.5px; font-weight: 700; color: var(--clr-primary);
        }
        .dash-h1   { margin: 0; font-size: clamp(30px, 4vw, 46px); line-height: 1.12; font-weight: 800; letter-spacing: -0.03em; overflow-wrap: anywhere; }
        .dash-lede { margin: 0; font-size: 16px; line-height: 1.65; color: var(--fg-muted); }
        .dash-hero-cta { display: flex; gap: 12px; flex-shrink: 0; }

        .dash-btn {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 13px 22px; border-radius: 12px;
          font-size: 14.5px; font-weight: 700; text-decoration: none;
        }
        .dash-btn-ghost { border: 1px solid var(--bd); background: var(--bg-elev); color: var(--fg); }
        .dash-btn-solid { background: var(--clr-primary); color: #fff; box-shadow: 0 8px 20px color-mix(in srgb, var(--clr-primary) 28%, transparent); }

        .dash-main { position: relative; z-index: 1; max-width: 1280px; margin: -92px auto 0; padding: 0 40px; display: flex; flex-direction: column; gap: 24px; }

        .dash-card { background: var(--bg-elev); border: 1px solid var(--bd); border-radius: 20px; padding: 26px; }
        .dash-panel { background: var(--panel-dark); color: var(--panel-dark-fg); border-radius: 20px; }

        .dash-kpi { display: grid; grid-template-columns: 1.35fr 1fr 1fr 1fr; gap: 16px; }
        .dash-kpi-box {
          display: flex; flex-direction: column; justify-content: space-between; gap: 18px;
          padding: 22px 24px; background: var(--bg-elev); border: 1px solid var(--bd);
          border-radius: 20px; box-shadow: 0 10px 30px var(--shadow);
        }
        .dash-kpi-label { font-size: 13px; font-weight: 700; color: var(--fg-muted); }
        .dash-kpi-title { display: inline-flex; align-items: center; gap: 7px; }
        .dash-kpi-value { font-size: 34px; font-weight: 800; letter-spacing: -0.03em; line-height: 1; }
        .dash-kpi-icon  { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }

        .dash-eyebrow { font-size: 12px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
        .dash-h2 { margin: 0; font-size: 18px; font-weight: 800; letter-spacing: -0.01em; }
        .dash-pill { font-size: 12px; font-weight: 700; padding: 3px 9px; border-radius: 999px; background: var(--bg-soft); color: var(--fg-muted); }

        .dash-row { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; align-items: stretch; }
        .dash-row-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; }

        .dash-item { padding: 16px 18px; border-radius: 14px; background: var(--bg-soft); border: 1px solid var(--bd); }
        .dash-track { height: 6px; border-radius: 999px; background: var(--track); overflow: hidden; }
        .dash-track-fill { height: 100%; border-radius: 999px; }

        .dash-link {
          display: inline-flex; align-items: center; gap: 6px; padding: 9px 14px;
          border-radius: 10px; background: var(--bg-soft); color: var(--fg);
          font-size: 13px; font-weight: 700; text-decoration: none;
        }

        .dash-empty { padding: 26px 0; text-align: center; font-size: 13.5px; color: var(--fg-muted); }

        @media (max-width: 1000px) {
          .dash-kpi { grid-template-columns: 1fr 1fr; }
          .dash-row, .dash-row-2 { grid-template-columns: 1fr; }
        }
        @media (max-width: 768px) {
          .dash-hero { padding: 32px 18px 110px; }
          .dash-hero-inner { flex-direction: column; align-items: stretch; gap: 22px; }
          .dash-h1 { font-size: 30px; }
          .dash-lede { font-size: 14.5px; }
          .dash-main { padding: 0 18px; margin-top: -84px; }
          .dash-kpi { grid-template-columns: 1fr; }
          .dash-card { padding: 20px; }
        }
      `}</style>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="dash-hero">
        <div className="dash-hero-inner">
          <div className="dash-hero-text">
            <span className="dash-badge">
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--clr-primary)' }} />
              Personal study dashboard · {today}
            </span>
            <h1 className="dash-h1">Welcome back, {displayName}</h1>
            <p className="dash-lede">
              {progress.length > 0
                ? `You have ${progress.length} exam${progress.length === 1 ? '' : 's'} in progress`
                : 'No exams in progress'}
              {totalWrong > 0
                ? ` and ${totalWrong} question${totalWrong === 1 ? '' : 's'} waiting for review.`
                : '.'}
              {' '}Pick up where you left off, or turn today&apos;s mistakes into tomorrow&apos;s marks.
            </p>
          </div>
          <div className="dash-hero-cta">
            <a href="#years" className="dash-btn dash-btn-ghost">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3l9 4-9 4-9-4 9-4z" /><path d="M3 12l9 4 9-4" /><path d="M3 16.5l9 4 9-4" />
              </svg>
              Browse exams
            </a>
            <Link href={resumeHref} className="dash-btn dash-btn-solid">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,3 20,12 6,21" /></svg>
              Resume last exam
            </Link>
          </div>
        </div>
      </section>

      <main className="dash-main">

        {/* ── KPI row ──────────────────────────────────────────────────────── */}
        <div className="dash-kpi">
          <div className="dash-panel" style={{ display: 'flex', alignItems: 'center', gap: 22, padding: '22px 24px', boxShadow: '0 18px 40px var(--shadow)' }}>
            <div style={{ position: 'relative', width: 88, height: 88, flexShrink: 0 }}>
              <svg width="88" height="88" viewBox="0 0 88 88" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="44" cy="44" r="36" fill="none" stroke="var(--panel-dark-bd)" strokeWidth="8" />
                <circle cx="44" cy="44" r="36" fill="none" stroke="var(--panel-accent)" strokeWidth="8"
                  strokeLinecap="round" strokeDasharray="226.2" strokeDashoffset={ringOffset} />
              </svg>
              <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>
                {hasAnswers ? `${accuracy}%` : '—'}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="dash-kpi-title">
                <span className="dash-eyebrow" style={{ color: 'var(--panel-dark-mut)' }}>Overall accuracy</span>
                <StatInfo label="Overall accuracy" description={STAT_HELP.accuracy} tone="dark" />
              </span>
              <span style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.5 }}>
                {hasAnswers
                  ? `${correct.toLocaleString()} of ${answered.toLocaleString()} correct on first try`
                  : 'Answer a few questions to see your accuracy'}
              </span>
              {skipped > 0 && (
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--panel-dark-mut)' }}>
                  {skipped.toLocaleString()} question{skipped === 1 ? '' : 's'} skipped
                </span>
              )}
              <span style={{
                alignSelf: 'flex-start', fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
                background: hasAnswers ? 'color-mix(in srgb, var(--panel-accent) 22%, transparent)' : 'color-mix(in srgb, var(--panel-dark-fg) 10%, transparent)',
                color: hasAnswers ? 'var(--panel-accent-2)' : 'var(--panel-dark-mut)',
              }}>
                {standing}
              </span>
            </div>
          </div>

          <div className="dash-kpi-box">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="dash-kpi-title">
                <span className="dash-kpi-label">Questions solved</span>
                <StatInfo label="Questions solved" description={STAT_HELP.solved} />
              </span>
              <span className="dash-kpi-icon" style={{ background: 'var(--clr-soft)', color: 'var(--clr-primary)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></svg>
              </span>
            </div>
            <div className="dash-kpi-value">{answered.toLocaleString()}</div>
          </div>

          <div className="dash-kpi-box">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="dash-kpi-title">
                <span className="dash-kpi-label">Time studied</span>
                <StatInfo label="Time studied" description={STAT_HELP.time} />
              </span>
              <span className="dash-kpi-icon" style={{ background: 'var(--tone-blue-bg)', color: 'var(--tone-blue-fg)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, lineHeight: 1 }}>
              <span className="dash-kpi-value">{studyHours}</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-muted)' }}>h</span>
              <span className="dash-kpi-value" style={{ marginLeft: 4 }}>{studyMins}</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-muted)' }}>m</span>
            </div>
          </div>

          <div className="dash-kpi-box">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="dash-kpi-title">
                <span className="dash-kpi-label">Completed exams</span>
                <StatInfo label="Completed exams" description={STAT_HELP.completed} />
              </span>
              <span className="dash-kpi-icon" style={{ background: 'var(--tone-purple-bg)', color: 'var(--tone-purple-fg)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
              </span>
            </div>
            <div className="dash-kpi-value">{stats?.completed_exams ?? 0}</div>
          </div>
        </div>

        {/* ── Study tips ───────────────────────────────────────────────────── */}
        {studyTips.map((tip: any) => {
          const daysLeft = Math.ceil((new Date(tip.expires_at).getTime() - Date.now()) / 86400000)
          return (
            <div key={tip.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: 18, padding: '22px 24px',
              background: 'var(--bg-elev)', borderRadius: 20,
              border: '1px solid color-mix(in srgb, var(--clr-primary) 28%, var(--bd))',
              backgroundImage: 'linear-gradient(90deg, color-mix(in srgb, var(--clr-primary) 7%, var(--bg-elev)), var(--bg-elev) 60%)',
            }}>
              <span style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 12, background: 'var(--clr-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6" /><path d="M10 22h4" /><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z" /></svg>
              </span>
              <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span className="dash-eyebrow" style={{ color: 'var(--clr-primary)' }}>Study tip</span>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: 'var(--clr-soft)', color: 'var(--clr-primary)' }}>
                    {tip.subject_name}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: 'var(--fg)', whiteSpace: 'pre-line' }}>{tip.message}</p>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--fg-muted)' }}>
                  Based on {tip.questions_solved} questions solved in this subject
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                <span className="dash-mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-muted)' }}>{daysLeft}d left</span>
                <form action={dismissStudyTip.bind(null, tip.id)}>
                  <button type="submit" title="Dismiss" style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid var(--bd)', background: 'var(--bg-elev)', color: 'var(--fg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontFamily: 'inherit' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </button>
                </form>
              </div>
            </div>
          )
        })}

        {/* ── Continue + Focus ─────────────────────────────────────────────── */}
        <div id="continue" className="dash-row">
          <section className="dash-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h2 className="dash-h2">Continue studying</h2>
                <span className="dash-pill">{progress.length}</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-muted)' }}>Sorted by last activity</span>
            </div>

            {progress.length === 0 ? (
              <div className="dash-empty">No exams in progress. Pick a year below to start one.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {progress.map((p: any) => {
                  const exam = p.exam
                  const subjectName = exam?.batch?.subject?.name ?? ''
                  const batchName = exam?.batch?.name ?? ''
                  const total = exam?.question_count ?? 0
                  const done = p.current_question + 1
                  const pct = total > 0 ? Math.round((done / total) * 100) : 0
                  return (
                    <div key={p.id} className="dash-item" style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
                      <span style={{ width: 46, height: 46, flexShrink: 0, borderRadius: 12, background: 'var(--bg-elev)', border: '1px solid var(--bd)', color: 'var(--clr-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 }}>
                        {initialsOf(subjectName || exam?.title || '')}
                      </span>
                      <div style={{ flexGrow: 1, minWidth: 180, display: 'flex', flexDirection: 'column', gap: 7 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                          <span style={{ fontSize: 14.5, fontWeight: 700 }}>{exam?.title ?? 'Exam'}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-muted)', flexShrink: 0 }}>{timeAgo(p.updated_at)}</span>
                        </div>
                        {(subjectName || batchName) && (
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--fg-muted)' }}>
                            {subjectName}{batchName ? ` · ${batchName}` : ''}
                          </span>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div className="dash-track" style={{ flexGrow: 1 }}>
                            <div className="dash-track-fill" style={{ width: `${pct}%`, background: 'var(--clr-primary)' }} />
                          </div>
                          <span className="dash-mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--clr-primary)', flexShrink: 0 }}>
                            Q{done} / {total || '?'}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        <Link href={`/dashboard/resume/${p.exam_id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 16px', borderRadius: 10, background: 'var(--clr-primary)', color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,3 20,12 6,21" /></svg>
                          Continue
                        </Link>
                        <EndSessionButton progressId={p.id} examId={p.exam_id} userId={user.id} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section className="dash-panel" style={{ position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 16, padding: 26 }}>
            <div style={{ position: 'absolute', top: -90, right: -90, width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle, color-mix(in srgb, var(--panel-accent) 35%, transparent), transparent 70%)' }} />
            <span className="dash-eyebrow" style={{ position: 'relative', alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 7, color: 'var(--panel-accent-2)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /></svg>
              Focus area
            </span>

            {weakestChapter ? (
              <>
                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--panel-dark-mut)' }}>Your weakest chapter</span>
                  <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15 }}>{weakestChapter.chapter}</span>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--panel-dark-mut)' }}>
                    {weakestChapter.count} wrong answer{weakestChapter.count === 1 ? '' : 's'}
                    {weakestChapter.subject ? ` · ${weakestChapter.subject}` : ''}
                  </span>
                </div>
                {weakestChapter.lectures.length > 0 && (
                  <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {weakestChapter.lectures.map(lec => (
                      <span key={lec} style={{ fontSize: 12, fontWeight: 600, padding: '5px 11px', borderRadius: 999, background: 'color-mix(in srgb, var(--panel-dark-fg) 8%, transparent)', border: '1px solid var(--panel-dark-bd)' }}>
                        {lec}
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ flexGrow: 1 }} />
                <Link href="/dashboard/wrong-questions" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px 18px', borderRadius: 12, background: 'var(--panel-dark-fg)', color: 'var(--panel-dark)', fontSize: 14, fontWeight: 800, textDecoration: 'none' }}>
                  Review these questions
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></svg>
                </Link>
              </>
            ) : (
              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 8, flexGrow: 1, justifyContent: 'center' }}>
                <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>Nothing to review</span>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--panel-dark-mut)' }}>
                  Solve a few exams and your weakest chapter will show up here.
                </span>
              </div>
            )}
          </section>
        </div>

        {/* ── Performance + Reports ────────────────────────────────────────── */}
        <div className="dash-row">
          <section className="dash-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, gap: 14, flexWrap: 'wrap' }}>
              <h2 className="dash-h2">Performance by subject</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, fontWeight: 600, color: 'var(--fg-muted)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--perf-high)' }} />70%+</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--perf-mid)' }} />40–69%</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--perf-low)' }} />Below 40%</span>
              </div>
            </div>
            {subjectChart.length === 0 ? (
              <div className="dash-empty">Answer questions in an exam to see your performance here.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {subjectChart.map(s => {
                  const color = perfColor(s.pct)
                  return (
                    <div key={s.name} style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 150px) minmax(0, 1fr) 56px', alignItems: 'center', gap: 16 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                      <div style={{ position: 'relative', height: 12, borderRadius: 999, background: 'var(--track)', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: 0, bottom: 0, left: '40%', width: 1, background: 'var(--bd)' }} />
                        <div style={{ position: 'absolute', top: 0, bottom: 0, left: '70%', width: 1, background: 'var(--bd)' }} />
                        <div style={{ position: 'relative', height: '100%', borderRadius: 999, width: `${s.pct}%`, background: color }} />
                      </div>
                      <span className="dash-mono" style={{ fontSize: 13.5, fontWeight: 600, textAlign: 'right', color }}>{s.pct}%</span>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section className="dash-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <span style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--bg-soft)', color: 'var(--fg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><path d="M4 22v-7" /></svg>
              </span>
              <h2 className="dash-h2">My reports</h2>
            </div>
            {recentReports.length === 0 ? (
              <div className="dash-empty">You haven&apos;t reported any questions yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {recentReports.map((r: any) => {
                  const tone = REPORT_TONE[r.status] ?? REPORT_TONE.new
                  return (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '13px 0', borderTop: '1px solid var(--bd)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 700, textTransform: 'capitalize' }}>{r.category.replace(/_/g, ' ')}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-muted)' }}>{formatDate(r.created_at)}</span>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: tone.bg, color: tone.fg, flexShrink: 0 }}>
                        {tone.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        {/* ── Wrong + Bookmarks ────────────────────────────────────────────── */}
        <div className="dash-row-2">
          <section className="dash-card">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--clr-soft)', color: 'var(--clr-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M15 9l-6 6M9 9l6 6" /></svg>
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <h2 className="dash-h2">Wrong questions</h2>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-muted)' }}>
                    {totalWrong} to review across {wrongRanked.length} subject{wrongRanked.length === 1 ? '' : 's'}
                  </span>
                </div>
              </div>
              <Link href="/dashboard/wrong-questions" className="dash-link">
                View all
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></svg>
              </Link>
            </div>
            {wrongRanked.length === 0 ? (
              <div className="dash-empty">No wrong questions yet. Keep it up!</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {wrongRanked.map(s => (
                  <Link key={s.subjectName} href={`/dashboard/wrong-questions?subject=${encodeURIComponent(s.subjectName)}`}
                    style={{ display: 'grid', gridTemplateColumns: 'minmax(80px, 130px) minmax(0, 1fr) 90px', alignItems: 'center', gap: 14, padding: '12px 14px', borderRadius: 12, background: 'var(--bg-soft)', border: '1px solid var(--bd)', textDecoration: 'none', color: 'var(--fg)' }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.subjectName}</span>
                    <div className="dash-track"><div className="dash-track-fill" style={{ width: `${s.share}%`, background: 'var(--clr-primary)' }} /></div>
                    <span style={{ justifySelf: 'end', fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: 'var(--clr-soft)', color: 'var(--clr-primary)' }}>{s.count} wrong</span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="dash-card">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--panel-dark)', color: 'var(--panel-dark-fg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <h2 className="dash-h2">Bookmarked questions</h2>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-muted)' }}>
                    {totalBookmarks} saved across {bookmarksRanked.length} subject{bookmarksRanked.length === 1 ? '' : 's'}
                  </span>
                </div>
              </div>
              <Link href="/dashboard/bookmarks" className="dash-link">
                View all
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></svg>
              </Link>
            </div>
            {bookmarksRanked.length === 0 ? (
              <div className="dash-empty">No bookmarked questions yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {bookmarksRanked.map(s => (
                  <Link key={s.subjectName} href={`/dashboard/bookmarks?subject=${encodeURIComponent(s.subjectName)}`}
                    style={{ display: 'grid', gridTemplateColumns: 'minmax(80px, 130px) minmax(0, 1fr) 90px', alignItems: 'center', gap: 14, padding: '12px 14px', borderRadius: 12, background: 'var(--bg-soft)', border: '1px solid var(--bd)', textDecoration: 'none', color: 'var(--fg)' }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.subjectName}</span>
                    <div className="dash-track"><div className="dash-track-fill" style={{ width: `${s.share}%`, background: 'var(--panel-dark)' }} /></div>
                    <span style={{ justifySelf: 'end', fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: 'var(--bg-soft)', color: 'var(--fg)', border: '1px solid var(--bd)' }}>{s.count} saved</span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      <div style={{ marginTop: 56 }}>
        <AcademicYearsSection
          title="Browse exams"
          subtitle="Pick a year to explore its subjects and exams"
        />
      </div>
    </div>
  )
}