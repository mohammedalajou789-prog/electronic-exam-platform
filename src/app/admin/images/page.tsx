'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Upload, Image, Trash2, Link } from 'lucide-react'

interface QuestionImage {
  id: string
  question_id: string
  image_url: string
  caption: string | null
  display_order: number
}

interface Question {
  id: string
  question_text: string
  exam: { title: string }[] | null
}

export default function ImagesPage() {
  const supabase = createClient()
  const [images, setImages] = useState<QuestionImage[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [selectedQuestion, setSelectedQuestion] = useState('')
  const [caption, setCaption] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [searchQ, setSearchQ] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [{ data: imgs }, { data: qs }] = await Promise.all([
      supabase
        .from('question_images')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('questions')
        .select('id, question_text, exam:exams(title)')
        .is('deleted_at', null)
        .order('question_order'),
    ])
    setImages(imgs || [])
    setQuestions(qs || [])
  }

  function showMessage(msg: string) {
    setMessage(msg)
    setTimeout(() => setMessage(''), 3000)
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !selectedQuestion) {
      showMessage('Please select a question first.')
      return
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      showMessage('Only JPEG, PNG, GIF, and WebP images are allowed.')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      showMessage('File size must be less than 10MB.')
      return
    }

    setIsUploading(true)

    const fileExt = file.name.split('.').pop()
    const fileName = `${selectedQuestion}/${Date.now()}.${fileExt}`

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('question-images')
      .upload(fileName, file)

    if (uploadError) {
      showMessage('Upload failed. Please try again.')
      setIsUploading(false)
      return
    }

    const { data: urlData } = supabase.storage
      .from('question-images')
      .getPublicUrl(fileName)

    const currentImages = images.filter(img => img.question_id === selectedQuestion)

    await supabase.from('question_images').insert({
      question_id: selectedQuestion,
      image_url: urlData.publicUrl,
      caption: caption.trim() || null,
      display_order: currentImages.length + 1,
    })

    setCaption('')
    await loadData()
    showMessage('Image uploaded and linked successfully!')
    setIsUploading(false)
  }

  async function deleteImage(image: QuestionImage) {
    if (!confirm('Delete this image?')) return

    const urlParts = image.image_url.split('/question-images/')
    if (urlParts[1]) {
      await supabase.storage.from('question-images').remove([urlParts[1]])
    }

    await supabase.from('question_images').delete().eq('id', image.id)
    await loadData()
    showMessage('Image deleted.')
  }

  function getQuestionLabel(q: Question) {
    const truncated = q.question_text.length > 60
      ? q.question_text.substring(0, 60) + '...'
      : q.question_text
    return `${(q.exam as any)?.title || 'Unknown'} — ${truncated}`
  }

  const filteredQuestions = searchQ
    ? questions.filter(q =>
        q.question_text.toLowerCase().includes(searchQ.toLowerCase()) ||
        (q.exam as any)?.title?.toLowerCase().includes(searchQ.toLowerCase())
      )
    : questions

  const imagesForSelected = selectedQuestion
    ? images.filter(img => img.question_id === selectedQuestion)
    : []

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Images</h1>
        <p className="text-muted-foreground">Upload and manage question images</p>
      </div>

      {message && (
        <div className={`rounded-lg px-4 py-3 text-sm ${message.includes('fail') || message.includes('Only') || message.includes('less') || message.includes('select') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
          {message}
        </div>
      )}

      {/* Upload Section */}
      <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm space-y-4">
        <h2 className="font-semibold">Upload New Image</h2>

        {/* Search Question */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Search and Select Question
          </label>
          <input
            type="text"
            placeholder="Search by question text or exam title..."
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black mb-2"
          />
          <select
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black"
            value={selectedQuestion}
            onChange={e => setSelectedQuestion(e.target.value)}
          >
            <option value="">Select a question</option>
            {filteredQuestions.map(q => (
              <option key={q.id} value={q.id}>{getQuestionLabel(q)}</option>
            ))}
          </select>
        </div>

        {/* Caption */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Caption (Optional)
          </label>
          <input
            type="text"
            placeholder="e.g. ECG showing ST elevation"
            value={caption}
            onChange={e => setCaption(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
        </div>

        {/* Upload Button */}
        <div>
          <label className={`flex items-center gap-2 w-fit cursor-pointer rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${isUploading || !selectedQuestion ? 'bg-gray-400 cursor-not-allowed' : 'bg-black hover:bg-gray-800'}`}>
            <Upload className="h-4 w-4" />
            {isUploading ? 'Uploading...' : 'Choose Image & Upload'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
              disabled={isUploading || !selectedQuestion}
            />
          </label>
          <p className="mt-1 text-xs text-muted-foreground">
            Supported: JPEG, PNG, GIF, WebP · Max size: 10MB
          </p>
        </div>
      </div>

      {/* Images for selected question */}
      {selectedQuestion && (
        <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
          <div className="border-b border-border/60 bg-muted/30 px-4 py-3 flex items-center justify-between">
            <h2 className="font-semibold text-sm">
              Images for selected question ({imagesForSelected.length})
            </h2>
          </div>
          {imagesForSelected.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No images attached to this question yet.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 lg:grid-cols-4">
              {imagesForSelected.map(img => (
                <div key={img.id} className="relative group rounded-lg border border-border/60 overflow-hidden">
                  <img
                    src={img.image_url}
                    alt={img.caption || 'Question image'}
                    className="w-full h-32 object-cover"
                  />
                  {img.caption && (
                    <p className="px-2 py-1 text-xs text-muted-foreground truncate">{img.caption}</p>
                  )}
                  <button
                    onClick={() => deleteImage(img)}
                    className="absolute top-2 right-2 hidden group-hover:flex items-center justify-center h-7 w-7 rounded-full bg-red-500 text-white hover:bg-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* All Images */}
      <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
        <div className="border-b border-border/60 bg-muted/30 px-4 py-3">
          <h2 className="font-semibold text-sm">All Images ({images.length})</h2>
        </div>
        {images.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Image className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No images uploaded yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 lg:grid-cols-5">
            {images.map(img => (
              <div key={img.id} className="relative group rounded-lg border border-border/60 overflow-hidden">
                <img
                  src={img.image_url}
                  alt={img.caption || 'Question image'}
                  className="w-full h-28 object-cover"
                />
                {img.caption && (
                  <p className="px-2 py-1 text-xs text-muted-foreground truncate">{img.caption}</p>
                )}
                <button
                  onClick={() => deleteImage(img)}
                  className="absolute top-1 right-1 hidden group-hover:flex items-center justify-center h-6 w-6 rounded-full bg-red-500 text-white hover:bg-red-600"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

