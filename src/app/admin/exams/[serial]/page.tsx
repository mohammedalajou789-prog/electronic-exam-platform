'use client'
import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Question {
  id: string
  exam_id: string
  question_text: string
  question_order: number
  choice_a: string
  choice_b: string
  choice_c: string
  choice_d: string
  choice_e: string | null
  correct_answer: string
  explanation: string | null
  incorrect_explanation_a: string | null
  incorrect_explanation_b: string | null
  incorrect_explanation_c: string | null
  incorrect_explanation_d: string | null
  incorrect_explanation_e: string | null
  chapter_id: string | null
  lecture_id: string | null
  doctor_id: string | null
}

interface Exam {
  id: string
  title: string
  exam_type: string
  calendar_year: number | null
  status: string
  question_count: number
  batch: { name: string; subject: { id: string; name: string } | null } | null
  exam_doctors: Array<{ doctor_id: string; doctor: { name: string } | null }> | null
}

interface ExamDoctor { doctor_id: string; doctor: { name: string } | null }
interface Chapter { id: string; name: string }
interface Lecture { id: string; name: string; chapter_id: string }

const LETTERS = ['a', 'b', 'c', 'd', 'e'] as const
const LABEL: Record<string, string> = { a: 'A', b: 'B', c: 'C', d: 'D', e: 'E' }

// ─── CSS injected once at page level ──────────────────────────────────────────
const PAGE_CSS = `
  .ep-wrap {
    --bg:           oklch(98% 0.006 55);
    --bg-elev:      oklch(100% 0 0);
    --bg-soft:      oklch(96% 0.009 55);
    --fg:           oklch(22% 0.02 50);
    --fg-muted:     oklch(46% 0.02 50);
    --bd:           oklch(89% 0.012 50);
    --clr-primary:  oklch(50% 0.19 25);
    --clr-soft:     oklch(94% 0.035 25);
    --shadow:       rgba(20,10,10,0.08);
    --accent-orange:#f97316;
    --accent-green: #22c55e;
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
    color: var(--fg);
  }
  .dark .ep-wrap {
    --bg:           oklch(18% 0.01 50);
    --bg-elev:      oklch(22% 0.012 50);
    --bg-soft:      oklch(20% 0.01 50);
    --fg:           oklch(92% 0.008 50);
    --fg-muted:     oklch(62% 0.015 50);
    --bd:           oklch(32% 0.015 50);
    --clr-primary:  oklch(68% 0.18 25);
    --clr-soft:     oklch(28% 0.06 25);
    --shadow:       rgba(0,0,0,0.35);
    --accent-orange:#fb923c;
    --accent-green: #4ade80;
  }

  /* animations */
  @keyframes ep-fadeSlide {
    from { opacity:0; transform:translateY(14px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes ep-fadeUp {
    from { opacity:0; transform:translateY(10px); }
    to   { opacity:1; transform:translateY(0); }
  }
  .ep-fade  { animation: ep-fadeSlide 0.4s ease-out; }
  .ep-row   { opacity:0; animation: ep-fadeUp 0.4s ease-out forwards; }

  /* card */
  .ep-card {
    background: var(--bg-elev);
    border: 1px solid var(--bd);
    border-radius: 18px;
  }

  /* input / textarea / select */
  .ep-input {
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
    box-sizing: border-box;
  }
  .ep-input:focus {
    border-color: var(--clr-primary);
    box-shadow: 0 0 0 3px var(--clr-soft);
  }
  textarea.ep-input { resize: vertical; }

  /* label inside editor */
  .ep-label {
    display: block;
    font-size: 12.5px;
    font-weight: 700;
    color: var(--fg-muted);
    margin: 16px 0 8px;
  }

  /* primary button */
  .ep-btn-primary {
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
  }
  .ep-btn-primary:hover   { opacity: 0.92; transform: translateY(-1px); }
  .ep-btn-primary:active  { transform: translateY(0); }
  .ep-btn-primary:disabled{ opacity: 0.5; cursor: not-allowed; transform: none; }

  /* ghost button */
  .ep-btn-ghost {
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
  }
  .ep-btn-ghost:hover { background: var(--bd); }

  /* delete button */
  .ep-btn-del {
    background: transparent;
    color: #ef4444;
    border: 1px solid var(--bd);
    border-radius: 11px;
    padding: 10px 18px;
    font-size: 13.5px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
  }
  .ep-btn-del:hover { background: rgba(239,68,68,0.07); }

  /* back button */
  .ep-back-btn {
    display: flex;
    align-items: center;
    gap: 7px;
    background: none;
    border: none;
    color: var(--fg-muted);
    font-size: 13.5px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    margin-bottom: 16px;
    padding: 0;
  }
  .ep-back-btn:hover { color: var(--fg); }

  /* question row header */
  .ep-q-header {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 16px 20px;
    cursor: pointer;
    transition: background 0.12s;
  }
  .ep-q-header:hover { background: var(--bg-soft); border-radius: 18px 18px 0 0; }

  /* choice button circle */
  .ep-choice-btn {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    flex-shrink: 0;
    border: none;
    cursor: pointer;
    font-size: 12px;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: inherit;
    transition: background 0.15s, color 0.15s;
  }
  .ep-choice-btn.correct { background: var(--accent-green); color: #fff; }
  .ep-choice-btn.wrong   { background: var(--bg-soft); color: var(--fg-muted); }

  /* skeleton */
  .ep-skeleton {
    background: var(--bg-soft);
    border-radius: 10px;
    animation: ep-fadeUp 0.5s ease-out;
  }
`

