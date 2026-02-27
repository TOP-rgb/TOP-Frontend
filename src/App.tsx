import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useSettingsStore } from '@/store/settingsStore'
import { AppLayout } from '@/components/layout/AppLayout'
import { Login } from '@/pages/Login'
import { Signup } from '@/pages/Signup'
import { Dashboard } from '@/pages/Dashboard'
import { Users } from '@/pages/Users'
import { Clients } from '@/pages/Clients'
import { Jobs } from '@/pages/Jobs'
import { Tasks } from '@/pages/Tasks'
import { Timesheets } from '@/pages/Timesheets'
import { Placeholder } from '@/pages/Placeholder'
import { Invoices } from '@/pages/Invoices'
import { Reports } from '@/pages/Reports'
import { Settings } from '@/pages/Settings'
import type { UserRole } from '@/types'

/** Loads org locale settings after login so Reports picks up correct currency */
function LoadSettings() {
  const { isAuthenticated } = useAuthStore()
  const { loadSettings, loaded } = useSettingsStore()
  useEffect(() => {
    if (isAuthenticated && !loaded) {
      loadSettings()
    }
  }, [isAuthenticated, loaded, loadSettings])
  return null
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
})

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RequireRole({ children, roles }: { children: React.ReactNode; roles: UserRole[] }) {
  const { user } = useAuthStore()
  if (!user || !roles.includes(user.role)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 text-center">
        <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mb-3">
          <span className="text-2xl">🔒</span>
        </div>
        <h3 className="text-base font-semibold text-slate-700 mb-1">Access Denied</h3>
        <p className="text-slate-400 text-sm">You do not have permission to view this page.</p>
      </div>
    )
  }
  return <>{children}</>
}


export default function App() {
  return (

    <QueryClientProvider client={queryClient}>
      <Toaster position="bottom-right" richColors toastOptions={{ duration: 3000 }} />
      <BrowserRouter>
        <LoadSettings />
        <Routes>
          
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/" element={<RequireAuth><AppLayout /></RequireAuth>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="users" element={
              <RequireRole roles={['manager', 'admin']}><Users /></RequireRole>
            } />
            <Route path="clients" element={
              <RequireRole roles={['manager', 'admin']}><Clients /></RequireRole>
            } />
            <Route path="jobs" element={<Jobs />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="timesheets" element={<Timesheets />} />
            <Route path="reports" element={
              <RequireRole roles={['manager', 'admin']}><Reports /></RequireRole>
            } />
            <Route path="invoices" element={
              <RequireRole roles={['manager', 'admin']}><Invoices /></RequireRole>
            } />
            <Route path="performance" element={
              <RequireRole roles={['admin']}><Placeholder title="Performance Dashboard" /></RequireRole>
            } />
            <Route path="settings" element={
              <RequireRole roles={['admin']}><Settings /></RequireRole>
            } />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
