'use client'

import { useState } from 'react'
import { Download, ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Question {
  id: string
  question_text: string
  question_order: number
  choice_a: string
  choice_b: string
  choice_c: string
  choice_d: string
  choice_e: string | null
  correct_answer: string
  explanation: string | null
  chapter: string | null
  lecture: string | null
}

interface Exam {
  id: string
  title: string
  question_count: number
  exam_type: string | null
  calendar_year: number | null
  exam_doctors?: Array<{ doctor: { name: string } | null }>
}

interface Props {
  exam: Exam
  questions: Question[]
}

export default function PDFExport({ exam, questions }: Props) {
  const router = useRouter()
  const [includeAnswers, setIncludeAnswers] = useState(false)
  const [includeExplanations, setIncludeExplanations] = useState(false)

  const doctors = exam.exam_doctors?.map(ed => ed.doctor?.name).filter(Boolean) || []

  function handlePrint() {
    window.print()
  }

  const choices = ['a', 'b', 'c', 'd', 'e'] as const

  return (
    <>
      {/* Controls — hidden when printing */}
      <div className="print:hidden mx-auto max-w-3xl px-4 py-6">
        <button
          onClick={() => router.back()}
          className="mb-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm space-y-4">
          <h1 className="text-xl font-bold">Export as PDF</h1>
          <p className="text-sm text-muted-foreground">{exam.title} · {questions.length} questions</p>

          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeAnswers}
                onChange={e => setIncludeAnswers(e.target.checked)}
                className="h-4 w-4 rounded"
              />
              <span className="text-sm font-medium">Include correct answers</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeExplanations}
                onChange={e => setIncludeExplanations(e.target.checked)}
                className="h-4 w-4 rounded"
              />
              <span className="text-sm font-medium">Include explanations</span>
            </label>
          </div>

          <button
            onClick={handlePrint}
            className="flex items-center gap-2 rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </button>
        </div>
      </div>

      {/* Printable Content */}
      <div className="print:block hidden print:p-8 print:max-w-none">

        {/* Cover */}
        <div className="mb-8 border-b pb-6">
          <h1 className="text-2xl font-bold">{exam.title}</h1>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-600">
            {exam.exam_type && <span className="capitalize">{exam.exam_type}</span>}
            {exam.calendar_year && <span>{exam.calendar_year}</span>}
            {doctors.length > 0 && <span>{doctors.join(', ')}</span>}
            <span>{questions.length} Questions</span>
          </div>
        </div>

        {/* Questions */}
        <div className="space-y-8">
          {questions.map((question, index) => (
            <div key={question.id} className="break-inside-avoid">
              <div className="mb-3">
                <span className="font-bold">{index + 1}. </span>
                <span>{question.question_text}</span>
              </div>

              <div className="space-y-1 pl-4">
                {choices.map(letter => {
                  const text = question[`choice_${letter}` as keyof Question] as string
                  if (!text) return null
                  const isCorrect = question.correct_answer === letter
                  return (
                    <div key={letter} className={`text-sm ${includeAnswers && isCorrect ? 'font-bold' : ''}`}>
                      {letter.toUpperCase()}. {text}
                      {includeAnswers && isCorrect && ' ✓'}
                    </div>
                  )
                })}
              </div>

              {includeExplanations && question.explanation && (
                <div className="mt-2 pl-4 text-sm text-gray-600 italic">
                  Explanation: {question.explanation}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Preview — visible on screen */}
      <div className="print:hidden mx-auto max-w-3xl px-4 pb-12">
        <div className="rounded-xl border border-border/60 bg-white p-8 shadow-sm">

          {/* Preview Header */}
          <div className="mb-6 border-b pb-4">
            <h2 className="text-xl font-bold">{exam.title}</h2>
            <div className="mt-1 flex flex-wrap gap-3 text-sm text-muted-foreground">
              {exam.exam_type && <span className="capitalize">{exam.exam_type}</span>}
              {exam.calendar_year && <span>{exam.calendar_year}</span>}
              {doctors.length > 0 && <span>{doctors.join(', ')}</span>}
              <span>{questions.length} Questions</span>
            </div>
          </div>

          {/* Preview Questions */}
          <div className="space-y-6">
            {questions.map((question, index) => (
              <div key={question.id}>
                <p className="mb-2 text-sm font-medium">
                  {index + 1}. {question.question_text}
                </p>
                <div className="space-y-1 pl-4">
                  {choices.map(letter => {
                    const text = question[`choice_${letter}` as keyof Question] as string
                    if (!text) return null
                    const isCorrect = question.correct_answer === letter
                    return (
                      <p key={letter} className={`text-sm ${includeAnswers && isCorrect ? 'font-bold text-green-700' : 'text-muted-foreground'}`}>
                        {letter.toUpperCase()}. {text}
                        {includeAnswers && isCorrect && ' ✓'}
                      </p>
                    )
                  })}
                </div>
                {includeExplanations && question.explanation && (
                  <p className="mt-1 pl-4 text-xs text-muted-foreground italic">
                    {question.explanation}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

