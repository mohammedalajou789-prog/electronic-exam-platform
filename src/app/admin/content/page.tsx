'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, Trash2, ChevronDown, ChevronRight,
  BookOpen, Users, Stethoscope, GraduationCap,
  X, Check, Loader2
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

interface AcademicYear { id: string; name: string; is_clinical: boolean }
interface Semester     { id: string; name: string; academic_year_id: string }
interface Doctor       { id: string; name: string; department: string | null }
interface Lecture      { id: string; name: string; display_order: number }
interface Chapter      { id: string; name: string; display_order: number; lectures: Lecture[] }
interface SubjectDoctor { id: string; doctor_id: string; doctor: { name: string; department: string | null } | { name: string; department: string | null }[] }

interface Subject {
  id: string
  name: string
  description: string | null
  semester_id: string | null
  year_id: string | null
  subject_doctors: SubjectDoctor[]
  chapters: (Chapter & { lectures: Lecture[] })[]
  batches: { id: string; name: string }[]
}

interface Batch { id: string; name: string; subject_id: string }

// ── Main Component ────────────────────────────────────────────────────────────

export default function ContentManagementPage() {
  const supabase = createClient()

  const [activeTab, setActiveTab] = useState<'subjects' | 'batches'>('subjects')
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [allDoctors, setAllDoctors] = useState<Doctor[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [batches, setBatches] = useState<Batch[]>([])

  const [expandedSubject, setExpandedSubject] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Add Subject form
  const [showAddSubject, setShowAddSubject] = useState(false)
  const [subjectMode, setSubjectMode] = useState<'pre-clinical' | 'clinical'>('pre-clinical')
  const [newSubjectName, setNewSubjectName] = useState('')
  const [newSubjectDesc, setNewSubjectDesc] = useState('')
  const [newSubjectSemester, setNewSubjectSemester] = useState('')
  const [newSubjectYear, setNewSubjectYear] = useState('')

  // Add Batch form
  const [newBatchName, setNewBatchName] = useState('')
  const [newBatchSubject, setNewBatchSubject] = useState('')

  // Per-subject inline forms
  const [newDoctorName, setNewDoctorName] = useState<Record<string, string>>({})
  const [newDoctorDept, setNewDoctorDept] = useState<Record<string, string>>({})
  const [newChapterName, setNewChapterName] = useState<Record<string, string>>({})
  const [newLectureName, setNewLectureName] = useState<Record<string, string>>({})
  const [selectedChapter, setSelectedChapter] = useState<Record<string, string>>({})

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    const [yearsRes, semsRes, docsRes, subsRes, batchesRes] = await Promise.all([
      supabase.from('academic_years').select('id, name, is_clinical').order('display_order'),
      supabase.from('semesters').select('*').order('display_order'),
      supabase.from('doctors').select('*').order('name'),
      supabase.from('subjects').select(`
        id, name, description, semester_id, year_id,
        subject_doctors(id, doctor_id, doctor:doctors(name, department)),
        chapters(id, name, display_order, lectures(id, name, display_order)),
        batches(id, name)
      `).order('name'),
      supabase.from('batches').select('*').order('name'),
    ])
    setAcademicYears(yearsRes.data || [])
    setSemesters(semsRes.data || [])
    setAllDoctors(docsRes.data || [])
    setSubjects((subsRes.data || []) as Subject[])
    setBatches(batchesRes.data || [])
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Toast ─────────────────────────────────────────────────────────────────

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ── Subject Actions ───────────────────────────────────────────────────────

  async function addSubject() {
    if (!newSubjectName.trim()) return
    if (subjectMode === 'pre-clinical' && !newSubjectSemester) return
    if (subjectMode === 'clinical' && !newSubjectYear) return
    setIsLoading(true)
    const { error } = await supabase.from('subjects').insert({
      name: newSubjectName.trim(),
      description: newSubjectDesc.trim() || null,
      semester_id: subjectMode === 'pre-clinical' ? newSubjectSemester : null as any,
      year_id: subjectMode === 'clinical' ? newSubjectYear : null as any,
    } as any)
    if (error) showToast(error.message, 'error')
    else {
      showToast('Subject added')
      setNewSubjectName(''); setNewSubjectDesc('')
      setNewSubjectSemester(''); setNewSubjectYear('')
      setShowAddSubject(false)
    }
    await loadAll(); setIsLoading(false)
  }

  async function deleteSubject(id: string) {
    if (!confirm('Delete this subject and all its data (batches, chapters, exams)?')) return
    await supabase.from('subjects').delete().eq('id', id)
    await loadAll(); showToast('Subject deleted')
  }

  // ── Doctor Actions ────────────────────────────────────────────────────────

  async function addDoctorToSubject(subjectId: string) {
    const name = (newDoctorName[subjectId] || '').trim()
    if (!name) return
    setIsLoading(true)

    // إنشاء الدكتور أولاً
    const { data: doc, error } = await supabase
      .from('doctors')
      .insert({ name, department: (newDoctorDept[subjectId] || '').trim() || null })
      .select('id')
      .single()

    if (error || !doc) { showToast(error?.message || 'Error', 'error'); setIsLoading(false); return }

    // ربطه بالمادة
    await supabase.from('subject_doctors').insert({ subject_id: subjectId, doctor_id: doc.id })

    setNewDoctorName(p => ({ ...p, [subjectId]: '' }))
    setNewDoctorDept(p => ({ ...p, [subjectId]: '' }))
    await loadAll(); showToast('Doctor added'); setIsLoading(false)
  }

  async function removeDoctorFromSubject(subjectDoctorId: string) {
    await supabase.from('subject_doctors').delete().eq('id', subjectDoctorId)
    await loadAll(); showToast('Doctor removed')
  }

  // ── Chapter Actions ───────────────────────────────────────────────────────

  async function addChapter(subjectId: string) {
    const name = (newChapterName[subjectId] || '').trim()
    if (!name) return
    setIsLoading(true)
    const subject = subjects.find(s => s.id === subjectId)
    const order = (subject?.chapters?.length || 0) + 1
    await supabase.from('chapters').insert({ name, subject_id: subjectId, display_order: order })
    setNewChapterName(p => ({ ...p, [subjectId]: '' }))
    await loadAll(); showToast('Chapter added'); setIsLoading(false)
  }

  async function deleteChapter(chapterId: string) {
    if (!confirm('Delete this chapter and all its lectures?')) return
    await supabase.from('chapters').delete().eq('id', chapterId)
    await loadAll(); showToast('Chapter deleted')
  }

  // ── Lecture Actions ───────────────────────────────────────────────────────

  async function addLecture(subjectId: string) {
    const chapterId = selectedChapter[subjectId]
    const name = (newLectureName[subjectId] || '').trim()
    if (!chapterId || !name) return
    setIsLoading(true)
    const subject = subjects.find(s => s.id === subjectId)
    const chapter = subject?.chapters.find(c => c.id === chapterId)
    const order = (chapter?.lectures?.length || 0) + 1
    await supabase.from('lectures').insert({ name, chapter_id: chapterId, display_order: order })
    setNewLectureName(p => ({ ...p, [subjectId]: '' }))
    await loadAll(); showToast('Lecture added'); setIsLoading(false)
  }

  async function deleteLecture(lectureId: string) {
    await supabase.from('lectures').delete().eq('id', lectureId)
    await loadAll(); showToast('Lecture deleted')
  }

  // ── Batch Actions ─────────────────────────────────────────────────────────

  async function addBatch() {
    if (!newBatchName.trim() || !newBatchSubject) return
    setIsLoading(true)
    await supabase.from('batches').insert({ name: newBatchName.trim(), subject_id: newBatchSubject })
    setNewBatchName(''); setNewBatchSubject('')
    await loadAll(); showToast('Batch added'); setIsLoading(false)
  }

  async function deleteBatch(id: string) {
    if (!confirm('Delete this batch?')) return
    await supabase.from('batches').delete().eq('id', id)
    await loadAll(); showToast('Batch deleted')
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function getSubjectLocation(subject: Subject): string {
    if (subject.year_id) {
      return academicYears.find(y => y.id === subject.year_id)?.name + ' (Clinical)' || '—'
    }
    if (subject.semester_id) {
      const sem  = semesters.find(s => s.id === subject.semester_id)
      const year = academicYears.find(y => y.id === sem?.academic_year_id)
      return `${year?.name || ''} · ${sem?.name || ''}`
    }
    return '—'
  }

  const preClinicalYears = academicYears.filter(y => !y.is_clinical)
  const clinicalYears    = academicYears.filter(y => y.is_clinical)

  // ── CSS helpers ───────────────────────────────────────────────────────────

  const inputCls  = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
  const selectCls = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black"
  const btnBlack  = "flex items-center gap-1.5 rounded-lg bg-black px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-40 transition-colors"
  const btnGhost  = "flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Content Management</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Add subjects with their doctors, chapters, and lectures. Then add batches.
        </p>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg transition-all ${
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-black text-white'
        }`}>
          {toast.type === 'error' ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-border/60 bg-muted/30 p-1 w-fit">
        {[
          { key: 'subjects', label: 'Subjects & Content', icon: <BookOpen className="h-4 w-4" /> },
          { key: 'batches',  label: 'Batches',            icon: <Users className="h-4 w-4" /> },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-white shadow-sm text-black'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* ══ SUBJECTS TAB ════════════════════════════════════════════════════ */}
      {activeTab === 'subjects' && (
        <div className="space-y-3">

          {/* Add Subject Button */}
          {!showAddSubject && (
            <button onClick={() => setShowAddSubject(true)} className={btnBlack}>
              <Plus className="h-4 w-4" />Add New Subject
            </button>
          )}

          {/* Add Subject Form */}
          {showAddSubject && (
            <div className="rounded-xl border border-black/10 bg-card p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">New Subject</h2>
                <button onClick={() => setShowAddSubject(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Toggle */}
              <div className="flex gap-2">
                {(['pre-clinical', 'clinical'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setSubjectMode(mode)}
                    className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                      subjectMode === mode
                        ? 'border-black bg-black text-white'
                        : 'border-gray-200 text-muted-foreground hover:border-gray-300'
                    }`}
                  >
                    {mode === 'pre-clinical' ? 'Pre-Clinical (Years 1–3)' : 'Clinical (Years 4–6)'}
                  </button>
                ))}
              </div>

              {/* Location Picker */}
              {subjectMode === 'pre-clinical' ? (
                <select className={selectCls} value={newSubjectSemester} onChange={e => setNewSubjectSemester(e.target.value)}>
                  <option value="">Select Semester</option>
                  {preClinicalYears.map(year => (
                    <optgroup key={year.id} label={year.name}>
                      {semesters.filter(s => s.academic_year_id === year.id).map(sem => (
                        <option key={sem.id} value={sem.id}>{sem.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              ) : (
                <select className={selectCls} value={newSubjectYear} onChange={e => setNewSubjectYear(e.target.value)}>
                  <option value="">Select Clinical Year</option>
                  {clinicalYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
                </select>
              )}

              {/* Name & Description */}
              <div className="flex gap-2">
                <input className={inputCls} placeholder="Subject name (e.g. Internal Medicine)" value={newSubjectName} onChange={e => setNewSubjectName(e.target.value)} />
                <input className={inputCls} placeholder="Description (optional)" value={newSubjectDesc} onChange={e => setNewSubjectDesc(e.target.value)} />
              </div>

              {/* Actions */}
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowAddSubject(false)} className={btnGhost}>Cancel</button>
                <button
                  onClick={addSubject}
                  disabled={isLoading || !newSubjectName.trim() || (subjectMode === 'pre-clinical' ? !newSubjectSemester : !newSubjectYear)}
                  className={btnBlack}
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Add Subject
                </button>
              </div>
            </div>
          )}

          {/* Subjects List */}
          {subjects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 py-16 text-center">
              <GraduationCap className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
              <p className="text-sm text-muted-foreground">No subjects yet. Add your first subject above.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {subjects.map(subject => {
                const isExpanded = expandedSubject === subject.id
                const isClinical = !!subject.year_id

                return (
                  <div key={subject.id} className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">

                    {/* Subject Row */}
                    <div
                      className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-muted/20 transition-colors"
                      onClick={() => setExpandedSubject(isExpanded ? null : subject.id)}
                    >
                      {isExpanded
                        ? <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        : <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      }
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{subject.name}</span>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            isClinical ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'
                          }`}>
                            {isClinical ? 'Clinical' : 'Pre-Clinical'}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 flex gap-3">
                          <span>{getSubjectLocation(subject)}</span>
                          <span>{subject.subject_doctors?.length || 0} doctors</span>
                          <span>{subject.chapters?.length || 0} chapters</span>
                          <span>{subject.batches?.length || 0} batches</span>
                        </div>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); deleteSubject(subject.id) }}
                        className="text-red-400 hover:text-red-600 p-1 rounded transition-colors flex-shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="border-t border-border/40 px-4 py-4 space-y-6 bg-muted/10">

                        {/* ── DOCTORS ───────────────────────────────── */}
                        <section>
                          <div className="flex items-center gap-2 mb-3">
                            <Stethoscope className="h-4 w-4 text-muted-foreground" />
                            <h3 className="text-sm font-semibold">Doctors</h3>
                          </div>

                          {/* Existing Doctors */}
                          {(subject.subject_doctors || []).length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-3">
                              {subject.subject_doctors.map(sd => (
                                <div key={sd.id} className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-white px-2.5 py-1 text-sm">
                                  <span className="font-medium">{Array.isArray(sd.doctor) ? sd.doctor[0]?.name : sd.doctor.name}</span>
                                  {(Array.isArray(sd.doctor) ? sd.doctor[0]?.department : sd.doctor.department) && (
                                    <span className="text-muted-foreground text-xs">· {Array.isArray(sd.doctor) ? sd.doctor[0]?.department : sd.doctor.department}</span>
                                  )}
                                  <button onClick={() => removeDoctorFromSubject(sd.id)} className="ml-1 text-red-400 hover:text-red-600">
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Add Doctor */}
                          <div className="flex gap-2">
                            <input
                              className={inputCls}
                              placeholder="Doctor name (e.g. Dr. Ahmad)"
                              value={newDoctorName[subject.id] || ''}
                              onChange={e => setNewDoctorName(p => ({ ...p, [subject.id]: e.target.value }))}
                            />
                            <input
                              className={inputCls}
                              placeholder="Department (optional)"
                              value={newDoctorDept[subject.id] || ''}
                              onChange={e => setNewDoctorDept(p => ({ ...p, [subject.id]: e.target.value }))}
                            />
                            <button
                              onClick={() => addDoctorToSubject(subject.id)}
                              disabled={isLoading || !(newDoctorName[subject.id] || '').trim()}
                              className={btnBlack}
                            >
                              <Plus className="h-4 w-4" />Add
                            </button>
                          </div>
                        </section>

                        {/* ── CHAPTERS & LECTURES ───────────────────── */}
                        <section>
                          <div className="flex items-center gap-2 mb-3">
                            <BookOpen className="h-4 w-4 text-muted-foreground" />
                            <h3 className="text-sm font-semibold">Chapters & Lectures</h3>
                          </div>

                          {/* Add Chapter */}
                          <div className="flex gap-2 mb-3">
                            <input
                              className={inputCls}
                              placeholder="New chapter name (e.g. Cardiovascular System)"
                              value={newChapterName[subject.id] || ''}
                              onChange={e => setNewChapterName(p => ({ ...p, [subject.id]: e.target.value }))}
                            />
                            <button
                              onClick={() => addChapter(subject.id)}
                              disabled={isLoading || !(newChapterName[subject.id] || '').trim()}
                              className={btnBlack}
                            >
                              <Plus className="h-4 w-4" />Add Chapter
                            </button>
                          </div>

                          {/* Add Lecture */}
                          {(subject.chapters || []).length > 0 && (
                            <div className="flex gap-2 mb-4">
                              <select
                                className={selectCls}
                                value={selectedChapter[subject.id] || ''}
                                onChange={e => setSelectedChapter(p => ({ ...p, [subject.id]: e.target.value }))}
                              >
                                <option value="">Select chapter to add lecture</option>
                                {subject.chapters.map(c => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                              </select>
                              <input
                                className={inputCls}
                                placeholder="Lecture name"
                                value={newLectureName[subject.id] || ''}
                                onChange={e => setNewLectureName(p => ({ ...p, [subject.id]: e.target.value }))}
                              />
                              <button
                                onClick={() => addLecture(subject.id)}
                                disabled={isLoading || !(newLectureName[subject.id] || '').trim() || !selectedChapter[subject.id]}
                                className={btnBlack}
                              >
                                <Plus className="h-4 w-4" />Add Lecture
                              </button>
                            </div>
                          )}

                          {/* Chapters List */}
                          {(subject.chapters || []).length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-4 border border-dashed border-border/40 rounded-lg">
                              No chapters yet
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {subject.chapters
                                .sort((a, b) => a.display_order - b.display_order)
                                .map(chapter => (
                                  <div key={chapter.id} className="rounded-lg border border-border/40 bg-white overflow-hidden">
                                    <div className="flex items-center justify-between px-3 py-2.5 bg-muted/20">
                                      <span className="text-sm font-medium">{chapter.name}</span>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">
                                          {chapter.lectures?.length || 0} lectures
                                        </span>
                                        <button onClick={() => deleteChapter(chapter.id)} className="text-red-400 hover:text-red-600">
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                    {(chapter.lectures || []).length > 0 && (
                                      <ul className="divide-y divide-border/30">
                                        {chapter.lectures
                                          .sort((a, b) => a.display_order - b.display_order)
                                          .map(lecture => (
                                            <li key={lecture.id} className="flex items-center justify-between px-6 py-2 hover:bg-muted/10">
                                              <span className="text-sm text-muted-foreground">{lecture.name}</span>
                                              <button onClick={() => deleteLecture(lecture.id)} className="text-red-400 hover:text-red-600">
                                                <Trash2 className="h-3 w-3" />
                                              </button>
                                            </li>
                                          ))}
                                      </ul>
                                    )}
                                  </div>
                                ))}
                            </div>
                          )}
                        </section>

                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ══ BATCHES TAB ═════════════════════════════════════════════════════ */}
      {activeTab === 'batches' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm space-y-3">
            <h2 className="font-semibold">Add New Batch</h2>
            <div className="flex gap-2">
              <select className={selectCls} value={newBatchSubject} onChange={e => setNewBatchSubject(e.target.value)}>
                <option value="">Select Subject</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input
                className={inputCls}
                placeholder="Batch name (e.g. Wared)"
                value={newBatchName}
                onChange={e => setNewBatchName(e.target.value)}
              />
              <button
                onClick={addBatch}
                disabled={isLoading || !newBatchName.trim() || !newBatchSubject}
                className={btnBlack}
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add
              </button>
            </div>
          </div>

          {/* Batches grouped by subject */}
          {subjects.filter(s => (s.batches || []).length > 0).map(subject => (
            <div key={subject.id} className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-muted/30 border-b border-border/40">
                <p className="text-sm font-semibold">{subject.name}</p>
                <p className="text-xs text-muted-foreground">{getSubjectLocation(subject)}</p>
              </div>
              <ul className="divide-y divide-border/40">
                {subject.batches.map(batch => (
                  <li key={batch.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/10">
                    <span className="text-sm font-medium">{batch.name}</span>
                    <button onClick={() => deleteBatch(batch.id)} className="text-red-400 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {subjects.every(s => (s.batches || []).length === 0) && (
            <div className="rounded-xl border border-dashed border-border/60 py-16 text-center">
              <Users className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
              <p className="text-sm text-muted-foreground">No batches yet. Add your first batch above.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}