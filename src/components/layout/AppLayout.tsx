import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { useUIStore } from '@/store/uiStore'

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/users': 'User Management',
  '/clients': 'Clients',
  '/jobs': 'Jobs',
  '/tasks': 'Tasks',
  '/timesheets': 'Timesheets',
  '/reports': 'Reports & Analytics',
  '/invoices': 'Invoices',
  '/performance': 'Performance',
  '/settings': 'Settings',
}

export function AppLayout() {
  const { sidebarCollapsed } = useUIStore()
  const location = useLocation()
  const title = pageTitles[location.pathname]
  const sidebarWidth = sidebarCollapsed ? 76 : 260 // Match sidebar widths

  return (
    <div className="min-h-screen bg-slate-100 relative">
      <Sidebar />
      <Topbar pageTitle={title} />
      <main 
        className="transition-all duration-300 ease-in-out"
        style={{ 
          marginLeft: `${sidebarWidth}px`,
          marginTop: '60px' // Height of Topbar
        }}
      >
        <div className="p-6 px-6 py-6 lg:p-16 xl:p-10">
          <div className="max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  )
}