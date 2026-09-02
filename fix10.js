const fs = require('fs')

const filePath = 'src/app/admin/import/page.tsx'
let content = fs.readFileSync(filePath, 'utf8')

// المشكلة: doctor_id لا يُحفظ في questions
// الحل: إضافة doctor_id في insert + إبقاء exam_doctors upsert

const oldInsert = `        correct_answer: q.correctAnswer, explanation: q.explanation || null,
        incorrect_explanation_a: q.wrongExplanations?.a || null, incorrect_explanation_b: q.wrongExplanations?.b || null,
        incorrect_explanation_c: q.wrongExplanations?.c || null, incorrect_explanation_d: q.wrongExplanations?.d || null,
        incorrect_explanation_e: q.wrongExplanations?.e || null,
        chapter_id: (() => {`

const newInsert = `        correct_answer: q.correctAnswer, explanation: q.explanation || null,
        incorrect_explanation_a: q.wrongExplanations?.a || null, incorrect_explanation_b: q.wrongExplanations?.b || null,
        incorrect_explanation_c: q.wrongExplanations?.c || null, incorrect_explanation_d: q.wrongExplanations?.d || null,
        incorrect_explanation_e: q.wrongExplanations?.e || null,
        doctor_id: doctorId,
        chapter_id: (() => {`

if (content.includes(oldInsert)) {
  content = content.replace(oldInsert, newInsert)
  console.log('✅ Added doctor_id to questions insert')
} else {
  console.log('❌ NOT FOUND — trying regex...')
  const regex = /incorrect_explanation_e: q\.wrongExplanations\?\.e \|\| null,\s*chapter_id:/
  if (regex.test(content)) {
    content = content.replace(regex, `incorrect_explanation_e: q.wrongExplanations?.e || null,
        doctor_id: doctorId,
        chapter_id:`)
    console.log('✅ Fixed via regex')
  } else {
    console.log('❌ Still not found')
  }
}

fs.writeFileSync(filePath, content, 'utf8')
console.log('Done!')