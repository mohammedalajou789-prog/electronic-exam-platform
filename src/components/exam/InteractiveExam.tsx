'use client'

import { useEffect, useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from '@/components/shared/ThemeProvider'

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuestionImage {
  id: string
  image_url: string
  caption: string | null
  display_order: number
}

interface QuestionStatistic {
  attempts: number
  correct_answers: number
  average_time: number
}

interface Question {
  id: string
  question_text: string
  question_order: number
  choice_a: string
  choice_b: string
  choice_c: string
  choice_d: string
  choice_e?: string | null
  correct_answer: 'a' | 'b' | 'c' | 'd' | 'e'
  explanation: string | null
  incorrect_explanation_a: string | null
  incorrect_explanation_b: string | null
  incorrect_explanation_c: string | null
  incorrect_explanation_d: string | null
  incorrect_explanation_e: string | null
  chapter: string | null
  lecture: string | null
  question_images: QuestionImage[]
  question_statistics: QuestionStatistic[]
}

interface Exam {
  id: string
  title: string
  duration_minutes: number | null
  timer_mode: 'none' | 'suggested' | 'strict'
  exam_doctors?: { doctor: { name: string } }[]
}

interface SavedProgress {
  current_question: number
  answers_json: Record<string, string>
  remaining_time: number | null
}

interface InteractiveExamProps {
  exam: Exam
  questions: Question[]
  savedProgress: SavedProgress | null
}

// ─── Design tokens (matches exam2.html perfectly) ─────────────────────────────

const LIGHT = {
  bg: 'oklch(98% 0.006 55)',
  bgElev: 'oklch(100% 0 0)',
  bgSoft: 'oklch(96% 0.009 55)',
  fg: 'oklch(22% 0.02 50)',
  fgMuted: 'oklch(46% 0.02 50)',
  border: 'oklch(89% 0.012 50)',
  primary: 'oklch(50% 0.19 25)',
  primarySoft: 'oklch(94% 0.035 25)',
  accentGreen: 'oklch(60% 0.14 145)',
  accentBlue: 'oklch(58% 0.13 250)',
  accentPurple: 'oklch(56% 0.14 300)',
  shadow: 'rgba(20,10,10,.08)',
}

const DARK = {
  bg: 'oklch(19% 0.014 260)',
  bgElev: 'oklch(24% 0.016 260)',
  bgSoft: 'oklch(22% 0.016 260)',
  fg: 'oklch(92% 0.008 260)',
  fgMuted: 'oklch(66% 0.018 260)',
  border: 'oklch(33% 0.02 260)',
  primary: 'oklch(66% 0.17 25)',
  primarySoft: 'oklch(30% 0.06 25)',
  accentGreen: 'oklch(68% 0.13 145)',
  accentBlue: 'oklch(68% 0.12 250)',
  accentPurple: 'oklch(68% 0.13 300)',
  shadow: 'rgba(0,0,0,.4)',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function getChoices(q: Question) {
  const entries: { key: string; text: string; explanation: string | null }[] = [
    { key: 'a', text: q.choice_a, explanation: q.incorrect_explanation_a },
    { key: 'b', text: q.choice_b, explanation: q.incorrect_explanation_b },
    { key: 'c', text: q.choice_c, explanation: q.incorrect_explanation_c },
    { key: 'd', text: q.choice_d, explanation: q.incorrect_explanation_d },
  ]
  if (q.choice_e) {
    entries.push({ key: 'e', text: q.choice_e, explanation: q.incorrect_explanation_e ?? null })
  }
  return entries
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

const IconChevronLeft = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 18l-6-6 6-6" />
  </svg>
)
const IconChevronRight = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 6l6 6-6 6" />
  </svg>
)
const IconClock = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
  </svg>
)
const IconBookmark = ({ filled }: { filled: boolean }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </svg>
)
const IconFlag = ({ filled }: { filled: boolean }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" />
  </svg>
)
const IconAlertCircle = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" />
  </svg>
)
const IconGrid = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
)
const IconX = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
)
const IconSun = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
)
const IconMoon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
)
const IconCheck = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)
const IconZoomIn = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" />
  </svg>
)

// ─── Main Component ───────────────────────────────────────────────────────────

