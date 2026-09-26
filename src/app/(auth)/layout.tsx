// Auth layout — split screen shared by /login and /register.
// Left: brand panel with a preview of the exam (desktop only).
// Right: the page's form. All auth form styles live here so both pages match.

import Link from 'next/link'
import { Check, Zap, BarChart3, Target, Bookmark } from 'lucide-react'

const AUTH_CSS = `
  /* desktop: the brand panel stays put and only the form column scrolls */
  .au { height: 100vh; overflow: hidden; display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); background: var(--bg); color: var(--fg); font-family: "Plus Jakarta Sans", system-ui, sans-serif; }

  /* ════════ Brand panel ════════ */
  .au-brand {
    position: relative; height: 100vh; overflow: hidden; isolation: isolate;
    display: flex; flex-direction: column; justify-content: space-between; gap: 32px; padding: 40px 56px;
    background: var(--panel-dark); color: var(--panel-dark-fg);
  }
  .au-brand::before {
    content: ''; position: absolute; z-index: -1; inset: 0; pointer-events: none;
    background-image: radial-gradient(rgba(255, 255, 255, .07) 1px, transparent 1px); background-size: 26px 26px;
    -webkit-mask-image: radial-gradient(70% 60% at 30% 40%, #000, transparent 75%);
            mask-image: radial-gradient(70% 60% at 30% 40%, #000, transparent 75%);
  }
  .au-glow { position: absolute; z-index: -1; border-radius: 50%; pointer-events: none; }
  .au-glow-1 { top: -240px; right: -200px; width: 640px; height: 640px; background: radial-gradient(circle, color-mix(in srgb, var(--clr-primary) 55%, transparent), transparent 66%); opacity: .6; }
  .au-glow-2 { bottom: -260px; left: -180px; width: 520px; height: 520px; background: radial-gradient(circle, color-mix(in srgb, var(--clr-primary) 35%, transparent), transparent 66%); opacity: .45; }

  .au-logo { display: inline-flex; align-items: center; gap: 12px; color: inherit; text-decoration: none; align-self: flex-start; }
  .au-logo img { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; box-shadow: 0 0 0 3px rgba(255, 255, 255, .12); }
  .au-logo b { display: block; font-size: 16px; font-weight: 800; letter-spacing: -0.01em; }
  .au-logo small { display: block; font-size: 12px; font-weight: 600; color: var(--panel-dark-mut); }

  .au-pitch { display: flex; flex-direction: column; gap: 28px; max-width: 480px; }
  .au-pitch h2 { margin: 0; font-size: clamp(34px, 3.6vw, 48px); font-weight: 800; letter-spacing: -0.045em; line-height: 1.02; }
  .au-pitch h2 em { font-style: normal; color: #ff8a9c; }
  .au-pitch p { margin: 0; font-size: 15.5px; line-height: 1.65; color: var(--panel-dark-mut); }

  /* exam preview */
  .au-stack { position: relative; max-width: 420px; }
  .au-stack::before {
    content: ''; position: absolute; inset: 14px -14px -14px 14px; border-radius: 20px;
    background: rgba(255, 255, 255, .06); border: 1px solid var(--panel-dark-bd); transform: rotate(3deg);
  }
  .au-card {
    position: relative; display: flex; flex-direction: column; gap: 12px; padding: 18px; border-radius: 20px;
    background: var(--bg-elev); color: var(--fg); box-shadow: 0 30px 70px rgba(0, 0, 0, .45);
  }
  .au-card-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 12px; font-weight: 800; color: var(--fg-2); }
  .au-card-top span:first-child { display: inline-flex; align-items: center; gap: 7px; }
  .au-card-top span:first-child::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: var(--ok); }
  .au-card-time { font-family: "JetBrains Mono", ui-monospace, monospace; font-weight: 600; padding: 4px 9px; border-radius: 8px; background: var(--bg-soft); border: 1px solid var(--bd); }
  .au-pitch .au-card-q { margin: 0; font-size: 14px; font-weight: 700; line-height: 1.5; color: var(--fg); }
  .au-opt { display: flex; align-items: center; gap: 10px; padding: 9px 11px; border-radius: 11px; border: 1.5px solid var(--bd); background: var(--bg-soft); font-size: 13px; font-weight: 700; opacity: .55; }
  .au-opt i { width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; font-style: normal; font-size: 11px; font-weight: 800; background: var(--bg-elev); border: 1px solid var(--bd); color: var(--fg-muted); }
  .au-opt.ok { opacity: 1; border-color: var(--ok); background: var(--ok-soft); }
  .au-opt.ok i { background: var(--ok); border-color: var(--ok); color: #fff; }
  .au-opt.ok span { margin-left: auto; font-size: 10px; font-weight: 800; letter-spacing: .08em; color: var(--ok-ink); }

  .au-feats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 20px; }
  .au-feat { display: flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 700; color: var(--panel-dark-fg); }
  .au-feat span { width: 30px; height: 30px; border-radius: 10px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, .08); color: #ff8a9c; }
  .au-foot { font-size: 12px; font-weight: 600; color: var(--panel-dark-mut); }

  /* ════════ Form side ════════ */
  .au-side { display: flex; flex-direction: column; min-width: 0; height: 100vh; overflow-y: auto; padding: 32px 48px; }
  .au-mobile-brand { display: none; }
  .au-center { flex: 1 1 auto; display: flex; align-items: center; justify-content: center; padding: 24px 0; }
  .au-form-wrap { width: 100%; max-width: 440px; }

  .au-head { display: flex; flex-direction: column; gap: 8px; margin-bottom: 28px; }
  .au-eyebrow { display: inline-flex; align-items: center; gap: 10px; font-size: 12px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--clr-primary); }
  .au-eyebrow::before { content: ''; width: 22px; height: 2px; border-radius: 2px; background: currentColor; }
  .au-h1 { margin: 0; font-size: 34px; font-weight: 800; letter-spacing: -0.04em; line-height: 1.1; }
  .au-sub { margin: 0; font-size: 14.5px; line-height: 1.55; color: var(--fg-muted); }

  .au-form { display: flex; flex-direction: column; gap: 18px; }
  .au-group { display: flex; flex-direction: column; gap: 14px; }
  .au-group-title { font-size: 11.5px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--fg-faint); padding-bottom: 2px; border-bottom: 1px solid var(--bd); }
  .au-grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }

  .au-label { display: flex; flex-direction: column; gap: 7px; font-size: 13px; font-weight: 700; color: var(--fg-2); min-width: 0; }
  .au-label em { font-style: normal; font-weight: 600; color: var(--fg-faint); }
  .au-field { position: relative; display: flex; align-items: center; }
  .au-field > svg { position: absolute; left: 14px; color: var(--fg-faint); pointer-events: none; transition: color var(--dur-2); }
  .au-input {
    width: 100%; height: 48px; padding: 0 14px 0 42px; border-radius: 13px;
    border: 1.5px solid var(--bd); background: var(--bg-elev); color: var(--fg);
    font: inherit; font-size: 14.5px; font-weight: 600; outline: none; box-sizing: border-box;
    transition: border-color var(--dur-2), box-shadow var(--dur-2), background-color var(--dur-2);
  }
  .au-input::placeholder { color: var(--fg-faint); font-weight: 500; }
  .au-input:hover { border-color: var(--bd-strong); }
  .au-input:focus { border-color: var(--clr-primary); box-shadow: 0 0 0 4px var(--clr-soft); }
  .au-field:focus-within > svg { color: var(--clr-primary); }
  .au-input.has-toggle { padding-right: 46px; }
  select.au-input.is-empty { color: var(--fg-faint); font-weight: 500; }
  select.au-input { appearance: none; -webkit-appearance: none; padding-right: 40px; cursor: pointer; }
  .au-chev { position: absolute; right: 14px; color: var(--fg-muted); pointer-events: none; }
  .au-eye {
    position: absolute; right: 6px; width: 36px; height: 36px; border-radius: 10px; border: 0; background: transparent;
    color: var(--fg-muted); display: flex; align-items: center; justify-content: center; cursor: pointer;
  }
  .au-eye:hover { background: var(--bg-soft); color: var(--fg); }

  .au-meter { display: flex; align-items: center; gap: 10px; margin-top: 2px; }
  .au-meter-bars { flex: 1 1 auto; display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
  .au-meter-bars i { height: 4px; border-radius: 999px; background: var(--track); transition: background-color var(--dur-2); }
  .au-meter span { font-size: 11.5px; font-weight: 700; color: var(--fg-muted); min-width: 62px; text-align: right; }

  .au-alert { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border-radius: 13px; font-size: 13px; font-weight: 600; line-height: 1.5; }
  .au-alert svg { flex-shrink: 0; margin-top: 1px; }
  .au-alert-error { background: var(--clr-soft); border: 1px solid color-mix(in srgb, var(--clr-primary) 35%, transparent); color: var(--clr-ink); }
  .au-alert-ok { background: var(--ok-soft); border: 1px solid var(--ok-bd); color: var(--ok-ink); }

  .au-submit {
    display: flex; align-items: center; justify-content: center; gap: 9px; width: 100%; height: 50px; border-radius: 14px; border: 0;
    background: var(--clr-primary); color: #fff; font: inherit; font-size: 15px; font-weight: 800; cursor: pointer;
    box-shadow: 0 12px 26px var(--clr-glow);
  }
  .au-submit:disabled { opacity: .7; cursor: not-allowed; box-shadow: none; }

  .au-divider { display: flex; align-items: center; gap: 12px; font-size: 12.5px; font-weight: 700; color: var(--fg-faint); }
  .au-divider::before, .au-divider::after { content: ''; flex: 1 1 auto; height: 1px; background: var(--bd); }
  .au-alt {
    display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; height: 48px; border-radius: 14px;
    border: 1.5px solid var(--bd); background: var(--bg-elev); color: var(--fg); font-size: 14.5px; font-weight: 800; text-decoration: none;
  }
  .au-alt:hover { border-color: var(--bd-strong); }
  .au-back { display: inline-flex; align-items: center; gap: 6px; align-self: center; font-size: 13px; font-weight: 700; color: var(--fg-muted); text-decoration: none; }
  .au-back:hover { color: var(--fg); }

  /* ════════ Responsive ════════ */
  @media (max-height: 800px) {
    .au-brand { padding-top: 28px; padding-bottom: 28px; }
    .au-stack { display: none; }
  }
  @media (max-width: 1100px) {
    .au-brand { padding: 36px 40px; }
    .au-side { padding: 28px 32px; }
  }
  @media (max-width: 900px) {
    .au { grid-template-columns: minmax(0, 1fr); height: auto; min-height: 100vh; overflow: visible; }
    .au-brand { display: none; }
    .au-side { height: auto; overflow: visible; padding: 20px 20px 40px; }
    .au-mobile-brand { display: flex; align-items: center; gap: 12px; color: inherit; text-decoration: none; }
    .au-mobile-brand img { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
    .au-mobile-brand b { display: block; font-size: 15px; font-weight: 800; }
    .au-mobile-brand small { display: block; font-size: 11.5px; font-weight: 600; color: var(--fg-muted); }
    .au-center { align-items: flex-start; padding-top: 32px; }
  }
  @media (max-width: 480px) {
    .au-h1 { font-size: 28px; }
    .au-grid-2 { grid-template-columns: minmax(0, 1fr); }
  }
`

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="au">
      {/* dangerouslySetInnerHTML keeps quotes and '>' in the CSS unescaped */}
      <style dangerouslySetInnerHTML={{ __html: AUTH_CSS }} />

      {/* ── Brand panel (desktop) ───────────────────────────────── */}
      <aside className="au-brand">
        <span className="au-glow au-glow-1" />
        <span className="au-glow au-glow-2" />

        <Link href="/" className="au-logo a-fade">
          <img src="/images/logo.jpg" alt="" />
          <span><b>Medical Club</b><small>Faculty of Medicine — Hashemite University</small></span>
        </Link>

        <div className="au-pitch">
          <h2 className="a-rise">Practice like it’s <em>the real exam.</em></h2>
          <p className="a-rise" style={{ ['--i' as string]: 1 } as React.CSSProperties}>
            Past exams for every medical year, instant feedback on every answer,
            and a record of every mistake — so you walk in ready.
          </p>

          <div className="au-stack a-rise" style={{ ['--i' as string]: 2 } as React.CSSProperties}>
            <div className="au-card a-float">
              <div className="au-card-top"><span>Cardiology · Final 2025</span><span className="au-card-time">18:42</span></div>
              <p className="au-card-q">Which drug reduces mortality in heart failure with reduced ejection fraction?</p>
              <div className="au-opt"><i>A</i>Digoxin</div>
              <div className="au-opt ok"><i><Check size={12} strokeWidth={3} /></i>Spironolactone<span>CORRECT</span></div>
              <div className="au-opt"><i>C</i>Furosemide</div>
            </div>
          </div>

          <div className="au-feats a-rise" style={{ ['--i' as string]: 3 } as React.CSSProperties}>
            <div className="au-feat"><span><Zap size={15} /></span>Instant feedback</div>
            <div className="au-feat"><span><BarChart3 size={15} /></span>Results by chapter</div>
            <div className="au-feat"><span><Target size={15} /></span>Wrong questions saved</div>
            <div className="au-feat"><span><Bookmark size={15} /></span>Bookmarks &amp; review</div>
          </div>
        </div>

        <span className="au-foot">© Medical Club</span>
      </aside>

      {/* ── Form side ───────────────────────────────────────────── */}
      <main className="au-side">
        <Link href="/" className="au-mobile-brand">
          <img src="/images/logo.jpg" alt="" />
          <span><b>Medical Club</b><small>Faculty of Medicine — Hashemite University</small></span>
        </Link>
        <div className="au-center">
          <div className="au-form-wrap">{children}</div>
        </div>
      </main>
    </div>
  )
}