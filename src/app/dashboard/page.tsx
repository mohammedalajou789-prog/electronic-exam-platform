// src/app/dashboard/page.tsx
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import EndSessionButton from '@/components/dashboard/EndSessionButton'
import { dismissStudyTip } from '@/app/actions/dismiss-study-tip'

// ── Data fetching ──────────────────────────────────────────────────────────────

async function getDashboardData(userId: string) {
  const supabase = await createServerSupabaseClient()

  const [
    { data: user },
    { data: stats },
    { data: progressRaw },
    { data: attemptsRaw },
    { data: wrongRaw },
    { data: bookmarksRaw },
    { data: recentReports },
    { data: studyTipsRaw },
  ] = await Promise.all([

    // User profile
    supabase.from('users').select('display_name').eq('id', userId).single(),

    // Global statistics
    supabase.from('user_statistics').select('*').eq('user_id', userId).single(),

    // Incomplete exams — all of them, ordered by most recently touched
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

    // Exam attempts for performance chart — grouped by subject via join
    supabase
      .from('exam_attempts')
      .select(`
        score, correct_count, total_questions,
        exam:exams(
          title,
          batch:batches(subject:subjects(name))
        )
      `)
      .eq('user_id', userId)
      .order('completed_at', { ascending: false }),

    // Wrong answers — with full chain for subject grouping
    supabase
      .from('wrong_answers')
      .select(`
        id, question_id, exam_id,
        question:questions(
          question_text, chapter, lecture,
          exam:exams(
            title,
            batch:batches(subject:subjects(name))
          )
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),

    // Bookmarks — same structure
    supabase
      .from('bookmarks')
      .select(`
        id, question_id,
        question:questions(
          question_text, chapter,
          exam:exams(
            title,
            batch:batches(subject:subjects(name))
          )
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),

    // Reports
    supabase
      .from('reports')
      .select('id, category, status, created_at')
      .eq('reporter_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(4),

    // Study tips — active only (not dismissed, not expired)
    supabase
      .from('study_tips')
      .select('id, subject_name, message, weak_chapters, questions_solved, expires_at')
      .eq('user_id', userId)
      .is('dismissed_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }),
  ])

  // ── Performance by subject: aggregate correct/total per subject ────────────
  const subjectPerf: Record<string, { correct: number; total: number }> = {}
  for (const a of attemptsRaw ?? []) {
    const subj = (a.exam as any)?.batch?.subject?.name
    if (!subj) continue
    if (!subjectPerf[subj]) subjectPerf[subj] = { correct: 0, total: 0 }
    subjectPerf[subj].correct += a.correct_count ?? 0
    subjectPerf[subj].total  += a.total_questions ?? 0
  }
  const subjectChart = Object.entries(subjectPerf)
    .map(([name, v]) => ({
      name,
      pct: v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0,
    }))
    .sort((a, b) => b.pct - a.pct)

  // ── Wrong answers grouped by subject ──────────────────────────────────────
  const wrongBySubject: Record<string, { subjectName: string; count: number }> = {}
  for (const w of wrongRaw ?? []) {
    const subj = (w.question as any)?.exam?.batch?.subject?.name ?? 'Other'
    if (!wrongBySubject[subj]) wrongBySubject[subj] = { subjectName: subj, count: 0 }
    wrongBySubject[subj].count++
  }

  // ── Chapter weakness analysis (for the AI tip) ────────────────────────────
  const chapterMap: Record<string, { chapter: string; lectures: Set<string>; count: number }> = {}
  for (const w of wrongRaw ?? []) {
    const ch = (w.question as any)?.chapter
    const lec = (w.question as any)?.lecture
    if (!ch) continue
    if (!chapterMap[ch]) chapterMap[ch] = { chapter: ch, lectures: new Set(), count: 0 }
    chapterMap[ch].count++
    if (lec) chapterMap[ch].lectures.add(lec)
  }
  const weakestChapter = Object.values(chapterMap).sort((a, b) => b.count - a.count)[0] ?? null

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
    progress:          progressRaw   ?? [],
    subjectChart,
    wrongBySubject:    Object.values(wrongBySubject),
    totalWrong:        (wrongRaw ?? []).length,
    weakestChapter,
    bookmarksBySubject: Object.values(bookmarksBySubject),
    totalBookmarks:    (bookmarksRaw ?? []).length,
    recentReports:     recentReports ?? [],
    studyTips:         studyTipsRaw  ?? [],
  }
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

  const accuracy = stats && stats.questions_answered > 0
    ? Math.round((stats.correct_answers / stats.questions_answered) * 100)
    : 0
  const ringOffset = 113 - (113 * accuracy / 100)
  const displayName = profile?.display_name || user.email?.split('@')[0] || 'Student'

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      color: 'var(--fg)',
      fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
    }}>
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px 80px' }}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginBottom: 28 }}>
          <div>
            <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 800 }}>
              Welcome, {displayName}
            </h1>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--fg-muted)' }}>Your personal study dashboard</p>
          </div>
          <Link href="/" style={{
            padding: '11px 20px', borderRadius: 12,
            border: '1px solid var(--bd)', background: 'var(--bg-soft)',
            color: 'var(--fg)', fontSize: 14, fontWeight: 700, textDecoration: 'none',
          }}>
            Browse Exams
          </Link>
        </div>

        {/* ── Stats row ───────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>

          <StatCard
            icon={<TargetIcon />}
            iconColor="var(--clr-primary)"
            value={stats?.questions_answered ?? 0}
            label="Questions Solved"
          />

          {/* Accuracy with ring */}
          <div style={statCardBase}>
            <div style={{ width: 46, height: 46, flexShrink: 0, position: 'relative' }}>
              <svg width="46" height="46" viewBox="0 0 46 46" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="23" cy="23" r="18" fill="none" stroke="var(--bd)" strokeWidth="4" />
                <circle cx="23" cy="23" r="18" fill="none"
                  stroke={accuracy >= 70 ? '#4ade80' : accuracy >= 40 ? '#60a5fa' : '#f87171'}
                  strokeWidth="4" strokeLinecap="round"
                  strokeDasharray="113" strokeDashoffset={ringOffset} />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{accuracy}%</div>
              <div style={{ fontSize: 12.5, color: 'var(--fg-muted)' }}>Accuracy</div>
            </div>
          </div>

          <StatCard
            icon={<ClockIcon />}
            iconColor="#60a5fa"
            value={stats?.study_time ?? 0}
            label="Minutes Studied"
          />

          <StatCard
            icon={<BookIcon />}
            iconColor="#c084fc"
            value={stats?.completed_exams ?? 0}
            label="Completed Exams"
          />
        </div>

        {/* ── Study Tips ──────────────────────────────────────────────────── */}
        {studyTips.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {studyTips.map((tip: any) => {
              const daysLeft = Math.ceil(
                (new Date(tip.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
              )
              return (
                <div key={tip.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '16px 18px', borderRadius: 14,
                  background: 'color-mix(in srgb, var(--clr-primary) 7%, var(--bg-elev))',
                  border: '1px solid color-mix(in srgb, var(--clr-primary) 22%, var(--bd))',
                }}>
                  <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>💡</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--clr-primary)' }}>
                        Study Tip · {tip.subject_name}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <span style={{ fontSize: 11.5, color: 'var(--fg-muted)', fontWeight: 600 }}>
                          {daysLeft}d left
                        </span>
                        <form action={dismissStudyTip.bind(null, tip.id)}>
                          <button
                            type="submit"
                            title="Dismiss"
                            style={{
                              width: 24, height: 24, borderRadius: 6,
                              border: '1px solid var(--bd)',
                              background: 'transparent',
                              color: 'var(--fg-muted)', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontFamily: 'inherit',
                            }}
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                              <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                          </button>
                        </form>
                      </div>
                    </div>
                    <p style={{ margin: 0, fontSize: 13.5, color: 'var(--fg)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
                      {tip.message}
                    </p>
                    <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--fg-muted)', fontWeight: 600 }}>
                      Based on {tip.questions_solved} questions solved in this subject
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Continue Studying ────────────────────────────────────────────── */}
        {progress.length > 0 && (
          <Section title="Continue Studying" count={progress.length}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {progress.map((p: any) => {
                const exam = p.exam
                const subjectName = exam?.batch?.subject?.name
                const batchName   = exam?.batch?.name
                const answeredPct = exam?.question_count
                  ? Math.round(((p.current_question + 1) / exam.question_count) * 100)
                  : 0

                // Build the resume URL — we need to navigate to the prep page
                // The prep page will detect the saved progress and show Continue
                const prepUrl = `/dashboard/resume/${p.exam_id}`

                return (
                  <div key={p.id} style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 16px', borderRadius: 13,
                    background: 'var(--bg-soft)', border: '1px solid var(--bd)',
                    flexWrap: 'wrap',
                  }}>
                    {/* Info */}
                    <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--fg)', marginBottom: 2 }}>
                        {exam?.title ?? 'Exam'}
                      </div>
                      {(subjectName || batchName) && (
                        <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginBottom: 6 }}>
                          {subjectName}{batchName ? ` · ${batchName}` : ''}
                        </div>
                      )}
                      {/* Progress bar */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 5, borderRadius: 999, background: 'var(--bd)', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 999,
                            background: 'var(--clr-primary)',
                            width: `${answeredPct}%`,
                            transition: 'width .4s ease',
                          }} />
                        </div>
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--clr-primary)', flexShrink: 0 }}>
                          Q{p.current_question + 1} / {exam?.question_count ?? '?'}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <Link
                        href={`/dashboard/resume/${p.exam_id}`}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '8px 16px', borderRadius: 10,
                          background: 'var(--clr-primary)', color: 'white',
                          fontSize: 13, fontWeight: 700, textDecoration: 'none',
                        }}
                      >
                        <PlayIcon /> Continue
                      </Link>
                      {/* End session — deletes study_progress row, acts like Finish */}
                      <EndSessionButton
                        progressId={p.id}
                        examId={p.exam_id}
                        userId={user.id}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </Section>
        )}

        {/* ── Performance by Subject (bar chart) ──────────────────────────── */}
        {subjectChart.length > 0 && (
          <Section title="Performance by Subject">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {subjectChart.map((s, i) => {
                const barColor = s.pct >= 70
                  ? '#4ade80'
                  : s.pct >= 40
                  ? '#60a5fa'
                  : 'var(--clr-primary)'
                return (
                  <div key={s.name}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg)' }}>{s.name}</span>
                      <span style={{ fontSize: 12.5, fontWeight: 800, color: barColor }}>{s.pct}%</span>
                    </div>
                    <div style={{ height: 10, borderRadius: 999, background: 'var(--bg-soft)', overflow: 'hidden', border: '1px solid var(--bd)' }}>
                      <div style={{
                        height: '100%', borderRadius: 999,
                        width: `${s.pct}%`,
                        background: barColor,
                        transition: `width .6s ease ${i * 80}ms`,
                      }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </Section>
        )}

        {/* ── Wrong Questions + Bookmarks grid ────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 24 }}>

          {/* Wrong Questions */}
          <div style={cardBase}>
            <SectionHeader
              icon={<WrongIcon />}
              title="Wrong Questions"
              count={totalWrong}
              href="/dashboard/wrong-questions"
              linkLabel="View all"
            />
            {wrongBySubject.length === 0 ? (
              <EmptyState message="No wrong questions yet. Keep it up!" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {wrongBySubject.map(s => (
                  <Link
                    key={s.subjectName}
                    href={`/dashboard/wrong-questions?subject=${encodeURIComponent(s.subjectName)}`}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '11px 14px', borderRadius: 11,
                      background: 'var(--bg-soft)', border: '1px solid var(--bd)',
                      textDecoration: 'none',
                    }}
                  >
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--fg)' }}>
                      {s.subjectName}
                    </span>
                    <span style={{
                      fontSize: 12, fontWeight: 700, padding: '3px 10px',
                      borderRadius: 999,
                      background: 'color-mix(in srgb, #ef4444 14%, var(--bg-elev))',
                      color: '#ef4444',
                    }}>
                      {s.count} {s.count === 1 ? 'question' : 'questions'}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Bookmarks */}
          <div style={cardBase}>
            <SectionHeader
              icon={<BookmarkIcon />}
              title="Bookmarked Questions"
              count={totalBookmarks}
              href="/dashboard/bookmarks"
              linkLabel="View all"
            />
            {bookmarksBySubject.length === 0 ? (
              <EmptyState message="No bookmarked questions yet." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {bookmarksBySubject.map(s => (
                  <Link
                    key={s.subjectName}
                    href={`/dashboard/bookmarks?subject=${encodeURIComponent(s.subjectName)}`}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '11px 14px', borderRadius: 11,
                      background: 'var(--bg-soft)', border: '1px solid var(--bd)',
                      textDecoration: 'none',
                    }}
                  >
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--fg)' }}>
                      {s.subjectName}
                    </span>
                    <span style={{
                      fontSize: 12, fontWeight: 700, padding: '3px 10px',
                      borderRadius: 999,
                      background: 'color-mix(in srgb, var(--clr-primary) 12%, var(--bg-elev))',
                      color: 'var(--clr-primary)',
                    }}>
                      {s.count} saved
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Recent Reports ───────────────────────────────────────────────── */}
        {recentReports.length > 0 && (
          <div style={cardBase}>
            <SectionHeader icon={<FlagIcon />} title="My Reports" count={recentReports.length} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentReports.map((r: any) => (
                <div key={r.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '11px 14px', borderRadius: 11,
                  background: 'var(--bg-soft)', border: '1px solid var(--bd)',
                }}>
                  <span style={{ fontSize: 13.5, color: 'var(--fg)', textTransform: 'capitalize' }}>
                    {r.category.replace(/_/g, ' ')}
                  </span>
                  <span style={{
                    fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                    background: r.status === 'resolved'
                      ? 'color-mix(in srgb, #4ade80 18%, var(--bg-soft))'
                      : r.status === 'new'
                      ? 'color-mix(in srgb, #fb923c 18%, var(--bg-soft))'
                      : 'color-mix(in srgb, #60a5fa 18%, var(--bg-soft))',
                    color: r.status === 'resolved' ? '#16a34a'
                      : r.status === 'new' ? '#ea580c'
                      : '#2563eb',
                  }}>
                    {r.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  )
}

// ── Shared styles ──────────────────────────────────────────────────────────────

const cardBase: React.CSSProperties = {
  background: 'var(--bg-elev)',
  border: '1px solid var(--bd)',
  borderRadius: 18,
  padding: 22,
  marginBottom: 0,
}

const statCardBase: React.CSSProperties = {
  background: 'var(--bg-elev)',
  border: '1px solid var(--bd)',
  borderRadius: 18,
  padding: 22,
  display: 'flex',
  alignItems: 'center',
  gap: 16,
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({ icon, iconColor, value, label }: {
  icon: React.ReactNode
  iconColor: string
  value: number
  label: string
}) {
  return (
    <div style={statCardBase}>
      <div style={{
        width: 46, height: 46, borderRadius: 13, flexShrink: 0,
        background: 'var(--clr-soft)', color: iconColor,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 800 }}>{value}</div>
        <div style={{ fontSize: 12.5, color: 'var(--fg-muted)' }}>{label}</div>
      </div>
    </div>
  )
}

function Section({ title, count, children }: {
  title: string
  count?: number
  children: React.ReactNode
}) {
  return (
    <div style={{ ...cardBase, marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--fg)' }}>{title}</span>
        {count !== undefined && (
          <span style={{
            fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
            background: 'var(--bg-soft)', color: 'var(--fg-muted)',
          }}>
            {count}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

function SectionHeader({ icon, title, count, href, linkLabel }: {
  icon: React.ReactNode
  title: string
  count?: number
  href?: string
  linkLabel?: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon}
        <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--fg)' }}>{title}</span>
        {count !== undefined && (
          <span style={{ fontSize: 12.5, color: 'var(--fg-muted)' }}>{count}</span>
        )}
      </div>
      {href && linkLabel && (
        <Link href={href} style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--clr-primary)', textDecoration: 'none' }}>
          {linkLabel} →
        </Link>
      )}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{ padding: '28px 0', textAlign: 'center', fontSize: 13, color: 'var(--fg-muted)' }}>
      {message}
    </div>
  )
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function PlayIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5,3 19,12 5,21" />
    </svg>
  )
}
function TargetIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
    </svg>
  )
}
function ClockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  )
}
function BookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  )
}
function WrongIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  )
}
function BookmarkIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  )
}
function FlagIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  )
}