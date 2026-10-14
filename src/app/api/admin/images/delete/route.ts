// src/app/api/admin/images/delete/route.ts
//
// Removes one image from a question: the row in question_images, then the file in R2.
//
// POST { imageId } -> { ok: true }
//
// The row goes first: if removing the file fails afterwards, the only result is an
// unused file in the bucket (students never see a broken image).
//
// Admins only: src/proxy.ts protects /api/admin/*, and the route checks again.

import { NextRequest, NextResponse } from 'next/server'
import { getAdminRole } from '@/lib/auth/requireSuperAdmin'
import { adminSupabase } from '@/lib/supabase/admin'
import { deleteObject } from '@/lib/r2'
import { isUuid } from '@/lib/uuid'

export const runtime = 'nodejs'

const MAX_BODY_BYTES = 1_000

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const rawBody = await req.text()
    if (rawBody.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Request too large' }, { status: 413 })
    }

    let imageId: unknown
    try {
      imageId = (JSON.parse(rawBody) as { imageId?: unknown }).imageId
    } catch {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
    if (typeof imageId !== 'string' || !isUuid(imageId)) {
      return NextResponse.json({ error: 'Invalid image id' }, { status: 400 })
    }

    const auth = await getAdminRole()
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { data: removed, error } = await adminSupabase
      .from('question_images')
      .delete()
      .eq('id', imageId)
      .select('storage_key')
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!removed) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    try {
      await deleteObject(removed.storage_key)
    } catch (err) {
      console.error('[images/delete] the row was removed but the file was not:', err)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[images/delete] error:', err)
    return NextResponse.json({ error: 'Could not delete the image' }, { status: 500 })
  }
}