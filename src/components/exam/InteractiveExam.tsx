'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ── Types ──────────────────────────────────────────────────────────────────────
interface QuestionImage { image_url: string; display_order: number }
interface QuestionStatistic { attempts: number; correct_answers: number }

interface Question {
  id: string
  question_text: string
  choice_a: string
  choice_b: string
  choice_c: string | null
  choice_d: string | null
  choice_e: string | null
  correct_answer: string
  explanation: string | null
  incorrect_explanation_a: string | null
  incorrect_explanation_b: string | null
  incorrect_explanation_c: string | null
  incorrect_explanation_d: string | null
  incorrect_explanation_e: string | null
  chapter: string | null
  lecture: string | null
  question_order: number
  question_images?: QuestionImage[]
  question_statistics?: QuestionStatistic[]
}

interface Exam {
  id: string
  title: string
  question_count: number
  duration_minutes: number | null
  timer_mode: 'none' | 'suggested' | 'strict'
}

interface SavedProgress {
  current_question: number
  answers_json: Record<string, string>
  remaining_time: number | null
}

interface Props {
  exam: Exam
  questions: Question[]
  savedProgress: SavedProgress | null
}

// ── Theme tokens ───────────────────────────────────────────────────────────────
const LIGHT: Record<string, string> = {
  bg: 'oklch(98% 0.006 55)',
  'bg-elev': 'oklch(100% 0 0)',
  'bg-soft': 'oklch(96% 0.009 55)',
  fg: 'oklch(22% 0.02 50)',
  'fg-muted': 'oklch(46% 0.02 50)',
  border: 'oklch(89% 0.012 50)',
  primary: 'oklch(50% 0.19 25)',
  'primary-soft': 'oklch(94% 0.035 25)',
  'accent-green': 'oklch(60% 0.14 145)',
  'accent-blue': 'oklch(58% 0.13 250)',
  'accent-purple': 'oklch(56% 0.14 300)',
  shadow: 'rgba(20,10,10,.08)',
}
const DARK: Record<string, string> = {
  bg: 'oklch(19% 0.014 260)',
  'bg-elev': 'oklch(24% 0.016 260)',
  'bg-soft': 'oklch(22% 0.016 260)',
  fg: 'oklch(92% 0.008 260)',
  'fg-muted': 'oklch(66% 0.018 260)',
  border: 'oklch(33% 0.02 260)',
  primary: 'oklch(66% 0.17 25)',
  'primary-soft': 'oklch(30% 0.06 25)',
  'accent-green': 'oklch(68% 0.13 145)',
  'accent-blue': 'oklch(68% 0.12 250)',
  'accent-purple': 'oklch(68% 0.13 300)',
  shadow: 'rgba(0,0,0,.4)',
}

type Mode = 'play' | 'result' | 'review'

// ── Helpers ────────────────────────────────────────────────────────────────────
function buildOptions(q: Question, selectedKey: string | null, interactive: boolean) {
  const choices = [
    { key: 'a', text: q.choice_a, note: q.incorrect_explanation_a },
    { key: 'b', text: q.choice_b, note: q.incorrect_explanation_b },
    { key: 'c', text: q.choice_c, note: q.incorrect_explanation_c },
    { key: 'd', text: q.choice_d, note: q.incorrect_explanation_d },
    { key: 'e', text: q.choice_e, note: q.incorrect_explanation_e },
  ].filter(o => !!o.text)

  const answered = !!selectedKey
  return choices.map(opt => {
    const isCorrect = opt.key === q.correct_answer
    const isWrongSelected = answered && opt.key === selectedKey && !isCorrect
    let bg = 'var(--bg-soft)', border = 'var(--border)', badgeBg = 'var(--bg-elev)', badgeColor = 'var(--fg-muted)', badgeContent = opt.key.toUpperCase(), opacity = 1
    if (answered && isCorrect) {
      bg = 'color-mix(in srgb, var(--accent-green) 16%, var(--bg-elev))'; border = 'var(--accent-green)'; badgeBg = 'var(--accent-green)'; badgeColor = 'white'; badgeContent = '✓'
    } else if (isWrongSelected) {
      bg = 'color-mix(in srgb, var(--primary) 16%, var(--bg-elev))'; border = 'var(--primary)'; badgeBg = 'var(--primary)'; badgeColor = 'white'; badgeContent = '✗'
    } else if (answered) { opacity = 0.55 }
    return {
      key: opt.key, text: opt.text as string,
      note: opt.note, isCorrect, isWrongSelected,
      rowStyle: {
        display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 13,
        border: `1.5px solid ${border}`, background: bg, color: 'var(--fg)',
        cursor: interactive && !answered ? 'pointer' : 'default',
        opacity, transition: 'background .2s ease,border-color .2s ease,opacity .2s ease',
      } as React.CSSProperties,
      badgeStyle: {
        width: 26, height: 26, borderRadius: '50%', background: badgeBg, color: badgeColor,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12.5, fontWeight: 800, flex: '0 0 auto', border: `1px solid ${border}`,
      } as React.CSSProperties,
      badgeContent,
    }
  })
}

