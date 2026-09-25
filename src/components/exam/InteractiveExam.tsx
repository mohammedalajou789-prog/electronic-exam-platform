'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ExplanationRenderer } from '@/components/exam/ExplanationRenderer'
import {
  startAttempt,
  recordAnswer,
  updateAttemptTime,
  finishAttempt,
  type ExamTarget,
  type AnswerPayload,
} from '@/features/exam-engine/attempt-client'
import { refreshStudyTip } from '@/app/actions/compute-study-tip'
import {
  REPORT_CATEGORIES,
  MAX_REPORT_DESCRIPTION_LENGTH,
  submitReport,
  loadBookmarkedIds,
  setBookmark,
} from '@/features/exam-engine/question-actions'

// ── Types ─────────────────────────────────────────────────────────────────────

interface QuestionImage {
  image_url: string
  display_order: number
}
interface QuestionStatistic {
  attempts: number
  correct_answers: number
}
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
  chapter: { id: string; name: string } | null
  lecture: { id: string; name: string } | null
  question_order: number
  doctor?: { name: string } | null
  question_images?: QuestionImage[]
  question_statistics?: QuestionStatistic[]
}
interface Exam {
  id: string
  title: string
  question_count: number
}
interface SavedProgress {
  current_question: number
  answers_json: Record<string, string>
  flags_json: string[]
  elapsed_seconds: number | null
}
interface Props {
  exam: Exam
  questions: Question[]
  savedProgress: SavedProgress | null
  /** Which exam is being solved: a regular exam or a custom exam. */
  target: ExamTarget
  /** True when the student pressed "Continue" (reuse the open attempt). */
  resume: boolean
  subjectName?: string
  batchName?: string
}
/** Who is answering, and in which attempt (both null for guests). */
interface ExamSession {
  userId: string | null
  attemptId: string | null
}

// ── Motion helpers ──────────────────────────────────────────────────────────
// Colors and dark mode come from globals.css (html.dark), animations from the
// shared motion classes in globals.css (a-rise, a-pop, a-fade, a-grow, a-ring…).

/** Stagger index for the shared animation classes (70 ms per step). */
const stagger = (i: number): React.CSSProperties =>
  ({ ['--i' as string]: i } as React.CSSProperties)

type Mode = 'play' | 'result' | 'review'

