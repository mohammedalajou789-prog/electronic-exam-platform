import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  BookOpen, FlaskConical, Microscope,
  Stethoscope, Heart, GraduationCap,
} from 'lucide-react'

const YEAR_ICONS = [BookOpen, FlaskConical, Microscope, Stethoscope, Heart, GraduationCap]
const YEAR_STAGE = ['Pre-Clinical', 'Pre-Clinical', 'Pre-Clinical', 'Clinical', 'Clinical', 'Clinical']

export default async function HomePage() {
  const supabase = await createServerSupabaseClient()

  const [yearsRes, subjectsRes, examsRes, doctorsRes] = await Promise.all([
    supabase.from('academic_years').select('id, name, display_order').order('display_order'),
    supabase.from('subjects').select('id', { count: 'exact', head: true }),
    supabase.from('exams').select('id', { count: 'exact', head: true }),
    supabase.from('doctors').select('id', { count: 'exact', head: true }),
  ])

  const academicYears = yearsRes.data ?? []
  const totalSubjects = subjectsRes.count ?? 0
  const totalExams    = examsRes.count ?? 0
  const totalDoctors  = doctorsRes.count ?? 0

  const stats = [
    { value: academicYears.length, label: 'Years'    },
    { value: totalSubjects,        label: 'Subjects' },
    { value: totalExams,           label: 'Exams'    },
    { value: totalDoctors,         label: 'Doctors'  },
  ]

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', background: 'var(--bg)', color: 'var(--fg)' }}>
      <style>{`
        @keyframes floatY { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes glow   { 0%,100%{opacity:.55} 50%{opacity:.9} }

        .year-card-new {
          display:flex; align-items:center; gap:14px;
          background:var(--bg-elev); border:1px solid var(--bd);
          border-radius:16px; padding:18px 20px; cursor:pointer;
          text-decoration:none; color:inherit;
          transition:transform 0.2s, box-shadow 0.2s;
        }
        .year-card-new:hover { transform:translateY(-2px); box-shadow:0 8px 24px var(--shadow); }

        .btn-primary {
          text-decoration:none; color:#fff; font-weight:700; font-size:15px;
          padding:13px 26px; border-radius:12px; background:var(--clr-primary);
          box-shadow:rgba(196,18,48,0.18) 0px 8px 20px;
          display:inline-flex; align-items:center; gap:8px;
        }
        .btn-secondary {
          text-decoration:none; color:var(--fg); font-weight:700; font-size:15px;
          padding:13px 26px; border-radius:12px; border:1px solid var(--bd);
          background:var(--bg-elev);
          display:inline-flex; align-items:center; gap:8px;
        }

        /* Hero */
        .hero-section  { padding: 64px 40px 48px; }
        .hero-grid     { display:grid; grid-template-columns:1.05fr 0.95fr; gap:56px; align-items:center; }
        .hero-logo-col { display:flex; position:relative; align-items:center; justify-content:center; min-height:420px; }
        .hero-h1       { font-size:56px; line-height:1.05; font-weight:800; letter-spacing:-0.03em; margin:0 0 18px; color:var(--fg); }

        /* Stats */
        .stats-row  { display:flex; gap:10px; flex-wrap:nowrap; }
        .stat-pill  { display:flex; align-items:center; gap:8px; background:var(--bg-elev); border:1px solid var(--bd); border-radius:12px; padding:10px 16px; flex:1; min-width:0; }
        .stat-pill-num { font-size:20px; font-weight:800; color:var(--clr-primary); line-height:1; }
        .stat-pill-lbl { font-size:11.5px; font-weight:600; color:var(--fg-muted); white-space:nowrap; }

        /* CTA */
        .cta-row { display:flex; gap:12px; margin-bottom:28px; flex-wrap:wrap; }

        /* Floating badges */
        .float-badge-top {
          position:absolute; top:14px; left:0;
          background:var(--bg-elev); border:1px solid var(--bd); border-radius:14px;
          padding:10px 14px; display:flex; align-items:center; gap:8px;
          animation:floatY 5s ease-in-out infinite;
        }
        .float-badge-bottom {
          position:absolute; bottom:26px; right:-6px;
          background:var(--bg-elev); border:1px solid var(--bd); border-radius:14px;
          padding:10px 14px; display:flex; align-items:center; gap:8px;
          animation:floatY 6s ease-in-out 1s infinite;
        }

        /* Years — desktop: 3 cols */
        .years-section { padding:40px 40px 60px; }
        .years-grid    { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; }

        /* ── Mobile ── */
        @media (max-width: 768px) {
          .hero-section  { padding: 28px 18px 32px; }
          .years-section { padding: 28px 18px 48px; }

          /* Hide entire logo column on mobile */
          .hero-logo-col { display: none !important; }

          /* Single column text */
          .hero-grid { grid-template-columns:1fr; gap:0; }

          .hero-h1 { font-size:32px; margin-bottom:12px; }
          .hero-desc { font-size:14px !important; margin-bottom:20px !important; }
          .hero-badge { font-size:11px !important; padding:5px 12px !important; margin-bottom:16px !important; }

          /* Stats compact */
          .stats-row { gap:8px; }
          .stat-pill  { padding:8px 10px; border-radius:10px; gap:4px; flex-direction:column; align-items:center; justify-content:center; }
          .stat-pill-num { font-size:17px; }
          .stat-pill-lbl { font-size:10px; }

          /* CTA */
          .cta-row { gap:10px; margin-bottom:20px; }
          .btn-primary, .btn-secondary { font-size:14px; padding:11px 20px; }

          /* Years — 2 columns on mobile (3+3) */
          .years-grid    { grid-template-columns:1fr 1fr; gap:10px; }
          .year-card-new { padding:13px 14px; border-radius:14px; gap:10px; }
        }

        @media (max-width: 400px) {
          .hero-h1 { font-size:28px; }
        }
      `}</style>

      {/* ── Hero ── */}
      <section className="hero-section" style={{ position:'relative', overflow:'hidden', background:'var(--bg-soft)' }}>
        <div style={{ position:'absolute', inset:0, background:'radial-gradient(60% 50% at 25% 0%, rgba(196,18,48,0.08), transparent 70%)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', inset:0, backgroundImage:'radial-gradient(rgba(196,18,48,0.10) 1px, transparent 1px)', backgroundSize:'26px 26px', pointerEvents:'none' }} />
        <div style={{ position:'absolute', top:-140, right:-140, width:420, height:420, borderRadius:'50%', background:'radial-gradient(circle, rgba(196,18,48,0.14), transparent 70%)', pointerEvents:'none' }} />

        <div style={{ position:'relative', maxWidth:1280, margin:'0 auto' }}>
          <div className="hero-grid">

            {/* Left — text */}
            <div>
              <div className="hero-badge" style={{ display:'inline-flex', alignItems:'center', gap:8, background:'var(--bg-elev)', border:'1px solid var(--bd)', borderRadius:999, padding:'7px 16px', fontSize:13, fontWeight:700, color:'var(--clr-primary)', marginBottom:22 }}>
                <span style={{ width:7, height:7, borderRadius:'50%', background:'#c41230', display:'inline-block' }} />
                Faculty of Medicine — Hashemite University
              </div>

              <h1 className="hero-h1">Medical Club</h1>

              <p className="hero-desc" style={{ fontSize:16, lineHeight:1.65, color:'var(--fg-muted)', maxWidth:520, margin:'0 0 26px' }}>
                Test your knowledge, learn from your mistakes, and elevate your academic level through a comprehensive question bank covering all medical study years.
              </p>

              <div className="cta-row">
                <a href="#years" className="btn-primary">Start Practicing</a>
                <a href="#years" className="btn-secondary">Browse Years</a>
              </div>

              {/* Stats */}
              <div className="stats-row">
                {stats.map(s => (
                  <div key={s.label} className="stat-pill">
                    <div className="stat-pill-num">{s.value}</div>
                    <div className="stat-pill-lbl">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — logo (hidden on mobile via CSS) */}
            <div className="hero-logo-col">
              <div style={{ position:'absolute', width:340, height:340, borderRadius:'50%', background:'radial-gradient(circle, rgba(196,18,48,0.14), transparent 72%)', animation:'glow 4s ease-in-out infinite' }} />
              <div style={{ position:'absolute', width:300, height:300, border:'1.5px dashed var(--bd)', borderRadius:'50%' }} />
              <div style={{ position:'relative', filter:'drop-shadow(rgba(196,18,48,0.14) 0px 18px 36px)' }}>
                <img className="hero-logo-img" src="/images/logo.jpg" alt="Medical Club logo"
                  style={{ width:230, height:230, display:'block', objectFit:'contain', borderRadius:'50%' }} />
              </div>
              <div className="float-badge-top">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c41230" strokeWidth="2"><path d="M4 12h4l2 6 4-12 2 6h4"/></svg>
                <span style={{ fontSize:12.5, fontWeight:700 }}>Live Question Bank</span>
              </div>
              <div className="float-badge-bottom">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c41230" strokeWidth="2"><path d="M12 3l9 4-9 4-9-4 9-4z"/><path d="M3 12l9 4 9-4"/><path d="M3 16l9 4 9-4"/></svg>
                <span style={{ fontSize:12.5, fontWeight:700 }}>6 Academic Years</span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Academic Years ── */}
      <section id="years" className="years-section" style={{ background:'var(--bg)' }}>
        <div style={{ maxWidth:1280, margin:'0 auto' }}>
          <div style={{ marginBottom:20 }}>
            <h2 style={{ fontSize:22, fontWeight:800, margin:'0 0 4px' }}>Academic Years</h2>
            <p style={{ fontSize:14, color:'var(--fg-muted)', margin:0 }}>Pick your year to get started</p>
          </div>

          {academicYears.length > 0 ? (
            <div className="years-grid">
              {academicYears.map((year, index) => {
                const Icon  = YEAR_ICONS[index % YEAR_ICONS.length]
                const stage = YEAR_STAGE[index] ?? 'Clinical'
                const slug  = year.name.toLowerCase().replace(/\s+/g, '-')
                return (
                  <Link key={year.id} href={`/${encodeURIComponent(slug)}`} className="year-card-new">
                    <div style={{ width:44, height:44, flexShrink:0, borderRadius:12, background:'rgba(196,18,48,0.12)', display:'flex', alignItems:'center', justifyContent:'center', color:'#c41230' }}>
                      <Icon size={20} strokeWidth={1.8} />
                    </div>
                    <div style={{ flex:'1 1 0', minWidth:0 }}>
                      <div style={{ fontWeight:700, fontSize:14.5, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{year.name}</div>
                      <div style={{ fontSize:12, color:'var(--clr-primary)', fontWeight:600, marginTop:2 }}>{stage}</div>
                    </div>
                    <span style={{ color:'var(--fg-muted)', fontSize:18, flexShrink:0 }}>›</span>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', borderRadius:18, border:'1px dashed #f0dfdc', padding:'64px 24px', textAlign:'center' }}>
              <GraduationCap size={48} style={{ marginBottom:16, opacity:0.5, color:'var(--fg-muted)' }} />
              <h3 style={{ margin:'0 0 8px', fontSize:17, fontWeight:700 }}>No academic years available</h3>
              <p style={{ margin:0, fontSize:14, color:'var(--fg-muted)' }}>Content will appear here once it is added by an administrator.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}