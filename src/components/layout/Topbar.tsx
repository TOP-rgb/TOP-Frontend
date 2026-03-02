import { Bell, Search, LogOut, Building2 } from 'lucide-react'
import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { useSettingsStore } from '@/store/settingsStore'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { cn, formatDateWithSettings } from '@/lib/utils'
import type { UserRole } from '@/types'
import { useJobs } from '@/hooks/useJobs'
import { useInvoices } from '@/hooks/useInvoices'
import { useUsers } from '@/hooks/useUsers'
import { useTimesheets } from '@/hooks/useTimesheets'
import { useTasks } from '@/hooks/useTasks'

const roleLabels: Record<UserRole, string> = {
  employee: 'Processor',
  manager:  'Manager',
  admin:    'Senior Manager',
}

const roleBadgeVariants: Record<UserRole, 'secondary' | 'default' | 'danger'> = {
  employee: 'secondary',
  manager:  'default',
  admin:    'danger',
}

const notifIcons: Record<string, string> = {
  approval:  '⏳',
  alert:     '⚠️',
  invoice:   '📄',
  user:      '👤',
  timesheet: '🕐',
}

export function Topbar({ pageTitle }: { pageTitle?: string }) {
  const { user, logout } = useAuthStore()
  const { sidebarCollapsed } = useUIStore()
  const {
    orgName, dateFormat,
    notifyTimesheetApproval, notifyInvoiceOverdue,
    notifyFlaggedTimesheets, notifyJobDeadline,
    notifyNewUser, overdueInvoiceDays,
  } = useSettingsStore()
  const navigate = useNavigate()
  const [notifOpen, setNotifOpen] = useState(false)
  const [search,    setSearch]    = useState('')

  const sidebarW = sidebarCollapsed ? 76 : 260
  const isManager = user?.role !== 'employee'

  // ── Real data hooks ───────────────────────────────────────────────────────
  const { jobs }                          = useJobs()
  const { tasks }                         = useTasks()
  const { entries: allEntries, pendingEntries } = useTimesheets(isManager ? {} : { userId: user?.id })
  // Invoices + users only fetched/used for managers — but hooks must be called unconditionally (React rules)
  const { invoices }  = useInvoices()
  const { users }     = useUsers()

  // For employees: only show jobs linked to their assigned tasks
  const myJobIds = !isManager
    ? tasks.filter(t => t.assignedToIds?.includes(user?.id ?? '')).map(t => t.jobId)
    : null

  // ── Build real notification items ─────────────────────────────────────────
  const allNotifications = useMemo(() => {
    const items: { id: string; text: string; time: string; unread: boolean; type: string }[] = []

    // Pending timesheet approvals — managers/admins only
    if (isManager && notifyTimesheetApproval) {
      pendingEntries.slice(0, 5).forEach(e => {
        items.push({
          id:     `ts-${e.id}`,
          text:   `${e.userName} · ${e.hours}h on "${e.jobTitle}" pending approval`,
          time:   formatDateWithSettings(e.date, dateFormat),
          unread: true,
          type:   'approval',
        })
      })
    }

    // Flagged timesheets — managers/admins only
    if (isManager && notifyFlaggedTimesheets) {
      allEntries
        .filter(e => e.flagReason && e.status === 'pending_approval')
        .slice(0, 3)
        .forEach(e => {
          const label =
            e.flagReason === 'OVER_HOURS'   ? 'over daily hours' :
            e.flagReason === 'UNDER_HOURS'  ? 'under daily hours' :
            e.flagReason === 'JOB_OVERTIME' ? 'job overtime' : 'flagged'
          items.push({
            id:     `flag-${e.id}`,
            text:   `${e.userName} timesheet flagged (${label}) · ${e.hours}h`,
            time:   formatDateWithSettings(e.date, dateFormat),
            unread: false,
            type:   'timesheet',
          })
        })
    }

    // Job deadlines — all roles, but employees only see their assigned jobs
    if (notifyJobDeadline) {
      const visibleJobs = myJobIds
        ? jobs.filter(j => myJobIds.includes(j.id))
        : jobs
      visibleJobs
        .filter(j => {
          if (!j.deadline) return false
          if (['completed', 'invoiced', 'closed'].includes(j.status)) return false
          const diff = Math.ceil((new Date(j.deadline).getTime() - Date.now()) / 86_400_000)
          return diff <= 7
        })
        .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
        .slice(0, 4)
        .forEach(j => {
          const diff = Math.ceil((new Date(j.deadline!).getTime() - Date.now()) / 86_400_000)
          const isOD = diff < 0
          items.push({
            id:     `job-${j.id}`,
            text:   `${j.title} — ${isOD ? `overdue by ${Math.abs(diff)}d` : diff === 0 ? 'due today' : `due in ${diff}d`}`,
            time:   formatDateWithSettings(j.deadline!, dateFormat),
            unread: isOD,
            type:   'alert',
          })
        })
    }

    // Overdue invoices — managers/admins only
    if (isManager && notifyInvoiceOverdue) {
      invoices
        .filter(inv => {
          if (inv.status === 'paid' || inv.status === 'cancelled') return false
          const cutoff = new Date(inv.dueDate)
          cutoff.setDate(cutoff.getDate() + (overdueInvoiceDays ?? 0))
          return cutoff < new Date()
        })
        .slice(0, 3)
        .forEach(inv => {
          const diff = Math.abs(Math.ceil((new Date(inv.dueDate).getTime() - Date.now()) / 86_400_000))
          items.push({
            id:     `inv-${inv.id}`,
            text:   `Invoice ${inv.invoiceNumber} overdue ${diff}d · ${inv.clientCompany}`,
            time:   formatDateWithSettings(inv.dueDate, dateFormat),
            unread: true,
            type:   'invoice',
          })
        })
    }

    // New users — managers/admins only
    if (isManager && notifyNewUser) {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      users
        .filter(u => u.joinedDate && new Date(u.joinedDate) >= sevenDaysAgo)
        .slice(0, 3)
        .forEach(u => {
          items.push({
            id:     `user-${u.id}`,
            text:   `${u.name} joined as ${u.role}`,
            time:   u.joinedDate ?? '',
            unread: false,
            type:   'user',
          })
        })
    }

    return items
  }, [
    pendingEntries, allEntries, jobs, invoices, users, tasks,
    isManager, myJobIds,
    notifyTimesheetApproval, notifyFlaggedTimesheets, notifyJobDeadline,
    notifyInvoiceOverdue, notifyNewUser, overdueInvoiceDays,
    dateFormat,
  ])

  const unreadCount = allNotifications.filter(n => n.unread).length

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header
      className="fixed top-0 right-0 z-30 h-[60px] bg-white border-b border-slate-200/80 flex items-center px-5 gap-4 shadow-sm"
      style={{
        left: `${sidebarW}px`,
        right: 0,
        transition: 'left 300ms ease-in-out'
      }}
    >
      {/* Org name + page title */}
      <div className="hidden sm:flex items-center gap-2 min-w-0">
        {orgName && (
          <>
            <Building2 size={14} className="text-slate-400 flex-shrink-0" />
            <span className="text-xs font-semibold text-slate-500 truncate max-w-[120px]">{orgName}</span>
            {pageTitle && <span className="text-slate-300">/</span>}
          </>
        )}
        {pageTitle && (
          <h1 className="text-sm font-bold text-slate-800 leading-none truncate">{pageTitle}</h1>
        )}
      </div>

      <div className="flex-1" />

      {/* Search */}
      <div className="hidden md:flex items-center gap-2 bg-slate-50 ring-1 ring-slate-200 hover:ring-slate-300 rounded-lg px-3 h-9 w-56 transition-all focus-within:ring-2 focus-within:ring-blue-500/40 focus-within:bg-white">
        <Search size={14} className="text-slate-400 flex-shrink-0" />
        <input
          placeholder="Search anything..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-transparent text-sm text-slate-600 placeholder:text-slate-400 focus:outline-none w-full"
          aria-label="Global search"
        />
      </div>

      {/* Notifications bell — shown if any type is enabled */}
      <div className="relative">
        <button
          onClick={() => setNotifOpen(v => !v)}
          aria-label={`${unreadCount} unread notifications`}
          className="relative w-9 h-9 flex items-center justify-center hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700 transition-colors"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none ring-2 ring-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {notifOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setNotifOpen(false)} />
            <div className="absolute right-0 top-[calc(100%+8px)] z-20 bg-white rounded-xl border border-slate-200 shadow-xl w-80 ring-1 ring-black/5 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
                <p className="font-semibold text-sm text-slate-800">Notifications</p>
                {unreadCount > 0 && <Badge variant="danger" dot>{unreadCount} new</Badge>}
              </div>

              {allNotifications.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-slate-400">
                  <Bell size={22} className="opacity-30" />
                  <span className="text-xs font-medium">No active notifications</span>
                </div>
              ) : (
                <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
                  {allNotifications.map(n => (
                    <div key={n.id} className={cn(
                      'flex gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors',
                      n.unread && 'bg-blue-50/40'
                    )}>
                      <span className="text-base flex-shrink-0">{notifIcons[n.type] ?? '🔔'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-700 leading-snug">{n.text}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{n.time}</p>
                      </div>
                      {n.unread && <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1" />}
                    </div>
                  ))}
                </div>
              )}

              <div className="px-4 py-2.5 border-t border-slate-100 text-center">
                <button
                  onClick={() => { setNotifOpen(false); navigate('/notifications') }}
                  className="text-xs text-blue-600 font-semibold hover:text-blue-700"
                >
                  View all notifications →
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* User + Logout */}
      {user && (
        <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
          <Avatar name={user.name} size="sm" />
          <div className="hidden sm:block">
            <p className="text-xs font-semibold text-slate-800 leading-none">{user.name}</p>
            <div className="mt-0.5">
              <Badge variant={roleBadgeVariants[user.role]}>{roleLabels[user.role]}</Badge>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="ml-1 p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
          >
            <LogOut size={15} />
          </button>
        </div>
      )}
    </header>
  )
}
