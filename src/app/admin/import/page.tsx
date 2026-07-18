'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { parseBulkImport, type ParsedQuestion, type ParseError } from '@/features/bulk-import/parser'
import { Upload, CheckCircle, XCircle, AlertTriangle, ChevronDown, ChevronUp, ImagePlus, X, Info } from 'lucide-react'

interface Exam { id: string; title: string; batch_id: string }
interface Batch { id: string; name: string; subject_id: string }
interface Subject { id: string; name: string }
interface Doctor { id: string; name: string }
interface Chapter { id: string; name: string; subject_id: string }
interface Lecture { id: string; name: string; chapter_id: string }

type ImportStep = 'paste' | 'preview' | 'done'

interface StagedImage {
  file: File
  previewUrl: string
  caption: string
}

export default function BulkImportPage() {
  const supabase = createClient()

  const [step, setStep] = useState<ImportStep>('paste')
  const [rawText, setRawText] = useState('')
  const [selectedExam, setSelectedExam] = useState('')
  const [exams, setExams] = useState<Exam[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [allChapters, setAllChapters] = useState<Chapter[]>([])
  const [allLectures, setAllLectures] = useState<Lecture[]>([])

  const [parsedQuestions, setParsedQuestions] = useState<ParsedQuestion[]>([])
  const [parseErrors, setParseErrors] = useState<ParseError[]>([])
  const [parseWarnings, setParseWarnings] = useState<string[]>([])
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  const [stagedImages, setStagedImages] = useState<Record<number, StagedImage[]>>({})
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; errors: number } | null>(null)
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set())

  // Exam info for the info card
  const [examInfo, setExamInfo] = useState<{
    subjectId: string
    chapters: string[]
    lectures: string[]
    doctors: string[]
  } | null>(null)

  useEffect(() => {
    async function load() {
      const [{ data: ex }, { data: ba }, { data: su }, { data: do_ }, { data: ch }, { data: le }] =
        await Promise.all([
          supabase.from('exams').select('id, title, batch_id').eq('status', 'published').is('deleted_at', null).order('title'),
          supabase.from('batches').select('*'),
          supabase.from('subjects').select('*'),
          supabase.from('doctors').select('*').order('name'),
          supabase.from('chapters').select('*').order('name'),
          supabase.from('lectures').select('*').order('name'),
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

  function getSubjectIdForExam(examId: string): string | null {
    const exam = exams.find(e => e.id === examId)
    const batch = batches.find(b => b.id === exam?.batch_id)
    return batch?.subject_id || null
  }

  function handleExamSelect(examId: string) {
    setSelectedExam(examId)
    if (!examId) { setExamInfo(null); return }

    const subjectId = getSubjectIdForExam(examId)
    if (!subjectId) { setExamInfo(null); return }

    const subjectChapters = allChapters
      .filter(c => c.subject_id === subjectId)
      .map(c => c.name)

    const chapterIds = allChapters
      .filter(c => c.subject_id === subjectId)
      .map(c => c.id)

    const subjectLectures = allLectures
      .filter(l => chapterIds.includes(l.chapter_id))
      .map(l => l.name)

    setExamInfo({
      subjectId,
      chapters: subjectChapters,
      lectures: subjectLectures,
      doctors: doctors.map(d => d.name),
    })
  }

  // Validate parsed questions against database values
  function validateAgainstDatabase(questions: ParsedQuestion[]): string[] {
    const errors: string[] = []
    const subjectId = getSubjectIdForExam(selectedExam)

    const validChapterNames = allChapters
      .filter(c => c.subject_id === subjectId)
      .map(c => c.name.toLowerCase().trim())

    const validDoctorNames = doctors.map(d => d.name.toLowerCase().trim())

    for (const q of questions) {
      // Validate doctor — empty is OK, wrong name is NOT OK
      if (q.doctorName) {
        const doctorLower = q.doctorName.toLowerCase().trim()
        if (!validDoctorNames.includes(doctorLower)) {
          errors.push(
            `Question ${q.questionNumber}: Doctor "${q.doctorName}" not found in the database. ` +
            `Available doctors: ${doctors.map(d => d.name).join(', ') || 'none'}`
          )
        }
      }

      // Validate chapter — empty is OK (warning), wrong name is an error
      if (q.chapter) {
        const chapterLower = q.chapter.toLowerCase().trim()
        if (!validChapterNames.includes(chapterLower)) {
          errors.push(
            `Question ${q.questionNumber}: Chapter "${q.chapter}" not found for this subject. ` +
            `Available chapters: ${examInfo?.chapters.join(', ') || 'none'}`
          )
        } else if (q.lecture) {
          // Validate lecture under this chapter
          const chapter = allChapters.find(
            c => c.subject_id === subjectId && c.name.toLowerCase().trim() === chapterLower
          )
          if (chapter) {
            const validLectureNames = allLectures
              .filter(l => l.chapter_id === chapter.id)
              .map(l => l.name.toLowerCase().trim())

            if (!validLectureNames.includes(q.lecture.toLowerCase().trim())) {
              const chapterLectures = allLectures
                .filter(l => l.chapter_id === chapter.id)
                .map(l => l.name)
              errors.push(
                `Question ${q.questionNumber}: Lecture "${q.lecture}" not found under chapter "${q.chapter}". ` +
                `Available lectures: ${chapterLectures.join(', ') || 'none'}`
              )
            }
          }
        }
      }
    }

    return errors
  }

  function handleValidate() {
    if (!selectedExam) { alert('Please select an exam first.'); return }
    if (!rawText.trim()) { alert('Please paste questions first.'); return }

    const result = parseBulkImport(rawText)
    const dbErrors = validateAgainstDatabase(result.questions)

    setParsedQuestions(result.questions)
    setParseErrors(result.errors)
    setParseWarnings(result.warnings)
    setValidationErrors(dbErrors)
    setStagedImages({})
    setStep('preview')
  }

  function addStagedImage(questionIndex: number, file: File) {
    const previewUrl = URL.createObjectURL(file)
    setStagedImages(prev => ({
      ...prev,
      [questionIndex]: [...(prev[questionIndex] || []), { file, previewUrl, caption: '' }],
    }))
  }

  function removeStagedImage(questionIndex: number, imageIndex: number) {
    setStagedImages(prev => {
      const updated = [...(prev[questionIndex] || [])]
      URL.revokeObjectURL(updated[imageIndex].previewUrl)
      updated.splice(imageIndex, 1)
      return { ...prev, [questionIndex]: updated }
    })
  }

  function updateStagedCaption(questionIndex: number, imageIndex: number, caption: string) {
    setStagedImages(prev => {
      const updated = [...(prev[questionIndex] || [])]
      updated[imageIndex] = { ...updated[imageIndex], caption }
      return { ...prev, [questionIndex]: updated }
    })
  }

  async function uploadImagesForQuestion(questionId: string, images: StagedImage[]) {
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

  async function handleImport() {
    if (parseErrors.length > 0 || validationErrors.length > 0) {
      alert('Please fix all errors before importing.')
      return
    }

    setIsImporting(true)
    const subjectId = getSubjectIdForExam(selectedExam)
    let imported = 0
    let errors = 0

    for (let i = 0; i < parsedQuestions.length; i++) {
      const q = parsedQuestions[i]

      // Find doctor ID
      let doctorId: string | null = null
      if (q.doctorName) {
        const doctor = doctors.find(
          d => d.name.toLowerCase().trim() === q.doctorName!.toLowerCase().trim()
        )
        doctorId = doctor?.id || null
      }

      const { data: inserted, error } = await supabase.from('questions').insert({
        exam_id: selectedExam,
        question_text: q.questionText,
        question_order: i + 1,
        choice_a: q.choices.a,
        choice_b: q.choices.b,
        choice_c: q.choices.c,
        choice_d: q.choices.d,
        choice_e: q.choices.e || null,
        correct_answer: q.correctAnswer,
        explanation: q.explanation || null,
        incorrect_explanation_a: q.wrongExplanations?.a || null,
        incorrect_explanation_b: q.wrongExplanations?.b || null,
        incorrect_explanation_c: q.wrongExplanations?.c || null,
        incorrect_explanation_d: q.wrongExplanations?.d || null,
        incorrect_explanation_e: q.wrongExplanations?.e || null,
        chapter: q.chapter || null,
        lecture: q.lecture || null,
      }).select('id').single()

      if (error || !inserted) { errors++; continue }
      imported++

      const images = stagedImages[i] || []
      if (images.length > 0) await uploadImagesForQuestion(inserted.id, images)

      if (doctorId) {
        await supabase.from('exam_doctors').upsert({ exam_id: selectedExam, doctor_id: doctorId })
      }
    }

    const { data: existingExam } = await supabase
      .from('exams').select('question_count').eq('id', selectedExam).single()
    await supabase.from('exams')
      .update({ question_count: (existingExam?.question_count || 0) + imported })
      .eq('id', selectedExam)

    await supabase.from('bulk_imports').insert({
      questions_imported: imported,
      errors,
      warnings: parseWarnings.length,
    })

    setImportResult({ imported, errors })
    setStep('done')
    setIsImporting(false)
  }

  function toggleQuestion(num: number) {
    setExpandedQuestions(prev => {
      const next = new Set(prev)
      next.has(num) ? next.delete(num) : next.add(num)
      return next
    })
  }

  function getExamLabel(exam: Exam) {
    const batch = batches.find(b => b.id === exam.batch_id)
    const subject = subjects.find(s => s.id === batch?.subject_id)
    return `${exam.title} — ${subject?.name || ''} (${batch?.name || ''})`
  }

  const allErrors = [...parseErrors.map(e => `Question ${e.questionNumber}: ${e.message}`), ...validationErrors]

  return (
    <div className="max-w-4xl space-y-6">

      <div>
        <h1 className="text-2xl font-bold">Bulk Import</h1>
        <p className="text-muted-foreground">Import multiple questions at once using the standard format</p>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-4">
        {['paste', 'preview', 'done'].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
              step === s ? 'bg-black text-white' :
              (step === 'preview' && i === 0) || step === 'done' ? 'bg-green-500 text-white' :
              'bg-gray-200 text-gray-500'
            }`}>
              {((step === 'preview' && i === 0) || step === 'done') && i < ['paste', 'preview', 'done'].indexOf(step) ? '✓' : i + 1}
            </div>
            <span className="text-sm font-medium capitalize">{s}</span>
            {i < 2 && <div className="h-px w-8 bg-gray-300" />}
          </div>
        ))}
      </div>

      {/* STEP 1: PASTE */}
      {step === 'paste' && (
        <div className="space-y-4">

          {/* Format Guide */}
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <h2 className="mb-2 font-semibold text-blue-800">Question Format</h2>
            <pre className="text-xs text-blue-700 whitespace-pre-wrap">{`1. Question text here?
A. First choice
B. Second choice *
C. Third choice
D. Fourth choice
E. Fifth choice (optional)
Chapter: Chapter Name
Lecture: Lecture Name
Doctor: Dr. Name (optional)
Explanation: Explanation text here
Wrong answers explanation:
A. Why A is wrong
C. Why C is wrong
D. Why D is wrong

2. Next question...`}</pre>
            <p className="mt-2 text-xs text-blue-600">
              Spacing around ":" is flexible — "Chapter: X", "Chapter:X", "Chapter  :  X" all work.
            </p>
          </div>

          {/* Select Exam */}
          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Select Target Exam</label>
              <select
                className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={selectedExam}
                onChange={e => handleExamSelect(e.target.value)}
              >
                <option value="">Select an exam to import questions into</option>
                {exams.map(exam => (
                  <option key={exam.id} value={exam.id}>{getExamLabel(exam)}</option>
                ))}
              </select>
            </div>

            {/* Exam Info Card */}
            {examInfo && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Info className="h-4 w-4 text-blue-600" />
                  <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                    Use these exact names in your questions
                  </p>
                </div>
                <div className="space-y-2 text-xs text-blue-700 dark:text-blue-300">
                  <div>
                    <span className="font-semibold">Chapters: </span>
                    {examInfo.chapters.length > 0
                      ? examInfo.chapters.join(' · ')
                      : <span className="italic">No chapters defined</span>
                    }
                  </div>
                  <div>
                    <span className="font-semibold">Lectures: </span>
                    {examInfo.lectures.length > 0
                      ? examInfo.lectures.join(' · ')
                      : <span className="italic">No lectures defined</span>
                    }
                  </div>
                  <div>
                    <span className="font-semibold">Doctors: </span>
                    {examInfo.doctors.length > 0
                      ? examInfo.doctors.join(' · ')
                      : <span className="italic">No doctors defined</span>
                    }
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Paste Area */}
          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
            <label className="block text-sm font-medium mb-2">Paste Questions</label>
            <textarea
              className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono"
              rows={20}
              placeholder="Paste your questions here using the format shown above..."
              value={rawText}
              onChange={e => setRawText(e.target.value)}
            />
            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {rawText.trim() ? 'Questions detected' : 'No questions pasted yet'}
              </p>
              <button
                onClick={handleValidate}
                disabled={!rawText.trim() || !selectedExam}
                className="flex items-center gap-2 rounded-lg bg-black px-5 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                Validate & Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: PREVIEW */}
      {step === 'preview' && (
        <div className="space-y-4">

          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
              <p className="text-2xl font-bold text-green-700">{parsedQuestions.length}</p>
              <p className="text-sm text-green-600">Questions Ready</p>
            </div>
            <div className={`rounded-xl border p-4 text-center ${allErrors.length > 0 ? 'border-red-200 bg-red-50' : 'border-border/60 bg-muted/30'}`}>
              <p className={`text-2xl font-bold ${allErrors.length > 0 ? 'text-red-700' : 'text-muted-foreground'}`}>
                {allErrors.length}
              </p>
              <p className={`text-sm ${allErrors.length > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>Errors</p>
            </div>
            <div className={`rounded-xl border p-4 text-center ${parseWarnings.length > 0 ? 'border-yellow-200 bg-yellow-50' : 'border-border/60 bg-muted/30'}`}>
              <p className={`text-2xl font-bold ${parseWarnings.length > 0 ? 'text-yellow-700' : 'text-muted-foreground'}`}>
                {parseWarnings.length}
              </p>
              <p className={`text-sm ${parseWarnings.length > 0 ? 'text-yellow-600' : 'text-muted-foreground'}`}>Warnings</p>
            </div>
          </div>

          {/* Errors */}
          {allErrors.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <XCircle className="h-5 w-5 text-red-600" />
                <h2 className="font-semibold text-red-800">Errors — Must fix before importing</h2>
              </div>
              <ul className="space-y-1">
                {allErrors.map((err, i) => (
                  <li key={i} className="text-sm text-red-700">{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Warnings */}
          {parseWarnings.length > 0 && (
            <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <h2 className="font-semibold text-yellow-800">Warnings</h2>
              </div>
              <ul className="space-y-1">
                {parseWarnings.map((w, i) => (
                  <li key={i} className="text-sm text-yellow-700">{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Questions Preview */}
          {parsedQuestions.length > 0 && (
            <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
              <div className="border-b border-border/60 bg-muted/30 px-4 py-3 flex items-center justify-between">
                <h2 className="font-semibold">Questions Preview</h2>
                <p className="text-xs text-muted-foreground">
                  Expand a question to add images before importing
                </p>
              </div>
              <ul className="divide-y divide-border/60">
                {parsedQuestions.map((q, qIndex) => (
                  <li key={q.questionNumber}>
                    <div
                      className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/20"
                      onClick={() => toggleQuestion(q.questionNumber)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {q.questionNumber}
                        </span>
                        <span className="text-sm font-medium line-clamp-1">{q.questionText}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {(stagedImages[qIndex]?.length || 0) > 0 && (
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                            {stagedImages[qIndex].length} image{stagedImages[qIndex].length > 1 ? 's' : ''}
                          </span>
                        )}
                        {q.chapter && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                            {q.chapter}
                          </span>
                        )}
                        {expandedQuestions.has(q.questionNumber)
                          ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        }
                      </div>
                    </div>

                    {expandedQuestions.has(q.questionNumber) && (
                      <div className="border-t border-border/40 bg-muted/10 px-6 py-4 space-y-4">

                        <div className="space-y-1">
                          {(['a', 'b', 'c', 'd', 'e'] as const).map(letter => {
                            const choice = q.choices[letter]
                            if (!choice) return null
                            const isCorrect = q.correctAnswer === letter
                            return (
                              <div key={letter} className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${isCorrect ? 'bg-green-50 text-green-800 font-medium' : 'bg-white dark:bg-card'}`}>
                                <span className="font-bold uppercase">{letter}.</span>
                                <span>{choice}</span>
                                {isCorrect && <span className="ml-auto text-green-600 text-xs">✓ Correct</span>}
                              </div>
                            )
                          })}
                        </div>

                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          {q.chapter && <span>Chapter: <strong>{q.chapter}</strong></span>}
                          {q.lecture && <span>Lecture: <strong>{q.lecture}</strong></span>}
                          {q.doctorName && <span>Doctor: <strong>{q.doctorName}</strong></span>}
                        </div>

                        {q.explanation && (
                          <p className="text-sm text-muted-foreground bg-white dark:bg-card rounded-lg px-3 py-2">
                            <span className="font-medium">Explanation: </span>{q.explanation}
                          </p>
                        )}

                        {/* Image Upload */}
                        <div className="border-t border-border/40 pt-4">
                          <p className="text-xs font-medium text-muted-foreground uppercase mb-3">
                            Images (optional)
                          </p>
                          {(stagedImages[qIndex]?.length || 0) > 0 && (
                            <div className="flex flex-wrap gap-3 mb-3">
                              {stagedImages[qIndex].map((img, imgIndex) => (
                                <div key={imgIndex} className="relative group">
                                  <img src={img.previewUrl} alt="preview" className="h-20 w-20 rounded-lg object-cover border border-border/60" />
                                  <button
                                    onClick={() => removeStagedImage(qIndex, imgIndex)}
                                    className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                  <input
                                    type="text"
                                    placeholder="Caption..."
                                    value={img.caption}
                                    onChange={e => updateStagedCaption(qIndex, imgIndex, e.target.value)}
                                    className="mt-1 w-20 rounded border border-border/60 bg-background px-1 py-0.5 text-xs focus:outline-none"
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
                                if (file) addStagedImage(qIndex, file)
                                e.target.value = ''
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep('paste')}
              className="rounded-lg border border-border/60 px-5 py-2 text-sm font-medium hover:bg-muted"
            >
              ← Back
            </button>
            <button
              onClick={handleImport}
              disabled={isImporting || allErrors.length > 0 || parsedQuestions.length === 0}
              className="flex items-center gap-2 rounded-lg bg-black px-6 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {isImporting ? 'Importing...' : `Import ${parsedQuestions.length} Questions`}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: DONE */}
      {step === 'done' && importResult && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center">
          <CheckCircle className="mx-auto mb-4 h-16 w-16 text-green-500" />
          <h2 className="mb-2 text-2xl font-bold text-green-800">Import Complete!</h2>
          <p className="text-green-700 mb-6">
            Successfully imported <strong>{importResult.imported}</strong> questions.
            {importResult.errors > 0 && ` ${importResult.errors} questions failed.`}
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => { setStep('paste'); setRawText(''); setSelectedExam(''); setImportResult(null); setStagedImages({}); setExamInfo(null) }}
              className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium hover:bg-white"
            >
              Import More
            </button>
            <Link href="/admin/exams" className="rounded-lg bg-black px-5 py-2 text-sm font-medium text-white hover:bg-gray-800">
              View Exams
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