// ── Option builder ────────────────────────────────────────────────────────────

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
    let bg = 'var(--bg-soft)',
      border = 'var(--bd)',
      badgeBg = 'var(--bg-elev)',
      badgeColor = 'var(--fg-muted)',
      badgeContent = opt.key.toUpperCase(),
      opacity = 1

    if (answered && isCorrect) {
      bg = 'color-mix(in srgb, var(--accent-green) 16%, var(--bg-elev))'
      border = 'var(--accent-green)'
      badgeBg = 'var(--accent-green)'
      badgeColor = 'white'
      badgeContent = '✓'
    } else if (isWrongSelected) {
      bg = 'color-mix(in srgb, var(--primary) 16%, var(--bg-elev))'
      border = 'var(--primary)'
      badgeBg = 'var(--primary)'
      badgeColor = 'white'
      badgeContent = '✗'
    } else if (answered) {
      opacity = 0.55
    }

    return {
      key: opt.key,
      text: opt.text as string,
      note: opt.note,
      isCorrect,
      isWrongSelected,
      rowStyle: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        borderRadius: 13,
        border: `1.5px solid ${border}`,
        background: bg,
        color: 'var(--fg)',
        cursor: interactive && !answered ? 'pointer' : 'default',
        opacity,
        transition: 'background-color .26s var(--ease-out), border-color .26s var(--ease-out), opacity .26s var(--ease-out), transform .26s var(--ease-out)',
      } as React.CSSProperties,
      badgeStyle: {
        width: 26,
        height: 26,
        borderRadius: '50%',
        background: badgeBg,
        color: badgeColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12.5,
        fontWeight: 800,
        flex: '0 0 auto',
        border: `1px solid ${border}`,
      } as React.CSSProperties,
      badgeContent,
    }
  })
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const ChevronLeft = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 18l-6-6 6-6" />
  </svg>
)
const ChevronRight = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 6l6 6-6 6" />
  </svg>
)
const BackArrow = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
)
const ClockIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 3" />
  </svg>
)
const RestartIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
)
const CheckIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6L9 17l-5-5" />
  </svg>
)
const GridIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
)
const ReportIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5M12 16h.01" />
  </svg>
)
const BookmarkIcon = ({ fill }: { fill: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 3h12v18l-6-4-6 4V3z" />
  </svg>
)
const FlagIcon = ({ fill }: { fill: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 3v18M5 4h11l-2 4 2 4H5" />
  </svg>
)

// ── Main Component ────────────────────────────────────────────────────────────

export default function InteractiveExam({
  exam,
  questions,
  savedProgress,
  target,
  resume,
  subjectName,
  batchName,
}: Props) {
  const router = useRouter()
  const prepPath = usePathname().replace(/\/play$/, '')
  // Created once, so callbacks that depend on it stay stable between renders
  const [supabase] = useState(() => createClient())
  const targetExamId = target.examId
  const targetCustomExamId = target.customExamId

  // ── State initialised from savedProgress when resuming ────────────────────
  const [mode, setMode] = useState<Mode>('play')
  const [current, setCurrent] = useState(savedProgress?.current_question ?? 0)
  const [answers, setAnswers] = useState<Record<string, string>>(
    savedProgress?.answers_json ?? {}
  )
  const [flagged, setFlagged] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {}
    for (const id of savedProgress?.flags_json ?? []) map[id] = true
    return map
  })
  const [bookmarked, setBookmarked] = useState<Record<string, boolean>>({})

  // Timer starts from saved elapsed time (elapsed_seconds stores elapsed seconds)
  const [secondsElapsed, setSecondsElapsed] = useState(
    savedProgress?.elapsed_seconds ?? 0
  )

  const [navOpen, setNavOpen] = useState(false)
  const [jumpOpen, setJumpOpen] = useState(false)
  const [jumpValue, setJumpValue] = useState('')
  const [reportOpen, setReportOpen] = useState(false)
  const [restartConfirmOpen, setRestartConfirmOpen] = useState(false)
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false)
  const [showExplanation, setShowExplanation] = useState(false)
  const [reportType, setReportType] = useState('')
  const [reportDescription, setReportDescription] = useState('')
  const [reportSending, setReportSending] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)
  // Short message shown at the bottom of the screen (e.g. "Report sent")
  const [notice, setNotice] = useState<string | null>(null)
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Result state (set after finishing)
  const [finalTimeTaken, setFinalTimeTaken] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)

  // Refs — used inside callbacks to avoid stale closures
  const secondsRef = useRef(savedProgress?.elapsed_seconds ?? 0)
  const answersRef = useRef(savedProgress?.answers_json ?? {})
  const flaggedRef = useRef<Record<string, boolean>>({})
  const currentRef = useRef(savedProgress?.current_question ?? 0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const autoSaveRef = useRef<NodeJS.Timeout | null>(null)
  const modeRef = useRef<Mode>('play')
  // Cached user id — loaded once on mount so we can use it in beforeunload
  // (beforeunload cannot await async calls reliably)
  const userIdRef = useRef<string | null>(null)
  // Seconds spent on each question before it was answered (visible tab only)
  const questionTimeRef = useRef<Record<string, number>>({})
  // Questions shown on screen in this attempt ("skipped" vs "not reached")
  const viewedRef = useRef<Set<string>>(new Set())
  // The attempt session, opened once when the exam loads
  const sessionPromiseRef = useRef<Promise<ExamSession> | null>(null)
  const resumeRef = useRef(resume)
  const isCustomExam = targetCustomExamId !== null

  // Keep refs in sync with state
  useEffect(() => { answersRef.current = answers }, [answers])
  useEffect(() => { flaggedRef.current = flagged }, [flagged])
  useEffect(() => { currentRef.current = current }, [current])
  useEffect(() => { modeRef.current = mode }, [mode])

  // ── Attempt session ───────────────────────────────────────────────────────
  /**
   * Opens the attempt once (or resumes the open one) and remembers the result.
   * Every answer and the final submit wait for this. If it fails, the next
   * call simply tries again, reusing any attempt that was already opened.
   */
  const ensureSession = useCallback((): Promise<ExamSession> => {
    if (!sessionPromiseRef.current) {
      const shouldResume = resumeRef.current
      // Any later retry must reuse the attempt instead of opening another one
      resumeRef.current = true

      const promise = (async (): Promise<ExamSession> => {
        const { data: { user } } = await supabase.auth.getUser()
        userIdRef.current = user?.id ?? null
        if (!user) return { userId: null, attemptId: null }

        // A fresh start replaces any older saved position for this exam
        if (!shouldResume && targetExamId) {
          await supabase
            .from('study_progress')
            .delete()
            .eq('user_id', user.id)
            .eq('exam_id', targetExamId)
        }

        const attemptId = await startAttempt(
          { examId: targetExamId, customExamId: targetCustomExamId },
          shouldResume
        )
        return { userId: user.id, attemptId }
      })()

      promise.catch(() => {
        sessionPromiseRef.current = null
      })
      sessionPromiseRef.current = promise
    }
    return sessionPromiseRef.current
  }, [supabase, targetExamId, targetCustomExamId])

  // Open the attempt as soon as the exam screen loads, then show saved bookmarks
  useEffect(() => {
    let cancelled = false
    ensureSession()
      .then(async session => {
        if (!session.userId) return
        const saved = await loadBookmarkedIds(session.userId, questions.map(q => q.id))
        if (cancelled || saved.size === 0) return
        setBookmarked(current => {
          const merged = { ...current }
          saved.forEach(id => { merged[id] = true })
          return merged
        })
      })
      .catch(err => console.error('Could not start the attempt:', err))
    return () => { cancelled = true }
  }, [ensureSession, questions])

  /** Shows a short message at the bottom of the screen for 3 seconds. */
  function showNotice(message: string): void {
    setNotice(message)
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
    noticeTimerRef.current = setTimeout(() => setNotice(null), 3000)
  }

  /** Bookmarks are permanent and saved immediately (signed-in students only). */
  async function toggleBookmark(qid: string): Promise<void> {
    let userId: string | null = null
    try {
      userId = (await ensureSession()).userId
    } catch {
      userId = userIdRef.current
    }
    if (!userId) {
      showNotice('Sign in to save bookmarks.')
      return
    }

    const next = !bookmarked[qid]
    setBookmarked(b => ({ ...b, [qid]: next }))
    try {
      await setBookmark(userId, qid, next)
    } catch (err) {
      console.error('Could not save bookmark:', err)
      setBookmarked(b => ({ ...b, [qid]: !next }))
      showNotice('Could not save the bookmark. Please try again.')
    }
  }

  function closeReport(): void {
    setReportOpen(false)
    setReportType('')
    setReportDescription('')
    setReportError(null)
  }

  async function sendReport(qid: string): Promise<void> {
    if (!reportType || reportSending) return
    setReportSending(true)
    setReportError(null)
    try {
      await submitReport(qid, reportType, reportDescription)
      closeReport()
      showNotice('Report sent. Thank you for helping improve the questions.')
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Could not send the report. Please try again.')
    } finally {
      setReportSending(false)
    }
  }

  // Remember every question that appears on screen while solving
  useEffect(() => {
    const shownQuestion = questions[current]
    if (mode === 'play' && shownQuestion) viewedRef.current.add(shownQuestion.id)
  }, [current, mode, questions])

  /** Refreshes the study tip for a regular exam (never blocks the student). */
  async function refreshTipSafely(): Promise<void> {
    if (!targetExamId || !userIdRef.current) return
    try {
      await refreshStudyTip(targetExamId)
    } catch (err) {
      console.error('Could not update study tip:', err)
    }
  }

  /** Starts a brand-new attempt (Restart / Retake). The old one is abandoned. */
  function startNewAttempt(): void {
    sessionPromiseRef.current = null
    resumeRef.current = false
    questionTimeRef.current = {}
    viewedRef.current = new Set()
    ensureSession().catch(err => console.error('Could not start the attempt:', err))
  }

  // ── Timer (counts up) ─────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'play') {
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }
    timerRef.current = setInterval(() => {
      // Time only counts while the student can actually see the exam
      if (document.visibilityState !== 'visible') return
      secondsRef.current += 1
      setSecondsElapsed(s => s + 1)

      const shownQuestion = questions[currentRef.current]
      if (shownQuestion && !answersRef.current[shownQuestion.id]) {
        questionTimeRef.current[shownQuestion.id] =
          (questionTimeRef.current[shownQuestion.id] ?? 0) + 1
      }
    }, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [mode, questions])

  // ── Auto-save every 30 s (only during play, only for logged-in users) ─────
  const persistProgress = useCallback(async (): Promise<void> => {
    if (modeRef.current !== 'play') return

    let session: ExamSession
    try {
      session = await ensureSession()
    } catch {
      return // the next auto-save tries again
    }
    if (!session.userId) return

    // Study time is stored on the attempt
    if (session.attemptId) {
      await updateAttemptTime(session.attemptId, secondsRef.current)
    }

    // Custom exams are not resumed from the prep page, so no position is kept
    if (isCustomExam) return

    await supabase.from('study_progress').upsert(
      {
        user_id: session.userId,
        exam_id: exam.id,
        current_question: currentRef.current,
        answers_json: answersRef.current,
        flags_json: Object.keys(flaggedRef.current).filter(id => flaggedRef.current[id]),
        elapsed_seconds: secondsRef.current,
        completed: false,
      },
      { onConflict: 'user_id,exam_id' }
    )
  }, [ensureSession, exam.id, isCustomExam, supabase])

  useEffect(() => {
    if (mode !== 'play') return
    autoSaveRef.current = setInterval(persistProgress, 30_000)
    return () => {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current)
    }
  }, [persistProgress, mode])

  // ── Save on browser close / tab close / refresh ───────────────────────────
  // beforeunload fires synchronously — we cannot await inside it.
  // We use sendBeacon (fire-and-forget) so the POST completes after the page unloads.
  // The beacon carries the session cookies; the server identifies the student from them.
  // Answers themselves are already saved one by one, this only keeps the position.
  useEffect(() => {
    function handleBeforeUnload() {
      // Only save if we are still in play mode (not after finish)
      if (modeRef.current !== 'play') return
      if (!userIdRef.current || isCustomExam) return

      const payload = JSON.stringify({
        exam_id: exam.id,
        current_question: currentRef.current,
        answers_json: answersRef.current,
        flags_json: Object.keys(flaggedRef.current).filter(id => flaggedRef.current[id]),
        elapsed_seconds: secondsRef.current,
        completed: false,
      })
      navigator.sendBeacon('/api/save-progress', new Blob([payload], { type: 'application/json' }))
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [exam.id, isCustomExam])

  // ── Save on browser Back button ───────────────────────────────────────────
  // popstate fires when the user presses the browser Back/Forward button.
  // We use sendBeacon here too (same reason as beforeunload — navigation is happening).
  useEffect(() => {
    function handlePopState() {
      if (modeRef.current !== 'play') return
      if (!userIdRef.current || isCustomExam) return

      const payload = JSON.stringify({
        exam_id: exam.id,
        current_question: currentRef.current,
        answers_json: answersRef.current,
        flags_json: Object.keys(flaggedRef.current).filter(id => flaggedRef.current[id]),
        elapsed_seconds: secondsRef.current,
        completed: false,
      })
      navigator.sendBeacon('/api/save-progress', new Blob([payload], { type: 'application/json' }))
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [exam.id, isCustomExam])

  // ── "Continue Later" ──────────────────────────────────────────────────────
  /**
   * Saves the full current state to study_progress, then navigates back.
   * The prep page (force-dynamic) will re-fetch and find the row → show Continue.
   */
  async function saveProgressAndExit(): Promise<void> {
    // Save the latest time and position while still in play mode
    try {
      await persistProgress()
    } catch (err) {
      console.error('Could not save progress before leaving:', err)
    }

    // Most students leave without finishing, so the study tip is refreshed here too
    await refreshTipSafely()

    // Stop timer and auto-save
    if (timerRef.current) clearInterval(timerRef.current)
    if (autoSaveRef.current) clearInterval(autoSaveRef.current)

    window.location.replace(prepPath)
  }

  // ── Finish exam ───────────────────────────────────────────────────────────
  /**
   * Closes the attempt on the server. Every answer is sent again as a safety
   * net (answers that were already saved are ignored by the database).
   * On failure the result screen shows a Retry button.
   */
  async function saveResults(totalSeconds: number): Promise<void> {
    setIsSaving(true)
    setSaveError(false)
    try {
      const session = await ensureSession()

      // Guests: every answer was already counted when it was picked
      if (!session.userId) return
      if (!session.attemptId) throw new Error('No open attempt')

      const payload: AnswerPayload[] = questions.map(q => ({
        questionId: q.id,
        chosenAnswer: answersRef.current[q.id] ?? null,
        timeSeconds: questionTimeRef.current[q.id] ?? 0,
        isFlagged: flaggedRef.current[q.id] ?? false,
        isBookmarked: bookmarked[q.id] ?? false,
        wasViewed: viewedRef.current.has(q.id),
      }))

      await finishAttempt(session.attemptId, payload, totalSeconds)

      // Study tips are refreshed for regular exams (never blocks the result)
      void refreshTipSafely()
    } catch (err) {
      console.error('Failed to save exam results:', err)
      setSaveError(true)
    } finally {
      setIsSaving(false)
    }
  }

  /** Stops the timer, switches to the result screen, then saves. */
  async function finishExam(): Promise<void> {
    if (timerRef.current) clearInterval(timerRef.current)
    if (autoSaveRef.current) clearInterval(autoSaveRef.current)

    const elapsed = secondsRef.current
    setFinalTimeTaken(elapsed)
    setMode('result')
    setNavOpen(false)

    await saveResults(elapsed)
  }

  // ── Navigation helpers ────────────────────────────────────────────────────

  function selectAnswer(qid: string, key: string): void {
    if (answersRef.current[qid]) return // already answered — immutable
    const updated = { ...answersRef.current, [qid]: key }
    answersRef.current = updated
    setAnswers(updated)
    void submitAnswer(qid, key)
  }

  /**
   * Saves the answer in the background the moment it is picked.
   * If it cannot be saved now, it is sent again when the exam is finished.
   */
  async function submitAnswer(qid: string, key: string): Promise<void> {
    try {
      const session = await ensureSession()
      // Signed-in student whose attempt could not be opened yet: re-sent on Finish
      if (session.userId && !session.attemptId) return
      await recordAnswer(session.attemptId, qid, key, questionTimeRef.current[qid] ?? 0)
    } catch (err) {
      console.error('Answer will be sent again on Finish:', err)
    }
  }

  function goTo(index: number) {
    const clamped = Math.max(0, Math.min(questions.length - 1, index))
    setCurrent(clamped)
    currentRef.current = clamped
    setNavOpen(false)
    setJumpOpen(false)
    setShowExplanation(false)
  }

  function goNext() {
    if (current >= questions.length - 1) {
      finishExam()
    } else {
      goTo(current + 1)
    }
  }

  function goPrev() {
    goTo(current - 1)
  }

  function submitJump() {
    const n = parseInt(jumpValue, 10)
    if (n >= 1 && n <= questions.length) goTo(n - 1)
    setJumpOpen(false)
    setJumpValue('')
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const currentQ = questions[current]
  const selectedKey = answers[currentQ?.id] ?? null
  const answeredCount = Object.keys(answers).length
  const mm = Math.floor(secondsElapsed / 60)
  const ss = secondsElapsed % 60
  const timerLabel = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
  const suggestedSeconds = exam.question_count * 60
  const timerLow = secondsElapsed > suggestedSeconds
  const progressPct =
    ((current + (selectedKey ? 1 : 0)) / questions.length) * 100

  // Result screen computed values
  let correctCount = 0
  questions.forEach(q => {
    if (answers[q.id] === q.correct_answer) correctCount++
  })
  const wrongCount = answeredCount - correctCount
  const skippedCount = questions.length - answeredCount
  const scorePercent = Math.round((correctCount / questions.length) * 100)
  const timeTakenLabel = `${Math.floor(finalTimeTaken / 60)}:${String(finalTimeTaken % 60).padStart(2, '0')}`
  const gaugeColor =
    scorePercent >= 80
      ? 'var(--accent-green)'
      : scorePercent >= 50
      ? 'var(--accent-blue)'
      : 'var(--primary)'
  const resultHeadline =
    scorePercent >= 80
      ? 'Excellent Work!'
      : scorePercent >= 50
      ? 'Good Effort!'
      : 'Keep Practicing!'
  const circ = 2 * Math.PI * 78
  const gaugeOffset = circ * (1 - scorePercent / 100)

  const byChapter: Record<string, { correct: number; total: number }> = {}
  questions.forEach(q => {
    const ch = q.chapter?.name ?? 'Other'
    if (!byChapter[ch]) byChapter[ch] = { correct: 0, total: 0 }
    byChapter[ch].total++
    if (answers[q.id] === q.correct_answer) byChapter[ch].correct++
  })
  const chapterStats = Object.entries(byChapter).map(([chapter, v]) => ({
    chapter,
    label: `${v.correct}/${v.total}`,
    pct: Math.round((v.correct / v.total) * 100),
  }))

  // ── Shared button style ───────────────────────────────────────────────────
  const headerBtnStyle: React.CSSProperties = {
    width: 38,
    height: 38,
    flexShrink: 0,
    borderRadius: 11,
    border: '1px solid var(--bd)',
    background: 'var(--bg-soft)',
    color: 'var(--fg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  }

  // ── Shared CSS ────────────────────────────────────────────────────────────
  const sharedCSS = `
    /* Centered dialogs keep their translate(-50%,-50%) while popping in */
    @keyframes examModalIn {
      from { opacity: 0; transform: translate(-50%, -50%) scale(.94); }
      to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }
    @keyframes examToastIn {
      from { opacity: 0; transform: translate(-50%, 16px); }
      to   { opacity: 1; transform: translate(-50%, 0); }
    }
    .exam-modal  { animation: examModalIn .34s var(--ease-spring) both; }
    .exam-toast  { animation: examToastIn .4s var(--ease-out) both; }
    .exam-drawer { animation: mc-drawer .42s var(--ease-out) both; }
    /* Phones: the question navigator becomes a bottom sheet */
    @media (max-width: 640px) {
      .exam-drawer {
        top: auto !important; left: 0 !important; right: 0 !important;
        width: auto !important; max-height: 82vh;
        border-radius: 24px 24px 0 0;
        animation-name: mc-sheet;
      }
    }
    .exam-opt-idle:hover { border-color: var(--primary) !important; transform: translateX(3px); }
    * { box-sizing: border-box; }
    button { font-family: inherit; }
  `

  // ── Sticky header (shared across all modes) ───────────────────────────────
  const eyebrow =
    mode === 'play'
      ? 'Interactive Exam'
      : mode === 'review'
      ? 'Review Mode'
      : 'Results'

  const Header = (
    <header
      className="a-fade"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        background: 'var(--bg-elev)',
        borderBottom: '1px solid var(--bd)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div style={{ minWidth: 0, flex: '1 1 auto' }}>
          <div
            style={{
              fontSize: 12,
              color: 'var(--fg-muted)',
              fontWeight: 600,
              marginBottom: 2,
            }}
          >
            {subjectName ?? 'Custom Exam'}
            {batchName ? ` · ${batchName}` : ''} · {eyebrow}
          </div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 800,
              color: 'var(--fg)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              letterSpacing: -0.3,
            }}
          >
            {exam.title}
          </div>
        </div>

        {/* Play mode controls */}
        {mode === 'play' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexShrink: 0,
            }}
          >
            <button
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 11,
                border: '1px solid var(--bd)',
                background: 'transparent',
                color: 'var(--fg-muted)',
                fontWeight: 600,
                fontSize: 13.5,
                cursor: 'pointer',
                flexShrink: 0,
              }}
              onClick={saveProgressAndExit}
              className="press"
            >
              <BackArrow />
              {isCustomExam ? 'Exit' : 'Continue Later'}
            </button>

            <button
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 11,
                border: '1px solid color-mix(in srgb, #d97706 35%, var(--bd))',
                background: 'color-mix(in srgb, #d97706 10%, var(--bg-soft))',
                color: '#b45309',
                fontWeight: 700,
                fontSize: 13.5,
                cursor: 'pointer',
                flexShrink: 0,
              }}
              onClick={() => setRestartConfirmOpen(true)}
              className="press"
            >
              <RestartIcon />
              Restart
            </button>

            <button
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                borderRadius: 11,
                border: 'none',
                background: 'oklch(55% 0.15 145)',
                color: 'white',
                fontWeight: 700,
                fontSize: 13.5,
                cursor: 'pointer',
                flexShrink: 0,
                boxShadow: '0 2px 10px color-mix(in srgb, oklch(55% 0.15 145) 35%, transparent)',
              }}
              onClick={() => setFinishConfirmOpen(true)}
              className="press"
            >
              <CheckIcon />
              Finish
            </button>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 13px',
                borderRadius: 11,
                background: timerLow
                  ? 'color-mix(in srgb, var(--primary) 18%, var(--bg-soft))'
                  : 'var(--bg-soft)',
                border: `1px solid ${timerLow ? 'var(--primary)' : 'var(--bd)'}`,
                color: timerLow ? 'var(--primary)' : 'var(--fg)',
                fontWeight: 800,
                fontSize: 13.5,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {timerLow ? <ClockIcon /> : (
                <span
                  className="a-blink"
                  style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent-green)' }}
                />
              )}
              <span>{timerLabel}</span>
            </div>

            <button className="press" style={headerBtnStyle} onClick={() => setNavOpen(true)} aria-label="Open question navigator">
              <GridIcon />
            </button>
          </div>
        )}
      </div>

      {/* Progress bar — play mode only */}
      {mode === 'play' && (
        <div style={{ height: 3, background: 'var(--bd)' }}>
          <div
            style={{
              height: '100%',
              width: `${progressPct}%`,
              background:
                'linear-gradient(90deg, var(--primary), var(--accent-purple))',
              transition: 'width .6s var(--ease-out)',
            }}
          />
        </div>
      )}
    </header>
  )

  // ══════════════════════════════════════════════════════════════════════════
  // PLAY MODE
  // ══════════════════════════════════════════════════════════════════════════
  if (mode === 'play' && currentQ) {
    const opts = buildOptions(currentQ, selectedKey, true)
    const imgUrl = currentQ.question_images?.[0]?.image_url

    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--bg)',
          color: 'var(--fg)',
          fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
        }}
      >
        <style>{sharedCSS}</style>
        {Header}

        <main
          style={{
            maxWidth: 1280,
            margin: '0 auto',
            padding: '32px 20px 80px',
          }}
        >
          {/* Counter row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 18,
            }}
          >
            <div
              style={{
                fontSize: 13.5,
                color: 'var(--fg-muted)',
                fontWeight: 700,
              }}
            >
              Question {current + 1} of {questions.length} · {answeredCount}{' '}
              answered
            </div>
          </div>

          {/* Question card — keyed so it animates in on every question */}
          <div
            key={currentQ.id}
            className="a-rise"
            style={{
              background: 'var(--bg-elev)',
              border: '1px solid var(--bd)',
              borderRadius: 18,
              padding: 24,
              boxShadow: '0 1px 3px var(--shadow)',
            }}
          >
            {/* Meta row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 16,
              }}
            >
              <span
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 8,
                  background: 'var(--primary-soft)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12.5,
                  fontWeight: 800,
                  flexShrink: 0,
                }}
              >
                {current + 1}
              </span>
              {currentQ.chapter?.name && (
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: 999,
                    background:
                      'color-mix(in srgb, var(--accent-blue) 15%, var(--bg-soft))',
                    color: 'var(--accent-blue)',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {currentQ.chapter?.name}
                </span>
              )}
              {currentQ.lecture?.name && (
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: 999,
                    background: 'var(--bg-soft)',
                    color: 'var(--fg-muted)',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {currentQ.lecture?.name}
                </span>
              )}
              {currentQ.doctor?.name && (
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: 999,
                    background: 'color-mix(in srgb, var(--accent-purple) 15%, var(--bg-soft))',
                    color: 'var(--accent-purple)',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {currentQ.doctor.name}
                </span>
              )}
              <div style={{ flex: '1 1 auto' }} />
              <button
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  border: '1px solid var(--bd)',
                  background: bookmarked[currentQ.id]
                    ? 'var(--primary-soft)'
                    : 'var(--bg-soft)',
                  color: bookmarked[currentQ.id]
                    ? 'var(--primary)'
                    : 'var(--fg-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
                className="press"
                onClick={() => toggleBookmark(currentQ.id)}
                aria-label={bookmarked[currentQ.id] ? 'Remove bookmark' : 'Bookmark this question'}
                aria-pressed={bookmarked[currentQ.id] ?? false}
              >
                <span
                  key={bookmarked[currentQ.id] ? 'on' : 'off'}
                  className={bookmarked[currentQ.id] ? 'a-pop' : undefined}
                  style={{ display: 'flex' }}
                >
                  <BookmarkIcon fill={bookmarked[currentQ.id] ? 'currentColor' : 'none'} />
                </span>
              </button>
              <button
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  border: '1px solid var(--bd)',
                  background: flagged[currentQ.id]
                    ? 'var(--primary-soft)'
                    : 'var(--bg-soft)',
                  color: flagged[currentQ.id]
                    ? 'var(--primary)'
                    : 'var(--fg-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
                className="press"
                aria-label={flagged[currentQ.id] ? 'Remove flag' : 'Flag this question'}
                aria-pressed={flagged[currentQ.id] ?? false}
                onClick={() =>
                  setFlagged(f => ({ ...f, [currentQ.id]: !f[currentQ.id] }))
                }
              >
                <span
                  key={flagged[currentQ.id] ? 'on' : 'off'}
                  className={flagged[currentQ.id] ? 'a-pop' : undefined}
                  style={{ display: 'flex' }}
                >
                  <FlagIcon fill={flagged[currentQ.id] ? 'currentColor' : 'none'} />
                </span>
              </button>
            </div>

            {/* Question text */}
            <div
              style={{
                fontSize: 19,
                fontWeight: 700,
                color: 'var(--fg)',
                lineHeight: 1.6,
                letterSpacing: -0.1,
                marginBottom: 18,
              }}
            >
              {currentQ.question_text}
            </div>

            {/* Image */}
            {imgUrl && (
              <div
                style={{
                  marginBottom: 16,
                  borderRadius: 12,
                  overflow: 'hidden',
                  border: '1px solid var(--bd)',
                }}
              >
                <img
                  src={imgUrl}
                  alt="Question"
                  style={{
                    width: '100%',
                    maxHeight: 360,
                    objectFit: 'contain',
                    display: 'block',
                  }}
                />
              </div>
            )}

            {/* Answer choices */}
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
            >
              {opts.map((opt, i) => (
                <div key={opt.key} className="a-rise" style={stagger(i + 1)}>
                  <div
                    className={selectedKey ? undefined : 'exam-opt-idle'}
                    style={opt.rowStyle}
                    onClick={() => selectAnswer(currentQ.id, opt.key)}
                  >
                    <span
                      key={opt.badgeContent}
                      className={selectedKey && (opt.isCorrect || opt.isWrongSelected) ? 'a-pop' : undefined}
                      style={opt.badgeStyle}
                    >
                      {opt.badgeContent}
                    </span>
                    <span
                      style={{ flex: '1 1 auto', fontSize: 15, fontWeight: 600 }}
                    >
                      {opt.text}
                    </span>
                  </div>
                  {selectedKey && opt.isWrongSelected && opt.note && (
                    <div
                      className="a-rise"
                      style={{
                        margin: '6px 2px 0 42px',
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--primary)',
                      }}
                    >
                      {opt.note}
                    </div>
                  )}
                </div>
              ))}
            </div>

            </div>

          {/* Action bar — directly below choices, above explanation */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 18,
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '11px 16px',
                  borderRadius: 12,
                  border: '1px solid var(--primary)',
                  background:
                    'color-mix(in srgb, var(--primary) 12%, var(--bg-elev))',
                  color: 'var(--primary)',
                  fontWeight: 700,
                  fontSize: 13.5,
                  cursor: 'pointer',
                }}
                className="press"
                onClick={() => setReportOpen(true)}
              >
                <ReportIcon />
                Report Issue
              </button>
              {selectedKey && currentQ.explanation && (
                <button
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '11px 16px',
                    borderRadius: 12,
                    border: showExplanation
                      ? '1px solid var(--accent-green)'
                      : '1px solid var(--bd)',
                    background: showExplanation
                      ? 'color-mix(in srgb, var(--accent-green) 12%, var(--bg-elev))'
                      : 'var(--bg-soft)',
                    color: showExplanation ? 'var(--accent-green)' : 'var(--fg)',
                    fontWeight: 700,
                    fontSize: 13.5,
                    cursor: 'pointer',
                    transition: 'all .2s ease',
                  }}
                  className="press"
                  onClick={() => setShowExplanation(prev => !prev)}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 8h.01M12 12v4" />
                  </svg>
                  {showExplanation ? 'Hide Explanation' : 'Show Explanation'}
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '11px 18px',
                  borderRadius: 12,
                  border: '1px solid var(--bd)',
                  background: 'var(--bg-elev)',
                  color: 'var(--fg)',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: current === 0 ? 'not-allowed' : 'pointer',
                  opacity: current === 0 ? 0.5 : 1,
                }}
                className="press"
                onClick={goPrev}
                disabled={current === 0}
              >
                <ChevronLeft />
                Prev
              </button>
              <button
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '11px 20px',
                  borderRadius: 12,
                  border: 'none',
                  background: 'var(--primary)',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                  boxShadow:
                    '0 4px 14px color-mix(in srgb, var(--primary) 35%, transparent)',
                }}
                className="press nudge"
                onClick={goNext}
              >
                {current >= questions.length - 1 ? 'Finish' : 'Next'}
                <ChevronRight />
              </button>
            </div>
          </div>

          {/* Explanation — shown only when requested */}
          {selectedKey && currentQ.explanation && showExplanation && (
            <div
              className="a-rise"
              style={{
                marginTop: 20,
                borderTop: '1px solid var(--bd)',
                paddingTop: 20,
              }}
            >
              <ExplanationRenderer content={currentQ.explanation} />

              {/* Bottom nav — after long explanation */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: 8,
                  marginTop: 20,
                }}
              >
                <button
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '7px 13px',
                    borderRadius: 9,
                    border: '1px solid var(--bd)',
                    background: 'transparent',
                    color: 'var(--fg-muted)',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 19V5M5 12l7-7 7 7" />
                  </svg>
                  Back to top
                </button>

                <button
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '7px 14px',
                    borderRadius: 9,
                    border: '1px solid var(--bd)',
                    background: 'var(--bg-soft)',
                    color: 'var(--fg)',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                  className="press nudge"
                  onClick={goNext}
                >
                  {current >= questions.length - 1 ? 'Finish' : 'Next Question'}
                  <ChevronRight />
                </button>
              </div>
            </div>
          )}
        </main>

        {/* ── Navigator Drawer ───────────────────────────────────────────── */}
        {navOpen && (
          <>
            <div
              className="a-fade"
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,.45)',
                zIndex: 60,
              }}
              onClick={() => setNavOpen(false)}
            />
            <div
              className="exam-drawer"
              role="dialog"
              aria-label="Question navigator"
              style={{
                position: 'fixed',
                top: 0,
                right: 0,
                bottom: 0,
                width: 'min(340px, 88vw)',
                background: 'var(--bg-elev)',
                zIndex: 61,
                boxShadow: '-8px 0 30px var(--shadow)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  padding: '20px 22px',
                  borderBottom: '1px solid var(--bd)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div
                  style={{ fontSize: 16, fontWeight: 800, color: 'var(--fg)' }}
                >
                  Questions
                </div>
                <button
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 9,
                    border: '1px solid var(--bd)',
                    background: 'var(--bg-soft)',
                    color: 'var(--fg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                  onClick={() => setNavOpen(false)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div
                style={{
                  padding: '18px 22px',
                  overflowY: 'auto',
                  flex: '1 1 auto',
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(5,1fr)',
                    gap: 10,
                  }}
                >
                  {questions.map((q, i) => {
                    const ans = answers[q.id]
                    const isCurrent = i === current
                    let bg = 'var(--bg-soft)',
                      border = 'var(--bd)',
                      color = 'var(--fg-muted)'
                    if (ans) {
                      bg =
                        'color-mix(in srgb, var(--accent-green) 18%, var(--bg-elev))'
                      border = 'var(--accent-green)'
                      color = 'var(--accent-green)'
                    }
                    if (isCurrent) {
                      border = 'var(--primary)'
                      color = 'var(--primary)'
                    }
                    return (
                      <button
                        key={q.id}
                        className="press"
                        onClick={() => goTo(i)}
                        style={{
                          position: 'relative',
                          height: 42,
                          borderRadius: 11,
                          border: `1.5px solid ${border}`,
                          background: bg,
                          color,
                          fontWeight: 800,
                          fontSize: 14,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {i + 1}
                        {flagged[q.id] && (
                          <span
                            style={{
                              position: 'absolute',
                              top: 4,
                              right: 4,
                              width: 7,
                              height: 7,
                              borderRadius: '50%',
                              background: 'var(--primary)',
                            }}
                          />
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* Legend */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    marginTop: 22,
                    fontSize: 12.5,
                    color: 'var(--fg-muted)',
                    fontWeight: 600,
                  }}
                >
                  {[
                    { dot: { borderRadius: '50%', background: 'var(--accent-green)' }, label: 'Answered' },
                    { dot: { borderRadius: 3, border: '2px solid var(--primary)', background: 'transparent' }, label: 'Current' },
                    { dot: { borderRadius: '50%', border: '2px solid var(--fg-muted)', background: 'var(--bg-soft)' }, label: 'Unanswered' },
                    { dot: { borderRadius: '50%', background: 'var(--primary)' }, label: 'Flagged' },
                  ].map(item => (
                    <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 10, height: 10, display: 'inline-block', flexShrink: 0, ...item.dot }} />
                      {item.label}
                    </div>
                  ))}
                </div>
              </div>

              <div
                style={{
                  padding: '18px 22px',
                  borderTop: '1px solid var(--bd)',
                }}
              >
                <button
                  style={{
                    width: '100%',
                    padding: 13,
                    borderRadius: 12,
                    border: 'none',
                    background: 'var(--primary)',
                    color: 'white',
                    fontWeight: 800,
                    fontSize: 14.5,
                    cursor: 'pointer',
                  }}
                  onClick={finishExam}
                >
                  Finish Exam
                </button>
              </div>
            </div>
          </>
        )}
{/* ── Restart Confirmation Modal ─────────────────────────────────── */}
        {restartConfirmOpen && (
          <>
            <div
              className="a-fade"
              style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
                zIndex: 200,
              }}
              onClick={() => setRestartConfirmOpen(false)}
            />
            <div
              className="exam-modal"
              style={{
                position: 'fixed', top: '50%', left: '50%',
                transform: 'translate(-50%,-50%)',
                width: 'min(420px, 90vw)',
                background: 'var(--bg-elev)', borderRadius: 18,
                border: '1px solid var(--bd)', padding: '28px 26px',
                zIndex: 201,
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--fg)', marginBottom: 10 }}>
                Restart Exam?
              </div>
              <div style={{ fontSize: 14, color: 'var(--fg-muted)', fontWeight: 600, lineHeight: 1.6, marginBottom: 24 }}>
                This will clear your answers and flags and reset the timer. Answers you already gave still count in your statistics.
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  style={{
                    padding: '10px 20px', borderRadius: 11,
                    border: '1px solid var(--bd)', background: 'transparent',
                    color: 'var(--fg)', fontWeight: 700, fontSize: 14,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                  onClick={() => setRestartConfirmOpen(false)}
                >
                  Cancel
                </button>
                <button
                  style={{
                    padding: '10px 20px', borderRadius: 11, border: 'none',
                    background: 'var(--primary)', color: 'white',
                    fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                  onClick={() => {
                    setRestartConfirmOpen(false)
                    setAnswers({})
                    setFlagged({})
                    setCurrent(0)
                    currentRef.current = 0
                    answersRef.current = {}
                    flaggedRef.current = {}
                    setSecondsElapsed(0)
                    secondsRef.current = 0
                    startNewAttempt()
                  }}
                >
                  Yes, Restart
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Finish Confirmation Modal ──────────────────────────────────── */}
        {finishConfirmOpen && (
          <>
            <div
              className="a-fade"
              style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
                zIndex: 200,
              }}
              onClick={() => setFinishConfirmOpen(false)}
            />
            <div
              className="exam-modal"
              style={{
                position: 'fixed', top: '50%', left: '50%',
                transform: 'translate(-50%,-50%)',
                width: 'min(420px, 90vw)',
                background: 'var(--bg-elev)', borderRadius: 18,
                border: '1px solid var(--bd)', padding: '28px 26px',
                zIndex: 201,
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--fg)', marginBottom: 10 }}>
                Finish Exam?
              </div>
              <div style={{ fontSize: 14, color: 'var(--fg-muted)', fontWeight: 600, lineHeight: 1.6, marginBottom: 8 }}>
                You have answered <strong style={{ color: 'var(--fg)' }}>{answeredCount}</strong> of <strong style={{ color: 'var(--fg)' }}>{questions.length}</strong> questions.
              </div>
              {answeredCount < questions.length && (
                <div
                  style={{
                    padding: '10px 14px', borderRadius: 10, marginBottom: 16,
                    background: 'color-mix(in srgb, var(--primary) 12%, var(--bg-soft))',
                    border: '1px solid var(--primary)',
                    color: 'var(--primary)', fontSize: 13, fontWeight: 700,
                  }}
                >
                  {questions.length - answeredCount} question{questions.length - answeredCount !== 1 ? 's' : ''} left unanswered.
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button
                  style={{
                    padding: '10px 20px', borderRadius: 11,
                    border: '1px solid var(--bd)', background: 'transparent',
                    color: 'var(--fg)', fontWeight: 700, fontSize: 14,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                  onClick={() => setFinishConfirmOpen(false)}
                >
                  Keep Going
                </button>
                <button
                  style={{
                    padding: '10px 20px', borderRadius: 11, border: 'none',
                    background: 'var(--primary)', color: 'white',
                    fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                  onClick={() => {
                    setFinishConfirmOpen(false)
                    finishExam()
                  }}
                >
                  Submit Exam
                </button>
              </div>
            </div>
          </>
        )}
        {/* ── Report Modal ───────────────────────────────────────────────── */}
        {reportOpen && (
          <>
            <div
              className="a-fade"
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,.45)',
                zIndex: 200,
              }}
              onClick={closeReport}
            />
            <div
              className="exam-modal"
              style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%,-50%)',
                width: 'min(480px, 90vw)',
                background: 'var(--bg-elev)',
                borderRadius: 18,
                border: '1px solid var(--bd)',
                padding: '22px 24px',
                zIndex: 201,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 18,
                }}
              >
                <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--fg)' }}>
                  Report an Issue
                </div>
                <button
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 9,
                    border: '1px solid var(--bd)',
                    background: 'var(--bg-soft)',
                    color: 'var(--fg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    setReportOpen(false)
                    setReportType('')
                    setReportDescription('')
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-muted)', marginBottom: 6 }}>
                Issue Type
              </div>
              <select
                value={reportType}
                onChange={e => setReportType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '11px 12px',
                  borderRadius: 11,
                  border: '1px solid var(--bd)',
                  background: 'var(--bg-soft)',
                  color: 'var(--fg)',
                  fontSize: 14,
                  fontFamily: 'inherit',
                  marginBottom: 16,
                  outline: 'none',
                }}
              >
                <option value="">Select issue type</option>
                {REPORT_CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-muted)', marginBottom: 6 }}>
                Description (Optional)
              </div>
              <textarea
                value={reportDescription}
                onChange={e => setReportDescription(e.target.value)}
                maxLength={MAX_REPORT_DESCRIPTION_LENGTH}
                placeholder="Describe the issue..."
                style={{
                  width: '100%',
                  minHeight: 84,
                  padding: '11px 12px',
                  borderRadius: 11,
                  border: '1px solid var(--bd)',
                  background: 'var(--bg-soft)',
                  color: 'var(--fg)',
                  fontSize: 14,
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  marginBottom: reportError ? 10 : 18,
                  outline: 'none',
                }}
              />
              {reportError && (
                <div role="alert" style={{ marginBottom: 14, fontSize: 13, fontWeight: 600, color: '#ef4444' }}>
                  {reportError}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  style={{
                    padding: '10px 18px',
                    borderRadius: 11,
                    border: '1px solid var(--bd)',
                    background: 'transparent',
                    color: 'var(--fg)',
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                  onClick={closeReport}
                >
                  Cancel
                </button>
                <button
                  style={{
                    padding: '10px 18px',
                    borderRadius: 11,
                    border: 'none',
                    background: 'var(--primary)',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: !reportType || reportSending ? 'not-allowed' : 'pointer',
                    opacity: !reportType || reportSending ? 0.5 : 1,
                    fontFamily: 'inherit',
                  }}
                  disabled={!reportType || reportSending}
                  onClick={() => sendReport(currentQ.id)}
                >
                  {reportSending ? 'Sending...' : 'Submit Report'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Short notices (bookmark / report feedback) ─────────────────── */}
        {notice && (
          <div
            role="status"
            aria-live="polite"
            className="exam-toast"
            style={{
              position: 'fixed',
              left: '50%',
              bottom: 24,
              transform: 'translateX(-50%)',
              zIndex: 300,
              maxWidth: 'calc(100vw - 32px)',
              padding: '11px 18px',
              borderRadius: 12,
              background: 'var(--fg)',
              color: 'var(--bg-elev)',
              fontSize: 13.5,
              fontWeight: 700,
              boxShadow: '0 10px 30px rgba(0,0,0,.25)',
            }}
          >
            {notice}
          </div>
        )}

        {/* ── Jump Modal ─────────────────────────────────────────────────── */}
        {jumpOpen && (
          <>
            <div
              className="a-fade"
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,.5)',
                zIndex: 70,
              }}
              onClick={() => setJumpOpen(false)}
            />
            <div
              className="exam-modal"
              style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%,-50%)',
                width: 'min(640px, 90vw)',
                maxHeight: '80vh',
                overflowY: 'auto',
                background: 'var(--bg-elev)',
                borderRadius: 18,
                border: '1px solid var(--bd)',
                boxShadow: '0 20px 60px var(--shadow)',
                padding: '22px 24px',
                zIndex: 71,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--fg)' }}>
                  Jump to Question
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12.5,
                    color: 'var(--fg-muted)',
                    fontWeight: 600,
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="var(--primary)" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 3v18M5 4h11l-2 4 2 4H5" /></svg>
                  <span>= Flagged</span>
                  <span style={{ margin: '0 2px' }}>•</span>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="var(--accent-green)" stroke="var(--accent-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="4" fill="var(--accent-green)" /><path d="M7 12l3 3 7-7" stroke="white" fill="none" /></svg>
                  <span>= Answered</span>
                </div>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(46px, 1fr))',
                  gap: 10,
                  padding: 4,
                }}
              >
                {questions.map((q, i) => {
                  const answered = !!answers[q.id]
                  const isCurrent = i === current
                  const btnStyle: React.CSSProperties = isCurrent
                    ? {
                        position: 'relative', width: 46, height: 46, borderRadius: 12,
                        border: 'none', background: 'var(--primary)', color: 'white',
                        fontWeight: 800, fontSize: 15, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 4px 12px color-mix(in srgb, var(--primary) 45%, transparent)',
                      }
                    : answered
                    ? {
                        position: 'relative', width: 46, height: 46, borderRadius: 12,
                        border: '1.5px solid var(--accent-green)',
                        background: 'color-mix(in srgb, var(--accent-green) 14%, var(--bg-elev))',
                        color: 'var(--accent-green)', fontWeight: 800, fontSize: 15,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }
                    : {
                        position: 'relative', width: 46, height: 46, borderRadius: 12,
                        border: '1.5px solid var(--bd)', background: 'var(--bg-soft)',
                        color: 'var(--fg)', fontWeight: 700, fontSize: 15,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }
                  return (
                    <button key={q.id} className="press" style={btnStyle} onClick={() => goTo(i)}>
                      {i + 1}
                      {flagged[q.id] && (
                        <span
                          style={{
                            position: 'absolute', top: -4, right: -4,
                            width: 12, height: 12, borderRadius: '50%',
                            background: 'var(--primary)', border: '2px solid var(--bg-elev)',
                          }}
                        />
                      )}
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

  // ══════════════════════════════════════════════════════════════════════════
  // RESULT MODE
  // ══════════════════════════════════════════════════════════════════════════
  if (mode === 'result') {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--bg)',
          color: 'var(--fg)',
          fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
        }}
      >
        <style>{sharedCSS}</style>
        {Header}
        <main
          style={{
            maxWidth: 1180,
            margin: '0 auto',
            padding: '40px 24px 80px',
          }}
        >
          {/* Score card */}
          <div
            className="a-pop"
            style={{
              background: 'var(--bg-elev)',
              border: '1px solid var(--bd)',
              borderRadius: 20,
              padding: '36px 30px',
              boxShadow: '0 1px 3px var(--shadow)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              marginBottom: 24,
            }}
          >
            <svg width="180" height="180" viewBox="0 0 180 180">
              <circle cx="90" cy="90" r="78" fill="none" stroke="var(--bd)" strokeWidth="12" />
              <circle
                cx="90" cy="90" r="78" fill="none" stroke={gaugeColor} strokeWidth="12"
                strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={gaugeOffset}
                transform="rotate(-90 90 90)"
                className="a-ring"
                style={{ ['--c' as string]: circ } as React.CSSProperties}
              />
              <text x="90" y="85" textAnchor="middle" fill="var(--fg)" fontSize="32" fontWeight="800" fontFamily="inherit">
                {scorePercent}%
              </text>
              <text x="90" y="108" textAnchor="middle" fill="var(--fg-muted)" fontSize="13" fontWeight="600" fontFamily="inherit">
                {resultHeadline}
              </text>
            </svg>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4,1fr)',
                gap: 12,
                width: '100%',
                marginTop: 8,
              }}
            >
              {[
                { label: 'Correct', value: correctCount, color: 'var(--accent-green)', bg: 'color-mix(in srgb, var(--accent-green) 14%, var(--bg-soft))' },
                { label: 'Wrong',   value: wrongCount,   color: 'var(--primary)',       bg: 'color-mix(in srgb, var(--primary) 14%, var(--bg-soft))' },
                { label: 'Skipped', value: skippedCount, color: 'var(--fg-muted)',      bg: 'var(--bg-soft)' },
                {
                  label: `Time (${exam.question_count} min suggested)`,
                  value: timeTakenLabel,
                  color: finalTimeTaken <= suggestedSeconds ? 'var(--accent-green)' : 'var(--primary)',
                  bg: finalTimeTaken <= suggestedSeconds
                    ? 'color-mix(in srgb, var(--accent-green) 14%, var(--bg-soft))'
                    : 'color-mix(in srgb, var(--primary) 14%, var(--bg-soft))',
                },
              ].map((stat, i) => (
                <div
                  key={stat.label}
                  className="a-rise"
                  style={{ ...stagger(i + 2), padding: 14, borderRadius: 13, background: stat.bg, color: stat.color }}
                >
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{stat.value}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4, opacity: 0.8 }}>
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Saving indicator */}
          {isSaving && (
            <div
              style={{
                marginBottom: 12,
                padding: '12px 16px',
                borderRadius: 12,
                background: 'color-mix(in srgb, var(--accent-blue) 12%, var(--bg-elev))',
                border: '1px solid var(--accent-blue)',
                color: 'var(--accent-blue)',
                fontSize: 13.5,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <svg className="a-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
              Saving your results...
            </div>
          )}
          {saveError && (
            <div
              style={{
                marginBottom: 12,
                padding: '12px 16px',
                borderRadius: 12,
                background: 'color-mix(in srgb, var(--primary) 12%, var(--bg-elev))',
                border: '1px solid var(--primary)',
                color: 'var(--primary)',
                fontSize: 13.5,
                fontWeight: 700,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <span>Could not save your results. Check your connection and try again.</span>
                <button
                  onClick={() => saveResults(finalTimeTaken)}
                  disabled={isSaving}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 10,
                    border: 'none',
                    background: 'var(--primary)',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                    opacity: isSaving ? 0.7 : 1,
                    fontFamily: 'inherit',
                  }}
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* Chapter breakdown */}
          {chapterStats.length > 0 && (
            <div
              style={{
                background: 'var(--bg-elev)',
                border: '1px solid var(--bd)',
                borderRadius: 16,
                padding: '20px 24px',
                marginBottom: 24,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 14 }}>
                By Chapter
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {chapterStats.map((cs, i) => (
                  <div key={cs.chapter} className="a-rise" style={stagger(i)}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 13,
                        fontWeight: 700,
                        marginBottom: 6,
                      }}
                    >
                      <span>{cs.chapter}</span>
                      <span style={{ color: 'var(--fg-muted)' }}>{cs.label}</span>
                    </div>
                    <div
                      style={{ height: 8, borderRadius: 999, background: 'var(--bg-soft)' }}
                    >
                      <div
                        className="a-grow"
                        style={{
                          ...stagger(i),
                          height: '100%',
                          borderRadius: 999,
                          width: `${cs.pct}%`,
                          background:
                            cs.pct >= 70
                              ? 'var(--accent-green)'
                              : cs.pct >= 40
                              ? 'var(--accent-blue)'
                              : 'var(--primary)',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              style={{
                flex: '1 1 160px',
                padding: 13,
                borderRadius: 12,
                border: 'none',
                background: 'var(--primary)',
                color: 'white',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
              }}
              className="press"
              onClick={() => setMode('review')}
            >
              Review Answers
            </button>
            <button
              style={{
                flex: '1 1 160px',
                padding: 13,
                borderRadius: 12,
                border: '1px solid var(--bd)',
                background: 'var(--bg-soft)',
                color: 'var(--fg)',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
              }}
              onClick={() => {
                // Reset all state for a clean retake in a brand-new attempt
                startNewAttempt()
                setAnswers({})
                setFlagged({})
                setCurrent(0)
                currentRef.current = 0
                answersRef.current = {}
                flaggedRef.current = {}
                setSecondsElapsed(0)
                secondsRef.current = 0
                setFinalTimeTaken(0)
                setSaveError(false)
                setMode('play')
              }}
            >
              Retake
            </button>
            <button
              style={{
                flex: '1 1 160px',
                padding: 13,
                borderRadius: 12,
                border: '1px solid var(--bd)',
                background: 'transparent',
                color: 'var(--fg-muted)',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
              }}
              onClick={() => window.location.replace(prepPath)}
            >
              Exit
            </button>
          </div>
        </main>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // REVIEW MODE
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        color: 'var(--fg)',
        fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
      }}
    >
      <style>{sharedCSS}</style>
      {Header}
      <main
        style={{
          maxWidth: 1180,
          margin: '0 auto',
          padding: '32px 24px 80px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        {questions.map((q, i) => {
          const opts = buildOptions(q, q.correct_answer, false)
          const imgUrl = q.question_images?.[0]?.image_url
          const stats = q.question_statistics?.[0]
          const correctPct =
            stats && stats.attempts > 0
              ? Math.round((stats.correct_answers / stats.attempts) * 100)
              : null

          return (
            <div
              key={q.id}
              className="a-rise"
              style={{
                ...stagger(Math.min(i, 8)),
                background: 'var(--bg-elev)',
                border: '1px solid var(--bd)',
                borderRadius: 18,
                padding: 24,
                boxShadow: '0 1px 3px var(--shadow)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 16,
                  flexWrap: 'wrap',
                }}
              >
                <span
                  style={{
                    width: 26, height: 26, borderRadius: 8,
                    background: 'var(--primary-soft)', color: 'var(--primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12.5, fontWeight: 800, flexShrink: 0,
                  }}
                >
                  {i + 1}
                </span>
                {q.chapter?.name && (
                  <span
                    style={{
                      padding: '4px 10px', borderRadius: 999,
                      background: 'color-mix(in srgb, var(--accent-blue) 15%, var(--bg-soft))',
                      color: 'var(--accent-blue)', fontSize: 12, fontWeight: 700,
                    }}
                  >
                    {q.chapter?.name}
                  </span>
                )}
                {q.lecture?.name && (
                  <span
                    style={{
                      padding: '4px 10px', borderRadius: 999,
                      background: 'var(--bg-soft)', color: 'var(--fg-muted)',
                      fontSize: 12, fontWeight: 700,
                    }}
                  >
                    {q.lecture?.name}
                  </span>
                )}
                {correctPct !== null && (
                  <span
                    style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--fg-muted)', fontWeight: 600 }}
                  >
                    {correctPct}% correct
                  </span>
                )}
              </div>

              <div
                style={{
                  fontSize: 17, fontWeight: 700, color: 'var(--fg)',
                  lineHeight: 1.6, marginBottom: 16,
                }}
              >
                {q.question_text}
              </div>

              {imgUrl && (
                <div
                  style={{
                    marginBottom: 14, borderRadius: 12, overflow: 'hidden',
                    border: '1px solid var(--bd)',
                  }}
                >
                  <img
                    src={imgUrl}
                    alt="Question"
                    style={{ width: '100%', maxHeight: 300, objectFit: 'contain', display: 'block' }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {opts.map(opt => (
                  <div key={opt.key}>
                    <div style={opt.rowStyle}>
                      <span style={opt.badgeStyle}>{opt.badgeContent}</span>
                      <span style={{ flex: '1 1 auto', fontSize: 15, fontWeight: 600 }}>
                        {opt.text}
                      </span>
                    </div>
                    {opt.note && !opt.isCorrect && (
                      <div
                        style={{
                          margin: '4px 2px 0 42px', fontSize: 12.5,
                          fontWeight: 600, color: 'var(--fg-muted)',
                        }}
                      >
                        {opt.note}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {q.explanation && (
                <div style={{ marginTop: 14 }}>
                  <ExplanationRenderer content={q.explanation} />
                </div>
              )}
            </div>
          )
        })}

        <button
          style={{
            padding: 14, borderRadius: 12, border: 'none',
            background: 'var(--primary)', color: 'white',
            fontWeight: 700, fontSize: 14, cursor: 'pointer',
          }}
          onClick={() => setMode('result')}
        >
          Back to Results
        </button>
      </main>
    </div>
  )
}