// src/app/api/custom-exam/route.ts
//
// Creates a custom exam (POST). Everything happens in the database function
// create_custom_exam: it checks the input and the name, picks the questions and
// saves the exam in one call. Logged-in students get a private, named exam;
// guests get a temporary one (no name, no personal filters).

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isUuid } from '@/lib/uuid'

interface CreateBody {
  subjectId?: unknown
  name?: unknown
  count?: unknown
  randomize?: unknown
  batchIds?: unknown
  doctorIds?: unknown
  chapterIds?: unknown
  lectureIds?: unknown
  notAnswered?: unknown
  firstWrong?: unknown
}

interface CreateResult {
  id: string
  slug: string | null
  question_count: number
}

/** A list of ids from the browser: only well-formed UUIDs, at most `max` of them. */
function idList(value: unknown, max: number): string[] | null {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value) || value.length > max) return null
  if (!value.every(v => typeof v === 'string' && isUuid(v))) return null
  return value as string[]
}

// Messages written by create_custom_exam for the student (safe to show)
const STATUS_BY_CODE: Record<string, number> = {
  '22023': 400, // invalid input (name, count, filters)
  '23505': 409, // a custom exam with this name already exists
  'P0002': 404, // subject not found / no questions match
  '42501': 403, // personal filters need an account
}

export async function POST(request: NextRequest) {
  let body: CreateBody
  try {
    body = (await request.json()) as CreateBody
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const subjectId = typeof body.subjectId === 'string' ? body.subjectId : ''
  const count = typeof body.count === 'number' && Number.isInteger(body.count) ? body.count : NaN
  const batchIds = idList(body.batchIds, 200)
  const doctorIds = idList(body.doctorIds, 200)
  const chapterIds = idList(body.chapterIds, 500)
  const lectureIds = idList(body.lectureIds, 1000)

  if (!isUuid(subjectId) || !Number.isFinite(count) || !batchIds || !doctorIds || !chapterIds || !lectureIds) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('create_custom_exam', {
    p_subject_id: subjectId,
    p_name: typeof body.name === 'string' ? body.name : null,
    p_count: count,
    p_randomize: body.randomize === true,
    p_batch_ids: batchIds,
    p_doctor_ids: doctorIds,
    p_chapter_ids: chapterIds,
    p_lecture_ids: lectureIds,
    p_not_answered: body.notAnswered === true,
    p_first_wrong: body.firstWrong === true,
  })

  if (error || !data) {
    const status = error?.code ? STATUS_BY_CODE[error.code] : undefined
    if (status) {
      return NextResponse.json({ error: error?.message }, { status })
    }
    console.error('Failed to create custom exam:', error)
    return NextResponse.json({ error: 'Failed to create the exam. Please try again.' }, { status: 500 })
  }

  const result = data as CreateResult
  return NextResponse.json({ id: result.id, slug: result.slug, questionCount: result.question_count })
}
