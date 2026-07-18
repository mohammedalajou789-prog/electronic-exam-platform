'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, ImagePlus, X, Save, CheckCircle } from 'lucide-react'
import Link from 'next/link'

interface Exam { id: string; title: string; batch_id: string }
interface Batch { id: string; name: string; subject_id: string }
interface Subject { id: string; name: string }
interface Doctor { id: string; name: string }
interface Chapter { id: string; name: string; subject_id: string }
interface Lecture { id: string; name: string; chapter_id: string }

interface StagedImage {
  file: File
  previewUrl: string
  caption: string
}

interface QuestionForm {
  question_text: string
  choice_a: string
  choice_b: string
  choice_c: string
  choice_d: string
  choice_e: string
  correct_answer: string
  explanation: string
  incorrect_explanation_a: string
  incorrect_explanation_b: string
  incorrect_explanation_c: string
  incorrect_explanation_d: string
  chapter_id: string
  lecture_id: string
  doctor_id: string
  images: StagedImage[]
}

function emptyQuestion(): QuestionForm {
  return {
    question_text: '',
    choice_a: '', choice_b: '', choice_c: '', choice_d: '', choice_e: '',
    correct_answer: 'a',
    explanation: '',
    incorrect_explanation_a: '', incorrect_explanation_b: '',
    incorrect_explanation_c: '', incorrect_explanation_d: '',
    chapter_id: '', lecture_id: '', doctor_id: '',
    images: [],
  }
}

const choices = ['a', 'b', 'c', 'd', 'e'] as const
const inputClass = "w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
const selectClass = "w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
const labelClass = "block text-xs font-medium text-muted-foreground mb-1"

