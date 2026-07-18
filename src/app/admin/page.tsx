import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  BookOpen,
  FileText,
  Flag,
  Upload,
  Users,
  TrendingUp,
} from 'lucide-react'

async function getDashboardStats() {
  const supabase = await createServerSupabaseClient()

  const [
    { count: totalExams },
    { count: totalQuestions },
    { count: pendingReports },
    { count: totalStudents },
  ] = await Promise.all([
    supabase.from('exams').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('questions').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'new'),
    supabase.from('users').select('*', { count: 'exact', head: true }),
  ])

  return {
    totalExams: totalExams || 0,
    totalQuestions: totalQuestions || 0,
    pendingReports: pendingReports || 0,
    totalStudents: totalStudents || 0,
  }
}

async function getRecentActivity() {
  const supabase = await createServerSupabaseClient()

  const { data: logs } = await supabase
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5)

  return logs || []
}

export default async function AdminDashboardPage() {
  const stats = await getDashboardStats()
  const recentActivity = await getRecentActivity()

  const statCards = [
    {
      label: 'Total Exams',
      value: stats.totalExams,
      icon: <BookOpen className="h-5 w-5 text-primary" />,
      bg: 'bg-primary/10',
    },
    {
      label: 'Total Questions',
      value: stats.totalQuestions,
      icon: <FileText className="h-5 w-5 text-blue-600" />,
      bg: 'bg-blue-50',
    },
    {
      label: 'Pending Reports',
      value: stats.pendingReports,
      icon: <Flag className="h-5 w-5 text-orange-600" />,
      bg: 'bg-orange-50',
    },
    {
      label: 'Registered Students',
      value: stats.totalStudents,
      icon: <Users className="h-5 w-5 text-green-600" />,
      bg: 'bg-green-50',
    },
  ]

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to the Electronic Admin Panel
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-border/60 bg-card p-6 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{card.label}</p>
                <p className="mt-1 text-3xl font-bold">{card.value.toLocaleString()}</p>
              </div>
              <div className={`rounded-lg p-3 ${card.bg}`}>
                {card.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="rounded-xl border border-border/60 bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b border-border/60 px-6 py-4">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Recent Activity</h2>
        </div>
        <div className="p-6">
          {recentActivity.length > 0 ? (
            <ul className="space-y-3">
              {recentActivity.map((log) => (
                <li key={log.id} className="flex items-start gap-3">
                  <div className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                  <div>
                    <p className="text-sm">{log.description || log.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(log.created_at).toLocaleString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Upload className="mb-3 h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                No activity recorded yet
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

