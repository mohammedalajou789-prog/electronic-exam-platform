// src/app/dashboard/wrong-questions/page.tsx
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import WrongQuestionsClient from '@/components/dashboard/WrongQuestionsClient'

export default async function WrongQuestionsPage({
  searchParams,
}: {
  searchParams: { subject?: string }
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch all wrong answers with full question data
  const { data: wrongRaw } = await supabase
    .from('wrong_answers')
    .select(`
      id, question_id, exam_id, created_at,
      question:questions(
        id, question_text, chapter, lecture,
        choice_a, choice_b, choice_c, choice_d, choice_e,
        correct_answer, explanation,
        incorrect_explanation_a, incorrect_explanation_b,
        incorrect_explanation_c, incorrect_explanation_d,
        incorrect_explanation_e,
        exam:exams(
          id, title,
          batch:batches(name, subject:subjects(name))
        )
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const wrong = wrongRaw ?? []

  // Extract unique subjects
  const subjects = [...new Set(
    wrong
      .map((w: any) => w.question?.exam?.batch?.subject?.name)
      .filter(Boolean)
  )] as string[]

  const activeSubject = searchParams.subject ?? null

  // Filter by subject if provided
  const filtered = activeSubject
    ? wrong.filter((w: any) => w.question?.exam?.batch?.subject?.name === activeSubject)
    : wrong

  // Chapter stats for the tip
  const chapterMap: Record<string, { count: number; lectures: Set<string> }> = {}
  for (const w of wrong) {
    const ch  = (w.question as any)?.chapter
    const lec = (w.question as any)?.lecture
    if (!ch) continue
    if (!chapterMap[ch]) chapterMap[ch] = { count: 0, lectures: new Set() }
    chapterMap[ch].count++
    if (lec) chapterMap[ch].lectures.add(lec)
  }
  const chapterStats = Object.entries(chapterMap)
    .map(([chapter, v]) => ({
      chapter,
      count: v.count,
      lectures: [...v.lectures],
    }))
    .sort((a, b) => b.count - a.count)

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)', color: 'var(--fg)',
      fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
    }}>
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px 80px' }}>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--fg-muted)', marginBottom: 20 }}>
          <Link href="/dashboard" style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>Dashboard</Link>
          <span>›</span>
          <span style={{ color: 'var(--fg)', fontWeight: 700 }}>Wrong Questions</span>
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 800 }}>Wrong Questions</h1>
            <p style={{ margin: 0, fontSize: 13.5, color: 'var(--fg-muted)' }}>
              {wrong.length} total · accumulated across all attempts
            </p>
          </div>
        </div>

        {/* Chapter weakness stats */}
        {chapterStats.length > 0 && (
          <div style={{
            background: 'var(--bg-elev)', border: '1px solid var(--bd)',
            borderRadius: 16, padding: '18px 20px', marginBottom: 20,
          }}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>Weak Areas</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {chapterStats.slice(0, 5).map(cs => (
                <div key={cs.chapter} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--fg)' }}>{cs.chapter}</span>
                    {cs.lectures.length > 0 && (
                      <span style={{ fontSize: 12, color: 'var(--fg-muted)', marginLeft: 8 }}>
                        {cs.lectures.slice(0, 3).join(' · ')}
                        {cs.lectures.length > 3 ? ` +${cs.lectures.length - 3} more` : ''}
                      </span>
                    )}
                  </div>
                  <span style={{
                    fontSize: 12, fontWeight: 700, padding: '2px 9px',
                    borderRadius: 999, flexShrink: 0,
                    background: 'color-mix(in srgb, #ef4444 14%, var(--bg-soft))',
                    color: '#ef4444',
                  }}>
                    {cs.count} wrong
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Subject filter tabs */}
        {subjects.length > 1 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            <Link
              href="/dashboard/wrong-questions"
              style={{
                padding: '7px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                textDecoration: 'none',
                background: !activeSubject ? 'var(--clr-primary)' : 'var(--bg-soft)',
                color: !activeSubject ? 'white' : 'var(--fg)',
                border: `1px solid ${!activeSubject ? 'var(--clr-primary)' : 'var(--bd)'}`,
              }}
            >
              All ({wrong.length})
            </Link>
            {subjects.map(subj => {
              const count = wrong.filter((w: any) => w.question?.exam?.batch?.subject?.name === subj).length
              const isActive = activeSubject === subj
              return (
                <Link
                  key={subj}
                  href={`/dashboard/wrong-questions?subject=${encodeURIComponent(subj)}`}
                  style={{
                    padding: '7px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                    textDecoration: 'none',
                    background: isActive ? 'var(--clr-primary)' : 'var(--bg-soft)',
                    color: isActive ? 'white' : 'var(--fg)',
                    border: `1px solid ${isActive ? 'var(--clr-primary)' : 'var(--bd)'}`,
                  }}
                >
                  {subj} ({count})
                </Link>
              )
            })}
          </div>
        )}

        {/* Questions list — client component handles delete */}
        {filtered.length === 0 ? (
          <div style={{
            padding: '64px 24px', textAlign: 'center',
            border: '1px dashed var(--bd)', borderRadius: 16,
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>No wrong questions here</div>
            <div style={{ fontSize: 13.5, color: 'var(--fg-muted)' }}>
              {activeSubject ? 'Try selecting a different subject.' : 'Keep practicing — wrong questions will appear here.'}
            </div>
          </div>
        ) : (
          <WrongQuestionsClient
            questions={filtered as any}
            userId={user.id}
          />
        )}

      </main>
    </div>
  )
}