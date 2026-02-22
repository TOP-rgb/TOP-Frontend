import { Bell, Search, LogOut } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types'

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

const notifications = [
  { id: 1, text: 'Timesheet from Sarah Chen pending approval', time: '5m ago', unread: true,  type: 'approval' },
  { id: 2, text: 'Job JOB-003 deadline in 3 days', time: '1h ago',  unread: true,  type: 'alert' },
  { id: 3, text: 'Invoice for Harrington Constructions ready', time: '2h ago', unread: false, type: 'invoice' },
]

const notifIcons: Record<string, string> = {
  approval: '⏳',
  alert:    '⚠️',
  invoice:  '📄',
}

export function Topbar({ pageTitle }: { pageTitle?: string }) {
  const { user, logout } = useAuthStore()
  const { sidebarCollapsed } = useUIStore()
  const navigate = useNavigate()
  const [notifOpen, setNotifOpen] = useState(false)
  const [search,    setSearch]    = useState('')

  const sidebarW = sidebarCollapsed ? 76 : 260
  const unreadCount = notifications.filter(n => n.unread).length

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
      {/* Page title */}
      {pageTitle && (
        <div className="hidden sm:block">
          <h1 className="text-sm font-bold text-slate-800 leading-none">{pageTitle}</h1>
        </div>
      )}

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

      {/* Notifications */}
      <div className="relative">
        <button
          onClick={() => setNotifOpen(v => !v)}
          aria-label={`${unreadCount} unread notifications`}
          className="relative w-9 h-9 flex items-center justify-center hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700 transition-colors"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none ring-2 ring-white">
              {unreadCount}
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
              <div className="divide-y divide-slate-50">
                {notifications.map(n => (
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
              <div className="px-4 py-2.5 border-t border-slate-100 text-center">
                <button className="text-xs text-blue-600 font-semibold hover:text-blue-700">View all notifications</button>
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
