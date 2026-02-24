import { useState, useEffect } from 'react'
import type { Job, JobStatus, Priority, BillingType } from '@/types'
import { Modal } from '@/components/ui/Modal'
import { formatCurrency, formatDate, formatDateForInput } from '@/lib/utils'
import { Search, Plus, Eye, Edit2, Loader2, Check, Filter } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useJobs } from '@/hooks/useJobs'
import { useClients } from '@/hooks/useClients'
import { useTasks } from '@/hooks/useTasks'
import { toast } from 'sonner'

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
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | JobStatus>('all')
  const [showModal, setShowModal] = useState(false)
  const [selected, setSelected] = useState<Job | null>(null)
  const [detailJob, setDetailJob] = useState<Job | null>(null)

  const { jobs, loading, error, createJob, updateJob, updateStatus: apiUpdateStatus } = useJobs()
  const { clients } = useClients()
  const { tasks } = useTasks()

  // For employees: only show jobs linked to tasks assigned to them
  const myTaskJobIds = user?.role === 'employee'
    ? tasks.filter(t => t.assignedToIds?.includes(user.id)).map(t => t.jobId)
    : null

  const filtered = jobs.filter(j => {
    const matchSearch = j.title.toLowerCase().includes(search.toLowerCase()) ||
      j.jobId.toLowerCase().includes(search.toLowerCase()) ||
      j.clientName.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || j.status === statusFilter
    const matchEmployee = myTaskJobIds ? myTaskJobIds.includes(j.id) : true
    return matchSearch && matchStatus && matchEmployee
  })

  const canEdit = user?.role !== 'employee'

  if (loading) return (
    <div className="flex items-center justify-center h-64 gap-3 text-slate-500">
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
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1f36', margin: 0 }}>Jobs & Tasks</h1>
        {canEdit && (
          <button
            onClick={() => { setSelected(null); setShowModal(true) }}
            style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
          >
            <Plus size={16} /> Create Job
          </button>
        )}
      </div>

      {/* Table Card */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #f1f3f9', flexWrap: 'wrap', gap: 10 }}>
          {/* Status filter pills */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              onClick={() => setStatusFilter('all')}
              style={{
                padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: statusFilter === 'all' ? '#1a1f36' : '#f3f4f6',
                color: statusFilter === 'all' ? '#fff' : '#6b7280',
              }}
            >All</button>
            {STATUS_FLOW.map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
                style={{
                  padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  background: statusFilter === s ? '#2563eb' : '#f3f4f6',
                  color: statusFilter === s ? '#fff' : '#6b7280',
                }}
              >{statusLabel[s]}</button>
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
                style={{ paddingLeft: 32, paddingRight: 12, paddingTop: 7, paddingBottom: 7, border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 13, outline: 'none', width: 180 }}
              />
            </div>
            <button style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 13px', border: '1px solid #e5e7eb', borderRadius: 7, background: '#fff', fontSize: 13, color: '#6b7280', cursor: 'pointer', fontWeight: 500 }}>
              <Filter size={13} /> Filters
            </button>
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Job ID', 'Job Name', 'Client Name', ...(user?.role !== 'employee' ? ['Billing Type', 'Billing Rate'] : []), 'Quote Approved Date', 'Start Date', 'Quoted Hours', 'End Date', 'Priority', 'Status', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '11px 16px', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={user?.role !== 'employee' ? 12 : 10} style={{ textAlign: 'center', padding: '48px 18px', color: '#9ca3af', fontSize: 14 }}>No jobs found</td></tr>
              ) : filtered.map((job, i) => (
                <tr key={job.id} style={{ borderTop: '1px solid #f1f3f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '3px 8px', borderRadius: 5 }}>{job.jobId}</span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#1a1f36', maxWidth: 180, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {job.title}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1f36' }}>{job.clientName}</div>
                  </td>
                  {user?.role !== 'employee' && (
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#374151', textTransform: 'capitalize' }}>{job.billingType}</td>
                  )}
                  {user?.role !== 'employee' && (
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#374151' }}>
                      {job.billingType === 'fixed' ? formatCurrency(job.billingRate) : `${formatCurrency(job.billingRate)}/hr`}
                    </td>
                  )}
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#6b7280' }}>{formatDate(job.quoteApprovedDate) || '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#6b7280' }}>{formatDate(job.startDate) || '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#374151' }}>{job.quotedHours}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#6b7280' }}>{formatDate(job.deadline) || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: priorityColor[job.priority], textTransform: 'capitalize' }}>{job.priority}</span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {canEdit ? (
                      <select
                        value={job.status}
                        onChange={e => apiUpdateStatus(job.id, e.target.value as JobStatus)}
                        style={{ fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, padding: '4px 8px', background: '#fff', cursor: 'pointer', outline: 'none' }}
                      >
                        {STATUS_FLOW.map(s => <option key={s} value={s}>{statusLabel[s]}</option>)}
                      </select>
                    ) : (
                      <span style={{ fontSize: 13, color: '#374151' }}>{statusLabel[job.status]}</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => setDetailJob(job)} style={{ padding: '5px 8px', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#6b7280' }} title="View">
                        <Eye size={14} />
                      </button>
                      {canEdit && (
                        <button onClick={() => { setSelected(job); setShowModal(true) }} style={{ padding: '5px 8px', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#6b7280' }} title="Edit">
                          <Edit2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
        const sc = ({ open: { bg: '#1e3a5f', color: '#60a5fa' }, in_progress: { bg: '#14532d40', color: '#86efac' }, on_hold: { bg: '#78350f30', color: '#fcd34d' }, completed: { bg: '#14532d60', color: '#4ade80' }, invoiced: { bg: '#312e8130', color: '#a5b4fc' }, closed: { bg: '#1e293b', color: '#64748b' } } as Record<string,{bg:string;color:string}>)[detailJob.status] ?? { bg: '#1e293b', color: '#64748b' }
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

              {/* Billing — hidden for employees */}
              {user?.role !== 'employee' && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Billing</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{detailJob.billingType === 'fixed' ? 'Fixed Price' : 'Hourly'}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{detailJob.billingType === 'fixed' ? formatCurrency(detailJob.billingRate) : `${formatCurrency(detailJob.billingRate)}/hr`}</div>
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
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>{formatDate(detailJob.startDate)}</div>
                </div>
              )}
              {detailJob.deadline && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Deadline</div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>{formatDate(detailJob.deadline)}</div>
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
                      <div style={{ fontSize: 22, fontWeight: 700, color: hoursOver ? '#f87171' : '#e2e8f0', lineHeight: 1 }}>{dispActual}h</div>
                      <div style={{ fontSize: 10, color: '#64748b', marginTop: 3 }}>Actual</div>
                    </div>
                    <div style={{ width: 1, height: 28, background: '#2d4068', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 600, color: '#94a3b8', lineHeight: 1 }}>{dispEstimated}h</div>
                      <div style={{ fontSize: 10, color: '#64748b', marginTop: 3 }}>Estimated</div>
                    </div>
                  </div>
                  <div style={{ background: '#0f1a2e', borderRadius: 6, height: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 6, width: `${hoursPct}%`, background: hoursOver ? '#ef4444' : '#2563eb', transition: 'width 0.3s' }} />
                  </div>
                  {jobTasks.length === 0 && (
                    <div style={{ fontSize: 10, color: '#334155', marginTop: 6 }}>Based on job-level hours</div>
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
                    <div style={{ fontSize: 10, color: '#334155', marginTop: 6 }}>No tasks yet</div>
                  )}
                </div>
              </div>

              {/* Financial cards — admin/manager only */}
              {user?.role !== 'employee' && detailJob.revenue != null && (
                <div className="modal-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                  {[
                    { label: 'Revenue', value: formatCurrency(detailJob.revenue ?? 0), color: '#4ade80' },
                    { label: 'Cost', value: formatCurrency(detailJob.totalCost ?? 0), color: '#f87171' },
                    { label: 'Profit', value: formatCurrency(detailJob.profit ?? 0), color: '#60a5fa' },
                    { label: 'Margin', value: `${detailJob.margin ?? 0}%`, color: '#c084fc' },
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
        open={showModal}
        onClose={() => setShowModal(false)}
        job={selected}
        clients={clients.map(c => ({ id: c.id, company: c.company }))}
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
}

function JobModal({ open, onClose, job, onSave, clients }: JobModalProps) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<Partial<Job>>(job ?? {
    title: '', clientId: '', clientName: '', jobType: '', billingType: 'hourly', billingRate: 0,
    quotedHours: 0, actualHours: 0, status: 'open', priority: 'medium',
    quoteApprovedDate: '', startDate: '', deadline: '', assignedManager: '',
  })

  useEffect(() => {
    setStep(1)
    
    if (job) {
      setForm({
        title: job.title || '',
        clientId: job.clientId || '',
        clientName: job.clientName || '',
        jobType: job.jobType || '',
        billingType: job.billingType || 'hourly',
        billingRate: job.billingRate || 0,
        quotedHours: job.quotedHours || 0,
        actualHours: job.actualHours || 0,
        status: job.status || 'open',
        priority: job.priority || 'medium',
        quoteApprovedDate: formatDateForInput(job.quoteApprovedDate),
        startDate: formatDateForInput(job.startDate),
        deadline: formatDateForInput(job.deadline),
        assignedManager: job.assignedManager || '',
      })
    } else {
      setForm({
        title: '', clientId: '', clientName: '', jobType: '', billingType: 'hourly', billingRate: 0,
        quotedHours: 0, actualHours: 0, status: 'open', priority: 'medium',
        quoteApprovedDate: '', startDate: '', deadline: '', assignedManager: '',
      })
    }
  }, [job])

  const s = (k: keyof Job, v: string | number) => setForm(f => ({ ...f, [k]: v }))

  const steps = [
    { num: 1, label: 'Job Details' },
    { num: 2, label: 'Timeline' },
    { num: 3, label: 'Billing details' },
  ]

  const darkInput: React.CSSProperties = {
    width: '100%', padding: '10px 13px', background: '#1e2d4a', border: '1px solid #2d4068',
    borderRadius: 8, color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box',
  }
  const lbl: React.CSSProperties = { fontSize: 13, color: '#94a3b8', fontWeight: 500, marginBottom: 5, display: 'block' }
  const req = <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>

  const handleClose = () => { onClose(); setStep(1) }
  const handleCreate = () => { onSave(form as Job); setStep(1) }
  const handleNext = () => {
    if (step === 1) {
      if (!form.title?.trim()) { toast.error('Job name is required'); return }
      if (!form.clientId) { toast.error('Please select a client'); return }
    }
    if (step === 3) {
      if (!form.billingRate && form.billingRate !== 0) { toast.error('Billing rate is required'); return }
    }
    setStep(st => st + 1)
  }

  return (
    <Modal open={open} onClose={handleClose} title="" size="xl">
      <div className="modal-flex" style={{ background: '#152035', borderRadius: 12, margin: -24, padding: 0, display: 'flex', minHeight: 380, overflow: 'hidden' }}>
        {/* Left step sidebar */}
        <div className="modal-sidebar" style={{ width: 190, background: '#0f1a2e', padding: '32px 20px', flexShrink: 0 }}>
          <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 18, marginBottom: 32 }}>
            {job ? 'Edit Job' : 'Create Job'}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            {steps.map(st => (
              <div key={st.num} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, fontSize: 13, fontWeight: 700,
                  background: step > st.num ? '#16a34a' : step === st.num ? '#2563eb' : '#1e2d4a',
                  color: '#fff',
                  border: step === st.num ? '2px solid #3b82f6' : 'none',
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
        <div style={{ flex: 1, padding: '32px 28px' }}>
          {/* Step 1 — Job Details */}
          {step === 1 && (
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
                  <label style={lbl}>Assigned Client {req}</label>
                  <select style={{ ...darkInput, cursor: 'pointer' }} value={form.clientId ?? ''} onChange={e => { s('clientId', e.target.value); s('clientName', clients.find(c => c.id === e.target.value)?.company ?? '') }}>
                    <option value="">Select client</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Priority</label>
                  <select style={{ ...darkInput, cursor: 'pointer' }} value={form.priority ?? 'medium'} onChange={e => s('priority', e.target.value as Priority)}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={lbl}>Status</label>
                  <select style={{ ...darkInput, cursor: 'pointer' }} value={form.status ?? 'open'} onChange={e => s('status', e.target.value as JobStatus)}>
                    {(['open', 'in_progress', 'on_hold', 'completed', 'invoiced', 'closed'] as JobStatus[]).map(st => (
                      <option key={st} value={st}>{st.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 2 — Timeline */}
          {step === 2 && (
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

          {/* Step 3 — Billing Details */}
          {step === 3 && (
            <div>
              <h3 style={{ color: '#fff', fontWeight: 600, fontSize: 16, marginBottom: 22 }}>Billing Details</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="modal-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={lbl}>Billing Type</label>
                    <select style={{ ...darkInput, cursor: 'pointer' }} value={form.billingType ?? 'hourly'} onChange={e => s('billingType', e.target.value as BillingType)}>
                      <option value="hourly">Hourly</option>
                      <option value="fixed">Fixed Price</option>
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Billing Rate ($)</label>
                    <input style={darkInput} type="number" value={String(form.billingRate ?? '')} onChange={e => s('billingRate', Number(e.target.value))} placeholder="0.00" />
                  </div>
                </div>
                <div>
                  <label style={lbl}>Quoted Billable Hours</label>
                  <input style={darkInput} type="number" value={String(form.quotedHours ?? '')} onChange={e => s('quotedHours', Number(e.target.value))} placeholder="0" />
                </div>
              </div>
            </div>
          )}

          {/* Nav buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 28 }}>
            {step > 1 && (
              <button onClick={() => setStep(st => st - 1)} style={{ padding: '10px 22px', border: '1px solid #2d4068', borderRadius: 8, background: 'transparent', color: '#94a3b8', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                BACK
              </button>
            )}
            <button onClick={handleClose} style={{ padding: '10px 22px', border: '1px solid #2d4068', borderRadius: 8, background: 'transparent', color: '#94a3b8', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
              CANCEL
            </button>
            {step < 3 ? (
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
