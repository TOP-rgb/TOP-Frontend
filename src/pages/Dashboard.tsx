import { useAuthStore } from '@/store/authStore'
import { StatCard } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { formatCurrency } from '@/lib/utils'
import { useTasks } from '@/hooks/useTasks'
import { useEmployeeDashboard, useManagerDashboard, useAdminDashboard } from '@/hooks/useDashboard'
import { useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import {
  Clock, Briefcase, CheckSquare, TrendingUp, DollarSign,
  Users, AlertCircle, BarChart2, FileText, Target, Loader2, RefreshCw
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend
} from 'recharts'

const JOB_STATUS_COLORS: Record<string, string> = {
  OPEN: '#64748b',
  IN_PROGRESS: '#3b82f6',
  ON_HOLD: '#f59e0b',
  COMPLETED: '#10b981',
  INVOICED: '#8b5cf6',
  CLOSED: '#94a3b8',
}

function statusBadge(status: string) {
  const map: Record<string, 'default' | 'warning' | 'success' | 'danger' | 'secondary' | 'info'> = {
    open: 'secondary',
    in_progress: 'default',
    on_hold: 'warning',
    completed: 'success',
    invoiced: 'info',
    closed: 'outline' as 'secondary',
  }
  return map[status] ?? 'secondary'
}

function priorityBadge(priority: string) {
  const map: Record<string, 'default' | 'warning' | 'danger' | 'secondary'> = {
    low: 'secondary',
    medium: 'default',
    high: 'warning',
    urgent: 'danger',
  }
  return map[priority] ?? 'secondary'
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 size={32} className="animate-spin text-blue-500" />
    </div>
  )
}

export function Dashboard() {
  const { user } = useAuthStore()

  if (user?.role === 'employee') return <EmployeeDashboard />
  if (user?.role === 'manager') return <ManagerDashboard />
  return <AdminDashboard />
}

// ── Employee Dashboard ────────────────────────────────────────────────────────

