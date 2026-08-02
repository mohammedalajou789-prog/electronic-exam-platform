import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import Breadcrumb from '@/components/shared/Breadcrumb'
import { ArrowLeft, BookOpen } from 'lucide-react'
import ReportButton from '@/components/exam/ReportButton'
import Link from 'next/link'
import { ExplanationRenderer } from '@/components/exam/ExplanationRenderer'
import ReviewQuestion from '@/components/exam/ReviewQuestion'

interface PageProps {
  params: Promise<{
    year: string; semester: string; subject: string
    batch: string; examId: string
  }>
}

function slugToName(slug: string): string {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

async function getExamWithQuestions(examId: string) {
  const supabase = await createServerSupabaseClient()

  const { data: exam } = await supabase
    .from('exams')
    .select('*, exam_doctors(doctor:doctors(name))')
    .eq('id', examId)
    .eq('status', 'published')
    .is('deleted_at', null)
    .single()

  if (!exam) return null

  const { data: questions } = await supabase
    .from('questions')
    .select('*, question_statistics(*)')
    .eq('exam_id', examId)
    .is('deleted_at', null)
    .order('question_order', { ascending: true })

  return { exam, questions: questions || [] }
}

export default async function ReviewPage({ params }: PageProps) {
  const { year, semester, subject, batch, examId } = await params
  const data = await getExamWithQuestions(examId)

  if (!data) notFound()

  const { exam, questions } = data
  const choices = ['a', 'b', 'c', 'd', 'e'] as const

  return (
    <div
      style={{
        ['--bg' as string]: 'oklch(98% 0.006 55)',
        ['--bg-elev' as string]: 'oklch(100% 0 0)',
        ['--bg-soft' as string]: 'oklch(96% 0.009 55)',
        ['--fg' as string]: 'oklch(22% 0.02 50)',
        ['--fg-muted' as string]: 'oklch(46% 0.02 50)',
        ['--border' as string]: 'oklch(89% 0.012 50)',
        ['--primary' as string]: 'oklch(50% 0.19 25)',
        ['--primary-soft' as string]: 'oklch(94% 0.035 25)',
        ['--accent-green' as string]: 'oklch(60% 0.14 145)',
        ['--accent-blue' as string]: 'oklch(58% 0.13 250)',
        ['--shadow' as string]: 'rgba(20,10,10,.08)',
        minHeight: '100vh',
        background: 'var(--bg)',
        color: 'var(--fg)',
        fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
      }}
    >
      <style>{`
        @keyframes examFadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes noteSlide { from { opacity: 0; max-height: 0; } to { opacity: 1; max-height: 120px; } }
      `}</style>

      

      {/* Main */}
      <main style={{ padding: '32px 28px 80px' }}>

        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ marginBottom: 0 }}>
            <Breadcrumb items={[
              { label: slugToName(year), href: `/${year}` },
              { label: slugToName(semester), href: `/${year}/${semester}` },
              { label: exam.title, href: `/${year}/${semester}/${subject}/${batch}/${examId}` },
              { label: 'Review Mode' },
            ]} />
          </div>
          <Link
            href={`/${year}/${semester}/${subject}/${batch}/${examId}/play`}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 16px', borderRadius: 11,
              background: 'var(--primary)', color: '#fff',
              fontSize: 13, fontWeight: 700, textDecoration: 'none', flexShrink: 0,
            }}
          >
            <BookOpen size={15} />
            Take Exam
          </Link>
        </div>

        {/* Question list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {questions.map((question, index) => (
            <ReviewQuestion key={question.id} question={question} index={index} />
          ))}
        </div>
      </main>
    </div>
  )
}