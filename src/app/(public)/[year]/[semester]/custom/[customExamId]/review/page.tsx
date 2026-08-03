// src/app/(public)/[year]/[semester]/custom/[customExamId]/review/page.tsx

import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { BookOpen } from 'lucide-react'
import ReviewQuestion from '@/components/exam/ReviewQuestion'

interface PageProps {
  params: Promise<{
    year: string
    semester: string
    customExamId: string
  }>
}

export default async function ClinicalCustomReviewPage({ params }: PageProps) {
  const { year, semester: subjectSlug, customExamId } = await params
  const supabase = await createServerSupabaseClient()

  const { data: customExam } = await supabase
    .from('custom_exams')
    .select('*')
    .eq('id', customExamId)
    .single()

  if (!customExam) notFound()

  const { data: questions } = await supabase
    .from('questions')
    .select('*, question_statistics(*)')
    .in('id', customExam.question_ids)
    .is('deleted_at', null)

  if (!questions || questions.length === 0) notFound()

  const basePath = `/${year}/${subjectSlug}/custom/${customExamId}`

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--fg)', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
      <main style={{ padding: '32px 28px 80px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontSize: 13, color: 'var(--fg-muted)' }}>
            <Link href="/" style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>Home</Link>
            <span>›</span>
            <Link href={`/${year}/${subjectSlug}`} style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>{subjectSlug.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')}</Link>
            <span>›</span>
            <Link href={basePath} style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>Custom Exam</Link>
            <span>›</span>
            <span style={{ color: 'var(--fg)', fontWeight: 700 }}>Review Mode</span>
          </div>
          <Link href={`${basePath}/play`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 11, background: 'var(--clr-primary)', color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}>
            <BookOpen size={15} />Take Exam
          </Link>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {questions.map((q: any, i: number) => (
            <ReviewQuestion key={q.id} question={q} index={i} />
          ))}
        </div>
      </main>
    </div>
  )
}