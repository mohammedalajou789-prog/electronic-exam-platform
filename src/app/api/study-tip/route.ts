// src/app/api/study-tip/route.ts
//
// Refreshes the study tip of the signed-in student for the subject of one exam.
// The exam screen calls it with fetch(..., { keepalive: true }) when the student
// finishes an exam or leaves it with "Continue Later" (see refreshTipInBackground
// in src/components/exam/InteractiveExam.tsx).
//
// It is a route and not a Server Action on purpose: the router waits for a pending
// Server Action before it changes page, and the student should never wait for this.
//
// The student is identified from their session cookies inside refreshStudyTip,
// never from the request body. The body only names the exam.

import { NextRequest, NextResponse } from 'next/server'
import { refreshStudyTip } from '@/app/actions/compute-study-tip'
import { isUuid } from '@/lib/uuid'

const MAX_BODY_BYTES = 1_000

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const rawBody = await req.text()
    if (rawBody.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Request too large' }, { status: 413 })
    }

    const body = JSON.parse(rawBody) as { examId?: unknown }
    const examId = body.examId
    if (typeof examId !== 'string' || !isUuid(examId)) {
      return NextResponse.json({ error: 'Invalid exam id' }, { status: 400 })
    }

    // Does nothing for guests (no session)
    await refreshStudyTip(examId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[study-tip] error:', err)
    return NextResponse.json({ error: 'Could not update the study tip' }, { status: 500 })
  }
}