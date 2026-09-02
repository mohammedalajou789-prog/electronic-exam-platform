'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, ImagePlus, X, Save, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { MnEditor } from '@/components/shared/MnEditor'

interface Exam { id: string; title: string; batch_id: string }
interface Batch { id: string; name: string; subject_id: string }
interface Subject { id: string; name: string; semester_id: string | null; year_id: string | null }
interface Doctor { id: string; name: string }
interface Chapter { id: string; name: string; subject_id: string }
interface Lecture { id: string; name: string; chapter_id: string }
interface AcademicYear { id: string; name: string; is_clinical: boolean }
interface Semester { id: string; name: string; academic_year_id: string }

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

export default function ManualImportPage() {
  const supabase = createClient()

  const [exams, setExams] = useState<Exam[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [allChapters, setAllChapters] = useState<Chapter[]>([])
  const [allLectures, setAllLectures] = useState<Lecture[]>([])
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [semesters, setSemesters] = useState<Semester[]>([])

  // Exam selector state
  const [filterYear, setFilterYear] = useState('')
  const [filterSemester, setFilterSemester] = useState('')
  const [filterSubject, setFilterSubject] = useState('')
  const [filterBatch, setFilterBatch] = useState('')
  const [examSearch, setExamSearch] = useState('')
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null)

  const [selectedExam, setSelectedExam] = useState('')
  const [currentSubjectId, setCurrentSubjectId] = useState('')
  const [examDoctorIds, setExamDoctorIds] = useState<string[]>([])

  const [questions, setQuestions] = useState<QuestionForm[]>([emptyQuestion()])
  const [isSaving, setIsSaving] = useState(false)
  const [savedCount, setSavedCount] = useState(0)
  const [isDone, setIsDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const [{ data: ex }, { data: ba }, { data: su }, { data: do_ }, { data: ch }, { data: le }, { data: yr }, { data: sm }] =
        await Promise.all([
          supabase.from('exams').select('id, title, batch_id').neq('status', 'archived').is('deleted_at', null).order('title'),
          supabase.from('batches').select('*'),
          supabase.from('subjects').select('id, name, semester_id, year_id'),
          supabase.from('doctors').select('*').order('name'),
          supabase.from('chapters').select('*').order('display_order'),
          supabase.from('lectures').select('*').order('display_order'),
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

  async function handleExamSelect(examId: string, subjectName?: string) {
    setSelectedExam(examId)
    if (!examId) { setCurrentSubjectId(''); setExamDoctorIds([]); return }
    const exam = exams.find(e => e.id === examId)
    const batch = batches.find(b => b.id === exam?.batch_id)
    const subjectId = batch?.subject_id || ''
    setCurrentSubjectId(subjectId)
    setQuestions(prev => prev.map(q => ({ ...q, chapter_id: '', lecture_id: '', doctor_id: '' })))
    if (subjectName) setExpandedSubject(subjectName)
    // Fetch doctors linked to this exam
    const { data: examDocs } = await supabase
      .from('exam_doctors')
      .select('doctor_id')
      .eq('exam_id', examId)
    setExamDoctorIds((examDocs || []).map(d => d.doctor_id))
  }

  const subjectChapters = allChapters.filter(c => c.subject_id === currentSubjectId)

  function getLecturesForChapter(chapterId: string) {
    return allLectures.filter(l => l.chapter_id === chapterId)
  }

  function updateQuestion(index: number, field: keyof QuestionForm, value: string) {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== index) return q
      if (field === 'chapter_id') return { ...q, chapter_id: value, lecture_id: '' }
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
      i === questionIndex ? { ...q, images: [...q.images, { file, previewUrl, caption: '' }] } : q
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
        setError(`Question ${i + 1}: Choices A, B, C, D are required.`); return
      }
    }
    setIsSaving(true)
    const { count: existingCount } = await supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .eq('exam_id', selectedExam)
      .is('deleted_at', null)
    let orderStart = (existingCount || 0) + 1
    let saved = 0
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      const { data: inserted, error: insertError } = await supabase.from('questions').insert({
        exam_id: selectedExam,
        question_text: q.question_text.trim(),
        question_order: orderStart + i,
        choice_a: q.choice_a.trim(), choice_b: q.choice_b.trim(),
        choice_c: q.choice_c.trim(), choice_d: q.choice_d.trim(),
        choice_e: q.choice_e.trim() || null,
        correct_answer: q.correct_answer,
        explanation: q.explanation.trim() || null,
        incorrect_explanation_a: q.incorrect_explanation_a.trim() || null,
        incorrect_explanation_b: q.incorrect_explanation_b.trim() || null,
        incorrect_explanation_c: q.incorrect_explanation_c.trim() || null,
        incorrect_explanation_d: q.incorrect_explanation_d.trim() || null,
        chapter_id: q.chapter_id || null,
        lecture_id: q.lecture_id || null,
        doctor_id: q.doctor_id || null,
      }).select('id').single()
      if (insertError || !inserted) continue
      saved++
      if (q.doctor_id) await supabase.from('exam_doctors').upsert({ exam_id: selectedExam, doctor_id: q.doctor_id })
      if (q.images.length > 0) await uploadImages(inserted.id, q.images)
    }
    await supabase.from('exams').update({ question_count: (existingCount || 0) + saved }).eq('id', selectedExam)
    setSavedCount(saved)
    setIsDone(true)
    setIsSaving(false)
  }

  // ─── CSS ──────────────────────────────────────────────────────────────────
  const css = `
    .mi-root {
      --mi-bg:      oklch(98% 0.006 55);
      --mi-elev:    oklch(100% 0 0);
      --mi-soft:    oklch(96% 0.009 55);
      --mi-fg:      oklch(22% 0.02 50);
      --mi-muted:   oklch(46% 0.02 50);
      --mi-bd:      oklch(89% 0.012 50);
      --mi-primary: oklch(50% 0.19 25);
      --mi-psoft:   oklch(94% 0.035 25);
      --mi-green:   #16a34a;
      --mi-gsoft:   #dcfce7;
      --mi-red:     #dc2626;
      --mi-rsoft:   #fef2f2;
      --mi-shadow:  rgba(20,10,10,0.07);
    }
    .dark .mi-root {
      --mi-bg:      oklch(18% 0.01 50);
      --mi-elev:    oklch(22% 0.012 50);
      --mi-soft:    oklch(20% 0.01 50);
      --mi-fg:      oklch(92% 0.008 50);
      --mi-muted:   oklch(62% 0.015 50);
      --mi-bd:      oklch(32% 0.015 50);
      --mi-primary: oklch(68% 0.18 25);
      --mi-psoft:   oklch(28% 0.06 25);
      --mi-green:   #22c55e;
      --mi-gsoft:   oklch(22% 0.05 145);
      --mi-red:     #f87171;
      --mi-rsoft:   oklch(22% 0.05 20);
      --mi-shadow:  rgba(0,0,0,0.35);
    }
    @keyframes mi-fade { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
    @keyframes mi-slide-in { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    .mi-fade { animation: mi-fade 0.35s ease-out; }
    .mi-q-fade { animation: mi-slide-in 0.28s ease-out; }
    .mi-card { background:var(--mi-elev); border:1px solid var(--mi-bd); border-radius:18px; }
    .mi-input { width:100%; border:1px solid var(--mi-bd); background:var(--mi-soft); color:var(--mi-fg);
      border-radius:10px; padding:10px 13px; font-size:13.5px; outline:none; font-family:inherit;
      transition:border-color 0.15s,box-shadow 0.15s; box-sizing:border-box; }
    .mi-input:focus { border-color:var(--mi-primary); box-shadow:0 0 0 3px var(--mi-psoft); }
    .mi-textarea { width:100%; border:1px solid var(--mi-bd); background:var(--mi-soft); color:var(--mi-fg);
      border-radius:10px; padding:10px 13px; font-size:13.5px; outline:none; font-family:inherit;
      line-height:1.6; resize:vertical; transition:border-color 0.15s,box-shadow 0.15s; box-sizing:border-box; }
    .mi-textarea:focus { border-color:var(--mi-primary); box-shadow:0 0 0 3px var(--mi-psoft); }
    .mi-label { font-size:11.5px; font-weight:700; color:var(--mi-muted); text-transform:uppercase;
      letter-spacing:0.05em; margin-bottom:6px; display:block; }
    .mi-btn-primary { background:var(--mi-primary); color:#fff; border:none; border-radius:11px;
      padding:11px 22px; font-size:13.5px; font-weight:700; cursor:pointer; font-family:inherit;
      transition:opacity 0.15s,transform 0.15s; display:flex; align-items:center; gap:8px; white-space:nowrap; }
    .mi-btn-primary:hover { opacity:0.9; transform:translateY(-1px); }
    .mi-btn-primary:disabled { opacity:0.5; cursor:not-allowed; transform:none; }
    .mi-btn-ghost { background:var(--mi-soft); color:var(--mi-fg); border:1px solid var(--mi-bd);
      border-radius:11px; padding:10px 18px; font-size:13.5px; font-weight:700; cursor:pointer;
      font-family:inherit; transition:background 0.15s; display:flex; align-items:center; gap:7px; white-space:nowrap; }
    .mi-btn-ghost:hover { background:var(--mi-bd); }
    .mi-btn-add-q { width:100%; border:2px dashed var(--mi-bd); border-radius:14px; background:transparent;
      color:var(--mi-muted); font-size:13.5px; font-weight:700; cursor:pointer; font-family:inherit;
      padding:18px; display:flex; align-items:center; justify-content:center; gap:8px;
      transition:border-color 0.15s,color 0.15s; }
    .mi-btn-add-q:hover { border-color:var(--mi-primary); color:var(--mi-primary); }
    .mi-scrollbar::-webkit-scrollbar { width:7px; }
    .mi-scrollbar::-webkit-scrollbar-thumb { background:var(--mi-bd); border-radius:8px; }
    .mi-choice-btn { width:28px; height:28px; border-radius:50%; flex-shrink:0; border:2px solid var(--mi-bd);
      cursor:pointer; font-size:12px; font-weight:800; display:flex; align-items:center; justify-content:center;
      transition:all 0.15s; background:var(--mi-soft); color:var(--mi-muted); font-family:inherit; }
    .mi-choice-btn.active { background:var(--mi-green); border-color:var(--mi-green); color:#fff; }
    .mi-choice-btn:not(.active):hover { border-color:var(--mi-green); color:var(--mi-green); }
    .mi-wrong-badge { width:24px; height:24px; border-radius:50%; flex-shrink:0; background:var(--mi-rsoft);
      color:var(--mi-red); font-size:11px; font-weight:800; display:flex; align-items:center; justify-content:center; }
    .dark .mi-wrong-badge { background:oklch(22% 0.05 20); color:#f87171; }
    @media (max-width: 640px) {
      .mi-grid-3 { grid-template-columns: 1fr !important; }
      .mi-exam-grid { grid-template-columns: 1fr !important; }
      .mi-header-row { flex-direction: column !important; align-items: flex-start !important; gap: 12px !important; }
    }
  `

  // ─── Done screen ──────────────────────────────────────────────────────────
  if (isDone) {
    return (
      <>
        <style>{css}</style>
        <div className="mi-root mi-fade" style={{ fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif", color:'var(--mi-fg)', maxWidth:900, margin:'0 auto', padding:'28px 24px 64px', width:'100%' }}>
          <div className="mi-card" style={{ padding:'60px 40px', textAlign:'center' }}>
            <div style={{ width:68, height:68, borderRadius:'50%', background:'var(--mi-gsoft)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--mi-green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h2 style={{ margin:'0 0 8px', fontSize:24, fontWeight:800 }}>Questions Saved!</h2>
            <p style={{ margin:'0 0 30px', fontSize:14, color:'var(--mi-muted)' }}>
              Successfully added <strong style={{ color:'var(--mi-fg)' }}>{savedCount}</strong> question{savedCount !== 1 ? 's' : ''} to the exam.
            </p>
            <div style={{ display:'flex', justifyContent:'center', gap:10 }}>
              <button className="mi-btn-ghost" onClick={() => { setQuestions([emptyQuestion()]); setSelectedExam(''); setCurrentSubjectId(''); setFilterYear(''); setFilterSemester(''); setFilterSubject(''); setFilterBatch(''); setExamSearch(''); setExpandedSubject(null); setIsDone(false) }}>
                Add More Questions
              </button>
              <Link href="/admin/exams" className="mi-btn-primary">View Exams</Link>
            </div>
          </div>
        </div>
      </>
    )
  }

  // ─── Exam selector helpers (same logic as bulk import) ───────────────────
  const isPreclinicalYear = filterYear && !academicYears.find(y => y.id === filterYear)?.is_clinical && semesters.filter(s => s.academic_year_id === filterYear).length > 0
  const readyForExams = !!filterYear && (!isPreclinicalYear || !!filterSemester)

  function getFilteredExams() {
    let filtered = exams
    if (filterBatch) {
      filtered = filtered.filter(e => e.batch_id === filterBatch)
    } else if (filterSubject) {
      const sb = batches.filter(b => b.subject_id === filterSubject).map(b => b.id)
      filtered = filtered.filter(e => sb.includes(e.batch_id))
    } else if (filterYear) {
      const yearObj = academicYears.find(y => y.id === filterYear)
      let sids: string[]
      if (yearObj?.is_clinical) {
        sids = subjects.filter(s => s.year_id === filterYear).map(s => s.id)
      } else {
        const ys = semesters.filter(s => s.academic_year_id === filterYear).map(s => s.id)
        let ss = subjects.filter(s => s.semester_id && ys.includes(s.semester_id))
        if (filterSemester) ss = ss.filter(s => s.semester_id === filterSemester)
        sids = ss.map(s => s.id)
      }
      const yb = batches.filter(b => sids.includes(b.subject_id)).map(b => b.id)
      filtered = filtered.filter(e => yb.includes(e.batch_id))
    }
    const q = examSearch.trim().toLowerCase()
    if (q) filtered = filtered.filter(e => e.title.toLowerCase().includes(q) || (subjects.find(s => s.id === batches.find(b => b.id === e.batch_id)?.subject_id)?.name || '').toLowerCase().includes(q))
    return filtered
  }

  function getGrouped() {
    const filtered = getFilteredExams()
    const grouped: Record<string, { subjectName: string; exams: Exam[] }> = {}
    filtered.forEach(exam => {
      const batch = batches.find(b => b.id === exam.batch_id)
      const subject = subjects.find(s => s.id === batch?.subject_id)
      const subName = subject?.name || 'Unknown'
      if (!grouped[subName]) grouped[subName] = { subjectName: subName, exams: [] }
      grouped[subName].exams.push(exam)
    })
    return grouped
  }

  const grouped = readyForExams ? getGrouped() : {}
  const totalFilteredCount = Object.values(grouped).reduce((acc, g) => acc + g.exams.length, 0)

  // Current selected exam label
  const selectedExamObj = exams.find(e => e.id === selectedExam)
  const selectedBatch = batches.find(b => b.id === selectedExamObj?.batch_id)
  const selectedSubject = subjects.find(s => s.id === selectedBatch?.subject_id)

  // ─── JSX ──────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{css}</style>
      <div className="mi-root mi-fade" style={{ fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif", color:'var(--mi-fg)', maxWidth:1280, margin:'0 auto', padding:'28px 24px 64px', width:'100%' }}>

        {/* Page Header */}
        <div style={{ marginBottom:28 }}>
          <h1 style={{ margin:'0 0 4px', fontSize:26, fontWeight:800 }}>Manual Import</h1>
          <p style={{ margin:0, fontSize:14, color:'var(--mi-muted)' }}>Add questions one by one with full control and images.</p>
        </div>

        {/* ── SELECT TARGET EXAM (same design as bulk import) ── */}
        <div className="mi-card" style={{ padding:22, marginBottom:24 }}>
          <div style={{ fontSize:14, fontWeight:800, marginBottom:16 }}>Select Target Exam</div>

          <div className="mi-exam-grid" style={{ display:'grid', gridTemplateColumns:'220px 1fr', gap:16, alignItems:'start' }}>

            {/* Left: Filters */}
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <select className="mi-input" value={filterYear} onChange={e => { setFilterYear(e.target.value); setFilterSemester(''); setFilterSubject(''); setFilterBatch(''); setSelectedExam(''); setCurrentSubjectId(''); setExamSearch(''); setExpandedSubject(null) }}>
                <option value="">Select Year...</option>
                {academicYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>

              {filterYear && !academicYears.find(y => y.id === filterYear)?.is_clinical && semesters.filter(s => s.academic_year_id === filterYear).length > 0 && (
                <select className="mi-input" style={{ background:'var(--mi-psoft)', color:'var(--mi-primary)', fontWeight:700 }} value={filterSemester} onChange={e => { setFilterSemester(e.target.value); setFilterSubject(''); setFilterBatch(''); setSelectedExam(''); setCurrentSubjectId(''); setExamSearch(''); setExpandedSubject(null) }}>
                  <option value="">Select Semester...</option>
                  {semesters.filter(s => s.academic_year_id === filterYear).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}

              <select className="mi-input" value={filterSubject} onChange={e => { setFilterSubject(e.target.value); setFilterBatch(''); setSelectedExam(''); setCurrentSubjectId(''); setExamSearch(''); setExpandedSubject(e.target.value ? subjects.find(s => s.id === e.target.value)?.name || null : null) }}>
                <option value="">All Subjects</option>
                {(() => {
                  let filtered = subjects
                  if (filterYear) {
                    const yearObj = academicYears.find(y => y.id === filterYear)
                    if (yearObj?.is_clinical) { filtered = filtered.filter(s => s.year_id === filterYear) }
                    else {
                      const yearSems = semesters.filter(s => s.academic_year_id === filterYear).map(s => s.id)
                      filtered = filtered.filter(s => s.semester_id && yearSems.includes(s.semester_id))
                      if (filterSemester) filtered = filtered.filter(s => s.semester_id === filterSemester)
                    }
                  }
                  return filtered.map(s => <option key={s.id} value={s.id}>{s.name}</option>)
                })()}
              </select>

              <select className="mi-input" value={filterBatch} onChange={e => { setFilterBatch(e.target.value); setSelectedExam(''); setCurrentSubjectId('') }} disabled={!filterSubject}>
                <option value="">All Batches</option>
                {batches.filter(b => b.subject_id === filterSubject).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>

              {readyForExams && (
                <div style={{ marginTop:6, padding:'11px 13px', borderRadius:10, background:'var(--mi-psoft)', fontSize:11.5, lineHeight:1.6, color:'var(--mi-primary)' }}>
                  <strong>{totalFilteredCount}</strong> exam(s) match these filters.
                </div>
              )}
            </div>

            {/* Right: Exams panel */}
            <div style={{ display:'flex', flexDirection:'column', gap:10, minWidth:0 }}>
              {!readyForExams ? (
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:240, gap:8, color:'var(--mi-muted)', textAlign:'center', padding:20, border:'1px dashed var(--mi-bd)', borderRadius:14, background:'var(--mi-soft)' }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity:0.5 }}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  <span style={{ fontSize:13, fontWeight:700 }}>{!filterYear ? 'Select an academic year' : 'Select a semester'}</span>
                  <span style={{ fontSize:11.5 }}>Exams appear once these are set</span>
                </div>
              ) : (
                <>
                  {/* Search + selected pill */}
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ position:'relative', flex:1 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--mi-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                      <input type="text" placeholder="Search exams..." value={examSearch} onChange={e => setExamSearch(e.target.value)} className="mi-input" style={{ paddingLeft:34 }} />
                    </div>
                    {selectedExam && (
                      <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0, fontSize:11.5, fontWeight:800, color:'var(--mi-primary)', background:'var(--mi-psoft)', borderRadius:20, padding:'6px 8px 6px 12px', whiteSpace:'nowrap' }}>
                        1 selected
                        <button onClick={() => { setSelectedExam(''); setCurrentSubjectId('') }} style={{ width:18, height:18, borderRadius:'50%', border:'none', background:'var(--mi-primary)', color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:0 }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Grouped list */}
                  <div style={{ border:'1px solid var(--mi-bd)', borderRadius:14, overflow:'hidden' }}>
                    <div className="mi-scrollbar" style={{ maxHeight:400, overflowY:'auto' }}>
                      {Object.keys(grouped).length === 0 ? (
                        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:180, gap:8, color:'var(--mi-muted)', textAlign:'center', padding:20 }}>
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity:0.4 }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                          <span style={{ fontSize:13 }}>No exams found</span>
                          <span style={{ fontSize:11.5 }}>Try adjusting the search or filters</span>
                        </div>
                      ) : Object.values(grouped).map(group => {
                        const isExpanded = expandedSubject === group.subjectName
                        return (
                          <div key={group.subjectName}>
                            <div onClick={() => setExpandedSubject(isExpanded ? null : group.subjectName)} style={{ position:'sticky', top:0, zIndex:1, display:'flex', alignItems:'center', justifyContent:'space-between', padding: isExpanded ? '9px 16px' : '6px 16px', background: isExpanded ? 'var(--mi-psoft)' : 'var(--mi-soft)', borderBottom:'1px solid var(--mi-bd)', cursor:'pointer', transition:'padding 0.15s' }}>
                              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                <span style={{ fontSize: isExpanded ? '11.5px' : '10.5px', fontWeight:800, color: isExpanded ? 'var(--mi-primary)' : 'var(--mi-muted)', textTransform:'uppercase', letterSpacing:'0.04em' }}>{group.subjectName}</span>
                                <span style={{ fontSize:11, fontWeight:700, color:'var(--mi-muted)', background:'var(--mi-elev)', border:'1px solid var(--mi-bd)', borderRadius:20, padding:'1px 8px' }}>{group.exams.length}</span>
                              </div>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--mi-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)', transition:'transform 0.2s' }}><polyline points="6 9 12 15 18 9"/></svg>
                            </div>
                            {isExpanded && (
                              <div>
                                {group.exams.map((exam, idx) => {
                                  const isSelected = selectedExam === exam.id
                                  const batch = batches.find(b => b.id === exam.batch_id)
                                  return (
                                    <div key={exam.id} onClick={() => handleExamSelect(exam.id, group.subjectName)} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 16px 11px 13px', cursor:'pointer', borderBottom: idx < group.exams.length - 1 ? '1px solid var(--mi-bd)' : 'none', background: isSelected ? 'var(--mi-psoft)' : 'transparent', borderLeft:`3px solid ${isSelected ? 'var(--mi-primary)' : 'transparent'}`, transition:'background 0.12s' }}
                                      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'var(--mi-soft)' }}
                                      onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                                    >
                                      <div style={{ width:34, height:34, borderRadius:10, flexShrink:0, background: isSelected ? 'var(--mi-primary)' : 'var(--mi-soft)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={isSelected ? '#fff' : 'var(--mi-muted)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                      </div>
                                      <div style={{ flex:1, minWidth:0 }}>
                                        <div style={{ fontSize:13.5, fontWeight:700, color: isSelected ? 'var(--mi-primary)' : 'var(--mi-fg)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{exam.title}</div>
                                        <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:2 }}>
                                          <span style={{ fontSize:11.5, color:'var(--mi-muted)', whiteSpace:'nowrap' }}>{group.subjectName}</span>
                                          {batch && <span style={{ fontSize:11.5, fontWeight:600, padding:'1px 8px', borderRadius:20, background: isSelected ? 'var(--mi-primary)' : 'var(--mi-soft)', color: isSelected ? '#fff' : 'var(--mi-muted)', whiteSpace:'nowrap' }}>{batch.name}</span>}
                                        </div>
                                      </div>
                                      {isSelected && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--mi-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}><polyline points="20 6 9 17 4 12"/></svg>}
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
              )}
            </div>
          </div>

          {/* Selected exam info bar */}
          {selectedExam && selectedExamObj && (
            <div style={{ marginTop:16, padding:'12px 16px', borderRadius:12, background:'var(--mi-psoft)', border:'1px solid var(--mi-primary)', display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--mi-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              <span style={{ fontSize:13, fontWeight:700, color:'var(--mi-primary)' }}>
                {selectedExamObj.title}
              </span>
              {selectedSubject && <span style={{ fontSize:12, color:'var(--mi-primary)', opacity:0.75 }}>— {selectedSubject.name}</span>}
              {selectedBatch && <span style={{ fontSize:11.5, fontWeight:600, padding:'1px 8px', borderRadius:20, background:'var(--mi-primary)', color:'#fff' }}>{selectedBatch.name}</span>}
              {currentSubjectId && subjectChapters.length === 0 && (
                <span style={{ fontSize:11.5, color:'var(--mi-primary)', opacity:0.7, marginLeft:'auto' }}>No chapters found — questions will be saved without chapter classification.</span>
              )}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{ padding:'12px 16px', borderRadius:12, background:'var(--mi-rsoft)', border:'1px solid #fca5a5', fontSize:13, color:'var(--mi-red)', marginBottom:16 }}>
            {error}
          </div>
        )}

        {/* ── QUESTIONS ── */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {questions.map((q, qIndex) => (
            <div key={qIndex} className="mi-card mi-q-fade" style={{ overflow:'hidden' }}>

              {/* Question Header */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 20px', borderBottom:'1px solid var(--mi-bd)', background:'var(--mi-soft)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ width:30, height:30, borderRadius:10, background:'var(--mi-primary)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, flexShrink:0 }}>{qIndex + 1}</span>
                  <span style={{ fontSize:14.5, fontWeight:800 }}>Question {qIndex + 1}</span>
                </div>
                {questions.length > 1 && (
                  <button onClick={() => removeQuestion(qIndex)} style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 10px', borderRadius:8, border:'none', background:'var(--mi-rsoft)', color:'var(--mi-red)', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                    Remove
                  </button>
                )}
              </div>

              <div style={{ padding:'20px', display:'flex', flexDirection:'column', gap:18 }}>

                {/* Classification row */}
                <div className="mi-grid-3" style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
                  <div>
                    <label className="mi-label">Doctor</label>
                    <select className="mi-input" value={q.doctor_id} onChange={e => updateQuestion(qIndex, 'doctor_id', e.target.value)} disabled={!selectedExam}>
                      <option value="">{selectedExam ? 'No doctor' : 'Select an exam first'}</option>
                      {doctors
                        .filter(d => examDoctorIds.includes(d.id))
                        .map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mi-label">Chapter</label>
                    <select className="mi-input" value={q.chapter_id} onChange={e => updateQuestion(qIndex, 'chapter_id', e.target.value)} disabled={!currentSubjectId || subjectChapters.length === 0}>
                      <option value="">No chapter</option>
                      {subjectChapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mi-label">Lecture</label>
                    <select className="mi-input" value={q.lecture_id} onChange={e => updateQuestion(qIndex, 'lecture_id', e.target.value)} disabled={!q.chapter_id}>
                      <option value="">No lecture</option>
                      {getLecturesForChapter(q.chapter_id).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* Question text */}
                <div>
                  <label className="mi-label">Question Text *</label>
                  <textarea className="mi-textarea" value={q.question_text} onChange={e => updateQuestion(qIndex, 'question_text', e.target.value)} rows={3} placeholder="Enter the question..." style={{ minHeight:70 }} />
                </div>

                {/* Choices */}
                <div>
                  <label className="mi-label">Answer Choices * — Click the letter to mark correct</label>
                  <div style={{ display:'flex', flexDirection:'column', gap:9, marginBottom:10 }}>
                    {choices.map(letter => (
                      <div key={letter} style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <button type="button" onClick={() => updateQuestion(qIndex, 'correct_answer', letter)} className={`mi-choice-btn${q.correct_answer === letter ? ' active' : ''}`}>
                          {letter.toUpperCase()}
                        </button>
                        <input className="mi-input" value={q[`choice_${letter}` as keyof QuestionForm] as string} onChange={e => updateQuestion(qIndex, `choice_${letter}` as keyof QuestionForm, e.target.value)} placeholder={letter === 'e' ? 'Choice E (optional)' : `Choice ${letter.toUpperCase()} *`} />
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize:12.5, color:'var(--mi-muted)' }}>
                    Correct answer: <strong style={{ color:'var(--mi-green)' }}>{q.correct_answer.toUpperCase()}</strong>
                  </div>
                </div>

                {/* Explanation */}
                <div>
                  <label className="mi-label">Explanation (Correct Answer)</label>
                  <MnEditor
                    value={q.explanation}
                    onChange={(value) => updateQuestion(qIndex, 'explanation', value)}
                    placeholder="Why is this answer correct? Supports MN Syntax..."
                    minHeight="120px"
                  />
                </div>

                {/* Wrong explanations */}
                <div>
                  <label className="mi-label">Wrong Answer Explanations (optional)</label>
                  <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
                    {(['a', 'b', 'c', 'd'] as const).map(letter => (
                      <div key={letter} style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <span className="mi-wrong-badge">{letter.toUpperCase()}</span>
                        <input className="mi-input" value={q[`incorrect_explanation_${letter}` as keyof QuestionForm] as string} onChange={e => updateQuestion(qIndex, `incorrect_explanation_${letter}` as keyof QuestionForm, e.target.value)} placeholder={`Why is ${letter.toUpperCase()} wrong?`} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Images */}
                <div>
                  <label className="mi-label">Images (optional)</label>
                  {q.images.length > 0 && (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:10, marginBottom:10 }}>
                      {q.images.map((img, imgIndex) => (
                        <div key={imgIndex} style={{ position:'relative' }}>
                          <img src={img.previewUrl} alt="preview" style={{ width:90, height:90, borderRadius:10, objectFit:'cover', border:'1px solid var(--mi-bd)', display:'block' }} />
                          <button onClick={() => removeImage(qIndex, imgIndex)} style={{ position:'absolute', top:-6, right:-6, width:20, height:20, borderRadius:'50%', background:'#ef4444', color:'#fff', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                          <input type="text" placeholder="Caption..." value={img.caption} onChange={e => updateImageCaption(qIndex, imgIndex, e.target.value)} style={{ marginTop:4, width:90, borderRadius:6, border:'1px solid var(--mi-bd)', background:'var(--mi-soft)', color:'var(--mi-fg)', padding:'3px 7px', fontSize:11, outline:'none', boxSizing:'border-box' }} />
                        </div>
                      ))}
                    </div>
                  )}
                  <label style={{ display:'flex', alignItems:'center', gap:7, width:'fit-content', cursor:'pointer', borderRadius:9, border:'1px solid var(--mi-bd)', padding:'7px 13px', fontSize:12.5, fontWeight:600, color:'var(--mi-muted)', background:'var(--mi-soft)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
                    Add Image
                    <input type="file" accept="image/*" style={{ display:'none' }} onChange={e => { const file = e.target.files?.[0]; if (file) addImage(qIndex, file); e.target.value = '' }} />
                  </label>
                </div>

              </div>
            </div>
          ))}
        </div>

        {/* Add Question button */}
        <button className="mi-btn-add-q" onClick={addQuestion} style={{ marginTop:16 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Another Question
        </button>

        {/* Save bar */}
        <div style={{ display:'flex', alignItems:'center', gap:14, marginTop:24, paddingBottom:8, flexWrap:'wrap' }}>
          <button className="mi-btn-primary" onClick={handleSave} disabled={isSaving}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            {isSaving ? 'Saving...' : `Save ${questions.length} Question${questions.length > 1 ? 's' : ''}`}
          </button>
          <span style={{ fontSize:12.5, color:'var(--mi-muted)' }}>
            {questions.length} question{questions.length > 1 ? 's' : ''} ready to save
          </span>
        </div>

      </div>
    </>
  )
}