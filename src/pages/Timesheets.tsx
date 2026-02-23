import { useState, useMemo, useEffect } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useAuthStore } from '@/store/authStore'
import { Avatar } from '@/components/ui/Avatar'
import { Check, X, Clock, TrendingUp, AlertCircle, Plus, ChevronLeft, ChevronRight, LogIn, Users } from 'lucide-react'
import { useTimesheets } from '@/hooks/useTimesheets'
import type { TimesheetEntry } from '@/hooks/useTimesheets'
import { useJobs } from '@/hooks/useJobs'
import { useTasks } from '@/hooks/useTasks'
import { useUsers } from '@/hooks/useUsers'

// ---------- Status config ----------
type EntryStatus = 'pending_normal' | 'pending_approval' | 'approved' | 'rejected'

const statusConfig: Record<string, { variant: 'secondary' | 'warning' | 'success' | 'danger'; label: string }> = {
  pending_normal:   { variant: 'secondary', label: 'Normal' },
  pending_approval: { variant: 'warning',   label: 'Needs Approval' },
  approved:         { variant: 'success',   label: 'Approved' },
  rejected:         { variant: 'danger',    label: 'Rejected' },
}

function flagLabel(reason?: string) {
  switch (reason) {
    case 'UNDER_HOURS':  return 'Day total under 8 hours'
    case 'OVER_HOURS':   return 'Day total over 8 hours'
    case 'JOB_OVERTIME': return 'Job has exceeded quoted hours'
    case 'MULTIPLE':     return 'Multiple flags: hours + job overtime'
    default: return 'Flagged for review'
  }
}

// ---------- Date helpers (vanilla JS, no extra libs) ----------
function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function addDays(d: Date, n: number): Date {
  const date = new Date(d)
  date.setDate(date.getDate() + n)
  return date
}

function toYMD(d: Date): string {
  // Use local date parts to avoid UTC timezone shift (e.g. AEST = UTC+10)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getWeekDays(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

function getMonthWeeks(d: Date): Array<{ label: string; start: Date; end: Date }> {
  const year = d.getFullYear()
  const month = d.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const weeks: Array<{ label: string; start: Date; end: Date }> = []
  let start = new Date(firstDay)
  let wNum = 1
  while (start <= lastDay) {
    const end = new Date(Math.min(addDays(start, 6).getTime(), lastDay.getTime()))
    weeks.push({
      label: `Week ${wNum}`,
      start: new Date(start),
      end: new Date(end),
    })
    start = addDays(end, 1)
    wNum++
  }
  return weeks
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

// ---------- ApprovalPanel (unchanged) ----------
function ApprovalPanel({
  entries,
  onApprove,
  onReject,
}: {
  entries: TimesheetEntry[]
  onApprove: (id: string) => Promise<boolean>
  onReject: (id: string, note: string) => Promise<boolean>
}) {
  const [rejectTarget, setRejectTarget] = useState<string | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [busy, setBusy] = useState(false)

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3 mb-6">
      <div className="flex items-center gap-2">
        <AlertCircle size={16} className="text-amber-600" />
        <p className="text-sm font-semibold text-amber-800">
          {entries.length} timesheet {entries.length === 1 ? 'entry needs' : 'entries need'} your approval
        </p>
      </div>
      <div className="space-y-2">
        {entries.map(e => (
          <div key={e.id} className="flex items-center justify-between gap-3 bg-white rounded-xl border border-amber-200 px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800">{e.userName}</p>
              <p className="text-xs text-slate-500">
                {e.date} &bull; {e.jobTitle}{e.taskName ? ` • ${e.taskName}` : ''} &bull; <strong>{e.hours}h</strong>
              </p>
              <p className="text-xs text-amber-600 mt-0.5">{flagLabel(e.flagReason)}</p>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <button
                onClick={async () => { setBusy(true); await onApprove(e.id); setBusy(false) }}
                disabled={busy}
                className="px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                <Check size={12} className="inline mr-1" />Approve
              </button>
              <button
                onClick={() => setRejectTarget(e.id)}
                disabled={busy}
                className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                <X size={12} className="inline mr-1" />Reject
              </button>
            </div>
          </div>
        ))}
      </div>
      <Modal
        open={!!rejectTarget}
        onClose={() => { setRejectTarget(null); setRejectNote('') }}
        title="Reject Timesheet Entry"
        description="Provide a reason so the employee can correct their entry"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setRejectTarget(null); setRejectNote('') }}>Cancel</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={busy}
              onClick={async () => {
                if (!rejectTarget) return
                setBusy(true)
                await onReject(rejectTarget, rejectNote)
                setBusy(false)
                setRejectTarget(null)
                setRejectNote('')
              }}
            >Reject</Button>
          </div>
        }
      >
        <textarea
          value={rejectNote}
          onChange={e => setRejectNote(e.target.value)}
          rows={3}
          placeholder="e.g., Hours seem incorrect for this date. Please review and resubmit."
          className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-red-500/30 focus:border-red-500 resize-none"
        />
      </Modal>
    </div>
  )
}

