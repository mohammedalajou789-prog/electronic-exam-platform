// src/app/api/search/suggestions/route.ts
//
// Returns up to 10 autocomplete suggestions for the search bar.
// Priority order: subjects → chapters → lectures → doctors → batches → question text
// Called with debounce (300ms) on every keystroke.

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() ?? ''

  if (q.length < 2) {
    return NextResponse.json({ suggestions: [] })
  }

  const supabase = await createServerSupabaseClient()
  const pattern  = `%${q}%`
  const MAX      = 10

  // Run all queries in parallel
  const [
    { data: subjects  },
    { data: chapters  },
    { data: lectures  },
    { data: doctors   },
    { data: batches   },
    { data: questions },
  ] = await Promise.all([

    // 1. Subjects — highest priority
    supabase
      .from('subjects')
      .select('name')
      .ilike('name', pattern)
      .limit(3),

    // 2. Chapters — from questions metadata
    supabase
      .from('questions')
      .select('chapter')
      .ilike('chapter', pattern)
      .is('deleted_at', null)
      .limit(20), // fetch more to deduplicate

    // 3. Lectures
    supabase
      .from('questions')
      .select('lecture')
      .ilike('lecture', pattern)
      .is('deleted_at', null)
      .limit(20),

    // 4. Doctors
    supabase
      .from('doctors')
      .select('name')
      .ilike('name', pattern)
      .limit(3),

    // 5. Batches
    supabase
      .from('batches')
      .select('name')
      .ilike('name', pattern)
      .limit(3),

    // 6. Question text — lowest priority
    supabase
      .from('questions')
      .select('question_text')
      .ilike('question_text', pattern)
      .is('deleted_at', null)
      .limit(5),
  ])

  // Deduplicate chapters and lectures
  const uniqueChapters = [...new Set(
    (chapters ?? []).map((r: any) => r.chapter).filter(Boolean)
  )].slice(0, 3) as string[]

  const uniqueLectures = [...new Set(
    (lectures ?? []).map((r: any) => r.lecture).filter(Boolean)
  )].slice(0, 3) as string[]

  // Build suggestions list in priority order
  const suggestions: { type: string; label: string; display?: string; icon: string }[] = []

  for (const s of subjects ?? []) {
    suggestions.push({ type: 'subject', label: s.name, icon: '📚' })
  }
  for (const ch of uniqueChapters) {
    suggestions.push({ type: 'chapter', label: ch, icon: '📖' })
  }
  for (const lec of uniqueLectures) {
    suggestions.push({ type: 'lecture', label: lec, icon: '📝' })
  }
  for (const d of doctors ?? []) {
    suggestions.push({ type: 'doctor', label: d.name, icon: '👨‍⚕️' })
  }
  for (const b of batches ?? []) {
    suggestions.push({ type: 'batch', label: b.name, icon: '🎓' })
  }
  for (const q of questions ?? []) {
    suggestions.push({
      type: 'question',
      label: q.question_text ?? '',
      display: q.question_text?.slice(0, 80) + (q.question_text?.length > 80 ? '…' : ''),
      icon: '❓'
    })
  }

  return NextResponse.json({ suggestions: suggestions.slice(0, MAX) })
}