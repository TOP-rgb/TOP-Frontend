import { Bell, Search, LogOut, Building2, Briefcase, CheckSquare, FileText, Users2, UserCircle2, X, Menu } from 'lucide-react'
import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { useSettingsStore } from '@/store/settingsStore'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { cn, formatDateWithSettings } from '@/lib/utils'
import { useIsMobile } from '@/hooks/useIsMobile'
import type { UserRole } from '@/types'
import { useJobs } from '@/hooks/useJobs'
import { useInvoices } from '@/hooks/useInvoices'
import { useUsers } from '@/hooks/useUsers'
import { useTimesheets } from '@/hooks/useTimesheets'
import { useTasks } from '@/hooks/useTasks'
import { useClients } from '@/hooks/useClients'

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

// ── Search result type ────────────────────────────────────────────────────────
type SearchCategory = 'Job' | 'Task' | 'Invoice' | 'Client' | 'User'

interface SearchResult {
  id: string
  category: SearchCategory
  title: string
  subtitle: string
  path: string
}

const categoryMeta: Record<SearchCategory, { icon: React.ReactNode; color: string; bg: string }> = {
  Job:     { icon: <Briefcase size={13} />,    color: '#2563eb', bg: '#eff6ff' },
  Task:    { icon: <CheckSquare size={13} />,  color: '#7c3aed', bg: '#f5f3ff' },
  Invoice: { icon: <FileText size={13} />,     color: '#059669', bg: '#ecfdf5' },
  Client:  { icon: <Users2 size={13} />,       color: '#d97706', bg: '#fffbeb' },
  User:    { icon: <UserCircle2 size={13} />,  color: '#0891b2', bg: '#ecfeff' },
}

function matchStr(haystack: string | undefined | null, needle: string): boolean {
  return !!(haystack && haystack.toLowerCase().includes(needle))
}

