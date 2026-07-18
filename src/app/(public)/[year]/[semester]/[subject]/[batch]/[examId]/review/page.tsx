import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import Breadcrumb from '@/components/shared/Breadcrumb'
import { CheckCircle, BookOpen } from 'lucide-react'
import ReportButton from '@/components/exam/ReportButton'
import Link from 'next/link'

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
    <div className="mx-auto max-w-3xl px-4 py-8">

      {/* Breadcrumb */}
      <div className="mb-6">
        <Breadcrumb items={[
          { label: slugToName(year), href: `/${year}` },
          { label: slugToName(semester), href: `/${year}/${semester}` },
          { label: exam.title, href: `/${year}/${semester}/${subject}/${batch}/${examId}` },
          { label: 'Review Mode' },
        ]} />
      </div>

      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{exam.title}</h1>
          <p className="text-muted-foreground">Review Mode — {questions.length} questions</p>
        </div>
        <Link
          href={`/${year}/${semester}/${subject}/${batch}/${examId}/play`}
          className="flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          <BookOpen className="h-4 w-4" />
          Take Exam
        </Link>
      </div>

      {/* Questions */}
      <div className="space-y-6">
        {questions.map((question, index) => {
          const stats = question.question_statistics?.[0]
          const correctPercent = stats && stats.attempts > 0
            ? Math.round((stats.correct_answers / stats.attempts) * 100)
            : null

          return (
            <div key={question.id} className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">

              {/* Question Header */}
              <div className="border-b border-border/40 bg-muted/20 px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {index + 1}
                  </span>
                  {question.chapter && (
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                      {question.chapter}
                    </span>
                  )}
                  {question.lecture && (
                    <span className="text-xs text-muted-foreground">{question.lecture}</span>
                  )}
                </div>
                {correctPercent !== null && (
                  <span className="text-xs text-muted-foreground">
                    {correctPercent}% correct
                  </span>
                )}
              </div>

              {/* Question Text */}
              <div className="px-5 py-4">
                <p className="font-medium leading-relaxed">{question.question_text}</p>
              </div>

              {/* Choices */}
              <div className="px-5 pb-4 space-y-2">
                {choices.map(letter => {
                  const text = question[`choice_${letter}`]
                  if (!text) return null
                  const isCorrect = question.correct_answer === letter
                  const wrongExpl = question[`incorrect_explanation_${letter}`]

                  return (
                    <div key={letter}>
                      <div className={`flex items-start gap-3 rounded-lg px-4 py-3 text-sm ${
                        isCorrect
                          ? 'bg-green-50 border border-green-200 text-green-800'
                          : 'bg-muted/30 border border-transparent'
                      }`}>
                        <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold uppercase ${
                          isCorrect ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
                        }`}>
                          {isCorrect ? <CheckCircle className="h-4 w-4" /> : letter}
                        </span>
                        <span>{text}</span>
                      </div>
                      {!isCorrect && wrongExpl && (
                        <p className="mt-1 px-4 text-xs text-muted-foreground">{wrongExpl}</p>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Explanation */}
              {/* Report Button */}
              <div className="border-t border-border/40 px-5 py-2 flex justify-end">
                <ReportButton questionId={question.id} />
              </div>

              {question.explanation && (
                <div className="border-t border-border/40 bg-green-50 px-5 py-4">
                  <p className="mb-1 text-xs font-semibold uppercase text-green-700">Explanation</p>
                  <p className="text-sm text-green-800">{question.explanation}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}