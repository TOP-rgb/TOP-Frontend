import { useState, useCallback, useEffect } from 'react'
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  TrendingUp, DollarSign, Clock, Users, Briefcase,
  AlertCircle, CheckCircle, BarChart2, FileText, Target,
  RefreshCw, Download, Flag, Activity, Layers, ScanLine,
} from 'lucide-react'
import { useReports, type DateRange, type ReportsData } from '@/hooks/useReports'
import { useSettingsStore } from '@/store/settingsStore'
import { useAuthStore } from '@/store/authStore'
import { api } from '@/lib/api'
import type { ApiResponse } from '@/lib/api'
import { formatDateWithSettings } from '@/lib/utils'

// ── Currency formatter factory (matching Invoices component pattern) ─────────
function makeFmt(currency: string, symbol: string) {
  return (n: number) =>
    new Intl.NumberFormat('en-AU', { 
      style: 'currency', 
      currency, 
      currencyDisplay: 'symbol',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    }).format(n).replace(currency, symbol)
}

function fmtDate(d: string, dateFormat = 'DD/MM/YYYY') {
  return formatDateWithSettings(d, dateFormat)
}

// Safe formatter for Recharts Tooltip — ValueType can be string|number|array
// Takes the fmt function as argument
function fmtV(v: unknown, fmt: (n: number) => string): string {
  const n = Number(v)
  return isNaN(n) ? String(v) : fmt(n)
}
function fmtHours(v: unknown): string {
  const n = Number(v)
  return isNaN(n) ? String(v) : `${n.toFixed(1)}h`
}
function fmtCount(v: unknown, unit = 'jobs'): string {
  const n = Number(v)
  return isNaN(n) ? String(v) : `${n} ${unit}`
}

// ── CSV Download ──────────────────────────────────────────────────────────────

