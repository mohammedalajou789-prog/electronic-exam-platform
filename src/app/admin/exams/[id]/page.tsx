'use client'
import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Save, Trash2, ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Question {
  id: string
  exam_id: string
  question_text: string
  question_order: number
  choice_a: string
  choice_b: string
  choice_c: string
  choice_d: string
  choice_e: string | null
  correct_answer: string
  explanation: string | null
  incorrect_explanation_a: string | null
  incorrect_explanation_b: string | null
  incorrect_explanation_c: string | null
  incorrect_explanation_d: string | null
  incorrect_explanation_e: string | null
  chapter: string | null
  lecture: string | null
}

interface Exam {
  id: string
  title: string
  exam_type: string
  calendar_year: number | null
  status: string
  question_count: number
  batch: { name: string; subject: { name: string } | null } | null
  doctor: { name: string } | null
}

const choices = ['a', 'b', 'c', 'd', 'e'] as const

function QuestionCard({ question, onSave, onDelete }: {
  question: Question
  onSave: (id: string, data: Partial<Question>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const [form, setForm] = useState({
    question_text: question.question_text,
    choice_a: question.choice_a,
    choice_b: question.choice_b,
    choice_c: question.choice_c,
    choice_d: question.choice_d,
    choice_e: question.choice_e ?? '',
    correct_answer: question.correct_answer,
    explanation: question.explanation ?? '',
    incorrect_explanation_a: question.incorrect_explanation_a ?? '',
    incorrect_explanation_b: question.incorrect_explanation_b ?? '',
    incorrect_explanation_c: question.incorrect_explanation_c ?? '',
    incorrect_explanation_d: question.incorrect_explanation_d ?? '',
    incorrect_explanation_e: question.incorrect_explanation_e ?? '',
    chapter: question.chapter ?? '',
    lecture: question.lecture ?? '',
  })
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [message, setMessage] = useState('')

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }))
  }

  async function handleSave() {
    setIsSaving(true)
    setMessage('')
    await onSave(question.id, {
      question_text: form.question_text,
      choice_a: form.choice_a,
      choice_b: form.choice_b,
      choice_c: form.choice_c,
      choice_d: form.choice_d,
      choice_e: form.choice_e || null,
      correct_answer: form.correct_answer,
      explanation: form.explanation || null,
      incorrect_explanation_a: form.incorrect_explanation_a || null,
      incorrect_explanation_b: form.incorrect_explanation_b || null,
      incorrect_explanation_c: form.incorrect_explanation_c || null,
      incorrect_explanation_d: form.incorrect_explanation_d || null,
      incorrect_explanation_e: form.incorrect_explanation_e || null,
      chapter: form.chapter || null,
      lecture: form.lecture || null,
    })
    setIsSaving(false)
    setMessage('Saved successfully')
    setTimeout(() => setMessage(''), 3000)
  }

  async function handleDelete() {
    setIsDeleting(true)
    await onDelete(question.id)
  }

  const inputCls = "w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
  const textareaCls = inputCls

  return (
    <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">

      {/* Question Header */}
      <div
        className="flex items-start gap-4 px-5 py-4 cursor-pointer hover:bg-muted/20 transition-colors"
        onClick={() => setExpanded(p => !p)}
      >
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold mt-0.5">
          {question.question_order}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium line-clamp-2">{form.question_text}</p>
          <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
            {form.chapter && <span>{form.chapter}</span>}
            {form.lecture && <span>· {form.lecture}</span>}
            <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-xs font-bold uppercase text-green-700">
              {form.correct_answer}
            </span>
          </div>
        </div>
        {expanded
          ? <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
        }
      </div>

      {/* Expanded Editor */}
      {expanded && (
        <div className="border-t border-border/60 px-5 py-5 space-y-5 bg-muted/5">

          {/* Question Text */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">Question Text</label>
            <textarea name="question_text" value={form.question_text} onChange={handleChange} rows={3} className={textareaCls} />
          </div>

          {/* Choices */}
          <div>
            <label className="mb-2 block text-sm font-medium">Answer Choices</label>
            <div className="space-y-2">
              {choices.map(letter => (
                <div key={letter} className="flex items-center gap-3">
                  <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold uppercase ${
                    form.correct_answer === letter ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'
                  }`}>{letter}</span>
                  <input
                    name={`choice_${letter}`}
                    value={form[`choice_${letter}` as keyof typeof form]}
                    onChange={handleChange}
                    placeholder={letter === 'e' ? 'Optional 5th choice' : `Choice ${letter.toUpperCase()}`}
                    className={inputCls}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Correct Answer */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">Correct Answer</label>
            <select name="correct_answer" value={form.correct_answer} onChange={handleChange}
              className="rounded-lg border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
              {choices.map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}
            </select>
          </div>

          {/* Explanation */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">Explanation</label>
            <textarea name="explanation" value={form.explanation} onChange={handleChange} rows={2}
              placeholder="Why is this answer correct?" className={textareaCls} />
          </div>

          {/* Wrong Explanations */}
          <div>
            <label className="mb-2 block text-sm font-medium">
              Wrong Answer Explanations <span className="text-xs font-normal text-muted-foreground">(optional)</span>
            </label>
            <div className="space-y-2">
              {choices.map(letter => (
                <div key={letter} className="flex items-start gap-3">
                  <span className="mt-2 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-red-50 text-xs font-bold uppercase text-red-600">{letter}</span>
                  <textarea
                    name={`incorrect_explanation_${letter}`}
                    value={form[`incorrect_explanation_${letter}` as keyof typeof form]}
                    onChange={handleChange}
                    rows={2}
                    placeholder={`Why is ${letter.toUpperCase()} wrong?`}
                    className={textareaCls}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Chapter</label>
              <input name="chapter" value={form.chapter} onChange={handleChange} placeholder="e.g. Cardiology" className={inputCls} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Lecture</label>
              <input name="lecture" value={form.lecture} onChange={handleChange} placeholder="e.g. Heart Failure" className={inputCls} />
            </div>
          </div>

          {/* Message */}
          {message && <p className="text-sm text-green-600">{message}</p>}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-1">
            <button onClick={handleSave} disabled={isSaving}
              className="flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50">
              <Save className="h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={() => setShowDelete(true)}
              className="flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>

          {/* Delete Confirm */}
          {showDelete && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
              <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-card p-6 shadow-xl">
                <h3 className="mb-2 font-semibold">Delete Question?</h3>
                <p className="mb-4 text-sm text-muted-foreground">This question will be hidden from students.</p>
                <div className="flex gap-3">
                  <button onClick={() => setShowDelete(false)}
                    className="flex-1 rounded-lg border border-border/60 py-2 text-sm font-medium hover:bg-muted">Cancel</button>
                  <button onClick={handleDelete} disabled={isDeleting}
                    className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ExamEditPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = createClient()
  const router = useRouter()
  const { id } = React.use(params)
  const [exam, setExam] = useState<Exam | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [examRes, questionsRes] = await Promise.all([
        supabase.from('exams').select(`
          id, title, exam_type, calendar_year, status, question_count,
          batch:batches(name, subject:subjects(name)),
          doctor:doctors(name)
        `).eq('id', id).single(),
        supabase.from('questions')
          .select('*')
          .eq('exam_id', id)
          .is('deleted_at', null)
          .order('question_order'),
      ])
      setExam(examRes.data as any)
      setQuestions(questionsRes.data ?? [])
      setLoading(false)
    }
    load()
  }, [id])

  async function handleSave(id: string, data: Partial<Question>) {
    await supabase.from('questions').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id)
  }

  async function handleDelete(id: string) {
    await supabase.from('questions').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    setQuestions(p => p.filter(q => q.id !== id))
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-muted rounded w-64" />
        <div className="h-6 bg-muted rounded w-48" />
        {[1,2,3].map(i => <div key={i} className="h-16 bg-muted rounded-xl" />)}
      </div>
    )
  }

  if (!exam) return <p>Exam not found.</p>

  return (
    <div className="space-y-6">

      {/* Back */}
      <Link href="/admin/exams" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit">
        <ArrowLeft className="h-4 w-4" /> Back to Exams
      </Link>

      {/* Header */}
      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{exam.title}</h1>
            <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
              <span className="capitalize">{exam.exam_type}{exam.calendar_year ? ` · ${exam.calendar_year}` : ''}</span>
              {(exam.batch as any)?.subject?.name && <span>{(exam.batch as any).subject.name}</span>}
              {(exam.batch as any)?.name && <span>Batch: {(exam.batch as any).name}</span>}
              {(exam.doctor as any)?.name && <span>Dr. {(exam.doctor as any).name}</span>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
              exam.status === 'published' ? 'bg-green-50 text-green-700' :
              exam.status === 'draft' ? 'bg-yellow-50 text-yellow-700' :
              'bg-gray-50 text-gray-700'
            }`}>{exam.status}</span>
            <span className="text-sm text-muted-foreground">{questions.length} questions</span>
          </div>
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-3">
        {questions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 py-16 text-center">
            <p className="text-muted-foreground">No questions in this exam.</p>
          </div>
        ) : (
          questions.map(q => (
            <QuestionCard key={q.id} question={q} onSave={handleSave} onDelete={handleDelete} />
          ))
        )}
      </div>
    </div>
  )
}
