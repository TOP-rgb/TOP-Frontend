import { useState, useMemo, useEffect } from 'react'
import {
  Bell, BellOff, CheckSquare, AlertTriangle, FileText,
  UserPlus, Clock, CheckCircle, Filter, Inbox,
  AlertCircle, ChevronRight, ScanLine,
} from 'lucide-react'
import { useSettingsStore } from '@/store/settingsStore'
import { useAuthStore } from '@/store/authStore'
import { useJobs } from '@/hooks/useJobs'
import { useInvoices } from '@/hooks/useInvoices'
import { useUsers } from '@/hooks/useUsers'
import { useTimesheets } from '@/hooks/useTimesheets'
import { useTasks } from '@/hooks/useTasks'
import { useLeaves } from '@/hooks/useLeaves'
import { useAttendanceManager } from '@/hooks/useAttendanceManager'
import { formatDateWithSettings } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

type NotifCategory = 'all' | 'timesheets' | 'jobs' | 'invoices' | 'team' | 'attendance'

interface NotifItem {
  id: string
  category: Exclude<NotifCategory, 'all'>
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  title: string
  description: string
  meta: string
  severity: 'info' | 'warning' | 'error'
  enabled: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysDiff(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000)
}

function daysAgo(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
}

// ── Category pill ─────────────────────────────────────────────────────────────

const CATEGORY_STYLES: Record<Exclude<NotifCategory, 'all'>, { bg: string; text: string; border: string }> = {
  timesheets: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  jobs:       { bg: '#fff7ed', text: '#c2410c', border: '#fdba74' },
  invoices:   { bg: '#fff1f2', text: '#be123c', border: '#fecdd3' },
  team:       { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  attendance: { bg: '#f0f9ff', text: '#0369a1', border: '#bae6fd' },
}

function CategoryPill({ category }: { category: Exclude<NotifCategory, 'all'> }) {
  const s = CATEGORY_STYLES[category]
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
      background: s.bg, color: s.text, border: `1px solid ${s.border}`,
      textTransform: 'uppercase', letterSpacing: '0.05em',
    }}>
      {category}
    </span>
  )
}

// ── Severity dot ──────────────────────────────────────────────────────────────