function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  const escape = (v: unknown) => {
    const s = String(v ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [headers.join(','), ...rows.map(r => headers.map(h => escape(r[h])).join(','))].join('\n')
}

function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

type ReportTab = 'overview' | 'jobs' | 'time' | 'finance' | 'attendance'

// ── Attendance stats types ────────────────────────────────────────────────────
interface AttendanceStats {
  summary: { presentDays: number; lateDays: number; leaveDays: number; attendanceRate: number }
  dailyTrend: { date: string; present: number; late: number; onLeave: number }[]
  byEmployee: { userId: string; name: string; present: number; late: number; absent: number; leaveDays: number; overtimeMinutes: number }[]
  exceptionBreakdown: { LATE_ARRIVAL: number; EARLY_DEPARTURE: number; MISSED_CHECKOUT: number; LOCATION_VIOLATION: number }
  leaveByType: { leaveType: string; color: string; days: number }[]
}

function useAttendanceStats(range: DateRange) {
  const [data, setData] = useState<AttendanceStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async (r: DateRange) => {
    try {
      setLoading(true)
      const now = new Date()
      let startDate = '', endDate = now.toISOString().slice(0, 10)
      if (r === 'this_month') startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
      else if (r === 'last_month') {
        const d = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        startDate = d.toISOString().slice(0, 10)
        endDate = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10)
      } else if (r === 'last_3_months') startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().slice(0, 10)
      else if (r === 'last_6_months') startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString().slice(0, 10)
      else if (r === 'this_year') startDate = `${now.getFullYear()}-01-01`
      else startDate = '2020-01-01'

      const res = await api.get<ApiResponse<AttendanceStats>>(`/attendance/stats?startDate=${startDate}&endDate=${endDate}`)
      setData(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load attendance stats')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch(range) }, [fetch, range])
  return { data, loading, error }
}

// ── Attendance Tab Component ──────────────────────────────────────────────────
function AttendanceTab({ d }: { d: AttendanceStats }) {
  const excData = [
    { name: 'Late Arrival',       value: d.exceptionBreakdown.LATE_ARRIVAL,      fill: '#f59e0b' },
    { name: 'Early Departure',    value: d.exceptionBreakdown.EARLY_DEPARTURE,   fill: '#ef4444' },
    { name: 'Missed Checkout',    value: d.exceptionBreakdown.MISSED_CHECKOUT,   fill: '#8b5cf6' },
    { name: 'Location Violation', value: d.exceptionBreakdown.LOCATION_VIOLATION, fill: '#ec4899' },
  ].filter(e => e.value > 0)

  const KPI = ({ label, value, sub }: { label: string; value: string | number; sub?: string }) => (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '16px 20px' }}>
      <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: '#1a1f36', margin: '6px 0 2px' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#9ca3af' }}>{sub}</div>}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
        <KPI label="Attendance Rate" value={`${d.summary.attendanceRate}%`} sub="Present days / total working days" />
        <KPI label="Present Days" value={d.summary.presentDays} />
        <KPI label="Late Days" value={d.summary.lateDays} sub="Arrived after grace period" />
        <KPI label="Leave Days" value={d.summary.leaveDays} sub="Approved leave taken" />
      </div>

      {/* Daily trend */}
      {d.dailyTrend.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1f36', marginBottom: 14 }}>Daily Attendance Trend</div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={d.dailyTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={v => v.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="present" name="Present" stackId="1" stroke="#10b981" fill="#d1fae5" />
              <Area type="monotone" dataKey="late"    name="Late"    stackId="1" stroke="#f59e0b" fill="#fef3c7" />
              <Area type="monotone" dataKey="onLeave" name="On Leave" stackId="1" stroke="#3b82f6" fill="#dbeafe" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
        {/* Exception breakdown */}
        {excData.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1f36', marginBottom: 14 }}>Exception Breakdown</div>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={excData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                  {excData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Leave by type */}
        {d.leaveByType.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1f36', marginBottom: 14 }}>Leave Days by Type</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={d.leaveByType} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="leaveType" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="days" name="Days Used" radius={[4, 4, 0, 0]}>
                  {d.leaveByType.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* By employee table */}
      {d.byEmployee.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', fontWeight: 700, fontSize: 14, color: '#1a1f36', borderBottom: '1px solid #e5e7eb' }}>By Employee</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Employee', 'Present', 'Late', 'Absent', 'OT Hours', 'Leave Days'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.byEmployee.map(e => (
                  <tr key={e.userId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: '#1a1f36' }}>{e.name}</td>
                    <td style={{ padding: '10px 16px', color: '#10b981', fontWeight: 600 }}>{e.present}</td>
                    <td style={{ padding: '10px 16px', color: '#f59e0b' }}>{e.late}</td>
                    <td style={{ padding: '10px 16px', color: '#ef4444' }}>{e.absent}</td>
                    <td style={{ padding: '10px 16px', color: '#10b981' }}>{e.overtimeMinutes > 0 ? `${(e.overtimeMinutes / 60).toFixed(1)}h` : '—'}</td>
                    <td style={{ padding: '10px 16px' }}>{e.leaveDays > 0 ? e.leaveDays : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function exportTab(tab: ReportTab, data: ReportsData, range: string, currency = 'AUD', symbol = '$', attStats?: AttendanceStats | null) {
  const fmt = (n: number) => makeFmt(currency, symbol)(n)
  const label = range.replace(/_/g, '-')
  
  if (tab === 'overview') {
    const rows = data.overview.revenueByMonth.map(m => ({
      Month: m.month,
      Revenue: m.revenue,
      Cost: m.cost,
      Profit: m.profit,
    }))
    downloadCSV(`overview-${label}.csv`, rows.length ? toCSV(rows) : toCSV([{
      'Total Revenue': data.overview.totalRevenue,
      'Total Profit': data.overview.totalProfit,
      'Avg Margin %': data.overview.avgMargin,
      'Total Hours': data.overview.totalHours,
      'Total Jobs': data.overview.totalJobs,
      'Completed Jobs': data.overview.completedJobs,
      'Active Clients': data.overview.activeClients,
    }]))
  } else if (tab === 'jobs') {
    const rows = data.jobs.topJobsByRevenue.map(j => ({
      'Job ID': j.jobId,
      Title: j.title,
      Client: j.client,
      [`Revenue (${currency})`]: fmt(j.revenue),
      'Margin %': j.margin,
      Status: j.status,
    }))
    downloadCSV(`jobs-${label}.csv`, toCSV(rows.length ? rows : [{ Note: 'No data' }]))
  } else if (tab === 'time') {
    const rows = data.time.byEmployee.map(e => ({
      Employee: e.name,
      'Total Hours': e.totalHours,
      'Billable Hours': e.billableHours,
      'Billable %': e.billablePct,
      Entries: e.entryCount,
    }))
    downloadCSV(`time-${label}.csv`, toCSV(rows.length ? rows : [{ Note: 'No data' }]))
  } else if (tab === 'finance') {
    const rows = data.finance.topClientsByRevenue.map(c => ({
      Client: c.company,
      [`Invoiced (${currency})`]: fmt(c.invoiced),
      [`Collected (${currency})`]: fmt(c.collected),
      [`Outstanding (${currency})`]: fmt(c.outstanding),
    }))
    downloadCSV(`finance-${label}.csv`, toCSV(rows.length ? rows : [{
      'Total Invoiced': fmt(data.finance.invoiced),
      'Collected': fmt(data.finance.collected),
      'Outstanding': fmt(data.finance.outstanding),
      'Overdue': fmt(data.finance.overdue),
    }]))
  } else if (tab === 'attendance' && attStats) {
    const rows = attStats.byEmployee.map(e => ({
      Employee:         e.name,
      'Present Days':   e.present,
      'Late Days':      e.late,
      'Absent Days':    e.absent,
      'Leave Days':     e.leaveDays,
      'Overtime (hrs)': e.overtimeMinutes > 0 ? (e.overtimeMinutes / 60).toFixed(1) : 0,
    }))
    downloadCSV(`attendance-${label}.csv`, toCSV(rows.length ? rows : [{ Note: 'No data' }]))
  }
}

// ── Style constants ───────────────────────────────────────────────────────────

const CHART_TOOLTIP_STYLE = {
  borderRadius: 10,
  border: 'none',
  boxShadow: '0 4px 20px rgba(0,0,0,.08)',
  fontSize: 12,
}

const STATUS_COLORS: Record<string, string> = {
  open: '#3b82f6',
  in_progress: '#6366f1',
  on_hold: '#f59e0b',
  completed: '#22c55e',
  invoiced: '#a855f7',
  closed: '#64748b',
  cancelled: '#ef4444',
}

const INVOICE_COLORS: Record<string, string> = {
  draft: '#94a3b8',
  sent: '#3b82f6',
  paid: '#22c55e',
  overdue: '#ef4444',
  cancelled: '#64748b',
}

const RANGE_LABELS: Record<DateRange, string> = {
  this_month: 'This Month',
  last_month: 'Last Month',
  last_3_months: 'Last 3 Months',
  last_6_months: 'Last 6 Months',
  this_year: 'This Year',
  all: 'All Time',
}

// ── Shared UI pieces ──────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon, color,
}: {
  label: string; value: string; sub?: string; icon: React.ReactNode; color: string
}) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 20px',
      display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: 10, flexShrink: 0,
        background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', color,
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1f36', lineHeight: 1.2 }}>{value}</div>
        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  )
}

function Card({ title, children, badge }: { title: string; children: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1a1f36', margin: 0 }}>{title}</h3>
        {badge}
      </div>
      {children}
    </div>
  )
}

function StatusPill({ status, colors }: { status: string; colors: Record<string, string> }) {
  const color = colors[status] ?? '#6b7280'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 10, fontWeight: 700, color,
      background: color + '18', padding: '2px 8px', borderRadius: 20,
      textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, display: 'inline-block' }} />
      {status.replace(/_/g, ' ')}
    </span>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 16px', color: '#9ca3af' }}>
      <BarChart2 size={28} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
      <div style={{ fontSize: 13 }}>{text}</div>
    </div>
  )
}

