// ============================================================
// BULK IMPORT PARSER
// Official format:
//
// 1. Question text?
// A. Choice
// B. Choice *   ← asterisk marks correct answer
// C. Choice
// D. Choice
// E. Choice     ← optional
// Chapter: Chapter Name
// Lecture: Lecture Name
// Doctor: Dr. Name   ← optional
// Explanation: ...
// Wrong answers explanation:
// A. ...
// C. ...
// ============================================================

export interface ParsedQuestion {
  questionNumber: number
  questionText: string
  choices: {
    a: string
    b: string
    c: string
    d: string
    e?: string
  }
  correctAnswer: 'a' | 'b' | 'c' | 'd' | 'e'
  chapter?: string
  lecture?: string
  doctorName?: string
  explanation?: string
  wrongExplanations?: {
    a?: string
    b?: string
    c?: string
    d?: string
    e?: string
  }
}

export interface ParseError {
  questionNumber: number
  message: string
}

export interface ParseResult {
  questions: ParsedQuestion[]
  errors: ParseError[]
  warnings: string[]
}

// Flexible field extractor — handles "Field: Value", "Field:Value", "Field  :  Value"
function extractField(line: string, fieldName: string): string | null {
  const pattern = new RegExp(`^${fieldName}\\s*:\\s*(.*)$`, 'i')
  const match = line.match(pattern)
  if (!match) return null
  return match[1].trim()
}

export function parseBulkImport(rawText: string): ParseResult {
  const errors: ParseError[] = []
  const warnings: string[] = []
  const questions: ParsedQuestion[] = []

  if (!rawText.trim()) {
    return { questions, errors: [{ questionNumber: 0, message: 'Input is empty.' }], warnings }
  }

  // Split into question blocks — each starts with a number followed by a dot
  const blocks = rawText.trim().split(/(?=^\d+\.)/m).filter(b => b.trim())

  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length === 0) continue

    const firstLine = lines[0]
    const numberMatch = firstLine.match(/^(\d+)\.\s*(.+)$/)
    if (!numberMatch) continue

    const questionNumber = parseInt(numberMatch[1])
    const questionText = numberMatch[2].trim()

    if (!questionText) {
      errors.push({ questionNumber, message: 'Question text is empty.' })
      continue
    }

    try {
      const parsed = parseQuestionBlock(lines.slice(1), questionNumber, questionText)
      questions.push(parsed)
    } catch (err) {
      errors.push({
        questionNumber,
        message: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  // Warnings
  const noExplanation = questions.filter(q => !q.explanation)
  if (noExplanation.length > 0) {
    warnings.push(`${noExplanation.length} question(s) have no explanation.`)
  }

  const noChapter = questions.filter(q => !q.chapter)
  if (noChapter.length > 0) {
    warnings.push(`${noChapter.length} question(s) have no chapter assigned.`)
  }

  return { questions, errors, warnings }
}

function parseQuestionBlock(
  lines: string[],
  questionNumber: number,
  questionText: string
): ParsedQuestion {
  const choices: Record<string, string> = {}
  let correctAnswer: string | null = null
  let chapter: string | undefined
  let lecture: string | undefined
  let doctorName: string | undefined
  let explanation: string | undefined
  const wrongExplanations: Record<string, string> = {}
  let inWrongAnswers = false
  let inExplanation = false
  let explanationLines: string[] = []

  for (const line of lines) {
    // Answer choices A-E
    const choiceMatch = line.match(/^([A-Ea-e])\.\s*(.*?)(\s*\*\s*)?$/)
    if (choiceMatch && !inWrongAnswers && !inExplanation) {
      const letter = choiceMatch[1].toLowerCase()
      const text = choiceMatch[2].trim()
      const isCorrect = Boolean(choiceMatch[3]?.trim())
      choices[letter] = text
      if (isCorrect) correctAnswer = letter
      continue
    }

    // Chapter — flexible spacing around colon
    const chapterValue = extractField(line, 'Chapter')
    if (chapterValue !== null) {
      chapter = chapterValue || undefined  // empty string = no chapter
      inExplanation = false
      continue
    }

    // Lecture — flexible spacing around colon
    const lectureValue = extractField(line, 'Lecture')
    if (lectureValue !== null) {
      lecture = lectureValue || undefined
      inExplanation = false
      continue
    }

    // Doctor — flexible spacing around colon
    // Empty value is acceptable (treated as no doctor)
    const doctorValue = extractField(line, 'Doctor')
    if (doctorValue !== null) {
      doctorName = doctorValue || undefined  // empty = no doctor, not an error
      inExplanation = false
      continue
    }

    // Explanation
    const explanationValue = extractField(line, 'Explanation')
    if (explanationValue !== null) {
      inExplanation = true
      inWrongAnswers = false
      if (explanationValue) {
        explanationLines = [explanationValue]
      }
      continue
    }

    // Wrong answers explanation header
    if (line.match(/^Wrong\s+answers?\s*(explanation)?\s*:\s*$/i)) {
      inWrongAnswers = true
      inExplanation = false
      if (explanationLines.length > 0) {
        explanation = explanationLines.join(' ')
      }
      continue
    }

    // Wrong answer entries
    if (inWrongAnswers) {
      const wrongMatch = line.match(/^([A-Ea-e])\.\s*(.+)$/)
      if (wrongMatch) {
        wrongExplanations[wrongMatch[1].toLowerCase()] = wrongMatch[2].trim()
        continue
      }
    }

    // Explanation continuation lines
    if (inExplanation && !line.match(/^[A-Ea-e]\./)) {
      explanationLines.push(line)
      continue
    }
  }

  // Merge explanation lines
  if (explanationLines.length > 0 && !explanation) {
    explanation = explanationLines.join(' ')
  }

  // Validate choices
  if (!choices['a'] || !choices['b'] || !choices['c'] || !choices['d']) {
    throw new Error('Question must have at least 4 choices (A, B, C, D).')
  }

  if (!correctAnswer) {
    throw new Error('No correct answer marked. Add * after the correct choice.')
  }

  return {
    questionNumber,
    questionText,
    choices: {
      a: choices['a'],
      b: choices['b'],
      c: choices['c'],
      d: choices['d'],
      e: choices['e'],
    },
    correctAnswer: correctAnswer as 'a' | 'b' | 'c' | 'd' | 'e',
    chapter,
    lecture,
    doctorName,
    explanation,
    wrongExplanations: Object.keys(wrongExplanations).length > 0 ? wrongExplanations : undefined,
  }
}