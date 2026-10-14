// src/app/api/admin/images/reorder/route.ts
//
// Sets the order of a question's images (slot 'question' only; explanation images keep
// their slot number).
//
// POST { questionId, orderedIds } -> { ok: true }
// orderedIds must list every question image of that question exactly once.
//
// Admins only: src/proxy.ts protects /api/admin/*, and the route checks again.

import { NextRequest, NextResponse } from 'next/server'
import { getAdminRole } from '@/lib/auth/requireSuperAdmin'
import { adminSupabase } from '@/lib/supabase/admin'
import { isUuid } from '@/lib/uuid'

export const runtime = 'nodejs'

const MAX_BODY_BYTES = 4_000
const MAX_IMAGES = 50

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const rawBody = await req.text()
    if (rawBody.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Request too large' }, { status: 413 })
    }

    let body: { questionId?: unknown; orderedIds?: unknown }
    try {
      body = JSON.parse(rawBody) as { questionId?: unknown; orderedIds?: unknown }
    } catch {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const { questionId, orderedIds } = body
    if (typeof questionId !== 'string' || !isUuid(questionId)) {
      return NextResponse.json({ error: 'Invalid question id' }, { status: 400 })
    }
    if (
      !Array.isArray(orderedIds) || orderedIds.length === 0 || orderedIds.length > MAX_IMAGES ||
      !orderedIds.every((id): id is string => typeof id === 'string' && isUuid(id)) ||
      new Set(orderedIds).size !== orderedIds.length
    ) {
      return NextResponse.json({ error: 'Invalid image list' }, { status: 400 })
    }

    const auth = await getAdminRole()
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { data: current, error } = await adminSupabase
      .from('question_images')
      .select('id')
      .eq('question_id', questionId)
      .eq('slot_type', 'question')
    if (error) throw new Error(error.message)

    const currentIds = new Set((current ?? []).map(r => r.id as string))
    if (currentIds.size !== orderedIds.length || !orderedIds.every(id => currentIds.has(id.toLowerCase()))) {
      return NextResponse.json({ error: 'The image list changed. Please reload the page.' }, { status: 409 })
    }

    for (let i = 0; i < orderedIds.length; i++) {
      const { error: updateError } = await adminSupabase
        .from('question_images')
        .update({ display_order: i + 1 })
        .eq('id', orderedIds[i].toLowerCase())
        .eq('question_id', questionId)
      if (updateError) throw new Error(updateError.message)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[images/reorder] error:', err)
    return NextResponse.json({ error: 'Could not change the order' }, { status: 500 })
  }
}