// ── Component ─────────────────────────────────────────────────────────────────
export function Topbar({ pageTitle }: { pageTitle?: string }) {
  const { user, logout } = useAuthStore()
  const { sidebarCollapsed, toggleSidebar, setNotificationCount } = useUIStore()
  const isMobile = useIsMobile()
  const {
    orgName, dateFormat,
    notifyTimesheetApproval, notifyInvoiceOverdue,
    notifyFlaggedTimesheets, notifyJobDeadline,
    notifyNewUser, overdueInvoiceDays,
  } = useSettingsStore()
  const navigate = useNavigate()
  const [notifOpen, setNotifOpen] = useState(false)
  const [search,    setSearch]    = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [activeIdx,  setActiveIdx]  = useState(-1)

  const searchWrapperRef = useRef<HTMLDivElement>(null)
  const inputRef         = useRef<HTMLInputElement>(null)

  const sidebarW = isMobile ? 0 : (sidebarCollapsed ? 76 : 260)
  const isManager = user?.role !== 'employee'

  // ── Real data hooks ───────────────────────────────────────────────────────
  const { jobs }                                   = useJobs()
  const { tasks }                                  = useTasks()
  const { entries: allEntries, pendingEntries }    = useTimesheets(isManager ? {} : { userId: user?.id })
  const { invoices }                               = useInvoices()
  const { users }                                  = useUsers()
  const { clients }                                = useClients()

  // For employees: only show jobs linked to their assigned tasks
  const myJobIds = !isManager
    ? tasks.filter(t => t.assignedToIds?.includes(user?.id ?? '')).map(t => t.jobId)
    : null

  // ── Global search results ─────────────────────────────────────────────────
  const searchResults = useMemo<SearchResult[]>(() => {
    const q = search.trim().toLowerCase()
    if (q.length < 2) return []

    const results: SearchResult[] = []

    // Jobs — visible to all roles, employees only see their assigned jobs
    const visibleJobs = myJobIds
      ? jobs.filter(j => myJobIds.includes(j.id))
      : jobs
    visibleJobs
      .filter(j => matchStr(j.title, q) || matchStr(j.jobId, q) || matchStr(j.clientName, q))
      .slice(0, 4)
      .forEach(j => results.push({
        id:       `job-${j.id}`,
        category: 'Job',
        title:    j.title,
        subtitle: `${j.jobId} · ${j.clientName}`,
        path:     '/jobs',
      }))

    // Tasks — visible to all roles
    tasks
      .filter(t => matchStr(t.name, q) || matchStr(t.jobTitle, q) || matchStr(t.clientName, q) || matchStr(t.assignedToNames, q))
      .slice(0, 4)
      .forEach(t => results.push({
        id:       `task-${t.id}`,
        category: 'Task',
        title:    t.name,
        subtitle: `${t.jobTitle} · ${t.clientName}`,
        path:     '/tasks',
      }))

    // Invoices — managers/admins only
    if (isManager) {
      invoices
        .filter(inv => matchStr(inv.invoiceNumber, q) || matchStr(inv.clientCompany, q) || matchStr(inv.jobTitle, q))
        .slice(0, 4)
        .forEach(inv => results.push({
          id:       `inv-${inv.id}`,
          category: 'Invoice',
          title:    inv.invoiceNumber,
          subtitle: `${inv.clientCompany} · ${inv.status}`,
          path:     '/invoices',
        }))

      // Clients — managers/admins only
      clients
        .filter(c => matchStr(c.name, q) || matchStr(c.company, q) || matchStr(c.industry, q) || matchStr(c.email, q))
        .slice(0, 4)
        .forEach(c => results.push({
          id:       `client-${c.id}`,
          category: 'Client',
          title:    c.company,
          subtitle: `${c.name} · ${c.industry}`,
          path:     '/clients',
        }))

      // Users — managers/admins only
      users
        .filter(u => matchStr(u.name, q) || matchStr(u.email, q) || matchStr(u.department, q))
        .slice(0, 4)
        .forEach(u => results.push({
          id:       `user-${u.id}`,
          category: 'User',
          title:    u.name,
          subtitle: `${u.email}${u.department ? ` · ${u.department}` : ''}`,
          path:     '/users',
        }))
    }

    return results
  }, [search, jobs, tasks, invoices, clients, users, isManager, myJobIds])

  // Open dropdown when results exist
  useEffect(() => {
    setSearchOpen(searchResults.length > 0 || search.trim().length >= 2)
    setActiveIdx(-1)
  }, [searchResults, search])

  // Outside-click closes search dropdown
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  const handleResultClick = useCallback((result: SearchResult) => {
    navigate(result.path)
    setSearch('')
    setSearchOpen(false)
    setActiveIdx(-1)
  }, [navigate])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!searchOpen) return
    if (e.key === 'Escape') {
      setSearchOpen(false)
      setSearch('')
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, searchResults.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault()
      handleResultClick(searchResults[activeIdx])
    }
  }, [searchOpen, searchResults, activeIdx, handleResultClick])

  const clearSearch = () => {
    setSearch('')
    setSearchOpen(false)
    setActiveIdx(-1)
    inputRef.current?.focus()
  }

  // ── Notifications ─────────────────────────────────────────────────────────
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

  // Keep sidebar badge in sync with the real notification count
  useEffect(() => {
    setNotificationCount(allNotifications.length)
  }, [allNotifications.length, setNotificationCount])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Group results by category for display
  const grouped = useMemo(() => {
    const map = new Map<SearchCategory, SearchResult[]>()
    searchResults.forEach(r => {
      if (!map.has(r.category)) map.set(r.category, [])
      map.get(r.category)!.push(r)
    })
    return map
  }, [searchResults])

  // Flat list index → result (for keyboard nav)
  let flatIdx = -1

  return (
    <header
      className="fixed top-0 right-0 z-30 h-[60px] bg-white border-b border-slate-200/80 flex items-center px-5 gap-4 shadow-sm"
      style={{
        left: `${sidebarW}px`,
        right: 0,
        transition: 'left 300ms ease-in-out'
      }}
    >
      {/* Hamburger — mobile only */}
      {isMobile && (
        <button
          className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 flex-shrink-0"
          onClick={toggleSidebar}
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
      )}

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

      {/* ── Global Search ─────────────────────────────────────────────────── */}
      <div
        ref={searchWrapperRef}
        className="hidden md:block relative"
        style={{ width: 240 }}
      >
        {/* Input row */}
        <div
          className={cn(
            'flex items-center gap-2 bg-slate-50 ring-1 ring-slate-200 rounded-lg px-3 h-9 transition-all',
            searchOpen && search.trim().length >= 2
              ? 'ring-2 ring-blue-400/60 bg-white rounded-b-none'
              : 'hover:ring-slate-300 focus-within:ring-2 focus-within:ring-blue-500/40 focus-within:bg-white'
          )}
        >
          <Search size={14} className="text-slate-400 flex-shrink-0" />
          <input
            ref={inputRef}
            placeholder="Search anything..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={() => { if (searchResults.length > 0) setSearchOpen(true) }}
            onKeyDown={handleKeyDown}
            className="bg-transparent text-sm text-slate-600 placeholder:text-slate-400 focus:outline-none w-full"
            aria-label="Global search"
            autoComplete="off"
          />
          {search && (
            <button onClick={clearSearch} className="text-slate-400 hover:text-slate-600 flex-shrink-0">
              <X size={13} />
            </button>
          )}
        </div>

        {/* Results dropdown */}
        {searchOpen && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              zIndex: 50,
              background: '#fff',
              border: '1px solid #bfdbfe',
              borderTop: 'none',
              borderBottomLeftRadius: 8,
              borderBottomRightRadius: 8,
              boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
              maxHeight: 360,
              overflowY: 'auto',
            }}
          >
            {searchResults.length === 0 ? (
              <div style={{ padding: '14px 16px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                No results for <strong style={{ color: '#6b7280' }}>"{search}"</strong>
              </div>
            ) : (
              Array.from(grouped.entries()).map(([category, items]) => {
                const meta = categoryMeta[category]
                return (
                  <div key={category}>
                    {/* Category header */}
                    <div style={{
                      padding: '6px 12px 4px',
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.07em',
                      textTransform: 'uppercase',
                      color: '#9ca3af',
                      background: '#f9fafb',
                      borderTop: '1px solid #f1f5f9',
                    }}>
                      {category}s
                    </div>

                    {/* Items */}
                    {items.map(result => {
                      flatIdx++
                      const currentIdx = flatIdx
                      const isActive = activeIdx === currentIdx

                      return (
                        <button
                          key={result.id}
                          onMouseEnter={() => setActiveIdx(currentIdx)}
                          onClick={() => handleResultClick(result)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            width: '100%',
                            padding: '8px 12px',
                            textAlign: 'left',
                            border: 'none',
                            cursor: 'pointer',
                            background: isActive ? '#eff6ff' : '#fff',
                            transition: 'background 0.1s',
                          }}
                        >
                          {/* Category icon pill */}
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 24,
                            height: 24,
                            borderRadius: 6,
                            background: meta.bg,
                            color: meta.color,
                            flexShrink: 0,
                          }}>
                            {meta.icon}
                          </span>

                          {/* Text */}
                          <span style={{ minWidth: 0, flex: 1 }}>
                            <span style={{
                              display: 'block',
                              fontSize: 13,
                              fontWeight: 500,
                              color: isActive ? '#1d4ed8' : '#1e293b',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}>
                              {result.title}
                            </span>
                            <span style={{
                              display: 'block',
                              fontSize: 11,
                              color: '#94a3b8',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}>
                              {result.subtitle}
                            </span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )
              })
            )}

            {/* Footer hint */}
            {searchResults.length > 0 && (
              <div style={{
                padding: '6px 12px',
                borderTop: '1px solid #f1f5f9',
                display: 'flex',
                gap: 12,
                background: '#f9fafb',
              }}>
                <span style={{ fontSize: 10, color: '#cbd5e1' }}>↑↓ navigate</span>
                <span style={{ fontSize: 10, color: '#cbd5e1' }}>↵ open</span>
                <span style={{ fontSize: 10, color: '#cbd5e1' }}>Esc clear</span>
              </div>
            )}
          </div>
        )}
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
            <div className="absolute right-0 top-[calc(100%+8px)] z-20 bg-white rounded-xl border border-slate-200 shadow-xl w-[min(320px,calc(100vw-1rem))] ring-1 ring-black/5 overflow-hidden">
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
