'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState, useRef, Suspense } from 'react'

const RADIUS = 78
const CIRC = 2 * Math.PI * RADIUS

function ResultsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const time         = parseInt(searchParams.get('time') || '0')
  const answersParam   = searchParams.get('answers')   || '{}'
  const questionsParam = searchParams.get('questions') || '[]'
  const examTitle    = decodeURIComponent(searchParams.get('title')  || 'Exam')
  const doctorName   = decodeURIComponent(searchParams.get('doctor') || '')

  const [answers, setAnswers]     = useState<Record<string, string>>({})
  const [questions, setQuestions] = useState<any[]>([])
  const [animated, setAnimated]   = useState(false)
  const animRef = useRef(false)

  useEffect(() => {
    try {
      setAnswers(JSON.parse(decodeURIComponent(answersParam)))
      setQuestions(JSON.parse(decodeURIComponent(questionsParam)))
    } catch {}
  }, [answersParam, questionsParam])

  useEffect(() => {
    if (questions.length > 0 && !animRef.current) {
      animRef.current = true
      const t = setTimeout(() => setAnimated(true), 120)
      return () => clearTimeout(t)
    }
  }, [questions])

  const totalQ   = questions.length
  const answered = Object.keys(answers).length
  const correct  = questions.filter(q => answers[q.id] === q.correct_answer).length
  const wrong    = questions.filter(q => answers[q.id] && answers[q.id] !== q.correct_answer).length
  const skipped  = totalQ - answered
  const scorePct = answered > 0 ? Math.round((correct / answered) * 100) : 0

  const gaugeOffset = animated ? CIRC - (scorePct / 100) * CIRC : CIRC
  const gaugeColor  =
    scorePct >= 80 ? 'var(--accent-green)' :
    scorePct >= 50 ? 'var(--accent-blue)'  :
    'var(--primary)'

  const headline =
    scorePct >= 80 ? '🎉 Excellent Work!' :
    scorePct >= 60 ? '👍 Good Job!'       :
    scorePct >= 40 ? '📚 Keep Going!'     :
    '💪 Keep Practicing!'

  function formatTime(s: number) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const chapterStats = questions.reduce(
    (acc: Record<string, { total: number; correct: number }>, q) => {
      if (!q.chapter) return acc
      if (!acc[q.chapter]) acc[q.chapter] = { total: 0, correct: 0 }
      acc[q.chapter].total++
      if (answers[q.id] === q.correct_answer) acc[q.chapter].correct++
      return acc
    }, {}
  )

  // ── Navigation ──────────────────────────────────────────────
  function handleReview() {
    const reviewPath = window.location.pathname.replace('/results', '/review')
    const params = new URLSearchParams({
      title:     searchParams.get('title')   || '',
      doctor:    searchParams.get('doctor')  || '',
      time:      searchParams.get('time')    || '0',
      answers:   answersParam,
      questions: questionsParam,
    })
    router.push(`${reviewPath}?${params.toString()}`)
  }

  function handleRetake() {
    router.push(window.location.pathname.replace('/results', ''))
  }

  function handleBack() {
    const parts = window.location.pathname.split('/')
    parts.pop()
    router.push(parts.join('/'))
  }

  return (
    <>
      <style>{`
        @keyframes popIn {
          from { opacity:0; transform:scale(.85); }
          to   { opacity:1; transform:scale(1);   }
        }
      `}</style>

      {/* Sticky header */}
      <header style={{
        position:'sticky', top:0, zIndex:40,
        background:'var(--bg-elev)',
        borderBottom:'1px solid var(--bd)',
        backdropFilter:'blur(10px)',
      }}>
        <div style={{
          maxWidth:1180, margin:'0 auto', padding:'14px 24px',
          display:'flex', alignItems:'center', gap:16,
        }}>
          <button onClick={handleBack} style={{
            width:38, height:38, flexShrink:0,
            borderRadius:11, border:'1px solid var(--bd)',
            background:'var(--bg-soft)', color:'var(--fg)',
            display:'flex', alignItems:'center', justifyContent:'center',
            cursor:'pointer',
          }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>

          <div style={{ minWidth:0, flex:'1 1 auto' }}>
            <div style={{
              fontSize:13, color:'var(--fg-muted)', fontWeight:600,
              letterSpacing:'0.2px', whiteSpace:'nowrap',
              overflow:'hidden', textOverflow:'ellipsis',
            }}>
              {doctorName ? `Results · ${doctorName}` : 'Results'}
            </div>
            <div style={{
              fontSize:17, fontWeight:800, color:'var(--fg)',
              whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
            }}>
              {examTitle}
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main style={{ maxWidth:900, margin:'0 auto', padding:'32px 24px 80px' }}>
        <div style={{
          background:'var(--bg-elev)',
          border:'1px solid var(--bd)',
          borderRadius:20,
          padding:'36px 30px',
          boxShadow:'0 1px 3px var(--shadow)',
          display:'flex', flexDirection:'column',
          alignItems:'center', textAlign:'center',
          animation:'popIn .35s ease',
        }}>

          {/* Gauge */}
          <div style={{ position:'relative', width:180, height:180, margin:'8px 0 4px' }}>
            <svg width="180" height="180" viewBox="0 0 180 180">
              <circle cx="90" cy="90" r={RADIUS}
                fill="none" stroke="var(--bd)" strokeWidth="14"/>
              <circle cx="90" cy="90" r={RADIUS}
                fill="none"
                stroke={gaugeColor}
                strokeWidth="14"
                strokeLinecap="round"
                transform="rotate(-90 90 90)"
                style={{
                  strokeDasharray: CIRC,
                  strokeDashoffset: gaugeOffset,
                  transition:'stroke-dashoffset 0.8s ease',
                }}
              />
            </svg>
            <div style={{
              position:'absolute', inset:0,
              display:'flex', flexDirection:'column',
              alignItems:'center', justifyContent:'center',
            }}>
              <div style={{ fontSize:34, fontWeight:800, color:'var(--fg)', lineHeight:1 }}>
                {scorePct}%
              </div>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--fg-muted)', marginTop:6 }}>
                Score
              </div>
            </div>
          </div>

          <div style={{ fontSize:21, fontWeight:800, color:'var(--fg)', marginTop:8 }}>
            {headline}
          </div>
          <div style={{ fontSize:14, color:'var(--fg-muted)', marginTop:4 }}>
            {examTitle}
          </div>

          {/* Stats */}
          <div style={{
            display:'grid',
            gridTemplateColumns:'repeat(auto-fit, minmax(110px, 1fr))',
            gap:12, width:'100%', margin:'26px 0 6px',
          }}>
            <div style={{ padding:14, borderRadius:13, background:'color-mix(in srgb, var(--accent-green) 14%, var(--bg-soft))', color:'var(--accent-green)' }}>
              <div style={{ fontSize:22, fontWeight:800 }}>{correct}</div>
              <div style={{ fontSize:12, fontWeight:600 }}>Correct</div>
            </div>
            <div style={{ padding:14, borderRadius:13, background:'color-mix(in srgb, var(--primary) 14%, var(--bg-soft))', color:'var(--primary)' }}>
              <div style={{ fontSize:22, fontWeight:800 }}>{wrong}</div>
              <div style={{ fontSize:12, fontWeight:600 }}>Wrong</div>
            </div>
            <div style={{ padding:14, borderRadius:13, background:'var(--bg-soft)', color:'var(--fg-muted)' }}>
              <div style={{ fontSize:22, fontWeight:800 }}>{skipped}</div>
              <div style={{ fontSize:12, fontWeight:600 }}>Skipped</div>
            </div>
            <div style={{ padding:14, borderRadius:13, background:'color-mix(in srgb, var(--accent-blue) 14%, var(--bg-soft))', color:'var(--accent-blue)' }}>
              <div style={{ fontSize:22, fontWeight:800 }}>{formatTime(time)}</div>
              <div style={{ fontSize:12, fontWeight:600 }}>Time Taken</div>
            </div>
          </div>

          {/* By chapter */}
          {Object.keys(chapterStats).length > 0 && (
            <div style={{ width:'100%', textAlign:'left', marginTop:10 }}>
              <div style={{ fontSize:13.5, fontWeight:700, color:'var(--fg)', marginBottom:10 }}>
                By chapter
              </div>
              {Object.entries(chapterStats).map(([ch, perf]) => {
                const pct = Math.round((perf.correct / perf.total) * 100)
                return (
                  <div key={ch} style={{ marginBottom:12 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'var(--fg-muted)', fontWeight:600, marginBottom:5 }}>
                      <span>{ch}</span>
                      <span>{perf.correct}/{perf.total}</span>
                    </div>
                    <div style={{ height:8, borderRadius:999, background:'var(--bg-soft)', overflow:'hidden' }}>
                      <div style={{ height:'100%', width: animated ? `${pct}%` : '0%', borderRadius:999, background:'var(--primary)', transition:'width 0.5s ease' }}/>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Buttons */}
          <div style={{ display:'flex', gap:10, marginTop:22, width:'100%', flexWrap:'wrap' }}>
            <button onClick={handleReview} style={{
              flex:'1 1 160px', padding:13, borderRadius:12,
              border:'none', background:'var(--primary)',
              color:'#fff', fontWeight:700, fontSize:14,
              cursor:'pointer', fontFamily:'inherit',
            }}>
              Review Answers
            </button>
            <button onClick={handleRetake} style={{
              flex:'1 1 160px', padding:13, borderRadius:12,
              border:'1px solid var(--bd)', background:'var(--bg-soft)',
              color:'var(--fg)', fontWeight:700, fontSize:14,
              cursor:'pointer', fontFamily:'inherit',
            }}>
              Retake Exam
            </button>
            <button onClick={handleBack} style={{
              flex:'1 1 160px', padding:13, borderRadius:12,
              border:'1px solid var(--bd)', background:'transparent',
              color:'var(--fg-muted)', fontWeight:700, fontSize:14,
              cursor:'pointer', fontFamily:'inherit',
            }}>
              Back to Exam Page
            </button>
          </div>

        </div>
      </main>
    </>
  )
}

export default function ResultsPage() {
  return (
    <Suspense fallback={
      <div style={{
        display:'flex', height:'60vh',
        alignItems:'center', justifyContent:'center',
        color:'var(--fg-muted)',
      }}>
        Loading results...
      </div>
    }>
      <ResultsContent />
    </Suspense>
  )
}