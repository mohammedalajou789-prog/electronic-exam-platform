// src/lib/image-upload.ts
//
// Browser helpers for admin screens that add or remove question images.
//
// uploadQuestionImage() does the whole journey:
//   1. prepareImageForUpload(): the browser resizes the picture (longest side 2000 px)
//      and converts it to WebP at quality 0.9 (Safari may produce PNG instead).
//   2. POST /api/admin/images/upload-url  -> a 5-minute upload URL for this file.
//   3. PUT the file straight to Cloudflare R2 (it never passes through our server).
//   4. POST /api/admin/images              -> the image is saved on the question.
// Each step throws an Error with a message that can be shown to the admin.

import {
  MAX_IMAGE_BYTES,
  isImageContentType,
  type ImageSlot,
} from '@/lib/question-images'

export interface QuestionImage {
  id: string
  question_id: string
  storage_key: string
  slot_type: ImageSlot
  display_order: number
  caption: string | null
}

const MAX_SIDE = 2000
const WEBP_QUALITY = 0.9

interface LoadedImage {
  source: CanvasImageSource
  width: number
  height: number
  release: () => void
}

async function loadImage(file: File): Promise<LoadedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file)
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() }
    } catch {
      // Fall back to an <img> element below
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) }
  } catch {
    URL.revokeObjectURL(url)
    throw new Error('This image format is not supported. Please use JPG, PNG or WebP.')
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality))
}

/** Resizes and converts a picture before upload. Keeps the original when that is smaller. */
export async function prepareImageForUpload(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file.')
  }

  const image = await loadImage(file)
  try {
    if (!image.width || !image.height) {
      throw new Error('This image could not be read.')
    }
    const scale = Math.min(1, MAX_SIDE / Math.max(image.width, image.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('This browser cannot prepare images. Please try another browser.')
    ctx.drawImage(image.source, 0, 0, canvas.width, canvas.height)

    let blob = await canvasToBlob(canvas, 'image/webp', WEBP_QUALITY)
    if (!blob || !isImageContentType(blob.type)) {
      blob = await canvasToBlob(canvas, 'image/png')
    }
    if (!blob || !isImageContentType(blob.type)) {
      throw new Error('This image could not be converted. Please try another file.')
    }

    // A small file that needed no resizing is kept as it is
    if (scale === 1 && isImageContentType(file.type) && file.size <= blob.size) {
      blob = file
    }
    if (blob.size > MAX_IMAGE_BYTES) {
      throw new Error('The image is too large even after compression (8 MB maximum).')
    }
    return blob
  } finally {
    image.release()
  }
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('No connection to the server. Please try again.')
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`)
  }
  return data as T
}

/** Uploads one picture and saves it on the question. Returns the saved image row. */
export async function uploadQuestionImage(
  questionId: string,
  slot: ImageSlot,
  file: File,
  caption?: string | null
): Promise<QuestionImage> {
  const blob = await prepareImageForUpload(file)

  const { key, uploadUrl } = await postJson<{ key: string; uploadUrl: string }>(
    '/api/admin/images/upload-url',
    { questionId, slot, contentType: blob.type, size: blob.size }
  )

  let put: Response
  try {
    put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': blob.type }, body: blob })
  } catch {
    throw new Error('The upload to image storage failed. Please check your connection and try again.')
  }
  if (!put.ok) {
    throw new Error(`The upload to image storage failed (${put.status}). Please try again.`)
  }

  const { image } = await postJson<{ image: QuestionImage }>(
    '/api/admin/images',
    { questionId, slot, key, caption: caption ?? null }
  )
  return image
}

/** Removes one image (row and file). */
export async function deleteQuestionImage(imageId: string): Promise<void> {
  await postJson<{ ok: true }>('/api/admin/images/delete', { imageId })
}

/** Saves a new order for the question images of one question. */
export async function reorderQuestionImages(questionId: string, orderedIds: string[]): Promise<void> {
  await postJson<{ ok: true }>('/api/admin/images/reorder', { questionId, orderedIds })
}