// ---------- Status badge pill ----------
function StatusPill({ status }: { status: string }) {
  const cfg = statusConfig[status] ?? statusConfig['pending_normal']
  const colors: Record<string, { bg: string; color: string }> = {
    secondary: { bg: '#f3f4f6', color: '#4b5563' },
    warning:   { bg: '#fef3c7', color: '#92400e' },
    success:   { bg: '#d1fae5', color: '#065f46' },
    danger:    { bg: '#fee2e2', color: '#991b1b' },
  }
  const c = colors[cfg.variant] ?? colors['secondary']
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: c.bg, color: c.color, whiteSpace: 'nowrap' }}>
      {cfg.label}
    </span>
  )
}

// ---------- Main component ----------
export function Timesheets() {
  const { user } = useAuthStore()
  const isManager = user?.role !== 'employee'

  // Manager can filter by employee; '' = all users
  const [selectedUserId, setSelectedUserId] = useState<string>('')

  const {
    entries: rawEntriesAll,
    pendingEntries,
    logTime,
    approveEntry,
    rejectEntry,
    fetchPending,
  } = useTimesheets(isManager ? {} : { userId: user?.id })

  useEffect(() => {
    if (isManager) fetchPending()
  }, [isManager, fetchPending])

  const { jobs } = useJobs()
  const { tasks } = useTasks()
  const { users } = useUsers()

  // Get job IDs that the employee has access to (through assigned tasks)
  const accessibleJobIds = useMemo(() => {
    if (isManager) return null // Managers see all jobs
    return tasks
      .filter(t => t.assignedToIds?.includes(user?.id || ''))
      .map(t => t.jobId)
      .filter((v, i, a) => a.indexOf(v) === i) // Remove duplicates
  }, [tasks, user?.id, isManager])

  // Only employees — for the filter dropdown
  const employeeList = useMemo(() => users.filter(u => u.status === 'active'), [users])

  // Apply user filter for managers; employees always see only their own
  const rawEntries = useMemo(() => {
    if (!isManager) return rawEntriesAll
    if (!selectedUserId) return rawEntriesAll
    return rawEntriesAll.filter(e => e.userId === selectedUserId)
  }, [rawEntriesAll, isManager, selectedUserId])

  // ---------- Tab + date navigation ----------
  type Tab = 'daily' | 'weekly' | 'monthly'
  const [activeTab, setActiveTab] = useState<Tab>('weekly')
  const [anchorDate, setAnchorDate] = useState(new Date())

  const weekMonday = useMemo(() => getMonday(anchorDate), [anchorDate])
  const weekDays   = useMemo(() => getWeekDays(weekMonday), [weekMonday])
  const monthWeeks = useMemo(() => getMonthWeeks(anchorDate), [anchorDate])

  function navigate(dir: -1 | 1) {
    setAnchorDate(prev => {
      if (activeTab === 'daily')   return addDays(prev, dir)
      if (activeTab === 'weekly')  return addDays(prev, dir * 7)
      // monthly
      const d = new Date(prev)
      d.setMonth(d.getMonth() + dir)
      return d
    })
  }

  // Date range label for navigator
  const navLabel = useMemo(() => {
    if (activeTab === 'daily') {
      return anchorDate.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    }
    if (activeTab === 'weekly') {
      const sun = weekDays[6]
      const fmt = (d: Date) => d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
      return `${fmt(weekMonday)} – ${fmt(sun!)} ${weekDays[6]!.getFullYear()}`
    }
    return `${MONTH_NAMES[anchorDate.getMonth()]} ${anchorDate.getFullYear()}`
  }, [activeTab, anchorDate, weekMonday, weekDays])

  // ---------- Stats (scoped to current period) ----------
  const periodEntries = useMemo(() => {
    if (activeTab === 'daily') {
      const ymd = toYMD(anchorDate)
      return rawEntries.filter(e => e.date === ymd)
    }
    if (activeTab === 'weekly') {
      const start = toYMD(weekDays[0]!)
      const end   = toYMD(weekDays[6]!)
      return rawEntries.filter(e => e.date >= start && e.date <= end)
    }
    // monthly
    const year = anchorDate.getFullYear()
    const month = anchorDate.getMonth()
    return rawEntries.filter(e => {
      const d = new Date(e.date)
      return d.getFullYear() === year && d.getMonth() === month
    })
  }, [rawEntries, activeTab, anchorDate, weekDays])

  const totalHoursAll    = periodEntries.reduce((s, e) => s + e.hours, 0)
  const billableHours    = periodEntries.filter(e => e.billable).reduce((s, e) => s + e.hours, 0)
  const nonBillableHours = totalHoursAll - billableHours
  const pendingCount     = periodEntries.filter(e => e.status === 'pending_approval').length
  const workDays         = activeTab === 'daily' ? 1 : activeTab === 'weekly' ? 5 : 20
  const overtimeHours    = Math.max(0, totalHoursAll - workDays * 8)

  // ---------- Inline reject modal state ----------
  const [rejectModal, setRejectModal] = useState<{ id: string } | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [busy, setBusy] = useState(false)

  // ---------- Log Daily Time modal state ----------
  const [logDailyModal, setLogDailyModal] = useState(false)
  const [dailyLog, setDailyLog] = useState({
    date: new Date().toISOString().split('T')[0],
    hours: '8',
    client: '',
    jobId: '',
    job: '',
    taskId: '',
    task: '',
    notes: '',
    billable: true,
  })
  const [dailyEntries, setDailyEntries] = useState<Array<{
    id: string; date: string; hours: number; client: string
    jobId: string; job: string; taskId: string; task: string;   notes: string; billable: boolean
  }>>([])
  const [submitting, setSubmitting] = useState(false)

  const resetLogModal = () => {
    setLogDailyModal(false)
    setDailyEntries([])
    setDailyLog({ date: new Date().toISOString().split('T')[0], hours: '8', client: '', jobId: '', job: '', taskId: '', task: '',notes:'', billable: true })
  }

  // Helper: get jobId display string
  const getJobIdDisplay = (dbJobId: string) => {
    const j = jobs.find(j => j.id === dbJobId)
    return j?.jobId ?? '—'
  }

  // ---------- DAILY view data ----------
  const dailyViewEntries = useMemo(() => {
    const ymd = toYMD(anchorDate)
    return rawEntries.filter(e => e.date === ymd)
  }, [rawEntries, anchorDate])

  // ---------- WEEKLY view data ----------
  // Rows = unique userId+jobId+taskId combinations; columns = Mon-Sun
  interface WeekRow {
    jobDbId: string
    jobIdDisplay: string
    clientName: string
    jobTitle: string
    taskName: string
    taskType: string
    userName: string
    dayHours: Record<string, number>  // key: YYYY-MM-DD
    total: number
    hasFlag: boolean
    entries: TimesheetEntry[]
  }

  const weeklyRows = useMemo((): WeekRow[] => {
    const start = toYMD(weekDays[0]!)
    const end   = toYMD(weekDays[6]!)
    const inWeek = rawEntries.filter(e => e.date >= start && e.date <= end)
    const map: Record<string, WeekRow> = {}

    for (const e of inWeek) {
      // Key includes userId so each employee's rows are separate
      const key = `${e.userId}::${e.jobId}::${e.taskId ?? ''}`
      if (!map[key]) {
        const task = tasks.find(t => t.id === e.taskId)
        map[key] = {
          jobDbId: e.jobId,
          jobIdDisplay: getJobIdDisplay(e.jobId),
          clientName: e.clientName,
          jobTitle: e.jobTitle,
          taskName: e.taskName ?? '—',
          taskType: task?.type ?? '—',
          userName: e.userName,
          dayHours: {},
          total: 0,
          hasFlag: false,
          entries: [],
        }
      }
      map[key].dayHours[e.date] = (map[key].dayHours[e.date] ?? 0) + e.hours
      map[key].total += e.hours
      if (e.status === 'pending_approval') map[key].hasFlag = true
      map[key].entries.push(e)
    }
    return Object.values(map)
  }, [rawEntries, weekDays, tasks, jobs])

  // ---------- MONTHLY view data ----------
  interface MonthRow {
    jobDbId: string
    jobIdDisplay: string
    clientName: string
    jobTitle: string
    taskName: string
    taskType: string
    userName: string
    weekHours: number[]  // one per week in month
    total: number
  }

  const monthlyRows = useMemo((): MonthRow[] => {
    const year = anchorDate.getFullYear()
    const month = anchorDate.getMonth()
    const inMonth = rawEntries.filter(e => {
      const d = new Date(e.date)
      return d.getFullYear() === year && d.getMonth() === month
    })
    const map: Record<string, MonthRow> = {}

    for (const e of inMonth) {
      // Key includes userId so each employee's rows are separate
      const key = `${e.userId}::${e.jobId}::${e.taskId ?? ''}`
      if (!map[key]) {
        const task = tasks.find(t => t.id === e.taskId)
        map[key] = {
          jobDbId: e.jobId,
          jobIdDisplay: getJobIdDisplay(e.jobId),
          clientName: e.clientName,
          jobTitle: e.jobTitle,
          taskName: e.taskName ?? '—',
          taskType: task?.type ?? '—',
          userName: e.userName,
          weekHours: Array(monthWeeks.length).fill(0),
          total: 0,
        }
      }
      const eDate = e.date
      const wIdx = monthWeeks.findIndex(w => eDate >= toYMD(w.start) && eDate <= toYMD(w.end))
      if (wIdx >= 0) map[key].weekHours[wIdx] = (map[key].weekHours[wIdx] ?? 0) + e.hours
      map[key].total += e.hours
    }
    return Object.values(map)
  }, [rawEntries, anchorDate, tasks, jobs, monthWeeks])

  // ---------- Table shared styles ----------
  const th: React.CSSProperties = { padding: '10px 12px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { padding: '11px 12px', fontSize: 13, color: '#374151', borderBottom: '1px solid #f1f3f9', verticalAlign: 'middle' }
  const tdNum: React.CSSProperties = { ...td, fontWeight: 600, color: '#1e293b', textAlign: 'center' }

  return (
    <div style={{ fontFamily: 'inherit' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1f36', margin: 0 }}>Time Sheet</h1>
          <p style={{ color: '#6b7280', fontSize: 13, marginTop: 4 }}>
            {isManager ? 'Review and approve team daily timesheets' : 'Log and track your daily time entries'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Employee filter — managers/admins only */}
          {isManager && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '7px 12px', fontSize: 13 }}>
              <Users size={14} style={{ color: '#6b7280', flexShrink: 0 }} />
              <select
                value={selectedUserId}
                onChange={e => setSelectedUserId(e.target.value)}
                style={{ border: 'none', outline: 'none', fontSize: 13, color: '#374151', background: 'transparent', cursor: 'pointer', minWidth: 150 }}
              >
                <option value="">All Employees</option>
                {employeeList.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          )}
          <button
            onClick={() => setLogDailyModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
          >
            <LogIn size={16} /> Log Daily Time
          </button>
        </div>
      </div>

      {/* ── Approval panel ── */}
      {isManager && pendingEntries.length > 0 && (
        <ApprovalPanel entries={pendingEntries} onApprove={approveEntry} onReject={rejectEntry} />
      )}

      {/* ── 5 Colored Stat Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total Hours',    value: `${totalHoursAll.toFixed(1)}h`,    bar: '#2563eb', bg: '#dbeafe', fg: '#1d4ed8', icon: <Clock size={17} /> },
          { label: 'Billable Hours', value: `${billableHours.toFixed(1)}h`,    bar: '#059669', bg: '#d1fae5', fg: '#065f46', icon: <TrendingUp size={17} /> },
          { label: 'Non-Billable',   value: `${nonBillableHours.toFixed(1)}h`, bar: '#f59e0b', bg: '#fef3c7', fg: '#92400e', icon: <Clock size={17} /> },
          { label: 'Overtime',       value: `${overtimeHours.toFixed(1)}h`,    bar: '#ef4444', bg: '#fee2e2', fg: '#991b1b', icon: <AlertCircle size={17} /> },
          { label: 'Pending',        value: `${pendingCount}`,                  bar: '#6b7280', bg: '#f3f4f6', fg: '#374151', icon: <AlertCircle size={17} /> },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 16px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: s.bar }} />
            <div style={{ width: 34, height: 34, borderRadius: 8, background: s.bg, color: s.fg, display: 'grid', placeItems: 'center', marginBottom: 10 }}>
              {s.icon}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1f36', lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 500, marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Main card ── */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>

        {/* Toolbar: tabs + date navigator */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', borderBottom: '1px solid #f1f3f9', flexWrap: 'wrap', gap: 8 }}>
          {/* Tab pills */}
          <div style={{ display: 'flex' }}>
            {(['daily', 'weekly', 'monthly'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{ padding: '14px 18px', fontSize: 13, fontWeight: 600, border: 'none', background: 'transparent', cursor: 'pointer', borderBottom: `2px solid ${activeTab === tab ? '#2563eb' : 'transparent'}`, color: activeTab === tab ? '#2563eb' : '#6b7280', textTransform: 'capitalize', whiteSpace: 'nowrap' }}
              >
                {tab === 'daily' ? 'Daily View' : tab === 'weekly' ? 'Weekly View' : 'Monthly View'}
              </button>
            ))}
          </div>

          {/* Date navigator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
            <button onClick={() => navigate(-1)} style={{ width: 28, height: 28, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center', color: '#374151' }}>
              <ChevronLeft size={14} />
            </button>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1f36', minWidth: 200, textAlign: 'center' }}>{navLabel}</span>
            <button onClick={() => navigate(1)} style={{ width: 28, height: 28, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center', color: '#374151' }}>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* ── DAILY VIEW ── */}
        {activeTab === 'daily' && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {[
                    'Job ID',
                    ...(isManager ? ['Employee'] : []),
                    'Client', 'Job', 'Task', 'Task Type', 'Hours', 'Billable', 'Notes', 'Status',
                    ...(isManager ? ['Action'] : []),
                  ].map(h => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dailyViewEntries.length === 0 ? (
                  <tr><td colSpan={isManager ? 11 : 9} style={{ textAlign: 'center', padding: '48px 18px', color: '#9ca3af', fontSize: 14 }}>
                    No entries for this day. Click "Log Daily Time" to add.
                  </td></tr>
                ) : dailyViewEntries.map((e, i) => {
                  const task = tasks.find(t => t.id === e.taskId)
                  const isBillable = e.billable
                  return (
                    <tr key={e.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={td}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#2563eb', background: '#dbeafe', padding: '2px 8px', borderRadius: 5 }}>
                          {getJobIdDisplay(e.jobId)}
                        </span>
                      </td>
                      {isManager && (
                        <td style={td}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Avatar name={e.userName} size="xs" />
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>{e.userName}</span>
                          </div>
                        </td>
                      )}
                      <td style={{ ...td, color: '#6b7280', fontSize: 12 }}>{e.clientName}</td>
                      <td style={{ ...td, fontWeight: 600 }}>{e.jobTitle}</td>
                      <td style={td}>{e.taskName ?? <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>{e.description || '—'}</span>}</td>
                      <td style={{ ...td, color: '#6b7280' }}>{task?.type ?? '—'}</td>
                      <td style={{ ...tdNum }}>{e.hours}h</td>
                      <td style={td}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: isBillable ? '#d1fae5' : '#f3f4f6', color: isBillable ? '#065f46' : '#4b5563' }}>
                          {isBillable ? 'Billable' : 'Non-Bill'}
                        </span>
                      </td>
                      <td style={td} title={e.description || ''}>
                        <span style={{ color: '#6b7280', fontSize: 12, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                          {e.description || '—'}
                        </span>
                      </td>
                      <td style={td}>
                        <StatusPill status={e.status} />
                        {e.status === 'rejected' && e.rejectionNote && (
                          <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{e.rejectionNote}</div>
                        )}
                        {e.status === 'pending_approval' && e.flagReason && (
                          <div style={{ fontSize: 11, color: '#d97706', marginTop: 3 }}>{flagLabel(e.flagReason)}</div>
                        )}
                      </td>
                      {isManager && (
                        <td style={td}>
                          {e.status === 'pending_approval' && (
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button onClick={async () => { setBusy(true); await approveEntry(e.id); setBusy(false) }} disabled={busy}
                                style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#d1fae5', color: '#065f46', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                                <Check size={11} /> Approve
                              </button>
                              <button onClick={() => setRejectModal({ id: e.id })} disabled={busy}
                                style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#fee2e2', color: '#991b1b', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                                <X size={11} /> Reject
                              </button>
                            </div>
                          )}
                          {e.status !== 'pending_approval' && (
                            <StatusPill status={e.status} />
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
              {dailyViewEntries.length > 0 && (
                <tfoot>
                  <tr style={{ background: '#f9fafb' }}>
                    <td colSpan={isManager ? 6 : 5} style={{ ...td, fontWeight: 700, color: '#1e293b' }}>Total</td>
                    <td style={{ ...tdNum, color: '#2563eb' }}>{dailyViewEntries.reduce((s,e) => s+e.hours,0).toFixed(1)}h</td>
                    <td colSpan={isManager ? 4 : 3} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* ── WEEKLY VIEW ── */}
        {activeTab === 'weekly' && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {[
                    'Job ID',
                    ...(isManager ? ['Employee'] : []),
                    'Client', 'Job', 'Task', 'Task Type',
                    ...weekDays.map((d, i) => `${DAY_NAMES[i]} ${d.getDate()}`),
                    'Total',
                    ...(isManager ? ['Status'] : []),
                  ].map(h => (
                    <th key={h} style={{ ...th, textAlign: h === 'Total' || h === 'Status' || DAY_NAMES.some(n => h.startsWith(n)) ? 'center' : 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeklyRows.length === 0 ? (
                  <tr><td colSpan={isManager ? 15 : 13} style={{ textAlign: 'center', padding: '48px 18px', color: '#9ca3af', fontSize: 14 }}>
                    No entries for this week. Click "Log Daily Time" to add.
                  </td></tr>
                ) : weeklyRows.map((row, i) => (
                  <tr key={`${row.jobDbId}-${row.taskName}-${i}`} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={td}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#2563eb', background: '#dbeafe', padding: '2px 8px', borderRadius: 5 }}>
                        {row.jobIdDisplay}
                      </span>
                    </td>
                    {isManager && (
                      <td style={td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Avatar name={row.userName} size="xs" />
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>{row.userName}</span>
                        </div>
                      </td>
                    )}
                    <td style={{ ...td, color: '#6b7280', fontSize: 12 }}>{row.clientName}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{row.jobTitle}</td>
                    <td style={td}>{row.taskName}</td>
                    <td style={{ ...td, color: '#6b7280' }}>{row.taskType}</td>
                    {weekDays.map(day => {
                      const ymd = toYMD(day)
                      const h = row.dayHours[ymd] ?? 0
                      return (
                        <td key={ymd} style={{ ...tdNum, color: h > 0 ? '#1e293b' : '#d1d5db' }}>
                          {h > 0 ? `${h}` : '—'}
                        </td>
                      )
                    })}
                    <td style={{ ...tdNum, color: '#2563eb', fontWeight: 700 }}>{row.total.toFixed(1)}</td>
                    {isManager && (
                      <td style={{ ...td, textAlign: 'center' }}>
                        {row.hasFlag ? (
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                            <button
                              onClick={async () => {
                                setBusy(true)
                                for (const e of row.entries.filter(e => e.status === 'pending_approval')) {
                                  await approveEntry(e.id)
                                }
                                setBusy(false)
                              }}
                              disabled={busy}
                              style={{ padding: '3px 8px', borderRadius: 5, border: 'none', background: '#d1fae5', color: '#065f46', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }}
                            >
                              <Check size={10} /> All
                            </button>
                            <button
                              onClick={() => {
                                const firstPending = row.entries.find(e => e.status === 'pending_approval')
                                if (firstPending) setRejectModal({ id: firstPending.id })
                              }}
                              disabled={busy}
                              style={{ padding: '3px 8px', borderRadius: 5, border: 'none', background: '#fee2e2', color: '#991b1b', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }}
                            >
                              <X size={10} /> Reject
                            </button>
                          </div>
                        ) : (
                          <StatusPill status={row.entries[0]?.status ?? 'pending_normal'} />
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              {weeklyRows.length > 0 && (
                <tfoot>
                  <tr style={{ background: '#f9fafb' }}>
                    <td colSpan={isManager ? 6 : 5} style={{ ...td, fontWeight: 700, color: '#1e293b' }}>Total</td>
                    {weekDays.map(day => {
                      const ymd = toYMD(day)
                      const dayTotal = weeklyRows.reduce((s, r) => s + (r.dayHours[ymd] ?? 0), 0)
                      return <td key={ymd} style={{ ...tdNum, color: dayTotal > 0 ? '#2563eb' : '#d1d5db' }}>{dayTotal > 0 ? dayTotal.toFixed(1) : '—'}</td>
                    })}
                    <td style={{ ...tdNum, color: '#2563eb', fontWeight: 800 }}>
                      {weeklyRows.reduce((s, r) => s + r.total, 0).toFixed(1)}
                    </td>
                    {isManager && <td />}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* ── MONTHLY VIEW ── */}
        {activeTab === 'monthly' && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {[
                    'Job ID',
                    ...(isManager ? ['Employee'] : []),
                    'Client', 'Job', 'Task', 'Task Type',
                    ...monthWeeks.map(w => w.label),
                    'Total',
                  ].map(h => (
                    <th key={h} style={{ ...th, textAlign: h === 'Total' || h.startsWith('Week') ? 'center' : 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthlyRows.length === 0 ? (
                  <tr><td colSpan={(isManager ? 7 : 6) + monthWeeks.length} style={{ textAlign: 'center', padding: '48px 18px', color: '#9ca3af', fontSize: 14 }}>
                    No entries for this month. Click "Log Daily Time" to add.
                  </td></tr>
                ) : monthlyRows.map((row, i) => (
                  <tr key={`${row.jobDbId}-${row.taskName}-${i}`} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={td}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#2563eb', background: '#dbeafe', padding: '2px 8px', borderRadius: 5 }}>
                        {row.jobIdDisplay}
                      </span>
                    </td>
                    {isManager && (
                      <td style={td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Avatar name={row.userName} size="xs" />
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>{row.userName}</span>
                        </div>
                      </td>
                    )}
                    <td style={{ ...td, color: '#6b7280', fontSize: 12 }}>{row.clientName}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{row.jobTitle}</td>
                    <td style={td}>{row.taskName}</td>
                    <td style={{ ...td, color: '#6b7280' }}>{row.taskType}</td>
                    {row.weekHours.map((h, wi) => (
                      <td key={wi} style={{ ...tdNum, color: h > 0 ? '#1e293b' : '#d1d5db' }}>
                        {h > 0 ? h.toFixed(1) : '—'}
                      </td>
                    ))}
                    <td style={{ ...tdNum, color: '#2563eb', fontWeight: 700 }}>{row.total.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
              {monthlyRows.length > 0 && (
                <tfoot>
                  <tr style={{ background: '#f9fafb' }}>
                    <td colSpan={isManager ? 6 : 5} style={{ ...td, fontWeight: 700, color: '#1e293b' }}>Total</td>
                    {monthWeeks.map((_, wi) => {
                      const wTotal = monthlyRows.reduce((s, r) => s + (r.weekHours[wi] ?? 0), 0)
                      return <td key={wi} style={{ ...tdNum, color: wTotal > 0 ? '#2563eb' : '#d1d5db' }}>{wTotal > 0 ? wTotal.toFixed(1) : '—'}</td>
                    })}
                    <td style={{ ...tdNum, color: '#2563eb', fontWeight: 800 }}>
                      {monthlyRows.reduce((s, r) => s + r.total, 0).toFixed(1)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* Submit / Draft buttons
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, padding: '16px 20px', borderTop: '1px solid #f1f3f9' }}>
          <button style={{ padding: '9px 22px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', color: '#374151', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            DRAFT
          </button>
          <button style={{ padding: '9px 22px', border: 'none', borderRadius: 8, background: '#2563eb', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            Submit Weekly Timesheet
          </button>
        </div> */}
      </div>

      {/* ── Inline reject modal ── */}
      <Modal
        open={!!rejectModal}
        onClose={() => setRejectModal(null)}
        title="Reject Timesheet Entry"
        description="Provide a reason for rejection"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRejectModal(null)}>Cancel</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={busy}
              onClick={async () => {
                if (!rejectModal) return
                setBusy(true)
                await rejectEntry(rejectModal.id, rejectReason)
                setBusy(false)
                setRejectModal(null)
                setRejectReason('')
              }}
            >Reject</Button>
          </div>
        }
      >
        <textarea
          value={rejectReason}
          onChange={e => setRejectReason(e.target.value)}
          rows={3}
          placeholder="e.g., Hours seem incorrect. Please review and resubmit."
          className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-red-500/30 focus:border-red-500 resize-none"
        />
      </Modal>

      {/* ── Log Daily Time modal ── */}
      <Modal open={logDailyModal} onClose={resetLogModal} title="" size="xl">
        <div style={{ background: '#152035', borderRadius: 12, margin: -24, padding: 0, display: 'flex', minHeight: 440, overflow: 'hidden' }}>

          {/* Left panel — summary / logged entries */}
          <div style={{ width: 220, background: '#0f1a2e', padding: '32px 20px', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 18, marginBottom: 6 }}>Log Daily Time</h2>
            <p style={{ color: '#64748b', fontSize: 12, marginBottom: 28, lineHeight: 1.5 }}>Add time entries — multiple per day supported</p>

            {/* Hour warning */}
            {(() => {
              const selDate = dailyLog.date
              const existingHours = rawEntries.filter(e => e.userId === user?.id && e.date === selDate).reduce((s, e) => s + e.hours, 0)
              const addedHours = dailyEntries.filter(e => e.date === selDate).reduce((s, e) => s + e.hours, 0)
              const projected = Math.round((existingHours + addedHours) * 100) / 100
              if (projected === 0) return null
              const isUnder = projected < 8
              const isOver = projected > 8
              return (
                <div style={{ background: isOver ? '#7c1d1d30' : isUnder ? '#78350f30' : '#14532d30', border: `1px solid ${isOver ? '#ef444440' : isUnder ? '#f59e0b40' : '#22c55e40'}`, borderRadius: 8, padding: '10px 12px', marginBottom: 16 }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: isOver ? '#fca5a5' : isUnder ? '#fcd34d' : '#86efac' }}>{projected}h</div>
                  <div style={{ fontSize: 11, color: isOver ? '#fca5a5' : isUnder ? '#fcd34d' : '#86efac', marginTop: 2 }}>
                    {isOver ? 'Over 8h — needs approval' : isUnder ? 'Under 8h — needs approval' : 'On track'}
                  </div>
                </div>
              )
            })()}

            {/* Entries list */}
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
              Entries ({dailyEntries.length})
            </div>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {dailyEntries.length === 0 ? (
                <p style={{ color: '#334155', fontSize: 12, fontStyle: 'italic' }}>No entries yet</p>
              ) : dailyEntries.map(entry => (
                <div key={entry.id} style={{ background: '#152035', border: '1px solid #2d4068', borderRadius: 8, padding: '10px 10px 10px 12px', position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#60a5fa' }}>{entry.hours}h</span>
                    <button
                      onClick={() => setDailyEntries(dailyEntries.filter(e => e.id !== entry.id))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 2, display: 'flex', alignItems: 'center' }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: '#e2e8f0', fontWeight: 600, marginBottom: 2 }}>{entry.job}</div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>{entry.date}{entry.task ? ` • ${entry.task}` : ''}</div>
                  <div style={{ marginTop: 5 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 10, background: entry.billable ? '#14532d40' : '#1e293b', color: entry.billable ? '#86efac' : '#64748b' }}>
                      {entry.billable ? 'Billable' : 'Non-Bill'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Total */}
            {dailyEntries.length > 0 && (
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #1e2d4a' }}>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#60a5fa', marginTop: 2 }}>
                  {dailyEntries.reduce((s, e) => s + e.hours, 0)}h
                </div>
              </div>
            )}
          </div>

          {/* Right form area */}
          <div style={{ flex: 1, padding: '32px 28px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ color: '#fff', fontWeight: 600, fontSize: 16, marginBottom: 22 }}>New Time Entry</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
              {/* Date / Hours / Billable */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500, marginBottom: 5, display: 'block' }}>Date</label>
                  <input
                    type="date"
                    value={dailyLog.date}
                    onChange={e => setDailyLog({ ...dailyLog, date: e.target.value })}
                    style={{ width: '100%', padding: '10px 13px', background: '#1e2d4a', border: '1px solid #2d4068', borderRadius: 8, color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500, marginBottom: 5, display: 'block' }}>Hours</label>
                  <input
                    type="number"
                    step="0.5" min="0" max="24"
                    value={dailyLog.hours}
                    onChange={e => setDailyLog({ ...dailyLog, hours: e.target.value })}
                    style={{ width: '100%', padding: '10px 13px', background: '#1e2d4a', border: '1px solid #2d4068', borderRadius: 8, color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500, marginBottom: 5, display: 'block' }}>Billable</label>
                  <select
                    value={dailyLog.billable ? 'true' : 'false'}
                    onChange={e => setDailyLog({ ...dailyLog, billable: e.target.value === 'true' })}
                    style={{ width: '100%', padding: '10px 13px', background: '#1e2d4a', border: '1px solid #2d4068', borderRadius: 8, color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box', cursor: 'pointer' }}
                  >
                    <option value="true">Billable</option>
                    <option value="false">Non-Billable</option>
                  </select>
                </div>
              </div>

              {/* Job */}
              <div>
                <label style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500, marginBottom: 5, display: 'block' }}>Job</label>
                <select
                  value={dailyLog.jobId}
                  onChange={e => {
                    const sel = jobs.find(j => j.id === e.target.value)
                    setDailyLog({ ...dailyLog, jobId: e.target.value, job: sel?.title ?? '', client: sel?.clientName ?? '', taskId: '', task: '' })
                  }}
                  style={{ width: '100%', padding: '10px 13px', background: '#1e2d4a', border: '1px solid #2d4068', borderRadius: 8, color: dailyLog.jobId ? '#fff' : '#64748b', fontSize: 14, outline: 'none', boxSizing: 'border-box', cursor: 'pointer' }}
                >
                  <option value="">Select job...</option>
                  {jobs
                    .filter(j => {
                      // For managers/admins, show all active jobs
                      if (isManager) return j.status === 'in_progress' || j.status === 'open'
                      // For employees, only show jobs they have tasks assigned to
                      return (j.status === 'in_progress' || j.status === 'open') && 
                             accessibleJobIds?.includes(j.id)
                    })
                    .map(j => (
                      <option key={j.id} value={j.id}>
                        {j.jobId} — {j.title} ({j.clientName})
                      </option>
                    ))}
                </select>
              </div>

            
             {/* Task + Client (auto) */}
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
  <div>
    <label style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500, marginBottom: 5, display: 'block' }}>Task (optional)</label>
    <select
      value={dailyLog.taskId}
      disabled={!dailyLog.jobId}
      onChange={e => {
        const sel = tasks.find(t => t.id === e.target.value)
        setDailyLog({ ...dailyLog, taskId: e.target.value, task: sel?.name ?? '' })
      }}
      style={{ width: '100%', padding: '10px 13px', background: dailyLog.jobId ? '#1e2d4a' : '#1a2540', border: '1px solid #2d4068', borderRadius: 8, color: dailyLog.jobId ? '#fff' : '#475569', fontSize: 14, outline: 'none', boxSizing: 'border-box', cursor: dailyLog.jobId ? 'pointer' : 'not-allowed' }}
    >
      <option value="">{dailyLog.jobId ? 'Select task...' : 'Select a job first'}</option>
      {tasks
        .filter(t => {
          // First filter by job
          if (t.jobId !== dailyLog.jobId) return false
          
          // For managers, show all tasks for this job
          if (isManager) return true
          
          // For employees, only show tasks assigned to them
          return t.assignedToIds?.includes(user?.id || '')
        })
        .map(t => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
    </select>
  </div>
  <div>
    <label style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500, marginBottom: 5, display: 'block' }}>Client (auto-filled)</label>
    <div style={{ width: '100%', padding: '10px 13px', background: '#1a2540', border: '1px solid #2d4068', borderRadius: 8, color: dailyLog.client ? '#94a3b8' : '#475569', fontSize: 14, boxSizing: 'border-box', minHeight: 42 }}>
      {dailyLog.client || 'Auto-filled from job'}
    </div>
  </div>
</div>
             {/* Notes */}
<div>
  <label style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500, marginBottom: 5, display: 'block' }}>Notes (optional)</label>
  <input
    type="text"
    placeholder="Add any notes..."
    value={dailyLog.notes || ''}
    onChange={e => setDailyLog({ ...dailyLog, notes: e.target.value })}
    style={{ width: '100%', padding: '10px 13px', background: '#1e2d4a', border: '1px solid #2d4068', borderRadius: 8, color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
  />
</div>
            </div>

            {/* Footer buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24, paddingTop: 20, borderTop: '1px solid #1e2d4a' }}>
              <button
                onClick={resetLogModal}
                style={{ padding: '10px 22px', border: '1px solid #2d4068', borderRadius: 8, background: 'transparent', color: '#94a3b8', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
              >
                CANCEL
              </button>
              <button
                onClick={() => {
                  if (dailyLog.hours && dailyLog.jobId) {
                    setDailyEntries([...dailyEntries, {
                      id: `entry-${Date.now()}`,
                      date: dailyLog.date,
                      hours: parseFloat(dailyLog.hours),
                      client: dailyLog.client,
                      jobId: dailyLog.jobId,
                      job: dailyLog.job,
                      taskId: dailyLog.taskId,
                      task: dailyLog.task,
                      notes: dailyLog.notes,
                      billable: dailyLog.billable,
                    }])
                    setDailyLog(prev => ({ ...prev, jobId: '', job: '', client: '', taskId: '', task: '',  notes: '', hours: '8' }))
                  }
                }}
                style={{ padding: '10px 22px', borderRadius: 8, background: '#1e2d4a', color: '#60a5fa', fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #2d4068' } as React.CSSProperties}
              >
                <Plus size={15} /> ADD ENTRY
              </button>
              {dailyEntries.length > 0 && (
                <button
                  disabled={submitting}
                  onClick={async () => {
                    if (!user?.id) return
                    setSubmitting(true)
                    try {
                      for (const entry of dailyEntries) {
                        if (entry.jobId) {
                          await logTime({
                            userId: user.id,
                            jobId: entry.jobId,
                            taskId: entry.taskId || undefined,
                            date: entry.date,
                            hours: entry.hours,
                            description: entry.notes ||entry.task || entry.job,
                            billable: entry.billable,
                          } as any)
                        }
                      }
                    } finally {
                      setSubmitting(false)
                    }
                    resetLogModal()
                  }}
                  style={{ padding: '10px 28px', border: 'none', borderRadius: 8, background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: 14, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}
                >
                  {submitting ? 'Submitting...' : 'SUBMIT ALL'}
                </button>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}