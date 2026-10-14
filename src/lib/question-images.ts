// src/lib/question-images.ts
//
// Shared rules for question images (safe for the browser and the server).
//
// The image files live in Cloudflare R2. The question_images table keeps only the
// object key (storage_key), never a full URL:
//   q/<question id>/<32 random hex>.webp   a question image (slot_type 'question')
//   e/<question id>/<32 random hex>.webp   an explanation image (slot_type 'explanation_1..3')
// The database checks the same format (supabase/sql/2026-10-14_question_images_r2.sql).
//
// The public address is NEXT_PUBLIC_IMAGES_BASE_URL + '/' + key. Moving to a custom
// domain only changes that variable (in .env.local and Vercel), then a rebuild.

export type ImageSlot = 'question' | 'explanation_1' | 'explanation_2' | 'explanation_3'

export const IMAGE_SLOTS: readonly ImageSlot[] = ['question', 'explanation_1', 'explanation_2', 'explanation_3']

/** Upload types accepted by the server, with the file extension used in the key. */
export const IMAGE_TYPES = {
  'image/webp': 'webp',
  'image/png': 'png',
  'image/jpeg': 'jpg',
} as const

export type ImageContentType = keyof typeof IMAGE_TYPES

/** Largest file accepted after the browser has converted it (see prepareImageForUpload). */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024

/** Longest caption kept for a question image. */
export const MAX_CAPTION_LENGTH = 200

const KEY_PATTERN =
  /^([qe])\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/[0-9a-f]{32}\.(webp|png|jpg)$/

export function isImageSlot(value: unknown): value is ImageSlot {
  return typeof value === 'string' && (IMAGE_SLOTS as readonly string[]).includes(value)
}

export function isImageContentType(value: unknown): value is ImageContentType {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(IMAGE_TYPES, value)
}

/** The key prefix of a slot: 'q' for question images, 'e' for explanation images. */
export function slotPrefix(slot: ImageSlot): 'q' | 'e' {
  return slot === 'question' ? 'q' : 'e'
}

/** The explanation slot number (1-3) of a slot, or null for a question image. */
export function slotNumber(slot: ImageSlot): 1 | 2 | 3 | null {
  if (slot === 'explanation_1') return 1
  if (slot === 'explanation_2') return 2
  if (slot === 'explanation_3') return 3
  return null
}

/** True when `key` is a valid key for this question and slot. */
export function isStorageKeyFor(key: unknown, questionId: string, slot: ImageSlot): key is string {
  if (typeof key !== 'string') return false
  const match = KEY_PATTERN.exec(key)
  return match !== null && match[1] === slotPrefix(slot) && match[2] === questionId.toLowerCase()
}

/** The public address of an image. */
export function imageUrl(storageKey: string): string {
  const base = (process.env.NEXT_PUBLIC_IMAGES_BASE_URL ?? '').replace(/\/+$/, '')
  return `${base}/${storageKey}`
}