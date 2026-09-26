// src/components/exam/shared/SharedReviewPage.tsx
//
// Review mode for regular exams (examId) and custom exams (customExamId).
// - Regular exam: public content → public (cookie-less) client, so its review page can be cached.
//   Never add user-specific data to that path — the cached HTML is shared by every student.
// - Custom exam: created by one student → keeps the cookie-aware client and is never cached.
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createPublicSupabaseClient, assertQuerySucceeded } from '@/lib/supabase/public'
import { isUuid } from '@/lib/uuid'
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
  let questions: any[] = []

  if (examId) {
    if (!isUuid(examId)) notFound()

    const supabase = createPublicSupabaseClient()
    const { data, error } = await supabase
      .from('questions')
      .select('*, question_statistics(*), chapter:chapters(id, name), lecture:lectures(id, name)')
      .eq('exam_id', examId)
      .is('deleted_at', null)
      .order('question_order', { ascending: true })

    assertQuerySucceeded(error, 'review questions')
    questions = data || []
  } else if (customExamId) {
    const supabase = await createServerSupabaseClient()
    const { data: customExam } = await supabase
      .from('custom_exams')
      .select('question_ids')
      .eq('id', customExamId)
      .single()
    if (!customExam) notFound()
    const { data } = await supabase
      .from('questions')
      .select('*, question_statistics(*), chapter:chapters(id, name), lecture:lectures(id, name)')
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