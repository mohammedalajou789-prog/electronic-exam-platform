import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

async function getDashboardData(userId: string) {
  const supabase = await createServerSupabaseClient()

  const [
    { data: user },
    { data: stats },
    { data: progress },
    { data: bookmarks },
    { data: recentReports },
    { data: wrongAnswers },
  ] = await Promise.all([
    supabase.from('users').select('*').eq('id', userId).single(),
    supabase.from('user_statistics').select('*').eq('user_id', userId).single(),
    supabase
      .from('study_progress')
      .select('*, exam:exams(title, question_count)')
      .eq('user_id', userId)
      .eq('completed', false)
      .order('updated_at', { ascending: false })
      .limit(3),
    supabase
      .from('bookmarks')
      .select('*, question:questions(question_text, exam:exams(title))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('reports')
      .select('*')
      .eq('reporter_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(3),
    supabase
      .from('wrong_answers')
      .select('*, question:questions(question_text, chapter, exam:exams(title))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  return {
    user,
    stats,
    progress: progress || [],
    bookmarks: bookmarks || [],
    recentReports: recentReports || [],
    wrongAnswers: wrongAnswers || [],
  }
}

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { user: profile, stats, progress, bookmarks, recentReports, wrongAnswers } =
    await getDashboardData(user.id)

  const accuracy = stats && stats.questions_answered > 0
    ? Math.round((stats.correct_answers / stats.questions_answered) * 100)
    : 0

  const ringOffset = 113 - (113 * accuracy / 100)
  const displayName = profile?.display_name || user.email?.split('@')[0] || 'Student'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--fg)', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
      <main style={{ padding: '32px 24px 80px', animation: '0.45s ease-out 0s 1 normal none running fadeSlideIn' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginBottom: 28 }}>
          <div>
            <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 800, color: 'var(--fg)' }}>
              Welcome, {displayName}
            </h1>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--fg-muted)' }}>Your personal study dashboard</p>
          </div>
          <Link href="/" style={{
            padding: '11px 20px', borderRadius: 12,
            border: '1px solid var(--bd)', background: 'var(--bg-soft)',
            color: 'var(--fg)', fontSize: 14, fontWeight: 700,
            textDecoration: 'none', cursor: 'pointer',
          }}>
            Browse Exams
          </Link>
        </div>

        {/* ── Stats cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 28 }}>

          {/* Questions Solved */}
          <div style={{ background: 'var(--bg-elev)', border: '1px solid var(--bd)', borderRadius: 18, padding: 22, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 46, height: 46, borderRadius: 13, background: 'var(--clr-soft)', color: 'var(--clr-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--fg)' }}>{stats?.questions_answered || 0}</div>
              <div style={{ fontSize: 12.5, color: 'var(--fg-muted)' }}>Questions Solved</div>
            </div>
          </div>

          {/* Accuracy ring */}
          <div style={{ background: 'var(--bg-elev)', border: '1px solid var(--bd)', borderRadius: 18, padding: 22, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 46, height: 46, flexShrink: 0, position: 'relative' }}>
              <svg width="46" height="46" viewBox="0 0 46 46" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="23" cy="23" r="18" fill="none" stroke="var(--bd)" strokeWidth="4" />
                <circle cx="23" cy="23" r="18" fill="none" stroke="#4ade80" strokeWidth="4" strokeLinecap="round"
                  strokeDasharray="113" strokeDashoffset={ringOffset}
                  style={{ transition: 'stroke-dashoffset 1s ease-out' }} />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--fg)' }}>{accuracy}%</div>
              <div style={{ fontSize: 12.5, color: 'var(--fg-muted)' }}>Accuracy</div>
            </div>
          </div>

          {/* Minutes Studied */}
          <div style={{ background: 'var(--bg-elev)', border: '1px solid var(--bd)', borderRadius: 18, padding: 22, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 46, height: 46, borderRadius: 13, background: 'var(--clr-soft)', color: '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--fg)' }}>{stats?.study_time || 0}</div>
              <div style={{ fontSize: 12.5, color: 'var(--fg-muted)' }}>Minutes Studied</div>
            </div>
          </div>

          {/* Completed Exams */}
          <div style={{ background: 'var(--bg-elev)', border: '1px solid var(--bd)', borderRadius: 18, padding: 22, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 46, height: 46, borderRadius: 13, background: 'var(--clr-soft)', color: '#c084fc', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--fg)' }}>{stats?.completed_exams || 0}</div>
              <div style={{ fontSize: 12.5, color: 'var(--fg-muted)' }}>Completed Exams</div>
            </div>
          </div>
        </div>

        {/* ── Continue Studying ── */}
        {progress.length > 0 && (
          <div style={{ background: 'var(--bg-elev)', border: '1px solid var(--bd)', borderRadius: 18, padding: 24, marginBottom: 24 }}>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--fg)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
              Continue Studying
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {progress.map((p: any) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px', borderRadius: 12, background: 'var(--bg-soft)', border: '1px solid var(--bd)' }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--fg)' }}>{p.exam?.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 3 }}>
                      Question {p.current_question + 1} of {p.exam?.question_count}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 80, height: 6, borderRadius: 6, background: 'var(--bd)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 6, background: 'var(--clr-primary)', width: `${((p.current_question + 1) / (p.exam?.question_count || 1)) * 100}%` }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--clr-primary)' }}>
                      {Math.round(((p.current_question + 1) / (p.exam?.question_count || 1)) * 100)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Performance by Subject ── */}
        {wrongAnswers.length > 0 && (
          <div style={{ background: 'var(--bg-elev)', border: '1px solid var(--bd)', borderRadius: 18, padding: 24, marginBottom: 24 }}>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--fg)', marginBottom: 18 }}>Performance by Subject</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {Array.from(new Set(wrongAnswers.map((w: any) => w.question?.exam?.title).filter(Boolean))).slice(0, 5).map((subject: any, i: number) => {
                const total = wrongAnswers.filter((w: any) => w.question?.exam?.title === subject).length
                const pct = Math.max(20, 100 - total * 10)
                return (
                  <div key={subject}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--fg-muted)', marginBottom: 6 }}>
                      <span>{subject}</span><span>{pct}%</span>
                    </div>
                    <div style={{ width: '100%', height: 8, borderRadius: 6, background: 'var(--bg-soft)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, borderRadius: 6, background: 'var(--clr-primary)', animation: `0.8s ease-out ${i * 90}ms 1 normal both running fadeInUp` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Wrong + Bookmarks grid ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>

          {/* Wrong Questions */}
          <div style={{ background: 'var(--bg-elev)', border: '1px solid var(--bd)', borderRadius: 18, padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 800, color: 'var(--fg)' }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#e5484d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                Wrong Questions
              </div>
              <span style={{ fontSize: 12.5, color: 'var(--fg-muted)' }}>{wrongAnswers.length} questions</span>
            </div>
            {wrongAnswers.length === 0 ? (
              <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 13, color: 'var(--fg-muted)' }}>
                No wrong questions yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {wrongAnswers.slice(0, 3).map((w: any) => (
                  <div key={w.id} style={{ padding: 14, borderRadius: 12, background: 'var(--bg-soft)', border: '1px solid var(--bd)' }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--clr-primary)', marginBottom: 5 }}>
                      {w.question?.exam?.title}
                    </div>
                    <div style={{ fontSize: 13.5, color: 'var(--fg)', lineHeight: 1.5 }}>
                      {w.question?.question_text}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bookmarked Questions */}
          <div style={{ background: 'var(--bg-elev)', border: '1px solid var(--bd)', borderRadius: 18, padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 800, color: 'var(--fg)' }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
                Bookmarked Questions
              </div>
              <span style={{ fontSize: 12.5, color: 'var(--fg-muted)' }}>{bookmarks.length} saved</span>
            </div>
            {bookmarks.length === 0 ? (
              <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 13, color: 'var(--fg-muted)' }}>
                No bookmarked questions yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {bookmarks.map((b: any) => (
                  <div key={b.id} style={{ padding: 14, borderRadius: 12, background: 'var(--bg-soft)', border: '1px solid var(--bd)' }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--clr-primary)', marginBottom: 5 }}>
                      {b.question?.exam?.title}
                    </div>
                    <div style={{ fontSize: 13.5, color: 'var(--fg)', lineHeight: 1.5 }}>
                      {b.question?.question_text}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Recent Reports ── */}
        {recentReports.length > 0 && (
          <div style={{ background: 'var(--bg-elev)', border: '1px solid var(--bd)', borderRadius: 18, padding: 22, marginTop: 20 }}>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--fg)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" />
              </svg>
              My Reports
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recentReports.map((r: any) => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 12, background: 'var(--bg-soft)', border: '1px solid var(--bd)' }}>
                  <span style={{ fontSize: 13.5, color: 'var(--fg)', textTransform: 'capitalize' }}>{r.category.replace(/_/g, ' ')}</span>
                  <span style={{
                    fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                    background: r.status === 'resolved' ? '#dcfce7' : r.status === 'new' ? '#ffedd5' : '#dbeafe',
                    color: r.status === 'resolved' ? '#16a34a' : r.status === 'new' ? '#ea580c' : '#2563eb',
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

