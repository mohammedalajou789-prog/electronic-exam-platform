// src/app/api/search/results/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q          = searchParams.get('q')?.trim() ?? ''
  const yearId     = searchParams.get('year_id')     ?? null
  const semesterId = searchParams.get('semester_id') ?? null
  const subjectId  = searchParams.get('subject_id')  ?? null
  const batchId    = searchParams.get('batch_id')    ?? null
  const examId     = searchParams.get('exam_id')     ?? null

  if (q.length < 2) {
    return NextResponse.json({ results: [], total: 0 })
  }

  const terms = q.split('+').map(t => t.trim()).filter(t => t.length >= 2)
  if (terms.length === 0) {
    return NextResponse.json({ results: [], total: 0 })
  }

  const supabase = await createServerSupabaseClient()

  let dbQuery = supabase
    .from('questions')
    .select(`
      id,
      question_text,
      question_order,
      choice_a, choice_b, choice_c, choice_d, choice_e,
      correct_answer,
      explanation,
      chapter,
      lecture,
      exam:exams(
        id,
        title,
        calendar_year,
        exam_type,
        status,
        batch:batches(
          id,
          name,
          subject:subjects(
            id,
            name,
            semester_id,
            academic_year_id,
            semester:semesters(
              id,
              name,
              academic_year:academic_years!semesters_academic_year_id_fkey(id, name)
            ),
            academic_year:academic_years!subjects_academic_year_id_fkey(id, name)
          )
        )
      ),
      doctor:doctors(id, name)
    `)
    .is('deleted_at', null)

  if (examId)  dbQuery = dbQuery.eq('exam_id', examId)
  if (batchId) dbQuery = dbQuery.eq('exams.batch_id', batchId)

  const { data: raw, error } = await dbQuery.limit(2000)

  console.log('RAW COUNT:', raw?.length)
  console.log('ERROR:', error)
  console.log('SAMPLE:', JSON.stringify(raw?.[0], null, 2))

  if (error || !raw) {
    console.error('Search error:', error)
    return NextResponse.json({ results: [], total: 0 })
  }

  const filtered = (raw as any[]).filter((q) => {
    if (q.exam?.status !== 'published') return false

    const exam    = q.exam
    const batch   = exam?.batch
    const subject = batch?.subject
    const doctor  = q.doctor

    // Clinical: academic_year مرتبط بـ subject مباشرة
    // Pre-clinical: academic_year مرتبط بـ semester
    const academicYear = subject?.semester?.academic_year ?? subject?.academic_year

    const haystack = [
      q.question_text,
      q.chapter,
      q.lecture,
      q.correct_answer,
      q.explanation,
      q.choice_a, q.choice_b, q.choice_c, q.choice_d, q.choice_e,
      exam?.title,
      exam?.calendar_year?.toString(),
      batch?.name,
      subject?.name,
      subject?.semester?.name,
      academicYear?.name,
      doctor?.name,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return terms.every(term => haystack.includes(term.toLowerCase()))
  })

  const finalResults = filtered.filter((q: any) => {
    const subject      = q.exam?.batch?.subject
    const academicYear = subject?.semester?.academic_year ?? subject?.academic_year

    if (subjectId  && subject?.id           !== subjectId)  return false
    if (semesterId && subject?.semester?.id !== semesterId) return false
    if (yearId     && academicYear?.id      !== yearId)     return false
    return true
  })

  return NextResponse.json({
    results: finalResults,
    total:   finalResults.length,
  })
}