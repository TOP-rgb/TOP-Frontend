import { Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { useUIStore } from '@/store/uiStore'
import { useIsMobile } from '@/hooks/useIsMobile'

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
  const { sidebarCollapsed, sidebarOpen, setSidebarOpen } = useUIStore()
  const location = useLocation()
  const isMobile = useIsMobile()
  const title = pageTitles[location.pathname]
  const sidebarWidth = sidebarCollapsed ? 76 : 260

  // Close sidebar on route change on mobile
  useEffect(() => {
    if (isMobile) setSidebarOpen(false)
  }, [location.pathname, isMobile, setSidebarOpen])

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 relative">
      <Sidebar />
      <Topbar pageTitle={title} />

      {/* Mobile backdrop — closes sidebar on tap */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main
        className="transition-all duration-300 ease-in-out"
        style={{
          marginLeft: isMobile ? 0 : `${sidebarWidth}px`,
          marginTop: '60px',
        }}
      >
        <div className="p-4 sm:p-6 lg:p-8 xl:p-10">
          <div className="max-w-[1600px] mx-auto" style={{ minWidth: 0 }}>
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  )
}