import { useState, useEffect } from 'react'
import { api, getToken } from '@/lib/api'
import type { ApiResponse } from '@/lib/api'

export type DateRange = 'this_month' | 'last_month' | 'last_3_months' | 'last_6_months' | 'this_year' | 'all'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ReportStatusCount {
  status: string
  count: number
  pct: number
}

export interface ReportPriorityCount {
  priority: string
  count: number
}

export interface ReportTopJob {
  jobId: string
  title: string
  client: string
  revenue: number
  margin: number
  status: string
}

export interface ReportOverdueJob {
  jobId: string
  title: string
  client: string
  deadline: string
  daysOverdue: number
  status: string
}

export interface ReportQuotedVsActual {
  jobId: string
  title: string
  quoted: number
  actual: number
  variance: number
}

export interface ReportMonthRevenue {
  month: string
  revenue: number
  cost: number
  profit: number
}

export interface ReportPeriodHours {
  period: string
  hours: number
}

export interface ReportEmployeeTime {
  name: string
  department: string
  role: string        // EMPLOYEE | MANAGER | ADMIN
  totalHours: number
  billableHours: number
  billablePct: number
  entryCount: number
  pendingApproval: number
}

export interface ReportJobHours {
  title: string
  jobId: string
  hours: number
}

export interface ReportDayOfWeek {
  day: string
  hours: number
}

export interface ReportTimesheetStatus {
  status: string
  count: number
  hours: number
}

export interface ReportDepartmentTime {
  department: string
  totalHours: number
  billableHours: number
  billablePct: number
  employeeCount: number
  entryCount: number
  avgHoursPerEmployee: number
}

export interface ReportClientHours {
  company: string
  totalHours: number
  billableHours: number
  billablePct: number
  jobCount: number
}

export interface ReportTaskTypeHours {
  type: string
  totalHours: number
  billableHours: number
  billablePct: number
  entryCount: number
}

export interface ReportFlaggedReason {
  reason: string
  count: number
}

export interface ReportFlaggedEntries {
  total: number
  byReason: ReportFlaggedReason[]
}

export interface ReportQualityMetrics {
  totalEntries: number
  entriesWithDescription: number
  descriptionRate: number
  entriesWithTask: number
  taskLinkRate: number
  avgHoursPerEntry: number
}

export interface ReportFinanceMonth {
  month: string
  invoiced: number
  collected: number
}

export interface ReportClientRevenue {
  company: string
  invoiced: number
  collected: number
  outstanding: number
}

export interface ReportInvoiceStatus {
  status: string
  count: number
  amount: number
}

export interface ReportsData {
  overview: {
    totalRevenue: number
    totalCost: number
    totalProfit: number
    avgMargin: number
    totalHours: number
    billableHours: number
    billablePct: number
    totalJobs: number
    completedJobs: number
    activeClients: number
    totalTasks: number
    completedTasks: number
    taskCompletionRate: number
    revenueByMonth: ReportMonthRevenue[]
    jobStatusBreakdown: ReportStatusCount[]
  }
  jobs: {
    byStatus: ReportStatusCount[]
    byPriority: ReportPriorityCount[]
    byJobType: { type: string; count: number; revenue: number; completedCount: number }[]
    billingTypeBreakdown: { type: string; count: number; revenue: number }[]
    topJobsByRevenue: ReportTopJob[]
    overdueJobs: ReportOverdueJob[]
    quotedVsActualHours: ReportQuotedVsActual[]
  }
  time: {
    totalHoursByPeriod: ReportPeriodHours[]
    billableVsNonBillable: { billable: number; nonBillable: number }
    byEmployee: ReportEmployeeTime[]
    hoursByJob: ReportJobHours[]
    hoursByDayOfWeek: ReportDayOfWeek[]
    timesheetStatusBreakdown: ReportTimesheetStatus[]
    pendingApproval: number
    approvalRate: number | null  // null = no entries reviewed yet
    reviewedCount: number
    totalHours: number
    billableHours: number
    billablePct: number
    // Detailed breakdowns
    byDepartment: ReportDepartmentTime[]
    hoursByClient: ReportClientHours[]
    hoursByTaskType: ReportTaskTypeHours[]
    flaggedEntries: ReportFlaggedEntries
    qualityMetrics: ReportQualityMetrics
  }
  tasks: {
    total: number
    completed: number
    inProgress: number
    todo: number
    completionRate: number
    byType: { type: string; total: number; completed: number; completionRate: number; estimatedHours: number; actualHours: number }[]
    statusBreakdown: { status: string; label: string; count: number }[]
    taskEfficiency: { title: string; type: string; estimated: number; actual: number; variance: number; status: string }[]
    recentlyCompleted: { title: string; type: string; job: string; completedAt: string; estimatedHours: number; actualHours: number }[]
  }
  clients: {
    total: number
    active: number
    inactive: number
    byIndustry: { industry: string; clientCount: number; jobCount: number; revenue: number }[]
    topByRevenue: ReportClientRevenue[]
  }
  finance: {
    invoiced: number
    collected: number
    outstanding: number
    overdue: number
    overdueCount: number
    totalTax: number
    avgDaysToPay: number
    revenueByMonth: ReportFinanceMonth[]
    topClientsByRevenue: ReportClientRevenue[]
    invoiceStatusBreakdown: ReportInvoiceStatus[]
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useReports(range: DateRange) {
  const [data, setData] = useState<ReportsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!getToken()) { setLoading(false); return }
    setLoading(true)
    setError(null)
    api.get<ApiResponse<ReportsData>>(`/reports?range=${range}`)
      .then(res => setData(res.data ?? null))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load reports'))
      .finally(() => setLoading(false))
  }, [range])

  return { data, loading, error }
}
