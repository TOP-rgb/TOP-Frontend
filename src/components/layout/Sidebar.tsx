import { NavLink, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { Avatar } from '@/components/ui/Avatar'
import {
  LayoutDashboard, Building2, Briefcase, CheckSquare,
  Clock, BarChart3, Settings, LogOut, ChevronLeft, ChevronRight,
  Calendar, FolderOpen, HeadphonesIcon, Receipt, UserCog
} from 'lucide-react'
import type { UserRole } from '@/types'

interface NavItem {
  label: string
  icon: React.ReactNode
  path: string
  roles: UserRole[]
  badge?: number | string
}

const navItems: NavItem[] = [
  { label: 'Dashboard',           icon: <LayoutDashboard size={20} />, path: '/dashboard',  roles: ['employee', 'manager', 'admin'] },
  { label: 'User Management',     icon: <UserCog size={20} />,         path: '/users',       roles: ['manager', 'admin'] },
  { label: 'Client Management',   icon: <Building2 size={20} />,       path: '/clients',     roles: ['manager', 'admin'] },
  { label: 'Jobs',                icon: <Briefcase size={20} />,       path: '/jobs',        roles: ['employee', 'manager', 'admin'] },
  { label: 'Tasks',               icon: <CheckSquare size={20} />,     path: '/tasks',       roles: ['employee', 'manager', 'admin'] },
  { label: 'Time Sheets', icon: <Clock size={20} />,           path: '/timesheets',  roles: ['employee', 'manager', 'admin'] },
  { label: 'Billing or Invoice',  icon: <Receipt size={20} />,         path: '/invoices',    roles: ['manager', 'admin'] },
  { label: 'Reports',             icon: <BarChart3 size={20} />,       path: '/reports',     roles: ['manager', 'admin'] },
  { label: 'Calendar',            icon: <Calendar size={20} />,        path: '/calendar',    roles: ['employee', 'manager', 'admin'] },
  { label: 'Documents',           icon: <FolderOpen size={20} />,      path: '/documents',   roles: ['employee', 'manager', 'admin'] },
  { label: 'Settings',            icon: <Settings size={20} />,        path: '/settings',    roles: ['admin'] },
  { label: 'Support',             icon: <HeadphonesIcon size={20} />,  path: '/support',     roles: ['employee', 'manager', 'admin'] },
]

const SIDEBAR_BG = '#0f172a'
const ACTIVE_BG  = 'white'
const ICON_BG_ACTIVE = '#3b82f6'   // blue-500

export function Sidebar() {
  const { user, logout } = useAuthStore()
  const { sidebarCollapsed, toggleCollapsed } = useUIStore()
  const navigate = useNavigate()

  const filtered = navItems.filter(item => user?.role && item.roles.includes(user.role))

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-full z-40 flex flex-col transition-all duration-300',
        sidebarCollapsed ? 'w-[72px]' : 'w-[260px]'
      )}
      style={{ backgroundColor: SIDEBAR_BG }}
    >
      {/* Header / Logo - increased vertical padding */}
      <div
        className="relative flex items-center justify-between px-4 flex-shrink-0"
        style={{ 
          height: 96,                    // increased from 80px
          paddingTop: '16px',
          paddingBottom: '16px',
          borderBottom: '1px solid rgba(255,255,255,0.08)'
        }}
      >
        {sidebarCollapsed ? (
          <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center font-black text-lg text-[#0f172a] mx-auto">
            T
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center font-black text-lg text-[#0f172a]">
              T
            </div>
            <div className="leading-tight">
              <div className="text-white font-black text-xl tracking-tight">TOP</div>
              <div className="text-slate-400 text-[10px] mt-0.5 font-medium">The Outsource Pro</div>
            </div>
          </div>
        )}

        <button
          onClick={toggleCollapsed}
          className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Navigation - more padding top + bottom on list */}
      <nav className="flex-1 pt-6 pb-4 px-2 overflow-y-auto">
        {filtered.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center gap-3 py-3.5 px-3 mb-1.5 text-sm font-medium rounded-r-xl transition-all',
                isActive
                  ? 'bg-white text-slate-900 font-semibold shadow-sm'
                  : 'text-slate-300 hover:bg-white/8 hover:text-white'
              )
            }
          >
            <div
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0 transition-colors',
                'bg-white/10 text-slate-300 group-hover:bg-white/20',
                'group-[.bg-white]:bg-[#3b82f6] group-[.bg-white]:text-white group-[.bg-white]:shadow-sm'
              )}
            >
              {item.icon}
            </div>

            {!sidebarCollapsed && (
              <span className="truncate">{item.label}</span>
            )}
          </NavLink>
        ))}

        {/* Logout - consistent padding */}
        <button
          onClick={handleLogout}
          className={cn(
            'flex items-center gap-3 py-3.5 px-3 mt-3 mb-2 w-full text-sm font-medium rounded-r-xl transition-all',
            'text-slate-300 hover:bg-white/8 hover:text-red-300'
          )}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-slate-300 hover:bg-white/20">
            <LogOut size={20} />
          </div>
          {!sidebarCollapsed && <span>Logout</span>}
        </button>
      </nav>

      {/* User footer - more vertical padding */}
      {user && (
        <div
          className={cn(
            'flex items-center gap-3 px-4 py-6 border-t border-white/8 flex-shrink-0',
            sidebarCollapsed && 'justify-center px-2 py-5'
          )}
        >
          <div className="relative flex-shrink-0">
            <Avatar name={user.name} size="sm" />
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[#0f172a]" />
          </div>

          {!sidebarCollapsed && (
            <div className="min-w-0">
              <div className="text-white text-xs font-semibold truncate">{user.name}</div>
              <div className="text-slate-500 text-[10px] truncate mt-0.5">{user.email}</div>
            </div>
          )}
        </div>
      )}
    </aside>
  )
}