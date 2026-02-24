import { useState, useEffect } from 'react'
import { api, getToken } from '@/lib/api'
import type { ApiResponse } from '@/lib/api'

// ── Employee Dashboard ────────────────────────────────────────────────────────

export interface EmployeeDashboardData {
  user: { id: string; firstName: string; lastName: string; email: string; role: string }
  stats: {
    totalHours: number
    thisWeekHours: number
    thisMonthHours: number
    activeJobs: number
    totalTimesheetEntries: number
    activeTasks: number
    pendingTasks: number
  }
  recentTimesheets: Array<{
    id: string
    date: string
    hours: number
    description: string | null
    billable: boolean
    job: { id: string; jobId: string; title: string; status: string; client: { id: string; company: string } }
  }>
  activeJobs: Array<{
    id: string; jobId: string; title: string; status: string
    client: { id: string; company: string }
  }>
}

export function useEmployeeDashboard() {
  const [data, setData] = useState<EmployeeDashboardData | null>(null)
  const [loading, setLoading] = useState(!!getToken())
  const [error, setError] = useState<string | null>(null)

  const fetch = () => {
    if (!getToken()) { setLoading(false); return }
    setLoading(true)
    api.get<ApiResponse<EmployeeDashboardData>>('/dashboard/employee')
      .then(res => setData(res.data))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load dashboard'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetch()
    const onFocus = () => fetch()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  return { data, loading, error, refetch: fetch }
}

// ── Manager Dashboard ─────────────────────────────────────────────────────────

export interface ManagerDashboardData {
  manager: { id: string; firstName: string; lastName: string }
  jobStats: {
    total: number
    byStatus: {
      OPEN: number; IN_PROGRESS: number; ON_HOLD: number
      COMPLETED: number; INVOICED: number; CLOSED: number
    }
  }
  revenue: {
    total: number; cost: number; profit: number; completedJobs: number
  }
  teamStats: {
    totalTeamHours: number
    teamMembers: Array<{ userId: string; name: string; hours: number }>
  }
  recentJobs: Array<{
    id: string; jobId: string; title: string; status: string; priority: string
    client: { id: string; company: string }
  }>
  recentTimesheets: Array<{
    id: string
    date: string
    hours: number
    status: string
    flagReason?: string | null
    description?: string | null
    billable: boolean
    user: { id: string; firstName: string; lastName: string }
    job: { id: string; jobId: string; title: string }
    task?: { id: string; title: string } | null
  }>
}

export function useManagerDashboard() {
  const [data, setData] = useState<ManagerDashboardData | null>(null)
  const [loading, setLoading] = useState(!!getToken())
  const [error, setError] = useState<string | null>(null)

  const fetch = () => {
    if (!getToken()) { setLoading(false); return }
    setLoading(true)
    api.get<ApiResponse<ManagerDashboardData>>('/dashboard/manager')
      .then(res => setData(res.data))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load dashboard'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetch()
    const onFocus = () => fetch()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  return { data, loading, error, refetch: fetch }
}

// ── Admin Dashboard ───────────────────────────────────────────────────────────

export interface AdminDashboardData {
  userStats: {
    total: number
    byRole: { ADMIN: number; MANAGER: number; EMPLOYEE: number }
    byStatus: { ACTIVE: number; INACTIVE: number }
  }
  jobStats: {
    total: number
    byStatus: {
      OPEN: number; IN_PROGRESS: number; ON_HOLD: number
      COMPLETED: number; INVOICED: number; CLOSED: number
    }
    byPriority: { LOW: number; MEDIUM: number; HIGH: number; URGENT: number }
  }
  financial: {
    totalRevenue: number; totalCost: number; totalProfit: number
    profitMargin: number; completedJobs: number; invoicedJobs: number
  }
  timesheetStats: {
    totalEntries: number; totalHours: number; averageHours: number
  }
  clientStats: {
    total: number; active: number
    topClients: Array<{ clientId: string; company: string; revenue: number; jobs: number }>
  }
}

export function useAdminDashboard() {
  const [data, setData] = useState<AdminDashboardData | null>(null)
  const [loading, setLoading] = useState(!!getToken())
  const [error, setError] = useState<string | null>(null)

  const fetch = () => {
    if (!getToken()) { setLoading(false); return }
    setLoading(true)
    api.get<ApiResponse<AdminDashboardData>>('/dashboard/admin')
      .then(res => setData(res.data))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load dashboard'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetch()
    const onFocus = () => fetch()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  return { data, loading, error, refetch: fetch }
}

// ── Revenue & Team Stats ──────────────────────────────────────────────────────

export interface RevenueStats {
  completed: number; invoiced: number; pending: number; total: number
  breakdown: { completedJobs: number; invoicedJobs: number; pendingJobs: number }
}

export function useRevenueStats() {
  const [data, setData] = useState<RevenueStats | null>(null)
  const [loading, setLoading] = useState(!!getToken())

  useEffect(() => {
    if (!getToken()) { setLoading(false); return }
    setLoading(true)
    api.get<ApiResponse<RevenueStats>>('/dashboard/stats/revenue')
      .then(res => setData(res.data))
      .catch(() => {/* silent fail */})
      .finally(() => setLoading(false))
  }, [])

  return { data, loading }
}

export interface TeamStats {
  totalTeamMembers: number
  data: Array<{
    userId: string; name: string; email: string; role: string
    totalHours: number; thisMonthHours: number; timesheetEntries: number
  }>
  aggregate: { totalTeamHours: number; averageHoursPerPerson: number; totalTimesheetEntries: number }
}

export function useTeamStats() {
  const [data, setData] = useState<TeamStats | null>(null)
  const [loading, setLoading] = useState(!!getToken())

  useEffect(() => {
    if (!getToken()) { setLoading(false); return }
    setLoading(true)
    api.get<ApiResponse<TeamStats>>('/dashboard/stats/team')
      .then(res => setData(res.data))
      .catch(() => {/* silent fail */})
      .finally(() => setLoading(false))
  }, [])

  return { data, loading }
}
