'use client'

import { useState } from 'react'
import { AlertCircle, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  questionId: string
}

const categories = [
  { value: 'wrong_answer', label: 'Wrong Answer' },
  { value: 'typo', label: 'Typo or Spelling Error' },
  { value: 'wrong_explanation', label: 'Wrong Explanation' },
  { value: 'missing_image', label: 'Missing Image' },
  { value: 'wrong_image', label: 'Wrong Image' },
  { value: 'wrong_chapter', label: 'Wrong Chapter' },
  { value: 'duplicate', label: 'Duplicate Question' },
  { value: 'other', label: 'Other' },
]

export default function ReportButton({ questionId }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDone, setIsDone] = useState(false)

  async function handleSubmit() {
    if (!category) return
    setIsSubmitting(true)

    const supabase = createClient()
    await supabase.from('reports').insert({
      question_id: questionId,
      category,
      description: description.trim() || null,
      status: 'new',
    })

    setIsDone(true)
    setIsSubmitting(false)
    setTimeout(() => {
      setIsOpen(false)
      setIsDone(false)
      setCategory('')
      setDescription('')
    }, 2000)
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        title="Report an issue"
      >
        <AlertCircle className="h-3.5 w-3.5" />
        Report Issue
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-card p-5 shadow-xl">

            {isDone ? (
              <div className="py-4 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                  <AlertCircle className="h-6 w-6 text-green-600" />
                </div>
                <p className="font-semibold">Report Submitted</p>
                <p className="text-sm text-muted-foreground">Thank you for helping improve the platform.</p>
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-semibold">Report an Issue</h3>
                  <button onClick={() => setIsOpen(false)}>
                    <X className="h-5 w-5 text-muted-foreground" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Issue Type</label>
                    <select
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black"
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                    >
                      <option value="">Select issue type</option>
                      {categories.map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description (Optional)
                    </label>
                    <textarea
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                      rows={3}
                      placeholder="Describe the issue..."
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                    />
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setIsOpen(false)}
                      className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={!category || isSubmitting}
                      className="flex-1 rounded-lg bg-black py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                    >
                      {isSubmitting ? 'Submitting...' : 'Submit Report'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

