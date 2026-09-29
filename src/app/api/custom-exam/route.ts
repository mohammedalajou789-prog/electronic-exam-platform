export const runtime = 'nodejs'
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const subjectId = searchParams.get('subjectId')
    const count = Math.max(1, Math.min(parseInt(searchParams.get('count') || '20') || 20, 200))
    const randomize = searchParams.get('randomize') === 'true'
    const batchIds = searchParams.get('batches')?.split(',').filter(Boolean) || []
    const doctorIds = searchParams.get('doctors')?.split(',').filter(Boolean) || []
    const chapterIds = searchParams.get('chapters')?.split(',').filter(Boolean) || []
    const lectureIds = searchParams.get('lectures')?.split(',').filter(Boolean) || []

    if (!subjectId) {
      return NextResponse.json({ error: 'subjectId is required' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()

    // Get all published exams for this subject
    let examQuery = supabase
      .from('exams')
      .select('id, batches!inner(slug)')
      .eq('subject_id', subjectId)
      .eq('status', 'published')
      .is('deleted_at', null)

    if (batchIds.length > 0) {
      // The builder sends batch ids; exams are matched by the batches' slugs
      // (every batch name has one slug)
      const { data: chosenBatches } = await supabase
        .from('batches')
        .select('slug')
        .in('id', batchIds)
      examQuery = examQuery.in('batches.slug', (chosenBatches ?? []).map(b => b.slug))
    }

    if (doctorIds.length > 0) {
      const { data: examDoctors } = await supabase
        .from('exam_doctors')
        .select('exam_id')
        .in('doctor_id', doctorIds)

      const examIdsWithDoctor = examDoctors?.map(ed => ed.exam_id) || []
      if (examIdsWithDoctor.length === 0) {
        return NextResponse.json(
          { error: 'No exams found for the selected doctors.' },
          { status: 404 }
        )
      }
      examQuery = examQuery.in('id', examIdsWithDoctor)
    }

    const { data: exams } = await examQuery

    if (!exams || exams.length === 0) {
      return NextResponse.json(
        { error: 'No exams found with the selected filters.' },
        { status: 404 }
      )
    }

    const examIds = exams.map(e => e.id)

    // Pick the questions inside the database: filter, shuffle and limit there.
    // (The API returns 1000 rows at most, so fetching every question id and
    // shuffling here would never pick questions beyond the first 1000.)
    const { data: pickedIds, error: pickError } = await supabase.rpc('pick_custom_exam_questions', {
      p_exam_ids: examIds,
      p_chapter_ids: chapterIds,
      p_lecture_ids: lectureIds,
      p_count: count,
      p_randomize: randomize,
    })

    if (pickError) {
      console.error('Failed to pick custom exam questions:', pickError)
      return NextResponse.json(
        { error: 'Failed to create exam. Please try again.' },
        { status: 500 }
      )
    }

    const selectedIds = (pickedIds ?? []) as string[]

    if (selectedIds.length === 0) {
      return NextResponse.json(
        { error: 'No questions found with the selected filters.' },
        { status: 404 }
      )
    }

    const { data: customExam, error } = await supabase
      .from('custom_exams')
      .insert({
        subject_id: subjectId,
        question_ids: selectedIds,
        question_count: selectedIds.length,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error || !customExam) {
      console.error('Failed to create custom exam:', error)
      return NextResponse.json(
        { error: 'Failed to create exam. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ examId: customExam.id })
  } catch (error) {
    console.error('Custom exam error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
