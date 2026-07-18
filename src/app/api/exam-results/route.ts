export const runtime = 'nodejs'
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { examId, answers, timeSpent } = body

    if (!examId || !answers) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Get all questions for this exam
    const { data: questions } = await supabase
      .from('questions')
      .select('id, correct_answer')
      .eq('exam_id', examId)
      .is('deleted_at', null)

    if (!questions) {
      return NextResponse.json({ error: 'Questions not found' }, { status: 404 })
    }

    let correctCount = 0
    let incorrectCount = 0
    const answeredQuestions = Object.keys(answers)
    const wrongQuestionIds: string[] = []

    for (const question of questions) {
      const userAnswer = answers[question.id]
      if (!userAnswer) continue

      const isCorrect = userAnswer === question.correct_answer
      if (isCorrect) {
        correctCount++
      } else {
        incorrectCount++
        wrongQuestionIds.push(question.id)
      }

      // Update question_statistics
      const { data: existingStats } = await supabase
        .from('question_statistics')
        .select('*')
        .eq('question_id', question.id)
        .single()

      if (existingStats) {
        await supabase
          .from('question_statistics')
          .update({
            attempts: existingStats.attempts + 1,
            correct_answers: existingStats.correct_answers + (isCorrect ? 1 : 0),
            last_updated: new Date().toISOString(),
          })
          .eq('question_id', question.id)
      } else {
        await supabase
          .from('question_statistics')
          .insert({
            question_id: question.id,
            attempts: 1,
            correct_answers: isCorrect ? 1 : 0,
          })
      }
    }

    // Update user-specific data for logged-in students
    if (user) {
      // Update user_statistics
      const { data: existingUserStats } = await supabase
        .from('user_statistics')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (existingUserStats) {
        await supabase
          .from('user_statistics')
          .update({
            questions_answered: existingUserStats.questions_answered + answeredQuestions.length,
            correct_answers: existingUserStats.correct_answers + correctCount,
            incorrect_answers: existingUserStats.incorrect_answers + incorrectCount,
            study_time: existingUserStats.study_time + Math.floor(timeSpent / 60),
            completed_exams: existingUserStats.completed_exams + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)
      } else {
        await supabase
          .from('user_statistics')
          .insert({
            user_id: user.id,
            questions_answered: answeredQuestions.length,
            correct_answers: correctCount,
            incorrect_answers: incorrectCount,
            study_time: Math.floor(timeSpent / 60),
            completed_exams: 1,
          })
      }

      // Save wrong answers (upsert so retaking an exam doesn't duplicate)
      if (wrongQuestionIds.length > 0) {
        await supabase
          .from('wrong_answers')
          .upsert(
            wrongQuestionIds.map(questionId => ({
              user_id: user.id,
              question_id: questionId,
              exam_id: examId,
            })),
            { onConflict: 'user_id,question_id' }
          )
      }

      // Remove from wrong_answers if student now answered correctly
      const correctQuestionIds = questions
        .filter(q => answers[q.id] === q.correct_answer)
        .map(q => q.id)

      if (correctQuestionIds.length > 0) {
        await supabase
          .from('wrong_answers')
          .delete()
          .eq('user_id', user.id)
          .in('question_id', correctQuestionIds)
      }

      // Mark exam as completed in study_progress
      await supabase
        .from('study_progress')
        .upsert({
          user_id: user.id,
          exam_id: examId,
          completed: true,
          updated_at: new Date().toISOString(),
        })
    }

    return NextResponse.json({
      success: true,
      correct: correctCount,
      incorrect: incorrectCount,
      total: questions.length,
    })

  } catch (error) {
    console.error('Error saving exam results:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
