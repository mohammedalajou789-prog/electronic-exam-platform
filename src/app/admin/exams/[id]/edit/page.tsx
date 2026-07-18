'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, X, Trash2 } from 'lucide-react'
import Link from 'next/link'

interface Doctor { id: string; name: string }

export default function EditExamPage() {
  const router = useRouter()
  const params = useParams()
  const examId = params.id as string
  const supabase = createClient()

  const [allDoctors, setAllDoctors] = useState<Doctor[]>([])
  const [selectedDoctors, setSelectedDoctors] = useState<Doctor[]>([])
  const [doctorToAdd, setDoctorToAdd] = useState('')

  const [title, setTitle] = useState('')
  const [examType, setExamType] = useState('final')
  const [calendarYear, setCalendarYear] = useState('')
  const [status, setStatus] = useState('draft')
  const [description, setDescription] = useState('')

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // Exam info for display (read-only — batch/subject cannot be changed)
  const [examInfo, setExamInfo] = useState<{
    batchName: string
    subjectName: string
    questionCount: number
  } | null>(null)

  useEffect(() => {
    async function loadData() {
      const [
        { data: exam },
        { data: examDoctors },
        { data: doctors },
      ] = await Promise.all([
        supabase
          .from('exams')
          .select('*, batch:batches(name, subject:subjects(name))')
          .eq('id', examId)
          .single(),
        supabase
          .from('exam_doctors')
          .select('doctor:doctors(id, name)')
          .eq('exam_id', examId),
        supabase
          .from('doctors')
          .select('*')
          .order('name'),
      ])

      if (!exam) {
        router.push('/admin/exams')
        return
      }

      setTitle(exam.title)
      setExamType(exam.exam_type || 'final')
      setCalendarYear(exam.calendar_year?.toString() || '')
      setStatus(exam.status)
      setDescription(exam.description || '')
      setExamInfo({
        batchName: (exam.batch as any)?.name || '—',
        subjectName: (exam.batch as any)?.subject?.name || '—',
        questionCount: exam.question_count || 0,
      })

      const currentDoctors = (examDoctors || [])
        .map((ed: any) => ed.doctor)
        .filter(Boolean)
      setSelectedDoctors(currentDoctors)
      setAllDoctors(doctors || [])
      setIsLoading(false)
    }

    loadData()
  }, [examId])

  function addDoctor() {
    if (!doctorToAdd) return
    const doctor = allDoctors.find(d => d.id === doctorToAdd)
    if (!doctor || selectedDoctors.find(d => d.id === doctor.id)) return
    setSelectedDoctors([...selectedDoctors, doctor])
    setDoctorToAdd('')
  }

  function removeDoctor(id: string) {
    setSelectedDoctors(selectedDoctors.filter(d => d.id !== id))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccessMessage('')

    if (!title.trim()) {
      setError('Please enter an exam title.')
      return
    }

    setIsSaving(true)

    // Update exam
    const { error: updateError } = await supabase
      .from('exams')
      .update({
        title: title.trim(),
        exam_type: examType,
        calendar_year: calendarYear ? parseInt(calendarYear) : null,
        status,
        description: description.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', examId)

    if (updateError) {
      setError('Failed to save changes. Please try again.')
      setIsSaving(false)
      return
    }

    // Replace doctors — delete old then insert new
    await supabase.from('exam_doctors').delete().eq('exam_id', examId)

    if (selectedDoctors.length > 0) {
      await supabase.from('exam_doctors').insert(
        selectedDoctors.map(d => ({
          exam_id: examId,
          doctor_id: d.id,
        }))
      )
    }

    setIsSaving(false)
    setSuccessMessage('Exam saved successfully.')
    setTimeout(() => setSuccessMessage(''), 3000)
  }

  async function handleDelete() {
    setIsDeleting(true)

    // Soft delete
    const { error } = await supabase
      .from('exams')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', examId)

    if (error) {
      setError('Failed to delete exam.')
      setIsDeleting(false)
      setShowDeleteConfirm(false)
      return
    }

    router.push('/admin/exams')
  }

  const inputClass = "w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
  const selectClass = "w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
  const labelClass = "block text-sm font-medium mb-1"

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">

      {/* Back */}
      <Link
        href="/admin/exams"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Exams
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Edit Exam</h1>
          <p className="text-muted-foreground">Update exam details</p>
        </div>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/40"
        >
          <Trash2 className="h-4 w-4" />
          Delete Exam
        </button>
      </div>

      {/* Read-only info */}
      {examInfo && (
        <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
          <p className="text-xs font-medium uppercase text-muted-foreground mb-2">
            Exam Info (read-only)
          </p>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Subject</p>
              <p className="font-medium">{examInfo.subjectName}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Batch</p>
              <p className="font-medium">{examInfo.batchName}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Questions</p>
              <p className="font-medium">{examInfo.questionCount}</p>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <form
        onSubmit={handleSave}
        className="space-y-6 rounded-xl border border-border/60 bg-card p-6 shadow-sm"
      >
        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/40">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-950/40">
            {successMessage}
          </div>
        )}

        {/* Title */}
        <div>
          <label className={labelClass}>Exam Title</label>
          <input
            className={inputClass}
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            required
          />
        </div>

        {/* Exam Type & Calendar Year */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Exam Type</label>
            <select
              className={selectClass}
              value={examType}
              onChange={e => setExamType(e.target.value)}
            >
              <option value="quiz">Quiz</option>
              <option value="midterm">Midterm</option>
              <option value="final">Final</option>
              <option value="practical">Practical</option>
              <option value="mock">Mock</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Calendar Year</label>
            <input
              className={inputClass}
              type="number"
              placeholder="e.g. 2024"
              value={calendarYear}
              onChange={e => setCalendarYear(e.target.value)}
              min="2000"
              max="2100"
            />
          </div>
        </div>

        {/* Status */}
        <div>
          <label className={labelClass}>Status</label>
          <select
            className={selectClass}
            value={status}
            onChange={e => setStatus(e.target.value)}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        {/* Doctors */}
        <div>
          <label className={labelClass}>Doctors</label>
          <div className="flex gap-2">
            <select
              className={selectClass}
              value={doctorToAdd}
              onChange={e => setDoctorToAdd(e.target.value)}
            >
              <option value="">Select Doctor to Add</option>
              {allDoctors
                .filter(d => !selectedDoctors.find(sd => sd.id === d.id))
                .map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))
              }
            </select>
            <button
              type="button"
              onClick={addDoctor}
              disabled={!doctorToAdd}
              className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              Add
            </button>
          </div>
          {selectedDoctors.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {selectedDoctors.map(d => (
                <span
                  key={d.id}
                  className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm"
                >
                  {d.name}
                  <button
                    type="button"
                    onClick={() => removeDoctor(d.id)}
                    className="text-muted-foreground hover:text-red-500"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Description */}
        <div>
          <label className={labelClass}>Description (Optional)</label>
          <textarea
            className={inputClass}
            rows={3}
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>

        {/* Save */}
        <button
          type="submit"
          disabled={isSaving}
          className="w-full rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-card p-6 shadow-xl">
            <h3 className="mb-2 font-semibold">Delete Exam?</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              This will hide the exam and all its questions from students.
              This action can be reversed by a Super Admin.
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
                {isDeleting ? 'Deleting...' : 'Delete Exam'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}