// ── Tab: Overview ─────────────────────────────────────────────────────────────

function OverviewTab({ d }: { d: ReportsData['overview'] }) {
  const { currency, currencySymbol } = useSettingsStore()
  const fmt = (n: number) => makeFmt(currency, currencySymbol)(n)
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <KpiCard label="Total Revenue" value={fmt(d.totalRevenue)} sub={`${d.totalJobs} jobs`} icon={<span style={{fontWeight:700,fontSize:16}}>{currencySymbol}</span>} color="#22c55e" />
        <KpiCard label="Net Profit" value={fmt(d.totalProfit)} sub={`${d.avgMargin.toFixed(1)}% avg margin`} icon={<TrendingUp size={18} />} color="#3b82f6" />
        <KpiCard label="Hours Logged" value={`${d.totalHours.toFixed(1)}h`} sub={`${d.billableHours.toFixed(1)}h billable`} icon={<Clock size={18} />} color="#f59e0b" />
        <KpiCard label="Active Clients" value={String(d.activeClients)} sub={`${d.completedJobs}/${d.totalJobs} jobs done`} icon={<Users size={18} />} color="#a855f7" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <Card title="Revenue vs Cost vs Profit">
          {d.revenueByMonth.length === 0 ? <EmptyState text="No revenue data for this period" /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={d.revenueByMonth} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => fmt(Number(v)).replace(/\.00$/, '')} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => fmtV(v, fmt)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="revenue" name="Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cost" name="Cost" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" name="Profit" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Job Status Breakdown">
          {d.jobStatusBreakdown.length === 0 ? <EmptyState text="No jobs in this period" /> : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={d.jobStatusBreakdown} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {d.jobStatusBreakdown.map((entry, i) => (
                      <Cell key={i} fill={STATUS_COLORS[entry.status] ?? '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={v => fmtCount(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                {d.jobStatusBreakdown.map((e, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLORS[e.status] ?? '#94a3b8', flexShrink: 0 }} />
                      <span style={{ color: '#6b7280', textTransform: 'capitalize' }}>{e.status.replace(/_/g, ' ')}</span>
                    </div>
                    <span style={{ fontWeight: 600, color: '#1a1f36' }}>{e.count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}

// ── Tab: Jobs ─────────────────────────────────────────────────────────────────

function JobsTab({ d, overview }: { d: ReportsData['jobs']; overview: ReportsData['overview'] }) {
  const { currency, currencySymbol, dateFormat } = useSettingsStore()
  const fmt = (n: number) => makeFmt(currency, currencySymbol)(n)
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        <KpiCard label="Completed Jobs" value={`${overview.completedJobs}/${overview.totalJobs}`} sub="completed or invoiced" icon={<CheckCircle size={18} />} color="#22c55e" />
        <KpiCard label="Avg Job Margin" value={`${overview.avgMargin.toFixed(1)}%`} sub="across completed jobs" icon={<Target size={18} />} color="#3b82f6" />
        <KpiCard label="Overdue Jobs" value={String(d.overdueJobs.length)} sub="past deadline" icon={<AlertCircle size={18} />} color="#ef4444" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card title="Quoted vs Actual Hours">
          {d.quotedVsActualHours.length === 0 ? <EmptyState text="No jobs with hour data" /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={d.quotedVsActualHours} layout="vertical" barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="title" width={90} tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={v => fmtHours(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="quoted" name="Quoted" fill="#94a3b8" radius={[0, 4, 4, 0]} />
                <Bar dataKey="actual" name="Actual" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Top Jobs by Revenue">
          {d.topJobsByRevenue.length === 0 ? <EmptyState text="No completed jobs yet" /> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    {['Job', 'Client', `Revenue (${currency})`, 'Margin', 'Status'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {d.topJobsByRevenue.map((j, i) => (
                    <tr key={i} style={{ borderTop: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '9px 10px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600, color: '#1a1f36', fontFamily: 'monospace', fontSize: 11 }}>{j.jobId}</div>
                        <div style={{ color: '#6b7280', fontSize: 11, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.title}</div>
                      </td>
                      <td style={{ padding: '9px 10px', color: '#6b7280', whiteSpace: 'nowrap', fontSize: 11 }}>{j.client}</td>
                      <td style={{ padding: '9px 10px', fontWeight: 600, color: '#1a1f36', whiteSpace: 'nowrap' }}>{fmt(j.revenue)}</td>
                      <td style={{ padding: '9px 10px', whiteSpace: 'nowrap' }}>
                        <span style={{ color: j.margin >= 30 ? '#16a34a' : j.margin >= 10 ? '#d97706' : '#dc2626', fontWeight: 600 }}>
                          {j.margin.toFixed(1)}%
                        </span>
                      </td>
                      <td style={{ padding: '9px 10px' }}><StatusPill status={j.status} colors={STATUS_COLORS} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {d.overdueJobs.length > 0 && (
        <Card
          title="Overdue Jobs"
          badge={
            <span style={{ background: '#fef2f2', color: '#dc2626', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>
              {d.overdueJobs.length} overdue
            </span>
          }
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#fef2f2' }}>
                {['Job', 'Client', 'Deadline', 'Days Overdue', 'Status'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.overdueJobs.map((j, i) => (
                <tr key={i} style={{ borderTop: '1px solid #fee2e2' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1a1f36', fontFamily: 'monospace', fontSize: 11 }}>{j.jobId}</td>
                  <td style={{ padding: '10px 12px', color: '#6b7280', fontSize: 12 }}>{j.client}</td>
                  <td style={{ padding: '10px 12px', color: '#6b7280', whiteSpace: 'nowrap' }}>{fmtDate(j.deadline, dateFormat)}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ fontWeight: 700, color: '#dc2626' }}>{j.daysOverdue}d</span>
                  </td>
                  <td style={{ padding: '10px 12px' }}><StatusPill status={j.status} colors={STATUS_COLORS} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}

// ── Tab: Time ─────────────────────────────────────────────────────────────────

function TimeTab({ d }: { d: ReportsData['time'] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        <KpiCard label="Total Hours" value={`${d.totalHours.toFixed(1)}h`} sub={`${d.byEmployee.length} employees`} icon={<Clock size={18} />} color="#3b82f6" />
        <KpiCard label="Billable Rate" value={`${d.billablePct}%`} sub={`${d.billableHours.toFixed(1)}h billable`} icon={<Target size={18} />} color="#22c55e" />
        <KpiCard label="Pending Approval" value={String(d.pendingApproval)} sub={`${d.approvalRate}% approval rate`} icon={<AlertCircle size={18} />} color="#f59e0b" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <Card title="Hours Over Time">
          {d.totalHoursByPeriod.length === 0 ? <EmptyState text="No time entries for this period" /> : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={d.totalHoursByPeriod}>
                <defs>
                  <linearGradient id="hoursGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}h`} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={v => [fmtHours(v), 'Hours']} />
                <Area type="monotone" dataKey="hours" name="Hours" stroke="#3b82f6" strokeWidth={2} fill="url(#hoursGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Billable vs Non-Billable">
          {(d.billableVsNonBillable.billable + d.billableVsNonBillable.nonBillable) === 0
            ? <EmptyState text="No hours logged" />
            : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Billable', value: d.billableVsNonBillable.billable },
                        { name: 'Non-Billable', value: d.billableVsNonBillable.nonBillable },
                      ]}
                      dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}
                    >
                      <Cell fill="#3b82f6" />
                      <Cell fill="#e2e8f0" />
                    </Pie>
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={v => fmtHours(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                  {[
                    { label: 'Billable', value: d.billableVsNonBillable.billable, color: '#3b82f6' },
                    { label: 'Non-Billable', value: d.billableVsNonBillable.nonBillable, color: '#94a3b8' },
                  ].map((e, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: e.color, flexShrink: 0 }} />
                        <span style={{ color: '#6b7280' }}>{e.label}</span>
                      </div>
                      <span style={{ fontWeight: 600, color: '#1a1f36' }}>{e.value.toFixed(1)}h</span>
                    </div>
                  ))}
                </div>
              </>
            )
          }
        </Card>
      </div>

      <Card title="Time by Employee">
        {d.byEmployee.length === 0 ? <EmptyState text="No time entries in this period" /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Employee', 'Total Hours', 'Billable Hours', 'Billable %', 'Entries'].map(h => (
                  <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.byEmployee.map((e, i) => (
                <tr key={i} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1a1f36' }}>{e.name}</td>
                  <td style={{ padding: '10px 14px', color: '#374151' }}>{e.totalHours.toFixed(1)}h</td>
                  <td style={{ padding: '10px 14px', color: '#374151' }}>{e.billableHours.toFixed(1)}h</td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden', maxWidth: 80 }}>
                        <div style={{ width: `${e.billablePct}%`, height: '100%', background: '#3b82f6', borderRadius: 3 }} />
                      </div>
                      <span style={{ fontWeight: 600, color: e.billablePct >= 70 ? '#16a34a' : e.billablePct >= 40 ? '#d97706' : '#dc2626', minWidth: 32 }}>
                        {e.billablePct}%
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 14px', color: '#6b7280' }}>{e.entryCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}

// ── Tab: Finance ──────────────────────────────────────────────────────────────

function FinanceTab({ d }: { d: ReportsData['finance'] }) {
  const { currency, currencySymbol } = useSettingsStore()
  const fmt = (n: number) => makeFmt(currency, currencySymbol)(n)
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <KpiCard label="Total Invoiced" value={fmt(d.invoiced)} sub={`${d.invoiceStatusBreakdown.reduce((s, i) => s + i.count, 0)} invoices`} icon={<FileText size={18} />} color="#3b82f6" />
        <KpiCard label="Collected" value={fmt(d.collected)} sub={`${Math.round(d.invoiced > 0 ? (d.collected / d.invoiced) * 100 : 0)}% of invoiced`} icon={<CheckCircle size={18} />} color="#22c55e" />
        <KpiCard label="Outstanding" value={fmt(d.outstanding)} sub="sent & unpaid" icon={<Clock size={18} />} color="#f59e0b" />
        <KpiCard label="Overdue" value={fmt(d.overdue)} sub={`${d.overdueCount} invoice${d.overdueCount !== 1 ? 's' : ''}`} icon={<AlertCircle size={18} />} color="#ef4444" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <Card title="Invoiced vs Collected by Month">
          {d.revenueByMonth.length === 0 ? <EmptyState text="No invoices in this period" /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={d.revenueByMonth} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => fmt(Number(v)).replace(/\.00$/, '')} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => fmtV(v, fmt)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="invoiced" name="Invoiced" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="collected" name="Collected" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Invoice Status">
          {d.invoiceStatusBreakdown.length === 0 ? <EmptyState text="No invoices yet" /> : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={d.invoiceStatusBreakdown} dataKey="amount" nameKey="status" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {d.invoiceStatusBreakdown.map((entry, i) => (
                      <Cell key={i} fill={INVOICE_COLORS[entry.status] ?? '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => fmtV(v, fmt)} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                {d.invoiceStatusBreakdown.map((e, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: INVOICE_COLORS[e.status] ?? '#94a3b8', flexShrink: 0 }} />
                      <span style={{ color: '#6b7280', textTransform: 'capitalize' }}>{e.status}</span>
                    </div>
                    <span style={{ fontWeight: 600, color: '#1a1f36' }}>{e.count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      <Card title="Top Clients by Invoiced Amount">
        {d.topClientsByRevenue.length === 0 ? <EmptyState text="No invoice data for this period" /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Client', `Invoiced (${currency})`, `Collected (${currency})`, `Outstanding (${currency})`, 'Paid %'].map(h => (
                  <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.topClientsByRevenue.map((c, i) => (
                <tr key={i} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1a1f36' }}>{c.company}</td>
                  <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1a1f36' }}>{fmt(c.invoiced)}</td>
                  <td style={{ padding: '10px 14px', color: '#16a34a', fontWeight: 600 }}>{fmt(c.collected)}</td>
                  <td style={{ padding: '10px 14px', color: c.outstanding > 0 ? '#d97706' : '#6b7280', fontWeight: c.outstanding > 0 ? 600 : 400 }}>
                    {fmt(c.outstanding)}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 60, height: 5, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{
                          width: `${c.invoiced > 0 ? Math.round((c.collected / c.invoiced) * 100) : 0}%`,
                          height: '100%', background: '#22c55e', borderRadius: 3,
                        }} />
                      </div>
                      <span style={{ fontSize: 10, color: '#9ca3af' }}>
                        {c.invoiced > 0 ? Math.round((c.collected / c.invoiced) * 100) : 0}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const RANGES: DateRange[] = ['this_month', 'last_month', 'last_3_months', 'last_6_months', 'this_year', 'all']

export function Reports() {
  const [activeTab, setActiveTab] = useState<ReportTab>('overview')
  const [range, setRange] = useState<DateRange>('this_month')

  const { data, loading, error } = useReports(range)
  const { currency, currencySymbol } = useSettingsStore()
  const { user } = useAuthStore()
  const isManager = user?.role === 'manager' || user?.role === 'admin'

  const { data: attendanceStats, loading: attendanceLoading } = useAttendanceStats(range)

  const TABS: { id: ReportTab; label: string; icon: React.ReactNode; managerOnly?: boolean }[] = [
    { id: 'overview',    label: 'Overview',                    icon: <BarChart2 size={14} /> },
    { id: 'jobs',        label: 'Jobs',                        icon: <Briefcase size={14} /> },
    { id: 'time',        label: 'Time',                        icon: <Clock size={14} /> },
    { id: 'finance',     label: `(${currencySymbol}) Finance`, icon: undefined },
    { id: 'attendance',  label: 'Attendance',                  icon: <ScanLine size={14} />, managerOnly: true },
  ]
  const handleDownload = () => {
    if (activeTab === 'attendance') {
      if (!attendanceStats) return
      exportTab('attendance', data!, range, currency, currencySymbol, attendanceStats)
      return
    }
    if (!data) return
    exportTab(activeTab, data, range, currency, currencySymbol)
  }

  return (
    <div style={{ fontFamily: 'inherit' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1f36', margin: 0 }}>Reports & Analytics</h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '3px 0 0' }}>Insights across jobs, time, and finances</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* Download CSV */}
          <button
            onClick={handleDownload}
            disabled={activeTab === 'attendance' ? (!attendanceStats || attendanceLoading) : (!data || loading)}
            title={`Download ${activeTab} report as CSV`}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 16px', borderRadius: 8, border: '1px solid #e5e7eb',
              background: '#fff', color: '#374151', fontWeight: 600, fontSize: 13,
              cursor: (activeTab === 'attendance' ? (attendanceStats && !attendanceLoading) : (data && !loading)) ? 'pointer' : 'not-allowed',
              opacity: (activeTab === 'attendance' ? (attendanceStats && !attendanceLoading) : (data && !loading)) ? 1 : 0.5,
            }}
          >
            <Download size={14} />
            Export CSV
          </button>
          {/* Date range selector */}
          <select
            value={range}
            onChange={e => setRange(e.target.value as DateRange)}
            style={{
              background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
              padding: '9px 14px', fontSize: 13, fontWeight: 500, color: '#374151',
              cursor: 'pointer', outline: 'none',
            }}
          >
            {RANGES.map(r => (
              <option key={r} value={r}>{RANGE_LABELS[r]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, background: '#f3f4f6', borderRadius: 10, padding: 4, marginBottom: 20, width: 'fit-content' }}>
        {TABS.filter(t => !t.managerOnly || isManager).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 18px', borderRadius: 7, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
              background: activeTab === tab.id ? '#fff' : 'transparent',
              color: activeTab === tab.id ? '#1a1f36' : '#6b7280',
              boxShadow: activeTab === tab.id ? '0 1px 4px rgba(0,0,0,.08)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, gap: 10, color: '#6b7280' }}>
          <div style={{ width: 20, height: 20, border: '2px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          Loading reports…
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '16px 20px', color: '#dc2626', fontSize: 13 }}>
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={() => setRange(r => r)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {/* Tab content */}
      {!loading && !error && data && activeTab !== 'attendance' && (
        <>
          {activeTab === 'overview' && <OverviewTab d={data.overview} />}
          {activeTab === 'jobs'     && <JobsTab d={data.jobs} overview={data.overview} />}
          {activeTab === 'time'     && <TimeTab d={data.time} />}
          {activeTab === 'finance'  && <FinanceTab d={data.finance} />}
        </>
      )}
      {activeTab === 'attendance' && isManager && (
        attendanceLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, gap: 10, color: '#6b7280' }}>
            <div style={{ width: 20, height: 20, border: '2px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            Loading attendance data…
          </div>
        ) : attendanceStats ? (
          <AttendanceTab d={attendanceStats} />
        ) : (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
            <ScanLine size={40} style={{ margin: '0 auto 12px', opacity: 0.25 }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: '#6b7280' }}>No attendance data</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Attendance data will appear after employees start checking in</div>
          </div>
        )
      )}

      {/* No data yet */}
      {!loading && !error && !data && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
          <BarChart2 size={40} style={{ margin: '0 auto 12px', opacity: 0.25 }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: '#6b7280' }}>No data available</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Reports will appear once you have jobs, time entries, or invoices</div>
        </div>
      )}
    </div>
  )
}