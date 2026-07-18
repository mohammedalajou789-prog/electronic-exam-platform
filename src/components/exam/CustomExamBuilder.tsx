'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Shuffle, Play, X, ChevronDown, ChevronUp } from 'lucide-react'

interface Batch { id: string; name: string }
interface Doctor { id: string; name: string }
interface Props {
  subjectId: string
  batches: Batch[]
  doctors: Doctor[]
  chapters: string[]
  lectures: string[]
  basePath: string
}

export default function CustomExamBuilder({ subjectId, batches, doctors, chapters, lectures, basePath }: Props) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [selectedBatches, setSelectedBatches] = useState<string[]>([])
  const [selectedDoctors, setSelectedDoctors] = useState<string[]>([])
  const [selectedChapters, setSelectedChapters] = useState<string[]>([])
  const [selectedLectures, setSelectedLectures] = useState<string[]>([])
  const [questionCount, setQuestionCount] = useState(20)
  const [randomize, setRandomize] = useState(true)

  function toggleItem(id: string, selected: string[], setSelected: (v: string[]) => void) {
    setSelected(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])
  }

  async function handleGenerate() {
    setIsGenerating(true)
    setError('')
    try {
      const params = new URLSearchParams()
      params.set('subjectId', subjectId)
      params.set('count', questionCount.toString())
      params.set('randomize', randomize.toString())
      if (selectedBatches.length > 0) params.set('batches', selectedBatches.join(','))
      if (selectedDoctors.length > 0) params.set('doctors', selectedDoctors.join(','))
      if (selectedChapters.length > 0) params.set('chapters', selectedChapters.join(','))
      if (selectedLectures.length > 0) params.set('lectures', selectedLectures.join(','))
      const res = await fetch(`/api/custom-exam?${params.toString()}`)
      const data = await res.json()
      if (!res.ok || !data.examId) {
        setError(data.error || 'Failed to generate exam. Please try again.')
        setIsGenerating(false)
        return
      }
      router.push(`${basePath}/custom/${data.examId}`)
    } catch {
      setError('Something went wrong. Please try again.')
      setIsGenerating(false)
    }
  }

  function reset() {
    setSelectedBatches([])
    setSelectedDoctors([])
    setSelectedChapters([])
    setSelectedLectures([])
    setQuestionCount(20)
    setRandomize(true)
    setError('')
  }

  // pill style helper
  function pill(active: boolean) {
    return {
      padding: '5px 14px',
      borderRadius: 20,
      fontSize: 12.5,
      fontWeight: 600,
      cursor: 'pointer',
      border: `1px solid ${active ? 'var(--clr-primary)' : 'var(--bd)'}`,
      background: active ? 'var(--clr-primary)' : 'var(--bg-soft)',
      color: active ? '#fff' : 'var(--fg)',
      fontFamily: '"Plus Jakarta Sans", sans-serif',
      transition: 'all 0.15s',
    } as React.CSSProperties
  }

  return (
    <div style={{ marginBottom: 24 }}>

      {/* Toggle header */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 14,
          padding: '20px 22px', cursor: 'pointer',
          background: 'none', border: 'none', textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--clr-soft)', color: 'var(--clr-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Shuffle size={18} />
          </div>
          <div>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--fg)' }}>Create Custom Exam</div>
            <div style={{ fontSize: 12.5, color: 'var(--fg-muted)', marginTop: 2 }}>Pick batches, chapters, and lectures to build your own exam</div>
          </div>
        </div>
        {isOpen
          ? <ChevronUp size={18} color="var(--fg-muted)" />
          : <ChevronDown size={18} color="var(--fg-muted)" />
        }
      </button>

      {/* Builder panel */}
      {isOpen && (
        <div style={{ padding: '0 22px 22px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Batches */}
          {batches.length > 0 && (
            <div>
              <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: 'var(--fg)' }}>
                Batch <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--fg-muted)' }}>(leave empty = all batches)</span>
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {batches.map(b => (
                  <button key={b.id} onClick={() => toggleItem(b.id, selectedBatches, setSelectedBatches)} style={pill(selectedBatches.includes(b.id))}>
                    {b.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Doctors */}
          {doctors.length > 0 && (
            <div>
              <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: 'var(--fg)' }}>
                Doctor <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--fg-muted)' }}>(leave empty = all doctors)</span>
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {doctors.map(d => (
                  <button key={d.id} onClick={() => toggleItem(d.id, selectedDoctors, setSelectedDoctors)} style={pill(selectedDoctors.includes(d.id))}>
                    {d.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chapters */}
          {chapters.length > 0 && (
            <div>
              <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: 'var(--fg)' }}>
                Chapter <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--fg-muted)' }}>(leave empty = all chapters)</span>
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {chapters.map(ch => (
                  <button key={ch} onClick={() => toggleItem(ch, selectedChapters, setSelectedChapters)} style={pill(selectedChapters.includes(ch))}>
                    {ch}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Lectures */}
          {lectures.length > 0 && (
            <div>
              <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: 'var(--fg)' }}>
                Lecture <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--fg-muted)' }}>(leave empty = all lectures)</span>
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {lectures.map(lec => (
                  <button key={lec} onClick={() => toggleItem(lec, selectedLectures, setSelectedLectures)} style={pill(selectedLectures.includes(lec))}>
                    {lec}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Question count */}
          <div>
            <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: 'var(--fg)' }}>Number of Questions</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {[10, 20, 30, 50, 100].map(n => (
                <button key={n} onClick={() => setQuestionCount(n)} style={pill(questionCount === n)}>
                  {n}
                </button>
              ))}
              <input
                type="number"
                value={questionCount}
                onChange={e => setQuestionCount(Math.max(1, parseInt(e.target.value) || 1))}
                style={{ width: 64, padding: '5px 10px', borderRadius: 10, border: '1px solid var(--bd)', background: 'var(--bg-soft)', color: 'var(--fg)', fontSize: 13, fontFamily: '"Plus Jakarta Sans", sans-serif', outline: 'none', textAlign: 'center' }}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--fg)' }}>
                <input type="checkbox" checked={randomize} onChange={e => setRandomize(e.target.checked)} style={{ width: 15, height: 15 }} />
                Randomize question order
              </label>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 10, background: '#fff1f1', border: '1px solid #fecaca', color: '#dc2626', fontSize: 13, fontWeight: 600 }}>
              {error}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, paddingTop: 8, borderTop: '1px solid var(--bd)' }}>
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 10, border: 'none', background: 'var(--clr-primary)', color: '#fff', fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 14, fontWeight: 700, cursor: isGenerating ? 'not-allowed' : 'pointer', opacity: isGenerating ? 0.7 : 1 }}
            >
              <Play size={15} />
              {isGenerating ? 'Generating...' : 'Generate Exam'}
            </button>
            <button
              onClick={reset}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, border: '1px solid var(--bd)', background: 'transparent', color: 'var(--fg-muted)', fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            >
              <X size={15} />
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

