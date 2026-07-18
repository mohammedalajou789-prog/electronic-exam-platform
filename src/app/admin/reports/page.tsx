import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Flag, CheckCircle, Clock, XCircle } from 'lucide-react'
import ReportActions from '@/components/admin/ReportActions'

async function getReports() {
  const supabase = await createServerSupabaseClient()

  const { data } = await supabase
    .from('reports')
    .select(`
      *,
      question:questions(
        question_text,
        exam:exams(title)
      )
    `)
    .order('created_at', { ascending: false })

  return data || []
}

export default async function ReportsPage() {
  const reports = await getReports()

  const newCount = reports.filter(r => r.status === 'new').length
  const reviewCount = reports.filter(r => r.status === 'under_review').length
  const resolvedCount = reports.filter(r => r.status === 'resolved').length

  function getStatusIcon(status: string) {
    switch (status) {
      case 'new': return <Flag className="h-4 w-4 text-orange-500" />
      case 'under_review': return <Clock className="h-4 w-4 text-blue-500" />
      case 'resolved': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'rejected': return <XCircle className="h-4 w-4 text-gray-400" />
      default: return null
    }
  }

  function getStatusStyle(status: string) {
    switch (status) {
      case 'new': return 'bg-orange-50 text-orange-700'
      case 'under_review': return 'bg-blue-50 text-blue-700'
      case 'resolved': return 'bg-green-50 text-green-700'
      case 'rejected': return 'bg-gray-50 text-gray-500'
      default: return 'bg-gray-50 text-gray-500'
    }
  }

  function formatCategory(category: string) {
    return category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-muted-foreground">Review and resolve student-submitted question reports</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-center">
          <p className="text-2xl font-bold text-orange-700">{newCount}</p>
          <p className="text-sm text-orange-600">New Reports</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-center">
          <p className="text-2xl font-bold text-blue-700">{reviewCount}</p>
          <p className="text-sm text-blue-600">Under Review</p>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
          <p className="text-2xl font-bold text-green-700">{resolvedCount}</p>
          <p className="text-sm text-green-600">Resolved</p>
        </div>
      </div>

      {/* Reports Table */}
      <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
        {reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Flag className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="mb-2 text-lg font-semibold">No reports yet</h3>
            <p className="text-sm text-muted-foreground">Reports submitted by students will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Question</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {reports.map(report => (
                  <tr key={report.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium line-clamp-1 max-w-xs">
                        {report.question?.question_text || 'Unknown question'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {report.question?.exam?.title || ''}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm">{formatCategory(report.category)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-muted-foreground line-clamp-1 max-w-xs">
                        {report.description || '—'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${getStatusStyle(report.status)}`}>
                        {getStatusIcon(report.status)}
                        {report.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {new Date(report.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <ReportActions reportId={report.id} currentStatus={report.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

