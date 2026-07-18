'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, BookOpen, Users, Stethoscope, ChevronDown, ChevronRight } from 'lucide-react'

interface AcademicYear { id: string; name: string }
interface Semester { id: string; name: string; academic_year_id: string }
interface Subject { id: string; name: string; description: string | null; semester_id: string }
interface Batch { id: string; name: string; subject_id: string }
interface Doctor { id: string; name: string; department: string | null }
interface Chapter { id: string; name: string; subject_id: string; display_order: number }
interface Lecture { id: string; name: string; chapter_id: string; display_order: number }

export default function ContentManagementPage() {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<'subjects' | 'batches' | 'doctors' | 'chapters'>('subjects')

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [lectures, setLectures] = useState<Lecture[]>([])

  const [newSubjectName, setNewSubjectName] = useState('')
  const [newSubjectDesc, setNewSubjectDesc] = useState('')
  const [newSubjectSemester, setNewSubjectSemester] = useState('')

  const [newBatchName, setNewBatchName] = useState('')
  const [newBatchSubject, setNewBatchSubject] = useState('')

  const [newDoctorName, setNewDoctorName] = useState('')
  const [newDoctorDept, setNewDoctorDept] = useState('')

  const [selectedSubjectForChapter, setSelectedSubjectForChapter] = useState('')
  const [newChapterName, setNewChapterName] = useState('')
  const [newLectureName, setNewLectureName] = useState('')
  const [selectedChapterForLecture, setSelectedChapterForLecture] = useState('')
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set())

  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [
      { data: years }, { data: sems }, { data: subs },
      { data: bats }, { data: docs }, { data: chaps }, { data: lecs },
    ] = await Promise.all([
      supabase.from('academic_years').select('*').order('display_order'),
      supabase.from('semesters').select('*').order('display_order'),
      supabase.from('subjects').select('*').order('name'),
      supabase.from('batches').select('*').order('name'),
      supabase.from('doctors').select('*').order('name'),
      supabase.from('chapters').select('*').order('display_order'),
      supabase.from('lectures').select('*').order('display_order'),
    ])
    setAcademicYears(years || [])
    setSemesters(sems || [])
    setSubjects(subs || [])
    setBatches(bats || [])
    setDoctors(docs || [])
    setChapters(chaps || [])
    setLectures(lecs || [])
  }

  function showMessage(msg: string) {
    setMessage(msg)
    setTimeout(() => setMessage(''), 3000)
  }

  function toggleChapter(id: string) {
    setExpandedChapters(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function addSubject() {
    if (!newSubjectName.trim() || !newSubjectSemester) return
    setIsLoading(true)
    await supabase.from('subjects').insert({
      name: newSubjectName.trim(),
      description: newSubjectDesc.trim() || null,
      semester_id: newSubjectSemester,
    })
    setNewSubjectName(''); setNewSubjectDesc(''); setNewSubjectSemester('')
    await loadAll(); showMessage('Subject added successfully')
    setIsLoading(false)
  }

  async function deleteSubject(id: string) {
    if (!confirm('Delete this subject? This will also delete all its batches, chapters, and exams.')) return
    await supabase.from('subjects').delete().eq('id', id)
    await loadAll(); showMessage('Subject deleted')
  }

  async function addBatch() {
    if (!newBatchName.trim() || !newBatchSubject) return
    setIsLoading(true)
    await supabase.from('batches').insert({ name: newBatchName.trim(), subject_id: newBatchSubject })
    setNewBatchName(''); setNewBatchSubject('')
    await loadAll(); showMessage('Batch added successfully')
    setIsLoading(false)
  }

  async function deleteBatch(id: string) {
    if (!confirm('Delete this batch?')) return
    await supabase.from('batches').delete().eq('id', id)
    await loadAll(); showMessage('Batch deleted')
  }

  async function addDoctor() {
    if (!newDoctorName.trim()) return
    setIsLoading(true)
    await supabase.from('doctors').insert({
      name: newDoctorName.trim(),
      department: newDoctorDept.trim() || null,
    })
    setNewDoctorName(''); setNewDoctorDept('')
    await loadAll(); showMessage('Doctor added successfully')
    setIsLoading(false)
  }

  async function deleteDoctor(id: string) {
    if (!confirm('Delete this doctor?')) return
    await supabase.from('doctors').delete().eq('id', id)
    await loadAll(); showMessage('Doctor deleted')
  }

  async function addChapter() {
    if (!newChapterName.trim() || !selectedSubjectForChapter) return
    setIsLoading(true)
    const subjectChapters = chapters.filter(c => c.subject_id === selectedSubjectForChapter)
    await supabase.from('chapters').insert({
      name: newChapterName.trim(),
      subject_id: selectedSubjectForChapter,
      display_order: subjectChapters.length + 1,
    })
    setNewChapterName('')
    await loadAll(); showMessage('Chapter added successfully')
    setIsLoading(false)
  }

  async function deleteChapter(id: string) {
    if (!confirm('Delete this chapter? All its lectures will also be deleted.')) return
    await supabase.from('chapters').delete().eq('id', id)
    await loadAll(); showMessage('Chapter deleted')
  }

  async function addLecture() {
    if (!newLectureName.trim() || !selectedChapterForLecture) return
    setIsLoading(true)
    const chapterLectures = lectures.filter(l => l.chapter_id === selectedChapterForLecture)
    await supabase.from('lectures').insert({
      name: newLectureName.trim(),
      chapter_id: selectedChapterForLecture,
      display_order: chapterLectures.length + 1,
    })
    setNewLectureName('')
    await loadAll(); showMessage('Lecture added successfully')
    setIsLoading(false)
  }

  async function deleteLecture(id: string) {
    if (!confirm('Delete this lecture?')) return
    await supabase.from('lectures').delete().eq('id', id)
    await loadAll(); showMessage('Lecture deleted')
  }

  function getSemesterLabel(semId: string) {
    const sem = semesters.find(s => s.id === semId)
    if (!sem) return ''
    const year = academicYears.find(y => y.id === sem.academic_year_id)
    return `${year?.name || ''} — ${sem.name}`
  }

  function getSubjectName(subId: string) {
    return subjects.find(s => s.id === subId)?.name || ''
  }

  const inputClass = "flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
  const selectClass = "flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white"

  const tabs = [
    { key: 'subjects', label: 'Subjects', icon: <BookOpen className="h-4 w-4" /> },
    { key: 'batches', label: 'Batches', icon: <Users className="h-4 w-4" /> },
    { key: 'doctors', label: 'Doctors', icon: <Stethoscope className="h-4 w-4" /> },
    { key: 'chapters', label: 'Chapters & Lectures', icon: <BookOpen className="h-4 w-4" /> },
  ]

  const filteredChapters = selectedSubjectForChapter
    ? chapters.filter(c => c.subject_id === selectedSubjectForChapter)
    : chapters

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Content Management</h1>
        <p className="text-muted-foreground">Manage subjects, batches, doctors, and chapters</p>
      </div>

      {message && (
        <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border/60">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-black text-black'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* SUBJECTS */}
      {activeTab === 'subjects' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
            <h2 className="mb-3 font-semibold">Add New Subject</h2>
            <div className="flex flex-col gap-3">
              <select className={selectClass} value={newSubjectSemester} onChange={e => setNewSubjectSemester(e.target.value)}>
                <option value="">Select Semester</option>
                {academicYears.map(year => (
                  <optgroup key={year.id} label={year.name}>
                    {semesters.filter(s => s.academic_year_id === year.id).map(sem => (
                      <option key={sem.id} value={sem.id}>{sem.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <div className="flex gap-2">
                <input className={inputClass} placeholder="Subject name (e.g. Anatomy)" value={newSubjectName} onChange={e => setNewSubjectName(e.target.value)} />
                <input className={inputClass} placeholder="Description (optional)" value={newSubjectDesc} onChange={e => setNewSubjectDesc(e.target.value)} />
                <button onClick={addSubject} disabled={isLoading || !newSubjectName.trim() || !newSubjectSemester} className="flex items-center gap-1 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50">
                  <Plus className="h-4 w-4" />Add
                </button>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
            {subjects.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">No subjects yet</div>
            ) : (
              <table className="w-full">
                <thead><tr className="border-b border-border/60 bg-muted/30">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Subject</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Semester</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Description</th>
                  <th className="px-4 py-3"></th>
                </tr></thead>
                <tbody className="divide-y divide-border/60">
                  {subjects.map(subject => (
                    <tr key={subject.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium text-sm">{subject.name}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{getSemesterLabel(subject.semester_id)}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{subject.description || '—'}</td>
                      <td className="px-4 py-3"><button onClick={() => deleteSubject(subject.id)} className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* BATCHES */}
      {activeTab === 'batches' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
            <h2 className="mb-3 font-semibold">Add New Batch</h2>
            <div className="flex gap-2">
              <select className={selectClass} value={newBatchSubject} onChange={e => setNewBatchSubject(e.target.value)}>
                <option value="">Select Subject</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input className={inputClass} placeholder="Batch name (e.g. Wared)" value={newBatchName} onChange={e => setNewBatchName(e.target.value)} />
              <button onClick={addBatch} disabled={isLoading || !newBatchName.trim() || !newBatchSubject} className="flex items-center gap-1 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50">
                <Plus className="h-4 w-4" />Add
              </button>
            </div>
          </div>
          <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
            {batches.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">No batches yet</div>
            ) : (
              <table className="w-full">
                <thead><tr className="border-b border-border/60 bg-muted/30">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Batch</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Subject</th>
                  <th className="px-4 py-3"></th>
                </tr></thead>
                <tbody className="divide-y divide-border/60">
                  {batches.map(batch => (
                    <tr key={batch.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium text-sm">{batch.name}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{getSubjectName(batch.subject_id)}</td>
                      <td className="px-4 py-3"><button onClick={() => deleteBatch(batch.id)} className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* DOCTORS */}
      {activeTab === 'doctors' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
            <h2 className="mb-3 font-semibold">Add New Doctor</h2>
            <div className="flex gap-2">
              <input className={inputClass} placeholder="Doctor name (e.g. Dr. Ahmad)" value={newDoctorName} onChange={e => setNewDoctorName(e.target.value)} />
              <input className={inputClass} placeholder="Department (optional)" value={newDoctorDept} onChange={e => setNewDoctorDept(e.target.value)} />
              <button onClick={addDoctor} disabled={isLoading || !newDoctorName.trim()} className="flex items-center gap-1 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50">
                <Plus className="h-4 w-4" />Add
              </button>
            </div>
          </div>
          <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
            {doctors.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">No doctors yet</div>
            ) : (
              <table className="w-full">
                <thead><tr className="border-b border-border/60 bg-muted/30">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Doctor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Department</th>
                  <th className="px-4 py-3"></th>
                </tr></thead>
                <tbody className="divide-y divide-border/60">
                  {doctors.map(doctor => (
                    <tr key={doctor.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium text-sm">{doctor.name}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{doctor.department || '—'}</td>
                      <td className="px-4 py-3"><button onClick={() => deleteDoctor(doctor.id)} className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* CHAPTERS & LECTURES */}
      {activeTab === 'chapters' && (
        <div className="space-y-4">

          {/* Select Subject */}
          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
            <h2 className="mb-3 font-semibold">Select Subject</h2>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white"
              value={selectedSubjectForChapter}
              onChange={e => setSelectedSubjectForChapter(e.target.value)}
            >
              <option value="">Select a subject to manage its chapters</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {selectedSubjectForChapter && (
            <>
              {/* Add Chapter */}
              <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
                <h2 className="mb-3 font-semibold">Add New Chapter</h2>
                <div className="flex gap-2">
                  <input
                    className={inputClass}
                    placeholder="Chapter name (e.g. Cardiovascular System)"
                    value={newChapterName}
                    onChange={e => setNewChapterName(e.target.value)}
                  />
                  <button onClick={addChapter} disabled={isLoading || !newChapterName.trim()} className="flex items-center gap-1 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50">
                    <Plus className="h-4 w-4" />Add Chapter
                  </button>
                </div>
              </div>

              {/* Add Lecture */}
              <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
                <h2 className="mb-3 font-semibold">Add New Lecture</h2>
                <div className="flex gap-2">
                  <select
                    className={selectClass}
                    value={selectedChapterForLecture}
                    onChange={e => setSelectedChapterForLecture(e.target.value)}
                  >
                    <option value="">Select Chapter</option>
                    {filteredChapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <input
                    className={inputClass}
                    placeholder="Lecture name (e.g. Lecture 1 — Heart Anatomy)"
                    value={newLectureName}
                    onChange={e => setNewLectureName(e.target.value)}
                  />
                  <button onClick={addLecture} disabled={isLoading || !newLectureName.trim() || !selectedChapterForLecture} className="flex items-center gap-1 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50">
                    <Plus className="h-4 w-4" />Add Lecture
                  </button>
                </div>
              </div>

              {/* Chapters List */}
              <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
                <div className="border-b border-border/60 bg-muted/30 px-4 py-3">
                  <h2 className="font-semibold text-sm">
                    Chapters & Lectures — {subjects.find(s => s.id === selectedSubjectForChapter)?.name}
                  </h2>
                </div>
                {filteredChapters.length === 0 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">No chapters yet</div>
                ) : (
                  <ul className="divide-y divide-border/60">
                    {filteredChapters.map(chapter => (
                      <li key={chapter.id}>
                        <div
                          className="flex items-center justify-between px-4 py-3 hover:bg-muted/20 cursor-pointer"
                          onClick={() => toggleChapter(chapter.id)}
                        >
                          <div className="flex items-center gap-2">
                            {expandedChapters.has(chapter.id)
                              ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            }
                            <span className="font-medium text-sm">{chapter.name}</span>
                            <span className="text-xs text-muted-foreground">
                              ({lectures.filter(l => l.chapter_id === chapter.id).length} lectures)
                            </span>
                          </div>
                          <button
                            onClick={e => { e.stopPropagation(); deleteChapter(chapter.id) }}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        {expandedChapters.has(chapter.id) && (
                          <ul className="border-t border-border/40 bg-muted/10">
                            {lectures.filter(l => l.chapter_id === chapter.id).length === 0 ? (
                              <li className="px-10 py-2 text-xs text-muted-foreground">No lectures yet</li>
                            ) : (
                              lectures
                                .filter(l => l.chapter_id === chapter.id)
                                .map(lecture => (
                                  <li key={lecture.id} className="flex items-center justify-between px-10 py-2 hover:bg-muted/20">
                                    <span className="text-sm">{lecture.name}</span>
                                    <button onClick={() => deleteLecture(lecture.id)} className="text-red-500 hover:text-red-700">
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </li>
                                ))
                            )}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

