// src/app/api/save-progress/route.ts
//
// Called by navigator.sendBeacon() when the student closes the tab
// or presses the browser Back button during an exam.
//
// sendBeacon sends the session cookies for same-origin requests,
// so the student is identified from their session — never from the request body.

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_BODY_BYTES = 200_000

interface ProgressPayload {
  exam_id?: unknown
  current_question?: unknown
  answers_json?: unknown
  flags_json?: unknown
  elapsed_seconds?: unknown
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every(v => typeof v === 'string')
  )
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(v => typeof v === 'string')
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
    }

    const rawBody = await req.text()
    if (rawBody.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Request too large' }, { status: 413 })
    }

    const body = JSON.parse(rawBody) as ProgressPayload

    const examId = body.exam_id
    const currentQuestion = body.current_question ?? 0
    const answers = body.answers_json ?? {}
    const flags = body.flags_json ?? []
    const elapsedSeconds = body.elapsed_seconds ?? 0

    if (
      typeof examId !== 'string' || !UUID_PATTERN.test(examId) ||
      !isNonNegativeInteger(currentQuestion) ||
      !isStringRecord(answers) ||
      !isStringArray(flags) ||
      !isNonNegativeInteger(elapsedSeconds)
    ) {
      return NextResponse.json({ error: 'Invalid progress data' }, { status: 400 })
    }

    // Row Level Security guarantees a student can only write their own row
    const { error } = await supabase.from('study_progress').upsert(
      {
        user_id: user.id,
        exam_id: examId,
        current_question: currentQuestion,
        answers_json: answers,
        flags_json: flags,
        elapsed_seconds: elapsedSeconds,
        completed: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,exam_id' }
    )

    if (error) {
      console.error('[save-progress] database error:', error)
      return NextResponse.json({ error: 'Could not save progress' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[save-progress] error:', err)
    return NextResponse.json({ error: 'Could not save progress' }, { status: 500 })
  }
}