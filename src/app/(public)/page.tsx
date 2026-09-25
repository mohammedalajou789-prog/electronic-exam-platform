import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import AcademicYearsSection from '@/components/shared/AcademicYearsSection'
import {
  ArrowRight, Play, Check, X, Bookmark, Lightbulb, RotateCcw, Shuffle, Target,
  FileDown, BarChart3, Zap, GraduationCap, ListChecks, Save, Eye,
} from 'lucide-react'

/** Stagger index for the shared animation classes in globals.css */
const stagger = (i: number): React.CSSProperties =>
  ({ ['--i' as string]: i } as React.CSSProperties)

// ── Demo question (works without JavaScript: radio inputs + :has()) ────────────

const DEMO = {
  exam: 'Obstetrics · Final 2025',
  q: 'A 29-year-old woman at 24 weeks’ gestation has a blood pressure of 162/104 mmHg. Which antihypertensive should be AVOIDED?',
  options: [
    { key: 'a', text: 'Methyldopa' },
    { key: 'b', text: 'Labetalol' },
    { key: 'c', text: 'Losartan (ARB)', correct: true },
    { key: 'd', text: 'Nifedipine' },
  ],
  explanation:
    'ARBs and ACE inhibitors are fetotoxic in the 2nd and 3rd trimesters — they cause oligohydramnios, renal dysgenesis and skull hypoplasia. Methyldopa, labetalol and nifedipine are the safe choices in pregnancy.',
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const HOME_CSS = `
  .hm { background: var(--bg); color: var(--fg); font-family: "Plus Jakarta Sans", system-ui, sans-serif; overflow-x: clip; }
  .hm-wrap { max-width: 1180px; margin: 0 auto; padding: 0 24px; }
  .hm-sr { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

  .hm-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 9px; height: 50px; padding: 0 24px; border-radius: 14px;
    font-size: 15px; font-weight: 800; text-decoration: none; white-space: nowrap; border: 1px solid transparent;
  }
  .hm-btn-solid { background: var(--clr-primary); color: #fff; box-shadow: 0 12px 28px var(--clr-glow); }
  .hm-btn-ghost { background: var(--bg-elev); color: var(--fg); border-color: var(--bd); }
  .hm-btn-ghost:hover { border-color: var(--bd-strong); }

  .hm-eyebrow { display: inline-flex; align-items: center; gap: 10px; font-size: 12.5px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--clr-primary); }
  .hm-eyebrow::before { content: ''; width: 22px; height: 2px; border-radius: 2px; background: currentColor; }
  .hm-h2 { margin: 0; font-size: clamp(28px, 3.6vw, 42px); font-weight: 800; letter-spacing: -0.04em; line-height: 1.08; }
  .hm-sub { margin: 0; max-width: 560px; font-size: 16px; line-height: 1.6; color: var(--fg-muted); }
  .hm-head { display: flex; flex-direction: column; gap: 14px; margin-bottom: 36px; }

  /* ════════ Hero ════════ */
  .hm-hero { position: relative; overflow: hidden; background: var(--bg-elev); border-bottom: 1px solid var(--bd); padding: 64px 0 72px; }
  .hm-hero::before {
    content: ''; position: absolute; inset: 0; pointer-events: none;
    background-image: radial-gradient(color-mix(in srgb, var(--clr-primary) 10%, transparent) 1px, transparent 1px);
    background-size: 26px 26px;
    -webkit-mask-image: radial-gradient(80% 70% at 70% 30%, #000, transparent 75%);
            mask-image: radial-gradient(80% 70% at 70% 30%, #000, transparent 75%);
  }
  .hm-glow { position: absolute; border-radius: 50%; pointer-events: none; }
  .hm-glow-1 { top: -260px; right: -160px; width: 760px; height: 760px; background: radial-gradient(circle, color-mix(in srgb, var(--clr-primary) 16%, transparent), transparent 66%); }
  .hm-glow-2 { bottom: -320px; left: -220px; width: 620px; height: 620px; background: radial-gradient(circle, color-mix(in srgb, var(--tone-blue-fg) 9%, transparent), transparent 66%); }

  .hm-hero-grid { position: relative; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 520px); gap: 64px; align-items: center; }
  .hm-hero-copy { display: flex; flex-direction: column; gap: 26px; min-width: 0; }
  .hm-badge {
    align-self: flex-start; display: inline-flex; align-items: center; gap: 10px; padding: 5px 16px 5px 5px; border-radius: 999px;
    background: var(--bg); border: 1px solid var(--bd); font-size: 13px; font-weight: 700; color: var(--fg-2);
  }
  .hm-badge img { width: 30px; height: 30px; border-radius: 50%; object-fit: cover; display: block; }
  .hm-h1 { margin: 0; font-size: clamp(44px, 6.6vw, 80px); font-weight: 800; letter-spacing: -0.055em; line-height: 0.98; }
  .hm-h1 em { font-style: normal; color: var(--clr-primary); }
  .hm-lead { margin: 0; max-width: 520px; font-size: 17px; line-height: 1.65; color: var(--fg-muted); }
  .hm-cta { display: flex; flex-wrap: wrap; gap: 12px; }

  .hm-spec { display: flex; align-items: stretch; padding-top: 26px; border-top: 1px solid var(--bd); }
  .hm-spec-item { display: flex; flex-direction: column; gap: 6px; padding: 0 26px; border-left: 1px solid var(--bd); }
  .hm-spec-item:first-child { padding-left: 0; border-left: none; }
  .hm-spec-value { font-size: 34px; font-weight: 800; letter-spacing: -0.04em; line-height: 1; }
  .hm-spec-label { font-size: 11.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--fg-muted); }

  /* ── Live demo card (a real mini exam) ── */
  .hm-stage { position: relative; }
  .hm-demo {
    position: relative; display: flex; flex-direction: column; gap: 16px; margin: 0; padding: 22px;
    border-radius: 26px; background: var(--bg-elev); border: 1px solid var(--bd);
    box-shadow: 0 30px 80px var(--shadow-lg), 0 0 0 8px color-mix(in srgb, var(--bg) 70%, transparent);
  }
  .hm-demo-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .hm-demo-exam { display: inline-flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 800; color: var(--fg-2); min-width: 0; }
  .hm-demo-exam i { width: 8px; height: 8px; border-radius: 50%; background: var(--ok); flex-shrink: 0; }
  .hm-demo-tools { display: inline-flex; align-items: center; gap: 8px; flex-shrink: 0; }
  .hm-timer {
    display: inline-flex; align-items: center; gap: 7px; height: 30px; padding: 0 11px; border-radius: 9px; background: var(--bg-soft); border: 1px solid var(--bd);
    font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 12.5px; font-weight: 600;
  }
  .hm-timer i { width: 7px; height: 7px; border-radius: 50%; background: var(--clr-primary); }
  .hm-icon-btn { width: 30px; height: 30px; border-radius: 9px; background: var(--clr-soft); color: var(--clr-primary); display: inline-flex; align-items: center; justify-content: center; }
  .hm-prog { display: flex; flex-direction: column; gap: 8px; }
  .hm-prog-row { display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; color: var(--fg-muted); }
  .hm-prog-row b { color: var(--fg); }
  .hm-track { height: 6px; border-radius: 999px; background: var(--track); overflow: hidden; }
  .hm-track i { display: block; height: 100%; border-radius: 999px; background: var(--clr-primary); }
  .hm-q { margin: 0; font-size: 16px; font-weight: 700; line-height: 1.55; }

  .hm-opts { display: flex; flex-direction: column; gap: 8px; border: 0; margin: 0; padding: 0; min-width: 0; }
  .hm-opt {
    position: relative; display: flex; align-items: center; gap: 12px; padding: 11px 13px; border-radius: 13px;
    border: 1.5px solid var(--bd); background: var(--bg-soft); font-size: 14.5px; font-weight: 700; cursor: pointer;
    transition: border-color var(--dur-2), background-color var(--dur-2), opacity var(--dur-2), transform var(--dur-1);
  }
  .hm-opt:hover { border-color: var(--bd-strong); background: var(--bg-elev); }
  .hm-opt:active { transform: scale(.99); }
  .hm-opt:has(input:focus-visible) { outline: 2px solid var(--clr-primary); outline-offset: 2px; }
  .hm-key {
    width: 28px; height: 28px; flex-shrink: 0; border-radius: 50%; background: var(--bg-elev); border: 1px solid var(--bd);
    display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; color: var(--fg-muted); text-transform: uppercase;
  }
  .hm-key svg { display: none; }
  .hm-opt-tag { margin-left: auto; font-size: 10.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; display: none; }

  /* after an answer is picked */
  .hm-demo:has(input:checked) .hm-opt { pointer-events: none; opacity: .5; }
  .hm-demo:has(input:checked) .hm-opt.is-correct,
  .hm-demo .hm-opt:has(input:checked) { opacity: 1; }
  .hm-demo:has(input:checked) .hm-opt.is-correct { border-color: var(--ok); background: var(--ok-soft); }
  .hm-demo:has(input:checked) .hm-opt.is-correct .hm-key { background: var(--ok); border-color: var(--ok); color: #fff; font-size: 0; }
  .hm-demo:has(input:checked) .hm-opt.is-correct .hm-key .hm-ok { display: block; }
  .hm-demo:has(input:checked) .hm-opt.is-correct .hm-opt-tag { display: inline; color: var(--ok-ink); }
  .hm-opt:not(.is-correct):has(input:checked) { border-color: var(--clr-primary); background: var(--clr-soft); }
  .hm-opt:not(.is-correct):has(input:checked) .hm-key { background: var(--clr-primary); border-color: var(--clr-primary); color: #fff; font-size: 0; }
  .hm-opt:not(.is-correct):has(input:checked) .hm-key .hm-bad { display: block; }
  .hm-opt:not(.is-correct):has(input:checked) .hm-opt-tag { display: inline; color: var(--clr-ink); }
  .hm-opt:has(input:checked) .hm-key { animation: mc-pop var(--dur-3) var(--ease-spring) both; }

  .hm-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 38px; }
  .hm-hint { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; color: var(--fg-muted); }
  .hm-hint i { width: 8px; height: 8px; border-radius: 50%; background: var(--clr-primary); }
  .hm-result { display: none; align-items: center; gap: 8px; font-size: 13px; font-weight: 800; }
  .hm-result span { width: 22px; height: 22px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: #fff; flex-shrink: 0; }
  .hm-result-ok { color: var(--ok-ink); } .hm-result-ok span { background: var(--ok); }
  .hm-result-bad { color: var(--clr-ink); } .hm-result-bad span { background: var(--clr-primary); }
  .hm-demo:has(input:checked) .hm-hint { display: none; }
  .hm-demo:has(.is-correct input:checked) .hm-result-ok { display: inline-flex; animation: mc-pop var(--dur-3) var(--ease-spring) both; }
  .hm-demo:has(input:checked):not(:has(.is-correct input:checked)) .hm-result-bad { display: inline-flex; animation: mc-pop var(--dur-3) var(--ease-spring) both; }
  .hm-reset {
    display: none; align-items: center; gap: 6px; height: 34px; padding: 0 12px; border-radius: 10px; border: 1px solid var(--bd);
    background: var(--bg-elev); color: var(--fg-muted); font: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer;
  }
  .hm-reset:hover { color: var(--fg); border-color: var(--bd-strong); }
  .hm-demo:has(input:checked) .hm-reset { display: inline-flex; }

  /* explanation — closed until asked for, just like the real exam */
  .hm-expl { display: none; border-radius: 14px; border: 1px solid var(--ok-bd); background: var(--ok-soft); overflow: hidden; }
  .hm-demo:has(input:checked) .hm-expl { display: block; animation: mc-rise var(--dur-3) var(--ease-out) both; }
  .hm-expl summary {
    list-style: none; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 11px 14px;
    font-size: 13px; font-weight: 800; color: var(--ok-ink); cursor: pointer;
  }
  .hm-expl summary::-webkit-details-marker { display: none; }
  .hm-expl summary span { display: inline-flex; align-items: center; gap: 8px; }
  .hm-expl summary::after { content: 'Show'; font-size: 12px; font-weight: 700; opacity: .8; }
  .hm-expl[open] summary::after { content: 'Hide'; }
  .hm-expl p { margin: 0; padding: 0 14px 14px; font-size: 13.5px; line-height: 1.6; color: var(--fg-2); }

  .hm-float {
    position: absolute; z-index: 2; display: inline-flex; align-items: center; gap: 10px; padding: 10px 14px 10px 10px; border-radius: 16px;
    background: var(--bg-elev); border: 1px solid var(--bd); box-shadow: 0 16px 36px var(--shadow-lg); font-size: 12.5px; font-weight: 800; white-space: nowrap;
  }
  .hm-float small { display: block; font-size: 11px; font-weight: 600; color: var(--fg-muted); }
  .hm-float-ic { width: 32px; height: 32px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .hm-float-1 { top: -22px; left: -46px; }
  .hm-float-1 .hm-float-ic { background: var(--ok-soft); color: var(--ok-ink); }
  .hm-float-2 { bottom: -26px; right: -34px; animation-delay: -3s; }
  .hm-float-2 .hm-float-ic { background: var(--clr-soft); color: var(--clr-primary); }

  /* ════════ Features (bento of real screens) ════════ */
  .hm-section { padding: 96px 0; }
  .hm-bento { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 18px; }
  .hm-tile {
    position: relative; overflow: hidden; display: flex; flex-direction: column; gap: 22px; padding: 26px;
    border-radius: 26px; background: var(--bg-elev); border: 1px solid var(--bd);
  }
  .hm-tile-3 { grid-column: span 3; }
  .hm-tile-2 { grid-column: span 2; }
  .hm-tile-copy { display: flex; flex-direction: column; gap: 8px; }
  .hm-tile-tag { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--tone, var(--clr-primary)); }
  .hm-tile-tag span { width: 28px; height: 28px; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center; background: color-mix(in srgb, var(--tone, var(--clr-primary)) 14%, transparent); }
  .hm-tile h3 { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.025em; line-height: 1.2; }
  .hm-tile p { margin: 0; font-size: 14px; line-height: 1.6; color: var(--fg-muted); }
  .hm-shot {
    margin-top: auto; padding: 16px; border-radius: 18px; background: var(--bg-soft); border: 1px solid var(--bd);
    display: flex; flex-direction: column; gap: 10px;
  }

  /* dark builder tile */
  .hm-tile-dark { background: var(--panel-dark); border-color: var(--panel-dark); color: var(--panel-dark-fg); }
  .hm-tile-dark::before {
    content: ''; position: absolute; top: -140px; right: -100px; width: 380px; height: 380px; border-radius: 50%; pointer-events: none;
    background: radial-gradient(circle, color-mix(in srgb, var(--clr-primary) 45%, transparent), transparent 68%); opacity: .55;
  }
  .hm-tile-dark > * { position: relative; }
  .hm-tile-dark p { color: var(--panel-dark-mut); }
  .hm-tile-dark .hm-tile-tag { color: #ff8a9c; }
  .hm-tile-dark .hm-tile-tag span { background: rgba(255, 255, 255, .1); }
  .hm-tile-dark .hm-shot { background: rgba(255, 255, 255, .06); border-color: var(--panel-dark-bd); }
  .hm-pill-row { display: flex; flex-wrap: wrap; gap: 6px; }
  .hm-pill-label { font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--panel-dark-mut); }
  .hm-pill { display: inline-flex; align-items: center; gap: 6px; padding: 6px 11px; border-radius: 999px; border: 1px solid var(--panel-dark-bd); font-size: 12px; font-weight: 700; }
  .hm-pill.on { background: #fff; border-color: #fff; color: #1a1210; }
  .hm-seg { display: flex; gap: 4px; padding: 4px; border-radius: 11px; background: rgba(0, 0, 0, .25); }
  .hm-seg span { flex: 1; text-align: center; padding: 6px 0; border-radius: 8px; font-size: 12px; font-weight: 800; color: var(--panel-dark-mut); }
  .hm-seg span.on { background: rgba(255, 255, 255, .14); color: #fff; }
  .hm-gen { display: flex; align-items: center; justify-content: center; gap: 8px; height: 40px; border-radius: 11px; background: var(--clr-primary); color: #fff; font-size: 13px; font-weight: 800; }

  /* results tile */
  .hm-res { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 20px; align-items: center; }
  .hm-ring { position: relative; width: 116px; height: 116px; }
  .hm-ring svg { display: block; transform: rotate(-90deg); }
  .hm-ring-val { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .hm-ring-val b { font-size: 28px; font-weight: 800; letter-spacing: -0.04em; line-height: 1; }
  .hm-ring-val small { font-size: 11px; font-weight: 700; color: var(--fg-muted); }
  .hm-bars { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
  .hm-bar-row { display: flex; flex-direction: column; gap: 5px; }
  .hm-bar-top { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; font-weight: 700; }
  .hm-bar-top span:last-child { font-family: "JetBrains Mono", ui-monospace, monospace; color: var(--fg-muted); }
  .hm-mini-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .hm-mini-stats div { padding: 10px; border-radius: 12px; background: var(--bg-elev); border: 1px solid var(--bd); display: flex; flex-direction: column; gap: 2px; }
  .hm-mini-stats b { font-size: 18px; font-weight: 800; letter-spacing: -0.03em; }
  .hm-mini-stats span { font-size: 10.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--fg-muted); }

  /* small list rows */
  .hm-row { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px; background: var(--bg-elev); border: 1px solid var(--bd); font-size: 12.5px; font-weight: 700; min-width: 0; }
  .hm-row > span:nth-child(2) { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .hm-row-ic { width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .hm-row-bad { background: var(--clr-primary); color: #fff; }
  .hm-row-bm { background: var(--clr-soft); color: var(--clr-primary); border-radius: 7px; }
  .hm-row-meta { flex-shrink: 0; font-size: 11px; font-weight: 700; color: var(--fg-faint); }
  .hm-chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .hm-chip { display: inline-flex; align-items: center; gap: 6px; padding: 4px 5px 4px 10px; border-radius: 999px; background: var(--bg-elev); border: 1px solid var(--bd); font-size: 11.5px; font-weight: 700; }
  .hm-chip b { padding: 0 6px; border-radius: 999px; background: var(--clr-soft); color: var(--clr-ink); font-size: 10.5px; }

  /* pdf tile */
  .hm-doc { position: relative; align-self: center; width: 150px; padding: 16px 14px; border-radius: 10px; background: var(--bg-elev); border: 1px solid var(--bd); box-shadow: 0 14px 30px var(--shadow); display: flex; flex-direction: column; gap: 7px; transform: rotate(-3deg); }
  .hm-doc i { display: block; height: 6px; border-radius: 3px; background: var(--track); }
  .hm-doc i.ok { background: var(--ok-bd); }
  .hm-doc-badge { position: absolute; right: -14px; bottom: 14px; padding: 5px 9px; border-radius: 8px; background: var(--clr-primary); color: #fff; font-size: 11px; font-weight: 800; transform: rotate(3deg); }

  /* ════════ Steps ════════ */
  .hm-steps-band { background: var(--bg-elev); border-top: 1px solid var(--bd); border-bottom: 1px solid var(--bd); }
  .hm-steps { position: relative; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; }
  .hm-steps::before { content: ''; position: absolute; top: 27px; left: 8%; right: 8%; height: 2px; background: repeating-linear-gradient(90deg, var(--bd-strong) 0 8px, transparent 8px 16px); }
  .hm-step { position: relative; display: flex; flex-direction: column; align-items: flex-start; gap: 12px; }
  .hm-step-num {
    width: 56px; height: 56px; border-radius: 18px; background: var(--bg); border: 1px solid var(--bd); color: var(--clr-primary);
    display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 8px var(--bg-elev);
  }
  .hm-step:nth-child(2) .hm-step-num { background: var(--clr-primary); border-color: var(--clr-primary); color: #fff; box-shadow: 0 0 0 8px var(--bg-elev), 0 12px 26px var(--clr-glow); }
  .hm-step small { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 12px; font-weight: 600; color: var(--fg-faint); }
  .hm-step h3 { margin: 0; font-size: 19px; font-weight: 800; letter-spacing: -0.02em; }
  .hm-step p { margin: 0; max-width: 300px; font-size: 14px; line-height: 1.6; color: var(--fg-muted); }

  /* ════════ Responsive ════════ */
  @media (max-width: 1080px) {
    .hm-hero-grid { grid-template-columns: minmax(0, 1fr); gap: 48px; }
    .hm-stage { max-width: 560px; }
    .hm-float-1 { left: auto; right: 24px; top: -26px; }
    .hm-float-2 { right: -10px; bottom: -28px; }
    .hm-bento { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .hm-tile-3, .hm-tile-2 { grid-column: span 1; }
    .hm-tile-2:last-child { grid-column: span 2; }
  }
  @media (max-width: 720px) {
    .hm-wrap { padding: 0 16px; }
    .hm-hero { padding: 32px 0 44px; }
    .hm-hero-copy { gap: 20px; }
    .hm-h1 { font-size: 44px; }
    .hm-lead { font-size: 15px; }
    .hm-cta .hm-btn { flex: 1 1 0; height: 48px; padding: 0 14px; font-size: 14px; }
    .hm-spec { padding-top: 20px; }
    .hm-spec-item { padding: 0 14px; }
    .hm-spec-value { font-size: 24px; }
    .hm-spec-label { font-size: 10px; letter-spacing: .06em; }
    .hm-demo { padding: 16px; border-radius: 22px; box-shadow: 0 20px 50px var(--shadow-lg); }
    .hm-q { font-size: 15px; }
    .hm-float { display: none; }
    .hm-section { padding: 64px 0; }
    .hm-head { margin-bottom: 26px; }
    .hm-sub { font-size: 15px; }
    .hm-bento { grid-template-columns: minmax(0, 1fr); gap: 14px; }
    .hm-tile-3, .hm-tile-2, .hm-tile-2:last-child { grid-column: auto; }
    .hm-tile { padding: 20px; border-radius: 22px; gap: 18px; }
    .hm-tile h3 { font-size: 20px; }
    .hm-res { grid-template-columns: minmax(0, 1fr); justify-items: center; }
    .hm-bars { width: 100%; }
    .hm-steps { grid-template-columns: minmax(0, 1fr); gap: 28px; }
    .hm-steps::before { top: 8%; bottom: 8%; left: 27px; right: auto; width: 2px; height: auto; background: repeating-linear-gradient(180deg, var(--bd-strong) 0 8px, transparent 8px 16px); }
    .hm-step { display: grid; grid-template-columns: 56px minmax(0, 1fr); column-gap: 16px; row-gap: 4px; }
    .hm-step-num { grid-row: span 3; }
  }
  @media (max-width: 400px) {
    .hm-h1 { font-size: 38px; }
    .hm-spec-item { padding: 0 10px; }
  }
`

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    redirect('/dashboard')
  }

  const [yearsRes, subjectsRes, examsRes, doctorsRes] = await Promise.all([
    supabase.from('academic_years').select('id', { count: 'exact', head: true }),
    supabase.from('subjects').select('id', { count: 'exact', head: true }),
    supabase.from('exams').select('id', { count: 'exact', head: true }),
    supabase.from('doctors').select('id', { count: 'exact', head: true }),
  ])

  const stats = [
    { value: yearsRes.count ?? 0,    label: 'Years'    },
    { value: subjectsRes.count ?? 0, label: 'Subjects' },
    { value: examsRes.count ?? 0,    label: 'Exams'    },
    { value: doctorsRes.count ?? 0,  label: 'Doctors'  },
  ]

  const C = 2 * Math.PI * 50 // results ring circumference

  return (
    <div className="hm">
      {/* dangerouslySetInnerHTML keeps quotes and '>' in the CSS unescaped */}
      <style dangerouslySetInnerHTML={{ __html: HOME_CSS }} />

      {/* ════════ Hero ════════ */}
      <section className="hm-hero">
        <div className="hm-glow hm-glow-1" />
        <div className="hm-glow hm-glow-2" />

        <div className="hm-wrap hm-hero-grid">
          {/* Copy */}
          <div className="hm-hero-copy">
            <span className="hm-badge a-fade">
              <img src="/images/logo.jpg" alt="" />
              Faculty of Medicine — Hashemite University
            </span>

            <h1 className="hm-h1 a-rise" style={stagger(1)}>
              Practice like it’s <em>the real exam.</em>
            </h1>

            <p className="hm-lead a-rise" style={stagger(2)}>
              Medical Club is a question bank built from real past exams for every medical year —
              with instant feedback, clear explanations and a record of every mistake you make.
            </p>

            <div className="hm-cta a-rise" style={stagger(3)}>
              <a href="#years" className="hm-btn hm-btn-solid press nudge">
                Start practicing <ArrowRight size={17} strokeWidth={2.4} />
              </a>
              <a href="#years" className="hm-btn hm-btn-ghost press">Browse years</a>
            </div>

            <div className="hm-spec a-rise" style={stagger(4)}>
              {stats.map(s => (
                <div key={s.label} className="hm-spec-item">
                  <span className="hm-spec-value">{s.value.toLocaleString()}</span>
                  <span className="hm-spec-label">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Live demo — a real question the visitor can answer */}
          <div className="hm-stage a-rise" style={stagger(2)}>
            <div className="hm-float hm-float-1 a-float">
              <span className="hm-float-ic"><Zap size={16} /></span>
              <span>Instant feedback<small>See the answer the moment you pick</small></span>
            </div>
            <div className="hm-float hm-float-2 a-float">
              <span className="hm-float-ic"><Save size={16} /></span>
              <span>Progress saved<small>Continue any time</small></span>
            </div>

            <form className="hm-demo" aria-label="Try a sample question">
              <div className="hm-demo-top">
                <span className="hm-demo-exam"><i />{DEMO.exam}</span>
                <span className="hm-demo-tools">
                  <span className="hm-timer"><i className="a-blink" />18:42</span>
                  <span className="hm-icon-btn"><Bookmark size={14} fill="currentColor" /></span>
                </span>
              </div>

              <div className="hm-prog">
                <div className="hm-prog-row"><span>Question <b>7</b> of 60</span><span>12%</span></div>
                <div className="hm-track"><i className="a-grow" style={{ width: '12%' }} /></div>
              </div>

              <p className="hm-q">{DEMO.q}</p>

              <fieldset className="hm-opts">
                <legend className="hm-sr">Choose an answer</legend>
                {DEMO.options.map(opt => (
                  <label key={opt.key} className={`hm-opt${opt.correct ? ' is-correct' : ''}`}>
                    <input type="radio" name="hm-demo" value={opt.key} className="hm-sr" />
                    <span className="hm-key">
                      {opt.key}
                      <Check size={14} strokeWidth={3} className="hm-ok" />
                      <X size={14} strokeWidth={3} className="hm-bad" />
                    </span>
                    {opt.text}
                    <span className="hm-opt-tag">{opt.correct ? 'Correct' : 'Your pick'}</span>
                  </label>
                ))}
              </fieldset>

              <details className="hm-expl">
                <summary><span><Lightbulb size={14} />Explanation</span></summary>
                <p>{DEMO.explanation}</p>
              </details>

              <div className="hm-foot">
                <span className="hm-hint"><i className="a-blink" />Try it — pick an answer</span>
                <span className="hm-result hm-result-ok"><span><Check size={13} strokeWidth={3} /></span>Correct — nice one!</span>
                <span className="hm-result hm-result-bad"><span><X size={13} strokeWidth={3} /></span>Not quite — it’s C</span>
                <button type="reset" className="hm-reset press"><RotateCcw size={13} />Try again</button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* ════════ Features — the real screens, in miniature ════════ */}
      <section className="hm-section">
        <div className="hm-wrap">
          <div className="hm-head">
            <span className="hm-eyebrow">Inside Medical Club</span>
            <h2 className="hm-h2">Everything you need to study,<br />in one place.</h2>
            <p className="hm-sub">Not just a list of questions — every tool is built around how medical students actually revise.</p>
          </div>

          <div className="hm-bento">
            {/* Custom exam builder */}
            <article className="hm-tile hm-tile-3 hm-tile-dark lift">
              <div className="hm-tile-copy">
                <span className="hm-tile-tag"><span><Shuffle size={15} /></span>Custom exam</span>
                <h3>Build your own exam in seconds</h3>
                <p>Mix questions from any batch, doctor, chapter or lecture — then solve them like the real thing.</p>
              </div>
              <div className="hm-shot">
                <span className="hm-pill-label">Chapter</span>
                <div className="hm-pill-row">
                  <span className="hm-pill on"><Check size={12} strokeWidth={3} />Cardiology</span>
                  <span className="hm-pill on"><Check size={12} strokeWidth={3} />Nephrology</span>
                  <span className="hm-pill">Endocrinology</span>
                  <span className="hm-pill">Hematology</span>
                </div>
                <span className="hm-pill-label">Questions</span>
                <div className="hm-seg"><span>10</span><span>20</span><span className="on">30</span><span>50</span><span>100</span></div>
                <span className="hm-gen"><Play size={13} fill="currentColor" />Generate exam</span>
              </div>
            </article>

            {/* Results */}
            <article className="hm-tile hm-tile-3 lift" style={{ ['--tone' as string]: 'var(--tone-blue-fg)' } as React.CSSProperties}>
              <div className="hm-tile-copy">
                <span className="hm-tile-tag"><span><BarChart3 size={15} /></span>Results</span>
                <h3>Know exactly where you stand</h3>
                <p>A score, a breakdown by chapter and the time you spent — the moment you finish.</p>
              </div>
              <div className="hm-shot">
                <div className="hm-res">
                  <div className="hm-ring">
                    <svg width="116" height="116" viewBox="0 0 116 116" aria-hidden="true">
                      <circle cx="58" cy="58" r="50" fill="none" stroke="var(--track)" strokeWidth="10" />
                      <circle
                        cx="58" cy="58" r="50" fill="none" stroke="var(--ok)" strokeWidth="10" strokeLinecap="round"
                        strokeDasharray={C} strokeDashoffset={C * 0.18} className="a-ring"
                        style={{ ['--c' as string]: C } as React.CSSProperties}
                      />
                    </svg>
                    <span className="hm-ring-val"><b>82%</b><small>49 / 60</small></span>
                  </div>
                  <div className="hm-bars">
                    {[['Cardiology', 92], ['Nephrology', 78], ['Endocrinology', 64]].map(([name, v], i) => (
                      <div key={name} className="hm-bar-row">
                        <div className="hm-bar-top"><span>{name}</span><span>{v}%</span></div>
                        <div className="hm-track"><i className="a-grow" style={{ ...stagger(i), width: `${v}%`, background: Number(v) < 70 ? 'var(--warn)' : 'var(--ok)' }} /></div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="hm-mini-stats">
                  <div><b>49</b><span>Correct</span></div>
                  <div><b>11</b><span>Wrong</span></div>
                  <div><b>42m</b><span>Time</span></div>
                </div>
              </div>
            </article>

            {/* Wrong questions */}
            <article className="hm-tile hm-tile-2 lift">
              <div className="hm-tile-copy">
                <span className="hm-tile-tag"><span><Target size={15} /></span>Wrong questions</span>
                <h3>Your mistakes, collected</h3>
                <p>Every question you miss is saved, grouped by subject, with your weakest chapters on top.</p>
              </div>
              <div className="hm-shot">
                <div className="hm-chips">
                  <span className="hm-chip">Hemodynamics<b>11</b></span>
                  <span className="hm-chip">Diuretics<b>7</b></span>
                </div>
                <div className="hm-row"><span className="hm-row-ic hm-row-bad"><X size={12} strokeWidth={3} /></span><span>Which drug is avoided in pregnancy?</span></div>
                <div className="hm-row"><span className="hm-row-ic hm-row-bad"><X size={12} strokeWidth={3} /></span><span>Most sensitive test for celiac disease?</span></div>
              </div>
            </article>

            {/* Bookmarks */}
            <article className="hm-tile hm-tile-2 lift" style={{ ['--tone' as string]: 'var(--tone-purple-fg)' } as React.CSSProperties}>
              <div className="hm-tile-copy">
                <span className="hm-tile-tag"><span><Bookmark size={15} /></span>Bookmarks</span>
                <h3>Save questions for later</h3>
                <p>Bookmark any question during an exam and revise them all together before the final.</p>
              </div>
              <div className="hm-shot">
                <div className="hm-row"><span className="hm-row-ic hm-row-bm"><Bookmark size={12} fill="currentColor" /></span><span>First-line treatment of HFrEF</span><span className="hm-row-meta">2d</span></div>
                <div className="hm-row"><span className="hm-row-ic hm-row-bm"><Bookmark size={12} fill="currentColor" /></span><span>Nephrotic vs nephritic syndrome</span><span className="hm-row-meta">5d</span></div>
                <div className="hm-row"><span className="hm-row-ic hm-row-bm"><Bookmark size={12} fill="currentColor" /></span><span>Causes of high anion gap acidosis</span><span className="hm-row-meta">1w</span></div>
              </div>
            </article>

            {/* Review + PDF */}
            <article className="hm-tile hm-tile-2 lift" style={{ ['--tone' as string]: 'var(--ok-ink)' } as React.CSSProperties}>
              <div className="hm-tile-copy">
                <span className="hm-tile-tag"><span><FileDown size={15} /></span>Review &amp; PDF</span>
                <h3>Study it your way</h3>
                <p>Read every answer in review mode, or export the exam as a PDF — with or without answers.</p>
              </div>
              <div className="hm-shot" style={{ alignItems: 'center', paddingTop: 22, paddingBottom: 22 }}>
                <div className="hm-doc">
                  <i style={{ width: '70%', height: 8, background: 'var(--fg-faint)' }} />
                  <i /><i style={{ width: '85%' }} />
                  <i className="ok" style={{ width: '60%' }} />
                  <i /><i style={{ width: '75%' }} />
                  <i className="ok" style={{ width: '50%' }} />
                  <span className="hm-doc-badge">PDF</span>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* ════════ How it works ════════ */}
      <section className="hm-section hm-steps-band">
        <div className="hm-wrap">
          <div className="hm-head">
            <span className="hm-eyebrow">How it works</span>
            <h2 className="hm-h2">From zero to exam-ready in three steps.</h2>
          </div>
          <div className="hm-steps">
            <div className="hm-step">
              <span className="hm-step-num"><GraduationCap size={22} /></span>
              <small>01</small>
              <h3>Pick your year</h3>
              <p>Choose your academic year, semester and subject.</p>
            </div>
            <div className="hm-step">
              <span className="hm-step-num"><ListChecks size={22} /></span>
              <small>02</small>
              <h3>Choose an exam</h3>
              <p>Past exams by batch and doctor — or build your own custom mix.</p>
            </div>
            <div className="hm-step">
              <span className="hm-step-num"><Eye size={22} /></span>
              <small>03</small>
              <h3>Practice &amp; review</h3>
              <p>Answer, read the explanation, then clear your wrong questions one by one.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ════════ Academic Years ════════ */}
      <AcademicYearsSection />
    </div>
  )
}