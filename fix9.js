const fs = require('fs')

const filePath = 'src/app/admin/import/page.tsx'
let content = fs.readFileSync(filePath, 'utf8')

// استبدل q.chapter بـ q.chapterName في عرض الـ preview
const old1 = `{q.chapter && <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20, background:'var(--bi-psoft)', color:'var(--bi-primary)' }}>{q.chapter}</span>}`
const new1 = `{q.chapterName && <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20, background:'var(--bi-psoft)', color:'var(--bi-primary)' }}>{q.chapterName}</span>}`

if (content.includes(old1)) {
  content = content.replace(old1, new1)
  console.log('✅ Fixed q.chapter display')
} else {
  console.log('❌ NOT FOUND — trying regex...')
  const regex = /\{q\.chapter && <span[^>]*>\{q\.chapter\}<\/span>\}/
  if (regex.test(content)) {
    content = content.replace(regex, `{q.chapterName && <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20, background:'var(--bi-psoft)', color:'var(--bi-primary)' }}>{q.chapterName}</span>}`)
    console.log('✅ Fixed via regex')
  } else {
    console.log('❌ Still not found')
  }
}

// تحقق من أي استخدامات أخرى لـ q.chapter أو q.lecture
const remaining = [...content.matchAll(/q\.(chapter|lecture)[^N]/g)]
if (remaining.length > 0) {
  console.log('\n⚠️  Remaining q.chapter/q.lecture usages:')
  remaining.forEach(m => console.log('  -', m[0], 'at index', m.index))
} else {
  console.log('\n✅ No remaining q.chapter/q.lecture usages')
}

fs.writeFileSync(filePath, content, 'utf8')
console.log('\nDone!')