function EmployeeDashboard() {
  const { user } = useAuthStore()
  const { data, loading, refetch } = useEmployeeDashboard()
  const { tasks } = useTasks()
  const myTasks = tasks.filter(t => t.assignedToIds?.includes(user?.id ?? ''))
  const location = useLocation()

  useEffect(() => { refetch() }, [location.pathname])

  if (loading) return <LoadingSpinner />

  const stats = data?.stats
  const recentTimesheets = data?.recentTimesheets ?? []

  // Build weekly chart from this week's timesheet entries, split billable vs non-billable
  const weeklyMap: Record<string, { billable: number; nonBillable: number }> = {
    Mon: { billable: 0, nonBillable: 0 },
    Tue: { billable: 0, nonBillable: 0 },
    Wed: { billable: 0, nonBillable: 0 },
    Thu: { billable: 0, nonBillable: 0 },
    Fri: { billable: 0, nonBillable: 0 },
  }
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7)) // Monday
  weekStart.setHours(0, 0, 0, 0)

  recentTimesheets.forEach(ts => {
    const d = new Date(ts.date)
    if (d >= weekStart) {
      const day = dayNames[d.getDay()]
      if (day in weeklyMap) {
        if (ts.billable) {
          weeklyMap[day].billable += ts.hours
        } else {
          weeklyMap[day].nonBillable += ts.hours
        }
      }
    }
  })
  const weeklyData = Object.entries(weeklyMap).map(([day, v]) => ({ day, ...v }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">
          Good {getGreeting()}, {data?.user.firstName ?? user?.name?.split(' ')[0] ?? 'there'} 👋
        </h2>
        <p className="text-slate-500 text-sm mt-1">Here's your productivity overview for this week</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Hours This Week"
          value={`${stats?.thisWeekHours ?? 0}h`}
          subtitle={`${stats?.thisMonthHours ?? 0}h this month`}
          icon={<Clock size={18} />}
          color="blue"
        />
        <StatCard
          title="Active Tasks"
          value={(stats?.activeTasks ?? 0).toString()}
          subtitle={`${stats?.pendingTasks ?? 0} pending`}
          icon={<CheckSquare size={18} />}
          color="amber"
        />
        <StatCard
          title="Time Entries"
          value={(stats?.totalTimesheetEntries ?? 0).toString()}
          subtitle="total logged entries"
          icon={<FileText size={18} />}
          color="purple"
        />
        <StatCard
          title="Jobs Worked"
          value={(stats?.activeJobs ?? 0).toString()}
          subtitle="active jobs"
          icon={<TrendingUp size={18} />}
          color="emerald"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly hours chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm hover:shadow-md transition-shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Weekly Hours Breakdown</h3>
            <Badge variant="secondary">This week</Badge>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weeklyData} barGap={6}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 13, fill: '#64748b', fontWeight: 500 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 13, fill: '#64748b', fontWeight: 500 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontSize: '12px' }} />
              <Bar dataKey="billable" name="Billable" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              <Bar dataKey="nonBillable" name="Non-Billable" fill="#cbd5e1" radius={[8, 8, 0, 0]} />
              <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* My tasks */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm hover:shadow-md transition-shadow p-6">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">My Tasks</h3>
          {myTasks.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No tasks assigned yet.</p>
          ) : (
            <div className="space-y-3">
              {myTasks.slice(0, 5).map(task => (
                <div key={task.id} className="flex items-start gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition-colors group">
                  <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${task.status === 'completed' ? 'bg-emerald-500' : task.status === 'in_progress' ? 'bg-blue-500' : 'bg-slate-300'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{task.name}</p>
                    <p className="text-xs text-slate-400 truncate mt-1">{task.clientName}</p>
                  </div>
                  <Badge variant={task.status === 'completed' ? 'success' : task.status === 'in_progress' ? 'default' : 'secondary'} className="flex-shrink-0">
                    {task.status === 'completed' ? '✓' : task.status === 'in_progress' ? '→' : '○'} {task.status.replace('_', ' ')}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent time entries */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm hover:shadow-md transition-shadow p-6">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Recent Time Entries</h3>
        {recentTimesheets.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">No time entries yet. Log time from the Timesheets page.</p>
        ) : (
          <div className="space-y-2">
            {recentTimesheets.slice(0, 8).map(entry => (
              <div key={entry.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{entry.job?.title ?? '—'}</p>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-xs text-slate-500 dark:text-slate-400">{entry.job?.client?.company ?? '—'}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{entry.date?.slice(0, 10)}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{entry.hours}h</span>
                  {entry.description && (
                    <p className="text-xs text-slate-400 mt-0.5 max-w-xs truncate">{entry.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Manager Dashboard ─────────────────────────────────────────────────────────

function ManagerDashboard() {
  const { data, loading, error, refetch } = useManagerDashboard()
  const location = useLocation()

  useEffect(() => { refetch() }, [location.pathname])

  if (loading) return <LoadingSpinner />
  if (error) return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mb-3">
        <AlertCircle size={24} className="text-red-500" />
      </div>
      <h3 className="text-base font-semibold text-slate-700 mb-1">Failed to load dashboard</h3>
      <p className="text-slate-400 text-sm max-w-sm">{error}</p>
    </div>
  )

  const jobStats = data?.jobStats
  const revenue = data?.revenue
  const recentJobs = data?.recentJobs ?? []
  const teamMembers = data?.teamStats?.teamMembers ?? []
  const totalTeamHours = data?.teamStats?.totalTeamHours ?? 0

  // Build pie chart data from real job status counts
  const jobStatusData = jobStats ? [
    { name: 'Open', value: jobStats.byStatus.OPEN, color: JOB_STATUS_COLORS.OPEN },
    { name: 'In Progress', value: jobStats.byStatus.IN_PROGRESS, color: JOB_STATUS_COLORS.IN_PROGRESS },
    { name: 'On Hold', value: jobStats.byStatus.ON_HOLD, color: JOB_STATUS_COLORS.ON_HOLD },
    { name: 'Completed', value: jobStats.byStatus.COMPLETED, color: JOB_STATUS_COLORS.COMPLETED },
    { name: 'Invoiced', value: jobStats.byStatus.INVOICED, color: JOB_STATUS_COLORS.INVOICED },
  ].filter(s => s.value > 0) : []

  // Revenue bar data — show revenue vs cost from API
  const revenueBarData = revenue ? [
    { label: 'Revenue', value: revenue.total, color: '#3b82f6' },
    { label: 'Cost', value: revenue.cost, color: '#10b981' },
    { label: 'Profit', value: revenue.profit, color: '#8b5cf6' },
  ] : []

  const activeJobCount = (jobStats?.byStatus.OPEN ?? 0) + (jobStats?.byStatus.IN_PROGRESS ?? 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Manager Overview 📊</h2>
          <p className="text-slate-500 text-sm mt-1">Team performance and job profitability at a glance</p>
        </div>
        <button
          onClick={refetch}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Jobs"
          value={(jobStats?.total ?? 0).toString()}
          subtitle="all jobs"
          icon={<Briefcase size={18} />}
          color="blue"
        />
        <StatCard
          title="Active Jobs"
          value={activeJobCount.toString()}
          subtitle="open + in progress"
          icon={<AlertCircle size={18} />}
          color="emerald"
        />
        <StatCard
          title="Revenue"
          value={formatCurrency(revenue?.total ?? 0)}
          subtitle="completed + invoiced"
          icon={<DollarSign size={18} />}
          color="purple"
        />
        <StatCard
          title="Team Hours"
          value={`${totalTeamHours}h`}
          subtitle={`${teamMembers.length} team member${teamMembers.length !== 1 ? 's' : ''}`}
          icon={<Clock size={18} />}
          color="amber"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue overview */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm hover:shadow-md transition-shadow p-6">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Financial Overview</h3>
          {revenueBarData.length === 0 || revenue?.total === 0 ? (
            <p className="text-sm text-slate-400 text-center py-16">No revenue data yet.</p>
          ) : (
            <div className="space-y-4">
              {revenueBarData.map(item => (
                <div key={item.label} className="flex items-center gap-4">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400 w-20">{item.label}</span>
                  <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-8 relative overflow-hidden">
                    <div
                      className="h-full rounded-full flex items-center px-3 transition-all"
                      style={{
                        width: `${revenueBarData[0].value > 0 ? Math.max((item.value / revenueBarData[0].value) * 100, 5) : 0}%`,
                        backgroundColor: item.color,
                      }}
                    >
                      <span className="text-xs font-bold text-white truncate">{formatCurrency(item.value)}</span>
                    </div>
                  </div>
                </div>
              ))}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Profit margin: <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {revenue && revenue.total > 0 ? `${Math.round((revenue.profit / revenue.total) * 100)}%` : '—'}
                  </span>
                  {' '}· Based on {revenue?.completedJobs ?? 0} completed job{(revenue?.completedJobs ?? 0) !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Job status donut */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm hover:shadow-md transition-shadow p-6">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Job Status</h3>
          {jobStatusData.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No jobs yet.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={jobStatusData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2} dataKey="value">
                    {jobStatusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {jobStatusData.map(s => (
                  <div key={s.name} className="flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                      <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">{s.name}</span>
                    </div>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">{s.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Team hours */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm hover:shadow-md transition-shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Team Hours</h3>
          <Badge variant="secondary">{totalTeamHours}h total</Badge>
        </div>
        {teamMembers.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">No time logged yet.</p>
        ) : (
          <div className="space-y-3">
            {teamMembers.map(member => (
              <div key={member.userId} className="flex items-center gap-4">
                <Avatar name={member.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-800 dark:text-white truncate">{member.name}</span>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300 flex-shrink-0 ml-2">{member.hours}h</span>
                  </div>
                  <div className="bg-slate-100 dark:bg-slate-800 rounded-full h-1.5">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${totalTeamHours > 0 ? (member.hours / totalTeamHours) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent jobs table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm hover:shadow-md transition-shadow p-6">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Recent Jobs</h3>
        {recentJobs.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">No jobs found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700/50">
                  {['Job', 'Client', 'Status', 'Priority'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {recentJobs.map(job => (
                  <tr key={job.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900 dark:text-white text-sm">{job.jobId}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-40 mt-1">{job.title}</p>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">{job.client?.company ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusBadge(job.status.toLowerCase())}>{job.status.replace('_', ' ')}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={priorityBadge(job.priority.toLowerCase())}>{job.priority.charAt(0) + job.priority.slice(1).toLowerCase()}</Badge>
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

// ── Admin Dashboard ────────────────────────────────────────────────────────────

function AdminDashboard() {
  const { data, loading, error, refetch } = useAdminDashboard()
  const location = useLocation()

  // Refetch every time the user navigates to /dashboard
  useEffect(() => { refetch() }, [location.pathname])

  if (loading) return <LoadingSpinner />
  if (error) return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mb-3">
        <AlertCircle size={24} className="text-red-500" />
      </div>
      <h3 className="text-base font-semibold text-slate-700 mb-1">Failed to load dashboard</h3>
      <p className="text-slate-400 text-sm max-w-sm">{error}</p>
    </div>
  )

  const financial = data?.financial
  const jobStats = data?.jobStats
  const userStats = data?.userStats
  const clientStats = data?.clientStats
  const timesheetStats = data?.timesheetStats

  // Build job status pie
  const jobStatusData = jobStats ? [
    { name: 'Open', value: jobStats.byStatus.OPEN, color: JOB_STATUS_COLORS.OPEN },
    { name: 'In Progress', value: jobStats.byStatus.IN_PROGRESS, color: JOB_STATUS_COLORS.IN_PROGRESS },
    { name: 'On Hold', value: jobStats.byStatus.ON_HOLD, color: JOB_STATUS_COLORS.ON_HOLD },
    { name: 'Completed', value: jobStats.byStatus.COMPLETED, color: JOB_STATUS_COLORS.COMPLETED },
    { name: 'Invoiced', value: jobStats.byStatus.INVOICED, color: JOB_STATUS_COLORS.INVOICED },
  ].filter(s => s.value > 0) : []

  // Revenue area chart using financial data (single period, show as bar items)
  const revenueData = financial ? [
    { label: 'Revenue', value: financial.totalRevenue },
    { label: 'Cost', value: financial.totalCost },
    { label: 'Profit', value: financial.totalProfit },
  ] : []

  const topClients = clientStats?.topClients ?? []
  const maxClientRevenue = topClients.length > 0 ? Math.max(...topClients.map(c => c.revenue)) : 1

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Leadership Dashboard 📈</h2>
          <p className="text-slate-500 text-sm mt-1">Company-wide performance, revenue and profitability</p>
        </div>
        <button
          onClick={refetch}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Revenue"
          value={formatCurrency(financial?.totalRevenue ?? 0)}
          subtitle={`${financial?.completedJobs ?? 0} completed job${(financial?.completedJobs ?? 0) !== 1 ? 's' : ''}`}
          icon={<DollarSign size={18} />}
          color="emerald"
        />
        <StatCard
          title="Total Jobs"
          value={(jobStats?.total ?? 0).toString()}
          subtitle={`${(jobStats?.byStatus.OPEN ?? 0) + (jobStats?.byStatus.IN_PROGRESS ?? 0)} active`}
          icon={<Briefcase size={18} />}
          color="blue"
        />
        <StatCard
          title="Team Members"
          value={(userStats?.total ?? 0).toString()}
          subtitle={`${userStats?.byStatus.ACTIVE ?? 0} active`}
          icon={<Users size={18} />}
          color="purple"
        />
        <StatCard
          title="Total Hours"
          value={`${timesheetStats?.totalHours ?? 0}h`}
          subtitle={`${timesheetStats?.totalEntries ?? 0} entries`}
          icon={<Clock size={18} />}
          color="amber"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue breakdown */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm hover:shadow-md transition-shadow p-6">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Financial Breakdown</h3>
          {revenueData.length === 0 || financial?.totalRevenue === 0 ? (
            <p className="text-sm text-slate-400 text-center py-16">No financial data yet.</p>
          ) : (
            <div className="space-y-5">
              {revenueData.map((item, i) => {
                const colours = ['#3b82f6', '#ef4444', '#10b981']
                const pct = financial && financial.totalRevenue > 0
                  ? Math.round((item.value / financial.totalRevenue) * 100)
                  : 0
                return (
                  <div key={item.label}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{item.label}</span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(item.value)}</span>
                    </div>
                    <div className="bg-slate-100 dark:bg-slate-800 rounded-full h-3">
                      <div
                        className="h-3 rounded-full transition-all"
                        style={{ width: `${Math.max(pct, item.value > 0 ? 3 : 0)}%`, backgroundColor: colours[i] }}
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{pct}% of revenue</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Top clients */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm hover:shadow-md transition-shadow p-6">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Client Revenue Breakdown</h3>
          {topClients.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No client data yet.</p>
          ) : (
            <div className="space-y-3">
              {topClients.map(client => (
                <div key={client.clientId} className="group p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0 text-white font-bold text-sm">
                      {client.company[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{client.company}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {formatCurrency(client.revenue)} · <span className="font-medium text-slate-600 dark:text-slate-300">{client.jobs} job{client.jobs !== 1 ? 's' : ''}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full transition-all"
                        style={{ width: `${maxClientRevenue > 0 ? (client.revenue / maxClientRevenue) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* KPIs row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm hover:shadow-md transition-all p-5">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Total Users</p>
          <p className="text-2xl font-bold mb-2 text-slate-900 dark:text-white">{userStats?.total ?? '—'}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{userStats?.byStatus.ACTIVE ?? 0} active</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm hover:shadow-md transition-all p-5">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Total Jobs</p>
          <p className="text-2xl font-bold mb-2 text-slate-900 dark:text-white">{jobStats?.total ?? '—'}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{financial?.invoicedJobs ?? 0} invoiced</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm hover:shadow-md transition-all p-5">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Avg Hours/Entry</p>
          <p className="text-2xl font-bold mb-2 text-emerald-600 dark:text-emerald-400">{timesheetStats?.averageHours ?? '—'}h</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">per timesheet entry</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm hover:shadow-md transition-all p-5">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Net Profit</p>
          <p className="text-2xl font-bold mb-2 text-emerald-600 dark:text-emerald-400">{formatCurrency(financial?.totalProfit ?? 0)}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">across completed jobs</p>
        </div>
      </div>

      {/* Job status + priority breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Job status pie */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm hover:shadow-md transition-shadow p-6">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Job Pipeline</h3>
          {jobStatusData.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No jobs yet.</p>
          ) : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={jobStatusData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2} dataKey="value">
                    {jobStatusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {jobStatusData.map(s => (
                  <div key={s.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="text-sm text-slate-600 dark:text-slate-400">{s.name}</span>
                    </div>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Priority breakdown */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm hover:shadow-md transition-shadow p-6">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Jobs by Priority</h3>
          {!jobStats ? (
            <p className="text-sm text-slate-400 text-center py-8">No data yet.</p>
          ) : (
            <div className="space-y-4">
              {[
                { label: 'Urgent', count: jobStats.byPriority.URGENT, color: '#ef4444', variant: 'danger' as const },
                { label: 'High', count: jobStats.byPriority.HIGH, color: '#f59e0b', variant: 'warning' as const },
                { label: 'Medium', count: jobStats.byPriority.MEDIUM, color: '#3b82f6', variant: 'default' as const },
                { label: 'Low', count: jobStats.byPriority.LOW, color: '#94a3b8', variant: 'secondary' as const },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-3">
                  <Badge variant={item.variant} className="w-16 justify-center">{item.label}</Badge>
                  <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-3">
                    <div
                      className="h-3 rounded-full transition-all"
                      style={{
                        width: `${jobStats.total > 0 ? (item.count / jobStats.total) * 100 : 0}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                  <span className="text-sm font-bold text-slate-900 dark:text-white w-6 text-right">{item.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
