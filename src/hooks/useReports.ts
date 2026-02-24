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
  totalHours: number
  billableHours: number
  billablePct: number
  entryCount: number
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
    totalJobs: number
    completedJobs: number
    activeClients: number
    revenueByMonth: ReportMonthRevenue[]
    jobStatusBreakdown: ReportStatusCount[]
  }
  jobs: {
    byStatus: ReportStatusCount[]
    byPriority: ReportPriorityCount[]
    topJobsByRevenue: ReportTopJob[]
    overdueJobs: ReportOverdueJob[]
    quotedVsActualHours: ReportQuotedVsActual[]
  }
  time: {
    totalHoursByPeriod: ReportPeriodHours[]
    billableVsNonBillable: { billable: number; nonBillable: number }
    byEmployee: ReportEmployeeTime[]
    pendingApproval: number
    approvalRate: number
    totalHours: number
    billableHours: number
    billablePct: number
  }
  finance: {
    invoiced: number
    collected: number
    outstanding: number
    overdue: number
    overdueCount: number
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
