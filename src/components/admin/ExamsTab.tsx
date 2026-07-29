'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Loader2, Check, X } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface AcademicYear { id: string; name: string; is_clinical: boolean }
interface Semester { id: string; name: string; academic_year_id: string }
interface Subject { id: string; name: string; semester_id: string | null; year_id: string | null }
interface Batch { id: string; name: string; subject_id: string }
interface Doctor { id: string; name: string }

export default function ExamsTab() {
  const supabase = createClient()
  const router = useRouter()

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  // Form state
  const [selectedYear, setSelectedYear] = useState('')
  const [selectedSemester, setSelectedSemester] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedBatch, setSelectedBatch] = useState('')
  const [selectedDoctor, setSelectedDoctor] = useState('')
  const [title, setTitle] = useState('')
  const [examType, setExamType] = useState('final')
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear().toString())
  
  const [status, setStatus] = useState('draft')

  useEffect(() => {
    async function load() {
      const [yearsRes, semsRes, subsRes, batchesRes, docsRes] = await Promise.all([
        supabase.from('academic_years').select('id, name, is_clinical').order('display_order'),
        supabase.from('semesters').select('id, name, academic_year_id').order('display_order'),
        supabase.from('subjects').select('id, name, semester_id, year_id').order('name'),
        supabase.from('batches').select('id, name, subject_id').order('name'),
        supabase.from('doctors').select('id, name').order('name'),
      ])
      setAcademicYears(yearsRes.data ?? [])
      setSemesters(semsRes.data ?? [])
      setSubjects(subsRes.data ?? [])
      setBatches(batchesRes.data ?? [])
      setDoctors(docsRes.data ?? [])
      setLoading(false)
    }
    load()
  }, [])

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

  const filteredDoctors = doctors

  async function handleCreate() {
    if (!title.trim() || !selectedBatch) {
      showToast('Please fill all required fields', 'error')
      return
    }

    setIsSaving(true)

    // جلب academic_year_id للامتحان
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

    if (error) {
      showToast(error.message, 'error')
      return
    }

    showToast('Exam created successfully!')
    setTimeout(() => {
      router.push(`/admin/exams/${exam.id}`)
    }, 1000)
  }

  const inputCls = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black"
  const selectCls = inputCls
  const labelCls = "block text-sm font-medium mb-1.5"

  if (loading) {
    return <div className="animate-pulse space-y-4">
      {[1,2,3,4].map(i => <div key={i} className="h-12 bg-muted rounded-lg" />)}
    </div>
  }

  return (
    <div className="space-y-6">

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-black text-white'
        }`}>
          {toast.type === 'error' ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm space-y-5">
        <h2 className="font-semibold text-lg">New Exam</h2>

        {/* Step 1: Academic Year */}
        <div>
          <label className={labelCls}>Academic Year <span className="text-red-500">*</span></label>
          <select className={selectCls} value={selectedYear} onChange={e => {
            setSelectedYear(e.target.value)
            setSelectedSemester('')
            setSelectedSubject('')
            setSelectedBatch('')
          }}>
            <option value="">Select Year</option>
            {academicYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
          </select>
        </div>

        {/* Step 2: Semester (pre-clinical only) */}
        {selectedYear && !isClinical && (
          <div>
            <label className={labelCls}>Semester <span className="text-red-500">*</span></label>
            <select className={selectCls} value={selectedSemester} onChange={e => {
              setSelectedSemester(e.target.value)
              setSelectedSubject('')
              setSelectedBatch('')
            }}>
              <option value="">Select Semester</option>
              {filteredSemesters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}

        {/* Step 3: Subject */}
        {(isClinical ? selectedYear : selectedSemester) && (
          <div>
            <label className={labelCls}>Subject <span className="text-red-500">*</span></label>
            <select className={selectCls} value={selectedSubject} onChange={e => {
              setSelectedSubject(e.target.value)
              setSelectedBatch('')
            }}>
              <option value="">Select Subject</option>
              {filteredSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}

        {/* Step 4: Batch */}
        {selectedSubject && (
          <div>
            <label className={labelCls}>Batch <span className="text-red-500">*</span></label>
            <select className={selectCls} value={selectedBatch} onChange={e => setSelectedBatch(e.target.value)}>
              <option value="">Select Batch</option>
              {filteredBatches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        )}

        {/* Exam Details — show after batch selected */}
        {selectedBatch && (
          <>
            <hr className="border-border/60" />

            {/* Title */}
            <div>
              <label className={labelCls}>Exam Title <span className="text-red-500">*</span></label>
              <input
                className={inputCls}
                placeholder="e.g. Final Exam, Quiz 1, Midterm..."
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Exam Type */}
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

              {/* Calendar Year */}
              <div>
                <label className={labelCls}>Calendar Year</label>
                <input
                  className={inputCls}
                  placeholder="e.g. 2025"
                  value={calendarYear}
                  onChange={e => setCalendarYear(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Doctor */}
              <div>
                <label className={labelCls}>Doctor</label>
                <select className={selectCls} value={selectedDoctor} onChange={e => setSelectedDoctor(e.target.value)}>
                  <option value="">No doctor</option>
                  {filteredDoctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>

              
            </div>

            <div className="grid grid-cols-2 gap-4">
              

              {/* Status */}
              <div>
                <label className={labelCls}>Status</label>
                <select className={selectCls} value={status} onChange={e => setStatus(e.target.value)}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>
            </div>

            {/* Submit */}
            <div className="flex justify-end pt-2">
              <button
                onClick={handleCreate}
                disabled={isSaving || !title.trim()}
                className="flex items-center gap-2 rounded-lg bg-black px-6 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {isSaving ? 'Creating...' : 'Create Exam'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}