export default function ManualImportPage() {
  const supabase = createClient()

  const [exams, setExams] = useState<Exam[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [allChapters, setAllChapters] = useState<Chapter[]>([])
  const [allLectures, setAllLectures] = useState<Lecture[]>([])

  const [selectedExam, setSelectedExam] = useState('')
  const [currentSubjectId, setCurrentSubjectId] = useState('')

  const [questions, setQuestions] = useState<QuestionForm[]>([emptyQuestion()])
  const [isSaving, setIsSaving] = useState(false)
  const [savedCount, setSavedCount] = useState(0)
  const [isDone, setIsDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const [{ data: ex }, { data: ba }, { data: su }, { data: do_ }, { data: ch }, { data: le }] =
        await Promise.all([
          supabase.from('exams').select('id, title, batch_id').eq('status', 'published').is('deleted_at', null).order('title'),
          supabase.from('batches').select('*'),
          supabase.from('subjects').select('*'),
          supabase.from('doctors').select('*').order('name'),
          supabase.from('chapters').select('*').order('display_order'),
          supabase.from('lectures').select('*').order('display_order'),
        ])
      setExams(ex || [])
      setBatches(ba || [])
      setSubjects(su || [])
      setDoctors(do_ || [])
      setAllChapters(ch || [])
      setAllLectures(le || [])
    }
    load()
  }, [])

  function handleExamChange(examId: string) {
    setSelectedExam(examId)
    if (!examId) {
      setCurrentSubjectId('')
      return
    }
    const exam = exams.find(e => e.id === examId)
    const batch = batches.find(b => b.id === exam?.batch_id)
    const subjectId = batch?.subject_id || ''
    console.log('Selected exam:', examId, 'batch:', exam?.batch_id, 'subject:', subjectId)
    setCurrentSubjectId(subjectId)
    setQuestions(prev => prev.map(q => ({ ...q, chapter_id: '', lecture_id: '' })))
  }

  function getExamLabel(exam: Exam) {
    const batch = batches.find(b => b.id === exam.batch_id)
    const subject = subjects.find(s => s.id === batch?.subject_id)
    return `${exam.title} — ${subject?.name || ''} (${batch?.name || ''})`
  }

  // Chapters filtered by current subject
  const subjectChapters = allChapters.filter(c => c.subject_id === currentSubjectId)

  // Lectures filtered by selected chapter for a given question
  function getLecturesForChapter(chapterId: string) {
    return allLectures.filter(l => l.chapter_id === chapterId)
  }

  function updateQuestion(index: number, field: keyof QuestionForm, value: string) {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== index) return q
      // Reset lecture when chapter changes
      if (field === 'chapter_id') {
        return { ...q, chapter_id: value, lecture_id: '' }
      }
      return { ...q, [field]: value }
    }))
  }

  function addQuestion() {
    setQuestions(prev => [...prev, emptyQuestion()])
    setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 100)
  }

  function removeQuestion(index: number) {
    if (questions.length === 1) return
    setQuestions(prev => prev.filter((_, i) => i !== index))
  }

  function addImage(questionIndex: number, file: File) {
    const previewUrl = URL.createObjectURL(file)
    setQuestions(prev => prev.map((q, i) =>
      i === questionIndex
        ? { ...q, images: [...q.images, { file, previewUrl, caption: '' }] }
        : q
    ))
  }

  function removeImage(questionIndex: number, imageIndex: number) {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== questionIndex) return q
      const updated = [...q.images]
      URL.revokeObjectURL(updated[imageIndex].previewUrl)
      updated.splice(imageIndex, 1)
      return { ...q, images: updated }
    }))
  }

  function updateImageCaption(questionIndex: number, imageIndex: number, caption: string) {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== questionIndex) return q
      const updated = [...q.images]
      updated[imageIndex] = { ...updated[imageIndex], caption }
      return { ...q, images: updated }
    }))
  }

  async function uploadImages(questionId: string, images: StagedImage[]) {
    for (let i = 0; i < images.length; i++) {
      const img = images[i]
      const ext = img.file.name.split('.').pop()
      const fileName = `${questionId}/${Date.now()}-${i}.${ext}`
      const { error } = await supabase.storage.from('question-images').upload(fileName, img.file)
      if (error) continue
      const { data: urlData } = supabase.storage.from('question-images').getPublicUrl(fileName)
      await supabase.from('question_images').insert({
        question_id: questionId,
        image_url: urlData.publicUrl,
        caption: img.caption.trim() || null,
        display_order: i + 1,
      })
    }
  }

  async function handleSave() {
    setError('')
    if (!selectedExam) { setError('Please select an exam first.'); return }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      if (!q.question_text.trim()) { setError(`Question ${i + 1}: Question text is required.`); return }
      if (!q.choice_a.trim() || !q.choice_b.trim() || !q.choice_c.trim() || !q.choice_d.trim()) {
        setError(`Question ${i + 1}: Choices A, B, C, D are required.`)
        return
      }
    }

    setIsSaving(true)

    const { data: existingExam } = await supabase
      .from('exams').select('question_count').eq('id', selectedExam).single()
    let orderStart = (existingExam?.question_count || 0) + 1
    let saved = 0

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]

      // Get chapter name and lecture name from IDs
      const chapterName = allChapters.find(c => c.id === q.chapter_id)?.name || null
      const lectureName = allLectures.find(l => l.id === q.lecture_id)?.name || null

      const { data: inserted, error: insertError } = await supabase
        .from('questions')
        .insert({
          exam_id: selectedExam,
          question_text: q.question_text.trim(),
          question_order: orderStart + i,
          choice_a: q.choice_a.trim(),
          choice_b: q.choice_b.trim(),
          choice_c: q.choice_c.trim(),
          choice_d: q.choice_d.trim(),
          choice_e: q.choice_e.trim() || null,
          correct_answer: q.correct_answer,
          explanation: q.explanation.trim() || null,
          incorrect_explanation_a: q.incorrect_explanation_a.trim() || null,
          incorrect_explanation_b: q.incorrect_explanation_b.trim() || null,
          incorrect_explanation_c: q.incorrect_explanation_c.trim() || null,
          incorrect_explanation_d: q.incorrect_explanation_d.trim() || null,
          chapter: chapterName,
          lecture: lectureName,
        })
        .select('id')
        .single()

      if (insertError || !inserted) continue
      saved++

      // Link doctor to exam if selected
      if (q.doctor_id) {
        await supabase.from('exam_doctors').upsert({
          exam_id: selectedExam,
          doctor_id: q.doctor_id,
        })
      }

      if (q.images.length > 0) {
        await uploadImages(inserted.id, q.images)
      }
    }

    await supabase.from('exams')
      .update({ question_count: (existingExam?.question_count || 0) + saved })
      .eq('id', selectedExam)

    setSavedCount(saved)
    setIsDone(true)
    setIsSaving(false)
  }

  if (isDone) {
    return (
      <div className="max-w-2xl">
        <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center">
          <CheckCircle className="mx-auto mb-4 h-16 w-16 text-green-500" />
          <h2 className="mb-2 text-2xl font-bold text-green-800">Questions Saved!</h2>
          <p className="text-green-700 mb-6">
            Successfully added <strong>{savedCount}</strong> question{savedCount !== 1 ? 's' : ''} to the exam.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => { setQuestions([emptyQuestion()]); setSelectedExam(''); setCurrentSubjectId(''); setIsDone(false) }}
              className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium hover:bg-white"
            >
              Add More Questions
            </button>
            <Link href="/admin/exams" className="rounded-lg bg-black px-5 py-2 text-sm font-medium text-white hover:bg-gray-800">
              View Exams
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-6">

      <div>
        <h1 className="text-2xl font-bold">Manual Import</h1>
        <p className="text-muted-foreground">Add questions one by one with full control and images</p>
      </div>

      {/* Select Exam */}
      <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
        <label className="block text-sm font-medium mb-2">Target Exam *</label>
        <select className={selectClass} value={selectedExam} onChange={e => handleExamChange(e.target.value)}>
          <option value="">Select an exam to add questions into</option>
          {exams.map(exam => (
            <option key={exam.id} value={exam.id}>{getExamLabel(exam)}</option>
          ))}
        </select>
        {currentSubjectId && subjectChapters.length === 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            No chapters found for this subject. You can still add questions without chapter classification.
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/40">
          {error}
        </div>
      )}

      {/* Questions */}
      {questions.map((q, qIndex) => (
        <div key={qIndex} className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">

          {/* Question Header */}
          <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-5 py-3">
            <h3 className="font-semibold text-sm">Question {qIndex + 1}</h3>
            {questions.length > 1 && (
              <button
                onClick={() => removeQuestion(qIndex)}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </button>
            )}
          </div>

          <div className="p-5 space-y-5">

            {/* Classification Row */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

              {/* Doctor */}
              <div>
                <label className={labelClass}>Doctor</label>
                <select
                  className={selectClass}
                  value={q.doctor_id}
                  onChange={e => updateQuestion(qIndex, 'doctor_id', e.target.value)}
                >
                  <option value="">No doctor</option>
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              {/* Chapter */}
              <div>
                <label className={labelClass}>Chapter</label>
                <select
                  className={selectClass}
                  value={q.chapter_id}
                  onChange={e => updateQuestion(qIndex, 'chapter_id', e.target.value)}
                  disabled={!currentSubjectId || subjectChapters.length === 0}
                >
                  <option value="">No chapter</option>
                  {subjectChapters.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Lecture */}
              <div>
                <label className={labelClass}>Lecture</label>
                <select
                  className={selectClass}
                  value={q.lecture_id}
                  onChange={e => updateQuestion(qIndex, 'lecture_id', e.target.value)}
                  disabled={!q.chapter_id}
                >
                  <option value="">No lecture</option>
                  {getLecturesForChapter(q.chapter_id).map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>

            </div>

            {/* Question Text */}
            <div>
              <label className={labelClass}>Question Text *</label>
              <textarea
                value={q.question_text}
                onChange={e => updateQuestion(qIndex, 'question_text', e.target.value)}
                rows={3}
                placeholder="Enter the question..."
                className={inputClass}
              />
            </div>

            {/* Choices */}
            <div>
              <label className={labelClass}>Answer Choices * — Click the letter to mark correct answer</label>
              <div className="space-y-2">
                {choices.map(letter => (
                  <div key={letter} className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => updateQuestion(qIndex, 'correct_answer', letter)}
                      className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold uppercase border-2 transition-all ${
                        q.correct_answer === letter
                          ? 'border-green-500 bg-green-500 text-white'
                          : 'border-border/60 text-muted-foreground hover:border-green-400'
                      }`}
                    >
                      {letter}
                    </button>
                    <input
                      value={q[`choice_${letter}` as keyof QuestionForm] as string}
                      onChange={e => updateQuestion(qIndex, `choice_${letter}` as keyof QuestionForm, e.target.value)}
                      placeholder={letter === 'e' ? `Choice E (optional)` : `Choice ${letter.toUpperCase()} *`}
                      className="flex-1 rounded-lg border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                ))}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Correct answer: <strong className="text-green-600">{q.correct_answer.toUpperCase()}</strong>
              </p>
            </div>

            {/* Explanation */}
            <div>
              <label className={labelClass}>Explanation (Correct Answer)</label>
              <textarea
                value={q.explanation}
                onChange={e => updateQuestion(qIndex, 'explanation', e.target.value)}
                rows={2}
                placeholder="Why is this answer correct?"
                className={inputClass}
              />
            </div>

            {/* Wrong Explanations */}
            <div>
              <label className={labelClass}>Wrong Answer Explanations (optional)</label>
              <div className="space-y-2">
                {(['a', 'b', 'c', 'd'] as const).map(letter => (
                  <div key={letter} className="flex items-start gap-3">
                    <span className="mt-2 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-red-50 text-xs font-bold uppercase text-red-600">
                      {letter}
                    </span>
                    <input
                      value={q[`incorrect_explanation_${letter}` as keyof QuestionForm] as string}
                      onChange={e => updateQuestion(qIndex, `incorrect_explanation_${letter}` as keyof QuestionForm, e.target.value)}
                      placeholder={`Why is ${letter.toUpperCase()} wrong?`}
                      className="flex-1 rounded-lg border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Images */}
            <div>
              <label className={labelClass}>Images (optional)</label>
              {q.images.length > 0 && (
                <div className="flex flex-wrap gap-3 mb-3">
                  {q.images.map((img, imgIndex) => (
                    <div key={imgIndex} className="relative">
                      <img
                        src={img.previewUrl}
                        alt="preview"
                        className="h-24 w-24 rounded-lg object-cover border border-border/60"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(qIndex, imgIndex)}
                        className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <input
                        type="text"
                        placeholder="Caption..."
                        value={img.caption}
                        onChange={e => updateImageCaption(qIndex, imgIndex, e.target.value)}
                        className="mt-1 w-24 rounded border border-border/60 bg-background px-1 py-0.5 text-xs focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              )}
              <label className="flex items-center gap-2 w-fit cursor-pointer rounded-lg border border-border/60 px-3 py-2 text-xs font-medium hover:bg-muted transition-colors">
                <ImagePlus className="h-4 w-4 text-muted-foreground" />
                Add Image
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) addImage(qIndex, file)
                    e.target.value = ''
                  }}
                />
              </label>
            </div>

          </div>
        </div>
      ))}

      {/* Add Question */}
      <button
        onClick={addQuestion}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/60 py-4 text-sm font-medium text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
      >
        <Plus className="h-4 w-4" />
        Add Another Question
      </button>

      {/* Save */}
      <div className="flex items-center gap-4 pb-8">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 rounded-lg bg-black px-6 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {isSaving ? 'Saving...' : `Save ${questions.length} Question${questions.length > 1 ? 's' : ''}`}
        </button>
        <p className="text-xs text-muted-foreground">
          {questions.length} question{questions.length > 1 ? 's' : ''} ready to save
        </p>ا
      </div>

    </div>
  )
}

