'use client'
// src/components/search/SearchClient.tsx

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import SearchResults from '@/components/search/SearchResults'

interface Suggestion {
  type: string
  label: string
  icon: string
}

interface Filter {
  year_id?: string
  semester_id?: string
  subject_id?: string
  batch_id?: string
  exam_id?: string
}

interface FilterOption {
  id: string
  name: string
}

interface Props {
  initialQuery:   string
  initialResults: any[]
  initialTotal:   number
  // Filter options fetched server-side
  academicYears: FilterOption[]
  semesters:     (FilterOption & { academic_year_id: string })[]
  subjects:      (FilterOption & { semester_id?: string; academic_year_id?: string })[]
  batches:       (FilterOption & { subject_id: string })[]
  exams:         (FilterOption & { batch_id: string })[]
}

export default function SearchClient({
  initialQuery,
  initialResults,
  initialTotal,
  academicYears,
  semesters,
  subjects,
  batches,
  exams,
}: Props) {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const [query,       setQuery]       = useState(initialQuery)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [showSuggest, setShowSuggest] = useState(false)
  const [results,     setResults]     = useState(initialResults)
  const [total,       setTotal]       = useState(initialTotal)
  const [loading,     setLoading]     = useState(false)
  const [searched,    setSearched]    = useState(!!initialQuery)
  const [filters,     setFilters]     = useState<Filter>({})

  const inputRef      = useRef<HTMLInputElement>(null)
  const suggestRef    = useRef<HTMLDivElement>(null)
  const debounceRef   = useRef<NodeJS.Timeout | null>(null)
  const searchDebRef  = useRef<NodeJS.Timeout | null>(null)

  // ── Close suggestions on outside click ───────────────────────────────────
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        suggestRef.current && !suggestRef.current.contains(e.target as Node) &&
        inputRef.current  && !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggest(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // ── Fetch suggestions with 300ms debounce ─────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    // Get the last term after the last + for suggestions
    const terms = query.split('+')
    const lastTerm = terms[terms.length - 1].trim()

    if (lastTerm.length < 2) {
      setSuggestions([])
      setShowSuggest(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      const res  = await fetch(`/api/search/suggestions?q=${encodeURIComponent(lastTerm)}`)
      const data = await res.json()
      setSuggestions(data.suggestions ?? [])
      setShowSuggest(data.suggestions?.length > 0)
    }, 300)
  }, [query])

  // ── Run full search ───────────────────────────────────────────────────────
  const filtersRef = useRef(filters)
  useEffect(() => { filtersRef.current = filters }, [filters])

  const runSearch = useCallback(async (q: string, f?: Filter) => {
    const activeFilters = f ?? filtersRef.current
    if (q.trim().length < 2) return
    setLoading(true)
    setSearched(true)
    setShowSuggest(false)

    const params = new URLSearchParams({ q })
    if (activeFilters.year_id)     params.set('year_id',     activeFilters.year_id)
    if (activeFilters.semester_id) params.set('semester_id', activeFilters.semester_id)
    if (activeFilters.subject_id)  params.set('subject_id',  activeFilters.subject_id)
    if (activeFilters.batch_id)    params.set('batch_id',    activeFilters.batch_id)
    if (activeFilters.exam_id)     params.set('exam_id',     activeFilters.exam_id)

    const res  = await fetch(`/api/search/results?${params}`)
    const data = await res.json()
    setResults(data.results ?? [])
    setTotal(data.total ?? 0)
    setLoading(false)
  }, [])

  // ── Re-run search when filters change ────────────────────────────────────
  useEffect(() => {
    if (searched && query.trim().length >= 2) {
      runSearch(query, filters)
    }
  }, [filters])

  // ── Pick a suggestion ─────────────────────────────────────────────────────
  function pickSuggestion(suggestion: Suggestion) {
    const terms = query.split('+').map(t => t.trim()).filter(Boolean)

    // For questions, use only the first 3 words to avoid matching issues with truncated text
    const searchLabel = suggestion.type === 'question'
      ? suggestion.label.replace(/[…\.]+$/, '').trim().split(/\s+/).slice(0, 5).join(' ')
      : suggestion.label

    terms[terms.length - 1] = searchLabel
    const newQuery = terms.join(' + ')
    setQuery(newQuery)
    setShowSuggest(false)
    runSearch(newQuery)
    inputRef.current?.focus()
  }

  // ── Handle Enter key ──────────────────────────────────────────────────────
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      runSearch(query)
    }
    if (e.key === 'Escape') {
      setShowSuggest(false)
    }
  }

  // ── Filter helpers ────────────────────────────────────────────────────────
  function setFilter(key: keyof Filter, value: string) {
    const newFilters = { ...filters, [key]: value || undefined }
    // Cascade: changing year clears semester/subject/batch/exam
    if (key === 'year_id')     { delete newFilters.semester_id; delete newFilters.subject_id; delete newFilters.batch_id; delete newFilters.exam_id }
    if (key === 'semester_id') { delete newFilters.subject_id; delete newFilters.batch_id; delete newFilters.exam_id }
    if (key === 'subject_id')  { delete newFilters.batch_id; delete newFilters.exam_id }
    if (key === 'batch_id')    { delete newFilters.exam_id }
    setFilters(newFilters)
  }

  // Filtered options based on current selections
  const visibleSemesters = filters.year_id
    ? semesters.filter(s => s.academic_year_id === filters.year_id)
    : semesters
  const visibleSubjects = filters.semester_id
    ? subjects.filter(s => s.semester_id === filters.semester_id)
    : filters.year_id
    ? subjects.filter(s => s.academic_year_id === filters.year_id)
    : subjects
  const visibleBatches = filters.subject_id
    ? batches.filter(b => b.subject_id === filters.subject_id)
    : batches
  const visibleExams = filters.batch_id
    ? exams.filter(e => e.batch_id === filters.batch_id)
    : exams

  const selectStyle = (hasValue: boolean): React.CSSProperties => ({
    padding: '8px 12px',
    borderRadius: 10,
    border: `1px solid ${hasValue ? 'var(--clr-primary)' : 'var(--bd)'}`,
    background: hasValue ? 'var(--clr-soft)' : 'var(--bg-soft)',
    color: hasValue ? 'var(--clr-primary)' : 'var(--fg)',
    fontSize: 13,
    fontWeight: hasValue ? 700 : 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
    outline: 'none',
    minWidth: 120,
  })

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)', color: 'var(--fg)',
      fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
    }}>
      <main style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px 80px' }}>

        {/* ── Title ── */}
        <h1 style={{ margin: '0 0 20px', fontSize: 22, fontWeight: 800 }}>Search Questions</h1>

        {/* ── Search box ── */}
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 0,
            border: '1.5px solid var(--bd)', borderRadius: 14,
            background: 'var(--bg-elev)', overflow: 'visible',
            boxShadow: '0 1px 3px var(--shadow)',
          }}>
            <span style={{ padding: '0 0 0 16px', color: 'var(--fg-muted)', display: 'flex', alignItems: 'center' }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
            </span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => suggestions.length > 0 && setShowSuggest(true)}
              placeholder='Search anything — use + to combine terms (e.g. "Medicine + Heart + 2024")'
              style={{
                flex: 1, border: 'none', outline: 'none',
                background: 'transparent', padding: '14px 12px',
                fontSize: 14.5, color: 'var(--fg)', fontFamily: 'inherit',
              }}
            />
            {query && (
              <button
                onClick={() => { setQuery(''); setResults([]); setSearched(false); setSuggestions([]) }}
                style={{
                  padding: '0 12px', background: 'transparent', border: 'none',
                  color: 'var(--fg-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            )}
            <button
              onClick={() => runSearch(query)}
              style={{
                margin: 5, padding: '10px 18px', borderRadius: 10,
                border: 'none', background: 'var(--clr-primary)', color: 'white',
                fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                flexShrink: 0,
              }}
            >
              Search
            </button>
          </div>

          {/* ── Suggestions dropdown ── */}
          {showSuggest && (
            <div
              ref={suggestRef}
              style={{
                position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
                background: 'var(--bg-elev)', border: '1px solid var(--bd)',
                borderRadius: 13, boxShadow: '0 8px 30px var(--shadow)',
                zIndex: 50, overflow: 'hidden',
              }}
            >
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onMouseDown={e => { e.preventDefault(); pickSuggestion(s) }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '11px 16px', border: 'none', background: 'transparent',
                    cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                    borderBottom: i < suggestions.length - 1 ? '1px solid var(--bd)' : 'none',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-soft)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ fontSize: 15, flexShrink: 0 }}>{s.icon}</span>
                  <span style={{ fontSize: 13.5, color: 'var(--fg)', fontWeight: 500 }}>{s.label}</span>
                  <span style={{
                    marginLeft: 'auto', fontSize: 11, fontWeight: 700, padding: '2px 8px',
                    borderRadius: 999, background: 'var(--bg-soft)', color: 'var(--fg-muted)',
                    flexShrink: 0,
                  }}>
                    {s.type}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── + hint ── */}
        <p style={{ margin: '0 0 20px', fontSize: 12.5, color: 'var(--fg-muted)' }}>
          💡 Tip: combine terms with <strong>+</strong> to narrow results — e.g. <em>Medicine + Hypertension + 2024</em>
        </p>

        {/* ── Filters ── */}
        {searched && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            <select
              value={filters.year_id ?? ''}
              onChange={e => setFilter('year_id', e.target.value)}
              style={selectStyle(!!filters.year_id)}
            >
              <option value="">All Years</option>
              {academicYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>

            {visibleSemesters.length > 0 && (
              <select
                value={filters.semester_id ?? ''}
                onChange={e => setFilter('semester_id', e.target.value)}
                style={selectStyle(!!filters.semester_id)}
              >
                <option value="">All Semesters</option>
                {visibleSemesters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}

            <select
              value={filters.subject_id ?? ''}
              onChange={e => setFilter('subject_id', e.target.value)}
              style={selectStyle(!!filters.subject_id)}
            >
              <option value="">All Subjects</option>
              {visibleSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>

            <select
              value={filters.batch_id ?? ''}
              onChange={e => setFilter('batch_id', e.target.value)}
              style={selectStyle(!!filters.batch_id)}
            >
              <option value="">All Batches</option>
              {visibleBatches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>

            <select
              value={filters.exam_id ?? ''}
              onChange={e => setFilter('exam_id', e.target.value)}
              style={selectStyle(!!filters.exam_id)}
            >
              <option value="">All Exams</option>
              {visibleExams.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>

            {Object.keys(filters).length > 0 && (
              <button
                onClick={() => setFilters({})}
                style={{
                  padding: '8px 14px', borderRadius: 10,
                  border: '1px solid var(--bd)', background: 'var(--bg-soft)',
                  color: 'var(--fg-muted)', fontSize: 12.5, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '40px 0', justifyContent: 'center', color: 'var(--fg-muted)', fontSize: 14 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ animation: 'spin 1s linear infinite' }}>
              <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0" />
            </svg>
            Searching...
          </div>
        )}

        {/* ── Empty state before search ── */}
        {!searched && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>🔍</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Search across all questions</div>
            <div style={{ fontSize: 13.5, color: 'var(--fg-muted)', maxWidth: 420, lineHeight: 1.6 }}>
              Type a subject name, chapter, lecture, doctor name, or any keyword from a question.
            </div>
          </div>
        )}

        {/* ── No results ── */}
        {searched && !loading && total === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>😕</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>No questions found</div>
            <div style={{ fontSize: 13.5, color: 'var(--fg-muted)' }}>
              Try different keywords or remove some filters.
            </div>
          </div>
        )}

        {/* ── Results ── */}
        {!loading && total > 0 && (
          <SearchResults results={results} total={total} query={query} />
        )}

      </main>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}