export default function InteractiveExam({ exam, questions, savedProgress }: InteractiveExamProps) {
  const router = useRouter()
  const supabase = createClient()

  // ── State
  const { theme } = useTheme()
  const [current, setCurrent] = useState(savedProgress?.current_question ?? 0)
  const [answers, setAnswers] = useState<Record<string, string>>(savedProgress?.answers_json ?? {})
  const [flagged, setFlagged] = useState<Record<string, boolean>>({})
  const [bookmarked, setBookmarked] = useState<Record<string, boolean>>({})
  const [navOpen, setNavOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportType, setReportType] = useState('')
  const [reportNote, setReportNote] = useState('')
  const [jumpOpen, setJumpOpen] = useState(false)
  const [jumpValue, setJumpValue] = useState('')
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [mode, setMode] = useState<'play' | 'result' | 'review'>('play')
  const [timeTaken, setTimeTaken] = useState(0)

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const totalSeconds = (exam.duration_minutes ?? 0) * 60
  const [secondsLeft, setSecondsLeft] = useState(
    savedProgress?.remaining_time ?? totalSeconds
  )
  const hasTimer = exam.timer_mode !== 'none' && totalSeconds > 0

  // ── CSS variables
  const isDark = theme === 'dark' || (typeof document !== 'undefined' && document.documentElement.classList.contains('dark'))
  const t = isDark ? DARK : LIGHT
  const cssVars = {
    '--bg': t.bg, '--bg-elev': t.bgElev, '--bg-soft': t.bgSoft,
    '--fg': t.fg, '--fg-muted': t.fgMuted, '--border': t.border,
    '--primary': t.primary, '--primary-soft': t.primarySoft,
    '--accent-green': t.accentGreen, '--accent-blue': t.accentBlue,
    '--accent-purple': t.accentPurple, '--shadow': t.shadow,
  } as React.CSSProperties

  // ── Timer
  useEffect(() => {
    if (!hasTimer || mode !== 'play') return
    timerRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          if (exam.timer_mode === 'strict') {
            finishExam()
          }
          return 0
        }
        return prev - 1
      })
      setTimeTaken(prev => prev + 1)
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [mode, hasTimer])

  // ── Auto-save
  const saveProgress = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('study_progress').upsert({
      user_id: user.id,
      exam_id: exam.id,
      current_question: current,
      remaining_time: secondsLeft,
      answers_json: answers,
      flags_json: Object.keys(flagged).filter(k => flagged[k]),
      completed: false,
      updated_at: new Date().toISOString(),
    })
  }, [current, answers, flagged, secondsLeft, exam.id])

  useEffect(() => {
    const t = setTimeout(saveProgress, 5000)
    return () => clearTimeout(t)
  }, [saveProgress])

  // ── Actions
  const finishExam = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    setMode('result')
    setNavOpen(false)
  }, [])

  const selectAnswer = (qid: string, key: string) => {
    if (answers[qid]) return
    setAnswers(prev => ({ ...prev, [qid]: key }))
  }

  const goNext = () => {
    if (current >= questions.length - 1) { finishExam(); return }
    setCurrent(c => c + 1)
  }
  const goPrev = () => setCurrent(c => Math.max(0, c - 1))
  const goToQuestion = (i: number) => { setCurrent(i); setNavOpen(false) }

  const toggleFlag = () => {
    const id = questions[current]?.id
    if (!id) return
    setFlagged(prev => ({ ...prev, [id]: !prev[id] }))
  }
  const toggleBookmark = () => {
    const id = questions[current]?.id
    if (!id) return
    setBookmarked(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const submitJump = () => {
    const n = parseInt(jumpValue, 10)
    if (!isNaN(n) && n >= 1 && n <= questions.length) goToQuestion(n - 1)
    setJumpOpen(false)
    setJumpValue('')
  }

  // ── Derived
  const currentQ = questions[current]
  const selectedKey = currentQ ? answers[currentQ.id] : undefined
  const answered = !!selectedKey
  const answeredCount = Object.keys(answers).length
  const timerLow = hasTimer && secondsLeft < 60

  const doctorName = exam.exam_doctors?.[0]?.doctor?.name ?? null

  // ── Results computation
  const correctCount = questions.filter(q => answers[q.id] === q.correct_answer).length
  const wrongCount = questions.filter(q => answers[q.id] && answers[q.id] !== q.correct_answer).length
  const skippedCount = questions.length - Object.keys(answers).length
  const scorePercent = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0

  // Chapter stats
  const chapterMap: Record<string, { correct: number; total: number }> = {}
  questions.forEach(q => {
    const ch = q.chapter ?? 'General'
    if (!chapterMap[ch]) chapterMap[ch] = { correct: 0, total: 0 }
    chapterMap[ch].total++
    if (answers[q.id] === q.correct_answer) chapterMap[ch].correct++
  })
  const chapterStats = Object.entries(chapterMap).map(([chapter, v]) => ({
    chapter,
    label: `${v.correct}/${v.total}`,
    pct: Math.round((v.correct / v.total) * 100),
  }))

  // ── Gauge
  const radius = 54
  const circ = 2 * Math.PI * radius
  const gaugeOffset = circ - (scorePercent / 100) * circ
  const gaugeColor = scorePercent >= 80 ? t.accentGreen : scorePercent >= 50 ? t.accentBlue : t.primary

  const resultHeadline =
    scorePercent >= 90 ? 'Outstanding! 🎉' :
    scorePercent >= 75 ? 'Well done! 👏' :
    scorePercent >= 50 ? 'Good effort! 💪' : 'Keep going! 📚'

  // ── Shared style helpers
  const pill = (bg: string, color: string) =>
    `padding:4px 10px;border-radius:999px;background:${bg};color:${color};font-size:12px;font-weight:700;`

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER — PLAY MODE
  // ─────────────────────────────────────────────────────────────────────────────

  if (!currentQ && mode === 'play') return null

  return (
    <div
      style={{
        ...cssVars,
        minHeight: '100vh',
        background: 'var(--bg)',
        color: 'var(--fg)',
        fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
        transition: 'background 0.3s, color 0.3s',
      }}
    >
      {/* ── Global keyframes */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
        @keyframes examFadeIn { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:none } }
        @keyframes popIn      { from { opacity:0; transform:scale(.94) }       to { opacity:1; transform:none } }
        @keyframes noteSlide  { from { opacity:0; transform:translateY(-4px) } to { opacity:1; transform:none } }
        @keyframes ringPulse  { 0%,100% { opacity:1 } 50% { opacity:.55 } }
        @keyframes slideUp       { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:none } }
        @keyframes slideInPanel  { from { transform:translateX(100%) } to { transform:translateX(0) } }
        .choice-row:hover { transform: translateX(2px); }
        .icon-btn:hover   { opacity:.8; }
        .nav-chip:hover   { filter: brightness(1.08); }
      `}</style>

      {/* ── STICKY HEADER ───────────────────────────────────────────────────── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'var(--bg-elev)',
        borderBottom: '1px solid var(--border)',
        backdropFilter: 'blur(10px)',
      }}>
        <div style={{ width: '100%', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>

          {/* Back */}
          <button
            onClick={() => router.back()}
            className="icon-btn"
            style={{ width: 38, height: 38, flex: '0 0 auto', borderRadius: 11, border: '1px solid var(--border)', background: 'var(--bg-soft)', color: 'var(--fg)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            aria-label="Go back"
          >
            <IconChevronLeft />
          </button>

          {/* Exam info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {doctorName && (
              <div style={{ fontSize: 13, color: 'var(--fg-muted)', fontWeight: 600, letterSpacing: '0.2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {mode === 'play' ? 'Interactive Exam' : mode === 'review' ? 'Review Mode' : 'Results'} · {doctorName}
              </div>
            )}
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {exam.title}
            </div>
          </div>

          {/* Timer pill */}
          {hasTimer && mode === 'play' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 13px', borderRadius: 11,
              background: timerLow ? `color-mix(in srgb, var(--primary) 18%, var(--bg-soft))` : 'var(--bg-soft)',
              border: `1px solid ${timerLow ? 'var(--primary)' : 'var(--border)'}`,
              color: timerLow ? 'var(--primary)' : 'var(--fg)',
              fontWeight: 800, fontSize: 13.5,
              fontVariantNumeric: 'tabular-nums',
              animation: timerLow ? 'ringPulse 1s ease infinite' : 'none',
              flexShrink: 0,
            }}>
              <IconClock />
              {formatTime(secondsLeft)}
            </div>
          )}

          {/* Navigator toggle (play only) */}
          {mode === 'play' && (
            <button
              onClick={() => setNavOpen(true)}
              className="icon-btn"
              style={{ width: 38, height: 38, borderRadius: 11, border: '1px solid var(--border)', background: 'var(--bg-soft)', color: 'var(--fg)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative', flexShrink: 0 }}
              aria-label="Open question navigator"
            >
              <IconGrid />
              {answeredCount > 0 && (
                <span style={{ position: 'absolute', top: 5, right: 5, width: 7, height: 7, borderRadius: '50%', background: 'var(--accent-green)' }} />
              )}
            </button>
          )}

          {/* Theme toggle handled by global Navbar */}
        </div>

        {/* Progress bar */}
        {mode === 'play' && (
          <div style={{ height: 3, background: 'var(--border)' }}>
            <div style={{
              height: '100%',
              width: `${((current + (answered ? 1 : 0)) / questions.length) * 100}%`,
              background: 'linear-gradient(90deg, var(--primary), var(--accent-purple))',
              transition: 'width 0.4s ease',
            }} />
          </div>
        )}
      </header>

      {/* ── MAIN CONTENT ─────────────────────────────────────────────────────── */}
      <main style={{ width: '100%', padding: '24px 48px 80px' }}>

        {/* ════════════════════════════════════════════════════════════════════
            PLAY MODE
        ════════════════════════════════════════════════════════════════════ */}
        {mode === 'play' && currentQ && (
          <>
            {/* Question counter */}
            <div style={{ fontSize: 13.5, color: 'var(--fg-muted)', fontWeight: 700, marginBottom: 16 }}>
              Question {current + 1} of {questions.length} · {answeredCount} answered
            </div>

            {/* Question card */}
            <div style={{
              background: 'var(--bg-elev)', border: '1px solid var(--border)',
              borderRadius: 18, padding: 24, boxShadow: '0 1px 3px var(--shadow)',
              animation: 'examFadeIn .3s ease',
            }}>
              {/* Top row: index badge + chapter + lecture + bookmark + flag */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                <span style={{
                  width: 26, height: 26, borderRadius: 8,
                  background: 'var(--primary-soft)', color: 'var(--primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12.5, fontWeight: 800, flex: '0 0 auto',
                }}>
                  {current + 1}
                </span>

                {currentQ.chapter && (
                  <span style={{ padding: '4px 10px', borderRadius: 999, background: `color-mix(in srgb, var(--accent-blue) 15%, var(--bg-soft))`, color: 'var(--accent-blue)', fontSize: 12, fontWeight: 700 }}>
                    {currentQ.chapter}
                  </span>
                )}
                {currentQ.lecture && (
                  <span style={{ padding: '4px 10px', borderRadius: 999, background: 'var(--bg-soft)', color: 'var(--fg-muted)', fontSize: 12, fontWeight: 700 }}>
                    {currentQ.lecture}
                  </span>
                )}

                <span style={{ flex: 1 }} />

                {/* Bookmark */}
                <button
                  onClick={toggleBookmark}
                  className="icon-btn"
                  style={{
                    width: 34, height: 34, borderRadius: 10,
                    border: '1px solid var(--border)',
                    background: bookmarked[currentQ.id] ? 'var(--primary-soft)' : 'var(--bg-soft)',
                    color: bookmarked[currentQ.id] ? 'var(--primary)' : 'var(--fg-muted)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', flex: '0 0 auto', transition: 'background 0.2s, color 0.2s',
                  }}
                  aria-label="Bookmark question"
                >
                  <IconBookmark filled={!!bookmarked[currentQ.id]} />
                </button>

                {/* Flag */}
                <button
                  onClick={toggleFlag}
                  className="icon-btn"
                  style={{
                    width: 34, height: 34, borderRadius: 10,
                    border: '1px solid var(--border)',
                    background: flagged[currentQ.id] ? 'var(--primary-soft)' : 'var(--bg-soft)',
                    color: flagged[currentQ.id] ? 'var(--primary)' : 'var(--fg-muted)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', flex: '0 0 auto', transition: 'background 0.2s, color 0.2s',
                  }}
                  aria-label="Flag question"
                >
                  <IconFlag filled={!!flagged[currentQ.id]} />
                </button>
              </div>

              {/* Question text */}
              <p style={{ fontSize: 19, fontWeight: 700, color: 'var(--fg)', lineHeight: 1.6, letterSpacing: '-0.1px', marginBottom: 18 }}>
                {currentQ.question_text}
              </p>

              {/* Images */}
              {currentQ.question_images && currentQ.question_images.length > 0 && (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
                  {currentQ.question_images
                    .sort((a, b) => a.display_order - b.display_order)
                    .map(img => (
                      <div key={img.id} style={{ position: 'relative' }}>
                        <img
                          src={img.image_url}
                          alt={img.caption ?? 'Question image'}
                          loading="lazy"
                          style={{ maxWidth: '100%', maxHeight: 240, borderRadius: 12, border: '1px solid var(--border)', cursor: 'zoom-in', objectFit: 'contain' }}
                          onClick={() => setLightboxSrc(img.image_url)}
                        />
                        <button
                          onClick={() => setLightboxSrc(img.image_url)}
                          style={{ position: 'absolute', bottom: 8, right: 8, width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-elev)', color: 'var(--fg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                          aria-label="Zoom image"
                        >
                          <IconZoomIn />
                        </button>
                      </div>
                    ))}
                </div>
              )}

              {/* Choices */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {getChoices(currentQ).map(opt => {
                  const isCorrect = opt.key === currentQ.correct_answer
                  const isSelected = selectedKey === opt.key
                  const isWrongSelected = answered && isSelected && !isCorrect
                  const isCorrectReveal = answered && isCorrect

                  let bg = 'var(--bg-soft)'
                  let border = 'var(--border)'
                  let badgeBg = 'var(--bg-elev)'
                  let badgeColor = 'var(--fg-muted)'
                  let badgeContent: React.ReactNode = opt.key.toUpperCase()
                  let opacity = answered && !isCorrect && !isWrongSelected ? 0.55 : 1

                  if (isCorrectReveal) {
                    bg = `color-mix(in srgb, var(--accent-green) 16%, var(--bg-elev))`
                    border = 'var(--accent-green)'
                    badgeBg = 'var(--accent-green)'
                    badgeColor = 'white'
                    badgeContent = <IconCheck />
                    opacity = 1
                  } else if (isWrongSelected) {
                    bg = `color-mix(in srgb, var(--primary) 16%, var(--bg-elev))`
                    border = 'var(--primary)'
                    badgeBg = 'var(--primary)'
                    badgeColor = 'white'
                    badgeContent = '✗'
                    opacity = 1
                  }

                  return (
                    <div key={opt.key}>
                      <div
                        className="choice-row"
                        onClick={() => selectAnswer(currentQ.id, opt.key)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '14px 16px', borderRadius: 13,
                          border: `1.5px solid ${border}`, background: bg,
                          color: 'var(--fg)', cursor: answered ? 'default' : 'pointer',
                          opacity, transition: 'background 0.2s, border-color 0.2s, opacity 0.2s',
                        }}
                        role="button"
                        tabIndex={answered ? -1 : 0}
                        onKeyDown={e => e.key === 'Enter' && selectAnswer(currentQ.id, opt.key)}
                        aria-disabled={answered}
                      >
                        <span style={{
                          width: 26, height: 26, borderRadius: '50%',
                          background: badgeBg, color: badgeColor,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12.5, fontWeight: 800, flex: '0 0 auto',
                          border: `1px solid ${border}`, transition: 'background 0.2s, color 0.2s',
                        }}>
                          {badgeContent}
                        </span>
                        <span style={{ flex: '1 1 auto', fontSize: 15, fontWeight: 600 }}>
                          {opt.text}
                        </span>
                      </div>

                      {/* Incorrect explanation note */}
                      {answered && isWrongSelected && opt.explanation && (
                        <p style={{ margin: '6px 2px 0 42px', fontSize: 13, fontWeight: 600, color: 'var(--primary)', animation: 'noteSlide .25s ease' }}>
                          {opt.explanation}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Explanation box */}
              {answered && currentQ.explanation && (
                <div style={{
                  marginTop: 16, padding: '14px 16px', borderRadius: 13,
                  background: `color-mix(in srgb, var(--accent-green) 12%, var(--bg-elev))`,
                  border: '1px solid var(--accent-green)',
                  animation: 'examFadeIn .25s ease',
                }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--fg)', lineHeight: 1.6 }}>
                    <strong style={{ color: 'var(--accent-green)' }}>Explanation: </strong>
                    {currentQ.explanation}
                  </p>
                </div>
              )}

              {/* Community stats (if answered & stats exist) */}
              {answered && currentQ.question_statistics?.[0] && (() => {
                const st = currentQ.question_statistics[0]
                if (!st.attempts) return null
                const pct = Math.round((st.correct_answers / st.attempts) * 100)
                return (
                  <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ padding: '4px 10px', borderRadius: 999, background: 'var(--bg-soft)', color: 'var(--fg-muted)', fontSize: 12, fontWeight: 600 }}>
                      {pct}% answered correctly
                    </span>
                    {st.average_time > 0 && (
                      <span style={{ padding: '4px 10px', borderRadius: 999, background: 'var(--bg-soft)', color: 'var(--fg-muted)', fontSize: 12, fontWeight: 600 }}>
                        Avg {Math.round(st.average_time)}s
                      </span>
                    )}
                    <span style={{ padding: '4px 10px', borderRadius: 999, background: 'var(--bg-soft)', color: 'var(--fg-muted)', fontSize: 12, fontWeight: 600 }}>
                      {st.attempts.toLocaleString()} attempts
                    </span>
                  </div>
                )
              })()}
            </div>

            {/* ── Bottom action bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, gap: 12, flexWrap: 'wrap' }}>
              {/* Left: Report + Jump */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setReportOpen(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 16px', borderRadius: 12, border: '1px solid var(--primary)', background: `color-mix(in srgb, var(--primary) 12%, var(--bg-elev))`, color: 'var(--primary)', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  <IconAlertCircle /> Report Issue
                </button>
                <button
                  onClick={() => { setJumpOpen(true); setJumpValue(String(current + 1)) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-soft)', color: 'var(--fg)', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  <IconGrid /> Jump
                </button>
              </div>

              {/* Right: Prev + Next/Finish */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={goPrev}
                  disabled={current === 0}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '11px 18px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-elev)', color: 'var(--fg)', fontWeight: 700, fontSize: 14, cursor: current === 0 ? 'not-allowed' : 'pointer', opacity: current === 0 ? 0.5 : 1, fontFamily: 'inherit' }}
                >
                  <IconChevronLeft /> Prev
                </button>
                <button
                  onClick={goNext}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '11px 20px', borderRadius: 12, border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 14px color-mix(in srgb, var(--primary) 35%, transparent)', fontFamily: 'inherit' }}
                >
                  {current >= questions.length - 1 ? 'Finish' : 'Next'} <IconChevronRight />
                </button>
              </div>
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            RESULTS MODE
        ════════════════════════════════════════════════════════════════════ */}
        {mode === 'result' && (
          <div style={{ animation: 'popIn .35s ease' }}>
            {/* Score card */}
            <div style={{
              background: 'var(--bg-elev)', border: '1px solid var(--border)',
              borderRadius: 20, padding: '36px 30px', boxShadow: '0 1px 3px var(--shadow)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
              marginBottom: 20,
            }}>
              {/* Gauge */}
              <svg width="140" height="140" viewBox="0 0 140 140" style={{ marginBottom: 12 }}>
                <circle cx="70" cy="70" r={radius} fill="none" stroke={`color-mix(in srgb, var(--border) 80%, transparent)`} strokeWidth="10" />
                <circle
                  cx="70" cy="70" r={radius} fill="none"
                  stroke={gaugeColor} strokeWidth="10"
                  strokeDasharray={circ}
                  strokeDashoffset={gaugeOffset}
                  strokeLinecap="round"
                  transform="rotate(-90 70 70)"
                  style={{ transition: 'stroke-dashoffset .8s ease' }}
                />
                <text x="70" y="66" textAnchor="middle" style={{ fontSize: 26, fontWeight: 800, fill: 'currentColor' }}>{scorePercent}%</text>
                <text x="70" y="86" textAnchor="middle" style={{ fontSize: 12, fill: t.fgMuted }}>Score</text>
              </svg>

              <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800, color: 'var(--fg)' }}>{resultHeadline}</h2>
              <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--fg-muted)' }}>{exam.title}</p>

              {/* Stat tiles */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10, width: '100%', marginBottom: 24 }}>
                {[
                  { label: 'Correct', value: correctCount, color: 'var(--accent-green)' },
                  { label: 'Wrong', value: wrongCount, color: 'var(--primary)' },
                  { label: 'Skipped', value: skippedCount, color: 'var(--fg-muted)' },
                  { label: 'Time', value: formatTime(timeTaken), color: 'var(--accent-blue)' },
                ].map(s => (
                  <div key={s.label} style={{ padding: 14, borderRadius: 13, background: `color-mix(in srgb, ${s.color} 14%, var(--bg-soft))`, color: s.color }}>
                    <div style={{ fontSize: 22, fontWeight: 800 }}>{s.value}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.8, marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Chapter breakdown */}
              {chapterStats.length > 0 && (
                <div style={{ width: '100%', textAlign: 'left', borderTop: '1px solid var(--border)', paddingTop: 20, marginBottom: 20 }}>
                  <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 800, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>By Chapter</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {chapterStats.map(cs => (
                      <div key={cs.chapter}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                          <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--fg)' }}>{cs.chapter}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-muted)' }}>{cs.label}</span>
                        </div>
                        <div style={{ height: 6, borderRadius: 999, background: 'var(--bg-soft)', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 999,
                            width: `${cs.pct}%`,
                            background: cs.pct >= 70 ? 'var(--accent-green)' : cs.pct >= 40 ? 'var(--accent-blue)' : 'var(--primary)',
                            transition: 'width .5s ease',
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', width: '100%' }}>
                <button
                  onClick={() => { setMode('review'); setNavOpen(false) }}
                  style={{ flex: '1 1 160px', padding: 13, borderRadius: 12, border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Review Answers
                </button>
                <button
                  onClick={() => { setMode('play'); setCurrent(0); setAnswers({}); setFlagged({}); setSecondsLeft(totalSeconds); setTimeTaken(0) }}
                  style={{ flex: '1 1 160px', padding: 13, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-soft)', color: 'var(--fg)', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Retake
                </button>
                <button
                  onClick={() => router.back()}
                  style={{ flex: '1 1 160px', padding: 13, borderRadius: 12, border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg-muted)', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Exit
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            REVIEW MODE
        ════════════════════════════════════════════════════════════════════ */}
        {mode === 'review' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {questions.map((q, idx) => {
              const userAns = answers[q.id]
              const choices  = getChoices(q)
              return (
                <div key={q.id} style={{
                  background: 'var(--bg-elev)',
                  border: '1px solid var(--border)',
                  borderRadius: 18,
                  padding: 24,
                  boxShadow: '0 1px 3px var(--shadow)',
                }}>

                  {/* Header: number badge + chapter + lecture */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <span style={{
                      width: 26, height: 26, borderRadius: 8,
                      background: 'var(--primary-soft)', color: 'var(--primary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12.5, fontWeight: 800, flexShrink: 0,
                    }}>
                      {idx + 1}
                    </span>
                    {q.chapter && (
                      <span style={{
                        padding: '4px 10px', borderRadius: 999,
                        background: 'color-mix(in srgb, var(--accent-blue) 15%, var(--bg-soft))',
                        color: 'var(--accent-blue)', fontSize: 12, fontWeight: 700,
                      }}>
                        {q.chapter}
                      </span>
                    )}
                    {q.lecture && (
                      <span style={{
                        padding: '4px 10px', borderRadius: 999,
                        background: 'var(--bg-soft)',
                        color: 'var(--fg-muted)', fontSize: 12, fontWeight: 700,
                      }}>
                        {q.lecture}
                      </span>
                    )}
                  </div>

                  {/* Question text */}
                  <div style={{
                    fontSize: 17.5, fontWeight: 700, color: 'var(--fg)',
                    lineHeight: 1.6, letterSpacing: '-0.1px', marginBottom: 16,
                  }}>
                    {q.question_text}
                  </div>

                  {/* Images */}
                  {q.question_images?.length > 0 && (
                    <div style={{ marginBottom: 16, borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)' }}>
                      {q.question_images
                        .sort((a, b) => a.display_order - b.display_order)
                        .map(img => (
                          <img key={img.id} src={img.image_url} alt={img.caption ?? ''}
                            loading="lazy"
                            style={{ width: '100%', height: 220, objectFit: 'cover', display: 'block', cursor: 'zoom-in' }}
                            onClick={() => setLightboxSrc(img.image_url)}
                          />
                        ))}
                    </div>
                  )}

                  {/* Options */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {choices.map(opt => {
                      const isCorrectOpt = opt.key === q.correct_answer
                      const isUserOpt    = userAns === opt.key
                      const isWrong      = isUserOpt && !isCorrectOpt

                      const rowStyle: React.CSSProperties = isCorrectOpt ? {
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '14px 16px', borderRadius: 13,
                        border: '1.5px solid var(--accent-green)',
                        background: 'color-mix(in srgb, var(--accent-green) 16%, var(--bg-elev))',
                        color: 'var(--fg)', cursor: 'default', opacity: 1,
                        transition: 'background 0.2s, border-color 0.2s, opacity 0.2s',
                      } : isWrong ? {
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '14px 16px', borderRadius: 13,
                        border: '1.5px solid var(--primary)',
                        background: 'color-mix(in srgb, var(--primary) 16%, var(--bg-elev))',
                        color: 'var(--fg)', cursor: 'default', opacity: 1,
                        transition: 'background 0.2s, border-color 0.2s, opacity 0.2s',
                      } : {
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '14px 16px', borderRadius: 13,
                        border: '1.5px solid var(--border)',
                        background: 'var(--bg-soft)',
                        color: 'var(--fg)', cursor: 'default', opacity: 0.55,
                        transition: 'background 0.2s, border-color 0.2s, opacity 0.2s',
                      }

                      const badgeStyle: React.CSSProperties = isCorrectOpt ? {
                        width: 26, height: 26, borderRadius: '50%',
                        background: 'var(--accent-green)', color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12.5, fontWeight: 800, flexShrink: 0,
                        border: '1px solid var(--accent-green)',
                      } : isWrong ? {
                        width: 26, height: 26, borderRadius: '50%',
                        background: 'var(--primary)', color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12.5, fontWeight: 800, flexShrink: 0,
                        border: '1px solid var(--primary)',
                      } : {
                        width: 26, height: 26, borderRadius: '50%',
                        background: 'var(--bg-elev)', color: 'var(--fg-muted)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12.5, fontWeight: 800, flexShrink: 0,
                        border: '1px solid var(--border)',
                      }

                      return (
                        <div key={opt.key}>
                          <div style={rowStyle}>
                            <span style={badgeStyle}>
                              {isCorrectOpt ? '✓' : isWrong ? '✗' : opt.key.toUpperCase()}
                            </span>
                            <span style={{ flex: '1 1 auto', fontSize: 15, fontWeight: 600 }}>
                              {opt.text}
                            </span>
                          </div>
                          {opt.explanation && (isWrong || (!isCorrectOpt && !isUserOpt)) && (
                            <div style={{
                              margin: '6px 2px 0 42px',
                              fontSize: 13, fontWeight: 600,
                              color: 'var(--primary)',
                            }}>
                              {opt.explanation}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Explanation box */}
                  {q.explanation && (
                    <div style={{
                      marginTop: 16, padding: '14px 16px', borderRadius: 13,
                      background: 'color-mix(in srgb, var(--accent-green) 12%, var(--bg-elev))',
                      border: '1px solid var(--accent-green)',
                    }}>
                      <div style={{
                        fontSize: 11.5, fontWeight: 800,
                        letterSpacing: '0.5px', color: 'var(--accent-green)', marginBottom: 4,
                      }}>
                        EXPLANATION
                      </div>
                      <div style={{ fontSize: 14.5, color: 'var(--fg)', lineHeight: 1.55 }}>
                        {q.explanation}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* ── QUESTION NAVIGATOR DRAWER ──────────────────────────────────────── */}
      {navOpen && (
        <>
          <div onClick={() => setNavOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 60, animation: 'examFadeIn .2s ease' }} />
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0,
            width: 'min(340px, 88vw)',
            background: 'var(--bg-elev)', zIndex: 61,
            boxShadow: '-8px 0 30px var(--shadow)',
            animation: 'slideInPanel .25s ease',
            display: 'flex', flexDirection: 'column',
          }}>
            {/* Header */}
            <div style={{ padding: '20px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--fg)' }}>Questions</span>
              <button onClick={() => setNavOpen(false)}
                style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-soft)', color: 'var(--fg)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <IconX />
              </button>
            </div>

            {/* Grid + Legend */}
            <div style={{ padding: '18px 22px', overflowY: 'auto', flex: '1 1 auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
                {questions.map((q, i) => {
                  const isAnswered = !!answers[q.id]
                  const isCurrent = i === current
                  const isFlagged = !!flagged[q.id]
                  let border = '1.5px solid var(--border)'
                  let bg = 'var(--bg-soft)'
                  let color = 'var(--fg-muted)'
                  if (isCurrent) { border = '1.5px solid var(--primary)'; color = 'var(--primary)' }
                  else if (isAnswered) { bg = `color-mix(in srgb, var(--accent-green) 14%, var(--bg-elev))`; border = '1.5px solid var(--accent-green)'; color = 'var(--accent-green)' }
                  return (
                    <button key={q.id} onClick={() => goToQuestion(i)} style={{
                      position: 'relative', height: 42, borderRadius: 11,
                      border, background: bg, color, fontWeight: 800, fontSize: 14,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'inherit',
                    }}>
                      {i + 1}
                      {isFlagged && <span style={{ position: 'absolute', top: 4, right: 4, width: 7, height: 7, borderRadius: '50%', background: 'var(--primary)' }} />}
                    </button>
                  )
                })}
              </div>

              {/* Legend */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 22, fontSize: 12.5, color: 'var(--fg-muted)', fontWeight: 600 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent-green)', flexShrink: 0 }} />
                  Answered
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, border: '2px solid var(--primary)', flexShrink: 0 }} />
                  Current
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px solid var(--border)', flexShrink: 0 }} />
                  Unanswered
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ position: 'relative', width: 10, height: 10, flexShrink: 0 }}>
                    <span style={{ position: 'absolute', top: 0, right: 0, width: 7, height: 7, borderRadius: '50%', background: 'var(--primary)' }} />
                  </span>
                  Flagged
                </div>
              </div>
            </div>

            {/* Finish button */}
            <div style={{ padding: '18px 22px', borderTop: '1px solid var(--border)' }}>
              <button onClick={finishExam} style={{ width: '100%', padding: 13, borderRadius: 12, border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 800, fontSize: 14.5, cursor: 'pointer', fontFamily: 'inherit' }}>
                Finish Exam
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── REPORT MODAL ─────────────────────────────────────────────────────── */}
      {reportOpen && (
        <>
          <div onClick={() => setReportOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, animation: 'examFadeIn .2s ease' }}>
            <div onClick={e => e.stopPropagation()} style={{ width: 'min(420px, 100%)', background: 'var(--bg-elev)', borderRadius: 18, border: '1px solid var(--border)', boxShadow: '0 20px 60px var(--shadow)', padding: 24, animation: 'popIn .2s ease' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--fg)' }}>Report an Issue</span>
                <button onClick={() => setReportOpen(false)} style={{ width: 30, height: 30, borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-soft)', color: 'var(--fg)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <IconX />
                </button>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-muted)', marginBottom: 6 }}>Issue Type</div>
              <select
                value={reportType}
                onChange={e => setReportType(e.target.value)}
                style={{ width: '100%', padding: '11px 12px', borderRadius: 11, border: '1px solid var(--border)', background: 'var(--bg-soft)', color: 'var(--fg)', fontSize: 14, fontFamily: 'inherit', marginBottom: 16, outline: 'none' }}
              >
                <option value="">Select issue type</option>
                <option value="wrong_answer">Wrong Answer</option>
                <option value="typo">Typo or Spelling Error</option>
                <option value="wrong_explanation">Wrong Explanation</option>
                <option value="missing_image">Missing Image</option>
                <option value="wrong_chapter">Wrong Chapter</option>
                <option value="duplicate">Duplicate Question</option>
                <option value="other">Other</option>
              </select>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-muted)', marginBottom: 6 }}>Description (Optional)</div>
              <textarea
                placeholder="Describe the issue..."
                value={reportNote}
                onChange={e => setReportNote(e.target.value)}
                style={{ width: '100%', minHeight: 84, padding: '11px 12px', borderRadius: 11, border: '1px solid var(--border)', background: 'var(--bg-soft)', color: 'var(--fg)', fontSize: 14, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', marginBottom: 18, outline: 'none' }}
              />
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => { setReportOpen(false); setReportType(''); setReportNote('') }}
                  style={{ padding: '10px 18px', borderRadius: 11, border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg)', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!reportType) return
                    await supabase.from('reports').insert({ question_id: currentQ?.id, category: reportType, note: reportNote })
                    setReportOpen(false)
                    setReportType('')
                    setReportNote('')
                  }}
                  disabled={!reportType}
                  style={{ padding: '10px 18px', borderRadius: 11, border: 'none', background: reportType ? 'var(--primary)' : 'var(--bg-soft)', color: reportType ? 'white' : 'var(--fg-muted)', fontWeight: 700, fontSize: 14, cursor: reportType ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}
                >
                  Submit Report
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── JUMP TO QUESTION MODAL ───────────────────────────────────────────── */}
      {jumpOpen && (
        <>
          <div onClick={() => setJumpOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, animation: 'examFadeIn .2s ease' }}>
            <div onClick={e => e.stopPropagation()} style={{ width: 'min(640px, 100%)', maxHeight: '80vh', overflowY: 'auto', background: 'var(--bg-elev)', borderRadius: 18, border: '1px solid var(--border)', boxShadow: '0 20px 60px var(--shadow)', padding: '22px 24px', animation: 'popIn .2s ease' }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--fg)' }}>Jump to Question</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--fg-muted)', fontWeight: 600 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="var(--primary)" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 3v18M5 4h11l-2 4 2 4H5" /></svg>
                  <span>= Flagged</span>
                  <span style={{ margin: '0 2px' }}>•</span>
                  <svg width="13" height="13" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="4" fill="var(--accent-green)" /><path d="M7 12l3 3 7-7" stroke="white" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  <span>= Answered</span>
                </div>
              </div>
              {/* Question grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(46px, 1fr))', gap: 10, padding: 4 }}>
                {questions.map((q, i) => {
                  const isAnswered = !!answers[q.id]
                  const isCurrent = i === current
                  const isFlagged = !!flagged[q.id]
                  let bg = 'var(--bg-soft)', border = '1.5px solid var(--border)', color = 'var(--fg)', shadow = ''
                  if (isCurrent) { bg = 'var(--primary)'; border = 'none'; color = 'white'; shadow = '0 4px 12px color-mix(in srgb, var(--primary) 45%, transparent)' }
                  else if (isAnswered) { bg = `color-mix(in srgb, var(--accent-green) 14%, var(--bg-elev))`; border = '1.5px solid var(--accent-green)'; color = 'var(--accent-green)' }
                  return (
                    <button key={q.id} onClick={() => { goToQuestion(i); setJumpOpen(false) }} style={{ position: 'relative', width: 46, height: 46, borderRadius: 12, border, background: bg, color, fontWeight: isCurrent ? 800 : 700, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: shadow, fontFamily: 'inherit' }}>
                      {i + 1}
                      {isFlagged && <span style={{ position: 'absolute', top: -4, right: -4, width: 12, height: 12, borderRadius: '50%', background: 'var(--primary)', border: '2px solid var(--bg-elev)' }} />}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── IMAGE LIGHTBOX ───────────────────────────────────────────────────── */}
      {lightboxSrc && (
        <>
          <div onClick={() => setLightboxSrc(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'examFadeIn .2s ease', cursor: 'zoom-out' }}>
            <img
              src={lightboxSrc}
              alt="Fullscreen view"
              style={{ maxWidth: '92vw', maxHeight: '88vh', borderRadius: 12, objectFit: 'contain', boxShadow: '0 8px 60px rgba(0,0,0,.6)' }}
              onClick={e => e.stopPropagation()}
            />
            <button
              onClick={() => setLightboxSrc(null)}
              style={{ position: 'fixed', top: 16, right: 16, width: 40, height: 40, borderRadius: 10, border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.1)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <IconX />
            </button>
          </div>
        </>
      )}
    </div>
  )
}

