'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'

export interface QuestionResult {
  questionId: string
  selectedAnswer: string | null
  correctAnswer: string
  isBookmarked: boolean
  isFlagged: boolean
}

export interface SaveExamResultsInput {
  examId: string
  results: QuestionResult[]
  totalTimeSeconds: number
}

export interface SaveExamResultsOutput {
  success: boolean
  attemptId: string | null
  score: number
  total: number
  percentage: number
  error?: string
}

export async function saveExamResults(
  input: SaveExamResultsInput
): Promise<SaveExamResultsOutput> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const correct  = input.results.filter(r => r.selectedAnswer === r.correctAnswer).length
  const skipped  = input.results.filter(r => r.selectedAnswer === null).length
  const incorrect = input.results.length - correct - skipped
  const total    = input.results.length
  const percentage = total > 0 ? Math.round((correct / total) * 100) : 0

  // ── 1. Update question_statistics for every answered question ──────────────
  for (const result of input.results) {
    if (result.selectedAnswer === null) continue

    const isCorrect = result.selectedAnswer === result.correctAnswer

    const { error } = await supabase.rpc('increment_question_stats', {
      p_question_id: result.questionId,
      p_is_correct: isCorrect,
      p_time_seconds: 0,
    })

    if (error) {
      console.error('Failed to update question stats:', error)
    }
  }

  // ── 2. Save attempt + answers + wrong_answers (only for logged-in users) ───
  let attemptId: string | null = null

  if (user) {

    // 2a. Create the exam_attempt row
    const { data: attempt, error: attemptError } = await supabase
      .from('exam_attempts')
      .insert({
        user_id: user.id,
        exam_id: input.examId,
        score: percentage,
        total_questions: total,
        correct_count: correct,
        incorrect_count: incorrect,
        skipped_count: skipped,
        time_spent: input.totalTimeSeconds,
      })
      .select('id')
      .single()

    if (attemptError || !attempt) {
      console.error('Failed to create exam attempt:', attemptError)
    } else {
      attemptId = attempt.id

      // 2b. Save every answer inside attempt_answers
      const answerRows = input.results.map(r => ({
        attempt_id: attempt.id,
        question_id: r.questionId,
        chosen_answer: r.selectedAnswer,
        is_correct: r.selectedAnswer === r.correctAnswer,
        is_flagged: r.isFlagged,
        is_bookmarked: r.isBookmarked,
      }))

      const { error: answersError } = await supabase
        .from('attempt_answers')
        .insert(answerRows)

      if (answersError) {
        console.error('Failed to save attempt answers:', answersError)
      }

      // 2c. Save wrong answers into wrong_answers table
      const wrongResults = input.results.filter(
        r => r.selectedAnswer !== null && r.selectedAnswer !== r.correctAnswer
      )

      if (wrongResults.length > 0) {
        const wrongRows = wrongResults.map(result => ({
          user_id: user.id,
          question_id: result.questionId,
          exam_id: input.examId,
        }))

        const { error: wrongError } = await supabase
          .from('wrong_answers')
          .upsert(wrongRows, { onConflict: 'user_id,question_id' })

        if (wrongError) {
          console.error('Failed to save wrong answers:', wrongError)
        }
      }

      // 2d. Update user_statistics
      const { error: statsError } = await supabase.rpc('increment_user_stats', {
        p_user_id: user.id,
        p_questions_answered: total - skipped,
        p_correct: correct,
        p_incorrect: incorrect,
        p_study_time_minutes: Math.round(input.totalTimeSeconds / 60),
      })

      if (statsError) {
        console.error('Failed to update user stats:', statsError)
      }

      // 2e. Delete study_progress — exam is fully completed
      await supabase
        .from('study_progress')
        .delete()
        .eq('user_id', user.id)
        .eq('exam_id', input.examId)
    }
  }

  return { success: true, attemptId, score: correct, total, percentage }
}