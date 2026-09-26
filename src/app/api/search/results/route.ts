// src/app/api/search/results/route.ts
//
// Search results for the search page. The search runs inside the database
// (see src/features/search/search-questions.ts), over ALL questions.

import { NextRequest, NextResponse } from 'next/server'
import { parseSearchTerms, searchQuestions, type SearchResponse } from '@/features/search/search-questions'

const EMPTY_RESPONSE: SearchResponse = { results: [], total: 0 }

export async function GET(req: NextRequest): Promise<NextResponse<SearchResponse>> {
  const { searchParams } = new URL(req.url)
  const terms = parseSearchTerms(searchParams.get('q') ?? '')

  if (terms.length === 0) {
    return NextResponse.json(EMPTY_RESPONSE)
  }

  try {
    const response = await searchQuestions(terms, {
      yearId: searchParams.get('year_id'),
      semesterId: searchParams.get('semester_id'),
      subjectId: searchParams.get('subject_id'),
      batchId: searchParams.get('batch_id'),
      examId: searchParams.get('exam_id'),
    })
    return NextResponse.json(response)
  } catch (error) {
    // Logged on the server only; the student simply sees "no results"
    console.error('Search error:', error)
    return NextResponse.json(EMPTY_RESPONSE)
  }
}