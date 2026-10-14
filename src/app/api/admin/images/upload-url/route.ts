// src/app/api/admin/images/upload-url/route.ts
//
// Step 1 of adding an image: an admin asks for permission to upload one file.
//
// POST { questionId, slot, contentType, size }
//   -> { key, uploadUrl }
//
// The browser then sends the file itself with
//   fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file })
// straight to Cloudflare R2 (the URL is valid for 5 minutes and only for this type),
// and finally calls POST /api/admin/images to save the image on the question.
//
// Admins only: src/proxy.ts protects /api/admin/*, and the route checks again.

import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { getAdminRole } from '@/lib/auth/requireSuperAdmin'
import { adminSupabase } from '@/lib/supabase/admin'
import { presignPutUrl } from '@/lib/r2'
import { isUuid } from '@/lib/uuid'
import {
  IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  isImageContentType,
  isImageSlot,
  slotPrefix,
} from '@/lib/question-images'

export const runtime = 'nodejs'

const MAX_BODY_BYTES = 1_000
const UPLOAD_URL_SECONDS = 300

interface UploadUrlBody {
  questionId?: unknown
  slot?: unknown
  contentType?: unknown
  size?: unknown
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const rawBody = await req.text()
    if (rawBody.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Request too large' }, { status: 413 })
    }

    let body: UploadUrlBody
    try {
      body = JSON.parse(rawBody) as UploadUrlBody
    } catch {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const { questionId, slot, contentType, size } = body
    if (typeof questionId !== 'string' || !isUuid(questionId)) {
      return NextResponse.json({ error: 'Invalid question id' }, { status: 400 })
    }
    if (!isImageSlot(slot)) {
      return NextResponse.json({ error: 'Invalid image slot' }, { status: 400 })
    }
    if (!isImageContentType(contentType)) {
      return NextResponse.json({ error: 'Only WebP, PNG and JPEG images are allowed' }, { status: 400 })
    }
    if (typeof size !== 'number' || !Number.isInteger(size) || size <= 0) {
      return NextResponse.json({ error: 'Invalid file size' }, { status: 400 })
    }
    if (size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'The image is larger than 8 MB' }, { status: 413 })
    }

    const auth = await getAdminRole()
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { data: question, error } = await adminSupabase
      .from('questions')
      .select('id')
      .eq('id', questionId)
      .is('deleted_at', null)
      .maybeSingle()
    if (error) {
      console.error('[images/upload-url] question lookup failed:', error.message)
      return NextResponse.json({ error: 'Could not prepare the upload' }, { status: 500 })
    }
    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    const key =
      `${slotPrefix(slot)}/${questionId.toLowerCase()}/` +
      `${randomBytes(16).toString('hex')}.${IMAGE_TYPES[contentType]}`
    const uploadUrl = presignPutUrl(key, contentType, UPLOAD_URL_SECONDS)

    return NextResponse.json({ key, uploadUrl })
  } catch (err) {
    console.error('[images/upload-url] error:', err)
    return NextResponse.json({ error: 'Could not prepare the upload' }, { status: 500 })
  }
}