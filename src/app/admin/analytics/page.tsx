import { createServerSupabaseClient } from '@/lib/supabase/server'

async function getAnalyticsData() {
  const supabase = await createServerSupabaseClient()

  const [
    { data: subjectStats },
    { data: mostReportedQuestions },
    { data: reportsByCategory },
    { data: recentImports },
    { count: totalStudents },
    { count: totalQuestions },
    { count: totalExams },
    { count: totalReports },
  ] = await Promise.all([
    supabase.rpc('get_questions_per_subject'),
    supabase
      .from('reports')
      .select('question_id, questions(question_text, exam:exams(title))')
      .not('question_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('reports').select('category').not('category', 'is', null),
    supabase.from('bulk_imports').select('*').order('created_at', { ascending: false }).limit(5),
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('questions').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('exams').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('reports').select('*', { count: 'exact', head: true }),
  ])

  const categoryCount: Record<string, number> = {}
  for (const r of reportsByCategory || []) {
    if (r.category) categoryCount[r.category] = (categoryCount[r.category] || 0) + 1
  }

  const questionReportCount: Record<string, number> = {}
  for (const r of mostReportedQuestions || []) {
    if (r.question_id) questionReportCount[r.question_id] = (questionReportCount[r.question_id] || 0) + 1
  }

  const topReportedMap = new Map<string, { text: string; exam: string; count: number }>()
  for (const r of mostReportedQuestions || []) {
    if (!r.question_id) continue
    if (!topReportedMap.has(r.question_id)) {
      const q = r.questions as any
      topReportedMap.set(r.question_id, {
        text: q?.question_text || 'Unknown',
        exam: q?.exam?.title || 'Unknown',
        count: questionReportCount[r.question_id],
      })
    }
  }

  const topReported = Array.from(topReportedMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return {
    subjectStats: subjectStats || [],
    topReported,
    categoryCount,
    recentImports: recentImports || [],
    totals: {
      students: totalStudents || 0,
      questions: totalQuestions || 0,
      exams: totalExams || 0,
      reports: totalReports || 0,
    },
  }
}

function formatCategory(cat: string): string {
  return cat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

export default async function AnalyticsPage() {
  const data = await getAnalyticsData()
  const totalCategoryReports = Object.values(data.categoryCount).reduce((a, b) => a + b, 0)

  // Bar chart helpers
  const subjectList = data.subjectStats as any[]
  const maxCount = subjectList.length > 0 ? Math.max(...subjectList.map((s: any) => s.question_count)) : 0
  const chartHeight = 220
  const yLabels = maxCount > 0
    ? [maxCount, Math.round(maxCount * 0.75), Math.round(maxCount * 0.5), Math.round(maxCount * 0.25), 0]
    : [100, 75, 50, 25, 0]

  const css = `
    .an-root {
      --an-bg:      oklch(98% 0.006 55);
      --an-elev:    oklch(100% 0 0);
      --an-soft:    oklch(96% 0.009 55);
      --an-fg:      oklch(22% 0.02 50);
      --an-muted:   oklch(46% 0.02 50);
      --an-bd:      oklch(89% 0.012 50);
      --an-primary: oklch(50% 0.19 25);
      --an-psoft:   oklch(94% 0.035 25);
      --an-green:   #22c55e;
      --an-orange:  #f97316;
      --an-red:     #ef4444;
      --an-blue:    #3b82f6;
      --an-yellow:  #eab308;
    }
    .dark .an-root {
      --an-bg:      oklch(18% 0.01 50);
      --an-elev:    oklch(22% 0.012 50);
      --an-soft:    oklch(20% 0.01 50);
      --an-fg:      oklch(92% 0.008 50);
      --an-muted:   oklch(62% 0.015 50);
      --an-bd:      oklch(32% 0.015 50);
      --an-primary: oklch(68% 0.18 25);
      --an-psoft:   oklch(28% 0.06 25);
    }
    @keyframes an-fade  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
    @keyframes an-grow  { from{height:0} to{height:var(--bar-h)} }
    .an-fade { animation: an-fade 0.35s ease-out; }
    .an-bar  { animation: an-grow 0.55s cubic-bezier(.22,1,.36,1) both; }
    .an-card { background:var(--an-elev); border:1px solid var(--an-bd); border-radius:18px; }

    /* stat cards */
    .an-stat { border-radius:16px; padding:20px; text-align:center; background:var(--an-elev); border:1px solid var(--an-bd); }

    /* bar chart */
    .an-chart-wrap { flex:1 1 0; overflow-x:auto; min-width:0; }
    .an-chart-wrap::-webkit-scrollbar { height:6px; }
    .an-chart-wrap::-webkit-scrollbar-thumb { background:var(--an-bd); border-radius:6px; }
    .an-bar-col { display:flex; flex-direction:column; align-items:center; gap:6px; flex-shrink:0; width:56px; }
    .an-bar-pill { width:32px; border-radius:6px 6px 0 0; background:var(--an-primary); }
    .an-bar-label { font-size:10.5px; color:var(--an-muted); overflow:hidden; text-overflow:ellipsis;
      white-space:nowrap; width:100%; text-align:center; }

    /* bar bg lines */
    .an-chart-area {
      height:${chartHeight}px;
      border-left:1px solid var(--an-bd);
      border-bottom:1px solid var(--an-bd);
      display:flex; align-items:flex-end; gap:22px;
      padding:0 16px;
      background-image:repeating-linear-gradient(
        0deg, var(--an-bd) 0, var(--an-bd) 1px, transparent 1px, transparent 25%
      );
    }

    /* progress bars */
    .an-prog-track { height:7px; border-radius:20px; background:var(--an-soft); overflow:hidden; }
    .an-prog-fill  { height:100%; border-radius:20px; transition:width 0.6s ease; }

    /* import rows */
    .an-import-row { display:flex; align-items:center; justify-content:space-between;
      padding:12px 16px; border-radius:12px; background:var(--an-soft); border:1px solid var(--an-bd); }

    /* most reported */
    .an-rep-row { display:flex; align-items:flex-start; justify-content:space-between;
      padding:14px 20px; gap:12px; border-bottom:1px solid var(--an-bd); }
    .an-rep-row:last-child { border-bottom:none; }

    /* badge */
    .an-badge { display:inline-block; border-radius:20px; padding:3px 10px;
      font-size:11px; font-weight:700; white-space:nowrap; }
    .an-badge-red    { background:oklch(95% 0.03 20); color:oklch(50% 0.18 20); }
    .an-badge-green  { background:oklch(95% 0.03 145); color:oklch(45% 0.16 145); }
    .an-badge-yellow { background:oklch(96% 0.04 90); color:oklch(50% 0.15 90); }
    .dark .an-badge-red    { background:oklch(25% 0.05 20); color:oklch(72% 0.14 20); }
    .dark .an-badge-green  { background:oklch(25% 0.05 145); color:oklch(72% 0.12 145); }
    .dark .an-badge-yellow { background:oklch(25% 0.04 90); color:oklch(72% 0.12 90); }

    @media (max-width: 900px) {
      .an-stats-grid { grid-template-columns: repeat(2,1fr) !important; }
      .an-two-col    { grid-template-columns: 1fr !important; }
    }
    @media (max-width: 560px) {
      .an-stats-grid { grid-template-columns: 1fr 1fr !important; }
    }
  `

  return (
    <>
      <style>{css}</style>
      <div
        className="an-root an-fade"
        style={{
          fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
          color: 'var(--an-fg)',
          maxWidth: 1280,
          margin: '0 auto',
          padding: '28px 32px 64px',
          width: '100%',
        }}
      >

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 800 }}>Analytics</h1>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--an-muted)' }}>
            Platform statistics and content quality overview.
          </p>
        </div>

        {/* Stats grid */}
        <div
          className="an-stats-grid"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 22 }}
        >
          {[
            { label: 'Students',      value: data.totals.students,  icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75', color: 'var(--an-blue)'   },
            { label: 'Questions',     value: data.totals.questions, icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',                                         color: 'var(--an-primary)' },
            { label: 'Exams',         value: data.totals.exams,     icon: 'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z',                                              color: 'var(--an-green)'  },
            { label: 'Total Reports', value: data.totals.reports,   icon: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7',                                                               color: 'var(--an-orange)' },
          ].map(s => (
            <div key={s.label} className="an-stat">
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                <span style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--an-soft)', border: '1px solid var(--an-bd)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={s.icon} />
                  </svg>
                </span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1 }}>{s.value.toLocaleString()}</div>
              <div style={{ fontSize: 12, color: 'var(--an-muted)', fontWeight: 600, marginTop: 5 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Bar Chart — Questions per Subject */}
        <div className="an-card" style={{ padding: 24, marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 20 }}>Questions per Subject</div>

          {subjectList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--an-muted)', fontSize: 13 }}>
              No subject data available yet.
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10 }}>
              {/* Y-axis labels */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: chartHeight, paddingBottom: 26, fontSize: 11, color: 'var(--an-muted)', textAlign: 'right', flexShrink: 0 }}>
                {yLabels.map((v, i) => <span key={i}>{v.toLocaleString()}</span>)}
              </div>

              {/* Chart bars */}
              <div className="an-chart-wrap">
                <div className="an-chart-area">
                  {subjectList.map((s: any) => {
                    const pct = maxCount > 0 ? s.question_count / maxCount : 0
                    const barH = Math.max(Math.round(pct * (chartHeight - 26)), 2)
                    return (
                      <div key={s.subject_name} className="an-bar-col" style={{ alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--an-fg)', marginBottom: 4 }}>
                          {s.question_count}
                        </span>
                        <div
                          className="an-bar an-bar-pill"
                          style={{ '--bar-h': `${barH}px`, height: barH } as any}
                        />
                      </div>
                    )
                  })}
                </div>
                {/* X-axis labels */}
                <div style={{ display: 'flex', gap: 22, padding: '8px 16px 0' }}>
                  {subjectList.map((s: any) => (
                    <div key={s.subject_name} className="an-bar-label" title={s.subject_name} style={{ width: 56, flexShrink: 0 }}>
                      {s.subject_name}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Two-column: Reports by Category + Most Reported */}
        {(Object.keys(data.categoryCount).length > 0 || data.topReported.length > 0) && (
          <div
            className="an-two-col"
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}
          >

            {/* Reports by Category */}
            {Object.keys(data.categoryCount).length > 0 && (
              <div className="an-card" style={{ padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--an-orange)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
                  </svg>
                  <span style={{ fontSize: 15, fontWeight: 800 }}>Reports by Category</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {Object.entries(data.categoryCount)
                    .sort((a, b) => b[1] - a[1])
                    .map(([cat, count]) => {
                      const pct = totalCategoryReports > 0 ? Math.round((count / totalCategoryReports) * 100) : 0
                      return (
                        <div key={cat}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                            <span style={{ fontWeight: 600 }}>{formatCategory(cat)}</span>
                            <span style={{ color: 'var(--an-muted)' }}>{count} ({pct}%)</span>
                          </div>
                          <div className="an-prog-track">
                            <div className="an-prog-fill" style={{ width: `${pct}%`, background: 'var(--an-orange)' }} />
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div>
            )}

            {/* Most Reported Questions */}
            {data.topReported.length > 0 && (
              <div className="an-card" style={{ overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '18px 20px', borderBottom: '1px solid var(--an-bd)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--an-red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <span style={{ fontSize: 15, fontWeight: 800 }}>Most Reported Questions</span>
                </div>
                <div style={{ overflowY: 'auto', maxHeight: 340 }}>
                  {data.topReported.map((q, i) => (
                    <div key={i} className="an-rep-row">
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: '0 0 3px', fontSize: 13, fontWeight: 600, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as any}>
                          {q.text}
                        </p>
                        <p style={{ margin: 0, fontSize: 11.5, color: 'var(--an-muted)' }}>{q.exam}</p>
                      </div>
                      <span className="an-badge an-badge-red" style={{ flexShrink: 0 }}>
                        {q.count} report{q.count !== 1 ? 's' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

        {/* Recent Bulk Imports */}
        {data.recentImports.length > 0 && (
          <div className="an-card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--an-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
              </svg>
              <span style={{ fontSize: 15, fontWeight: 800 }}>Recent Bulk Imports</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {data.recentImports.map((imp: any) => (
                <div key={imp.id} className="an-import-row">
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>
                      {imp.questions_imported.toLocaleString()} questions imported
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--an-muted)', marginTop: 2 }}>
                      {new Date(imp.created_at).toLocaleString('en-US', {
                        year: 'numeric', month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {imp.warnings > 0 && (
                      <span className="an-badge an-badge-yellow">{imp.warnings} warning{imp.warnings !== 1 ? 's' : ''}</span>
                    )}
                    {imp.errors > 0 && (
                      <span className="an-badge an-badge-red">{imp.errors} error{imp.errors !== 1 ? 's' : ''}</span>
                    )}
                    {imp.errors === 0 && imp.warnings === 0 && (
                      <span className="an-badge an-badge-green">Clean</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </>
  )
}