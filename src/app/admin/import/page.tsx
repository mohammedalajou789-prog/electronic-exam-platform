'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { parseBulkImport, type ParsedQuestion, type ParseError } from '@/features/bulk-import/parser'
import { ChevronDown, ChevronUp, ImagePlus, X } from 'lucide-react'
import { ExplanationRenderer } from '@/components/exam/ExplanationRenderer'

interface Exam { id: string; title: string; batch_id: string }
interface Batch { id: string; name: string; subject_id: string }
interface Subject { id: string; name: string; semester_id: string | null; year_id: string | null }
interface Doctor { id: string; name: string }
interface Chapter { id: string; name: string; subject_id: string }
interface Lecture { id: string; name: string; chapter_id: string }
interface AcademicYear { id: string; name: string; is_clinical: boolean }
interface Semester { id: string; name: string; academic_year_id: string }

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
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [semesters, setSemesters] = useState<Semester[]>([])

  // Exam selector filters
  const [filterYear, setFilterYear] = useState('')
  const [filterSemester, setFilterSemester] = useState('')
  const [filterSubject, setFilterSubject] = useState('')
  const [filterBatch, setFilterBatch] = useState('')

  const [parsedQuestions, setParsedQuestions] = useState<ParsedQuestion[]>([])
  const [parseErrors, setParseErrors] = useState<ParseError[]>([])
  const [parseWarnings, setParseWarnings] = useState<string[]>([])
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  const [stagedImages, setStagedImages] = useState<Record<number, StagedImage[]>>({})
  const [stagedExplanationImages, setStagedExplanationImages] = useState<Record<number, Record<1|2|3, string|null>>>({})
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; errors: number } | null>(null)
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set())
  const [copiedFormat, setCopiedFormat] = useState(false)
const [copiedNames, setCopiedNames] = useState(false)
const [copiedPrompt, setCopiedPrompt] = useState(false)
const [formatExpanded, setFormatExpanded] = useState(false)
const [examInfoExpanded, setExamInfoExpanded] = useState(false)
  const [examSearch, setExamSearch] = useState('')
const [expandedSubject, setExpandedSubject] = useState<string | null>(null)