// ── SVG Icons ──────────────────────────────────────────────────────────────────
const ChevronLeft = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
const ChevronRight = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
const BackArrow = () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
const ClockIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>
const GridIcon = () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
const MoonIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z" /></svg>
const SunIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></svg>
const ReportIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>
const BookmarkIcon = ({ fill }: { fill: string }) => <svg width="16" height="16" viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12v18l-6-4-6 4V3z" /></svg>
const FlagIcon = ({ fill }: { fill: string }) => <svg width="16" height="16" viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 3v18M5 4h11l-2 4 2 4H5" /></svg>
const XIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>

// ── Main Component ─────────────────────────────────────────────────────────────
export default function InteractiveExam({ exam, questions, savedProgress }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const autoSaveRef = useRef<NodeJS.Timeout | null>(null)

  const [isDark, setIsDark] = useState(false)
  const [mode, setMode] = useState<Mode>('play')
  const [current, setCurrent] = useState(savedProgress?.current_question ?? 0)
  const [answers, setAnswers] = useState<Record<string, string>>(savedProgress?.answers_json ?? {})
  const [flagged, setFlagged] = useState<Record<string, boolean>>({})
  const [bookmarked, setBookmarked] = useState<Record<string, boolean>>({})
  const [navOpen, setNavOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportType, setReportType] = useState('')
  const [reportDescription, setReportDescription] = useState('')
  const [jumpOpen, setJumpOpen] = useState(false)
  const [jumpValue, setJumpValue] = useState('')
  const [secondsLeft, setSecondsLeft] = useState<number>(
    savedProgress?.remaining_time ?? (exam.duration_minutes ? exam.duration_minutes * 60 : 0)
  )
  const [timeTaken, setTimeTaken] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const theme = isDark ? DARK : LIGHT
  const rootStyle = Object.entries(theme).map(([k, v]) => `--${k}:${v}`).join(';')

  // Sync dark mode with document
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'))
    })
    setIsDark(document.documentElement.classList.contains('dark'))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  // Timer
  useEffect(() => {
    if (exam.timer_mode === 'none' || exam.duration_minutes === null || mode !== 'play') return
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          clearInterval(timerRef.current!)
          if (exam.timer_mode === 'strict') finishExam()
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [mode, exam.timer_mode, exam.duration_minutes])

  // Auto-save every 30s
  const doAutoSave = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('study_progress').upsert({
      user_id: user.id, exam_id: exam.id, current_question: current,
      answers_json: answers, remaining_time: secondsLeft, completed: false,
    }, { onConflict: 'user_id,exam_id' })
  }, [current, answers, secondsLeft, exam.id])

  useEffect(() => {
    autoSaveRef.current = setInterval(doAutoSave, 30000)
    return () => { if (autoSaveRef.current) clearInterval(autoSaveRef.current) }
  }, [doAutoSave])

  function finishExam() {
    if (timerRef.current) clearInterval(timerRef.current)
    const total = exam.duration_minutes ? exam.duration_minutes * 60 : 0
    setTimeTaken(total - secondsLeft)
    setMode('result')
    setNavOpen(false)
  }

  function selectAnswer(qid: string, key: string) {
    setAnswers(prev => prev[qid] ? prev : { ...prev, [qid]: key })
  }

  function goNext() {
    if (current >= questions.length - 1) { finishExam(); return }
    setCurrent(c => c + 1)
  }

  function goPrev() { setCurrent(c => Math.max(0, c - 1)) }
  function goToQuestion(i: number) { setCurrent(i); setNavOpen(false) }

  function submitJump() {
    const n = parseInt(jumpValue, 10)
    if (n >= 1 && n <= questions.length) { setCurrent(n - 1); setJumpOpen(false); setJumpValue('') }
    else { setJumpOpen(false); setJumpValue('') }
  }

  // ── Computed ─────────────────────────────────────────────────────────────────
  const currentQ = questions[current]
  const selectedKey = answers[currentQ?.id] ?? null
  const answeredCount = Object.keys(answers).length
  const mm = Math.floor(secondsLeft / 60)
  const ss = secondsLeft % 60
  const timerLabel = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
  const timerLow = secondsLeft <= 30 && exam.timer_mode !== 'none'
  const showTimer = exam.timer_mode !== 'none' && exam.duration_minutes !== null
  const progressPct = ((current + (selectedKey ? 1 : 0)) / questions.length) * 100

  let correctCount = 0
  questions.forEach(q => { if (answers[q.id] === q.correct_answer) correctCount++ })
  const wrongCount = answeredCount - correctCount
  const skippedCount = questions.length - answeredCount
  const scorePercent = Math.round((correctCount / questions.length) * 100)
  const timeTakenLabel = `${Math.floor(timeTaken / 60)}:${String(timeTaken % 60).padStart(2, '0')}`
  const gaugeColor = scorePercent >= 80 ? 'var(--accent-green)' : scorePercent >= 50 ? 'var(--accent-blue)' : 'var(--primary)'
  const resultHeadline = scorePercent >= 80 ? 'Excellent Work!' : scorePercent >= 50 ? 'Good Effort!' : 'Keep Practicing!'
  const circ = 2 * Math.PI * 78
  const gaugeOffset = circ * (1 - scorePercent / 100)

  const byChapter: Record<string, { correct: number; total: number }> = {}
  questions.forEach(q => {
    const ch = q.chapter ?? 'Other'
    byChapter[ch] = byChapter[ch] || { correct: 0, total: 0 }
    byChapter[ch].total++
    if (answers[q.id] === q.correct_answer) byChapter[ch].correct++
  })
  const chapterStats = Object.entries(byChapter).map(([chapter, v]) => {
    const pct = Math.round((v.correct / v.total) * 100)
    return { chapter, label: `${v.correct}/${v.total}`, pct }
  })

  // ── Shared styles ─────────────────────────────────────────────────────────────
  const s = {
    headerBtn: { width: 38, height: 38, flexShrink: 0, borderRadius: 11, border: '1px solid var(--border)', background: 'var(--bg-soft)', color: 'var(--fg)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' } as React.CSSProperties,
  }

  // ── Header ────────────────────────────────────────────────────────────────────
  const eyebrow = mode === 'play' ? 'Interactive Exam' : mode === 'review' ? 'Review Mode' : 'Results'
  const Header = (
    <header style={{ position: 'sticky', top: 0, zIndex: 40, background: 'var(--bg-elev)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(10px)' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <button style={s.headerBtn} onClick={() => router.back()}><BackArrow /></button>
        <div style={{ minWidth: 0, flex: '1 1 auto' }}>
          <div style={{ fontSize: 13, color: 'var(--fg-muted)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{eyebrow}</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{exam.title}</div>
        </div>
        {mode === 'play' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {showTimer && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 13px', borderRadius: 11, background: timerLow ? 'color-mix(in srgb, var(--primary) 18%, var(--bg-soft))' : 'var(--bg-soft)', border: `1px solid ${timerLow ? 'var(--primary)' : 'var(--border)'}`, color: timerLow ? 'var(--primary)' : 'var(--fg)', fontWeight: 800, fontSize: 13.5, fontVariantNumeric: 'tabular-nums' }}>
                <ClockIcon /><span>{timerLabel}</span>
              </div>
            )}
            <button style={s.headerBtn} onClick={() => setNavOpen(true)}><GridIcon /></button>
          </div>
        )}
        
      </div>
      {mode === 'play' && (
        <div style={{ height: 3, background: 'var(--border)' }}>
          <div style={{ height: '100%', width: `${progressPct}%`, background: 'linear-gradient(90deg, var(--primary), var(--accent-purple))', transition: 'width .4s ease' }} />
        </div>
      )}
    </header>
  )

  // ── Play Mode ─────────────────────────────────────────────────────────────────
  if (mode === 'play' && currentQ) {
    const opts = buildOptions(currentQ, selectedKey, true)
    const imgUrl = currentQ.question_images?.[0]?.image_url

    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--fg)', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" } as React.CSSProperties}>
        <style>{`
          @keyframes examFadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
          @keyframes noteSlide{from{opacity:0;max-height:0}to{opacity:1;max-height:120px}}
          @keyframes ringPulse{0%,100%{opacity:1}50%{opacity:.55}}
          @keyframes slideInPanel{from{transform:translateX(100%)}to{transform:translateX(0)}}
          @keyframes fadeDim{from{opacity:0}to{opacity:1}}
          @keyframes modalPop{from{opacity:0;transform:translateY(8px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
          * { box-sizing: border-box; }
          button { font-family: inherit; }
          :root { ${rootStyle} }
        `}</style>
        {Header}
        <main className="exam-main" style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 24px 80px' }}>
          {/* Counter */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={{ fontSize: 13.5, color: 'var(--fg-muted)', fontWeight: 700 }}>
              Question {current + 1} of {questions.length} · {answeredCount} answered
            </div>
          </div>

          {/* Question Card */}
          <div className="exam-card" style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 18, padding: 24, boxShadow: '0 1px 3px var(--shadow)', animation: 'examFadeIn .3s ease' }}>
            {/* Meta row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <span style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--primary-soft)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 800, flexShrink: 0 }}>{current + 1}</span>
              {currentQ.chapter && <span style={{ padding: '4px 10px', borderRadius: 999, background: 'color-mix(in srgb, var(--accent-blue) 15%, var(--bg-soft))', color: 'var(--accent-blue)', fontSize: 12, fontWeight: 700 }}>{currentQ.chapter}</span>}
              {currentQ.lecture && <span style={{ padding: '4px 10px', borderRadius: 999, background: 'var(--bg-soft)', color: 'var(--fg-muted)', fontSize: 12, fontWeight: 700 }}>{currentQ.lecture}</span>}
              <div style={{ flex: '1 1 auto' }} />
              <button style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid var(--border)', background: bookmarked[currentQ.id] ? 'var(--primary-soft)' : 'var(--bg-soft)', color: bookmarked[currentQ.id] ? 'var(--primary)' : 'var(--fg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                onClick={() => setBookmarked(b => ({ ...b, [currentQ.id]: !b[currentQ.id] }))}>
                <BookmarkIcon fill={bookmarked[currentQ.id] ? 'currentColor' : 'none'} />
              </button>
              <button style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid var(--border)', background: flagged[currentQ.id] ? 'var(--primary-soft)' : 'var(--bg-soft)', color: flagged[currentQ.id] ? 'var(--primary)' : 'var(--fg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                onClick={() => setFlagged(f => ({ ...f, [currentQ.id]: !f[currentQ.id] }))}>
                <FlagIcon fill={flagged[currentQ.id] ? 'currentColor' : 'none'} />
              </button>
            </div>

            {/* Question text */}
            <div className="exam-q-text" style={{ fontSize: 19, fontWeight: 700, color: 'var(--fg)', lineHeight: 1.6, letterSpacing: -0.1, marginBottom: 18 }}>{currentQ.question_text}</div>

            {/* Image */}
            {imgUrl && <div style={{ marginBottom: 16, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}><img src={imgUrl} alt="Question" style={{ width: '100%', maxHeight: 360, objectFit: 'contain', display: 'block' }} /></div>}

            {/* Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {opts.map(opt => (
                <div key={opt.key}>
                  <div style={opt.rowStyle} onClick={() => selectAnswer(currentQ.id, opt.key)}>
                    <span style={opt.badgeStyle}>{opt.badgeContent}</span>
                    <span style={{ flex: '1 1 auto', fontSize: 15, fontWeight: 600 }}>{opt.text}</span>
                  </div>
                  {selectedKey && opt.isWrongSelected && opt.note && (
                    <div style={{ margin: '6px 2px 0 42px', fontSize: 13, fontWeight: 600, color: 'var(--primary)', animation: 'noteSlide .25s ease' }}>{opt.note}</div>
                  )}
                </div>
              ))}
            </div>

            {/* Explanation */}
            {selectedKey && currentQ.explanation && (
              <div style={{ marginTop: 16, padding: '14px 16px', borderRadius: 13, background: 'color-mix(in srgb, var(--accent-green) 12%, var(--bg-elev))', border: '1px solid var(--accent-green)', animation: 'examFadeIn .25s ease' }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.5px', color: 'var(--accent-green)', marginBottom: 6, textTransform: 'uppercase' }}>Explanation</div>
                <div style={{ fontSize: 14.5, color: 'var(--fg)', lineHeight: 1.6 }}>{currentQ.explanation}</div>
              </div>
            )}
          </div>

          {/* Action bar */}
          <div className="exam-actions" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 16px', borderRadius: 12, border: '1px solid var(--primary)', background: 'color-mix(in srgb, var(--primary) 12%, var(--bg-elev))', color: 'var(--primary)', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}
                onClick={() => setReportOpen(true)}>
                <ReportIcon />Report Issue
              </button>
              <button style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-soft)', color: 'var(--fg)', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}
                onClick={() => { setJumpOpen(true); setJumpValue(String(current + 1)) }}>
                <GridIcon />Jump
              </button>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '11px 18px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-elev)', color: 'var(--fg)', fontWeight: 700, fontSize: 14, cursor: current === 0 ? 'not-allowed' : 'pointer', opacity: current === 0 ? 0.5 : 1 }}
                onClick={goPrev} disabled={current === 0}>
                <ChevronLeft />Prev
              </button>
              <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '11px 20px', borderRadius: 12, border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 14px color-mix(in srgb, var(--primary) 35%, transparent)' }}
                onClick={goNext}>
                {current >= questions.length - 1 ? 'Finish' : 'Next'}<ChevronRight />
              </button>
            </div>
          </div>
        </main>

        {/* Nav Drawer */}
        {navOpen && (
          <>
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 60, animation: 'fadeDim .2s ease' }} onClick={() => setNavOpen(false)} />
            <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(340px, 88vw)', background: 'var(--bg-elev)', zIndex: 61, boxShadow: '-8px 0 30px var(--shadow)', animation: 'slideInPanel .25s ease', display: 'flex', flexDirection: 'column' }}>
              {/* Header */}
              <div style={{ padding: '20px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--fg)' }}>Questions</div>
                <button style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-soft)', color: 'var(--fg)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} onClick={() => setNavOpen(false)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              </div>
              {/* Grid */}
              <div style={{ padding: '18px 22px', overflowY: 'auto', flex: '1 1 auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
                  {questions.map((q, i) => {
                    const ans = answers[q.id]
                    const isCurrent = i === current
                    let bg = 'var(--bg-soft)', border = 'var(--border)', color = 'var(--fg-muted)'
                    if (ans) { bg = 'color-mix(in srgb, var(--accent-green) 18%, var(--bg-elev))'; border = 'var(--accent-green)'; color = 'var(--accent-green)' }
                    if (isCurrent) { border = 'var(--primary)'; color = 'var(--primary)' }
                    return (
                      <button key={q.id} onClick={() => goToQuestion(i)}
                        style={{ position: 'relative', height: 42, borderRadius: 11, border: `1.5px solid ${border}`, background: bg, color, fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {i + 1}
                        {flagged[q.id] && <span style={{ position: 'absolute', top: 4, right: 4, width: 7, height: 7, borderRadius: '50%', background: 'var(--primary)' }} />}
                      </button>
                    )
                  })}
                </div>
                {/* Legend */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 22, fontSize: 12.5, color: 'var(--fg-muted)', fontWeight: 600 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent-green)', display: 'inline-block', flexShrink: 0 }} />Answered</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 10, height: 10, borderRadius: 3, border: '2px solid var(--primary)', display: 'inline-block', flexShrink: 0 }} />Current</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid var(--fg-muted)', background: 'var(--bg-soft)', display: 'inline-block', flexShrink: 0 }} />Unanswered</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ position: 'relative', width: 10, height: 10, display: 'inline-block', flexShrink: 0 }}>
                      <span style={{ position: 'absolute', top: 0, right: 0, width: 10, height: 10, borderRadius: '50%', background: 'var(--primary)', display: 'inline-block' }} />
                    </span>
                    Flagged
                  </div>
                </div>
              </div>
              {/* Footer */}
              <div style={{ padding: '18px 22px', borderTop: '1px solid var(--border)' }}>
                <button style={{ width: '100%', padding: 13, borderRadius: 12, border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 800, fontSize: 14.5, cursor: 'pointer' }} onClick={finishExam}>
                  Finish Exam
                </button>
              </div>
            </div>
          </>
        )}

        {/* Report Modal */}
        {reportOpen && (
          <>
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 200, animation: 'fadeDim .2s ease' }} onClick={() => { setReportOpen(false); setReportType(''); setReportDescription('') }} />
            <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(480px, 90vw)', background: 'var(--bg-elev)', borderRadius: 18, border: '1px solid var(--border)', padding: '22px 24px', zIndex: 201, animation: 'modalPop .2s ease' }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--fg)' }}>Report an Issue</div>
                <button style={{ width: 30, height: 30, borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-soft)', color: 'var(--fg)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  onClick={() => { setReportOpen(false); setReportType(''); setReportDescription('') }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              </div>
              {/* Issue Type */}
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-muted)', marginBottom: 6 }}>Issue Type</div>
              <select value={reportType} onChange={e => setReportType(e.target.value)}
                style={{ width: '100%', padding: '11px 12px', borderRadius: 11, border: '1px solid var(--border)', background: 'var(--bg-soft)', color: 'var(--fg)', fontSize: 14, fontFamily: 'inherit', marginBottom: 16, outline: 'none' }}>
                <option value="">Select issue type</option>
                <option value="wrong_answer">Wrong Answer</option>
                <option value="typo">Typo or Spelling Error</option>
                <option value="wrong_explanation">Wrong Explanation</option>
                <option value="missing_image">Missing Image</option>
                <option value="wrong_chapter">Wrong Chapter</option>
                <option value="duplicate">Duplicate Question</option>
                <option value="other">Other</option>
              </select>
              {/* Description */}
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-muted)', marginBottom: 6 }}>Description (Optional)</div>
              <textarea value={reportDescription} onChange={e => setReportDescription(e.target.value)}
                placeholder="Describe the issue..."
                style={{ width: '100%', minHeight: 84, padding: '11px 12px', borderRadius: 11, border: '1px solid var(--border)', background: 'var(--bg-soft)', color: 'var(--fg)', fontSize: 14, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', marginBottom: 18, outline: 'none' }} />
              {/* Actions */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button style={{ padding: '10px 18px', borderRadius: 11, border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg)', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}
                  onClick={() => { setReportOpen(false); setReportType(''); setReportDescription('') }}>
                  Cancel
                </button>
                <button style={{ padding: '10px 18px', borderRadius: 11, border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}
                  onClick={() => { setReportOpen(false); setReportType(''); setReportDescription('') }}>
                  Submit Report
                </button>
              </div>
            </div>
          </>
        )}

        {/* Jump Modal */}
        {jumpOpen && (
          <>
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, animation: 'fadeDim .2s ease' }} onClick={() => setJumpOpen(false)} />
            <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(640px, 90vw)', maxHeight: '80vh', overflowY: 'auto', background: 'var(--bg-elev)', borderRadius: 18, border: '1px solid var(--border)', boxShadow: '0 20px 60px var(--shadow)', padding: '22px 24px', zIndex: 200, animation: 'modalPop .2s ease' }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--fg)' }}>Jump to Question</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--fg-muted)', fontWeight: 600 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="var(--primary)" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 3v18M5 4h11l-2 4 2 4H5" /></svg>
                  <span>= Flagged</span>
                  <span style={{ margin: '0 2px' }}>•</span>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="var(--accent-green)" stroke="var(--accent-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="4" fill="var(--accent-green)" /><path d="M7 12l3 3 7-7" stroke="white" fill="none" /></svg>
                  <span>= Answered</span>
                </div>
              </div>
              {/* Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(46px, 1fr))', gap: 10, padding: 4 }}>
                {questions.map((q, i) => {
                  const ans = !!answers[q.id]
                  const isCurrent = i === current
                  let btnStyle: React.CSSProperties
                  if (isCurrent) {
                    btnStyle = { position: 'relative', width: 46, height: 46, borderRadius: 12, border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 800, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px color-mix(in srgb, var(--primary) 45%, transparent)' }
                  } else if (ans) {
                    btnStyle = { position: 'relative', width: 46, height: 46, borderRadius: 12, border: '1.5px solid var(--accent-green)', background: 'color-mix(in srgb, var(--accent-green) 14%, var(--bg-elev))', color: 'var(--accent-green)', fontWeight: 800, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
                  } else {
                    btnStyle = { position: 'relative', width: 46, height: 46, borderRadius: 12, border: '1.5px solid var(--border)', background: 'var(--bg-soft)', color: 'var(--fg)', fontWeight: 700, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
                  }
                  return (
                    <button key={q.id} style={btnStyle} onClick={() => { setCurrent(i); setJumpOpen(false) }}>
                      {i + 1}
                      {flagged[q.id] && <span style={{ position: 'absolute', top: -4, right: -4, width: 12, height: 12, borderRadius: '50%', background: 'var(--primary)', border: '2px solid var(--bg-elev)' }} />}
                    </button>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  // ── Result Mode ───────────────────────────────────────────────────────────────
  if (mode === 'result') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--fg)', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" }}>
        <style>{`@keyframes popIn{from{opacity:0;transform:scale(.85)}to{opacity:1;transform:scale(1)}} @keyframes examFadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}} * { box-sizing: border-box; } button { font-family: inherit; }`}</style>
        {Header}
        <main style={{ maxWidth: 1180, margin: '0 auto', padding: '40px 24px 80px' }}>

          {/* Score Card */}
          <div style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 20, padding: '36px 30px', boxShadow: '0 1px 3px var(--shadow)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', animation: 'popIn .35s ease', marginBottom: 24 }}>
            <svg width="180" height="180" viewBox="0 0 180 180">
              <circle cx="90" cy="90" r="78" fill="none" stroke="var(--border)" strokeWidth="12" />
              <circle cx="90" cy="90" r="78" fill="none" stroke={gaugeColor} strokeWidth="12" strokeLinecap="round"
                strokeDasharray={circ} strokeDashoffset={gaugeOffset} transform="rotate(-90 90 90)"
                style={{ transition: 'stroke-dashoffset .8s ease' }} />
              <text x="90" y="85" textAnchor="middle" fill="var(--fg)" fontSize="32" fontWeight="800" fontFamily="inherit">{scorePercent}%</text>
              <text x="90" y="108" textAnchor="middle" fill="var(--fg-muted)" fontSize="13" fontWeight="600" fontFamily="inherit">{resultHeadline}</text>
            </svg>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, width: '100%', marginTop: 8 }}>
              {[
                { label: 'Correct', value: correctCount, color: 'var(--accent-green)', bg: 'color-mix(in srgb, var(--accent-green) 14%, var(--bg-soft))' },
                { label: 'Wrong', value: wrongCount, color: 'var(--primary)', bg: 'color-mix(in srgb, var(--primary) 14%, var(--bg-soft))' },
                { label: 'Skipped', value: skippedCount, color: 'var(--fg-muted)', bg: 'var(--bg-soft)' },
                { label: 'Time', value: timeTakenLabel, color: 'var(--accent-blue)', bg: 'color-mix(in srgb, var(--accent-blue) 14%, var(--bg-soft))' },
              ].map(stat => (
                <div key={stat.label} style={{ padding: 14, borderRadius: 13, background: stat.bg, color: stat.color }}>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{stat.value}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4, opacity: 0.8 }}>{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Chapter breakdown */}
          {chapterStats.length > 0 && (
            <div style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 24px', marginBottom: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 14 }}>By Chapter</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {chapterStats.map(cs => (
                  <div key={cs.chapter}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                      <span>{cs.chapter}</span><span style={{ color: 'var(--fg-muted)' }}>{cs.label}</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 999, background: 'var(--bg-soft)' }}>
                      <div style={{ height: '100%', borderRadius: 999, width: `${cs.pct}%`, background: cs.pct >= 70 ? 'var(--accent-green)' : cs.pct >= 40 ? 'var(--accent-blue)' : 'var(--primary)', transition: 'width .5s ease' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button style={{ flex: '1 1 160px', padding: 13, borderRadius: 12, border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
              onClick={() => setMode('review')}>Review Answers</button>
            <button style={{ flex: '1 1 160px', padding: 13, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-soft)', color: 'var(--fg)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
              onClick={() => { setAnswers({}); setFlagged({}); setCurrent(0); setSecondsLeft(exam.duration_minutes ? exam.duration_minutes * 60 : 0); setMode('play') }}>Retake</button>
            <button style={{ flex: '1 1 160px', padding: 13, borderRadius: 12, border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg-muted)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
              onClick={() => router.back()}>Exit</button>
          </div>
        </main>
      </div>
    )
  }

  // ── Review Mode ───────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--fg)', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" }}>
      <style>{`@keyframes examFadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}} * { box-sizing: border-box; } button { font-family: inherit; }`}</style>
      {Header}
      <main style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 24px 80px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {questions.map((q, i) => {
          const opts = buildOptions(q, q.correct_answer, false)
          const imgUrl = q.question_images?.[0]?.image_url
          const stats = q.question_statistics?.[0]
          const correctPct = stats && stats.attempts > 0 ? Math.round((stats.correct_answers / stats.attempts) * 100) : null

          return (
            <div key={q.id} style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 18, padding: 24, boxShadow: '0 1px 3px var(--shadow)' }}>
              {/* Meta */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <span style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--primary-soft)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 800, flexShrink: 0 }}>{i + 1}</span>
                {q.chapter && <span style={{ padding: '4px 10px', borderRadius: 999, background: 'color-mix(in srgb, var(--accent-blue) 15%, var(--bg-soft))', color: 'var(--accent-blue)', fontSize: 12, fontWeight: 700 }}>{q.chapter}</span>}
                {q.lecture && <span style={{ padding: '4px 10px', borderRadius: 999, background: 'var(--bg-soft)', color: 'var(--fg-muted)', fontSize: 12, fontWeight: 700 }}>{q.lecture}</span>}
                {correctPct !== null && <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--fg-muted)', fontWeight: 600 }}>{correctPct}% correct</span>}
              </div>

              {/* Text */}
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--fg)', lineHeight: 1.6, marginBottom: 16 }}>{q.question_text}</div>

              {/* Image */}
              {imgUrl && <div style={{ marginBottom: 14, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}><img src={imgUrl} alt="Question" style={{ width: '100%', maxHeight: 300, objectFit: 'contain', display: 'block' }} /></div>}

              {/* Options */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {opts.map(opt => (
                  <div key={opt.key}>
                    <div style={opt.rowStyle}>
                      <span style={opt.badgeStyle}>{opt.badgeContent}</span>
                      <span style={{ flex: '1 1 auto', fontSize: 15, fontWeight: 600 }}>{opt.text}</span>
                    </div>
                    {opt.note && !opt.isCorrect && (
                      <div style={{ margin: '4px 2px 0 42px', fontSize: 12.5, fontWeight: 600, color: 'var(--fg-muted)' }}>{opt.note}</div>
                    )}
                  </div>
                ))}
              </div>

              {/* Explanation */}
              {q.explanation && (
                <div style={{ marginTop: 14, padding: '12px 16px', borderRadius: 13, background: 'color-mix(in srgb, var(--accent-green) 12%, var(--bg-elev))', border: '1px solid var(--accent-green)' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.5px', color: 'var(--accent-green)', marginBottom: 4, textTransform: 'uppercase' }}>Explanation</div>
                  <div style={{ fontSize: 14, color: 'var(--fg)', lineHeight: 1.6 }}>{q.explanation}</div>
                </div>
              )}
            </div>
          )
        })}

        <button style={{ padding: 14, borderRadius: 12, border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
          onClick={() => setMode('result')}>Back to Results</button>
      </main>
    </div>
  )
}