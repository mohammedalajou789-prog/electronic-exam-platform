// src/components/exam/shared/SharedReviewPage.tsx
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { BookOpen } from 'lucide-react'
import ReviewQuestion from '@/components/exam/ReviewQuestion'

interface Props {
  examId?: string
  customExamId?: string
  backPath: string      // رابط زر "Back"
  playPath: string      // رابط زر "Take Exam"
  breadcrumbs: { label: string; href?: string }[]
}

export default async function SharedReviewPage({
  examId,
  customExamId,
  backPath,
  playPath,
  breadcrumbs,
}: Props) {
  const supabase = await createServerSupabaseClient()
  let questions: any[] = []

  if (examId) {
    const { data } = await supabase
      .from('questions')
      .select('*, question_statistics(*)')
      .eq('exam_id', examId)
      .is('deleted_at', null)
      .order('question_order', { ascending: true })
    questions = data || []
  } else if (customExamId) {
    const { data: customExam } = await supabase
      .from('custom_exams')
      .select('question_ids')
      .eq('id', customExamId)
      .single()
    if (!customExam) notFound()
    const { data } = await supabase
      .from('questions')
      .select('*, question_statistics(*)')
      .in('id', customExam.question_ids)
      .is('deleted_at', null)
    questions = data || []
  }

  if (questions.length === 0) notFound()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--fg)', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
      <main style={{ padding: '32px 28px 80px' }}>

        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontSize: 13, color: 'var(--fg-muted)' }}>
            {breadcrumbs.map((crumb, i) => (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {i > 0 && <span>›</span>}
                {crumb.href
                  ? <Link href={crumb.href} style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>{crumb.label}</Link>
                  : <span style={{ color: 'var(--fg)', fontWeight: 700 }}>{crumb.label}</span>
                }
              </span>
            ))}
          </div>
          <Link
            href={playPath}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 11, background: 'var(--clr-primary)', color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}
          >
            <BookOpen size={15} />Take Exam
          </Link>
        </div>

        {/* Questions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {questions.map((question: any, index: number) => (
            <ReviewQuestion key={question.id} question={question} index={index} />
          ))}
        </div>
      </main>
    </div>
  )
}