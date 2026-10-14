// src/app/api/admin/images/route.ts
//
// Step 2 of adding an image: after the browser uploaded the file to R2
// (see ./upload-url/route.ts), the admin saves it on the question.
//
// POST { questionId, slot, key, caption? }
//   -> { image: { id, question_id, storage_key, slot_type, display_order, caption } }
//
// - Question images ('question') are added after the existing ones.
// - An explanation slot ('explanation_1..3') holds one image: a new one replaces the old
//   one, and the old file is removed from R2.
// The route checks that the file really is in R2 before saving it.
//
// Admins only: src/proxy.ts protects /api/admin/*, and the route checks again.
// Writes use the service role after that check (the table's RLS policy only knows
// admins.id, while admin rows are matched by id or user_id elsewhere in the app).

import { NextRequest, NextResponse } from 'next/server'
import { getAdminRole } from '@/lib/auth/requireSuperAdmin'
import { adminSupabase } from '@/lib/supabase/admin'
import { deleteObject, headObject } from '@/lib/r2'
import { isUuid } from '@/lib/uuid'
import {
  MAX_CAPTION_LENGTH,
  MAX_IMAGE_BYTES,
  isImageSlot,
  isStorageKeyFor,
  slotNumber,
} from '@/lib/question-images'

export const runtime = 'nodejs'

const MAX_BODY_BYTES = 2_000

interface SaveImageBody {
  questionId?: unknown
  slot?: unknown
  key?: unknown
  caption?: unknown
}

interface ImageRow {
  id: string
  question_id: string
  storage_key: string
  slot_type: string
  display_order: number
  caption: string | null
}

const IMAGE_COLUMNS = 'id, question_id, storage_key, slot_type, display_order, caption'

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const rawBody = await req.text()
    if (rawBody.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Request too large' }, { status: 413 })
    }

    let body: SaveImageBody
    try {
      body = JSON.parse(rawBody) as SaveImageBody
    } catch {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const { questionId, slot, key } = body
    if (typeof questionId !== 'string' || !isUuid(questionId)) {
      return NextResponse.json({ error: 'Invalid question id' }, { status: 400 })
    }
    if (!isImageSlot(slot)) {
      return NextResponse.json({ error: 'Invalid image slot' }, { status: 400 })
    }
    if (!isStorageKeyFor(key, questionId, slot)) {
      return NextResponse.json({ error: 'Invalid image key' }, { status: 400 })
    }
    if (body.caption !== undefined && body.caption !== null && typeof body.caption !== 'string') {
      return NextResponse.json({ error: 'Invalid caption' }, { status: 400 })
    }
    const caption = typeof body.caption === 'string' && body.caption.trim()
      ? body.caption.trim().slice(0, MAX_CAPTION_LENGTH)
      : null

    const auth = await getAdminRole()
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const info = await headObject(key)
    if (!info.exists) {
      return NextResponse.json({ error: 'The image was not uploaded. Please try again.' }, { status: 400 })
    }
    if (info.size !== null && info.size > MAX_IMAGE_BYTES) {
      await deleteObject(key)
      return NextResponse.json({ error: 'The image is larger than 8 MB' }, { status: 413 })
    }

    const explanationSlot = slotNumber(slot)

    // An explanation slot: replace the image already in that slot, if any
    if (explanationSlot !== null) {
      const { data: existing, error: findError } = await adminSupabase
        .from('question_images')
        .select('id, storage_key')
        .eq('question_id', questionId)
        .eq('slot_type', slot)
        .maybeSingle()
      if (findError) throw new Error(findError.message)

      if (existing) {
        const { data: updated, error: updateError } = await adminSupabase
          .from('question_images')
          .update({ storage_key: key, caption })
          .eq('id', existing.id)
          .select(IMAGE_COLUMNS)
          .single()
        if (updateError || !updated) {
          await deleteObject(key).catch(() => undefined)
          throw new Error(updateError?.message ?? 'update failed')
        }
        // The old file is no longer used (best effort: a leftover file harms nothing)
        await deleteObject(existing.storage_key).catch(err => {
          console.error('[images] could not delete the replaced file:', err)
        })
        return NextResponse.json({ image: updated as unknown as ImageRow })
      }
    }

    // A question image goes after the existing ones; an explanation image uses its slot number
    let displayOrder = explanationSlot ?? 1
    if (explanationSlot === null) {
      const { data: last, error: orderError } = await adminSupabase
        .from('question_images')
        .select('display_order')
        .eq('question_id', questionId)
        .eq('slot_type', 'question')
        .order('display_order', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (orderError) throw new Error(orderError.message)
      displayOrder = (last?.display_order ?? 0) + 1
    }

    const { data: inserted, error: insertError } = await adminSupabase
      .from('question_images')
      .insert({
        question_id: questionId,
        storage_key: key,
        slot_type: slot,
        display_order: displayOrder,
        caption,
      })
      .select(IMAGE_COLUMNS)
      .single()
    if (insertError || !inserted) {
      // Do not leave an unused file behind
      await deleteObject(key).catch(() => undefined)
      if (insertError?.code === '23503') {
        return NextResponse.json({ error: 'Question not found' }, { status: 404 })
      }
      if (insertError?.code === '23505') {
        return NextResponse.json({ error: 'This slot already has an image. Please try again.' }, { status: 409 })
      }
      throw new Error(insertError?.message ?? 'insert failed')
    }

    return NextResponse.json({ image: inserted as unknown as ImageRow })
  } catch (err) {
    console.error('[images] save error:', err)
    return NextResponse.json({ error: 'Could not save the image' }, { status: 500 })
  }
}