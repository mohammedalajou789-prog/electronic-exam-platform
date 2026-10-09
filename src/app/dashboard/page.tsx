// src/app/dashboard/page.tsx
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import EndSessionButton from '@/components/dashboard/EndSessionButton'
import StatInfo from '@/components/dashboard/StatInfo'
import ReportsButton, { type DashboardReport } from '@/components/dashboard/ReportsButton'
import SubjectProgressList from '@/components/dashboard/SubjectProgressList'

import AcademicYearsSection from '@/components/shared/AcademicYearsSection'
import { dismissStudyTip } from '@/app/actions/dismiss-study-tip'

// ── Statistics (computed live in the database from user_question_progress) ───

interface SubjectStats {
  subject_id: string
  subject: string
  /** Active questions of the subject */
  total: number
  solved: number
  /** Solved questions whose FIRST answer was right */
  correct: number
  skipped: number
  unsolved: number
}

interface StudyStats {
  questions_solved: number
  first_attempt_correct: number
  /** Seen, left without an answer, and never answered anywhere. */
  skipped: number
  study_seconds: number
  completed_exams: number
  by_subject: SubjectStats[]
}

/** get_my_wrong_overview: the wrong-questions list, counted in the database */
interface WrongOverview {
  total: number
  by_subject: { subject_id: string; subject: string; count: number }[]
  by_chapter: {
    chapter_id: string
    chapter: string
    subject_id: string
    subject: string
    count: number
    lectures: { lecture_id: string; lecture: string; count: number }[]
  }[]
}

/** An open (unfinished) attempt at a regular exam, for "Continue studying" */
interface OpenAttemptRow {
  id: string
  exam_id: string
  started_at: string
  total_questions: number
  attempt_answers: { question_id: string; answered_at: string }[] | null
  exam: {
    id: string
    title: string
    batch: { name: string } | null
    subject: { name: string } | null
  } | null
}

interface OpenAttempt {
  id: string
  examId: string
  title: string
  subjectName: string
  batchName: string
  answered: number
  total: number
  lastActivity: string
}

// Explanations shown when a student clicks the "?" next to each statistic
const STAT_HELP = {
  accuracy:
    'The share of questions you got right on your first try. Only your first answer to each question counts, so retaking an exam you have already seen will not inflate it. Skipped questions are shown separately: a question counts as skipped when you saw it and left it without an answer. It stops being skipped as soon as you answer it anywhere, for example in a retake or a custom exam. Questions you never saw are not counted.',
  solved:
    'The number of different questions you have answered in interactive exams, including exams you did not finish. Answering the same question again does not add to this number.',
  time:
    'Time spent solving questions in interactive exams, including exams you did not finish. The timer pauses while you are on another tab or window.',
  completed:
    'The number of different exams you finished, by pressing Finish in the exam or End Session here. Retaking the same exam does not add to this number.',
  subjects:
    'For each subject: the share of questions you got right on your first try (the same rule as Overall accuracy). Click a subject to see how many of its questions you solved, skipped or have not solved yet.',
} as const

// ── Data fetching ──────────────────────────────────────────────────────────────

