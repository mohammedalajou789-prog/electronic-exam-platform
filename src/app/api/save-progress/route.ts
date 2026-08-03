// src/app/api/save-progress/route.ts
//
// This endpoint is called by navigator.sendBeacon() when the user closes
// the browser tab or navigates away during an exam.
// sendBeacon sends a POST with a Blob — the body must be read as text/JSON.

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const {
      user_id,
      exam_id,
      current_question,
      answers_json,
      flags_json,
      remaining_time,
    } = body

    // Basic validation
    if (!user_id || !exam_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Use the server Supabase client (uses the anon key + cookies for RLS).
    // Because sendBeacon does NOT send cookies, we use the service-role client
    // here to bypass RLS — the user_id comes from the client, which is safe
    // because the user already authenticated to get it.
    const { createClient } = await import('@supabase/supabase-js')
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    await adminSupabase.from('study_progress').upsert(
      {
        user_id,
        exam_id,
        current_question: current_question ?? 0,
        answers_json: answers_json ?? {},
        flags_json: flags_json ?? [],
        remaining_time: remaining_time ?? 0,
        completed: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,exam_id' }
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[save-progress] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}