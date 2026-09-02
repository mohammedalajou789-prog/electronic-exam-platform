// src/app/dashboard/bookmarks/page.tsx
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import BookmarksClient from '@/components/dashboard/BookmarksClient'

export default async function BookmarksPage({
  searchParams,
}: {
  searchParams: { subject?: string }
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: bookmarksRaw } = await supabase
    .from('bookmarks')
    .select(`
      id, question_id, created_at,
      question:questions(
        id, question_text, chapter_id, lecture_id, chapter:chapters(id, name), lecture:lectures(id, name),
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

  const bookmarks = bookmarksRaw ?? []

  const subjects = [...new Set(
    bookmarks
      .map((b: any) => b.question?.exam?.batch?.subject?.name)
      .filter(Boolean)
  )] as string[]

  const activeSubject = searchParams.subject ?? null

  const filtered = activeSubject
    ? bookmarks.filter((b: any) => b.question?.exam?.batch?.subject?.name === activeSubject)
    : bookmarks

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
          <span style={{ color: 'var(--fg)', fontWeight: 700 }}>Bookmarks</span>
        </div>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 800 }}>Bookmarked Questions</h1>
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--fg-muted)' }}>
            {bookmarks.length} saved across all subjects
          </p>
        </div>

        {/* Subject filter tabs */}
        {subjects.length > 1 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            <Link
              href="/dashboard/bookmarks"
              style={{
                padding: '7px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                textDecoration: 'none',
                background: !activeSubject ? 'var(--clr-primary)' : 'var(--bg-soft)',
                color: !activeSubject ? 'white' : 'var(--fg)',
                border: `1px solid ${!activeSubject ? 'var(--clr-primary)' : 'var(--bd)'}`,
              }}
            >
              All ({bookmarks.length})
            </Link>
            {subjects.map(subj => {
              const count = bookmarks.filter((b: any) => b.question?.exam?.batch?.subject?.name === subj).length
              const isActive = activeSubject === subj
              return (
                <Link
                  key={subj}
                  href={`/dashboard/bookmarks?subject=${encodeURIComponent(subj)}`}
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

        {/* Questions */}
        {filtered.length === 0 ? (
          <div style={{
            padding: '64px 24px', textAlign: 'center',
            border: '1px dashed var(--bd)', borderRadius: 16,
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>No bookmarks here</div>
            <div style={{ fontSize: 13.5, color: 'var(--fg-muted)' }}>
              {activeSubject
                ? 'Try selecting a different subject.'
                : 'Bookmark questions during an exam to see them here.'}
            </div>
          </div>
        ) : (
          <BookmarksClient questions={filtered as any} userId={user.id} />
        )}

      </main>
    </div>
  )
}