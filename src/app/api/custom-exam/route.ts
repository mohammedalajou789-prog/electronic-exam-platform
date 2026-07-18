export const runtime = 'nodejs'
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const subjectId = searchParams.get('subjectId')
    const count = Math.min(parseInt(searchParams.get('count') || '20'), 200)
    const randomize = searchParams.get('randomize') === 'true'
    const batchIds = searchParams.get('batches')?.split(',').filter(Boolean) || []
    const doctorIds = searchParams.get('doctors')?.split(',').filter(Boolean) || []
    const chapters = searchParams.get('chapters')?.split(',').filter(Boolean) || []
    const lectures = searchParams.get('lectures')?.split(',').filter(Boolean) || []

    if (!subjectId) {
      return NextResponse.json({ error: 'subjectId is required' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()

    // Get all published exams for this subject
    let examQuery = supabase
      .from('exams')
      .select('id, batch_id, doctor_id')
      .eq('status', 'published')
      .is('deleted_at', null)
      .in(
        'batch_id',
        // Sub-select: get all batch IDs for this subject
        (
          await supabase
            .from('batches')
            .select('id')
            .eq('subject_id', subjectId)
        ).data?.map(b => b.id) || []
      )

    if (batchIds.length > 0) {
      examQuery = examQuery.in('batch_id', batchIds)
    }

    if (doctorIds.length > 0) {
      // Filter by doctor through exam_doctors join
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

    // Get questions from those exams
    let questionQuery = supabase
      .from('questions')
      .select('id')
      .in('exam_id', examIds)
      .is('deleted_at', null)

    if (chapters.length > 0) {
      questionQuery = questionQuery.in('chapter', chapters)
    }

    if (lectures.length > 0) {
      questionQuery = questionQuery.in('lecture', lectures)
    }

    const { data: allQuestions } = await questionQuery

    if (!allQuestions || allQuestions.length === 0) {
      return NextResponse.json(
        { error: 'No questions found with the selected filters.' },
        { status: 404 }
      )
    }

    // Pick questions (randomize or take first N)
    let selectedIds: string[]
    if (randomize) {
      const shuffled = [...allQuestions].sort(() => Math.random() - 0.5)
      selectedIds = shuffled.slice(0, count).map(q => q.id)
    } else {
      selectedIds = allQuestions.slice(0, count).map(q => q.id)
    }

    // Store the custom exam session in study_progress-like table
    // We use a simple approach: store question IDs in a temporary custom_exams table
    // For now, we pass the IDs via a signed token approach using a simple DB record
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