// ─── QuestionCard ──────────────────────────────────────────────────────────────
function QuestionCard({
  question,
  onSave,
  onDelete,
  delay,
  chapters,
  lectures,
  examDoctors,
}: {
  question: Question
  onSave: (id: string, data: Partial<Question>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  delay: number
  chapters: Chapter[]
  lectures: Lecture[]
  examDoctors: ExamDoctor[]
}) {
  const [expanded, setExpanded] = useState(false)
  const [form, setForm] = useState({
    question_text:           question.question_text,
    choice_a:                question.choice_a,
    choice_b:                question.choice_b,
    choice_c:                question.choice_c,
    choice_d:                question.choice_d,
    choice_e:                question.choice_e ?? '',
    correct_answer:          question.correct_answer,
    explanation:             question.explanation ?? '',
    incorrect_explanation_a: question.incorrect_explanation_a ?? '',
    incorrect_explanation_b: question.incorrect_explanation_b ?? '',
    incorrect_explanation_c: question.incorrect_explanation_c ?? '',
    incorrect_explanation_d: question.incorrect_explanation_d ?? '',
    incorrect_explanation_e: question.incorrect_explanation_e ?? '',
    chapter_id:              question.chapter_id ?? '',
    lecture_id:              question.lecture_id ?? '',
    doctor_id:               question.doctor_id ?? '',
  })
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  function set(name: string, value: string) {
    setForm(p => ({ ...p, [name]: value }))
  }

  async function handleSave() {
    setSaving(true); setSaved(false)
    await onSave(question.id, {
      question_text:           form.question_text,
      choice_a:                form.choice_a,
      choice_b:                form.choice_b,
      choice_c:                form.choice_c,
      choice_d:                form.choice_d,
      choice_e:                form.choice_e || null,
      correct_answer:          form.correct_answer,
      explanation:             form.explanation || null,
      incorrect_explanation_a: form.incorrect_explanation_a || null,
      incorrect_explanation_b: form.incorrect_explanation_b || null,
      incorrect_explanation_c: form.incorrect_explanation_c || null,
      incorrect_explanation_d: form.incorrect_explanation_d || null,
      incorrect_explanation_e: form.incorrect_explanation_e || null,
      chapter_id:              form.chapter_id || null,
      lecture_id:              form.lecture_id || null,
      doctor_id:               form.doctor_id || null,
    })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function handleDelete() {
    setDeleting(true)
    await onDelete(question.id)
  }

  return (
    <div
      className="ep-card ep-row"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* ── Collapsed header ────────────────────────────────── */}
      <div className="ep-q-header" onClick={() => setExpanded(p => !p)}>

        {/* Number — plain text, no circle */}
        <span style={{
          fontSize: 13, fontWeight: 800,
          color: 'var(--fg-muted)',
          flexShrink: 0, width: 20,
        }}>
          {question.question_order}
        </span>

        {/* Question text + chapter · lecture */}
        <div style={{ flex: '1 1 0%', minWidth: 0 }}>
          <div style={{ fontSize: 14, lineHeight: 1.5, fontWeight: 600 }}>
            {form.question_text}
          </div>
          <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 5 }}>
            {chapters.find(c => c.id === form.chapter_id)?.name && <span>{chapters.find(c => c.id === form.chapter_id)?.name}</span>}
            {form.chapter_id && form.lecture_id && <span> · </span>}
            {lectures.find(l => l.id === form.lecture_id)?.name && <span>{lectures.find(l => l.id === form.lecture_id)?.name}</span>}
          </div>
        </div>

        {/* Correct answer badge */}
        <span style={{
          width: 22, height: 22, borderRadius: '50%',
          background: 'var(--clr-soft)', color: 'var(--clr-primary)',
          fontSize: 11, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {LABEL[form.correct_answer] ?? form.correct_answer.toUpperCase()}
        </span>

        {/* Chevron */}
        <svg
          width="15" height="15" viewBox="0 0 24 24"
          fill="none" stroke="var(--fg-muted)" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
          style={{
            flexShrink: 0, marginTop: 2,
            transition: 'transform 0.2s',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {/* ── Expanded editor ──────────────────────────────────── */}
      {expanded && (
        <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--bd)' }}>

          {/* Question Text */}
          <p className="ep-label">Question Text</p>
          <textarea
            className="ep-input"
            style={{ minHeight: 60 }}
            value={form.question_text}
            onChange={e => set('question_text', e.target.value)}
          />

          {/* Chapter / Lecture */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <p className="ep-label">Chapter</p>
              <select
                className="ep-input"
                value={form.chapter_id}
                onChange={e => {
                  set('chapter_id', e.target.value)
                  set('lecture_id', '')
                }}
              >
                <option value="">No chapter</option>
                {chapters.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <p className="ep-label">Lecture</p>
              <select
                className="ep-input"
                value={form.lecture_id}
                onChange={e => set('lecture_id', e.target.value)}
                disabled={!form.chapter_id}
              >
                <option value="">No lecture</option>
                {lectures
                  .filter(l => l.chapter_id === form.chapter_id)
                  .map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
              </select>
            </div>
          </div>

          {/* Doctor */}
          <div style={{ marginTop: 12 }}>
            <p className="ep-label">Doctor</p>
            <select
              className="ep-input"
              value={form.doctor_id}
              onChange={e => set('doctor_id', e.target.value)}
            >
              <option value="">No doctor</option>
              {examDoctors.map(ed => {
                const name = Array.isArray(ed.doctor) ? ed.doctor[0]?.name : ed.doctor?.name
                if (!name) return null
                return <option key={ed.doctor_id} value={ed.doctor_id}>{name}</option>
              })}
            </select>
          </div>

          {/* Answer Choices */}
          <p className="ep-label">Answer Choices</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {LETTERS.map(letter => {
              const isCorrect = form.correct_answer === letter
              return (
                <div key={letter} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    className={`ep-choice-btn ${isCorrect ? 'correct' : 'wrong'}`}
                    onClick={() => set('correct_answer', letter)}
                    type="button"
                  >
                    {LABEL[letter]}
                  </button>
                  <input
                    className="ep-input"
                    value={form[`choice_${letter}` as keyof typeof form]}
                    onChange={e => set(`choice_${letter}`, e.target.value)}
                    placeholder={letter === 'e' ? 'Optional 5th choice' : `Choice ${LABEL[letter]}`}
                  />
                </div>
              )
            })}
          </div>

          {/* Correct Answer select */}
          <p className="ep-label">Correct Answer</p>
          <select
            className="ep-input"
            style={{ maxWidth: 120 }}
            value={form.correct_answer}
            onChange={e => set('correct_answer', e.target.value)}
          >
            {LETTERS.map(l => (
              <option key={l} value={l}>{LABEL[l]}</option>
            ))}
          </select>

          {/* Explanation */}
          <p className="ep-label">Explanation</p>
          <textarea
            className="ep-input"
            style={{ minHeight: 70 }}
            value={form.explanation}
            onChange={e => set('explanation', e.target.value)}
            placeholder="Why is this answer correct?"
          />

          {/* Wrong Answer Explanations */}
          <p className="ep-label">Wrong Answer Explanations</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 18 }}>
            {LETTERS.map(letter => (
              <div key={letter} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Small orange letter — no circle */}
                <span style={{
                  width: 16, fontSize: 12, fontWeight: 800,
                  color: 'var(--accent-orange)', flexShrink: 0,
                }}>
                  {LABEL[letter]}
                </span>
                <input
                  className="ep-input"
                  value={form[`incorrect_explanation_${letter}` as keyof typeof form]}
                  onChange={e => set(`incorrect_explanation_${letter}`, e.target.value)}
                  placeholder={`Why is ${LABEL[letter]} wrong?`}
                />
              </div>
            ))}
          </div>

          {/* Save + Delete row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              className="ep-btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>

            {saved && (
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-green)' }}>
                ✓ Saved
              </span>
            )}

            <button
              className="ep-btn-del"
              style={{ marginLeft: 'auto' }}
              onClick={() => setConfirmDel(true)}
            >
              Delete
            </button>
          </div>

          {/* Delete confirmation modal */}
          {confirmDel && (
            <div style={{
              position: 'fixed', inset: 0, zIndex: 500,
              background: 'rgba(0,0,0,0.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 20,
              animation: 'ep-fadeUp 0.15s ease-out',
            }}>
              <div className="ep-card" style={{ width: '100%', maxWidth: 380, padding: 24 }}>
                <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>Delete Question?</div>
                <div style={{ fontSize: 13.5, color: 'var(--fg-muted)', marginBottom: 20 }}>
                  This question will be hidden from students. This action can be reversed.
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    className="ep-btn-ghost"
                    style={{ flex: 1 }}
                    onClick={() => setConfirmDel(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="ep-btn-primary"
                    style={{ flex: 1, background: '#dc2626' }}
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    {deleting ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function ExamEditPage({ params }: { params: Promise<{ serial: string }> }) {
  const supabase  = createClient()
  const router    = useRouter()
  const { serial } = React.use(params)

  const [exam,      setExam]      = useState<Exam | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [chapters,     setChapters]     = useState<Chapter[]>([])
  const [lectures,     setLectures]     = useState<Lecture[]>([])
  const [examDoctors,  setExamDoctors]  = useState<ExamDoctor[]>([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    async function load() {
      const examRes = await supabase
        .from('exams')
        .select(`
          id, title, exam_type, calendar_year, status, question_count,
          batch:batches(name, subject:subjects(id, name)),
          exam_doctors(doctor_id, doctor:doctors(name))
        `)
        .eq('serial_number', serial)
        .single()

      const examData = examRes.data as unknown as Exam
      setExam(examData)
      setExamDoctors((examData as any)?.exam_doctors ?? [])

      if (examData?.id) {
        const qRes = await supabase
          .from('questions')
          .select('*')
          .eq('exam_id', examData.id)
          .is('deleted_at', null)
          .order('question_order')
        setQuestions(qRes.data ?? [])
      }

      const subjectId = (examData?.batch as any)?.subject?.id
      if (subjectId) {
        const chRes = await supabase
          .from('chapters')
          .select('id, name')
          .eq('subject_id', subjectId)
          .order('name')
        if (chRes.error) console.error('Failed to load chapters:', chRes.error.message)
        setChapters(chRes.data ?? [])

        const chapterIds = (chRes.data ?? []).map(c => c.id)
        if (chapterIds.length > 0) {
          const lecRes = await supabase
            .from('lectures')
            .select('id, name, chapter_id')
            .in('chapter_id', chapterIds)
            .order('name')
          if (lecRes.error) console.error('Failed to load lectures:', lecRes.error.message)
          setLectures(lecRes.data ?? [])
        }
      }

      setLoading(false)
    }
    load()
  }, [serial])

  async function handleSave(id: string, data: Partial<Question>) {
    await supabase
      .from('questions')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
  }

  async function handleDelete(id: string) {
    await supabase
      .from('questions')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
    setQuestions(p => p.filter(q => q.id !== id))
    if (exam) {
      await supabase
        .from('exams')
        .update({ question_count: Math.max(0, (exam.question_count ?? 1) - 1) })
        .eq('id', exam.id)
      setExam(prev => prev ? { ...prev, question_count: Math.max(0, prev.question_count - 1) } : prev)
    }
  }

  // ── Derived ──────────────────────────────────────────────────────────────────
  const subjectName  = (exam?.batch as any)?.subject?.name ?? ''
  const batchName    = (exam?.batch as any)?.name ?? ''
  const isPublished  = exam?.status === 'published'

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{PAGE_CSS}</style>

      <div className="ep-wrap" style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 32px 64px', width: '100%' }}>

        {/* ── Loading skeleton ─────────────────────────────────── */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8 }}>
            <div className="ep-skeleton" style={{ height: 20, width: 120, marginBottom: 4 }} />
            <div className="ep-skeleton" style={{ height: 88 }} />
            {[1,2,3,4].map(i => (
              <div key={i} className="ep-skeleton" style={{ height: 58, opacity: 1 - i * 0.18 }} />
            ))}
          </div>
        )}

        {/* ── Content ──────────────────────────────────────────── */}
        {!loading && (
          <div className="ep-fade" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            

            {/* Exam not found */}
            {!exam && (
              <div className="ep-card" style={{ padding: '60px 0', textAlign: 'center' }}>
                <p style={{ fontSize: 13.5, color: 'var(--fg-muted)' }}>Exam not found.</p>
              </div>
            )}

            {/* Exam header card */}
            {exam && (
              <>
                <div
                  className="ep-card"
                  style={{
                    padding: 22,
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap', gap: 14,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>
                      {exam.title}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--fg-muted)' }}>
                      <span style={{ textTransform: 'capitalize' }}>{exam.exam_type}</span>
                      {exam.calendar_year && <> · {exam.calendar_year}</>}
                      {subjectName  && <> · {subjectName}</>}
                      {batchName    && <> · Batch: {batchName}</>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      fontSize: 12, fontWeight: 700,
                      padding: '4px 12px', borderRadius: 20,
                      background: isPublished ? 'var(--clr-soft)'  : 'var(--bg-soft)',
                      color:      isPublished ? 'var(--clr-primary)' : 'var(--fg-muted)',
                      textTransform: 'capitalize',
                    }}>
                      {exam.status}
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--fg-muted)', fontWeight: 600 }}>
                      {questions.length} questions
                    </span>
                  </div>
                </div>

                {/* Questions list */}
                {questions.length === 0 ? (
                  <div className="ep-card" style={{ padding: '60px 0', textAlign: 'center' }}>
                    <p style={{ fontSize: 13.5, color: 'var(--fg-muted)' }}>
                      No questions in this exam.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {questions.map((q, i) => (
                      <QuestionCard
                        key={q.id}
                        question={q}
                        onSave={handleSave}
                        onDelete={handleDelete}
                        delay={i * 40}
                        chapters={chapters}
                        lectures={lectures}
                        examDoctors={examDoctors}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </>
  )
}