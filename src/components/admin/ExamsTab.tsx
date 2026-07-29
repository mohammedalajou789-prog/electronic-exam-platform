'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Loader2, Check, X, ChevronRight, Pencil, Save } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface AcademicYear { id: string; name: string; is_clinical: boolean }
interface Semester { id: string; name: string; academic_year_id: string }
interface Subject { id: string; name: string; semester_id: string | null; year_id: string | null }
interface Batch { id: string; name: string; subject_id: string }
interface Doctor { id: string; name: string }
interface Exam {
  id: string
  title: string
  exam_type: string
  calendar_year: number | null
  status: string
  question_count: number
  batch: { name: string } | null
  doctor: { name: string } | null
  academic_year: { name: string } | null
  batch_detail: { subject: { name: string } | null } | null
}

export default function ExamsTab() {
  const supabase = createClient()
  const router = useRouter()

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [editingExam, setEditingExam] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Record<string, any>>({})

  const [selectedYear, setSelectedYear] = useState('')
  const [selectedSemester, setSelectedSemester] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedBatch, setSelectedBatch] = useState('')
  const [selectedDoctor, setSelectedDoctor] = useState('')
  const [title, setTitle] = useState('')
  const [examType, setExamType] = useState('final')
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear().toString())
  const [status, setStatus] = useState('draft')

  async function loadAll() {
    const [yearsRes, semsRes, subsRes, batchesRes, docsRes, examsRes] = await Promise.all([
      supabase.from('academic_years').select('id, name, is_clinical').order('display_order'),
      supabase.from('semesters').select('id, name, academic_year_id').order('display_order'),
      supabase.from('subjects').select('id, name, semester_id, year_id').order('name'),
      supabase.from('batches').select('id, name, subject_id').order('name'),
      supabase.from('doctors').select('id, name').order('name'),
      supabase.from('exams').select(`
        id, title, exam_type, calendar_year, status, question_count,
        academic_year:academic_years(name),
        batch:batches(name),
        batch_detail:batches(subject:subjects(name)),
        doctor:doctors(name)
      `).is('deleted_at', null).order('created_at', { ascending: false }),
    ])
    setAcademicYears(yearsRes.data ?? [])
    setSemesters(semsRes.data ?? [])
    setSubjects(subsRes.data ?? [])
    setBatches(batchesRes.data ?? [])
    setDoctors(docsRes.data ?? [])
    setExams((examsRes.data ?? []) as any)
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const selectedYearObj = academicYears.find(y => y.id === selectedYear)
  const isClinical = selectedYearObj?.is_clinical ?? false
  const filteredSemesters = semesters.filter(s => s.academic_year_id === selectedYear)
  const filteredSubjects = subjects.filter(s => {
    if (isClinical) return s.year_id === selectedYear
    if (selectedSemester) return s.semester_id === selectedSemester
    return false
  })
  const filteredBatches = batches.filter(b => b.subject_id === selectedSubject)

  async function handleCreate() {
    if (!title.trim() || !selectedBatch) {
      showToast('Please fill all required fields', 'error')
      return
    }
    setIsSaving(true)
    const { data: exam, error } = await supabase.from('exams').insert({
      title: title.trim(),
      batch_id: selectedBatch,
      doctor_id: selectedDoctor || null,
      academic_year_id: selectedYear || null,
      exam_type: examType,
      calendar_year: calendarYear ? parseInt(calendarYear) : null,
      status: status,
      question_count: 0,
    }).select('id').single()
    setIsSaving(false)
    if (error) { showToast(error.message, 'error'); return }
    showToast('Exam created successfully!')
    setTitle(''); setSelectedYear(''); setSelectedSemester('')
    setSelectedSubject(''); setSelectedBatch(''); setSelectedDoctor('')
    await loadAll()
    setTimeout(() => router.push(`/admin/exams/${exam.id}`), 800)
  }

  function startEdit(exam: Exam) {
    setEditingExam(exam.id)
    setEditForm({
      title: exam.title,
      exam_type: exam.exam_type,
      calendar_year: exam.calendar_year?.toString() ?? '',
      status: exam.status,
    })
  }

  async function saveEdit(examId: string) {
    const { error } = await supabase.from('exams').update({
      title: editForm.title,
      exam_type: editForm.exam_type,
      calendar_year: editForm.calendar_year ? parseInt(editForm.calendar_year) : null,
      status: editForm.status,
      updated_at: new Date().toISOString(),
    }).eq('id', examId)
    if (error) { showToast(error.message, 'error'); return }
    showToast('Exam updated')
    setEditingExam(null)
    await loadAll()
  }

  const inputCls = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black"
  const selectCls = inputCls
  const labelCls = "block text-sm font-medium mb-1.5"

  if (loading) {
    return <div className="animate-pulse space-y-4">
      {[1,2,3].map(i => <div key={i} className="h-12 bg-muted rounded-lg" />)}
    </div>
  }

  return (
    <div className="space-y-6">

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-black text-white'
        }`}>
          {toast.type === 'error' ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      {/* Create New Exam */}
      <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm space-y-5">
        <h2 className="font-semibold text-lg">New Exam</h2>

        <div>
          <label className={labelCls}>Academic Year <span className="text-red-500">*</span></label>
          <select className={selectCls} value={selectedYear} onChange={e => {
            setSelectedYear(e.target.value); setSelectedSemester(''); setSelectedSubject(''); setSelectedBatch('')
          }}>
            <option value="">Select Year</option>
            {academicYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
          </select>
        </div>

        {selectedYear && !isClinical && (
          <div>
            <label className={labelCls}>Semester <span className="text-red-500">*</span></label>
            <select className={selectCls} value={selectedSemester} onChange={e => {
              setSelectedSemester(e.target.value); setSelectedSubject(''); setSelectedBatch('')
            }}>
              <option value="">Select Semester</option>
              {filteredSemesters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}

        {(isClinical ? selectedYear : selectedSemester) && (
          <div>
            <label className={labelCls}>Subject <span className="text-red-500">*</span></label>
            <select className={selectCls} value={selectedSubject} onChange={e => {
              setSelectedSubject(e.target.value); setSelectedBatch('')
            }}>
              <option value="">Select Subject</option>
              {filteredSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}

        {selectedSubject && (
          <div>
            <label className={labelCls}>Batch <span className="text-red-500">*</span></label>
            <select className={selectCls} value={selectedBatch} onChange={e => setSelectedBatch(e.target.value)}>
              <option value="">Select Batch</option>
              {filteredBatches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        )}

        {selectedBatch && (
          <>
            <hr className="border-border/60" />
            <div>
              <label className={labelCls}>Exam Title <span className="text-red-500">*</span></label>
              <input className={inputCls} placeholder="e.g. Final Exam, Quiz 1, Midterm..." value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Exam Type</label>
                <select className={selectCls} value={examType} onChange={e => setExamType(e.target.value)}>
                  <option value="quiz">Quiz</option>
                  <option value="midterm">Midterm</option>
                  <option value="final">Final</option>
                  <option value="practical">Practical</option>
                  <option value="mock">Mock</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Calendar Year</label>
                <input className={inputCls} placeholder="e.g. 2025" value={calendarYear} onChange={e => setCalendarYear(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Doctor</label>
                <select className={selectCls} value={selectedDoctor} onChange={e => setSelectedDoctor(e.target.value)}>
                  <option value="">No doctor</option>
                  {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <select className={selectCls} value={status} onChange={e => setStatus(e.target.value)}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button onClick={handleCreate} disabled={isSaving || !title.trim()}
                className="flex items-center gap-2 rounded-lg bg-black px-6 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {isSaving ? 'Creating...' : 'Create Exam'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Existing Exams */}
      {exams.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-base border-b border-border/60 pb-2">Existing Exams</h2>
          {exams.map(exam => (
            <div key={exam.id} className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
              {editingExam !== exam.id ? (
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm">{exam.title}</span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        exam.status === 'published' ? 'bg-green-50 text-green-700' :
                        exam.status === 'draft' ? 'bg-yellow-50 text-yellow-700' :
                        'bg-gray-50 text-gray-700'
                      }`}>{exam.status}</span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>{(exam.academic_year as any)?.name ?? '—'}</span>
                      <span>{(exam.batch_detail as any)?.subject?.name ?? '—'}</span>
                      <span>Batch: {(exam.batch as any)?.name ?? '—'}</span>
                      {(exam.doctor as any)?.name && <span>Dr. {(exam.doctor as any).name}</span>}
                      <span className="capitalize">{exam.exam_type}{exam.calendar_year ? ` · ${exam.calendar_year}` : ''}</span>
                      <span>{exam.question_count} questions</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => startEdit(exam)}
                      className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/50 transition-colors">
                      <Pencil className="h-3.5 w-3.5" /> Edit Info
                    </button>
                    <button onClick={() => router.push(`/admin/exams/${exam.id}`)}
                      className="flex items-center gap-1.5 rounded-lg bg-black px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 transition-colors">
                      Questions <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="px-5 py-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Title</label>
                      <input className={inputCls} value={editForm.title} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))} />
                    </div>
                    <div>
                      <label className={labelCls}>Calendar Year</label>
                      <input className={inputCls} value={editForm.calendar_year} onChange={e => setEditForm(p => ({ ...p, calendar_year: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Exam Type</label>
                      <select className={selectCls} value={editForm.exam_type} onChange={e => setEditForm(p => ({ ...p, exam_type: e.target.value }))}>
                        <option value="quiz">Quiz</option>
                        <option value="midterm">Midterm</option>
                        <option value="final">Final</option>
                        <option value="practical">Practical</option>
                        <option value="mock">Mock</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Status</label>
                      <select className={selectCls} value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}>
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setEditingExam(null)}
                      className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted/50">Cancel</button>
                    <button onClick={() => saveEdit(exam.id)}
                      className="flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
                      <Save className="h-4 w-4" /> Save
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}