// Doctor assignment modal state
const [showDoctorModal, setShowDoctorModal] = useState(false)
const [doctorAssignments, setDoctorAssignments] = useState<Record<string, number[]>>({})
const [doctorModalStep, setDoctorModalStep] = useState(0)
const [pendingLectureNums, setPendingLectureNums] = useState<{ name: string; num: number; chapterName: string }[]>([])

  const [examInfo, setExamInfo] = useState<{
    subjectId: string
    chapters: string[]
    lectures: string[]
    lecturesWithChapter: { name: string; chapterName: string }[]
    doctors: string[]
  } | null>(null)

  useEffect(() => {
    async function load() {
      const [{ data: ex }, { data: ba }, { data: su }, { data: do_ }, { data: ch }, { data: le }, { data: yr }, { data: sm }] =
        await Promise.all([
          supabase.from('exams').select('id, title, batch_id').eq('status', 'published').is('deleted_at', null).order('title'),
          supabase.from('batches').select('*'),
          supabase.from('subjects').select('id, name, semester_id, year_id'),
          supabase.from('doctors').select('*').order('name'),
          supabase.from('chapters').select('*').order('name'),
          supabase.from('lectures').select('*').order('name'),
          supabase.from('academic_years').select('id, name, is_clinical').order('display_order'),
          supabase.from('semesters').select('id, name, academic_year_id').order('display_order'),
        ])
      setExams(ex || [])
      setBatches(ba || [])
      setSubjects(su || [])
      setDoctors(do_ || [])
      setAllChapters(ch || [])
      setAllLectures(le || [])
      setAcademicYears(yr || [])
      setSemesters(sm || [])
    }
    load()
  }, [])

  function getSubjectIdForExam(examId: string): string | null {
    const exam = exams.find(e => e.id === examId)
    const batch = batches.find(b => b.id === exam?.batch_id)
    return batch?.subject_id || null
  }

  async function handleExamSelect(examId: string, subjectName?: string) {
    setSelectedExam(examId)
    if (!examId) { setExamInfo(null); return }
    const subjectId = getSubjectIdForExam(examId)
    if (!subjectId) { setExamInfo(null); return }
    const subjectChapters = allChapters.filter(c => c.subject_id === subjectId).map(c => c.name)
    const chapterIds = allChapters.filter(c => c.subject_id === subjectId).map(c => c.id)
    const subjectLectures = allLectures.filter(l => chapterIds.includes(l.chapter_id)).map(l => l.name)
    const lecturesWithChapter = allLectures
      .filter(l => chapterIds.includes(l.chapter_id))
      .map(l => ({
        name: l.name,
        chapterName: allChapters.find(c => c.id === l.chapter_id)?.name || ''
      }))
    const { data: subjectDoctorsData } = await supabase
      .from('subject_doctors')
      .select('doctor:doctors(id, name)')
      .eq('subject_id', subjectId)
    const subjectDoctorNames = (subjectDoctorsData || []).map((sd: any) => Array.isArray(sd.doctor) ? sd.doctor[0]?.name : sd.doctor?.name).filter(Boolean)
    setExamInfo({ subjectId, chapters: subjectChapters, lectures: subjectLectures, lecturesWithChapter, doctors: subjectDoctorNames })
    if (subjectName) setExpandedSubject(subjectName)
  }

  function validateAgainstDatabase(questions: ParsedQuestion[]): string[] {
    const errors: string[] = []
    const subjectId = getSubjectIdForExam(selectedExam)
    const validChapterNames = allChapters.filter(c => c.subject_id === subjectId).map(c => c.name.toLowerCase().trim())
    const validDoctorNames = (examInfo?.doctors || []).map(n => n.toLowerCase().trim())
    for (const q of questions) {
      if (q.doctorName) {
        if (!validDoctorNames.includes(q.doctorName.toLowerCase().trim()))
          errors.push(`Question ${q.questionNumber}: Doctor "${q.doctorName}" not found. Available: ${doctors.map(d => d.name).join(', ') || 'none'}`)
      }
      if (q.chapter) {
        const chapterLower = q.chapter.toLowerCase().trim()
        if (!validChapterNames.includes(chapterLower)) {
          errors.push(`Question ${q.questionNumber}: Chapter "${q.chapter}" not found. Available: ${examInfo?.chapters.join(', ') || 'none'}`)
        } else if (q.lecture) {
          const chapter = allChapters.find(c => c.subject_id === subjectId && c.name.toLowerCase().trim() === chapterLower)
          if (chapter) {
            const validLectureNames = allLectures.filter(l => l.chapter_id === chapter.id).map(l => l.name.toLowerCase().trim())
            if (!validLectureNames.includes(q.lecture.toLowerCase().trim())) {
              const chapterLectures = allLectures.filter(l => l.chapter_id === chapter.id).map(l => l.name)
              errors.push(`Question ${q.questionNumber}: Lecture "${q.lecture}" not found under "${q.chapter}". Available: ${chapterLectures.join(', ') || 'none'}`)
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
    setStagedImages(prev => ({ ...prev, [questionIndex]: [...(prev[questionIndex] || []), { file, previewUrl, caption: '' }] }))
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
      await supabase.from('question_images').insert({ question_id: questionId, image_url: urlData.publicUrl, caption: img.caption.trim() || null, display_order: i + 1 })
    }
  }

  async function handleImport() {
    if (parseErrors.length > 0 || validationErrors.length > 0) { alert('Please fix all errors before importing.'); return }
    setIsImporting(true)
    let imported = 0; let errors = 0
    const { count: existingCount } = await supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .eq('exam_id', selectedExam)
      .is('deleted_at', null)
    const startOrder = (existingCount || 0) + 1
    for (let i = 0; i < parsedQuestions.length; i++) {
      const q = parsedQuestions[i]
      let doctorId: string | null = null
      if (q.doctorName) {
        const doctor = doctors.find(d => d.name.toLowerCase().trim() === q.doctorName!.toLowerCase().trim())
        doctorId = doctor?.id || null
      }
      const { data: inserted, error } = await supabase.from('questions').insert({
        exam_id: selectedExam, question_text: q.questionText, question_order: startOrder + i,
        choice_a: q.choices.a, choice_b: q.choices.b, choice_c: q.choices.c, choice_d: q.choices.d, choice_e: q.choices.e || null,
        correct_answer: q.correctAnswer, explanation: q.explanation || null,
        incorrect_explanation_a: q.wrongExplanations?.a || null, incorrect_explanation_b: q.wrongExplanations?.b || null,
        incorrect_explanation_c: q.wrongExplanations?.c || null, incorrect_explanation_d: q.wrongExplanations?.d || null,
        incorrect_explanation_e: q.wrongExplanations?.e || null, chapter: q.chapter || null, lecture: q.lecture || null,
      }).select('id').single()
      if (error || !inserted) { errors++; continue }
      imported++
      const images = stagedImages[i] || []
      if (images.length > 0) await uploadImagesForQuestion(inserted.id, images)
      if (doctorId) await supabase.from('exam_doctors').upsert({ exam_id: selectedExam, doctor_id: doctorId })
    }
    const { data: existingExam } = await supabase.from('exams').select('question_count').eq('id', selectedExam).single()
    await supabase.from('exams').update({ question_count: (existingExam?.question_count || 0) + imported }).eq('id', selectedExam)
    await supabase.from('bulk_imports').insert({ questions_imported: imported, errors, warnings: parseWarnings.length })
    setImportResult({ imported, errors })
    setStep('done')
    setIsImporting(false)
  }

  function toggleQuestion(num: number) {
    setExpandedQuestions(prev => { const next = new Set(prev); next.has(num) ? next.delete(num) : next.add(num); return next })
  }

  function getExamLabel(exam: Exam) {
    const batch = batches.find(b => b.id === exam.batch_id)
    const subject = subjects.find(s => s.id === batch?.subject_id)
    return `${exam.title} — ${subject?.name || ''} (${batch?.name || ''})`
  }

  const formatTemplate = `1. Question text here?
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

2. Next question...

━━━ MN SYNTAX (for Explanation) ━━━
**text**        Bold
*text*          Italic
==text==        Highlight (yellow background)
!!text!!        Callout box (orange)
~~text~~        Green text
::text::        Blue text
__text__        Underline
[Image Slot 1]  Image placeholder (upload after import)
[Image Slot 2]  Second image placeholder
[Image Slot 3]  Third image placeholder
[TABLE]
| Column 1 | Column 2 |
|----------|----------|
| Value 1  | Value 2  |
[/TABLE]`

  function copyFormat() {
    navigator.clipboard.writeText(formatTemplate)
    setCopiedFormat(true); setTimeout(() => setCopiedFormat(false), 2000)
  }

  function copyNames() {
    if (!examInfo) return
    const text = `Chapters: ${examInfo.chapters.join(' · ')}\nLectures: ${examInfo.lectures.join(' · ')}\nDoctors: ${examInfo.doctors.join(' · ')}`
    navigator.clipboard.writeText(text)
    setCopiedNames(true); setTimeout(() => setCopiedNames(false), 2000)
  }

  const allErrors = [...parseErrors.map(e => `Question ${e.questionNumber}: ${e.message}`), ...validationErrors]

  function buildAndCopyPrompt(assignments: Record<string, number[]>) {
    if (!examInfo) return

    const isMultipleDoctors = examInfo.doctors.length > 1

    // Build numbered lectures list
    const lecturesByChapter: Record<string, { name: string; num: number }[]> = {}
    let lectureCounter = 1
    const allNumberedLectures: { name: string; chapterName: string; num: number }[] = []

    examInfo.chapters.forEach(chapterName => {
      const chapterLectures = examInfo.lecturesWithChapter
        .filter(l => l.chapterName === chapterName)
        .map(l => {
          const entry = { name: l.name, chapterName, num: lectureCounter++ }
          allNumberedLectures.push(entry)
          return { name: l.name, num: entry.num }
        })
      if (chapterLectures.length > 0) {
        lecturesByChapter[chapterName] = chapterLectures
      }
    })

    const lecturesSection = Object.entries(lecturesByChapter).map(([chapter, lectures]) =>
      `  ${chapter}:\n${lectures.map(l => `    ${l.num}. ${l.name}`).join('\n')}`
    ).join('\n\n') || '  (No lectures defined)'

    // Build doctor instruction
    let doctorInstruction = ''
    let doctorRule = ''

    if (!isMultipleDoctors) {
      const singleDoc = examInfo.doctors[0] || 'N/A'
      doctorInstruction = `All questions are taught by: ${singleDoc}
Add this line to every question: Doctor: ${singleDoc}`
      doctorRule = `8. Every question must include: Doctor: ${singleDoc}`
    } else {
      // Build assignment map: doctorName → lecture nums
      const assignmentLines = examInfo.doctors.map(docName => {
        const nums = assignments[docName] || []
        if (nums.length === 0) return `  - ${docName}: (no lectures assigned)`
        const lectureNames = nums.map(n => {
          const found = allNumberedLectures.find(l => l.num === n)
          return found ? `${n}. ${found.name}` : `${n}`
        })
        return `  - ${docName}:\n${lectureNames.map(ln => `      ${ln}`).join('\n')}`
      }).join('\n\n')

      // Find unassigned lectures
      const allAssigned = Object.values(assignments).flat()
      const unassigned = allNumberedLectures.filter(l => !allAssigned.includes(l.num))
      const unassignedNote = unassigned.length > 0
        ? `\nLectures with no assigned doctor (lectures ${unassigned.map(l => l.num).join(', ')}): write these questions WITHOUT a Doctor field.`
        : ''

      doctorInstruction = `Each doctor teaches specific lectures. Assign the Doctor field based on the lecture number.

Doctor assignments:
${assignmentLines}
${unassignedNote}`

      doctorRule = `8. Assign the "Doctor:" field based on the lecture number and the assignments above. If a lecture has no assigned doctor, omit the Doctor line entirely for that question.`
    }

    const prompt = `You are a medical education assistant helping format exam questions for the Electronic Exam Platform.

Convert every question I provide into the exact format below without changing meaning, content, or correct answers.

════════════════════════════════════════
OUTPUT FORMAT (reproduce exactly):
════════════════════════════════════════

1. Question text?
A. Choice A
B. Correct choice *
C. Choice C
D. Choice D
Chapter: Chapter Name
Lecture: Lecture Name
Doctor: Doctor Name
Explanation: Explanation text
Wrong answers explanation:
A. Why A is wrong
C. Why C is wrong
D. Why D is wrong

════════════════════════════════════════
SUBJECT STRUCTURE:
════════════════════════════════════════

Chapters and their numbered lectures (use exact spelling):

${lecturesSection}

════════════════════════════════════════
DOCTORS:
════════════════════════════════════════

${doctorInstruction}

════════════════════════════════════════
EXPLANATION FORMATTING — MN SYNTAX:
════════════════════════════════════════

Enrich every explanation using these formatting tokens:

  **text**       → Bold — use for drug names, diagnoses, key terms
  *text*         → Italic — use for emphasis
  ==text==       → Yellow highlight — use for the single most important concept
  !!text!!       → Orange callout box — use for critical clinical pearls or warnings
  ~~text~~       → Green text — use for correct mechanisms or positive findings
  ::text::       → Blue text — use for pathophysiology keywords
  __text__       → Underline
  [Image Slot 1] → Image placeholder — use when a clinical image would help (max 3)
  [TABLE]
  | Column 1 | Column 2 |
  |----------|----------|
  | Value 1  | Value 2  |
  [/TABLE]       → Table — use for comparisons, criteria, or classifications

IMPORTANT — Explanation quality: Every explanation must be thorough and detailed, not just one or two lines. Cover the mechanism, why the correct answer is right, relevant clinical context, and key facts a student needs to remember. Use at least **bold** and ==highlight== in every explanation. Add !!callout!! for high-yield clinical pearls.

════════════════════════════════════════
RULES:
════════════════════════════════════════

1. Mark the correct answer with * after a space at the end of that choice line
2. Use EXACT chapter and lecture names — spelling must match the list above perfectly
3. Every question requires: question text, choices A–D, correct answer marked with *, chapter, lecture, explanation
4. The Doctor field is required only when a doctor is assigned to that lecture (see DOCTORS section above)
5. Choice E is optional
6. Wrong answer explanations are optional but strongly recommended
7. Output the formatted questions first, then append the END OF REPORT section below
8. Number questions sequentially starting from 1
${doctorRule}
9. If a question does not clearly belong to any chapter or lecture in the list above, assign the most appropriate chapter and lecture name, even if it requires creating a new one. At the end of the report, list all newly added chapters/lectures under "NEW TOPICS ADDED".
10. If you notice any errors or inconsistencies in the original questions (wrong answer, contradictory choices, unclear phrasing, etc.), list them under "QUESTION NOTES" in the end report.
11. If any question appears to require a clinical image, X-ray, ECG, histology slide, or any visual to be answered correctly, list those question numbers under "QUESTIONS REQUIRING IMAGES" in the end report.

════════════════════════════════════════
END OF REPORT FORMAT (append after all questions):
════════════════════════════════════════

═══ END REPORT ═══

NEW TOPICS ADDED:
(list any new chapter or lecture names you created, or write "None")

QUESTION NOTES:
(list any errors or issues found in the original questions, or write "None")

QUESTIONS REQUIRING IMAGES:
(list question numbers that need a visual/image, or write "None")

════════════════════════════════════════
QUESTIONS TO CONVERT:
════════════════════════════════════════

`

    navigator.clipboard.writeText(prompt)
    setCopiedPrompt(true)
    setTimeout(() => setCopiedPrompt(false), 2000)
    setShowDoctorModal(false)
  }

  function handleCraftPromptClick() {
    if (!examInfo) return
    if (examInfo.doctors.length <= 1) {
      buildAndCopyPrompt({})
      return
    }
    // Build numbered lectures for modal
    let counter = 1
    const numbered: { name: string; num: number; chapterName: string }[] = []
    examInfo.chapters.forEach(chapterName => {
      examInfo.lecturesWithChapter
        .filter(l => l.chapterName === chapterName)
        .forEach(l => { numbered.push({ name: l.name, num: counter++, chapterName }) })
    })
    setPendingLectureNums(numbered)
    setDoctorAssignments({})
    setDoctorModalStep(0)
    setShowDoctorModal(true)
  }
  const detectedCount = rawText.trim() ? (rawText.match(/^\d+\./gm) || []).length : 0

  // ── Step badge ────────────────────────────────────────────────────────────
  function StepBadge({ num, label }: { num: 1 | 2 | 3; label: string }) {
    const current = step === 'paste' ? 1 : step === 'preview' ? 2 : 3
    const isDone = num < current
    const isActive = num === current
    const bg = isDone ? '#22c55e' : isActive ? 'var(--bi-primary)' : 'var(--bi-soft)'
    const color = isDone || isActive ? '#fff' : 'var(--bi-muted)'
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
        <span style={{ width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, background: bg, color }}>
          {isDone ? '✓' : num}
        </span>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: isActive ? 'var(--bi-primary)' : 'var(--bi-muted)' }}>{label}</span>
      </div>
    )
  }

  // ── CSS ───────────────────────────────────────────────────────────────────
  const css = `
    .bi-root {
      --bi-bg:      oklch(98% 0.006 55);
      --bi-elev:    oklch(100% 0 0);
      --bi-soft:    oklch(96% 0.009 55);
      --bi-fg:      oklch(22% 0.02 50);
      --bi-muted:   oklch(46% 0.02 50);
      --bi-bd:      oklch(89% 0.012 50);
      --bi-primary: oklch(50% 0.19 25);
      --bi-psoft:   oklch(94% 0.035 25);
      --bi-shadow:  rgba(20,10,10,0.08);
    }
    .dark .bi-root {
      --bi-bg:      oklch(18% 0.01 50);
      --bi-elev:    oklch(22% 0.012 50);
      --bi-soft:    oklch(20% 0.01 50);
      --bi-fg:      oklch(92% 0.008 50);
      --bi-muted:   oklch(62% 0.015 50);
      --bi-bd:      oklch(32% 0.015 50);
      --bi-primary: oklch(68% 0.18 25);
      --bi-psoft:   oklch(28% 0.06 25);
      --bi-shadow:  rgba(0,0,0,0.35);
    }
    @keyframes bi-fade { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
    .bi-fade { animation: bi-fade 0.35s ease-out; }
    .bi-card { background: var(--bi-elev); border: 1px solid var(--bi-bd); border-radius: 18px; }
    .bi-input { width:100%; border:1px solid var(--bi-bd); background:var(--bi-soft); color:var(--bi-fg); border-radius:10px; padding:10px 13px; font-size:13.5px; outline:none; font-family:inherit; transition:border-color 0.15s,box-shadow 0.15s; }
    .bi-input:focus { border-color:var(--bi-primary); box-shadow:0 0 0 3px var(--bi-psoft); }
    .bi-textarea { width:100%; border:1px solid var(--bi-bd); background:var(--bi-soft); color:var(--bi-fg); border-radius:10px; padding:10px 13px; font-size:12.5px; outline:none; font-family:ui-monospace,monospace; line-height:1.6; resize:vertical; min-height:220px; transition:border-color 0.15s,box-shadow 0.15s; box-sizing:border-box; }
    .bi-textarea:focus { border-color:var(--bi-primary); box-shadow:0 0 0 3px var(--bi-psoft); }
    .bi-btn-primary { background:var(--bi-primary); color:#fff; border:none; border-radius:11px; padding:11px 20px; font-size:13.5px; font-weight:700; cursor:pointer; font-family:inherit; transition:opacity 0.15s,transform 0.15s; display:flex; align-items:center; gap:7px; white-space:nowrap; }
    .bi-btn-primary:hover { opacity:0.9; transform:translateY(-1px); }
    .bi-btn-primary:disabled { opacity:0.5; cursor:not-allowed; transform:none; }
    .bi-btn-ghost { background:var(--bi-soft); color:var(--bi-fg); border:1px solid var(--bi-bd); border-radius:11px; padding:10px 18px; font-size:13.5px; font-weight:700; cursor:pointer; font-family:inherit; transition:background 0.15s; display:flex; align-items:center; gap:7px; white-space:nowrap; }
    .bi-btn-ghost:hover { background:var(--bi-bd); }
    .bi-btn-copy { display:flex; align-items:center; gap:6px; font-size:11.5px; font-weight:700; color:var(--bi-primary); background:var(--bi-elev); border:1px solid var(--bi-primary); border-radius:8px; padding:5px 10px; cursor:pointer; font-family:inherit; transition:background 0.15s; }
    .bi-btn-copy:hover { background:var(--bi-psoft); }
    .bi-btn-copy-blue { display:flex; align-items:center; gap:6px; font-size:11.5px; font-weight:700; color:#3b82f6; background:var(--bi-elev); border:1px solid #3b82f6; border-radius:8px; padding:5px 10px; cursor:pointer; font-family:inherit; transition:background 0.15s; flex-shrink:0; }
    .bi-btn-copy-blue:hover { background:rgba(59,130,246,0.08); }
    .bi-q-row { display:flex; align-items:center; justify-content:space-between; padding:14px 20px; cursor:pointer; transition:background 0.12s; }
    .bi-q-row:hover { background:var(--bi-soft); }
    .bi-scrollbar::-webkit-scrollbar { width:8px; }
    .bi-scrollbar::-webkit-scrollbar-thumb { background:var(--bi-bd); border-radius:8px; }
  `

  return (
    <>
      <style>{css}</style>
      <div className="bi-root bi-fade" style={{ fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif", color:'var(--bi-fg)', maxWidth:1280, margin:'0 auto', padding:'28px 32px 64px', width:'100%' }}>

        {/* Header */}
        <h1 style={{ margin:'0 0 4px', fontSize:26, fontWeight:800 }}>Bulk Import</h1>
        <p style={{ margin:'0 0 22px', fontSize:14, color:'var(--bi-muted)' }}>Import multiple questions at once using the standard format.</p>

        {/* Steps */}
        <div style={{ display:'flex', alignItems:'center', width:'100%', marginBottom:26 }}>
          <StepBadge num={1} label="Paste" />
          <div style={{ flex:'1 1 0%', height:2, background:'var(--bi-bd)', margin:'0 14px' }} />
          <StepBadge num={2} label="Preview" />
          <div style={{ flex:'1 1 0%', height:2, background:'var(--bi-bd)', margin:'0 14px' }} />
          <StepBadge num={3} label="Done" />
        </div>

        {/* ── STEP 1 ── */}
        {step === 'paste' && (
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

            {/* Format Card */}
            <div className="bi-card" style={{ padding:'14px 18px', background:'var(--bi-psoft)', borderColor:'transparent' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <button onClick={() => setFormatExpanded(v => !v)} style={{ display:'flex', alignItems:'center', gap:7, background:'none', border:'none', cursor:'pointer', padding:0, fontFamily:'inherit' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--bi-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition:'transform 0.2s', transform: formatExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}><polyline points="9 18 15 12 9 6"/></svg>
                  <span style={{ fontSize:13.5, fontWeight:800, color:'var(--bi-primary)' }}>Question Format</span>
                  {!formatExpanded && <span style={{ fontSize:11.5, color:'var(--bi-primary)', opacity:0.6, fontWeight:400 }}>— click to expand</span>}
                </button>
                <button className="bi-btn-copy" onClick={copyFormat}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  {copiedFormat ? 'Copied!' : 'Copy'}
                </button>
              </div>
              {formatExpanded && (
                <div style={{ marginTop:12 }}>
                  <pre style={{ margin:0, fontFamily:'ui-monospace,monospace', fontSize:12, lineHeight:1.7, color:'var(--bi-primary)', whiteSpace:'pre-wrap' }}>{formatTemplate}</pre>
                  <div style={{ fontSize:11.5, color:'var(--bi-primary)', opacity:0.8, marginTop:10 }}>Spacing around ":" is flexible — "Chapter: X", "Chapter:X", "Chapter : X" all work.</div>

                
                </div>
              )}
            </div>

            {/* Select Exam — New Design */}
            <div className="bi-card" style={{ padding:22 }}>
              <div style={{ fontSize:14, fontWeight:800, marginBottom:16 }}>Select Target Exam</div>

              <div style={{ display:'grid', gridTemplateColumns:'220px 1fr', gap:16, alignItems:'start' }}>

                {/* Left: Filters */}
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  <select className="bi-input" value={filterYear} onChange={e => { setFilterYear(e.target.value); setFilterSemester(''); setFilterSubject(''); setFilterBatch(''); setSelectedExam(''); setExamInfo(null); setExamSearch(''); setExpandedSubject(null) }}>
                    <option value="">Select Year...</option>
                    {academicYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
                  </select>

                  {filterYear && !academicYears.find(y => y.id === filterYear)?.is_clinical && (
                    <select className="bi-input" style={{ background:'var(--bi-psoft)', color:'var(--bi-primary)', fontWeight:700 }} value={filterSemester} onChange={e => { setFilterSemester(e.target.value); setFilterSubject(''); setFilterBatch(''); setSelectedExam(''); setExamInfo(null); setExamSearch(''); setExpandedSubject(null) }}>
                      <option value="">Select Semester...</option>
                      {semesters.filter(s => s.academic_year_id === filterYear).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  )}

                  <select className="bi-input" value={filterSubject} onChange={e => { setFilterSubject(e.target.value); setFilterBatch(''); setSelectedExam(''); setExamInfo(null); setExamSearch(''); setExpandedSubject(e.target.value ? subjects.find(s=>s.id===e.target.value)?.name||null : null) }}>
                    <option value="">All Subjects</option>
                    {(() => {
                      let filtered = subjects
                      if (filterYear) {
                        const yearObj = academicYears.find(y => y.id === filterYear)
                        if (yearObj?.is_clinical) {
                          filtered = filtered.filter(s => s.year_id === filterYear)
                        } else {
                          const yearSems = semesters.filter(s => s.academic_year_id === filterYear).map(s => s.id)
                          filtered = filtered.filter(s => s.semester_id && yearSems.includes(s.semester_id))
                          if (filterSemester) filtered = filtered.filter(s => s.semester_id === filterSemester)
                        }
                      }
                      return filtered.map(s => <option key={s.id} value={s.id}>{s.name}</option>)
                    })()}
                  </select>

                  <select className="bi-input" value={filterBatch} onChange={e => { setFilterBatch(e.target.value); setSelectedExam(''); setExamInfo(null) }} disabled={!filterSubject}>
                    <option value="">All Batches</option>
                    {batches.filter(b => b.subject_id === filterSubject).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>

                  {/* Match count chip */}
                  {(() => {
                    const readyForExams = !!filterYear && (academicYears.find(y=>y.id===filterYear)?.is_clinical || !!filterSemester || semesters.filter(s=>s.academic_year_id===filterYear).length===0)
                    if (!readyForExams) return null
                    let allFiltered = exams
                    if (filterBatch) { allFiltered = allFiltered.filter(e => e.batch_id === filterBatch) }
                    else if (filterSubject) { const sb = batches.filter(b=>b.subject_id===filterSubject).map(b=>b.id); allFiltered=allFiltered.filter(e=>sb.includes(e.batch_id)) }
                    else { const yearObj=academicYears.find(y=>y.id===filterYear); let sids:string[]; if(yearObj?.is_clinical){sids=subjects.filter(s=>s.year_id===filterYear).map(s=>s.id)}else{const ys=semesters.filter(s=>s.academic_year_id===filterYear).map(s=>s.id);let ss=subjects.filter(s=>s.semester_id&&ys.includes(s.semester_id));if(filterSemester)ss=ss.filter(s=>s.semester_id===filterSemester);sids=ss.map(s=>s.id)}; const yb=batches.filter(b=>sids.includes(b.subject_id)).map(b=>b.id); allFiltered=allFiltered.filter(e=>yb.includes(e.batch_id)) }
                    return (
                      <div style={{ marginTop:6, padding:'12px 13px', borderRadius:10, background:'var(--bi-psoft)', fontSize:11.5, lineHeight:1.6, color:'var(--bi-primary)' }}>
                        <strong>{allFiltered.length}</strong> exam(s) match these filters.
                      </div>
                    )
                  })()}
                </div>

                {/* Right: Exams panel */}
                <div style={{ display:'flex', flexDirection:'column', gap:10, minWidth:0 }}>
                  {(() => {
                    const isPreclinical = filterYear && !academicYears.find(y=>y.id===filterYear)?.is_clinical && semesters.filter(s=>s.academic_year_id===filterYear).length>0
                    const readyForExams = !!filterYear && (!isPreclinical || !!filterSemester)
                    const promptText = !filterYear ? 'Select an academic year' : 'Select a semester'

                    if (!readyForExams) return (
                      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:260, gap:8, color:'var(--bi-muted)', textAlign:'center', padding:20, border:'1px dashed var(--bi-bd)', borderRadius:14, background:'var(--bi-soft)' }}>
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity:0.5 }}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        <span style={{ fontSize:13, fontWeight:700 }}>{promptText}</span>
                        <span style={{ fontSize:11.5 }}>Exams appear once these are set</span>
                      </div>
                    )

                    // Build filtered exams
                    let filteredExams = exams
                    if (filterBatch) { filteredExams = filteredExams.filter(e => e.batch_id === filterBatch) }
                    else if (filterSubject) { const sb = batches.filter(b=>b.subject_id===filterSubject).map(b=>b.id); filteredExams=filteredExams.filter(e=>sb.includes(e.batch_id)) }
                    else { const yearObj=academicYears.find(y=>y.id===filterYear); let sids:string[]; if(yearObj?.is_clinical){sids=subjects.filter(s=>s.year_id===filterYear).map(s=>s.id)}else{const ys=semesters.filter(s=>s.academic_year_id===filterYear).map(s=>s.id);let ss=subjects.filter(s=>s.semester_id&&ys.includes(s.semester_id));if(filterSemester)ss=ss.filter(s=>s.semester_id===filterSemester);sids=ss.map(s=>s.id)}; const yb=batches.filter(b=>sids.includes(b.subject_id)).map(b=>b.id); filteredExams=filteredExams.filter(e=>yb.includes(e.batch_id)) }

                    const q = examSearch.trim().toLowerCase()
                    if (q) filteredExams = filteredExams.filter(e => e.title.toLowerCase().includes(q) || (subjects.find(s=>s.id===batches.find(b=>b.id===e.batch_id)?.subject_id)?.name||'').toLowerCase().includes(q))

                    // Group by subject
                    const grouped: Record<string, { subjectName: string; exams: typeof filteredExams }> = {}
                    filteredExams.forEach(exam => {
                      const batch = batches.find(b => b.id === exam.batch_id)
                      const subject = subjects.find(s => s.id === batch?.subject_id)
                      const subName = subject?.name || 'Unknown'
                      if (!grouped[subName]) grouped[subName] = { subjectName: subName, exams: [] }
                      grouped[subName].exams.push(exam)
                    })

                    return (
                      <>
                        {/* Search + selected pill */}
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <div style={{ position:'relative', flex:1 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--bi-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            <input type="text" placeholder="Search exams..." value={examSearch} onChange={e => setExamSearch(e.target.value)} className="bi-input" style={{ paddingLeft:34 }} />
                          </div>
                          {selectedExam && (
                            <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0, fontSize:11.5, fontWeight:800, color:'var(--bi-primary)', background:'var(--bi-psoft)', borderRadius:20, padding:'6px 8px 6px 12px', whiteSpace:'nowrap' }}>
                              1 selected
                              <button onClick={() => { setSelectedExam(''); setExamInfo(null) }} style={{ width:18, height:18, borderRadius:'50%', border:'none', background:'var(--bi-primary)', color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:0 }}>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Grouped list */}
                        <div style={{ border:'1px solid var(--bi-bd)', borderRadius:14, overflow:'hidden' }}>
                          <div className="bi-scrollbar" style={{ maxHeight:480, overflowY:'auto' }}>
                            {Object.keys(grouped).length === 0 ? (
                              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:200, gap:8, color:'var(--bi-muted)', textAlign:'center', padding:20 }}>
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity:0.4 }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                <span style={{ fontSize:13 }}>No exams found</span>
                                <span style={{ fontSize:11.5 }}>Try adjusting the search or filters</span>
                              </div>
                            ) : Object.values(grouped).map(group => {
                              const isExpanded = expandedSubject === group.subjectName
                              return (
                                <div key={group.subjectName}>
                                  {/* Subject header */}
                                  <div
                                    onClick={() => setExpandedSubject(isExpanded ? null : group.subjectName)}
                                    style={{ position:'sticky', top:0, zIndex:1, display:'flex', alignItems:'center', justifyContent:'space-between', padding: isExpanded ? '9px 16px' : '6px 16px', background: isExpanded ? 'var(--bi-psoft)' : 'var(--bi-soft)', borderBottom:'1px solid var(--bi-bd)', cursor:'pointer', transition:'padding 0.15s' }}
                                  >
                                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                      <span style={{ fontSize: isExpanded ? '11.5px' : '10.5px', fontWeight:800, color: isExpanded ? 'var(--bi-primary)' : 'var(--bi-muted)', textTransform:'uppercase', letterSpacing:'0.04em' }}>{group.subjectName}</span>
                                      <span style={{ fontSize:11, fontWeight:700, color:'var(--bi-muted)', background:'var(--bi-elev)', border:'1px solid var(--bi-bd)', borderRadius:20, padding:'1px 8px' }}>{group.exams.length}</span>
                                    </div>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--bi-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)', transition:'transform 0.2s' }}><polyline points="6 9 12 15 18 9"/></svg>
                                  </div>

                                  {/* Exam rows */}
                                  {isExpanded && (
                                    <div style={{ maxHeight:280, overflowY:'auto' }}>
                                      {group.exams.map((exam, idx) => {
                                        const isSelected = selectedExam === exam.id
                                        const batch = batches.find(b => b.id === exam.batch_id)
                                        return (
                                          <div
                                            key={exam.id}
                                            onClick={() => handleExamSelect(exam.id, group.subjectName)}
                                            style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 16px 11px 13px', cursor:'pointer', borderBottom: idx < group.exams.length-1 ? '1px solid var(--bi-bd)' : 'none', background: isSelected ? 'var(--bi-psoft)' : 'transparent', borderLeft:`3px solid ${isSelected ? 'var(--bi-primary)' : 'transparent'}`, transition:'background 0.12s' }}
                                            onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background='var(--bi-soft)' }}
                                            onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background='transparent' }}
                                          >
                                            <div style={{ width:34, height:34, borderRadius:10, flexShrink:0, background: isSelected ? 'var(--bi-primary)' : 'var(--bi-soft)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={isSelected ? '#fff' : 'var(--bi-muted)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                            </div>
                                            <div style={{ flex:1, minWidth:0 }}>
                                              <div style={{ fontSize:13.5, fontWeight:700, color: isSelected ? 'var(--bi-primary)' : 'var(--bi-fg)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{exam.title}</div>
                                              <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:2 }}>
                                                <span style={{ fontSize:11.5, color:'var(--bi-muted)', whiteSpace:'nowrap' }}>{group.subjectName}</span>
                                                {batch && <span style={{ fontSize:11.5, fontWeight:600, padding:'1px 8px', borderRadius:20, background: isSelected ? 'var(--bi-primary)' : 'var(--bi-soft)', color: isSelected ? '#fff' : 'var(--bi-muted)', whiteSpace:'nowrap' }}>{batch.name}</span>}
                                              </div>
                                            </div>
                                            {isSelected && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--bi-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}><polyline points="20 6 9 17 4 12"/></svg>}
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </>
                    )
                  })()}
                </div>

              </div>
            </div>

            {/* Exam Info */}
            {examInfo && (
              <div className="bi-card" style={{ padding:'14px 18px', borderColor:'#3b82f6', background:'rgba(239,246,255,0.5)' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <button
                    onClick={() => setExamInfoExpanded(v => !v)}
                    style={{ display:'flex', alignItems:'center', gap:7, background:'none', border:'none', cursor:'pointer', padding:0, fontFamily:'inherit' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition:'transform 0.2s', transform: examInfoExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}><polyline points="9 18 15 12 9 6"/></svg>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                    <span style={{ fontSize:13, fontWeight:800, color:'#3b82f6' }}>Subject Information</span>
                    {!examInfoExpanded && <span style={{ fontSize:11.5, color:'#3b82f6', opacity:0.6, fontWeight:400 }}>— click to expand</span>}
                  </button>
                  <div style={{ display:'flex', gap:8 }}>
                    <button className="bi-btn-copy-blue" onClick={copyNames}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      {copiedNames ? 'Copied!' : 'Copy'}
                    </button>
                    <button
                      onClick={handleCraftPromptClick}
                      style={{ display:'flex', alignItems:'center', gap:6, fontSize:11.5, fontWeight:700, color:'#7c3aed', background:'#f5f3ff', border:'1px solid #7c3aed', borderRadius:8, padding:'5px 10px', cursor:'pointer', fontFamily:'inherit', transition:'background 0.15s', flexShrink:0 }}
                      onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background='#ede9fe'}
                      onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background='#f5f3ff'}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 8v4l3 3"/><path d="M18 2l4 4-4 4"/><path d="M22 2l-4 4"/></svg>
                      {copiedPrompt ? 'Copied!' : 'Craft AI Prompt'}
                    </button>
                  </div>
                </div>
                {examInfoExpanded && (
                  <div style={{ marginTop:12, fontSize:12.5, lineHeight:1.8, color:'var(--bi-muted)' }}>
                    <div><strong style={{ color:'var(--bi-fg)' }}>Chapters: </strong>{examInfo.chapters.length > 0 ? examInfo.chapters.join(' · ') : <em>No chapters defined</em>}</div>
                    <div><strong style={{ color:'var(--bi-fg)' }}>Lectures: </strong>{examInfo.lectures.length > 0 ? examInfo.lectures.join(' · ') : <em>No lectures defined</em>}</div>
                    <div><strong style={{ color:'var(--bi-fg)' }}>Doctors: </strong>{examInfo.doctors.length > 0 ? examInfo.doctors.join(' · ') : <em>No doctors defined</em>}</div>
                  </div>
                )}
              </div>
            )}

            {/* Paste Area */}
            <div className="bi-card" style={{ padding:22 }}>
              <div style={{ fontSize:14, fontWeight:800, marginBottom:10 }}>Paste Questions</div>
              <textarea className="bi-textarea" placeholder="Paste your questions here using the format shown above..." value={rawText} onChange={e => setRawText(e.target.value)} />
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:14, flexWrap:'wrap', gap:10 }}>
                <span style={{ fontSize:12, color:'var(--bi-muted)' }}>{detectedCount > 0 ? `${detectedCount} question(s) detected` : '0 question(s) detected'}</span>
                <button className="bi-btn-primary" onClick={handleValidate} disabled={!rawText.trim() || !selectedExam}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  Validate &amp; Preview
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2 ── */}
        {step === 'preview' && (
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

            {/* Stats */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
              <div style={{ background:'#dcfce7', borderRadius:16, padding:20, textAlign:'center' }}>
                <div style={{ fontSize:28, fontWeight:800, color:'#16a34a' }}>{parsedQuestions.length}</div>
                <div style={{ fontSize:12.5, fontWeight:700, color:'#16a34a', marginTop:4 }}>Questions Ready</div>
              </div>
              <div style={{ background:allErrors.length>0?'#fee2e2':'var(--bi-soft)', borderRadius:16, padding:20, textAlign:'center' }}>
                <div style={{ fontSize:28, fontWeight:800, color:allErrors.length>0?'#dc2626':'var(--bi-muted)' }}>{allErrors.length}</div>
                <div style={{ fontSize:12.5, fontWeight:700, color:allErrors.length>0?'#dc2626':'var(--bi-muted)', marginTop:4 }}>Errors</div>
              </div>
              <div style={{ background:parseWarnings.length>0?'#ffedd5':'var(--bi-soft)', borderRadius:16, padding:20, textAlign:'center' }}>
                <div style={{ fontSize:28, fontWeight:800, color:parseWarnings.length>0?'#ea580c':'var(--bi-muted)' }}>{parseWarnings.length}</div>
                <div style={{ fontSize:12.5, fontWeight:700, color:parseWarnings.length>0?'#ea580c':'var(--bi-muted)', marginTop:4 }}>Warnings</div>
              </div>
            </div>

            {/* Errors */}
            {allErrors.length > 0 && (
              <div className="bi-card" style={{ padding:'18px 20px', borderColor:'#fca5a5', background:'#fef2f2' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                  <span style={{ fontSize:13.5, fontWeight:800, color:'#dc2626' }}>Errors — Must fix before importing</span>
                </div>
                <ul style={{ margin:0, padding:'0 0 0 18px', display:'flex', flexDirection:'column', gap:4 }}>
                  {allErrors.map((err, i) => <li key={i} style={{ fontSize:13, color:'#b91c1c' }}>{err}</li>)}
                </ul>
              </div>
            )}

            {/* Warnings */}
            {parseWarnings.length > 0 && (
              <div className="bi-card" style={{ padding:'18px 20px', borderColor:'#fcd34d', background:'#fffbeb' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  <span style={{ fontSize:13.5, fontWeight:800, color:'#d97706' }}>Warnings</span>
                </div>
                <ul style={{ margin:0, padding:'0 0 0 18px', display:'flex', flexDirection:'column', gap:4 }}>
                  {parseWarnings.map((w, i) => <li key={i} style={{ fontSize:13, color:'#b45309' }}>{w}</li>)}
                </ul>
              </div>
            )}

            {/* Questions */}
            {parsedQuestions.length > 0 && (
              <div className="bi-card" style={{ overflow:'hidden' }}>
                <div style={{ padding:'18px 20px', borderBottom:'1px solid var(--bi-bd)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span style={{ fontSize:14.5, fontWeight:800 }}>Questions Preview</span>
                  <span style={{ fontSize:12, color:'var(--bi-muted)' }}>Expand a question to add images before importing</span>
                </div>
                <div className="bi-scrollbar" style={{ display:'flex', flexDirection:'column', maxHeight:700, overflowY:'auto' }}>
                  {parsedQuestions.map((q, qIndex) => (
                    <div key={q.questionNumber} style={{ borderBottom:'1px solid var(--bi-bd)' }}>
                      <div className="bi-q-row" onClick={() => toggleQuestion(q.questionNumber)}>
                        <div style={{ display:'flex', alignItems:'center', gap:12, minWidth:0 }}>
                          <span style={{ width:26, height:26, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, background:'var(--bi-psoft)', color:'var(--bi-primary)', flexShrink:0 }}>
                            {q.questionNumber}
                          </span>
                          <span style={{ fontSize:13.5, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{q.questionText}</span>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0, marginLeft:12 }}>
                          {(stagedImages[qIndex]?.length||0)>0 && <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20, background:'rgba(59,130,246,0.1)', color:'#3b82f6' }}>{stagedImages[qIndex].length} img</span>}
                          {q.chapter && <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20, background:'var(--bi-psoft)', color:'var(--bi-primary)' }}>{q.chapter}</span>}
                          {expandedQuestions.has(q.questionNumber) ? <ChevronUp width={15} height={15} style={{ color:'var(--bi-muted)' }}/> : <ChevronDown width={15} height={15} style={{ color:'var(--bi-muted)'}}/>}
                        </div>
                      </div>

                      {expandedQuestions.has(q.questionNumber) && (
                        <div style={{ padding:'16px 20px', background:'var(--bi-soft)', borderTop:'1px solid var(--bi-bd)', display:'flex', flexDirection:'column', gap:12 }}>
                          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                            {(['a','b','c','d','e'] as const).map(letter => {
                              const choice = q.choices[letter]; if (!choice) return null
                              const isCorrect = q.correctAnswer === letter
                              return (
                                <div key={letter} style={{ display:'flex', alignItems:'flex-start', gap:8, padding:'8px 12px', borderRadius:10, fontSize:13, background:isCorrect?'#dcfce7':'var(--bi-elev)', color:isCorrect?'#15803d':'var(--bi-fg)', fontWeight:isCorrect?700:400 }}>
                                  <span style={{ fontWeight:800, textTransform:'uppercase', flexShrink:0 }}>{letter}.</span>
                                  <span style={{ flex:1 }}>{choice}</span>
                                  {isCorrect && <span style={{ fontSize:11, color:'#16a34a', flexShrink:0 }}>✓ Correct</span>}
                                </div>
                              )
                            })}
                          </div>
                          <div style={{ display:'flex', flexWrap:'wrap', gap:12, fontSize:12.5, color:'var(--bi-muted)' }}>
                            {q.chapter    && <span>Chapter: <strong style={{ color:'var(--bi-fg)' }}>{q.chapter}</strong></span>}
                            {q.lecture    && <span>Lecture: <strong style={{ color:'var(--bi-fg)' }}>{q.lecture}</strong></span>}
                            {q.doctorName && <span>Doctor: <strong style={{ color:'var(--bi-fg)' }}>{q.doctorName}</strong></span>}
                          </div>
                          {q.explanation && (() => {
                            const currentSlotImages = stagedExplanationImages[qIndex] ?? { 1: null, 2: null, 3: null }
                            return (
                              <ExplanationRenderer
                                content={q.explanation}
                                slotImages={currentSlotImages}
                                onSlotUpload={(slotNumber, file) => {
                                  const previewUrl = URL.createObjectURL(file)
                                  setStagedExplanationImages(prev => {
                                    const updated = {
                                      ...prev,
                                      [qIndex]: {
                                        1: prev[qIndex]?.[1] ?? null,
                                        2: prev[qIndex]?.[2] ?? null,
                                        3: prev[qIndex]?.[3] ?? null,
                                        [slotNumber]: previewUrl,
                                      }
                                    }
                                    return updated
                                  })
                                }}
                              />
                            )
                          })()}
                          <div style={{ borderTop:'1px solid var(--bi-bd)', paddingTop:12 }}>
                            <div style={{ fontSize:11.5, fontWeight:700, color:'var(--bi-muted)', textTransform:'uppercase', marginBottom:10, letterSpacing:'0.05em' }}>Images (optional)</div>
                            {(stagedImages[qIndex]?.length||0)>0 && (
                              <div style={{ display:'flex', flexWrap:'wrap', gap:10, marginBottom:10 }}>
                                {stagedImages[qIndex].map((img, imgIndex) => (
                                  <div key={imgIndex} style={{ position:'relative' }}>
                                    <img src={img.previewUrl} alt="preview" style={{ width:80, height:80, borderRadius:10, objectFit:'cover', border:'1px solid var(--bi-bd)', display:'block' }}/>
                                    <button onClick={() => removeStagedImage(qIndex,imgIndex)} style={{ position:'absolute', top:-6, right:-6, width:20, height:20, borderRadius:'50%', background:'#ef4444', color:'#fff', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                                      <X width={11} height={11}/>
                                    </button>
                                    <input type="text" placeholder="Caption..." value={img.caption} onChange={e=>updateStagedCaption(qIndex,imgIndex,e.target.value)} style={{ marginTop:4, width:80, borderRadius:6, border:'1px solid var(--bi-bd)', background:'var(--bi-elev)', color:'var(--bi-fg)', padding:'2px 6px', fontSize:11, outline:'none' }}/>
                                  </div>
                                ))}
                              </div>
                            )}
                            <label style={{ display:'flex', alignItems:'center', gap:7, width:'fit-content', cursor:'pointer', borderRadius:9, border:'1px solid var(--bi-bd)', padding:'7px 13px', fontSize:12.5, fontWeight:600, color:'var(--bi-muted)', background:'var(--bi-elev)' }}>
                              <ImagePlus width={14} height={14}/>
                              Add Image
                              <input type="file" accept="image/*" style={{ display:'none' }} onChange={e=>{ const file=e.target.files?.[0]; if(file) addStagedImage(qIndex,file); e.target.value='' }}/>
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display:'flex', gap:10 }}>
              <button className="bi-btn-ghost" onClick={() => setStep('paste')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                Back
              </button>
              <button className="bi-btn-primary" onClick={handleImport} disabled={isImporting||allErrors.length>0||parsedQuestions.length===0}>
                {isImporting ? 'Importing...' : `Import ${parsedQuestions.length} Questions`}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3 ── */}
        {step === 'done' && importResult && (
          <div className="bi-card" style={{ padding:'60px 40px', textAlign:'center' }}>
            <div style={{ width:64, height:64, borderRadius:'50%', background:'#dcfce7', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h2 style={{ margin:'0 0 8px', fontSize:22, fontWeight:800 }}>Import Complete!</h2>
            <p style={{ margin:'0 0 28px', fontSize:14, color:'var(--bi-muted)' }}>
              Successfully imported <strong style={{ color:'var(--bi-fg)' }}>{importResult.imported}</strong> questions.
              {importResult.errors > 0 && ` ${importResult.errors} questions failed.`}
            </p>
            <div style={{ display:'flex', justifyContent:'center', gap:10 }}>
              <button className="bi-btn-ghost" onClick={() => { setStep('paste'); setRawText(''); setSelectedExam(''); setImportResult(null); setStagedImages({}); setExamInfo(null) }}>
                Import More
              </button>
              <Link href="/admin/exams" className="bi-btn-primary">View Exams</Link>
            </div>
          </div>
        )}

      </div>

      {/* ── Doctor Assignment Modal ── */}
      {showDoctorModal && examInfo && (() => {
        const doctors = examInfo.doctors
        const currentDoctor = doctors[doctorModalStep]
        const isLast = doctorModalStep === doctors.length - 1
        const currentNums = doctorAssignments[currentDoctor] || []
        const allAssignedSoFar = Object.entries(doctorAssignments)
          .filter(([doc]) => doc !== currentDoctor)
          .flatMap(([, nums]) => nums)

        return (
          <div style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
            <div style={{ background:'var(--bg-elev,#ffffff)', border:'1px solid var(--bd,#e5e5e5)', borderRadius:18, width:'100%', maxWidth:620, boxShadow:'0 8px 40px rgba(20,10,10,0.15)', display:'flex', flexDirection:'column', overflow:'hidden', height:'88vh' }}>

              {/* Header */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 24px 16px', borderBottom:'1px solid #e5e0da' }}>
                <div style={{ fontSize:17, fontWeight:800, color:'#1a1a1a' }}>Craft AI Prompt</div>
                <button onClick={() => setShowDoctorModal(false)} style={{ width:30, height:30, borderRadius:'50%', border:'1px solid #e5e0da', background:'#faf9f7', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#9a8a7a' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>

              {/* Progress bar */}
              <div style={{ height:3, background:'#f0ece8' }}>
                <div style={{ height:'100%', background:'oklch(50% 0.19 25)', transition:'width 0.3s ease', width:`${((doctorModalStep + 1) / doctors.length) * 100}%` }} />
              </div>

              {/* Doctor info */}
              <div style={{ padding:'18px 24px 0' }}>
                <div style={{ fontSize:11, fontWeight:800, color:'#9a8a7a', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:5 }}>
                  Doctor {doctorModalStep + 1} of {doctors.length}
                </div>
                <div style={{ fontSize:14.5, fontWeight:800, color:'#1a1a1a', marginBottom:3 }}>
                  Assign lectures to <span style={{ color:'oklch(50% 0.19 25)' }}>{currentDoctor}</span>
                </div>
                <div style={{ fontSize:12.5, color:'#9a8a7a', marginBottom:14 }}>
                  Select the lectures this doctor teaches. Unselected lectures will be written without a doctor name.
                </div>
              </div>

              {/* Lecture list */}
              <div style={{ padding:'0 24px', overflowY:'auto', flex:'1 1 0', minHeight:0 }}>
                {examInfo.chapters.map(chapterName => {
                  const chapterLectures = pendingLectureNums.filter(l => l.chapterName === chapterName)
                  if (chapterLectures.length === 0) return null
                  return (
                    <div key={chapterName} style={{ marginBottom:14 }}>
                      <div style={{ fontSize:10.5, fontWeight:800, color:'#9a8a7a', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:7, paddingLeft:2 }}>
                        {chapterName}
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                        {chapterLectures.map(lec => {
                          const isChecked = currentNums.includes(lec.num)
                          const isTakenByOther = allAssignedSoFar.includes(lec.num)
                          return (
                            <label key={lec.num} style={{ display:'flex', alignItems:'center', gap:11, padding:'9px 13px', borderRadius:10, cursor: isTakenByOther ? 'default' : 'pointer', border:`1.5px solid ${isChecked ? 'oklch(50% 0.19 25)' : '#e5e0da'}`, background: isChecked ? 'oklch(94% 0.035 25)' : '#faf9f7', opacity: isTakenByOther ? 0.4 : 1, transition:'border-color 0.15s, background 0.15s' }}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                disabled={isTakenByOther}
                                onChange={() => {
                                  if (isTakenByOther) return
                                  setDoctorAssignments(prev => {
                                    const prevNums = prev[currentDoctor] || []
                                    const updated = isChecked ? prevNums.filter(n => n !== lec.num) : [...prevNums, lec.num]
                                    return { ...prev, [currentDoctor]: updated }
                                  })
                                }}
                                style={{ accentColor:'oklch(50% 0.19 25)', width:15, height:15, flexShrink:0 }}
                              />
                              <span style={{ fontSize:12.5, color:'#9a8a7a', fontWeight:700, flexShrink:0, minWidth:20 }}>{lec.num}.</span>
                              <span style={{ fontSize:13.5, fontWeight: isChecked ? 700 : 400, color: isChecked ? 'oklch(50% 0.19 25)' : '#1a1a1a', flex:1 }}>{lec.name}</span>
                              {isTakenByOther && <span style={{ fontSize:11, color:'#9a8a7a', background:'#f0ece8', border:'1px solid #e5e0da', borderRadius:20, padding:'2px 8px', flexShrink:0 }}>taken</span>}
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
                <div style={{ height:16 }} />
              </div>

              {/* Footer */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 24px 20px', borderTop:'1px solid #e5e0da', flexShrink:0 }}>
                <button onClick={() => setShowDoctorModal(false)} style={{ background:'#f5f0ec', color:'#5a4a3a', border:'1px solid #e5e0da', borderRadius:11, padding:'10px 18px', fontSize:13.5, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                  Cancel
                </button>
                <div style={{ display:'flex', gap:8 }}>
                  {doctorModalStep > 0 && (
                    <button onClick={() => setDoctorModalStep(s => s - 1)} style={{ background:'#f5f0ec', color:'#5a4a3a', border:'1px solid #e5e0da', borderRadius:11, padding:'10px 18px', fontSize:13.5, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                      ← Back
                    </button>
                  )}
                  <button
                    onClick={() => { if (isLast) { buildAndCopyPrompt(doctorAssignments) } else { setDoctorModalStep(s => s + 1) } }}
                    style={{ background:'oklch(50% 0.19 25)', color:'#fff', border:'none', borderRadius:11, padding:'10px 20px', fontSize:13.5, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}
                  >
                    {isLast ? '✓ Copy Prompt' : `Next → ${doctors[doctorModalStep + 1]}`}
                  </button>
                </div>
              </div>

            </div>
          </div>
        )
      })()}

    </>
  )
}