async function getDashboardData(userId: string) {
  const supabase = await createServerSupabaseClient()

  const [
    { data: user },
    { data: statsRaw },
    { data: attemptsRaw },
    { data: wrongRaw },
    { data: bookmarksRaw },
    { data: recentReports },
    { data: studyTipsRaw },
  ] = await Promise.all([
    supabase.from('users').select('display_name').eq('id', userId).single(),

    supabase.rpc('get_my_study_stats'),

    // Open attempts at regular exams, with the answers given so far
    supabase
      .from('exam_attempts')
      .select(`
        id, exam_id, started_at, total_questions,
        attempt_answers(question_id, answered_at),
        exam:exams(
          id, title,
          batch:batches(name),
          subject:subjects(name)
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'in_progress')
      .not('exam_id', 'is', null)
      .not('attempt_answers.chosen_answer', 'is', null),

    // Wrong-questions counts (by subject and chapter), computed in the database
    supabase.rpc('get_my_wrong_overview'),

    supabase
      .from('bookmarks')
      .select(`
        id, question_id,
        question:questions(
          question_text,
          chapter:chapters(name),
          exam:exams(
            title,
            subject:subjects(name)
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
      .limit(20),

    supabase
      .from('study_tips')
      .select('id, subject_name, message, weak_chapters, questions_solved, expires_at')
      .eq('user_id', userId)
      .is('dismissed_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }),
  ])

  const stats = (statsRaw as StudyStats | null) ?? null
  const wrong = (wrongRaw as WrongOverview | null) ?? null

  // ── Exams in progress (only attempts with at least one answer) ────────────
  const progress: OpenAttempt[] = ((attemptsRaw ?? []) as unknown as OpenAttemptRow[])
    .filter(a => (a.attempt_answers?.length ?? 0) > 0)
    .map(a => {
      const answers = a.attempt_answers ?? []
      const lastActivity = answers.reduce(
        (latest, ans) => (ans.answered_at > latest ? ans.answered_at : latest),
        a.started_at
      )
      return {
        id: a.id,
        examId: a.exam_id,
        title: a.exam?.title ?? 'Exam',
        subjectName: a.exam?.subject?.name ?? '',
        batchName: a.exam?.batch?.name ?? '',
        answered: answers.length,
        total: a.total_questions,
        lastActivity,
      }
    })
    .sort((x, y) => (x.lastActivity < y.lastActivity ? 1 : -1))

  // ── Progress by subject: solved / skipped / not solved + first-try accuracy ─
  const subjectChart = (stats?.by_subject ?? [])
    .map(s => ({
      name: s.subject,
      pct: s.solved > 0 ? Math.round((s.correct / s.solved) * 100) : 0,
      correct: s.correct,
      total: s.total,
      solved: s.solved,
      skipped: s.skipped,
      unsolved: s.unsolved,
    }))
    .sort((a, b) => b.pct - a.pct)

  // ── Wrong answers grouped by subject ──────────────────────────────────────
  const wrongBySubject = (wrong?.by_subject ?? []).map(s => ({ subjectName: s.subject, count: s.count }))

  // ── Bookmarks grouped by subject ──────────────────────────────────────────
  const bookmarksBySubject: Record<string, { subjectName: string; count: number }> = {}
  for (const b of bookmarksRaw ?? []) {
    const subj = (b.question as any)?.exam?.subject?.name ?? 'Other'
    if (!bookmarksBySubject[subj]) bookmarksBySubject[subj] = { subjectName: subj, count: 0 }
    bookmarksBySubject[subj].count++
  }

  return {
    user,
    stats,
    progress,
    subjectChart,
    wrongBySubject,
    totalWrong: wrong?.total ?? 0,
    bookmarksBySubject: Object.values(bookmarksBySubject),
    totalBookmarks: (bookmarksRaw ?? []).length,
    recentReports: (recentReports ?? []) as DashboardReport[],
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

function initialsOf(text: string): string {
  const clean = (text || '').trim()
  if (!clean) return '??'
  return clean.slice(0, 2).toUpperCase()
}

/** Stagger index for the shared animation classes in globals.css */
const stagger = (i: number): React.CSSProperties =>
  ({ ['--i' as string]: i } as React.CSSProperties)

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

  // Greet with the first name only ("Mohammed El-Ajou" -> "Mohammed")
  const firstName =
    (profile?.display_name ?? '').trim().split(/\s+/)[0] || user.email?.split('@')[0] || 'Student'
  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  const hasAnswers = answered > 0
  const standing = !hasAnswers
    ? 'No data yet'
    : accuracy >= 70 ? 'Good standing' : accuracy >= 40 ? 'Keep pushing' : 'Needs work'
  const wrongRanked = withShare(wrongBySubject)
  const bookmarksRanked = withShare(bookmarksBySubject)
  const resumeHref = progress.length > 0 ? `/dashboard/resume/${progress[0].examId}` : '#continue'

  return (
    <div className="dash-root">
      <style>{`
        .dash-root { min-height: 100vh; background: var(--bg); color: var(--fg); font-family: "Plus Jakarta Sans", system-ui, sans-serif; }
        .dash-mono { font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace; }

        .dash-hero {
          position: relative; padding: 52px var(--page-pad) 132px;
          background: var(--bg-elev); border-bottom: 1px solid var(--bd);
          background-image: radial-gradient(color-mix(in srgb, var(--clr-primary) 14%, transparent) 1px, transparent 1px);
          background-size: 26px 26px;
        }
        .dash-hero-inner { max-width: var(--page-max); margin: 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 40px; }
        .dash-hero-text  { display: flex; flex-direction: column; gap: 14px; max-width: 760px; min-width: 0; }
        .dash-badge {
          align-self: flex-start; display: inline-flex; align-items: center; gap: 8px;
          padding: 6px 14px; border-radius: 999px; background: var(--bg-elev);
          border: 1px solid var(--bd); font-size: 12.5px; font-weight: 700; color: var(--clr-primary);
        }
        .dash-h1   { margin: 0; font-size: clamp(30px, 4vw, 46px); line-height: 1.12; font-weight: 800; letter-spacing: -0.03em; overflow-wrap: anywhere; }
        .dash-lede { margin: 0; font-size: 16px; line-height: 1.65; color: var(--fg-muted); }
        /* The three actions sit in a column beside the welcome text */
        .dash-hero-cta { display: flex; flex-direction: column; gap: 10px; flex-shrink: 0; width: 250px; }
        .dash-hero-cta .dash-btn { width: 100%; justify-content: flex-start; }

        .dash-btn {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 13px 22px; border-radius: 12px;
          font-size: 14.5px; font-weight: 700; text-decoration: none;
        }
        .dash-btn-ghost { border: 1px solid var(--bd); background: var(--bg-elev); color: var(--fg); }
        .dash-btn-solid { background: var(--clr-primary); color: #fff; box-shadow: 0 8px 20px color-mix(in srgb, var(--clr-primary) 28%, transparent); }
        button.dash-btn { font: inherit; font-size: 14.5px; font-weight: 700; cursor: pointer; }
        /* "Browse exams" is the main action: solid and gently pulsing to draw the eye */
        @keyframes dash-beat { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.035); } }
        @keyframes dash-glow {
          0%   { box-shadow: 0 8px 20px color-mix(in srgb, var(--clr-primary) 28%, transparent), 0 0 0 0 color-mix(in srgb, var(--clr-primary) 45%, transparent); }
          70%  { box-shadow: 0 8px 20px color-mix(in srgb, var(--clr-primary) 28%, transparent), 0 0 0 14px transparent; }
          100% { box-shadow: 0 8px 20px color-mix(in srgb, var(--clr-primary) 28%, transparent), 0 0 0 0 transparent; }
        }
        .dash-btn-hot { animation: dash-glow 2s ease-out infinite, dash-beat 2s ease-in-out infinite; }
        .dash-btn-hot:hover { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) { .dash-btn-hot { animation: none; } }
        .dash-btn-count { margin-left: auto; min-width: 20px; padding: 1px 7px; border-radius: 999px; background: var(--clr-primary); color: #fff; font-size: 11.5px; font-weight: 800; text-align: center; }

        /* "Browse exams" glides down to the years instead of jumping */
        html:has(.dash-root) { scroll-behavior: smooth; }
        #years, #continue { scroll-margin-top: 76px; }
        @media (prefers-reduced-motion: reduce) { html:has(.dash-root) { scroll-behavior: auto; } }

        /* Long lists keep a fixed height and scroll inside their card (scrollbar hidden) */
        .dash-scroll {
          max-height: 420px; overflow-y: auto; overscroll-behavior: contain;
          scrollbar-width: none; -ms-overflow-style: none;
          /* room for the hover lift so items are not clipped at the edges */
          padding: 3px 4px 3px 0; margin: -3px -4px -3px 0;
        }
        .dash-scroll::-webkit-scrollbar { display: none; }
        .dash-item { transition: border-color var(--dur-2), transform var(--dur-2) var(--ease-out), background-color var(--dur-2); }
        .dash-item:hover { border-color: var(--bd-strong); transform: translateY(-2px); }
        .dash-bar-link { transition: border-color var(--dur-2), transform var(--dur-2) var(--ease-out); }
        .dash-bar-link:hover { border-color: var(--bd-strong); transform: translateX(3px); }

        .dash-main { position: relative; z-index: 1; max-width: var(--page-max); margin: -92px auto 0; padding: 0 var(--page-pad); display: flex; flex-direction: column; gap: 24px; }

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

        .dash-row-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; }
        .dash-fixed { height: 520px; display: flex; flex-direction: column; min-width: 0; }
        .dash-fixed > .dash-scroll { flex: 1 1 auto; min-height: 0; max-height: none; }
        .dash-panel-card {
          padding: 26px; box-shadow: 0 18px 40px var(--shadow);
          /* Performance colors bright enough to read on the dark panel */
          --sp-high: #4ade80; --sp-mid: #fbbf24; --sp-low: var(--panel-accent);
        }

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
          .dash-row-2 { grid-template-columns: 1fr; }
          .dash-fixed { height: auto; }
          .dash-fixed > .dash-scroll { max-height: 420px; }
        }
        @media (max-width: 768px) {
          .dash-hero { padding: 32px var(--page-pad) 110px; }
          .dash-hero-inner { flex-direction: column; align-items: stretch; gap: 22px; }
          .dash-hero-cta { width: 100%; }
          .dash-hero-cta .dash-btn { justify-content: center; }
          .dash-h1 { font-size: 30px; }
          .dash-lede { font-size: 14.5px; }
          .dash-main { padding: 0 var(--page-pad); margin-top: -84px; }
          .dash-kpi { grid-template-columns: 1fr; }
          .dash-card, .dash-panel-card { padding: 20px; }
        }
      `}</style>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="dash-hero">
        <div className="dash-hero-inner">
          <div className="dash-hero-text">
            <span className="dash-badge a-rise">
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--clr-primary)' }} />
              Personal study dashboard · {today}
            </span>
            <h1 className="dash-h1 a-rise" style={stagger(1)}>Welcome back, {firstName}</h1>
            <p className="dash-lede a-rise" style={stagger(2)}>
              {progress.length > 0
                ? `You have ${progress.length} exam${progress.length === 1 ? '' : 's'} in progress`
                : 'No exams in progress'}
              {totalWrong > 0
                ? ` and ${totalWrong} question${totalWrong === 1 ? '' : 's'} waiting for review.`
                : '.'}
              {' '}Pick up where you left off, or turn today&apos;s mistakes into tomorrow&apos;s marks.
            </p>
          </div>
          <div className="dash-hero-cta a-rise" style={stagger(3)}>
            <a href="#years" className="dash-btn dash-btn-solid dash-btn-hot press">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3l9 4-9 4-9-4 9-4z" /><path d="M3 12l9 4 9-4" /><path d="M3 16.5l9 4 9-4" />
              </svg>
              Browse exams
            </a>
            <ReportsButton reports={recentReports} />
            <Link href={resumeHref} className="dash-btn dash-btn-ghost press">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,3 20,12 6,21" /></svg>
              Resume last exam
            </Link>
          </div>
        </div>
      </section>

      <main className="dash-main">

        {/* ── KPI row ──────────────────────────────────────────────────────── */}
        <div className="dash-kpi">
          <div className="dash-panel a-rise" style={{ ...stagger(2), display: 'flex', alignItems: 'center', gap: 22, padding: '22px 24px', boxShadow: '0 18px 40px var(--shadow)' }}>
            <div style={{ position: 'relative', width: 88, height: 88, flexShrink: 0 }}>
              <svg width="88" height="88" viewBox="0 0 88 88" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="44" cy="44" r="36" fill="none" stroke="var(--panel-dark-bd)" strokeWidth="8" />
                <circle cx="44" cy="44" r="36" fill="none" stroke="var(--panel-accent)" strokeWidth="8"
                  strokeLinecap="round" strokeDasharray="226.2" strokeDashoffset={ringOffset}
                  className="a-ring" style={{ ['--c' as string]: 226.2 } as React.CSSProperties} />
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

          <div className="dash-kpi-box a-rise lift" style={stagger(3)}>
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

          <div className="dash-kpi-box a-rise lift" style={stagger(4)}>
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

          <div className="dash-kpi-box a-rise lift" style={stagger(5)}>
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
            <div key={tip.id} className="a-rise" style={{
              ...stagger(4),
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

        {/* ── Continue studying + Progress by subject (side by side, fixed height) ── */}
        <div className="dash-row-2">
          <section id="continue" className="dash-card dash-fixed a-rise" style={stagger(5)}>
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
              <div className="dash-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {progress.map((p, i) => {
                  const subjectName = p.subjectName
                  const batchName = p.batchName
                  const total = p.total
                  const done = p.answered
                  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0
                  return (
                    <div key={p.id} className="dash-item a-rise" style={{ ...stagger(Math.min(i, 8)), display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
                      <span style={{ width: 46, height: 46, flexShrink: 0, borderRadius: 12, background: 'var(--bg-elev)', border: '1px solid var(--bd)', color: 'var(--clr-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 }}>
                        {initialsOf(subjectName || p.title)}
                      </span>
                      <div style={{ flexGrow: 1, minWidth: 180, display: 'flex', flexDirection: 'column', gap: 7 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                          <span style={{ fontSize: 14.5, fontWeight: 700 }}>{p.title}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-muted)', flexShrink: 0 }}>{timeAgo(p.lastActivity)}</span>
                        </div>
                        {(subjectName || batchName) && (
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--fg-muted)' }}>
                            {subjectName}{batchName ? ` · ${batchName}` : ''}
                          </span>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div className="dash-track" style={{ flexGrow: 1 }}>
                            <div className="dash-track-fill a-grow" style={{ ...stagger(Math.min(i, 8)), width: `${pct}%`, background: 'var(--clr-primary)' }} />
                          </div>
                          <span className="dash-mono" title="Questions answered in this attempt" style={{ fontSize: 12, fontWeight: 600, color: 'var(--clr-primary)', flexShrink: 0 }}>
                            {done} / {total || '?'}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        <Link href={`/dashboard/resume/${p.examId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 16px', borderRadius: 10, background: 'var(--clr-primary)', color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,3 20,12 6,21" /></svg>
                          Continue
                        </Link>
                        <EndSessionButton attemptId={p.id} examTitle={p.title} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Styled like the "Overall accuracy" panel; click a subject for details */}
          <section className="dash-panel dash-panel-card dash-fixed a-rise" style={stagger(6)}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, gap: 14, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span className="dash-kpi-title">
                  <h2 className="dash-h2">Progress by subject</h2>
                  <StatInfo label="Progress by subject" description={STAT_HELP.subjects} tone="dark" />
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--panel-dark-mut)' }}>First-try accuracy · click a subject for details</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, fontWeight: 600, color: 'var(--panel-dark-mut)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--sp-high)' }} />70%+</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--sp-mid)' }} />40–69%</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--sp-low)' }} />Below 40%</span>
              </div>
            </div>
            {subjectChart.length === 0 ? (
              <div className="dash-empty" style={{ color: 'var(--panel-dark-mut)' }}>Answer questions in an exam to see your progress here.</div>
            ) : (
              <div className="dash-scroll">
                <SubjectProgressList subjects={subjectChart} />
              </div>
            )}
          </section>
        </div>

        {/* ── Wrong + Bookmarks ────────────────────────────────────────────── */}
        <div className="dash-row-2">
          <section className="dash-card a-rise" style={stagger(7)}>
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
              <div className="dash-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {wrongRanked.map((s, i) => (
                  <Link key={s.subjectName} href={`/dashboard/wrong-questions?subject=${encodeURIComponent(s.subjectName)}`}
                    className="dash-bar-link a-rise"
                    style={{ ...stagger(Math.min(i, 8)), display: 'grid', gridTemplateColumns: 'minmax(80px, 130px) minmax(0, 1fr) 90px', alignItems: 'center', gap: 14, padding: '12px 14px', borderRadius: 12, background: 'var(--bg-soft)', border: '1px solid var(--bd)', textDecoration: 'none', color: 'var(--fg)' }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.subjectName}</span>
                    <div className="dash-track"><div className="dash-track-fill a-grow" style={{ ...stagger(Math.min(i, 8)), width: `${s.share}%`, background: 'var(--clr-primary)' }} /></div>
                    <span style={{ justifySelf: 'end', fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: 'var(--clr-soft)', color: 'var(--clr-primary)' }}>{s.count} wrong</span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="dash-card a-rise" style={stagger(8)}>
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
              <div className="dash-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {bookmarksRanked.map((s, i) => (
                  <Link key={s.subjectName} href={`/dashboard/bookmarks?subject=${encodeURIComponent(s.subjectName)}`}
                    className="dash-bar-link a-rise"
                    style={{ ...stagger(Math.min(i, 8)), display: 'grid', gridTemplateColumns: 'minmax(80px, 130px) minmax(0, 1fr) 90px', alignItems: 'center', gap: 14, padding: '12px 14px', borderRadius: 12, background: 'var(--bg-soft)', border: '1px solid var(--bd)', textDecoration: 'none', color: 'var(--fg)' }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.subjectName}</span>
                    <div className="dash-track"><div className="dash-track-fill a-grow" style={{ ...stagger(Math.min(i, 8)), width: `${s.share}%`, background: 'var(--panel-dark)' }} /></div>
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