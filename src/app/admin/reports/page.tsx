import { createServerSupabaseClient } from '@/lib/supabase/server'
import ReportActions from '@/components/admin/ReportActions'

async function getReports() {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('reports')
    .select(`
      *,
      question:questions(
        question_text,
        exam:exams(title)
      )
    `)
    .order('created_at', { ascending: false })
  return data || []
}

export default async function ReportsPage() {
  const reports = await getReports()

  const newCount      = reports.filter(r => r.status === 'new').length
  const reviewCount   = reports.filter(r => r.status === 'under_review').length
  const resolvedCount = reports.filter(r => r.status === 'resolved').length

  function formatCategory(cat: string) {
    return cat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  function statusMeta(status: string): { label: string; dot: string; badge: string } {
    switch (status) {
      case 'new':          return { label: 'New',          dot: '#f97316', badge: 'rp-badge-orange' }
      case 'under_review': return { label: 'Under Review', dot: '#3b82f6', badge: 'rp-badge-blue'   }
      case 'resolved':     return { label: 'Resolved',     dot: '#22c55e', badge: 'rp-badge-green'  }
      case 'rejected':     return { label: 'Rejected',     dot: '#9ca3af', badge: 'rp-badge-gray'   }
      default:             return { label: status,          dot: '#9ca3af', badge: 'rp-badge-gray'   }
    }
  }

  const css = `
    .rp-root {
      --rp-bg:      oklch(98% 0.006 55);
      --rp-elev:    oklch(100% 0 0);
      --rp-soft:    oklch(96% 0.009 55);
      --rp-fg:      oklch(22% 0.02 50);
      --rp-muted:   oklch(46% 0.02 50);
      --rp-bd:      oklch(89% 0.012 50);
      --rp-primary: oklch(50% 0.19 25);
      --rp-psoft:   oklch(94% 0.035 25);
    }
    .dark .rp-root {
      --rp-bg:      oklch(18% 0.01 50);
      --rp-elev:    oklch(22% 0.012 50);
      --rp-soft:    oklch(20% 0.01 50);
      --rp-fg:      oklch(92% 0.008 50);
      --rp-muted:   oklch(62% 0.015 50);
      --rp-bd:      oklch(32% 0.015 50);
      --rp-primary: oklch(68% 0.18 25);
      --rp-psoft:   oklch(28% 0.06 25);
    }
    @keyframes rp-fade { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
    .rp-fade { animation: rp-fade 0.35s ease-out; }
    .rp-card { background:var(--rp-elev); border:1px solid var(--rp-bd); border-radius:18px; }

    /* stat cards */
    .rp-stat-orange { background:oklch(96% 0.03 50); border:1px solid oklch(88% 0.05 50); }
    .rp-stat-blue   { background:var(--rp-soft); border:1px solid var(--rp-bd); }
    .rp-stat-green  { background:var(--rp-soft); border:1px solid var(--rp-bd); }
    .dark .rp-stat-orange { background:oklch(24% 0.04 50); border-color:oklch(36% 0.05 50); }

    /* status badges */
    .rp-badge { display:inline-flex; align-items:center; gap:6px; border-radius:20px;
      padding:4px 10px; font-size:12px; font-weight:700; white-space:nowrap; }
    .rp-badge-dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
    .rp-badge-orange { background:oklch(96% 0.04 50); color:oklch(55% 0.16 50); }
    .rp-badge-blue   { background:oklch(94% 0.04 245); color:oklch(50% 0.18 245); }
    .rp-badge-green  { background:oklch(94% 0.04 145); color:oklch(45% 0.16 145); }
    .rp-badge-gray   { background:var(--rp-soft); color:var(--rp-muted); }
    .dark .rp-badge-orange { background:oklch(26% 0.05 50); color:oklch(72% 0.14 50); }
    .dark .rp-badge-blue   { background:oklch(26% 0.05 245); color:oklch(72% 0.12 245); }
    .dark .rp-badge-green  { background:oklch(26% 0.05 145); color:oklch(72% 0.12 145); }
    .dark .rp-badge-gray   { background:var(--rp-soft); color:var(--rp-muted); }

    /* table */
    .rp-table { width:100%; border-collapse:collapse; }
    .rp-th { padding:12px 16px; text-align:left; font-size:11px; font-weight:700;
      color:var(--rp-muted); text-transform:uppercase; letter-spacing:0.05em;
      background:var(--rp-soft); border-bottom:1px solid var(--rp-bd); }
    .rp-th:first-child { border-radius:0; }
    .rp-td { padding:14px 16px; font-size:13.5px; color:var(--rp-fg);
      border-bottom:1px solid var(--rp-bd); vertical-align:top; }
    .rp-tr:last-child .rp-td { border-bottom:none; }
    .rp-tr:hover .rp-td { background:var(--rp-soft); }
    .rp-tr { transition:background 0.12s; }

    /* category tag */
    .rp-cat-tag { display:inline-flex; align-items:center; gap:5px; border-radius:8px;
      padding:3px 9px; font-size:12px; font-weight:700; background:var(--rp-psoft);
      color:var(--rp-primary); }

    /* question text */
    .rp-q-text { font-size:13.5px; font-weight:600; color:var(--rp-fg);
      display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;
      overflow:hidden; line-height:1.5; max-width:280px; }
    .rp-q-exam { font-size:12px; color:var(--rp-muted); margin-top:3px; }
    .rp-desc { font-size:13px; color:var(--rp-muted); max-width:220px;
      display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }

    /* empty state */
    .rp-empty { display:flex; flex-direction:column; align-items:center; justify-content:center;
      padding:80px 20px; text-align:center; color:var(--rp-muted); gap:12px; }

    /* scrollbar */
    .rp-scrollbar::-webkit-scrollbar { width:7px; height:7px; }
    .rp-scrollbar::-webkit-scrollbar-thumb { background:var(--rp-bd); border-radius:8px; }

    @media (max-width: 768px) {
      .rp-stats-grid { grid-template-columns: 1fr !important; }
      .rp-table-wrap { font-size:12px; }
      .rp-th-hide, .rp-td-hide { display:none; }
    }
  `

  return (
    <>
      <style>{css}</style>
      <div
        className="rp-root rp-fade"
        style={{
          fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
          color: 'var(--rp-fg)',
          maxWidth: 1280,
          margin: '0 auto',
          padding: '28px 32px 64px',
          width: '100%',
        }}
      >

        {/* Page Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 800 }}>Reports</h1>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--rp-muted)' }}>
            Review and resolve student-submitted question reports.
          </p>
        </div>

        {/* Stats */}
        <div
          className="rp-stats-grid"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 22 }}
        >
          <div className="rp-stat-orange" style={{ borderRadius: 16, padding: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#f97316' }}>{newCount}</div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--rp-muted)', marginTop: 4 }}>New Reports</div>
          </div>
          <div className="rp-stat-blue" style={{ borderRadius: 16, padding: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#3b82f6' }}>{reviewCount}</div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--rp-muted)', marginTop: 4 }}>Under Review</div>
          </div>
          <div className="rp-stat-green" style={{ borderRadius: 16, padding: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#22c55e' }}>{resolvedCount}</div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--rp-muted)', marginTop: 4 }}>Resolved</div>
          </div>
        </div>

        {/* Reports Table */}
        <div className="rp-card" style={{ overflow: 'hidden' }}>
          {reports.length === 0 ? (
            <div className="rp-empty">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                <line x1="4" y1="22" x2="4" y2="15"/>
              </svg>
              <div style={{ fontSize: 15, fontWeight: 700 }}>No reports yet</div>
              <div style={{ fontSize: 13, maxWidth: 280 }}>Reports submitted by students will appear here.</div>
            </div>
          ) : (
            <div className="rp-table-wrap rp-scrollbar" style={{ overflowX: 'auto' }}>
              <table className="rp-table">
                <thead>
                  <tr>
                    <th className="rp-th">#</th>
                    <th className="rp-th">Question</th>
                    <th className="rp-th">Category</th>
                    <th className="rp-th rp-th-hide">Description</th>
                    <th className="rp-th">Status</th>
                    <th className="rp-th rp-th-hide">Date</th>
                    <th className="rp-th">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report, idx) => {
                    const { label, dot, badge } = statusMeta(report.status)
                    return (
                      <tr key={report.id} className="rp-tr">
                        {/* Index */}
                        <td className="rp-td" style={{ width: 48 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--rp-muted)' }}>
                            {idx + 1}
                          </span>
                        </td>

                        {/* Question */}
                        <td className="rp-td">
                          <div className="rp-q-text">
                            {report.question?.question_text || 'Unknown question'}
                          </div>
                          {report.question?.exam?.title && (
                            <div className="rp-q-exam">{report.question.exam.title}</div>
                          )}
                        </td>

                        {/* Category */}
                        <td className="rp-td">
                          <span className="rp-cat-tag">
                            {formatCategory(report.category)}
                          </span>
                        </td>

                        {/* Description */}
                        <td className="rp-td rp-td-hide">
                          <div className="rp-desc">
                            {report.description || <span style={{ color: 'var(--rp-muted)', fontStyle: 'italic' }}>No description</span>}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="rp-td">
                          <span className={`rp-badge ${badge}`}>
                            <span className="rp-badge-dot" style={{ background: dot }} />
                            {label}
                          </span>
                        </td>

                        {/* Date */}
                        <td className="rp-td rp-td-hide" style={{ whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: 13, color: 'var(--rp-muted)' }}>
                            {new Date(report.created_at).toLocaleDateString('en-US', {
                              year: 'numeric', month: 'short', day: 'numeric',
                            })}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="rp-td">
                          <ReportActions reportId={report.id} currentStatus={report.status} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </>
  )
}