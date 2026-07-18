'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Props {
  reportId: string
  currentStatus: string
}

export default function ReportActions({ reportId, currentStatus }: Props) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  async function updateStatus(status: string) {
    setIsLoading(true)
    const supabase = createClient()
    await supabase
      .from('reports')
      .update({
        status,
        resolved_at: status === 'resolved' ? new Date().toISOString() : null,
      })
      .eq('id', reportId)
    router.refresh()
    setIsLoading(false)
  }

  if (currentStatus === 'resolved' || currentStatus === 'rejected') {
    return <span className="text-xs text-muted-foreground">—</span>
  }

  return (
    <div className="flex items-center gap-2">
      {currentStatus === 'new' && (
        <button
          onClick={() => updateStatus('under_review')}
          disabled={isLoading}
          className="rounded-lg bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
        >
          Review
        </button>
      )}
      <button
        onClick={() => updateStatus('resolved')}
        disabled={isLoading}
        className="rounded-lg bg-green-50 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
      >
        Resolve
      </button>
      <button
        onClick={() => updateStatus('rejected')}
        disabled={isLoading}
        className="rounded-lg bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
      >
        Reject
      </button>
    </div>
  )
}

