export const runtime = 'nodejs'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, examId, currentQuestion, answers, timeSpent } = body

    if (!userId || !examId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    await adminSupabase
      .from('study_progress')
      .upsert({
        user_id: userId,
        exam_id: examId,
        current_question: currentQuestion,
        remaining_time: timeSpent,
        answers_json: answers,
        completed: false,
        updated_at: new Date().toISOString(),
      })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving progress:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
