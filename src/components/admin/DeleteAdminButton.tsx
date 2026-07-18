'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Props {
  adminId: string
}

export default function DeleteAdminButton({ adminId }: Props) {
  const [loading, setLoading] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    if (!confirm) {
      setConfirm(true)
      return
    }
    setLoading(true)
    const res = await fetch('/api/admin/delete-admin', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId }),
    })
    if (res.ok) {
      router.refresh()
    } else {
      const data = await res.json()
      alert(data.error || 'Failed to delete admin.')
    }
    setLoading(false)
    setConfirm(false)
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
        confirm
          ? 'bg-red-600 text-white hover:bg-red-700'
          : 'bg-red-50 text-red-600 hover:bg-red-100'
      }`}
    >
      <Trash2 className="h-3 w-3" />
      {loading ? 'Deleting...' : confirm ? 'Confirm?' : 'Delete'}
    </button>
  )
}