const SEVERITY_DOT: Record<NotifItem['severity'], string> = {
  error:   '#ef4444',
  warning: '#f59e0b',
  info:    '#3b82f6',
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function Notifications() {
  const { user } = useAuthStore()
  const isManager = user?.role !== 'employee'
  const {
    dateFormat,
    notifyTimesheetApproval, notifyFlaggedTimesheets,
    notifyJobDeadline, notifyInvoiceOverdue, overdueInvoiceDays,
    notifyNewUser,
  } = useSettingsStore()

  const { jobs } = useJobs()
  const { tasks } = useTasks()
  const { invoices } = useInvoices()
  const { users } = useUsers()
  const { entries: allEntries, pendingEntries } = useTimesheets(isManager ? {} : { userId: user?.id })
  const leaves = useLeaves()
  const attendanceMgr = useAttendanceManager()

  // Fetch attendance data for notifications
  useEffect(() => {
    if (isManager) {
      attendanceMgr.fetchExceptions({ isReviewed: false, limit: 100 })
      attendanceMgr.fetchPendingRegularizations()
      leaves.fetchPendingLeaves()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isManager])

  // Employees only see jobs linked to their assigned tasks
  const myJobIds = !isManager
    ? tasks.filter(t => t.assignedToIds?.includes(user?.id ?? '')).map(t => t.jobId)
    : null

  const [activeCategory, setActiveCategory] = useState<NotifCategory>('all')

  // ── Build notification items from live data ───────────────────────────────

  const notifications = useMemo<NotifItem[]>(() => {
    const items: NotifItem[] = []

    // ── TIMESHEETS: pending approvals ────────────────────────────────────────
    if (isManager) {
      pendingEntries.forEach(e => {
        items.push({
          id: `ts-approval-${e.id}`,
          category: 'timesheets',
          icon: <Clock size={16} />,
          iconBg: '#dbeafe', iconColor: '#1d4ed8',
          title: `Timesheet pending approval`,
          description: `${e.userName} · ${e.jobTitle}${e.taskName ? ` · ${e.taskName}` : ''} · ${e.hours}h`,
          meta: formatDateWithSettings(e.date, dateFormat),
          severity: 'warning',
          enabled: notifyTimesheetApproval,
        })
      })
    }

    // ── TIMESHEETS: flagged entries ──────────────────────────────────────────
    const flagged = allEntries.filter(e => e.flagReason && e.status === 'pending_approval')
    if (isManager) {
      flagged.forEach(e => {
        const reasonLabel =
          e.flagReason === 'OVER_HOURS'    ? 'Over daily hours' :
          e.flagReason === 'UNDER_HOURS'   ? 'Under daily hours' :
          e.flagReason === 'JOB_OVERTIME'  ? 'Job exceeded quoted hours' :
          e.flagReason === 'MULTIPLE'      ? 'Multiple flags' : 'Flagged for review'
        items.push({
          id: `ts-flag-${e.id}`,
          category: 'timesheets',
          icon: <AlertCircle size={16} />,
          iconBg: '#fef3c7', iconColor: '#d97706',
          title: `Flagged: ${reasonLabel}`,
          description: `${e.userName} · ${e.jobTitle} · ${e.hours}h`,
          meta: formatDateWithSettings(e.date, dateFormat),
          severity: 'warning',
          enabled: notifyFlaggedTimesheets,
        })
      })
    }

    // ── JOBS: approaching/past deadline ──────────────────────────────────────
    // Employees only see jobs that have tasks assigned to them
    const deadlineJobs = jobs.filter(j => {
      if (!j.deadline) return false
      if (['completed', 'invoiced', 'closed'].includes(j.status)) return false
      if (myJobIds && !myJobIds.includes(j.id)) return false   // employee filter
      return daysDiff(j.deadline) <= 7
    }).sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())

    deadlineJobs.forEach(j => {
      const diff = daysDiff(j.deadline!)
      const isOverdue = diff < 0
      items.push({
        id: `job-dl-${j.id}`,
        category: 'jobs',
        icon: <AlertTriangle size={16} />,
        iconBg: isOverdue ? '#fee2e2' : '#fff7ed',
        iconColor: isOverdue ? '#dc2626' : '#ea580c',
        title: isOverdue ? `Job overdue by ${Math.abs(diff)} day${Math.abs(diff) !== 1 ? 's' : ''}` : `Job deadline in ${diff} day${diff !== 1 ? 's' : ''}`,
        description: `${j.jobId} · ${j.title} · ${j.clientName}`,
        meta: `Due: ${formatDateWithSettings(j.deadline!, dateFormat)}`,
        severity: isOverdue ? 'error' : diff <= 2 ? 'error' : 'warning',
        enabled: notifyJobDeadline,
      })
    })

    // ── INVOICES: overdue — managers/admins only ─────────────────────────────
    const overdueInvoices = isManager ? invoices.filter(inv => {
      if (inv.status === 'paid' || inv.status === 'cancelled') return false
      const cutoff = new Date(inv.dueDate)
      cutoff.setDate(cutoff.getDate() + (overdueInvoiceDays ?? 0))
      return cutoff < new Date()
    }) : []

    overdueInvoices.forEach(inv => {
      const diff = Math.abs(daysDiff(inv.dueDate))
      items.push({
        id: `inv-od-${inv.id}`,
        category: 'invoices',
        icon: <FileText size={16} />,
        iconBg: '#fff1f2', iconColor: '#dc2626',
        title: `Invoice overdue by ${diff} day${diff !== 1 ? 's' : ''}`,
        description: `${inv.invoiceNumber} · ${inv.clientCompany}`,
        meta: `Due: ${formatDateWithSettings(inv.dueDate, dateFormat)}`,
        severity: 'error',
        enabled: notifyInvoiceOverdue,
      })
    })

    // ── TEAM: new users — managers/admins only ───────────────────────────────
    const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const newUsers = isManager
      ? users.filter(u => u.joinedDate && new Date(u.joinedDate) >= sevenDaysAgo)
      : []

    newUsers.forEach(u => {
      const ago = daysAgo(u.joinedDate)
      items.push({
        id: `user-new-${u.id}`,
        category: 'team',
        icon: <UserPlus size={16} />,
        iconBg: '#f0fdf4', iconColor: '#16a34a',
        title: `New team member joined`,
        description: `${u.name} · ${u.role.charAt(0).toUpperCase() + u.role.slice(1)}${u.department ? ` · ${u.department}` : ''}`,
        meta: ago === 0 ? 'Today' : ago === 1 ? 'Yesterday' : `${ago} days ago`,
        severity: 'info',
        enabled: notifyNewUser,
      })
    })

    // ── ATTENDANCE: manager view ─────────────────────────────────────────────
    if (isManager) {
      // Pending leave requests — one notification per request
      leaves.pendingLeaves.forEach(lr => {
        const userName = lr.user ? `${lr.user.firstName} ${lr.user.lastName}`.trim() : 'Employee'
        const typeName = lr.leaveType?.name ?? 'Leave'
        const days = lr.days
        items.push({
          id: `att-leave-${lr.id}`,
          category: 'attendance',
          icon: <ScanLine size={16} />,
          iconBg: '#e0f2fe', iconColor: '#0284c7',
          title: 'Leave request pending approval',
          description: `${userName} · ${typeName} · ${days} day${days !== 1 ? 's' : ''}`,
          meta: `${lr.startDate.slice(0, 10)} → ${lr.endDate.slice(0, 10)}`,
          severity: 'warning',
          enabled: true,
        })
      })

      // Unreviewed exceptions — grouped as a single notification
      const unreviewedCount = attendanceMgr.exceptions.filter(e => !e.isReviewed).length
      if (unreviewedCount > 0) {
        items.push({
          id: 'att-exceptions',
          category: 'attendance',
          icon: <AlertCircle size={16} />,
          iconBg: '#fef3c7', iconColor: '#d97706',
          title: `${unreviewedCount} unreviewed attendance exception${unreviewedCount !== 1 ? 's' : ''}`,
          description: 'Late arrivals, early departures, missed checkouts, or location violations',
          meta: 'Review in Attendance → Exceptions',
          severity: 'warning',
          enabled: true,
        })
      }

      // Pending regularizations — grouped as a single notification
      const regCount = attendanceMgr.pendingRegularizations.length
      if (regCount > 0) {
        items.push({
          id: 'att-regularizations',
          category: 'attendance',
          icon: <Clock size={16} />,
          iconBg: '#dbeafe', iconColor: '#1d4ed8',
          title: `${regCount} attendance regularization${regCount !== 1 ? 's' : ''} pending review`,
          description: 'Employees requesting correction to their attendance records',
          meta: 'Review in Attendance → Regularizations',
          severity: 'info',
          enabled: true,
        })
      }
    }

    // ── ATTENDANCE: employee leave status updates (last 30 days) ────────────
    if (!isManager) {
      const thirtyDaysAgo = Date.now() - 30 * 86_400_000
      leaves.myLeaves
        .filter(lr =>
          (lr.status === 'APPROVED' || lr.status === 'REJECTED') &&
          new Date(lr.updatedAt).getTime() > thirtyDaysAgo
        )
        .forEach(lr => {
          const typeName = lr.leaveType?.name ?? 'Leave'
          const days = lr.days
          const isApproved = lr.status === 'APPROVED'
          items.push({
            id: `att-my-leave-${lr.id}`,
            category: 'attendance',
            icon: <ScanLine size={16} />,
            iconBg: isApproved ? '#f0fdf4' : '#fff1f2',
            iconColor: isApproved ? '#16a34a' : '#dc2626',
            title: `Leave request ${isApproved ? 'approved' : 'rejected'}`,
            description: `${typeName} · ${days} day${days !== 1 ? 's' : ''}`,
            meta: `${lr.startDate.slice(0, 10)} → ${lr.endDate.slice(0, 10)}`,
            severity: isApproved ? 'info' : 'warning',
            enabled: true,
          })
        })
    }

    return items
  }, [
    pendingEntries, allEntries, jobs, invoices, users, tasks, isManager, myJobIds,
    dateFormat, overdueInvoiceDays,
    notifyTimesheetApproval, notifyFlaggedTimesheets,
    notifyJobDeadline, notifyInvoiceOverdue, notifyNewUser,
    leaves.pendingLeaves, leaves.myLeaves,
    attendanceMgr.exceptions, attendanceMgr.pendingRegularizations,
  ])

  // Enabled items only
  const enabledItems = notifications.filter(n => n.enabled)
  const filtered = activeCategory === 'all'
    ? enabledItems
    : enabledItems.filter(n => n.category === activeCategory)

  // Count per category (enabled)
  const counts: Record<NotifCategory, number> = {
    all:        enabledItems.length,
    timesheets: enabledItems.filter(n => n.category === 'timesheets').length,
    jobs:       enabledItems.filter(n => n.category === 'jobs').length,
    invoices:   enabledItems.filter(n => n.category === 'invoices').length,
    team:       enabledItems.filter(n => n.category === 'team').length,
    attendance: enabledItems.filter(n => n.category === 'attendance').length,
  }

  // Disabled flag summary — only show flags relevant to the user's role
  const disabledFlags = [
    isManager && !notifyTimesheetApproval && 'Timesheet Approvals',
    isManager && !notifyFlaggedTimesheets && 'Flagged Timesheets',
    !notifyJobDeadline                    && 'Job Deadlines',
    isManager && !notifyInvoiceOverdue    && 'Invoice Overdue',
    isManager && !notifyNewUser           && 'New Users',
  ].filter(Boolean) as string[]

  const tabs: { key: NotifCategory; label: string }[] = [
    { key: 'all',        label: 'All' },
    { key: 'timesheets', label: 'Timesheets' },
    { key: 'jobs',       label: 'Jobs' },
    { key: 'invoices',   label: 'Invoices' },
    { key: 'team',       label: 'Team' },
    { key: 'attendance', label: 'Attendance' },
  ]

  return (
    <div style={{ fontFamily: 'inherit', maxWidth: 860, width: '100%', padding: '0' }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
        <div>
          <h1 className="text-slate-900 dark:text-slate-100" style={{ fontSize: 22, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Bell size={20} color="#2563eb" />
            Notifications
          </h1>
          <p className="text-slate-500 dark:text-slate-400" style={{ fontSize: 13, margin: '4px 0 0' }}>
            {enabledItems.length > 0
              ? `${enabledItems.length} active notification${enabledItems.length !== 1 ? 's' : ''} across all modules`
              : 'No active notifications'}
          </p>
        </div>
        {enabledItems.length > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700/50 rounded-lg text-xs font-semibold text-blue-700 dark:text-blue-400">
            <Bell size={13} />
            {counts.all} unread
          </div>
        )}
      </div>

      {/* ── Disabled flags notice ── */}
      {disabledFlags.length > 0 && (
        <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300" style={{ borderRadius: 10, padding: '10px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <BellOff size={15} color="#94a3b8" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 12 }}>
            <strong>{disabledFlags.length}</strong> notification type{disabledFlags.length > 1 ? 's' : ''} disabled in Settings:{' '}
            {disabledFlags.join(', ')}.{' '}
            <a href="/settings" className="text-blue-600 dark:text-blue-400 underline">
              Manage in Settings → Notifications
            </a>
          </span>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700" style={{ borderRadius: 12, overflow: 'hidden' }}>
        <div className="hide-scrollbar border-b border-slate-100 dark:border-slate-700" style={{ display: 'flex', padding: '0 4px', overflowX: 'auto' }}>
          {tabs.map(tab => {
            const isActive = activeCategory === tab.key
            const count = counts[tab.key]
            return (
              <button
                key={tab.key}
                onClick={() => setActiveCategory(tab.key)}
                className={isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}
                style={{
                  padding: '14px 16px', border: 'none', background: 'transparent', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600,
                  borderBottom: `2px solid ${isActive ? '#2563eb' : 'transparent'}`,
                  display: 'flex', alignItems: 'center', gap: 6,
                  transition: 'color .15s',
                }}
              >
                {tab.label}
                {count > 0 && (
                  <span
                    className={isActive ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}
                    style={{ fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 20 }}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* ── Notification list ── */}
        {filtered.length === 0 ? (
          <div className="text-slate-400 dark:text-slate-500" style={{ padding: '40px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div className="bg-slate-50 dark:bg-slate-700/50" style={{ width: 52, height: 52, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Inbox size={24} color="#d1d5db" />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div className="text-slate-500 dark:text-slate-400" style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>All clear!</div>
              <div style={{ fontSize: 13 }}>
                {activeCategory === 'all'
                  ? 'No active notifications right now.'
                  : `No ${activeCategory} notifications right now.`}
              </div>
            </div>
          </div>
        ) : (
          <div>
            {filtered.map((item, i) => (
              <div
                key={item.id}
                className={[
                  item.severity === 'error' ? 'bg-red-50/60 dark:bg-red-900/10' : 'bg-white dark:bg-slate-800',
                  i > 0 ? 'border-t border-slate-100 dark:border-slate-700/50' : '',
                ].join(' ')}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '12px 16px', transition: 'background .15s' }}
              >
                {/* Icon */}
                <div style={{
                  width: 36, height: 36, borderRadius: 9,
                  background: item.iconBg, color: item.iconColor,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {item.icon}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: SEVERITY_DOT[item.severity],
                      display: 'inline-block', flexShrink: 0,
                    }} />
                    <span className="text-slate-900 dark:text-slate-100" style={{ fontSize: 13, fontWeight: 600 }}>{item.title}</span>
                    <CategoryPill category={item.category} />
                  </div>
                  <div className="text-slate-500 dark:text-slate-400" style={{ fontSize: 12, marginBottom: 2 }}>{item.description}</div>
                  <div className="text-slate-400 dark:text-slate-500" style={{ fontSize: 11 }}>{item.meta}</div>
                </div>

                {/* Chevron */}
                <ChevronRight size={15} color="#d1d5db" style={{ flexShrink: 0, marginTop: 4 }} />
              </div>
            ))}
          </div>
        )}

        {/* ── Footer ── */}
        {filtered.length > 0 && (
          <div className="border-t border-slate-100 dark:border-slate-700/50" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <span className="text-slate-400 dark:text-slate-500" style={{ fontSize: 12 }}>
              Showing {filtered.length} notification{filtered.length !== 1 ? 's' : ''}
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(['timesheets', 'jobs', 'invoices', 'team', 'attendance'] as const).map(cat => {
                const count = counts[cat]
                if (count === 0) return null
                return (
                  <span key={cat} style={{
                    fontSize: 11, padding: '3px 9px', borderRadius: 20, fontWeight: 600,
                    background: CATEGORY_STYLES[cat].bg,
                    color: CATEGORY_STYLES[cat].text,
                    border: `1px solid ${CATEGORY_STYLES[cat].border}`,
                  }}>
                    {cat} {count}
                  </span>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Settings shortcut ── */}
      <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300" style={{ marginTop: 20, padding: '14px 18px', borderRadius: 10, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
        <Filter size={15} color="#64748b" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 12, flex: 1 }}>
          Manage which notifications are active in{' '}
          <a href="/settings" className="font-semibold text-blue-600 dark:text-blue-400 no-underline">
            Settings → Notifications
          </a>
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {([
            isManager ? { label: 'Timesheets', active: notifyTimesheetApproval || notifyFlaggedTimesheets } : null,
                        { label: 'Jobs',       active: notifyJobDeadline },
            isManager ? { label: 'Invoices',   active: notifyInvoiceOverdue } : null,
            isManager ? { label: 'Team',       active: notifyNewUser }        : null,
                        { label: 'Attendance', active: true },
          ].filter(Boolean) as { label: string; active: boolean }[]).map(f => (
            <span key={f.label} className={f.active ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'} style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600,
            }}>
              {f.active ? <CheckCircle size={9} style={{ display: 'inline', marginRight: 3 }} /> : null}
              {f.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
