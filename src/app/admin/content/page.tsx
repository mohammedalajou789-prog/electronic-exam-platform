'use client'

import { useState, useEffect, useCallback } from 'react'

import { createClient } from '@/lib/supabase/client'
import {
  Plus, Trash2, ChevronRight,
  BookOpen, Users, Stethoscope,
  X, Loader2
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

  const [activeTab, setActiveTab] = useState<'subjects' | 'batches' | 'exams'>('subjects')
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])

  const [expandedSubject, setExpandedSubject] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Filter states
  const [filterYear, setFilterYear] = useState('All Years')
  const [filterSearch, setFilterSearch] = useState('')

  // Subject modal
  const [showSubjectModal, setShowSubjectModal] = useState(false)
  const [subjectMode, setSubjectMode] = useState<'pre-clinical' | 'clinical'>('clinical')
  const [newSubjectName, setNewSubjectName] = useState('')
  const [newSubjectDesc, setNewSubjectDesc] = useState('')
  const [newSubjectSemester, setNewSubjectSemester] = useState('')
  const [newSubjectYear, setNewSubjectYear] = useState('')

  // Batch modal
  const [showBatchModal, setShowBatchModal] = useState(false)

  // Exam modal + exams list
  const [showExamModal, setShowExamModal] = useState(false)
  const [exams, setExams] = useState<any[]>([])
  const [examFilterYear, setExamFilterYear] = useState('All Years')
  const [batchSearchQuery, setBatchSearchQuery] = useState('')
  const [newBatchSubject, setNewBatchSubject] = useState('')
  const [newBatchName, setNewBatchName] = useState('')
  const [allBatchNames, setAllBatchNames] = useState<string[]>([])

  // Per-subject inline forms
  const [newDoctorName, setNewDoctorName] = useState<Record<string, string>>({})
  const [newDoctorDept, setNewDoctorDept] = useState<Record<string, string>>({})
  const [newChapterName, setNewChapterName] = useState<Record<string, string>>({})
  const [newLectureName, setNewLectureName] = useState<Record<string, string>>({})
  const [selectedChapter, setSelectedChapter] = useState<Record<string, string>>({})

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    const [yearsRes, semsRes, subsRes, batchesRes, examsRes] = await Promise.all([
      supabase.from('academic_years').select('id, name, is_clinical').order('display_order'),
      supabase.from('semesters').select('*').order('display_order'),
      supabase.from('subjects').select(`
        id, name, description, semester_id, year_id,
        subject_doctors(id, doctor_id, doctor:doctors(name, department)),
        chapters(id, name, display_order, lectures(id, name, display_order)),
        batches(id, name)
      `).order('name'),
      supabase.from('batches').select('*').order('name'),
      supabase.from('exams').select('*').order('created_at', { ascending: false }),
    ])
    setAcademicYears(yearsRes.data || [])
    setSemesters(semsRes.data || [])
    const subsData = (subsRes.data || []) as Subject[]
    setSubjects(subsData)
    const batchesData = (batchesRes.data || []) as Batch[]
    const uniqueNames = [...new Set(batchesData.map((b: Batch) => b.name))]
    setAllBatchNames(uniqueNames)
    const rawExams = examsRes.data || []
    if (rawExams.length > 0) {
      console.log('RAW EXAM KEYS:', Object.keys(rawExams[0]))
      console.log('RAW EXAM[0]:', JSON.stringify(rawExams[0], null, 2))
    } else {
      console.log('NO EXAMS RETURNED — error:', examsRes.error)
    }
    console.log('SUBJECTS COUNT:', subsData.length, '| BATCHES COUNT:', batchesData.length)
    const enrichedExams = rawExams.map((exam: any) => ({
      ...exam,
      subject: subsData.find((s: Subject) => s.id === exam.subject_id) || null,
      batch: batchesData.find((b: Batch) => b.id === exam.batch_id) || null,
    }))
    setExams(enrichedExams)
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
      setShowSubjectModal(false)
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
    const { data: doc, error } = await supabase
      .from('doctors')
      .insert({ name, department: (newDoctorDept[subjectId] || '').trim() || null })
      .select('id')
      .single()
    if (error || !doc) { showToast(error?.message || 'Error', 'error'); setIsLoading(false); return }
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
    const finalName = newBatchName === '__new' ? '' : newBatchName.trim()
    if (!finalName) { setIsLoading(false); return }
    await supabase.from('batches').insert({ name: finalName, subject_id: newBatchSubject })
    setNewBatchName(''); setNewBatchSubject('')
    setShowBatchModal(false)
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
      return (academicYears.find(y => y.id === subject.year_id)?.name || '') + ' (Clinical)'
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

  // Filtered subjects for subjects tab
  const filteredSubjects = subjects.filter(s => {
    const matchSearch = !filterSearch || s.name.toLowerCase().includes(filterSearch.toLowerCase())
    if (filterYear === 'All Years') return matchSearch
    const yearObj = academicYears.find(y => y.name === filterYear)
    if (!yearObj) return matchSearch
    if (yearObj.is_clinical) return s.year_id === yearObj.id && matchSearch
    const yearSems = semesters.filter(sem => sem.academic_year_id === yearObj.id)
    return yearSems.some(sem => sem.id === s.semester_id) && matchSearch
  })

  // Group filtered subjects by year for display
  const subjectsByYear: { yearName: string; subjects: Subject[] }[] = []
  // Pre-clinical
  preClinicalYears.forEach(year => {
    const yearSems = semesters.filter(s => s.academic_year_id === year.id)
    const yearSubjects = filteredSubjects.filter(s => yearSems.some(sem => sem.id === s.semester_id))
    if (yearSubjects.length > 0) subjectsByYear.push({ yearName: year.name, subjects: yearSubjects })
  })
  // Clinical
  clinicalYears.forEach(year => {
    const yearSubjects = filteredSubjects.filter(s => s.year_id === year.id)
    if (yearSubjects.length > 0) subjectsByYear.push({ yearName: year.name, subjects: yearSubjects })
  })

  // Filtered subjects for batches tab
  const subjectsWithBatches = subjects.filter(s => {
    const hasBatches = (s.batches || []).length > 0
    const matchSearch = !batchSearchQuery ||
      s.name.toLowerCase().includes(batchSearchQuery.toLowerCase()) ||
      s.batches.some(b => b.name.toLowerCase().includes(batchSearchQuery.toLowerCase()))
    return hasBatches && matchSearch
  })

  // ── Subject Row Component ─────────────────────────────────────────────────

  function SubjectRow({ subject }: { subject: Subject }) {
    const isExpanded = expandedSubject === subject.id
    const isClinical = !!subject.year_id

    return (
      <div className="adm-card adm-row-fade" style={{ overflow: 'hidden' }}>
        {/* Subject Header */}
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '18px 20px', cursor: 'pointer',
          }}
          onClick={() => setExpandedSubject(isExpanded ? null : subject.id)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <ChevronRight
              width={15} height={15}
              stroke="var(--fg-muted)"
              strokeWidth={2.5}
              style={{
                transition: 'transform 0.2s',
                transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                flexShrink: 0,
              }}
            />
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 800 }}>
                {subject.name}
                {' '}
                <span style={{ fontSize: 12, fontWeight: 700, color: isClinical ? 'var(--accent-purple)' : 'var(--accent-blue)', marginLeft: 6 }}>
                  {isClinical ? 'Clinical' : 'Pre-Clinical'}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 3 }}>
                {subject.subject_doctors?.length || 0} doctors · {subject.chapters?.length || 0} chapters · {subject.batches?.length || 0} batches
              </div>
            </div>
          </div>
          <button
            onClick={e => { e.stopPropagation(); deleteSubject(subject.id) }}
            style={{
              width: 32, height: 32, borderRadius: 9, border: 'none',
              background: 'transparent', color: 'var(--accent-orange)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Trash2 width={16} height={16} />
          </button>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div style={{
            padding: '18px 20px 22px',
            borderTop: '1px solid var(--bd)',
            display: 'flex', flexDirection: 'column', gap: 20,
          }}>

            {/* Doctors */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 800, marginBottom: 10 }}>
                <Stethoscope width={15} height={15} stroke="var(--clr-primary)" />
                Doctors
              </div>
              {(subject.subject_doctors || []).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  {subject.subject_doctors.map(sd => (
                    <span key={sd.id} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      fontSize: 12.5, fontWeight: 600,
                      padding: '6px 8px 6px 13px', borderRadius: 20,
                      background: 'var(--bg-soft)', border: '1px solid var(--bd)',
                    }}>
                      {Array.isArray(sd.doctor) ? sd.doctor[0]?.name : sd.doctor.name}
                      <button
                        onClick={() => removeDoctorFromSubject(sd.id)}
                        style={{
                          width: 16, height: 16, borderRadius: '50%', border: 'none',
                          background: 'transparent', color: 'var(--fg-muted)',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                        }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--fg-muted)')}
                      >
                        <X width={10} height={10} strokeWidth={3} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10 }}>
                <input
                  className="adm-input"
                  placeholder="Doctor name (e.g. Dr. Ahmad)"
                  value={newDoctorName[subject.id] || ''}
                  onChange={e => setNewDoctorName(p => ({ ...p, [subject.id]: e.target.value }))}
                />
                <input
                  className="adm-input"
                  placeholder="Department (optional)"
                  value={newDoctorDept[subject.id] || ''}
                  onChange={e => setNewDoctorDept(p => ({ ...p, [subject.id]: e.target.value }))}
                />
                <button
                  onClick={() => addDoctorToSubject(subject.id)}
                  disabled={isLoading || !(newDoctorName[subject.id] || '').trim()}
                  className="adm-btn-ghost"
                >
                  {isLoading ? <Loader2 width={14} height={14} className="animate-spin" /> : 'Add'}
                </button>
              </div>
            </div>

            {/* Chapters & Lectures */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 800, marginBottom: 10 }}>
                <BookOpen width={15} height={15} stroke="var(--clr-primary)" />
                Chapters &amp; Lectures
              </div>

              {/* Add chapter row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, marginBottom: 10 }}>
                <input
                  className="adm-input"
                  placeholder="New chapter name (e.g. Cardiovascular System)"
                  value={newChapterName[subject.id] || ''}
                  onChange={e => setNewChapterName(p => ({ ...p, [subject.id]: e.target.value }))}
                />
                <button
                  onClick={() => addChapter(subject.id)}
                  disabled={isLoading || !(newChapterName[subject.id] || '').trim()}
                  className="adm-btn-ghost"
                >
                  + Add Chapter
                </button>
              </div>

              {/* Add lecture row */}
              {(subject.chapters || []).length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, marginBottom: 14 }}>
                  <select
                    className="adm-input"
                    value={selectedChapter[subject.id] || ''}
                    onChange={e => setSelectedChapter(p => ({ ...p, [subject.id]: e.target.value }))}
                  >
                    <option value="">Select chapter to add lecture</option>
                    {subject.chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <input
                    className="adm-input"
                    placeholder="Lecture name"
                    value={newLectureName[subject.id] || ''}
                    onChange={e => setNewLectureName(p => ({ ...p, [subject.id]: e.target.value }))}
                  />
                  <button
                    onClick={() => addLecture(subject.id)}
                    disabled={isLoading || !(newLectureName[subject.id] || '').trim() || !selectedChapter[subject.id]}
                    className="adm-btn-ghost"
                  >
                    + Add Lecture
                  </button>
                </div>
              )}

              {/* Chapters list */}
              {(subject.chapters || []).length === 0 ? (
                <p style={{ fontSize: 12.5, color: 'var(--fg-muted)', textAlign: 'center', padding: '14px 0', border: '1px dashed var(--bd)', borderRadius: 10, margin: 0 }}>
                  No chapters yet
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {subject.chapters.sort((a, b) => a.display_order - b.display_order).map(chapter => (
                    <div key={chapter.id} style={{ border: '1px solid var(--bd)', borderRadius: 12, overflow: 'hidden' }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 14px', background: 'var(--bg-soft)',
                      }}>
                        <span style={{ fontWeight: 700, fontSize: 13 }}>{chapter.name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 11.5, color: 'var(--fg-muted)' }}>
                            {chapter.lectures?.length || 0} lectures
                          </span>
                          <button
                            onClick={() => deleteChapter(chapter.id)}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--fg-muted)', padding: 0, display: 'flex' }}
                            onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'var(--fg-muted)')}
                          >
                            <Trash2 width={13} height={13} />
                          </button>
                        </div>
                      </div>
                      {(chapter.lectures || []).length > 0 && (
                        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                          {chapter.lectures.sort((a, b) => a.display_order - b.display_order).map((lecture, idx) => (
                            <li key={lecture.id} style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '8px 18px',
                              borderTop: idx === 0 ? '1px solid var(--bd)' : '1px solid var(--bd)',
                            }}>
                              <span style={{ fontSize: 12.5, color: 'var(--fg-muted)' }}>{lecture.name}</span>
                              <button
                                onClick={() => deleteLecture(lecture.id)}
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--fg-muted)', padding: 0, display: 'flex' }}
                                onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                                onMouseLeave={e => (e.currentTarget.style.color = 'var(--fg-muted)')}
                              >
                                <Trash2 width={12} height={12} />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        .adm-content-root {
          --bg:            oklch(98% 0.006 55);
          --bg-elev:       oklch(100% 0 0);
          --bg-soft:       oklch(96% 0.009 55);
          --fg:            oklch(22% 0.02 50);
          --fg-muted:      oklch(46% 0.02 50);
          --bd:            oklch(89% 0.012 50);
          --clr-primary:   oklch(50% 0.19 25);
          --clr-soft:      oklch(94% 0.035 25);
          --shadow:        rgba(20,10,10,0.08);
          --accent-green:  #22c55e;
          --accent-blue:   #3b82f6;
          --accent-purple: #a855f7;
          --accent-orange: #f97316;
        }
        .dark .adm-content-root {
          --bg:            oklch(18% 0.01 50);
          --bg-elev:       oklch(22% 0.012 50);
          --bg-soft:       oklch(20% 0.01 50);
          --fg:            oklch(92% 0.008 50);
          --fg-muted:      oklch(62% 0.015 50);
          --bd:            oklch(32% 0.015 50);
          --clr-primary:   oklch(68% 0.18 25);
          --clr-soft:      oklch(28% 0.06 25);
          --shadow:        rgba(0,0,0,0.35);
          --accent-green:  #4ade80;
          --accent-blue:   #60a5fa;
          --accent-purple: #c084fc;
          --accent-orange: #fb923c;
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.92); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(-10px) translateX(-50%); }
          to   { opacity: 1; transform: translateY(0) translateX(-50%); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .adm-row-fade { opacity: 0; animation: fadeInUp 0.4s ease-out forwards; }
        .adm-content-root .adm-input {
          width: 100%;
          border: 1px solid var(--bd);
          background: var(--bg-soft);
          color: var(--fg);
          border-radius: 10px;
          padding: 10px 13px;
          font-size: 13.5px;
          outline: none;
          font-family: inherit;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .adm-content-root .adm-input:focus {
          border-color: var(--clr-primary);
          box-shadow: 0 0 0 3px var(--clr-soft);
        }
        .adm-content-root .adm-btn-primary {
          background: var(--clr-primary);
          color: #fff;
          border: none;
          border-radius: 11px;
          padding: 11px 20px;
          font-size: 13.5px;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          transition: transform 0.15s, opacity 0.15s;
          display: flex;
          align-items: center;
          gap: 7px;
        }
        .adm-content-root .adm-btn-primary:hover { opacity: 0.92; transform: translateY(-1px); }
        .adm-content-root .adm-btn-primary:active { transform: translateY(0); }
        .adm-content-root .adm-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .adm-content-root .adm-btn-ghost {
          background: var(--bg-soft);
          color: var(--fg);
          border: 1px solid var(--bd);
          border-radius: 11px;
          padding: 10px 18px;
          font-size: 13.5px;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          transition: background 0.15s;
          display: flex;
          align-items: center;
          gap: 7px;
          white-space: nowrap;
        }
        .adm-content-root .adm-btn-ghost:hover { background: var(--bd); }
        .adm-content-root .adm-btn-ghost:disabled { opacity: 0.5; cursor: not-allowed; }
        .adm-content-root .adm-card {
          background: var(--bg-elev);
          border: 1px solid var(--bd);
          border-radius: 18px;
        }
        .adm-content-root .adm-tab {
          padding: 9px 16px;
          border-radius: 10px;
          font-size: 13.5px;
          font-weight: 700;
          border: 1px solid transparent;
          cursor: pointer;
          font-family: inherit;
          color: var(--fg-muted);
          text-align: center;
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 1 1 0%;
          background: transparent;
          transition: all 0.15s;
        }
        .adm-content-root .adm-tab.active {
          background: var(--bg-elev);
          border-color: var(--bd);
          color: var(--fg);
          box-shadow: 0 1px 3px var(--shadow);
        }
        .adm-content-root .adm-segment {
          padding: 10px 14px;
          border-radius: 10px;
          border: 1px solid var(--bd);
          background: var(--bg-soft);
          color: var(--fg);
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          text-align: center;
          transition: all 0.15s;
        }
        .adm-content-root .adm-segment.active {
          background: var(--clr-primary);
          color: #fff;
          border-color: var(--clr-primary);
        }
        .adm-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.45);
          z-index: 400;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          animation: fadeInUp 0.15s ease-out;
        }
        .adm-modal-card {
          background: var(--bg-elev);
          border: 1px solid var(--bd);
          border-radius: 18px;
          padding: 24px;
          width: 100%;
          max-width: 480px;
          animation: popIn 0.2s ease-out;
        }
        .adm-content-root .adm-fade {
          animation: fadeSlideIn 0.4s ease-out;
        }
        .adm-content-root .adm-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .adm-content-root .adm-scrollbar::-webkit-scrollbar-thumb { background: var(--bd); border-radius: 8px; }
      `}</style>

      <div
        className="adm-content-root"
        style={{
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
          flex: '1 1 0%',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
          color: 'var(--fg)',
        }}
      >

        {/* Toast */}
        {toast && (
          <div style={{
            position: 'fixed', bottom: 24, left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '12px 20px', borderRadius: 12,
            fontSize: 13.5, fontWeight: 600,
            background: toast.type === 'error' ? '#dc2626' : 'var(--clr-primary)',
            color: '#fff',
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
            zIndex: 999,
            animation: 'toastIn 0.25s ease-out',
            whiteSpace: 'nowrap',
          }}>
            {toast.msg}
          </div>
        )}

        {/* ── STICKY HEADER ──────────────────────────────────────────────────── */}
        <div style={{
          flexShrink: 0,
          background: 'var(--bg-elev)',
          borderBottom: '1px solid var(--bd)',
          padding: '20px 32px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Content Management</h1>
          <p style={{ margin: '-8px 0 0', fontSize: 13, color: 'var(--fg-muted)' }}>
            Add subjects with their doctors, chapters, and lectures. Then add batches.
          </p>

          {/* Tabs */}
          <div style={{
            display: 'flex', gap: 6,
            background: 'var(--bg-soft)',
            border: '1px solid var(--bd)',
            borderRadius: 13, padding: 5,
            width: '100%',
          }}>
            {[
              { key: 'subjects', label: 'Subjects & Content' },
              { key: 'batches',  label: 'Batches' },
              { key: 'exams',    label: 'Create Exam' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as 'subjects' | 'batches' | 'exams')}
                className={`adm-tab${activeTab === tab.key ? ' active' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab-specific toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {activeTab === 'subjects' && (
              <>
                <input
                  className="adm-input"
                  placeholder="Search by subject name..."
                  value={filterSearch}
                  onChange={e => setFilterSearch(e.target.value)}
                  style={{ flex: '1 1 0%', minWidth: 200 }}
                />
                <select
                  className="adm-input"
                  value={filterYear}
                  onChange={e => setFilterYear(e.target.value)}
                  style={{ width: 150 }}
                >
                  <option value="All Years">All Years</option>
                  {academicYears.map(y => (
                    <option key={y.id} value={y.name}>{y.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => setShowSubjectModal(true)}
                  className="adm-btn-primary"
                  style={{ flexShrink: 0 }}
                >
                  <Plus width={14} height={14} strokeWidth={2.5} />
                  Add New Subject
                </button>
              </>
            )}

            {activeTab === 'batches' && (
              <>
                <input
                  className="adm-input"
                  placeholder="Search by subject or batch name..."
                  value={batchSearchQuery}
                  onChange={e => setBatchSearchQuery(e.target.value)}
                  style={{ flex: '1 1 0%', minWidth: 200 }}
                />
                <button
                  onClick={() => setShowBatchModal(true)}
                  className="adm-btn-primary"
                  style={{ flexShrink: 0 }}
                >
                  <Plus width={14} height={14} strokeWidth={2.5} />
                  Add New Batch
                </button>
              </>
            )}

            {activeTab === 'exams' && (
              <>
                <select
                  className="adm-input"
                  style={{ width: 150 }}
                  value={examFilterYear}
                  onChange={e => setExamFilterYear(e.target.value)}
                >
                  <option value="All Years">All Years</option>
                  {academicYears.map(y => <option key={y.id} value={y.name}>{y.name}</option>)}
                </select>
                <select className="adm-input" style={{ width: 160 }}>
                  <option value="All Semesters">All Semesters</option>
                  <option value="First Semester">First Semester</option>
                  <option value="Second Semester">Second Semester</option>
                  <option value="Summer">Summer</option>
                </select>
                <div style={{ flex: '1 1 0%' }} />
                <button
                  onClick={() => setShowExamModal(true)}
                  className="adm-btn-primary"
                  style={{ flexShrink: 0 }}
                >
                  <Plus width={14} height={14} strokeWidth={2.5} />
                  Add New Exam
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── SCROLLABLE CONTENT ─────────────────────────────────────────────── */}
        <div
          className="adm-scrollbar"
          style={{
            flex: '1 1 0%',
            overflowY: 'auto',
            padding: '28px 32px 64px',
            maxWidth: 1280,
            width: '100%',
            margin: '0 auto',
          }}
        >

          {/* ══ SUBJECTS TAB ════════════════════════════════════════════════ */}
          {activeTab === 'subjects' && (
            <div className="adm-fade" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {subjectsByYear.length === 0 ? (
                <div style={{ border: '1px dashed var(--bd)', borderRadius: 18, padding: '60px 0', textAlign: 'center' }}>
                  <p style={{ fontSize: 13.5, color: 'var(--fg-muted)', margin: 0 }}>
                    No subjects yet. Add your first subject.
                  </p>
                </div>
              ) : (
                subjectsByYear.map(group => (
                  <div key={group.yearName}>
                    <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>{group.yearName}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {group.subjects.map(subject => (
                        <SubjectRow key={subject.id} subject={subject} />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ══ BATCHES TAB ═════════════════════════════════════════════════ */}
          {activeTab === 'batches' && (
            <div className="adm-fade" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {subjectsWithBatches.length === 0 ? (
                <div style={{ border: '1px dashed var(--bd)', borderRadius: 18, padding: '60px 0', textAlign: 'center' }}>
                  <Users width={36} height={36} style={{ margin: '0 auto 12px', color: 'var(--fg-muted)', opacity: 0.4, display: 'block' }} />
                  <p style={{ fontSize: 13.5, color: 'var(--fg-muted)', margin: 0 }}>
                    No batches yet. Add your first batch.
                  </p>
                </div>
              ) : (
                subjectsWithBatches.map(subject => (
                  <div key={subject.id} className="adm-card" style={{ padding: '18px 20px' }}>
                    <div style={{ fontSize: 14.5, fontWeight: 800, marginBottom: 2 }}>{subject.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginBottom: 12 }}>{getSubjectLocation(subject)}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                      {subject.batches.map((batch, idx) => (
                        <div key={batch.id} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '10px 4px',
                          borderTop: '1px solid var(--bd)',
                        }}>
                          <span style={{ fontSize: 13.5, fontWeight: 600 }}>{batch.name}</span>
                          <button
                            onClick={() => deleteBatch(batch.id)}
                            style={{
                              width: 28, height: 28, borderRadius: 8, border: 'none',
                              background: 'transparent', color: 'var(--accent-orange)',
                              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                          >
                            <Trash2 width={14} height={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ══ EXAMS TAB ═══════════════════════════════════════════════════ */}
          {activeTab === 'exams' && (() => {
            // دالة مساعدة: استخرج اسم السنة من الامتحان
            const getExamYearName = (exam: any): string => {
              const subj = exam.subject
              if (!subj) return '—'
              if (subj.year_id) {
                return academicYears.find(y => y.id === subj.year_id)?.name || '—'
              }
              if (subj.semester_id) {
                const sem = semesters.find(s => s.id === subj.semester_id)
                return academicYears.find(y => y.id === sem?.academic_year_id)?.name || '—'
              }
              return '—'
            }

            const filteredExams = examFilterYear === 'All Years'
              ? exams
              : exams.filter(exam => getExamYearName(exam) === examFilterYear)

            // جمّع حسب اسم السنة مباشرة بدون الاعتماد على academicYears loop
            const yearMap: Record<string, any[]> = {}
            for (const exam of filteredExams) {
              const yn = getExamYearName(exam)
              if (!yearMap[yn]) yearMap[yn] = []
              yearMap[yn].push(exam)
            }
            const examsByYear = Object.entries(yearMap).map(([yearName, exs]) => ({ yearName, exams: exs }))

            return (
              <div className="adm-fade">
                <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 14 }}>Existing Exams</div>
                {examsByYear.length === 0 ? (
                  <div style={{ border: '1px dashed var(--bd)', borderRadius: 18, padding: '60px 0', textAlign: 'center' }}>
                    <p style={{ fontSize: 13.5, color: 'var(--fg-muted)', margin: 0 }}>No exams yet. Add your first exam.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    {examsByYear.map(group => (
                      <div key={group.yearName}>
                        <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--fg-muted)', marginBottom: 10 }}>{group.yearName}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {group.exams.map(exam => (
                            <div key={exam.id} className="adm-card adm-row-fade" style={{ padding: '16px 20px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                                    <span style={{ fontSize: 14.5, fontWeight: 800 }}>{exam.title}</span>
                                    <span style={{
                                      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                                      background: exam.status === 'Published' ? 'var(--clr-soft)' : 'var(--bg-soft)',
                                      color: exam.status === 'Published' ? 'var(--clr-primary)' : 'var(--fg-muted)',
                                    }}>{exam.status}</span>
                                  </div>
                                  <div style={{ fontSize: 12.5, color: 'var(--fg-muted)', marginTop: 4 }}>
                                    {exam.subject?.name} · Batch {exam.batch?.name} · {exam.exam_type} · {exam.calendar_year} · {exam.questions?.length ?? 0} questions
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                                  <button className="adm-btn-ghost" style={{ padding: '7px 13px', fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                                    Edit Info
                                  </button>
                                  <button className="adm-btn-ghost" style={{ padding: '7px 13px', fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    Questions
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })()}

        </div>
      </div>

      {/* ── ADD SUBJECT MODAL ──────────────────────────────────────────────── */}
      {showSubjectModal && (
        <div className="adm-modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setShowSubjectModal(false) }}>
          <div className="adm-modal-card adm-content-root">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>New Subject</div>
              <button
                onClick={() => setShowSubjectModal(false)}
                style={{ width: 26, height: 26, borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--fg-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X width={15} height={15} />
              </button>
            </div>

            {/* Pre-clinical / Clinical toggle */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <button
                className={`adm-segment${subjectMode === 'pre-clinical' ? ' active' : ''}`}
                onClick={() => setSubjectMode('pre-clinical')}
              >
                Pre-Clinical (Years 1–3)
              </button>
              <button
                className={`adm-segment${subjectMode === 'clinical' ? ' active' : ''}`}
                onClick={() => setSubjectMode('clinical')}
              >
                Clinical (Years 4–6)
              </button>
            </div>

            {/* Year/Semester selector */}
            {subjectMode === 'pre-clinical' ? (
              <select
                className="adm-input"
                style={{ marginBottom: 12 }}
                value={newSubjectSemester}
                onChange={e => setNewSubjectSemester(e.target.value)}
              >
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
              <select
                className="adm-input"
                style={{ marginBottom: 12 }}
                value={newSubjectYear}
                onChange={e => setNewSubjectYear(e.target.value)}
              >
                <option value="">Select Clinical Year</option>
                {clinicalYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
            )}

            <input
              className="adm-input"
              placeholder="Subject name (e.g. Internal Medicine)"
              value={newSubjectName}
              onChange={e => setNewSubjectName(e.target.value)}
              style={{ marginBottom: 12 }}
            />
            <input
              className="adm-input"
              placeholder="Description (optional)"
              value={newSubjectDesc}
              onChange={e => setNewSubjectDesc(e.target.value)}
              style={{ marginBottom: 16 }}
            />

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowSubjectModal(false)} className="adm-btn-ghost">Cancel</button>
              <button
                onClick={addSubject}
                disabled={isLoading || !newSubjectName.trim() || (subjectMode === 'pre-clinical' ? !newSubjectSemester : !newSubjectYear)}
                className="adm-btn-primary"
              >
                {isLoading ? <Loader2 width={15} height={15} className="animate-spin" /> : null}
                + Add Subject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD EXAM MODAL ─────────────────────────────────────────────────── */}
      {showExamModal && (
        <div className="adm-modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setShowExamModal(false) }}>
          <div className="adm-modal-card adm-content-root adm-scrollbar" style={{ maxWidth: 560, maxHeight: '88vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>New Exam</div>
              <button
                onClick={() => setShowExamModal(false)}
                style={{ width: 26, height: 26, borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--fg-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X width={15} height={15} />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <label style={{ display: 'block' }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--fg-muted)', marginBottom: 6 }}>Academic Year *</div>
                <select className="adm-input">
                  <option value="">Select Year</option>
                  {academicYears.map(y => <option key={y.id} value={y.name}>{y.name}</option>)}
                </select>
              </label>
              <label style={{ display: 'block' }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--fg-muted)', marginBottom: 6 }}>Subject *</div>
                <select className="adm-input">
                  <option value="">Select Subject</option>
                  {subjects.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </label>
              <label style={{ display: 'block' }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--fg-muted)', marginBottom: 6 }}>Batch *</div>
                <select className="adm-input">
                  <option value="">Select Batch</option>
                  {allBatchNames.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </label>
              <label style={{ display: 'block' }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--fg-muted)', marginBottom: 6 }}>Exam Title *</div>
                <input className="adm-input" placeholder="e.g. Final Exam, Quiz 1, Midterm..." />
              </label>
              <label style={{ display: 'block' }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--fg-muted)', marginBottom: 6 }}>Exam Type</div>
                <select className="adm-input">
                  <option value="Final">Final</option>
                  <option value="Midterm">Midterm</option>
                  <option value="Quiz">Quiz</option>
                </select>
              </label>
              <label style={{ display: 'block' }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--fg-muted)', marginBottom: 6 }}>Calendar Year</div>
                <input className="adm-input" defaultValue={new Date().getFullYear().toString()} />
              </label>
              <label style={{ display: 'block' }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--fg-muted)', marginBottom: 6 }}>Doctor</div>
                <select className="adm-input">
                  <option value="">No doctor</option>
                </select>
              </label>
              <label style={{ display: 'block' }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--fg-muted)', marginBottom: 6 }}>Status</div>
                <select className="adm-input">
                  <option value="Draft">Draft</option>
                  <option value="Published">Published</option>
                </select>
              </label>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowExamModal(false)} className="adm-btn-ghost">Cancel</button>
              <button className="adm-btn-primary">+ Create Exam</button>
            </div>
          </div>
        </div>
      )}
      {showBatchModal && (
        <div className="adm-modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setShowBatchModal(false) }}>
          <div className="adm-modal-card adm-content-root">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>New Batch</div>
              <button
                onClick={() => setShowBatchModal(false)}
                style={{ width: 26, height: 26, borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--fg-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X width={15} height={15} />
              </button>
            </div>

            <select
              className="adm-input"
              style={{ marginBottom: 12 }}
              value={newBatchSubject}
              onChange={e => setNewBatchSubject(e.target.value)}
            >
              <option value="">Select Subject</option>
              {preClinicalYears.map(year => {
                const yearSems = semesters.filter(s => s.academic_year_id === year.id)
                return yearSems.map(sem => {
                  const semSubjects = subjects.filter(s => s.semester_id === sem.id)
                  if (!semSubjects.length) return null
                  return (
                    <optgroup key={sem.id} label={`${year.name} — ${sem.name}`}>
                      {semSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </optgroup>
                  )
                })
              })}
              {clinicalYears.map(year => {
                const yearSubjects = subjects.filter(s => s.year_id === year.id)
                if (!yearSubjects.length) return null
                return (
                  <optgroup key={year.id} label={year.name}>
                    {yearSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </optgroup>
                )
              })}
            </select>

            <select
              className="adm-input"
              style={{ marginBottom: 12 }}
              value={newBatchName}
              onChange={e => setNewBatchName(e.target.value)}
            >
              <option value="">Select Batch Name</option>
              {allBatchNames.map(b => <option key={b} value={b}>{b}</option>)}
              <option value="__new">+ New name</option>
            </select>

            {newBatchName === '__new' && (
              <input
                className="adm-input"
                placeholder="Enter new batch name..."
                style={{ marginBottom: 12 }}
                onChange={e => setNewBatchName(e.target.value)}
                autoFocus
              />
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button onClick={() => { setShowBatchModal(false); setNewBatchSubject(''); setNewBatchName('') }} className="adm-btn-ghost">Cancel</button>
              <button
                onClick={addBatch}
                disabled={isLoading || !newBatchName.trim() || newBatchName === '__new' || !newBatchSubject}
                className="adm-btn-primary"
              >
                {isLoading ? <Loader2 width={15} height={15} className="animate-spin" /> : null}
                + Add Batch
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}