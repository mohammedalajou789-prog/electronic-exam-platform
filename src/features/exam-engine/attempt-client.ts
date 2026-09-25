// src/features/exam-engine/attempt-client.ts
//
// The only place where the exam screen talks to the attempt functions
// in the database (start, record answer, update time, finish, abandon).
//
// All grading happens in the database. The browser only sends what the
// student chose; it never decides whether an answer is correct.

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

export interface AttemptSummary {
  attemptId: string
  total: number
  correct: number
  incorrect: number
  skipped: number
  percentage: number
  timeSpentSeconds: number
}

/** Shape of the JSON returned by finish_exam_attempt. */
interface FinishResponse {
  attempt_id: string
  total: number
  correct: number
  incorrect: number
  skipped: number
  percentage: number
  time_spent: number
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
 */
export async function startAttempt(target: ExamTarget, resume: boolean): Promise<string | null> {
  const supabase = createClient()
  return withRetry(async () => {
    const { data, error } = await supabase.rpc('start_exam_attempt', {
      p_exam_id: target.examId,
      p_custom_exam_id: target.customExamId,
      p_resume: resume,
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
 * Updates the study time of an open attempt (called with the auto-save).
 * Failures are ignored: the next call sends the newer, larger value anyway.
 */
export async function updateAttemptTime(attemptId: string, elapsedSeconds: number): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.rpc('update_attempt_time', {
    p_attempt_id: attemptId,
    p_time_seconds: toSeconds(elapsedSeconds),
  })
  if (error) console.error('updateAttemptTime failed:', error.message)
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
    percentage: result.percentage,
    timeSpentSeconds: result.time_spent,
  }
}

/**
 * Marks the open attempt as abandoned ("End Session").
 * Answers already given still count in the student's statistics.
 */
export async function abandonAttempt(target: ExamTarget): Promise<void> {
  const supabase = createClient()
  await withRetry(async () => {
    const { error } = await supabase.rpc('abandon_exam_attempt', {
      p_exam_id: target.examId,
      p_custom_exam_id: target.customExamId,
    })
    if (error) throw new Error(error.message)
  })
}