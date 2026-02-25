import { useState } from 'react'
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  TrendingUp, DollarSign, Clock, Users, Briefcase,
  AlertCircle, CheckCircle, BarChart2, FileText, Target,
  RefreshCw, Download, Flag, Activity, Layers,
} from 'lucide-react'
import { useReports, type DateRange, type ReportsData } from '@/hooks/useReports'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n)
}

function fmtDate(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Safe formatter for Recharts Tooltip — ValueType can be string|number|array
function fmtV(v: unknown): string {
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

type ReportTab = 'overview' | 'jobs' | 'time' | 'finance'

function exportTab(tab: ReportTab, data: ReportsData, range: string) {
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
      'Revenue (AUD)': j.revenue,
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
      'Invoiced (AUD)': c.invoiced,
      'Collected (AUD)': c.collected,
      'Outstanding (AUD)': c.outstanding,
    }))
    downloadCSV(`finance-${label}.csv`, toCSV(rows.length ? rows : [{
      'Total Invoiced': data.finance.invoiced,
      'Collected': data.finance.collected,
      'Outstanding': data.finance.outstanding,
      'Overdue': data.finance.overdue,
    }]))
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
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <KpiCard label="Total Revenue" value={fmt(d.totalRevenue)} sub={`${d.totalJobs} jobs`} icon={<DollarSign size={18} />} color="#22c55e" />
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
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(Number(v) / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={v => fmtV(v)} />
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
                    {['Job', 'Client', 'Revenue', 'Margin', 'Status'].map(h => (
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
                  <td style={{ padding: '10px 12px', color: '#6b7280', whiteSpace: 'nowrap' }}>{fmtDate(j.deadline)}</td>
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
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(Number(v) / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={v => fmtV(v)} />
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
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={v => fmtV(v)} />
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
                {['Client', 'Invoiced', 'Collected', 'Outstanding', 'Paid'].map(h => (
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

const TABS: { id: ReportTab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <BarChart2 size={14} /> },
  { id: 'jobs',     label: 'Jobs',     icon: <Briefcase size={14} /> },
  { id: 'time',     label: 'Time',     icon: <Clock size={14} /> },
  { id: 'finance',  label: 'Finance',  icon: <DollarSign size={14} /> },
]

const RANGES: DateRange[] = ['this_month', 'last_month', 'last_3_months', 'last_6_months', 'this_year', 'all']

export function Reports() {
  const [activeTab, setActiveTab] = useState<ReportTab>('overview')
  const [range, setRange] = useState<DateRange>('this_month')

  const { data, loading, error } = useReports(range)

  const handleDownload = () => {
    if (!data) return
    exportTab(activeTab, data, range)
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
            disabled={!data || loading}
            title={`Download ${activeTab} report as CSV`}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 16px', borderRadius: 8, border: '1px solid #e5e7eb',
              background: '#fff', color: '#374151', fontWeight: 600, fontSize: 13,
              cursor: data && !loading ? 'pointer' : 'not-allowed',
              opacity: data && !loading ? 1 : 0.5,
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
        {TABS.map(tab => (
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
      {!loading && !error && data && (
        <>
          {activeTab === 'overview' && <OverviewTab d={data.overview} />}
          {activeTab === 'jobs'     && <JobsTab d={data.jobs} overview={data.overview} />}
          {activeTab === 'time'     && <TimeTab d={data.time} />}
          {activeTab === 'finance'  && <FinanceTab d={data.finance} />}
        </>
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
