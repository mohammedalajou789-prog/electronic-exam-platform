'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'

export interface QuestionResult {
  questionId: string
  selectedAnswer: string | null   // null = skipped
  correctAnswer: string
  timeSpentSeconds: number
}

export interface SaveExamResultsInput {
  examId: string
  results: QuestionResult[]
  totalTimeSeconds: number
}

export interface SaveExamResultsOutput {
  success: boolean
  score: number           // number of correct answers
  total: number           // total questions
  percentage: number      // 0–100
  error?: string
}

export async function saveExamResults(
  input: SaveExamResultsInput
): Promise<SaveExamResultsOutput> {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()

  const correct = input.results.filter(
    (r) => r.selectedAnswer === r.correctAnswer
  ).length
  const skipped = input.results.filter((r) => r.selectedAnswer === null).length
  const incorrect = input.results.length - correct - skipped
  const total = input.results.length
  const percentage = total > 0 ? Math.round((correct / total) * 100) : 0

  // ── 1. Update question_statistics for every question ──────────────────────
  for (const result of input.results) {
    if (result.selectedAnswer === null) continue // skip unanswered questions

    const isCorrect = result.selectedAnswer === result.correctAnswer

    // Use a raw RPC call to safely increment the counters
    const { error } = await supabase.rpc('increment_question_stats', {
      p_question_id: result.questionId,
      p_is_correct: isCorrect,
      p_time_seconds: result.timeSpentSeconds,
    })

    if (error) {
      console.error('Failed to update question stats:', error)
    }
  }

  // ── 2. Update user_statistics (only for logged-in students) ───────────────
  if (user) {
    const { error } = await supabase.rpc('increment_user_stats', {
      p_user_id: user.id,
      p_questions_answered: total - skipped,
      p_correct: correct,
      p_incorrect: incorrect,
      p_study_time_minutes: Math.round(input.totalTimeSeconds / 60),
    })

    if (error) {
      console.error('Failed to update user stats:', error)
    }

    // Mark exam as completed in study_progress
    await supabase
      .from('study_progress')
      .update({ completed: true, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('exam_id', input.examId)
  }

  return { success: true, score: correct, total, percentage }
}