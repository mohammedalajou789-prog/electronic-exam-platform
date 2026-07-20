'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, X } from 'lucide-react'
import Link from 'next/link'

interface AcademicYear { id: string; name: string; is_clinical: boolean }
interface Semester     { id: string; name: string; academic_year_id: string }
interface Subject      { id: string; name: string; semester_id: string | null; year_id: string | null }
interface Batch        { id: string; name: string; subject_id: string }
interface Doctor       { id: string; name: string }

export default function NewExamPage() {
  const router = useRouter()
  const supabase = createClient()

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [semesters, setSemesters]         = useState<Semester[]>([])
  const [subjects, setSubjects]           = useState<Subject[]>([])
  const [batches, setBatches]             = useState<Batch[]>([])
  const [doctors, setDoctors]             = useState<Doctor[]>([])

  const [selectedYear,     setSelectedYear]     = useState('')
  const [selectedSemester, setSelectedSemester] = useState('')
  const [selectedSubject,  setSelectedSubject]  = useState('')
  const [selectedBatch,    setSelectedBatch]    = useState('')
  const [selectedDoctors,  setSelectedDoctors]  = useState<Doctor[]>([])
  const [doctorToAdd,      setDoctorToAdd]      = useState('')

  const [title,        setTitle]        = useState('')
  const [examType,     setExamType]     = useState('final')
  const [calendarYear, setCalendarYear] = useState('')
  const [status,       setStatus]       = useState('draft')
  const [description,  setDescription]  = useState('')

  const [isLoading, setIsLoading] = useState(false)
  const [error,     setError]     = useState('')

  // هل السنة المختارة سريرية؟
  const isClinical = academicYears.find(y => y.id === selectedYear)?.is_clinical ?? false

  // ── Load initial ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const [{ data: years }, { data: docs }] = await Promise.all([
        supabase.from('academic_years').select('id, name, is_clinical').order('display_order'),
        supabase.from('doctors').select('id, name').order('name'),
      ])
      setAcademicYears(years || [])
      setDoctors(docs || [])
    }
    load()
  }, [])

  // ── Year changed ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedYear) { setSemesters([]); setSubjects([]); setBatches([]); return }

    const clinical = academicYears.find(y => y.id === selectedYear)?.is_clinical

    if (clinical) {
      // Clinical: جلب المواد مباشرة بدون فصل
      supabase.from('subjects').select('id, name, semester_id, year_id')
        .eq('year_id', selectedYear).order('name')
        .then(({ data }) => setSubjects(data || []))
      setSemesters([])
    } else {
      // Pre-Clinical: جلب الفصول أولاً
      supabase.from('semesters').select('*')
        .eq('academic_year_id', selectedYear).order('display_order')
        .then(({ data }) => setSemesters(data || []))
      setSubjects([])
    }

    setSelectedSemester('')
    setSelectedSubject('')
    setSelectedBatch('')
  }, [selectedYear, academicYears])

  // ── Semester changed (Pre-Clinical only) ──────────────────────────────────
  useEffect(() => {
    if (!selectedSemester) { setSubjects([]); return }
    supabase.from('subjects').select('id, name, semester_id, year_id')
      .eq('semester_id', selectedSemester).order('name')
      .then(({ data }) => setSubjects(data || []))
    setSelectedSubject('')
    setSelectedBatch('')
  }, [selectedSemester])

  // ── Subject changed ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedSubject) { setBatches([]); return }
    supabase.from('batches').select('*')
      .eq('subject_id', selectedSubject).order('name')
      .then(({ data }) => setBatches(data || []))
    setSelectedBatch('')
  }, [selectedSubject])

  // ── Doctor helpers ────────────────────────────────────────────────────────
  function addDoctor() {
    if (!doctorToAdd) return
    const doctor = doctors.find(d => d.id === doctorToAdd)
    if (!doctor || selectedDoctors.find(d => d.id === doctor.id)) return
    setSelectedDoctors([...selectedDoctors, doctor])
    setDoctorToAdd('')
  }

  function removeDoctor(id: string) {
    setSelectedDoctors(selectedDoctors.filter(d => d.id !== id))
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!selectedBatch) { setError('Please select a batch.'); return }
    if (!title.trim())  { setError('Please enter an exam title.'); return }

    setIsLoading(true)

    const { data: exam, error: insertError } = await supabase
      .from('exams')
      .insert({
        batch_id:      selectedBatch,
        title:         title.trim(),
        exam_type:     examType,
        calendar_year: calendarYear ? parseInt(calendarYear) : null,
        timer_mode:    'suggested',
        status,
        description:   description.trim() || null,
      })
      .select()
      .single()

    if (insertError || !exam) {
      setError('Failed to create exam. Please try again.')
      setIsLoading(false)
      return
    }

    if (selectedDoctors.length > 0) {
      await supabase.from('exam_doctors').insert(
        selectedDoctors.map(d => ({ exam_id: exam.id, doctor_id: d.id }))
      )
    }

    router.push('/admin/exams')
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  const inputClass  = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
  const selectClass = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white"
  const labelClass  = "block text-sm font-medium text-gray-700 mb-1"

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl space-y-6">

      <div className="flex items-center gap-4">
        <Link href="/admin/exams" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />Back to Exams
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold">Create New Exam</h1>
        <p className="text-muted-foreground">Fill in the exam details below</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-border/60 bg-card p-6 shadow-sm">

        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        )}

        {/* Academic Year */}
        <div>
          <label className={labelClass}>Academic Year</label>
          <select className={selectClass} value={selectedYear} onChange={e => setSelectedYear(e.target.value)} required>
            <option value="">Select Academic Year</option>
            {academicYears.map(y => (
              <option key={y.id} value={y.id}>{y.name}</option>
            ))}
          </select>
        </div>

        {/* Semester — فقط للسنوات Pre-Clinical */}
        {selectedYear && !isClinical && (
          <div>
            <label className={labelClass}>Semester</label>
            <select className={selectClass} value={selectedSemester} onChange={e => setSelectedSemester(e.target.value)} required>
              <option value="">Select Semester</option>
              {semesters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}

        {/* Subject */}
        {(isClinical ? selectedYear : selectedSemester) && (
          <div>
            <label className={labelClass}>Subject</label>
            <select className={selectClass} value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} required>
              <option value="">Select Subject</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}

        {/* Batch */}
        {selectedSubject && (
          <div>
            <label className={labelClass}>Batch</label>
            <select className={selectClass} value={selectedBatch} onChange={e => setSelectedBatch(e.target.value)} required>
              <option value="">Select Batch</option>
              {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        )}

        {/* Doctors */}
        <div>
          <label className={labelClass}>Doctors (Optional — can add multiple)</label>
          <div className="flex gap-2">
            <select className={selectClass} value={doctorToAdd} onChange={e => setDoctorToAdd(e.target.value)}>
              <option value="">Select Doctor</option>
              {doctors
                .filter(d => !selectedDoctors.find(sd => sd.id === d.id))
                .map(d => <option key={d.id} value={d.id}>{d.name}</option>)
              }
            </select>
            <button type="button" onClick={addDoctor} disabled={!doctorToAdd}
              className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50">
              Add
            </button>
          </div>
          {selectedDoctors.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {selectedDoctors.map(d => (
                <span key={d.id} className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-sm">
                  {d.name}
                  <button type="button" onClick={() => removeDoctor(d.id)} className="text-gray-400 hover:text-red-500">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Title */}
        <div>
          <label className={labelClass}>Exam Title</label>
          <input className={inputClass} type="text" placeholder="e.g. Final Exam 2024"
            value={title} onChange={e => setTitle(e.target.value)} required />
        </div>

        {/* Type & Year */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Exam Type</label>
            <select className={selectClass} value={examType} onChange={e => setExamType(e.target.value)}>
              <option value="quiz">Quiz</option>
              <option value="midterm">Midterm</option>
              <option value="final">Final</option>
              <option value="practical">Practical</option>
              <option value="mock">Mock</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Calendar Year</label>
            <input className={inputClass} type="number" placeholder="e.g. 2024"
              value={calendarYear} onChange={e => setCalendarYear(e.target.value)} min="2000" max="2100" />
          </div>
        </div>

        {/* Status */}
        <div>
          <label className={labelClass}>Status</label>
          <select className={selectClass} value={status} onChange={e => setStatus(e.target.value)}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        {/* Description */}
        <div>
          <label className={labelClass}>Description (Optional)</label>
          <textarea className={inputClass} rows={3} placeholder="Optional description..."
            value={description} onChange={e => setDescription(e.target.value)} />
        </div>

        <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">
          ⏱ Timer is automatic — each question = 1 minute.
        </div>

        <button type="submit" disabled={isLoading}
          className="w-full rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50">
          {isLoading ? 'Creating...' : 'Create Exam'}
        </button>

      </form>
    </div>
  )
}