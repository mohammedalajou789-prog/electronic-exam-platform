const fs = require('fs')

const filePath = 'src/app/admin/import/page.tsx'
let content = fs.readFileSync(filePath, 'utf8')

// استبدل q.chapter و q.lecture في expanded preview
const old1 = `{q.chapter    && <span>Chapter: <strong style={{ color:'var(--bi-fg)' }}>{q.chapter}</strong></span>}`
const new1 = `{q.chapterName && <span>Chapter: <strong style={{ color:'var(--bi-fg)' }}>{q.chapterName}</strong></span>}`

const old2 = `{q.lecture    && <span>Lecture: <strong style={{ color:'var(--bi-fg)' }}>{q.lecture}</strong></span>}`
const new2 = `{q.lectureName && <span>Lecture: <strong style={{ color:'var(--bi-fg)' }}>{q.lectureName}</strong></span>}`

if (content.includes(old1)) {
  content = content.replace(old1, new1)
  console.log('✅ Fixed q.chapter in preview')
} else {
  // regex fallback
  content = content.replace(/\{q\.chapter\s+&& <span>Chapter:[^}]*\{q\.chapter\}[^<]*<\/span>\}/, new1)
  console.log('✅ Fixed q.chapter via regex')
}

if (content.includes(old2)) {
  content = content.replace(old2, new2)
  console.log('✅ Fixed q.lecture in preview')
} else {
  content = content.replace(/\{q\.lecture\s+&& <span>Lecture:[^}]*\{q\.lecture\}[^<]*<\/span>\}/, new2)
  console.log('✅ Fixed q.lecture via regex')
}

fs.writeFileSync(filePath, content, 'utf8')
console.log('Done!')