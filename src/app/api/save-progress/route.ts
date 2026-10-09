// src/app/api/save-progress/route.ts
//
// Called by navigator.sendBeacon() when the student closes the tab, refreshes
// or presses the browser Back button during an exam (see sendAttemptProgressBeacon
// in src/features/exam-engine/attempt-client.ts).
//
// It saves the progress of the open attempt: time, position, questions seen and
// flagged. Answers are not sent here: each one is saved the moment it is picked.
//
// sendBeacon sends the session cookies for same-origin requests, so the student
// is identified from their session, never from the request body. The database
// function only touches the student's own open attempt.

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isUuid } from '@/lib/uuid'

const MAX_BODY_BYTES = 200_000
const MAX_IDS = 1000

interface ProgressPayload {
  attempt_id?: unknown
  elapsed_seconds?: unknown
  current_index?: unknown
  viewed_ids?: unknown
  flagged_ids?: unknown
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

function isUuidList(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= MAX_IDS && value.every(v => typeof v === 'string' && isUuid(v))
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: claimsData } = await supabase.auth.getClaims()
    if (!claimsData?.claims?.sub) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
    }

    const rawBody = await req.text()
    if (rawBody.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Request too large' }, { status: 413 })
    }

    const body = JSON.parse(rawBody) as ProgressPayload
    const attemptId = body.attempt_id
    const elapsedSeconds = body.elapsed_seconds ?? 0
    const currentIndex = body.current_index ?? 0
    const viewedIds = body.viewed_ids ?? []
    const flaggedIds = body.flagged_ids ?? []

    if (
      typeof attemptId !== 'string' || !isUuid(attemptId) ||
      !isNonNegativeInteger(elapsedSeconds) ||
      !isNonNegativeInteger(currentIndex) ||
      !isUuidList(viewedIds) ||
      !isUuidList(flaggedIds)
    ) {
      return NextResponse.json({ error: 'Invalid progress data' }, { status: 400 })
    }

    const { error } = await supabase.rpc('save_attempt_progress', {
      p_attempt_id: attemptId,
      p_time_seconds: elapsedSeconds,
      p_current_index: currentIndex,
      p_viewed_ids: viewedIds,
      p_flagged_ids: flaggedIds,
    })

    if (error) {
      console.error('[save-progress] database error:', error.message)
      return NextResponse.json({ error: 'Could not save progress' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[save-progress] error:', err)
    return NextResponse.json({ error: 'Could not save progress' }, { status: 500 })
  }
}