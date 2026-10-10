// src/features/exam-engine/attempt-client.ts
//
// The only place where the exam screen talks to the attempt functions
// in the database (start, record answer, save progress, finish).
//
// All grading happens in the database. The browser only sends what the
// student chose; it never decides whether an answer is correct.
//
// The attempt itself keeps the student's progress (time, position, questions
// seen and flagged), so "Continue" restores exactly what the database holds.

import { createClient } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

/** Exactly one of the two ids is set. */
export interface ExamTarget {
  examId: string | null
  customExamId: string | null
}

export interface AnswerPayload {
  questionId: string
  chosenAnswer: string | null
  timeSeconds: number
  isFlagged: boolean
  isBookmarked: boolean
  /** True if the question was shown on screen (separates "skipped" from "not reached"). */
  wasViewed: boolean
}

/** Progress of an open attempt, saved every 30 seconds and when leaving. */
export interface AttemptProgress {
  elapsedSeconds: number
  currentIndex: number
  /** Questions shown on screen (they become "skipped" if unanswered on Finish). */
  viewedIds: string[]
  flaggedIds: string[]
}

export interface AttemptSummary {
  attemptId: string
  total: number
  correct: number
  incorrect: number
  /** Seen but not answered. */
  skipped: number
  /** Never shown on screen. */
  notSeen: number
  percentage: number
  timeSpentSeconds: number
  /** Questions of this exam never answered in any attempt (null for custom exams). */
  examUnanswered: number | null
}

/** Shape of the JSON returned by finish_exam_attempt. */
interface FinishResponse {
  attempt_id: string
  total: number
  correct: number
  incorrect: number
  skipped: number
  not_seen: number
  percentage: number
  time_spent: number
  exam_unanswered: number | null
}

// ── Retry helper ──────────────────────────────────────────────────────────────

const MAX_TRIES = 3
const RETRY_BASE_DELAY_MS = 800

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** Runs an operation up to 3 times, waiting 0.8s then 1.6s between tries. */
async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown = null
  for (let tryNumber = 0; tryNumber < MAX_TRIES; tryNumber++) {
    try {
      return await operation()
    } catch (err) {
      lastError = err
      if (tryNumber < MAX_TRIES - 1) {
        await wait(RETRY_BASE_DELAY_MS * 2 ** tryNumber)
      }
    }
  }
  throw lastError
}

function toSeconds(value: number): number {
  return Math.max(0, Math.round(value))
}

// ── Public functions ─────────────────────────────────────────────────────────

/**
 * Opens an attempt when the exam screen loads.
 * Returns the attempt id, or null for guests (they have no personal history).
 * When `resume` is true, the student's open attempt for this exam is reused.
 * `questionIds` limits a new attempt to part of a regular exam
 * (e.g. the unanswered questions only); null means the whole exam.
 */
export async function startAttempt(
  target: ExamTarget,
  resume: boolean,
  questionIds: string[] | null = null
): Promise<string | null> {
  const supabase = createClient()
  return withRetry(async () => {
    const { data, error } = await supabase.rpc('start_exam_attempt', {
      p_exam_id: target.examId,
      p_custom_exam_id: target.customExamId,
      p_resume: resume,
      p_question_ids: questionIds,
    })
    if (error) throw new Error(error.message)
    return (data as string | null) ?? null
  })
}

/**
 * Saves one answer the moment the student picks it.
 * Pass attemptId = null for guests (only community statistics are updated).
 * Returns false if it could not be saved; the answer is sent again on Finish.
 */
export async function recordAnswer(
  attemptId: string | null,
  questionId: string,
  chosenAnswer: string,
  timeSeconds: number
): Promise<boolean> {
  const supabase = createClient()
  try {
    await withRetry(async () => {
      const { error } = await supabase.rpc('record_answer', {
        p_question_id: questionId,
        p_chosen_answer: chosenAnswer,
        p_time_seconds: toSeconds(timeSeconds),
        p_attempt_id: attemptId,
      })
      if (error) throw new Error(error.message)
    })
    return true
  } catch (err) {
    console.error('recordAnswer failed:', err)
    return false
  }
}

/**
 * Saves the progress of an open attempt (called by the auto-save).
 * Time only moves forward and "viewed" only grows, so a late or repeated
 * call can never undo newer progress. Failures are ignored: the next call
 * sends the newer values anyway.
 */
export async function saveAttemptProgress(attemptId: string, progress: AttemptProgress): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.rpc('save_attempt_progress', {
    p_attempt_id: attemptId,
    p_time_seconds: toSeconds(progress.elapsedSeconds),
    p_current_index: Math.max(0, Math.round(progress.currentIndex)),
    p_viewed_ids: progress.viewedIds,
    p_flagged_ids: progress.flaggedIds,
  })
  if (error) console.error('saveAttemptProgress failed:', error.message)
}

/**
 * Same as saveAttemptProgress, but for the moment the page is closing
 * (tab closed, refresh, browser Back). sendBeacon is delivered even after
 * the page unloads; the server identifies the student from the session cookie.
 */
export function sendAttemptProgressBeacon(attemptId: string, progress: AttemptProgress): void {
  const payload = JSON.stringify({
    attempt_id: attemptId,
    elapsed_seconds: toSeconds(progress.elapsedSeconds),
    current_index: Math.max(0, Math.round(progress.currentIndex)),
    viewed_ids: progress.viewedIds,
    flagged_ids: progress.flaggedIds,
  })
  navigator.sendBeacon('/api/save-progress', new Blob([payload], { type: 'application/json' }))
}

/**
 * Closes the attempt when the student presses Finish.
 * Sends every answer again as a safety net (already-saved answers are ignored).
 * Throws if saving fails, so the screen can offer a Retry button.
 */
export async function finishAttempt(
  attemptId: string,
  answers: AnswerPayload[],
  totalTimeSeconds: number
): Promise<AttemptSummary> {
  const supabase = createClient()
  const payload = answers.map(answer => ({
    question_id: answer.questionId,
    chosen_answer: answer.chosenAnswer,
    time_seconds: toSeconds(answer.timeSeconds),
    is_flagged: answer.isFlagged,
    is_bookmarked: answer.isBookmarked,
    was_viewed: answer.wasViewed,
  }))

  const result = await withRetry(async () => {
    const { data, error } = await supabase.rpc('finish_exam_attempt', {
      p_attempt_id: attemptId,
      p_answers: payload,
      p_total_time_seconds: toSeconds(totalTimeSeconds),
    })
    if (error || !data) throw new Error(error?.message ?? 'No result returned')
    return data as FinishResponse
  })

  return {
    attemptId: result.attempt_id,
    total: result.total,
    correct: result.correct,
    incorrect: result.incorrect,
    skipped: result.skipped,
    notSeen: result.not_seen,
    percentage: result.percentage,
    timeSpentSeconds: result.time_spent,
    examUnanswered: result.exam_unanswered ?? null,
  }
}