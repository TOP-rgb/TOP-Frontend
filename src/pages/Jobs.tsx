import { useState, useEffect, useRef } from 'react'
import type { Job, JobStatus, Priority, BillingType } from '@/types'
import { Modal } from '@/components/ui/Modal'
import { formatDate, formatDateForInput } from '@/lib/utils'
import { Search, Plus, Eye, Edit2, Loader2, Check, Filter, Layout, Star, Lock, AlertTriangle, Clock, Columns3, Trash2 } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useSettings } from '@/hooks/useSettings'
import { useJobs } from '@/hooks/useJobs'
import { useClients } from '@/hooks/useClients'
import { useUsers } from '@/hooks/useUsers'
import { useTasks } from '@/hooks/useTasks'
import { useJobLayouts } from '@/hooks/useLayouts'
import type { LayoutField, JobLayout } from '@/hooks/useLayouts'
import { Pagination } from '@/components/ui/Pagination'
import { toast } from 'sonner'

// ── Currency formatter factory ────────────────────────────────────────────────
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

// ── Date formatter with settings ──────────────────────────────────────────────
function formatDateWithSettings(d: string | null | undefined, format: string): string {
  if (!d) return '—'
  const date = new Date(d)
  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const year = date.getFullYear()
  
  switch(format) {
    case 'MM/DD/YYYY':
      return `${month}/${day}/${year}`
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`
    case 'DD/MM/YYYY':
    default:
      return `${day}/${month}/${year}`
  }
}

// ── Round hours based on billing increment ────────────────────────────────────
function roundHours(hours: number, increment: number): number {
  const incrementHours = increment / 60
  return Math.ceil(hours / incrementHours) * incrementHours
}

// ── Calculate cost based on ratio ─────────────────────────────────────────────
function calculateCost(revenue: number, costRatio: number): number {
  return revenue * costRatio
}

// ── Check if job is over/under hours ──────────────────────────────────────────
function checkHourThresholds(actual: number, quoted: number, threshold: number): {
  isUnder: boolean
  isOver: boolean
  message: string | null
} {
  const diff = actual - quoted
  const isUnder = diff < -threshold
  const isOver = diff > threshold
  let message = null
  
  if (isUnder) message = `Under by ${Math.abs(diff)}h (threshold: ${threshold}h)`
  if (isOver) message = `Over by ${diff}h (threshold: ${threshold}h)`
  
  return { isUnder, isOver, message }
}

// ── Format decimal hours as "1h 30m" ──────────────────────────────────────────
function fmtHours(hours: number | null | undefined): string {
  if (hours == null || isNaN(hours)) return '—'
  if (hours === 0) return '0h'
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (m === 0) return `${h}h`
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}

const STATUS_FLOW: JobStatus[] = ['open', 'in_progress', 'on_hold', 'completed', 'invoiced', 'closed']

const statusLabel: Record<JobStatus, string> = {
  open: 'Open', in_progress: 'In Progress', on_hold: 'On Hold',
  completed: 'Completed', invoiced: 'Invoiced', closed: 'Closed',
}

const priorityColor: Record<Priority, string> = {
  low: '#64748b', medium: '#2563eb', high: '#f59e0b', urgent: '#ef4444',
}

export function Jobs() {
  const { user } = useAuthStore()
  const { data: settings } = useSettings()

  // Extract all needed settings
  const currency = settings.currency
  const currencySymbol = settings.currencySymbol
  const dateFormat = settings.dateFormat
  const defaultHourlyRate = settings.defaultHourlyRate
  const hourlyCostRatio = settings.hourlyCostRatio
  const dailyHoursThreshold = settings.dailyHoursThreshold
  const flagUnderHours = settings.flagUnderHours
  const flagOverHours = settings.flagOverHours
  const requireClientForJob = settings.requireClientForJob
  const billingIncrement = settings.billingIncrement
  const notifyJobDeadline = settings.notifyJobDeadline

  const fmt = (n: number) => makeFmt(currency, currencySymbol)(n)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showModal, setShowModal] = useState(false)
  const [selected, setSelected] = useState<Job | null>(null)
  const [detailJob, setDetailJob] = useState<Job | null>(null)
  const [showColumnPicker, setShowColumnPicker] = useState(false)
  const columnPickerRef = useRef<HTMLDivElement>(null)
  const [showFilterPanel, setShowFilterPanel]     = useState(false)
  const filterPanelRef                            = useRef<HTMLDivElement>(null)
  const [filterPriorities, setFilterPriorities]   = useState<Priority[]>([])
  const [filterClientId, setFilterClientId]       = useState<string>('')
  const [filterManagerId, setFilterManagerId]     = useState<string>('')
  const [filterBillingType, setFilterBillingType] = useState<BillingType | 'all'>('all')
  const [filterDeadlineFrom, setFilterDeadlineFrom] = useState<string>('')
  const [filterDeadlineTo, setFilterDeadlineTo]     = useState<string>('')
  const [jobsPage, setJobsPage]                     = useState(1)
  const [jobsPageSize, setJobsPageSize]             = useState(25)
  const [confirmDeleteJob, setConfirmDeleteJob]     = useState<string | null>(null)

  const { jobs, loading, error, createJob, updateJob, updateStatus: apiUpdateStatus, deleteJob } = useJobs()
  const { clients } = useClients()
  const { users: managers } = useUsers({ role: 'manager', status: 'active' })
  const { tasks } = useTasks()

  // Page-level layout for driving status/priority options in the table filters + inline dropdowns
  const { defaultLayout: pageJobLayout } = useJobLayouts()
  const pageStatusOpts: string[] = pageJobLayout?.fields.find(f => f.key === 'status')?.options ?? STATUS_FLOW

  // ── Column visibility (including custom fields from layout) ─────────────────
  // Extract custom (non-system) fields from the default layout
  const customFields: LayoutField[] = pageJobLayout?.fields.filter(f => !f.system) ?? []

  // Define all available columns. System columns are always available; custom columns come from layout.
  type ColumnDef = {
    key: string
    label: string
    defaultVisible: boolean
    employeeHidden?: boolean   // hidden from employees regardless
    isCustom?: boolean
    customField?: LayoutField
  }

  const allColumns: ColumnDef[] = [
    { key: 'jobId',             label: 'Job ID',             defaultVisible: true },
    { key: 'title',             label: 'Job Name',           defaultVisible: true },
    { key: 'clientName',        label: 'Client Name',        defaultVisible: true },
    { key: 'billingRate',       label: `Billing Rate (${currency})`, defaultVisible: true, employeeHidden: true },
    { key: 'quoteApprovedDate', label: 'Quote Approved Date',defaultVisible: true },
    { key: 'startDate',         label: 'Start Date',         defaultVisible: true },
    { key: 'quotedHours',       label: 'Quoted Hours',       defaultVisible: true },
    { key: 'actualHours',       label: 'Actual Hours',       defaultVisible: true },
    { key: 'deadline',          label: 'End Date',           defaultVisible: true },
    { key: 'priority',          label: 'Priority',           defaultVisible: true },
    { key: 'status',            label: 'Status',             defaultVisible: true },
    // Custom fields from layout
    ...customFields.map(f => ({
      key: `cf_${f.key}`,
      label: f.label,
      defaultVisible: false,
      isCustom: true,
      customField: f,
    })),
  ]

  // Load saved column visibility from localStorage (per-user persistence)
  const COLUMNS_STORAGE_KEY = 'top_jobs_visible_columns'
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(COLUMNS_STORAGE_KEY)
      if (saved) return new Set(JSON.parse(saved))
    } catch { /* ignore */ }
    return new Set(allColumns.filter(c => c.defaultVisible).map(c => c.key))
  })

  // Persist column visibility changes
  const toggleColumn = (key: string) => {
    setVisibleColumns(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify([...next]))
      return next
    })
  }

  // Close column picker on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (columnPickerRef.current && !columnPickerRef.current.contains(e.target as Node)) {
        setShowColumnPicker(false)
      }
    }
    if (showColumnPicker) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showColumnPicker])

  // Close filter panel on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (filterPanelRef.current && !filterPanelRef.current.contains(e.target as Node)) {
        setShowFilterPanel(false)
      }
    }
    if (showFilterPanel) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showFilterPanel])

  // Reset to page 1 when any filter changes
  useEffect(() => { setJobsPage(1) }, [search, statusFilter, filterPriorities, filterClientId, filterManagerId, filterBillingType, filterDeadlineFrom, filterDeadlineTo])

  // Columns actually shown (respecting employee visibility)
  const isEmployee = user?.role === 'employee'
  const activeColumns = allColumns.filter(c => visibleColumns.has(c.key) && !(c.employeeHidden && isEmployee))

  // Calculate actual hours for each job from tasks
  const jobsWithActualHours = jobs.map(job => {
    const jobTasks = tasks.filter(t => t.jobId === job.id)
    const actualHours = jobTasks.reduce((sum, task) => sum + (task.actualHours || 0), 0)
    return {
      ...job,
      actualHours: actualHours > 0 ? actualHours : job.actualHours // Use task hours if available, otherwise fallback to job.actualHours
    }
  })

  const myTaskJobIds = user?.role === 'employee'
  ? tasks.filter(t => t.assignedToIds?.includes(user.id)).map(t => t.jobId)
  : null

// ✅ Move AFTER myTaskJobIds, filter by assigned jobs for employees
const deadlineAlertJobs = notifyJobDeadline
  ? jobsWithActualHours.filter(j => {
      if (!j.deadline) return false
      if (['completed', 'invoiced', 'closed'].includes(j.status)) return false
      // ✅ employees only see deadlines for their assigned jobs
      if (myTaskJobIds && !myTaskJobIds.includes(j.id)) return false
      const daysUntil = Math.ceil((new Date(j.deadline!).getTime() - Date.now()) / 86_400_000)
      return daysUntil <= 7
    }).sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
  : []

  const activeFilterCount =
    (filterPriorities.length > 0 ? 1 : 0) +
    (filterClientId !== '' ? 1 : 0) +
    (filterManagerId !== '' ? 1 : 0) +
    (filterBillingType !== 'all' ? 1 : 0) +
    (filterDeadlineFrom !== '' || filterDeadlineTo !== '' ? 1 : 0)

  const clearAllFilters = () => {
    setFilterPriorities([]); setFilterClientId(''); setFilterManagerId('')
    setFilterBillingType('all'); setFilterDeadlineFrom(''); setFilterDeadlineTo('')
  }

  const filtered = jobsWithActualHours.filter(j => {
    const matchSearch   = j.title.toLowerCase().includes(search.toLowerCase()) ||
      j.jobId.toLowerCase().includes(search.toLowerCase()) ||
      j.clientName.toLowerCase().includes(search.toLowerCase())
    const matchStatus   = statusFilter === 'all' || j.status === statusFilter
    const matchEmployee = myTaskJobIds ? myTaskJobIds.includes(j.id) : true
    const matchPriority = filterPriorities.length === 0 || filterPriorities.includes(j.priority as Priority)
    const matchClient   = filterClientId === '' || j.clientId === filterClientId
    const matchManager  = filterManagerId === '' || j.assignedManager === filterManagerId
    const matchBilling  = filterBillingType === 'all' || j.billingType === filterBillingType
    const matchFrom     = filterDeadlineFrom === '' || (j.deadline != null && j.deadline >= filterDeadlineFrom)
    const matchTo       = filterDeadlineTo === '' || (j.deadline != null && j.deadline <= filterDeadlineTo)
    return matchSearch && matchStatus && matchEmployee &&
      matchPriority && matchClient && matchManager && matchBilling && matchFrom && matchTo
  })

  const paginatedJobs = filtered.slice((jobsPage - 1) * jobsPageSize, jobsPage * jobsPageSize)

  const canEdit = user?.role !== 'employee'

  if (loading) return (
    <div className="flex items-center justify-center h-64 gap-3 text-slate-500 dark:text-slate-400">
      <Loader2 className="animate-spin" size={20} />
      <span className="text-sm">Loading jobs...</span>
    </div>
  )

  if (error) return (
    <div className="rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm px-5 py-4">
      Failed to load jobs: {error}
    </div>
  )

  return (
    <div style={{ fontFamily: 'inherit' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 className="text-slate-900 dark:text-slate-100" style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Jobs & Tasks</h1>
        {canEdit && (
          <button
            onClick={() => { setSelected(null); setShowModal(true) }}
            style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
          >
            <Plus size={16} /> Create Job
          </button>
        )}
      </div>

      {/* ── Deadline warning banner ───────────────────────────────────── */}
      {deadlineAlertJobs.length > 0 && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/50" style={{ borderRadius: 12, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div className="bg-orange-100 dark:bg-orange-900/40" style={{ width: 34, height: 34, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <AlertTriangle size={17} color="#ea580c" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#9a3412', marginBottom: 8 }}>
              {deadlineAlertJobs.filter(j => new Date(j.deadline!) < new Date()).length > 0
                ? `${deadlineAlertJobs.length} job${deadlineAlertJobs.length > 1 ? 's' : ''} at or past deadline`
                : `${deadlineAlertJobs.length} job${deadlineAlertJobs.length > 1 ? 's' : ''} approaching deadline`}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {deadlineAlertJobs.map(j => {
                const daysUntil = Math.ceil((new Date(j.deadline!).getTime() - Date.now()) / 86_400_000)
                const isOverdue = daysUntil < 0
                return (
                  <span key={j.id} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                    background: isOverdue ? '#fee2e2' : '#fff',
                    color: isOverdue ? '#b91c1c' : '#92400e',
                    border: `1px solid ${isOverdue ? '#fecaca' : '#fdba74'}`,
                  }}>
                    <Clock size={10} />
                    <span style={{ fontFamily: 'monospace' }}>{j.jobId}</span>
                    {j.title}
                    <span style={{ fontWeight: 400, opacity: 0.8 }}>
                      {isOverdue ? `${Math.abs(daysUntil)}d overdue` : daysUntil === 0 ? 'due today' : `${daysUntil}d left`}
                    </span>
                  </span>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Table Card */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700" style={{ borderRadius: 12 }}>
        {/* Toolbar */}
        <div className="border-b border-slate-100 dark:border-slate-700/50" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', flexWrap: 'wrap', gap: 10, position: 'relative', zIndex: 10 }}>
          {/* Status filter pills */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              onClick={() => setStatusFilter('all')}
              className={statusFilter === 'all' ? '' : 'dark:bg-slate-700 dark:text-slate-300'}
              style={{
                padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: statusFilter === 'all' ? '#1a1f36' : '#f3f4f6',
                color: statusFilter === 'all' ? '#fff' : '#6b7280',
              }}
            >All</button>
            {pageStatusOpts.map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
                className={statusFilter === s ? '' : 'dark:bg-slate-700 dark:text-slate-300'}
                style={{
                  padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  background: statusFilter === s ? '#2563eb' : '#f3f4f6',
                  color: statusFilter === s ? '#fff' : '#6b7280',
                }}
              >{(statusLabel as Record<string, string>)[s] ?? s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</button>
            ))}
          </div>
          {/* Search + filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input
                placeholder="Search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600"
                style={{ paddingLeft: 32, paddingRight: 12, paddingTop: 7, paddingBottom: 7, border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 13, outline: 'none', width: '100%', maxWidth: 180 }}
              />
            </div>
            {/* Filter panel */}
            <div style={{ position: 'relative' }} ref={filterPanelRef}>
              <button
                onClick={() => setShowFilterPanel(p => !p)}
                className={`text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600 ${showFilterPanel || activeFilterCount > 0 ? 'bg-slate-100 dark:bg-slate-600' : 'bg-white dark:bg-slate-700'}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '7px 13px', borderRadius: 7,
                  fontSize: 13, cursor: 'pointer', fontWeight: 500,
                }}
              >
                <Filter size={13} /> Filters
                {activeFilterCount > 0 && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    background: '#2563eb', color: '#fff', borderRadius: 99,
                    fontSize: 11, fontWeight: 700, minWidth: 18, height: 18, padding: '0 5px',
                  }}>{activeFilterCount}</span>
                )}
              </button>

              {showFilterPanel && (
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700" style={{
                  position: 'absolute', right: 0, top: '100%', marginTop: 6,
                  borderRadius: 10,
                  boxShadow: '0 8px 24px rgba(0,0,0,.12)', width: '100%', maxWidth: 300, minWidth: 260, zIndex: 200,
                }}>
                  {/* Panel header */}
                  <div className="border-b border-slate-100 dark:border-slate-700/50" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px' }}>
                    <span className="text-slate-700 dark:text-slate-300" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Filters</span>
                    {activeFilterCount > 0 && (
                      <button
                        onClick={clearAllFilters}
                        style={{ fontSize: 12, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}
                      >Clear all</button>
                    )}
                  </div>

                  {/* Priority */}
                  <div className="border-b border-slate-100 dark:border-slate-700/50" style={{ padding: '12px 14px' }}>
                    <div className="text-slate-500 dark:text-slate-400" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Priority</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {(['low', 'medium', 'high', 'urgent'] as Priority[]).map(p => (
                        <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                          <input
                            type="checkbox"
                            checked={filterPriorities.includes(p)}
                            onChange={() => setFilterPriorities(prev =>
                              prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
                            )}
                            style={{ accentColor: '#2563eb', width: 14, height: 14 }}
                          />
                          <span style={{ color: priorityColor[p], fontWeight: 600, textTransform: 'capitalize' }}>{p}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Client */}
                  <div className="border-b border-slate-100 dark:border-slate-700/50" style={{ padding: '12px 14px' }}>
                    <div className="text-slate-500 dark:text-slate-400" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Client</div>
                    <select
                      value={filterClientId}
                      onChange={e => setFilterClientId(e.target.value)}
                      className="bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-100 border border-slate-200 dark:border-slate-600"
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}
                    >
                      <option value="">All clients</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  {/* Assigned Manager */}
                  <div className="border-b border-slate-100 dark:border-slate-700/50" style={{ padding: '12px 14px' }}>
                    <div className="text-slate-500 dark:text-slate-400" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Assigned Manager</div>
                    <select
                      value={filterManagerId}
                      onChange={e => setFilterManagerId(e.target.value)}
                      className="bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-100 border border-slate-200 dark:border-slate-600"
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}
                    >
                      <option value="">All managers</option>
                      {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>

                  {/* Billing Type */}
                  <div className="border-b border-slate-100 dark:border-slate-700/50" style={{ padding: '12px 14px' }}>
                    <div className="text-slate-500 dark:text-slate-400" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Billing Type</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(['all', 'hourly', 'fixed'] as const).map(bt => (
                        <button
                          key={bt}
                          onClick={() => setFilterBillingType(bt)}
                          className={filterBillingType === bt ? 'bg-blue-600 text-white border border-blue-600' : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-200 border border-slate-200 dark:border-slate-600'}
                          style={{
                            flex: 1, padding: '6px 0', borderRadius: 6,
                            fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
                          }}
                        >{bt}</button>
                      ))}
                    </div>
                  </div>

                  {/* Deadline */}
                  <div style={{ padding: '12px 14px' }}>
                    <div className="text-slate-500 dark:text-slate-400" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Deadline</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, color: '#9ca3af', width: 30 }}>From</span>
                        <input
                          type="date"
                          value={filterDeadlineFrom}
                          onChange={e => setFilterDeadlineFrom(e.target.value)}
                          className="text-slate-700 dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600"
                          style={{ flex: 1, padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13 }}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, color: '#9ca3af', width: 30 }}>To</span>
                        <input
                          type="date"
                          value={filterDeadlineTo}
                          min={filterDeadlineFrom || undefined}
                          onChange={e => setFilterDeadlineTo(e.target.value)}
                          className="text-slate-700 dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600"
                          style={{ flex: 1, padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13 }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Column picker */}
            <div style={{ position: 'relative' }} ref={columnPickerRef}>
              <button
                onClick={() => setShowColumnPicker(p => !p)}
                className={`text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600 ${showColumnPicker ? 'bg-slate-100 dark:bg-slate-600' : 'bg-white dark:bg-slate-700'}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '7px 13px', borderRadius: 7,
                  fontSize: 13, cursor: 'pointer', fontWeight: 500,
                }}
                title="Choose columns"
              >
                <Columns3 size={13} /> Columns
              </button>

              {showColumnPicker && (
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hide-scrollbar" style={{
                  position: 'absolute', right: 0, top: '100%', marginTop: 6,
                  borderRadius: 10,
                  boxShadow: '0 8px 24px rgba(0,0,0,.12)', width: 240, zIndex: 200,
                  maxHeight: 400, overflowY: 'auto',
                }}>
                  <div className="border-b border-slate-100 dark:border-slate-700/50" style={{ padding: '10px 14px' }}>
                    <span className="text-slate-700 dark:text-slate-300" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      System Columns
                    </span>
                  </div>
                  {allColumns.filter(c => !c.isCustom && !(c.employeeHidden && isEmployee)).map(col => (
                    <label
                      key={col.key}
                      className={`flex items-center gap-2.5 px-3.5 py-2 cursor-pointer text-[13px] text-slate-700 dark:text-slate-300 transition-colors ${
                        visibleColumns.has(col.key)
                          ? 'bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50'
                          : 'bg-transparent hover:bg-slate-50 dark:hover:bg-slate-700/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={visibleColumns.has(col.key)}
                        onChange={() => toggleColumn(col.key)}
                        style={{ accentColor: '#2563eb', width: 15, height: 15 }}
                      />
                      {col.label}
                    </label>
                  ))}

                  {customFields.length > 0 && (
                    <>
                      <div className="border-t border-b border-slate-100 dark:border-slate-700/50" style={{ padding: '10px 14px' }}>
                        <span className="text-slate-700 dark:text-slate-300" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Custom Fields
                        </span>
                      </div>
                      {allColumns.filter(c => c.isCustom).map(col => (
                        <label
                          key={col.key}
                          className={`flex items-center gap-2.5 px-3.5 py-2 cursor-pointer text-[13px] text-slate-700 dark:text-slate-300 transition-colors ${
                            visibleColumns.has(col.key)
                              ? 'bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50'
                              : 'bg-transparent hover:bg-slate-50 dark:hover:bg-slate-700/50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={visibleColumns.has(col.key)}
                            onChange={() => toggleColumn(col.key)}
                            style={{ accentColor: '#2563eb', width: 15, height: 15 }}
                          />
                          {col.label}
                        </label>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="hide-scrollbar" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60">
                {activeColumns.map(col => (
                  <th key={col.key} className="text-slate-600 dark:text-slate-400" style={{ textAlign: 'left', padding: '11px 16px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                    {col.label}
                  </th>
                ))}
                <th style={{ padding: '11px 16px' }} />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={activeColumns.length + 1} style={{ textAlign: 'center', padding: '48px 18px', color: '#9ca3af', fontSize: 14 }}>No jobs found</td></tr>
              ) : paginatedJobs.map((job, i) => {
                // Calculate hour thresholds if enabled
                const hourCheck = (flagUnderHours || flagOverHours)
                  ? checkHourThresholds(job.actualHours, job.quotedHours, dailyHoursThreshold)
                  : { isUnder: false, isOver: false, message: null }

                // Helper to render a custom field value
                const renderCFValue = (cf: LayoutField | undefined) => {
                  if (!cf) return '—'
                  const val = job.customFieldValues?.[cf.key]
                  if (val === undefined || val === null || val === '') return '—'
                  if (cf.type === 'checkbox') return val ? 'Yes' : 'No'
                  if (cf.type === 'date') return formatDateWithSettings(String(val), dateFormat)
                  if (cf.type === 'number') return String(val)
                  return String(val)
                }

                return (
                <tr key={job.id} className={`border-t border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/50 ${i % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50/50 dark:bg-slate-800/60'}`}>
                  {activeColumns.map(col => {
                    const tdStyle: React.CSSProperties = { padding: '12px 16px', fontSize: 13 }

                    switch (col.key) {
                      case 'jobId':
                        return (
                          <td key={col.key} style={tdStyle}>
                            <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, padding: '3px 8px', borderRadius: 5 }}>{job.jobId}</span>
                          </td>
                        )
                      case 'title':
                        return (
                          <td key={col.key} className="text-slate-900 dark:text-slate-200" style={{ ...tdStyle, fontWeight: 600, maxWidth: 180, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {job.title}
                            {hourCheck.message && (hourCheck.isUnder && flagUnderHours || hourCheck.isOver && flagOverHours) && (
                              <span style={{
                                marginLeft: 8, fontSize: 10,
                                color: hourCheck.isOver ? '#ef4444' : '#f59e0b',
                                background: hourCheck.isOver ? '#fee2e2' : '#fef3c7',
                                padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap',
                              }}>
                                {hourCheck.isOver ? '⚠️ Over' : '⚠️ Under'}
                              </span>
                            )}
                          </td>
                        )
                      case 'clientName':
                        return <td key={col.key} style={tdStyle}><div className="text-slate-900 dark:text-slate-200" style={{ fontWeight: 600 }}>{job.clientName}</div></td>
                      case 'billingRate':
                        return <td key={col.key} className="text-slate-700 dark:text-slate-300" style={tdStyle}>{job.billingType === 'fixed' ? fmt(job.billingRate) : `${fmt(job.billingRate)}/hr`}</td>
                      case 'quoteApprovedDate':
                        return <td key={col.key} className="text-slate-500 dark:text-slate-400" style={tdStyle}>{formatDateWithSettings(job.quoteApprovedDate, dateFormat)}</td>
                      case 'startDate':
                        return <td key={col.key} className="text-slate-500 dark:text-slate-400" style={tdStyle}>{formatDateWithSettings(job.startDate, dateFormat)}</td>
                      case 'quotedHours':
                        return <td key={col.key} className="text-slate-700 dark:text-slate-300" style={tdStyle}>{fmtHours(job.quotedHours)}</td>
                      case 'actualHours':
                        return <td key={col.key} className="text-slate-700 dark:text-slate-300" style={tdStyle}>{fmtHours(job.actualHours)}</td>
                      case 'deadline':
                        return <td key={col.key} className="text-slate-500 dark:text-slate-400" style={tdStyle}>{formatDateWithSettings(job.deadline, dateFormat)}</td>
                      case 'priority':
                        return (
                          <td key={col.key} style={tdStyle}>
                            <span style={{ fontWeight: 600, color: priorityColor[job.priority], textTransform: 'capitalize' }}>{job.priority}</span>
                          </td>
                        )
                      case 'status':
                        return (
                          <td key={col.key} style={tdStyle}>
                            {canEdit ? (
                              <select
                                value={job.status}
                                onChange={e => apiUpdateStatus(job.id, e.target.value as JobStatus)}
                                className="bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-100 border border-slate-200 dark:border-slate-600"
                                style={{ fontSize: 12, borderRadius: 6, padding: '4px 8px', cursor: 'pointer', outline: 'none' }}
                              >
                                {pageStatusOpts.map(s => (
                                  <option key={s} value={s}>
                                    {(statusLabel as Record<string, string>)[s] ?? s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-slate-700 dark:text-slate-300">
                                {(statusLabel as Record<string, string>)[job.status] ?? job.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                              </span>
                            )}
                          </td>
                        )
                      default:
                        // Custom field columns
                        if (col.isCustom && col.customField) {
                          return <td key={col.key} className="text-slate-700 dark:text-slate-300" style={tdStyle}>{renderCFValue(col.customField)}</td>
                        }
                        return <td key={col.key} style={tdStyle}>—</td>
                    }
                  })}
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => setDetailJob(job)} className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-600" style={{ padding: '5px 8px', borderRadius: 6, cursor: 'pointer' }} title="View">
                        <Eye size={14} />
                      </button>
                      {canEdit && (
                        <button onClick={() => { setSelected(job); setShowModal(true) }} className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-600" style={{ padding: '5px 8px', borderRadius: 6, cursor: 'pointer' }} title="Edit">
                          <Edit2 size={14} />
                        </button>
                      )}
                      {canEdit && (
                        <button onClick={() => setConfirmDeleteJob(job.id)} className="border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400" style={{ padding: '5px 8px', borderRadius: 6, cursor: 'pointer' }} title="Delete">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div className="border-t border-slate-100 dark:border-slate-700/50" style={{ padding: '12px 20px' }}>
          <Pagination
            total={filtered.length}
            page={jobsPage}
            pageSize={jobsPageSize}
            onPageChange={setJobsPage}
            onPageSizeChange={n => { setJobsPageSize(n); setJobsPage(1) }}
          />
        </div>
      </div>

      {/* Job detail modal — dark navy style */}
      {detailJob && (() => {
        const jobTasks = tasks.filter(t => t.jobId === detailJob.id)
        const taskActual = jobTasks.reduce((s, t) => s + (t.actualHours || 0), 0)
        const taskEstimated = jobTasks.reduce((s, t) => s + (t.estimatedHours || 0), 0)
        const dispActual = jobTasks.length > 0 ? taskActual : detailJob.actualHours
        const dispEstimated = jobTasks.length > 0 ? taskEstimated : detailJob.quotedHours
        const hoursPct = dispEstimated > 0 ? Math.min(Math.round((dispActual / dispEstimated) * 100), 100) : 0
        const hoursOver = dispActual > dispEstimated
        const totalTasks = jobTasks.length
        const completedTasks = jobTasks.filter(t => t.status === 'completed').length
        const inProgressTasks = jobTasks.filter(t => t.status === 'in_progress').length
        const taskPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
        
        // Calculate cost using ratio from settings
        const calculatedCost = detailJob.revenue ? calculateCost(detailJob.revenue, hourlyCostRatio) : 0
        const calculatedProfit = detailJob.revenue ? detailJob.revenue - calculatedCost : 0
        const calculatedMargin = detailJob.revenue ? Math.round((calculatedProfit / detailJob.revenue) * 100) : 0
        
        const sc = ({ open: { bg: '#1e3a5f', color: '#60a5fa' }, in_progress: { bg: '#14532d40', color: '#86efac' }, on_hold: { bg: '#78350f30', color: '#fcd34d' }, completed: { bg: '#14532d60', color: '#4ade80' }, invoiced: { bg: '#312e8130', color: '#a5b4fc' }, closed: { bg: '#1e293b', color: '#64748b' } } as Record<string,{bg:string;color:string}>)[detailJob.status] ?? { bg: '#1e293b', color: '#64748b' }
        
        // Check hour thresholds for detail view
        const hourCheck = (flagUnderHours || flagOverHours) 
          ? checkHourThresholds(dispActual, dispEstimated, dailyHoursThreshold)
          : { isUnder: false, isOver: false, message: null }
        
        return (
        <Modal open={!!detailJob} onClose={() => setDetailJob(null)} title="" size="full">
          <div className="modal-flex" style={{ background: '#152035', borderRadius: 12, margin: -24, display: 'flex', overflow: 'hidden', minHeight: 460 }}>

            {/* Left sidebar */}
            <div className="modal-sidebar" style={{ width: 196, minWidth: 196, background: '#0f1a2e', padding: '24px 18px', display: 'flex', flexDirection: 'column', gap: 18, borderRight: '1px solid #1e2d4a' }}>
              <div style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: '#2563eb', background: '#1e3a5f', padding: '3px 10px', borderRadius: 5, display: 'inline-block', alignSelf: 'flex-start' }}>{detailJob.jobId}</div>
              {/* Status */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Status</div>
                <span style={{ display: 'inline-block', fontSize: 12, fontWeight: 700, color: sc.color, background: sc.bg, padding: '4px 12px', borderRadius: 20 }}>
                  {statusLabel[detailJob.status]}
                </span>
              </div>

              {/* Priority */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Priority</div>
                <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: '#1e2d4a', color: priorityColor[detailJob.priority as Priority] ?? '#94a3b8' }}>
                  {detailJob.priority.charAt(0).toUpperCase() + detailJob.priority.slice(1)}
                </span>
              </div>

              {/* Hour warning if enabled */}
              {(flagUnderHours || flagOverHours) && hourCheck.message && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Alert</div>
                  <span style={{ 
                    fontSize: 11, 
                    color: hourCheck.isOver ? '#ef4444' : '#f59e0b',
                    background: hourCheck.isOver ? '#451a1a' : '#422b0c',
                    padding: '4px 8px',
                    borderRadius: 6,
                    display: 'inline-block'
                  }}>
                    {hourCheck.message}
                  </span>
                </div>
              )}

              {/* Billing — hidden for employees */}
              {user?.role !== 'employee' && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Billing</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{detailJob.billingType === 'fixed' ? 'Fixed Price' : 'Hourly'}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{detailJob.billingType === 'fixed' ? fmt(detailJob.billingRate) : `${fmt(detailJob.billingRate)}/hr`}</div>
                </div>
              )}

              {/* Job Type */}
              {detailJob.jobType && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Job Type</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{detailJob.jobType}</div>
                </div>
              )}

              {/* Dates */}
              {detailJob.startDate && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Start Date</div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>{formatDateWithSettings(detailJob.startDate, dateFormat)}</div>
                </div>
              )}
              {detailJob.deadline && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Deadline</div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>{formatDateWithSettings(detailJob.deadline, dateFormat)}</div>
                </div>
              )}
            </div>

            {/* Right content */}
            <div style={{ flex: 1, minWidth: 0, padding: '24px 24px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Title */}
              <div>
                <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 18, margin: 0, marginBottom: 2, lineHeight: 1.3 }}>{detailJob.title}</h2>
                <p style={{ color: '#64748b', fontSize: 12, margin: 0 }}>{detailJob.clientName}</p>
              </div>

              {/* Progress cards — side by side */}
              <div className="modal-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

                {/* Hours Progress */}
                <div style={{ background: '#1e2d4a', border: '1px solid #2d4068', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Hours Progress</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: hoursOver ? '#f87171' : hoursPct === 100 ? '#4ade80' : '#60a5fa' }}>{hoursPct}%</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: hoursOver ? '#f87171' : '#e2e8f0', lineHeight: 1 }}>{fmtHours(dispActual)}</div>
                      <div style={{ fontSize: 10, color: '#64748b', marginTop: 3 }}>Actual</div>
                    </div>
                    <div style={{ width: 1, height: 28, background: '#2d4068', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 600, color: '#94a3b8', lineHeight: 1 }}>{fmtHours(dispEstimated)}</div>
                      <div style={{ fontSize: 10, color: '#64748b', marginTop: 3 }}>Estimated</div>
                    </div>
                  </div>
                  <div style={{ background: '#0f1a2e', borderRadius: 6, height: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 6, width: `${hoursPct}%`, background: hoursOver ? '#ef4444' : '#2563eb', transition: 'width 0.3s' }} />
                  </div>
                  {jobTasks.length === 0 && (
                    <div style={{ fontSize: 10, color: '#64748b', marginTop: 6 }}>Based on job-level hours</div>
                  )}
                </div>

                {/* Task Progress */}
                <div style={{ background: '#1e2d4a', border: '1px solid #2d4068', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total Progress</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: taskPct === 100 ? '#4ade80' : '#60a5fa' }}>{taskPct}%</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', lineHeight: 1 }}>{completedTasks}</div>
                      <div style={{ fontSize: 10, color: '#64748b', marginTop: 3 }}>Done</div>
                    </div>
                    <div style={{ width: 1, height: 28, background: '#2d4068', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 600, color: '#94a3b8', lineHeight: 1 }}>{totalTasks}</div>
                      <div style={{ fontSize: 10, color: '#64748b', marginTop: 3 }}>Total</div>
                    </div>
                    {inProgressTasks > 0 && (
                      <>
                        <div style={{ width: 1, height: 28, background: '#2d4068', flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 600, color: '#fcd34d', lineHeight: 1 }}>{inProgressTasks}</div>
                          <div style={{ fontSize: 10, color: '#64748b', marginTop: 3 }}>Active</div>
                        </div>
                      </>
                    )}
                  </div>
                  <div style={{ background: '#0f1a2e', borderRadius: 6, height: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 6, width: `${taskPct}%`, background: taskPct === 100 ? '#4ade80' : '#2563eb', transition: 'width 0.3s' }} />
                  </div>
                  {totalTasks === 0 && (
                    <div style={{ fontSize: 10, color: '#64748b', marginTop: 6 }}>No tasks yet</div>
                  )}
                </div>
              </div>

              {/* Financial cards — admin/manager only */}
              {user?.role !== 'employee' && detailJob.revenue != null && (
                <div className="modal-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                  {[
                    { label: 'Revenue', value: fmt(detailJob.revenue ?? 0), color: '#4ade80' },
                    { label: 'Cost', value: fmt(calculatedCost), color: '#f87171' },
                    { label: 'Profit', value: fmt(calculatedProfit), color: '#60a5fa' },
                    { label: 'Margin', value: `${calculatedMargin}%`, color: '#c084fc' },
                  ].map(m => (
                    <div key={m.label} style={{ background: '#1e2d4a', border: '1px solid #2d4068', borderRadius: 10, padding: '12px 10px', textAlign: 'center' }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: m.color }}>{m.value}</div>
                      <div style={{ fontSize: 10, color: '#64748b', marginTop: 3 }}>{m.label}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Footer buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 'auto', paddingTop: 4 }}>
                <button onClick={() => setDetailJob(null)}
                  style={{ padding: '8px 20px', border: '1px solid #2d4068', borderRadius: 8, background: 'transparent', color: '#94a3b8', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  Close
                </button>
                {canEdit && (
                  <button onClick={() => { setSelected(detailJob); setDetailJob(null); setShowModal(true) }}
                    style={{ padding: '8px 22px', border: 'none', borderRadius: 8, background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                    Edit Job
                  </button>
                )}
              </div>
            </div>
          </div>
        </Modal>
        )
      })()}

      {/* Create / Edit Job modal */}
      <JobModal
        key={currency} // Add key to force re-render when currency changes
        open={showModal}
        onClose={() => setShowModal(false)}
        job={selected}
        clients={clients.map(c => ({ id: c.id, company: c.company }))}
        managers={managers}
        currency={currency}
        currencySymbol={currencySymbol}
        defaultHourlyRate={defaultHourlyRate}
        requireClientForJob={requireClientForJob}
        billingIncrement={billingIncrement}
        onSave={async (j) => {
          if (selected) {
            const ok = await updateJob(selected.id, j)
            if (ok) toast.success('Job updated successfully')
            else toast.error('Failed to update job')
          } else {
            const ok = await createJob(j)
            if (ok) toast.success('Job created successfully')
            else toast.error('Failed to create job')
          }
          setShowModal(false)
        }}
      />

      {/* Delete Job confirmation */}
      {confirmDeleteJob && (
        <Modal open onClose={() => setConfirmDeleteJob(null)}>
          <div className="bg-white dark:bg-slate-800" style={{ padding: '28px 32px', maxWidth: 420, textAlign: 'center', borderRadius: 12 }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Trash2 size={24} color="#ef4444" />
            </div>
            <h3 className="text-slate-900 dark:text-slate-100" style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700 }}>Delete Job?</h3>
            <p className="text-slate-500 dark:text-slate-400" style={{ margin: '0 0 24px', fontSize: 14, lineHeight: 1.5 }}>
              This will permanently delete the job and all its associated tasks and time entries. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={() => setConfirmDeleteJob(null)} className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600" style={{ padding: '9px 24px', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={async () => {
                  const ok = await deleteJob(confirmDeleteJob)
                  if (ok) toast.success('Job deleted')
                  else toast.error('Failed to delete job')
                  setConfirmDeleteJob(null)
                }}
                style={{ padding: '9px 24px', border: 'none', borderRadius: 8, background: '#ef4444', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
              >
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── 3-step Create Job modal ───────────────────────────────────────────────

interface JobModalProps {
  open: boolean
  onClose: () => void
  job: Job | null
  onSave: (j: Job) => void
  clients: Array<{ id: string; company: string }>
  managers: Array<{ id: string; name: string }>
  currency: string
  currencySymbol: string
  defaultHourlyRate: number | null
  requireClientForJob: boolean
  billingIncrement: number
}

function JobModal({
  open,
  onClose,
  job,
  onSave,
  clients,
  managers,
  currency,
  currencySymbol,
  defaultHourlyRate,
  requireClientForJob,
  billingIncrement
}: JobModalProps) {
  // Create formatter INSIDE the component to use latest currency/symbol
  const fmt = (n: number) => {
    return new Intl.NumberFormat('en-AU', { 
      style: 'currency', 
      currency, 
      currencyDisplay: 'symbol',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    }).format(n).replace(currency, currencySymbol)
  }

  const TOTAL_STEPS = job ? 3 : 4   // Edit: skip layout selection; Create: step 1 = layout
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<Partial<Job> & { layoutId?: string; customFieldValues?: Record<string, unknown> }>(job ?? {
    title: '', clientId: '', clientName: '', jobType: '', billingType: 'hourly', billingRate: defaultHourlyRate || 0,
    quotedHours: 0, actualHours: 0, status: 'open', priority: 'medium',
    quoteApprovedDate: '', startDate: '', deadline: '', assignedManager: '',
    layoutId: undefined, customFieldValues: {},
  })

  // Layouts
  const { layouts, loading: layoutsLoading, defaultLayout } = useJobLayouts()
  const [selectedLayout, setSelectedLayout] = useState<JobLayout | null>(null)

  // Derive dropdown options from the layout active for this job/form.
  // When editing: use the layout that was saved on the job (fall back to default).
  // When creating: use the layout selected in step 1 (fall back to default).
  const activeLayout = job
    ? (layouts.find(l => l.id === (form as { layoutId?: string }).layoutId) ?? defaultLayout)
    : (selectedLayout ?? defaultLayout)

  const layoutPriorityOpts: string[]    = activeLayout?.fields.find(f => f.key === 'priority')?.options    ?? ['low', 'medium', 'high', 'urgent']
  const layoutStatusOpts: string[]      = activeLayout?.fields.find(f => f.key === 'status')?.options      ?? ['open', 'in_progress', 'on_hold', 'completed', 'invoiced', 'closed']
  const layoutBillingTypeOpts: string[] = activeLayout?.fields.find(f => f.key === 'billingType')?.options ?? ['hourly', 'fixed']

  // Update form when defaultHourlyRate changes
  useEffect(() => {
    if (!job && !form.billingRate && defaultHourlyRate) {
      setForm(f => ({ ...f, billingRate: defaultHourlyRate }))
    }
  }, [defaultHourlyRate, job, form.billingRate])

  useEffect(() => {
    setStep(1)
    if (job) {
      setForm({
        title: job.title || '', clientId: job.clientId || '', clientName: job.clientName || '',
        jobType: job.jobType || '', billingType: job.billingType || 'hourly',
        billingRate: job.billingRate || defaultHourlyRate || 0, quotedHours: job.quotedHours || 0,
        actualHours: job.actualHours || 0, status: job.status || 'open',
        priority: job.priority || 'medium',
        quoteApprovedDate: formatDateForInput(job.quoteApprovedDate),
        startDate: formatDateForInput(job.startDate), deadline: formatDateForInput(job.deadline),
        assignedManager: job.assignedManager || '',
        layoutId: (job as { layoutId?: string }).layoutId,
        customFieldValues: (job as { customFieldValues?: Record<string, unknown> }).customFieldValues ?? {},
      })
    } else {
      setForm({
        title: '', clientId: '', clientName: '', jobType: '', billingType: 'hourly', 
        billingRate: defaultHourlyRate || 0,
        quotedHours: 0, actualHours: 0, status: 'open', priority: 'medium',
        quoteApprovedDate: '', startDate: '', deadline: '', assignedManager: '',
        layoutId: undefined, customFieldValues: {},
      })
      setSelectedLayout(null)
    }
  }, [job, defaultHourlyRate])

  // When no layout selected yet, auto-select default
  useEffect(() => {
    if (!job && !selectedLayout && defaultLayout) {
      setSelectedLayout(defaultLayout)
      setForm(f => ({ ...f, layoutId: defaultLayout.id }))
    }
  }, [defaultLayout, job, selectedLayout])

  const s = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))
  const setCF = (key: string, v: unknown) => setForm(f => ({ ...f, customFieldValues: { ...(f.customFieldValues ?? {}), [key]: v } }))

  // Steps: for new job: 1=Layout, 2=Details, 3=Timeline, 4=Billing
  // For edit: 1=Details, 2=Timeline, 3=Billing (same as before)
  const steps = job
    ? [{ num: 1, label: 'Job Details' }, { num: 2, label: 'Timeline' }, { num: 3, label: 'Billing' }]
    : [{ num: 1, label: 'Select Layout' }, { num: 2, label: 'Job Details' }, { num: 3, label: 'Timeline' }, { num: 4, label: 'Billing' }]

  const darkInput: React.CSSProperties = {
    width: '100%', padding: '10px 13px', background: '#1e2d4a', border: '1px solid #2d4068',
    borderRadius: 8, color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
  }
  const lbl: React.CSSProperties = { fontSize: 13, color: '#94a3b8', fontWeight: 500, marginBottom: 5, display: 'block' }
  const req = <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>

  const handleClose = () => { onClose(); setStep(1) }
  const handleCreate = () => { onSave({ ...form, layoutId: selectedLayout?.id } as Job); setStep(1) }

  const detailStep = job ? 1 : 2
  const timelineStep = job ? 2 : 3
  const billingStep = job ? 3 : 4

  const handleNext = () => {
    if (step === detailStep) {
      if (!form.title?.trim()) { toast.error('Job name is required'); return }
      if (requireClientForJob && !form.clientId) { toast.error('Please select a client'); return }
    }
    setStep(st => st + 1)
  }

  // Custom fields from selected layout (only non-system ones)
  const customFields: LayoutField[] = selectedLayout
    ? selectedLayout.fields.filter(f => !f.system)
    : []

  const renderCustomField = (f: LayoutField) => {
    const val = (form.customFieldValues ?? {})[f.key]
    const inputCls = darkInput

    if (f.type === 'text') return (
      <input style={inputCls} value={(val as string) ?? ''} onChange={e => setCF(f.key, e.target.value)} placeholder={f.placeholder || f.label} />
    )
    if (f.type === 'number') return (
      <input style={inputCls} type="number" value={(val as string) ?? ''} onChange={e => setCF(f.key, e.target.value)} placeholder={f.placeholder || '0'} />
    )
    if (f.type === 'date') return (
      <input style={inputCls} type="date" value={(val as string) ?? ''} onChange={e => setCF(f.key, e.target.value)} />
    )
    if (f.type === 'textarea') return (
      <textarea style={{ ...inputCls, resize: 'vertical', minHeight: 72 }} value={(val as string) ?? ''} onChange={e => setCF(f.key, e.target.value)} placeholder={f.placeholder || f.label} />
    )
    if (f.type === 'select') return (
      <select style={{ ...inputCls, cursor: 'pointer' }} value={(val as string) ?? ''} onChange={e => setCF(f.key, e.target.value)}>
        <option value="">Select…</option>
        {(f.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    )
    if (f.type === 'checkbox') return (
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: '#e2e8f0', fontSize: 14 }}>
        <input type="checkbox" checked={Boolean(val)} onChange={e => setCF(f.key, e.target.checked)} />
        {f.label}
      </label>
    )
    return null
  }

  return (
    <Modal open={open} onClose={handleClose} title="" size="xl">
      <div className="modal-flex" style={{ background: '#152035', borderRadius: 12, margin: -24, padding: 0, display: 'flex', minHeight: 420, overflow: 'hidden' }}>
        {/* Left step sidebar */}
        <div className="modal-sidebar" style={{ width: 200, background: '#0f1a2e', padding: '32px 20px', flexShrink: 0 }}>
          <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 18, marginBottom: 32 }}>
            {job ? 'Edit Job' : 'Create Job'}
          </h2>
          {selectedLayout && !job && (
            <div style={{ background: '#1e2d4a', border: '1px solid #2d4068', borderRadius: 8, padding: '8px 10px', marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Layout</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>{selectedLayout.name}</div>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            {steps.map(st => (
              <div key={st.num} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, fontSize: 13, fontWeight: 700,
                  background: step > st.num ? '#16a34a' : step === st.num ? '#2563eb' : '#1e2d4a',
                  color: '#fff', border: step === st.num ? '2px solid #3b82f6' : 'none',
                }}>
                  {step > st.num ? <Check size={14} /> : st.num}
                </div>
                <span style={{ fontSize: 13, color: step === st.num ? '#fff' : '#64748b', fontWeight: step === st.num ? 600 : 400 }}>
                  {st.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right form area */}
        <div style={{ flex: 1, padding: '32px 28px', display: 'flex', flexDirection: 'column', overflowY: 'auto', maxHeight: 560 }}>

          {/* Step 1 (new only) — Layout Selection */}
          {!job && step === 1 && (
            <div>
              <h3 style={{ color: '#fff', fontWeight: 600, fontSize: 16, marginBottom: 6 }}>Select a Layout</h3>
              <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>Choose which form template to use for this job. Layout adds custom fields on top of system fields.</p>
              {layoutsLoading ? (
                <div style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                  <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} />
                </div>
              ) : layouts.length === 0 ? (
                <div style={{ background: '#1e2d4a', border: '1px solid #2d4068', borderRadius: 10, padding: 20, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                  No layouts configured yet. Go to Settings → Jobs & Tasks → Job Layouts to create one.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {layouts.map(l => (
                    <div
                      key={l.id}
                      onClick={() => { setSelectedLayout(l); setForm(f => ({ ...f, layoutId: l.id })) }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                        borderRadius: 10, cursor: 'pointer',
                        border: selectedLayout?.id === l.id ? '2px solid #3b82f6' : '1px solid #2d4068',
                        background: selectedLayout?.id === l.id ? '#1e3a5f' : '#1e2d4a',
                        transition: 'all .15s',
                      }}
                    >
                      <div style={{ width: 36, height: 36, borderRadius: 9, background: selectedLayout?.id === l.id ? '#1d4ed8' : '#152035', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Layout size={16} color={selectedLayout?.id === l.id ? '#93c5fd' : '#475569'} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>{l.name}</span>
                          {l.isDefault && <Star size={12} style={{ color: '#f59e0b', fill: '#f59e0b' }} />}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                          {l.fields.filter(f => f.system).length} system + {l.fields.filter(f => !f.system).length} custom fields
                        </div>
                      </div>
                      {selectedLayout?.id === l.id && <Check size={16} style={{ color: '#3b82f6' }} />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Job Details step */}
          {step === detailStep && (
            <div>
              <h3 style={{ color: '#fff', fontWeight: 600, fontSize: 16, marginBottom: 22 }}>Job Details</h3>
              <div className="modal-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={lbl}>Job Name {req}</label>
                  <input style={darkInput} value={form.title ?? ''} onChange={e => s('title', e.target.value)} placeholder="FY2024 Tax Return" />
                </div>
                <div>
                  <label style={lbl}>Job ID Name</label>
                  <input style={darkInput} value={form.jobType ?? ''} onChange={e => s('jobType', e.target.value)} placeholder="Tax Return" />
                </div>
                <div>
                  <label style={lbl}>
                    Assigned Client 
                    {requireClientForJob && req}
                  </label>
                  <select style={{ ...darkInput, cursor: 'pointer' }} value={form.clientId ?? ''} onChange={e => { s('clientId', e.target.value); s('clientName', clients.find(c => c.id === e.target.value)?.company ?? '') }}>
                    <option value="">Select client</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Assigned Manager</label>
                  <select style={{ ...darkInput, cursor: 'pointer' }} value={form.assignedManager ?? ''} onChange={e => s('assignedManager', e.target.value)}>
                    <option value="">— Unassigned —</option>
                    {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Priority</label>
                  <select style={{ ...darkInput, cursor: 'pointer' }} value={form.priority ?? layoutPriorityOpts[0] ?? 'medium'} onChange={e => s('priority', e.target.value as Priority)}>
                    {layoutPriorityOpts.map(p => (
                      <option key={p} value={p}>{p.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                    ))}
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={lbl}>Status</label>
                  <select style={{ ...darkInput, cursor: 'pointer' }} value={form.status ?? layoutStatusOpts[0] ?? 'open'} onChange={e => s('status', e.target.value as JobStatus)}>
                    {layoutStatusOpts.map(st => (
                      <option key={st} value={st}>{st.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                    ))}
                  </select>
                </div>

                {/* Custom fields from layout — rendered inline in Job Details step */}
                {customFields.length > 0 && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ height: 1, background: '#2d4068', margin: '8px 0 14px' }} />
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Layout size={10} /> Custom Fields from Layout
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      {customFields.map(f => (
                        <div key={f.key} style={f.type === 'textarea' ? { gridColumn: '1 / -1' } : {}}>
                          <label style={lbl}>
                            {f.label}
                            {f.required && req}
                          </label>
                          {renderCustomField(f)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Timeline step */}
          {step === timelineStep && (
            <div>
              <h3 style={{ color: '#fff', fontWeight: 600, fontSize: 16, marginBottom: 22 }}>Timeline</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="modal-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={lbl}>Start Date</label>
                    <input style={darkInput} type="date" value={form.startDate ?? ''} onChange={e => s('startDate', e.target.value)} />
                  </div>
                  <div>
                    <label style={lbl}>End Date</label>
                    <input style={darkInput} type="date" value={form.deadline ?? ''} onChange={e => s('deadline', e.target.value)} />
                  </div>
                </div>
                <div>
                  <label style={lbl}>Quote Approved Date</label>
                  <input style={darkInput} type="date" value={form.quoteApprovedDate ?? ''} onChange={e => s('quoteApprovedDate', e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* Billing step */}
          {step === billingStep && (
            <div>
              <h3 style={{ color: '#fff', fontWeight: 600, fontSize: 16, marginBottom: 22 }}>Billing Details</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="modal-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={lbl}>Billing Type</label>
                    <select style={{ ...darkInput, cursor: 'pointer' }} value={form.billingType ?? layoutBillingTypeOpts[0] ?? 'hourly'} onChange={e => s('billingType', e.target.value as BillingType)}>
                      {layoutBillingTypeOpts.map(bt => (
                        <option key={bt} value={bt}>{bt.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Billing Rate ({currency})</label>
                    <input 
                      style={darkInput} 
                      type="number" 
                      step="0.01"
                      value={String(form.billingRate ?? '')} 
                      onChange={e => s('billingRate', Number(e.target.value))} 
                      placeholder={defaultHourlyRate?.toString() || "0.00"} 
                    />
                    {defaultHourlyRate && !form.billingRate && (
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Default: {fmt(defaultHourlyRate)}/hr</div>
                    )}
                  </div>
                </div>
                <div>
                  <label style={lbl}>Quoted Billable Hours</label>
                  <input 
                    style={darkInput} 
                    type="number" 
                    step="0.25"
                    value={String(form.quotedHours ?? '')} 
                    onChange={e => s('quotedHours', Number(e.target.value))} 
                    placeholder="0" 
                  />
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                    Billing increment: {billingIncrement} minutes
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Nav buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 'auto', paddingTop: 28 }}>
            {step > 1 && (
              <button onClick={() => setStep(st => st - 1)} style={{ padding: '10px 22px', border: '1px solid #2d4068', borderRadius: 8, background: 'transparent', color: '#94a3b8', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                BACK
              </button>
            )}
            <button onClick={handleClose} style={{ padding: '10px 22px', border: '1px solid #2d4068', borderRadius: 8, background: 'transparent', color: '#94a3b8', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
              CANCEL
            </button>
            {step < TOTAL_STEPS ? (
              <button onClick={handleNext} style={{ padding: '10px 28px', border: 'none', borderRadius: 8, background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                NEXT
              </button>
            ) : (
              <button onClick={handleCreate} style={{ padding: '10px 28px', border: 'none', borderRadius: 8, background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                {job ? 'SAVE' : 'CREATE'}
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}