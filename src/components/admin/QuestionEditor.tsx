'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Save, Trash2 } from 'lucide-react'

interface Question {
  id: string
  exam_id: string
  question_text: string
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

interface Props {
  question: Question
}

export default function QuestionEditor({ question }: Props) {
  const router = useRouter()
  const supabase = createClient()

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [message, setMessage] = useState('')

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSave() {
    setIsSaving(true)
    setMessage('')

    const { error } = await supabase
      .from('questions')
      .update({
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
        updated_at: new Date().toISOString(),
      })
      .eq('id', question.id)

    setIsSaving(false)

    if (error) {
      setMessage('Error saving question. Please try again.')
    } else {
      setMessage('Question saved successfully.')
      router.refresh()
    }
  }

  async function handleDelete() {
    setIsDeleting(true)

    const { error } = await supabase
      .from('questions')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', question.id)

    if (error) {
      setMessage('Error deleting question. Please try again.')
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    } else {
      router.push('/admin/questions')
    }
  }

  const choices = ['a', 'b', 'c', 'd', 'e'] as const

  return (
    <div className="space-y-6">

      {/* Question Text */}
      <div>
        <label className="mb-1.5 block text-sm font-medium">Question Text</label>
        <textarea
          name="question_text"
          value={form.question_text}
          onChange={handleChange}
          rows={4}
          className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {/* Answer Choices */}
      <div>
        <label className="mb-2 block text-sm font-medium">Answer Choices</label>
        <div className="space-y-2">
          {choices.map(letter => (
            <div key={letter} className="flex items-center gap-3">
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold uppercase">
                {letter}
              </span>
              <input
                name={`choice_${letter}`}
                value={form[`choice_${letter}` as keyof typeof form]}
                onChange={handleChange}
                placeholder={letter === 'e' ? 'Optional 5th choice' : `Choice ${letter.toUpperCase()}`}
                className="flex-1 rounded-lg border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Correct Answer */}
      <div>
        <label className="mb-1.5 block text-sm font-medium">Correct Answer</label>
        <select
          name="correct_answer"
          value={form.correct_answer}
          onChange={handleChange}
          className="rounded-lg border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          {choices.map(letter => (
            <option key={letter} value={letter}>
              {letter.toUpperCase()}
            </option>
          ))}
        </select>
      </div>

      {/* Explanation */}
      <div>
        <label className="mb-1.5 block text-sm font-medium">Explanation (Correct Answer)</label>
        <textarea
          name="explanation"
          value={form.explanation}
          onChange={handleChange}
          rows={3}
          placeholder="Why is this answer correct?"
          className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {/* Wrong Answer Explanations */}
      <div>
        <label className="mb-2 block text-sm font-medium">
          Wrong Answer Explanations
          <span className="ml-1 text-xs font-normal text-muted-foreground">(optional)</span>
        </label>
        <div className="space-y-2">
          {choices.map(letter => (
            <div key={letter} className="flex items-start gap-3">
              <span className="mt-2 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-red-50 text-xs font-bold uppercase text-red-600">
                {letter}
              </span>
              <textarea
                name={`incorrect_explanation_${letter}`}
                value={form[`incorrect_explanation_${letter}` as keyof typeof form]}
                onChange={handleChange}
                rows={2}
                placeholder={`Why is ${letter.toUpperCase()} wrong?`}
                className="flex-1 rounded-lg border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Chapter</label>
          <input
            name="chapter"
            value={form.chapter}
            onChange={handleChange}
            placeholder="e.g. Cardiology"
            className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Lecture</label>
          <input
            name="lecture"
            value={form.lecture}
            onChange={handleChange}
            placeholder="e.g. Heart Failure"
            className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      {/* Message */}
      {message && (
        <p className={`text-sm ${message.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
          {message}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {isSaving ? 'Saving...' : 'Save Question'}
        </button>

        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          className="flex items-center gap-2 rounded-lg border border-red-200 px-5 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/40"
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </button>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-card p-6 shadow-xl">
            <h3 className="mb-2 font-semibold">Delete Question?</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              This question will be hidden from students. This action can be
              reversed by a Super Admin.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 rounded-lg border border-border/60 py-2 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

