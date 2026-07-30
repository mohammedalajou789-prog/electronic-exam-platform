import { createServerSupabaseClient } from '@/lib/supabase/server'
import Link from 'next/link'

async function getDashboardStats() {
  const supabase = await createServerSupabaseClient()

  const [
    { count: totalExams },
    { count: totalQuestions },
    { count: pendingReports },
    { count: totalStudents },
  ] = await Promise.all([
    supabase.from('exams').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('questions').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'new'),
    supabase.from('users').select('*', { count: 'exact', head: true }),
  ])

  return {
    totalExams: totalExams || 0,
    totalQuestions: totalQuestions || 0,
    pendingReports: pendingReports || 0,
    totalStudents: totalStudents || 0,
  }
}

async function getRecentActivity() {
  const supabase = await createServerSupabaseClient()

  const { data: logs } = await supabase
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5)

  return logs || []
}

export default async function AdminDashboardPage() {
  const stats = await getDashboardStats()
  const recentActivity = await getRecentActivity()

  return (
    <>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .adm-dash-root {
          --clr-primary:   oklch(50% 0.19 25);
          --clr-soft:      oklch(94% 0.035 25);
          --bg-elev:       oklch(100% 0 0);
          --bg-soft:       oklch(96% 0.009 55);
          --fg:            oklch(22% 0.02 50);
          --fg-muted:      oklch(46% 0.02 50);
          --bd:            oklch(89% 0.012 50);
          --shadow:        rgba(20,10,10,0.08);
          --accent-green:  #22c55e;
          --accent-blue:   #3b82f6;
          --accent-purple: #a855f7;
          --accent-orange: #f97316;
        }

        .dark .adm-dash-root {
          --clr-primary:   oklch(68% 0.18 25);
          --clr-soft:      oklch(28% 0.06 25);
          --bg-elev:       oklch(22% 0.012 50);
          --bg-soft:       oklch(20% 0.01 50);
          --fg:            oklch(92% 0.008 50);
          --fg-muted:      oklch(62% 0.015 50);
          --bd:            oklch(32% 0.015 50);
          --shadow:        rgba(0,0,0,0.35);
          --accent-green:  #4ade80;
          --accent-blue:   #60a5fa;
          --accent-purple: #c084fc;
          --accent-orange: #fb923c;
        }

        .adm-fade {
          animation: fadeSlideIn 0.4s ease-out;
        }

        .adm-card-new {
          background: var(--bg-elev);
          border: 1px solid var(--bd);
          border-radius: 18px;
        }

        .adm-stat-card {
          animation: fadeInUp 0.4s ease-out forwards;
          opacity: 0;
        }

        .adm-btn-ghost-new {
          background: var(--bg-soft);
          color: var(--fg);
          border: 1px solid var(--bd);
          border-radius: 11px;
          padding: 10px 18px;
          font-size: 13.5px;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          transition: background 0.15s;
          text-align: left;
          display: flex;
          align-items: center;
          gap: 9px;
          width: 100%;
          text-decoration: none;
        }
        .adm-btn-ghost-new:hover {
          background: var(--bd);
        }

        @media (max-width: 880px) {
          .adm-stats-grid-new {
            grid-template-columns: 1fr 1fr !important;
          }
          .adm-two-col-new {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      <div
        className="adm-dash-root"
        style={{
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
          flex: '1 1 0%',
          overflowY: 'auto',
          padding: '28px 32px 64px',
          maxWidth: 1280,
          width: '100%',
          margin: '0 auto',
          color: 'var(--fg)',
        }}
      >
        <div className="adm-fade">

          {/* Page Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              flexWrap: 'wrap',
              gap: 14,
              marginBottom: 26,
            }}
          >
            <div>
              <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 800 }}>
                Dashboard
              </h1>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--fg-muted)' }}>
                Welcome back — here&apos;s what&apos;s happening on the platform.
              </p>
            </div>
          </div>

          {/* Stats Cards */}
          <div
            className="adm-stats-grid-new"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: 16,
              marginBottom: 24,
            }}
          >
            {/* Total Exams */}
            <div
              className="adm-card-new adm-stat-card"
              style={{
                padding: 22,
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                animationDelay: '0ms',
              }}
            >
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 13,
                  background: 'var(--clr-soft)',
                  color: 'var(--clr-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 26, fontWeight: 800 }}>
                  {stats.totalExams.toLocaleString()}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--fg-muted)', fontWeight: 600 }}>
                  Total Exams
                </div>
              </div>
            </div>

            {/* Total Questions */}
            <div
              className="adm-card-new adm-stat-card"
              style={{
                padding: 22,
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                animationDelay: '60ms',
              }}
            >
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 13,
                  background: 'var(--clr-soft)',
                  color: 'var(--accent-blue)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="8" y1="13" x2="16" y2="13" />
                  <line x1="8" y1="17" x2="16" y2="17" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 26, fontWeight: 800 }}>
                  {stats.totalQuestions.toLocaleString()}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--fg-muted)', fontWeight: 600 }}>
                  Total Questions
                </div>
              </div>
            </div>

            {/* Pending Reports */}
            <div
              className="adm-card-new adm-stat-card"
              style={{
                padding: 22,
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                animationDelay: '120ms',
              }}
            >
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 13,
                  background: 'var(--clr-soft)',
                  color: 'var(--accent-orange)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                  <line x1="4" y1="22" x2="4" y2="15" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 26, fontWeight: 800 }}>
                  {stats.pendingReports.toLocaleString()}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--fg-muted)', fontWeight: 600 }}>
                  Pending Reports
                </div>
              </div>
            </div>

            {/* Registered Students */}
            <div
              className="adm-card-new adm-stat-card"
              style={{
                padding: 22,
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                animationDelay: '180ms',
              }}
            >
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 13,
                  background: 'var(--clr-soft)',
                  color: 'var(--accent-purple)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 26, fontWeight: 800 }}>
                  {stats.totalStudents.toLocaleString()}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--fg-muted)', fontWeight: 600 }}>
                  Registered Students
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Row: Recent Activity + Quick Actions */}
          <div
            className="adm-two-col-new"
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr',
              gap: 20,
            }}
          >
            {/* Recent Activity */}
            <div className="adm-card-new" style={{ padding: 24 }}>
              <div
                style={{
                  fontSize: 15.5,
                  fontWeight: 800,
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--clr-primary)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                  <polyline points="17 6 23 6 23 12" />
                </svg>
                Recent Activity
              </div>

              {recentActivity.length > 0 ? (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {recentActivity.map((log: { id: string; description?: string; action?: string; created_at: string }) => (
                    <li key={log.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div
                        style={{
                          marginTop: 5,
                          width: 7,
                          height: 7,
                          borderRadius: '50%',
                          background: 'var(--clr-primary)',
                          flexShrink: 0,
                        }}
                      />
                      <div>
                        <p style={{ margin: 0, fontSize: 13.5, color: 'var(--fg)', fontWeight: 500 }}>
                          {log.description || log.action}
                        </p>
                        <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--fg-muted)' }}>
                          {new Date(log.created_at).toLocaleString()}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div
                  style={{
                    padding: '40px 0',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--fg-muted)',
                    gap: 10,
                  }}
                >
                  <svg
                    width="30"
                    height="30"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ opacity: 0.4 }}
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>No activity recorded yet</div>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="adm-card-new" style={{ padding: 24 }}>
              <div style={{ fontSize: 15.5, fontWeight: 800, marginBottom: 16 }}>
                Quick Actions
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                <Link href="/admin/manual-import" className="adm-btn-ghost-new">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                  Add a question
                </Link>
                <Link href="/admin/content?tab=exams&openModal=true" className="adm-btn-ghost-new">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Create new exam
                </Link>
                <Link href="/admin/reports" className="adm-btn-ghost-new">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                    <line x1="4" y1="22" x2="4" y2="15" />
                  </svg>
                  Review reports
                </Link>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}