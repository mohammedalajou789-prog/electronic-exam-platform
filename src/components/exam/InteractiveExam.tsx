'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Flag, Bookmark, ChevronLeft, ChevronRight, Grid3X3, X, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import ReportButton from '@/components/exam/ReportButton'

interface Question {
  id: string
  question_text: string
  question_order: number
  choice_a: string
  choice_b: string
  choice_c: string
  choice_d: string
  choice_e: string | null
  correct_answer: string
  explanation: string | null
  incorrect_explanation_a: string | null
  incorrect_explanation_b: string | null
  incorrect_explanation_c: string | null
  incorrect_explanation_d: string | null
  chapter: string | null
  lecture: string | null
  question_statistics: Array<{
    attempts: number
    correct_answers: number
    average_time: number
  }> | null
}

interface Exam {
  id: string
  title: string
  question_count: number
}

interface SavedProgress {
  current_question: number
  answers_json: Record<string, string>
  remaining_time: number | null
}

interface Props {
  exam: Exam
  questions: Question[]
  savedProgress?: SavedProgress | null
}

export default function InteractiveExam({ exam, questions, savedProgress }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [currentIndex, setCurrentIndex] = useState(
    savedProgress?.current_question ?? 0
  )
  const [answers, setAnswers] = useState<Record<string, string>>(
    savedProgress?.answers_json ?? {}
  )
  const [flags, setFlags] = useState<Set<string>>(new Set())
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set())
  const [showAnswer, setShowAnswer] = useState<Record<string, boolean>>({})
  const [showNavigator, setShowNavigator] = useState(false)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [isFinished, setIsFinished] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id || null))
  }, [])

  // Auto-save كل 30 ثانية
  useEffect(() => {
    if (!userId || isFinished) return
    const interval = setInterval(async () => {
      await fetch('/api/exam-results/save-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          examId: exam.id,
          currentQuestion: currentIndex,
          answers,
          timeSpent: elapsedTime,
        }),
      })
    }, 30000)
    return () => clearInterval(interval)
  }, [userId, isFinished, currentIndex, answers, elapsedTime])

  const currentQuestion = questions[currentIndex]
  const totalQuestions = questions.length
  const suggestedTime = totalQuestions * 60

  useEffect(() => {
    if (isFinished) return
    const interval = setInterval(() => setElapsedTime(prev => prev + 1), 1000)
    return () => clearInterval(interval)
  }, [isFinished])

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  function handleAnswer(letter: string) {
    if (answers[currentQuestion.id]) return
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: letter }))
    setShowAnswer(prev => ({ ...prev, [currentQuestion.id]: true }))
  }

  function toggleFlag(id: string) {
    setFlags(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleBookmark(id: string) {
    setBookmarks(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleFinish() {
    setIsFinished(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      await fetch('/api/exam-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examId: exam.id,
          answers,
          timeSpent: elapsedTime,
          userId: user?.id || null,
        }),
      })
    } catch (error) {
      console.error('Failed to save results:', error)
    }

    const resultsPath = window.location.pathname.replace('/play', '/results')
    router.push(`${resultsPath}?time=${elapsedTime}&answers=${encodeURIComponent(JSON.stringify(answers))}&questions=${encodeURIComponent(JSON.stringify(questions))}`)
  }

  if (!currentQuestion) return null

  const userAnswer = answers[currentQuestion.id]
  const isAnswered = Boolean(userAnswer)
  const revealed = showAnswer[currentQuestion.id]
  const answeredCount = Object.keys(answers).length
  const isOverTime = elapsedTime > suggestedTime

  const choices = [
    { letter: 'a', text: currentQuestion.choice_a },
    { letter: 'b', text: currentQuestion.choice_b },
    { letter: 'c', text: currentQuestion.choice_c },
    { letter: 'd', text: currentQuestion.choice_d },
    ...(currentQuestion.choice_e ? [{ letter: 'e', text: currentQuestion.choice_e }] : []),
  ]

  const stats = currentQuestion.question_statistics?.[0]
  const correctPercent = stats && stats.attempts > 0
    ? Math.round((stats.correct_answers / stats.attempts) * 100)
    : null

  return (
    <div className="flex h-screen flex-col bg-background">

      {/* Header */}
      <header className="flex items-center justify-between border-b border-border/60 bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => setShowExitConfirm(true)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
          <div>
            <p className="text-sm font-semibold">{exam.title}</p>
            <p className="text-xs text-muted-foreground">Question {currentIndex + 1} of {totalQuestions}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-mono font-medium ${isOverTime ? 'bg-red-50 text-red-600' : 'bg-muted text-foreground'}`}>
            <Clock className="h-4 w-4" />
            {formatTime(elapsedTime)}
          </div>
          <button onClick={() => setShowNavigator(true)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
            <Grid3X3 className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="h-1 bg-muted">
        <div className="h-full bg-primary transition-all duration-300" style={{ width: `${(answeredCount / totalQuestions) * 100}%` }} />
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-2xl space-y-6">

          {(currentQuestion.chapter || currentQuestion.lecture) && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {currentQuestion.chapter && <span className="rounded-full bg-primary/10 px-2 py-1 text-primary">{currentQuestion.chapter}</span>}
              {currentQuestion.lecture && <span>{currentQuestion.lecture}</span>}
            </div>
          )}

          <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm">
            <p className="text-base font-medium leading-relaxed">{currentQuestion.question_text}</p>
          </div>

          <div className="space-y-3">
            {choices.map(({ letter, text }) => {
              const isCorrect = currentQuestion.correct_answer === letter
              const isSelected = userAnswer === letter
              const wrongExpl = (currentQuestion as any)[`incorrect_explanation_${letter}`]

              let choiceStyle = 'border-border/60 bg-card hover:border-primary/50 hover:bg-muted/30 cursor-pointer'
              if (revealed) {
                if (isCorrect) choiceStyle = 'border-green-400 bg-green-50 text-green-800'
                else if (isSelected && !isCorrect) choiceStyle = 'border-red-400 bg-red-50 text-red-800'
                else choiceStyle = 'border-border/40 bg-muted/20 opacity-60'
              } else if (isSelected) {
                choiceStyle = 'border-primary bg-primary/5'
              }

              return (
                <div key={letter}>
                  <button
                    onClick={() => handleAnswer(letter)}
                    disabled={isAnswered}
                    className={`w-full rounded-xl border p-4 text-left transition-all ${choiceStyle}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold uppercase ${
                        revealed && isCorrect ? 'border-green-500 bg-green-500 text-white' :
                        revealed && isSelected && !isCorrect ? 'border-red-500 bg-red-500 text-white' :
                        'border-current'
                      }`}>
                        {letter}
                      </span>
                      <span className="text-sm leading-relaxed">{text}</span>
                    </div>
                  </button>
                  {revealed && !isCorrect && isSelected && wrongExpl && (
                    <div className="mt-1 rounded-lg bg-red-50 px-4 py-2 text-xs text-red-700">{wrongExpl}</div>
                  )}
                </div>
              )
            })}
          </div>

          {revealed && currentQuestion.explanation && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4">
              <p className="mb-1 text-xs font-semibold uppercase text-green-700">Explanation</p>
              <p className="text-sm text-green-800">{currentQuestion.explanation}</p>
            </div>
          )}

          {revealed && correctPercent !== null && (
            <div className="rounded-xl border border-border/60 bg-muted/30 p-4 text-center">
              <p className="text-xs text-muted-foreground">
                {correctPercent}% of students answered this correctly
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/60 bg-card px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleFlag(currentQuestion.id)}
              className={`rounded-lg p-2 transition-colors ${flags.has(currentQuestion.id) ? 'text-orange-500' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Flag className="h-5 w-5" />
            </button>
            <button
              onClick={() => toggleBookmark(currentQuestion.id)}
              className={`rounded-lg p-2 transition-colors ${bookmarks.has(currentQuestion.id) ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Bookmark className="h-5 w-5" />
            </button>
            <ReportButton questionId={currentQuestion.id} />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="flex items-center gap-1 rounded-lg border border-border/60 px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </button>
            {currentIndex === totalQuestions - 1 ? (
              <button onClick={handleFinish} className="rounded-lg bg-black px-5 py-2 text-sm font-medium text-white hover:bg-gray-800">
                Finish Exam
              </button>
            ) : (
              <button
                onClick={() => setCurrentIndex(prev => Math.min(totalQuestions - 1, prev + 1))}
                className="flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* Question Navigator */}
      {showNavigator && (
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/40 sm:items-start sm:pt-16 sm:pr-4">
          <div className="w-full max-w-xs rounded-t-2xl sm:rounded-2xl border border-border/60 bg-card p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">Question Navigator</h3>
              <button onClick={() => setShowNavigator(false)}><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <div className="grid grid-cols-6 gap-2">
              {questions.map((q, i) => (
                <button
                  key={q.id}
                  onClick={() => { setCurrentIndex(i); setShowNavigator(false) }}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg text-xs font-medium transition-colors ${
                    i === currentIndex ? 'bg-primary text-primary-foreground' :
                    flags.has(q.id) ? 'bg-orange-100 text-orange-700 border border-orange-300' :
                    answers[q.id] ? 'bg-green-100 text-green-700' :
                    'bg-muted text-muted-foreground'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-green-100" />Answered</span>
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-orange-100" />Flagged</span>
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-muted" />Unanswered</span>
            </div>
          </div>
        </div>
      )}

      {/* Exit Confirm */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-card p-6 shadow-xl">
            <h3 className="mb-2 font-semibold">Exit Exam?</h3>
            <p className="mb-4 text-sm text-muted-foreground">Your progress will not be saved. Are you sure?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowExitConfirm(false)} className="flex-1 rounded-lg border border-border/60 py-2 text-sm font-medium hover:bg-muted">
                Continue Exam
              </button>
              <button onClick={() => router.back()} className="flex-1 rounded-lg bg-black py-2 text-sm font-medium text-white hover:bg-gray-800">
                Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}