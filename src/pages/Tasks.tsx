import { useState, useEffect, useRef, type Key } from 'react'
import type { Task, TaskStatus } from '@/types'
import { Modal } from '@/components/ui/Modal'
import { useAuthStore } from '@/store/authStore'
import { useTasks } from '@/hooks/useTasks'
import { useJobs } from '@/hooks/useJobs'
import { useUsers } from '@/hooks/useUsers'
import { useSettingsStore } from '@/store/settingsStore'
import { useTaskLayouts } from '@/hooks/useLayouts'
import type { LayoutField, TaskLayout } from '@/hooks/useLayouts'
import { Avatar } from '@/components/ui/Avatar'
import {
  Play, Pause, CheckSquare, Plus, Clock, ListTodo,
  DollarSign, Timer, Square, Loader2, User, X,
  FileText, Calendar, Tag, Search, Check, Layout, Star,
} from 'lucide-react'
import { toast } from 'sonner'
import { useSettings } from '@/hooks/useSettings'

// ── Date formatter with settings ──────────────────────────────────────────────
function formatDateWithSettings(d: string | null | undefined, format: string): string {
  if (!d) return '—'
  try {
    const date = new Date(d)
    if (isNaN(date.getTime())) return '—'
    
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
  } catch {
    return '—'
  }
}

// Helper function to get task type color from taskTypes array
function getTaskTypeColor(taskTypeName: string | null | undefined, taskTypes: Array<{ name: string; color: string }>): string {
  if (!taskTypeName) return '#64748b'
  const taskType = taskTypes.find(t => t.name === taskTypeName)
  return taskType?.color || '#64748b'
}

// Priority Badge Component - now expects priority from job
function PriorityBadge({ priority }: { priority: string | null | undefined }) {
  if (!priority) return <span style={{ color: '#9ca3af', fontSize: 12 }}>—</span>
  
  const colors: Record<string, { bg: string; color: string; dot: string }> = {
    urgent: { bg: '#fee2e2', color: '#b91c1c', dot: '#dc2626' },
    high: { bg: '#ffedd5', color: '#9a3412', dot: '#ea580c' },
    medium: { bg: '#fef9c3', color: '#854d0e', dot: '#ca8a04' },
    low: { bg: '#dcfce7', color: '#166534', dot: '#16a34a' }
  }
  
  const normalizedPriority = priority.toLowerCase()
  const style = colors[normalizedPriority] || { bg: '#f3f4f6', color: '#4b5563', dot: '#6b7280' }
  
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 10px',
      borderRadius: 20,
      background: style.bg,
      color: style.color,
      border: 'none',
      fontSize: 12,
      fontWeight: 600,
      textTransform: 'capitalize',
      whiteSpace: 'nowrap'
    }}>
      <span style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: style.dot,
        display: 'inline-block'
      }} />
      {priority}
    </span>
  )
}

// Colored Task Type Badge Component
function TaskTypeBadge({ type, taskTypes }: { type: string | null | undefined; taskTypes: Array<{ name: string; color: string }> }) {
  if (!type) return <span style={{ color: '#9ca3af', fontSize: 12 }}>—</span>
  
  const color = getTaskTypeColor(type, taskTypes)
  
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 10px',
      borderRadius: 20,
      background: `${color}15`,
      color: color,
      border: `1px solid ${color}30`,
      fontSize: 12,
      fontWeight: 600,
      whiteSpace: 'nowrap'
    }}>
      <span style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: color,
        display: 'inline-block'
      }} />
      {type}
    </span>
  )
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

/* ─────────────── design primitives ─────────────── */

function StatCard({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: string | number
  color: 'slate' | 'blue' | 'emerald' | 'purple'
}) {
  const palettes = {
    slate:   { bar: '#64748b', bg: '#f1f5f9', fg: '#475569' },
    blue:    { bar: '#2563eb', bg: '#dbeafe', fg: '#1d4ed8' },
    emerald: { bar: '#059669', bg: '#d1fae5', fg: '#065f46' },
    purple:  { bar: '#7c3aed', bg: '#ede9fe', fg: '#5b21b6' },
  }
  const p = palettes[color]
  return (
    <div style={{ background: '#fffffe', border: '1px solid #e4e2da', borderRadius: 12, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,.07)', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: p.bar }} />
      <div style={{ width: 40, height: 40, borderRadius: 10, background: p.bg, color: p.fg, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 22, letterSpacing: '-0.5px', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 12, color: '#7c7970', fontWeight: 500, marginTop: 4 }}>{label}</div>
      </div>
    </div>
  )
}

function StatusDot({ status }: { status: TaskStatus }) {
  const colors: Record<TaskStatus, string> = { todo: '#94a3b8', in_progress: '#2563eb', completed: '#059669' }
  return <span style={{ width: 8, height: 8, borderRadius: '50%', background: colors[status], display: 'inline-block', flexShrink: 0 }} />
}

function BillablePill({ billable }: { billable: boolean }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 6, background: billable ? '#d1fae5' : '#f1f5f9', color: billable ? '#065f46' : '#64748b', border: `1px solid ${billable ? '#a7f3d0' : '#e2e8f0'}`, whiteSpace: 'nowrap' }}>
      {billable ? 'Billable' : 'Non-billable'}
    </span>
  )
}

function LivePill() {
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 6, background: '#dbeafe', color: '#1d4ed8', border: '1px solid #bfdbfe', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#2563eb', animation: 'pulse 1.5s infinite' }} />
      Live
    </span>
  )
}

function HoursBar({ actual, estimated }: { actual: number; estimated: number }) {
  const pct = estimated > 0 ? Math.min((actual / estimated) * 100, 100) : 0
  const over = estimated > 0 && actual > estimated
  return (
    <div style={{ width: 96 }}>
      <div style={{ height: 3, background: '#e4e2da', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: over ? '#ef4444' : '#2563eb', borderRadius: 999 }} />
      </div>
    </div>
  )
}

function IconBtn({ onClick, title, bg, hoverBg, color, disabled, children }: {
  onClick: () => void; title: string; bg: string; hoverBg: string; color: string
  disabled?: boolean; children: React.ReactNode
}) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick} title={title} disabled={disabled}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ width: 32, height: 32, border: 'none', borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer', display: 'grid', placeItems: 'center', background: hov && !disabled ? hoverBg : bg, color, transition: 'background .15s', opacity: disabled ? 0.4 : 1 }}
    >
      {children}
    </button>
  )
}

function AssignedUsers({ userIds, users }: { userIds: string[]; users: Array<{ id: string; name: string; email: string }> }) {
  const assignedUsers = users.filter(u => userIds.includes(u.id))
  if (assignedUsers.length === 0) {
    return (
      <div style={{ width: 24, height: 24, borderRadius: 12, background: '#f1f0ec', display: 'grid', placeItems: 'center' }}>
        <User size={12} color="#7c7970" />
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {assignedUsers.slice(0, 3).map(user => (
        <Avatar key={user.id} name={user.name} size="xs" />
      ))}
      {assignedUsers.length > 3 && (
        <span style={{ fontSize: 11, color: '#7c7970', marginLeft: 2 }}>+{assignedUsers.length - 3}</span>
      )}
    </div>
  )
}

/* ─────────────── Task Detail Modal ─────────────── */

function TaskDetailModal({ 
  task, 
  users, 
  jobs,
  onClose, 
  onEdit, 
  canEdit, 
  taskTypes, 
  dateFormat 
}: {
  task: Task
  users: Array<{ id: string; name: string; email: string }>
  jobs: Array<{ id: string; priority: string }>
  onClose: () => void
  onEdit: () => void
  canEdit: boolean
  taskTypes: Array<{ name: string; color: string }>
  dateFormat: string
}) {
  const statusLabel: Record<TaskStatus, string> = {
    todo: 'To Do',
    in_progress: 'In Progress',
    completed: 'Completed',
  }
  const statusColors: Record<TaskStatus, { bg: string; color: string; dot: string }> = {
    todo:        { bg: '#1e293b', color: '#94a3b8', dot: '#64748b' },
    in_progress: { bg: '#1e3a5f', color: '#60a5fa', dot: '#2563eb' },
    completed:   { bg: '#14532d40', color: '#86efac', dot: '#22c55e' },
  }
  const sc = statusColors[task.status]
  const assignedUsers = users.filter(u => (task.assignedToIds || []).includes(u.id))
  const taskTypeColor = getTaskTypeColor(task.type, taskTypes)
  
  // Get priority from associated job
  const jobPriority = jobs.find(j => j.id === task.jobId)?.priority

  const secLabel: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase',
    letterSpacing: '0.07em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4,
  }
  const card: React.CSSProperties = {
    background: '#1e2d4a', border: '1px solid #2d4068', borderRadius: 10, padding: '14px 16px',
  }

  return (
    <Modal open onClose={onClose} title="" size="lg">
      <div className="modal-flex" style={{ background: '#152035', borderRadius: 12, margin: -24, padding: 0, display: 'flex', overflow: 'hidden', minHeight: 360 }}>

        {/* Left sidebar — identity */}
        <div className="modal-sidebar" style={{ width: 200, background: '#0f1a2e', padding: '32px 20px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Status badge */}
          <div>
            <div style={{ ...secLabel }}><Tag size={10} /> Status</div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: sc.color, background: sc.bg, padding: '4px 12px', borderRadius: 20 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: sc.dot, display: 'inline-block' }} />
              {statusLabel[task.status]}
            </span>
          </div>

          {/* Priority - Now from job */}
          <div>
            <div style={{ ...secLabel }}><Tag size={10} /> Priority</div>
            <PriorityBadge priority={jobPriority} />
          </div>

          {/* Billable */}
          <div>
            <div style={{ ...secLabel }}><DollarSign size={10} /> Billing</div>
            <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: task.billable ? '#14532d40' : '#1e293b', color: task.billable ? '#86efac' : '#64748b' }}>
              {task.billable ? 'Billable' : 'Non-Billable'}
            </span>
          </div>

          {/* Task type - now with color */}
          <div>
            <div style={{ ...secLabel }}><Tag size={10} /> Type</div>
            {task.type ? (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: 700,
                color: taskTypeColor,
                background: `${taskTypeColor}15`,
                padding: '4px 12px',
                borderRadius: 20,
                border: `1px solid ${taskTypeColor}30`
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: taskTypeColor, display: 'inline-block' }} />
                {task.type}
              </span>
            ) : (
              <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>—</span>
            )}
          </div>

          {/* Timer live indicator */}
          {task.timerRunning && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#86efac' }}>LIVE</span>
            </div>
          )}

          {/* Dates */}
          {task.startedAt && (
            <div>
              <div style={{ ...secLabel }}><Calendar size={10} /> Started</div>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>
                {formatDateWithSettings(task.startedAt, dateFormat)}
              </span>
            </div>
          )}
          {task.completedAt && (
            <div>
              <div style={{ ...secLabel }}><CheckSquare size={10} /> Completed</div>
              <span style={{ fontSize: 12, color: '#86efac' }}>
                {formatDateWithSettings(task.completedAt, dateFormat)}
              </span>
            </div>
          )}
        </div>

        {/* Right main content */}
        <div style={{ flex: 1, padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Title */}
          <div>
            <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 20, margin: 0, marginBottom: 4 }}>{task.name}</h2>
            <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>{task.jobTitle} · {task.clientName}</p>
          </div>

          {/* Time tracking card */}
          <div style={{ ...card, background: task.timerRunning ? '#1e3a5f' : '#1e2d4a', border: `1px solid ${task.timerRunning ? '#2563eb60' : '#2d4068'}` }}>
            <div style={{ ...secLabel, color: task.timerRunning ? '#60a5fa' : '#64748b' }}>
              <Clock size={10} /> Time Tracking
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <div>
                <div style={{ fontSize: 28, fontFamily: 'monospace', fontWeight: 700, color: task.timerRunning ? '#60a5fa' : '#e2e8f0', letterSpacing: 2 }}>
                  {task.timerRunning ? formatTime(task.timerSeconds) : `${task.actualHours}h`}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
                  {task.timerRunning ? 'Timer running' : 'Actual hours logged'}
                </div>
              </div>
              <div style={{ width: 1, height: 40, background: '#2d4068' }} />
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#94a3b8' }}>{task.estimatedHours}h</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>Estimated</div>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <HoursBar actual={task.timerRunning ? task.timerSeconds / 3600 : task.actualHours} estimated={task.estimatedHours} />
            </div>
          </div>

          {/* Description */}
          {task.description && (
            <div style={card}>
              <div style={secLabel}><FileText size={10} /> Description</div>
              <p style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.6, margin: 0 }}>{task.description}</p>
            </div>
          )}

          {/* Assigned users */}
          {assignedUsers.length > 0 && (
            <div style={card}>
              <div style={secLabel}><User size={10} /> Assigned To</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {assignedUsers.map(u => (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#152035', border: '1px solid #2d4068', borderRadius: 20, padding: '4px 12px 4px 4px' }}>
                    <Avatar name={u.name} size="xs" />
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>{u.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 'auto', paddingTop: 8 }}>
            <button onClick={onClose}
              style={{ padding: '10px 22px', border: '1px solid #2d4068', borderRadius: 8, background: 'transparent', color: '#94a3b8', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
              CLOSE
            </button>
            {canEdit && (
              <button onClick={onEdit}
                style={{ padding: '10px 28px', border: 'none', borderRadius: 8, background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                EDIT TASK
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}

/* ─────────────── main Tasks component ─────────────── */

export function Tasks() {
  const { user } = useAuthStore()
  const { dateFormat } = useSettingsStore()
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [detailTask, setDetailTask] = useState<Task | null>(null)
  const [selected, setSelected] = useState<Task | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { tasks, loading, error, createTask, updateTask, updateStatus, tickTimer, startTimer, pauseTimer } = useTasks()
  const { jobs } = useJobs()
  const { users } = useUsers({ status: 'active' })
  const { taskTypes } = useSettings()
  const activeTaskTypes = taskTypes?.filter(t => t.isActive) || []

  // Tick running timers locally every second
  useEffect(() => {
    const runningIds = tasks.filter(t => t.timerRunning).map(t => t.id)
    if (runningIds.length === 0) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
      return
    }
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      runningIds.forEach(id => tickTimer(id))
    }, 1000)
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null } }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks.filter(t => t.timerRunning).map(t => t.id).join(',')])

  const isManager = user?.role !== 'employee'
  const userTasks = isManager
    ? tasks
    : tasks.filter(t => t.assignedToIds?.includes(user?.id ?? ''))

  const filtered = tasks.filter(t => {
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
                       t.clientName.toLowerCase().includes(search.toLowerCase()) ||
                       t.jobTitle.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || t.status === statusFilter
    const matchUser = isManager ? true : (t.assignedToIds?.includes(user?.id ?? '') ?? false)
    return matchSearch && matchStatus && matchUser
  })

  const handleCompleteTask = async (id: string) => {
    const task = tasks.find(t => t.id === id)
    if (!task) return
    if (task.timerRunning) await pauseTimer(id)
    await updateStatus(id, 'completed')
  }

  const canControlTimer = (task: Task) => {
    if (isManager) return true
    return task.assignedToIds?.includes(user?.id ?? '') ?? false
  }

  const canEdit = isManager
  const activeTask = tasks.find(t => t.timerRunning && canControlTimer(t))
  const statusTabs = [
    { key: 'all' as const,         label: 'All',         count: userTasks.length },
    { key: 'todo' as const,        label: 'To Do',       count: userTasks.filter(t => t.status === 'todo').length },
    { key: 'in_progress' as const, label: 'In Progress', count: userTasks.filter(t => t.status === 'in_progress').length },
    { key: 'completed' as const,   label: 'Completed',   count: userTasks.filter(t => t.status === 'completed').length },
  ]

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, gap: 10, color: '#7c7970' }}>
      <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
      <span style={{ fontSize: 14 }}>Loading tasks...</span>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (error) return (
    <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 10, padding: '12px 18px', color: '#be123c', fontSize: 13.5, margin: '24px 32px' }}>
      Failed to load tasks: {error}
    </div>
  )

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Mono:wght@400;500&display=swap');
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
      `}</style>

      <div style={{ fontFamily: 'inherit', minHeight: '100%' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1f36', margin: 0 }}>My Job & Tasks</h1>
          {canEdit && (
            <button onClick={() => { setSelected(null); setShowModal(true) }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 8, background: '#2563eb', color: '#fff', border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
              <Plus size={16} /> Create Task
            </button>
          )}
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 24 }}>
          {[
            { label: 'Total Tasks',  value: userTasks.length,                                          bar: '#6366f1', bg: '#eef2ff', fg: '#4338ca' },
            { label: 'To Do',        value: userTasks.filter(t => t.status === 'todo').length,         bar: '#64748b', bg: '#f1f5f9', fg: '#475569' },
            { label: 'In Progress',  value: userTasks.filter(t => t.status === 'in_progress').length,  bar: '#2563eb', bg: '#dbeafe', fg: '#1d4ed8' },
            { label: 'Completed',    value: userTasks.filter(t => t.status === 'completed').length,    bar: '#059669', bg: '#d1fae5', fg: '#065f46' },
            { label: 'Billable',     value: userTasks.filter(t => t.billable).length,                  bar: '#f59e0b', bg: '#fef3c7', fg: '#92400e' },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 16px', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: s.bar }} />
              <div style={{ width: 38, height: 38, borderRadius: 9, background: s.bg, color: s.fg, display: 'grid', placeItems: 'center', flexShrink: 0, fontSize: 17, fontWeight: 700 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Live timer banner */}
        {activeTask && (
          <div style={{ background: '#1a1916', borderRadius: 12, padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
              <div>
                <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{activeTask.name}</div>
                <div style={{ color: '#7c7970', fontSize: 12, marginTop: 2 }}>
                  {activeTask.clientName} · {activeTask.jobTitle}
                  {activeTask.assignedToNames && (
                    <span style={{ marginLeft: 6, color: '#9ca3af' }}>· {activeTask.assignedToNames}</span>
                  )}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 20, fontWeight: 500, color: '#fff', letterSpacing: 1 }}>
                {formatTime(activeTask.timerSeconds)}
              </span>
              {canControlTimer(activeTask) && (
                <button onClick={() => pauseTimer(activeTask.id)}
                  style={{ display: 'grid', placeItems: 'center', width: 34, height: 34, borderRadius: 8, background: 'rgba(255,255,255,.12)', border: 'none', color: '#fff', cursor: 'pointer' }}>
                  <Pause size={15} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Table card */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>

          {/* Tabs + search toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', borderBottom: '1px solid #f1f3f9' }}>
            <div style={{ display: 'flex' }}>
              {statusTabs.map(tab => {
                const active = statusFilter === tab.key
                return (
                  <button key={tab.key} onClick={() => setStatusFilter(tab.key)}
                    style={{ padding: '14px 16px', fontSize: 13, fontWeight: 600, border: 'none', background: 'transparent', cursor: 'pointer', borderBottom: `2px solid ${active ? '#2563eb' : 'transparent'}`, color: active ? '#2563eb' : '#6b7280', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                    {tab.label}
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 20, background: '#f3f4f6', color: '#6b7280' }}>
                      {tab.count}
                    </span>
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                <input placeholder="Search tasks…" value={search} onChange={e => setSearch(e.target.value)}
                  style={{ paddingLeft: 32, paddingRight: 12, paddingTop: 7, paddingBottom: 7, border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 13, outline: 'none', width: 180 }} />
              </div>
            </div>
          </div>

          {/* Table with horizontal scroll */}
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1400px' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {[
                    { label: 'Job ID', width: '100px' },
                    { label: 'Task Name', width: '250px' },
                    { label: 'Task Type', width: '140px' },
                    { label: 'Priority', width: '110px' },
                    { label: isManager ? 'Assigned To' : 'Assigned By', width: '200px' },
                    { label: 'Est. Hours', width: '100px' },
                    { label: 'Billing Type', width: '120px' },
                    { label: 'Task Status', width: '120px' },
                    { label: 'Time Tracking', width: '140px' },
                    { label: '', width: '100px' }
                  ].map(h => (
                    <th key={h.label} style={{ 
                      textAlign: 'left', 
                      padding: '11px 16px', 
                      fontSize: 11, 
                      fontWeight: 600, 
                      color: '#6b7280', 
                      textTransform: 'uppercase', 
                      letterSpacing: '0.05em', 
                      whiteSpace: 'nowrap',
                      width: h.width
                    }}>
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={10} style={{ textAlign: 'center', padding: '48px 18px', color: '#9ca3af', fontSize: 14 }}>
                    {tasks.length === 0 ? 'No tasks yet. Create one to get started.' : 'No tasks match your filters.'}
                  </td></tr>
                ) : filtered.map((task, i) => {
                  // Get priority from associated job for display
                  const jobPriority = jobs.find(j => j.id === task.jobId)?.priority
                  
                  return (
                    <tr key={task.id} style={{ borderTop: '1px solid #f1f3f9', background: task.timerRunning ? '#eff6ff' : i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      {/* Job ID */}
                      <td style={{ padding: '13px 16px' }}>
                        {(() => { const j = jobs.find(j => j.id === task.jobId); return (
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#2563eb', background: '#dbeafe', padding: '2px 8px', borderRadius: 5, whiteSpace: 'nowrap' }}>
                            {j?.jobId || '—'}
                          </span>
                        )})()}
                      </td>
                      {/* Task Name */}
                      <td style={{ padding: '13px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <StatusDot status={task.status} />
                          <div style={{ minWidth: 0 }}>
                            <span
                              onClick={() => setDetailTask(task)}
                              style={{ fontWeight: 600, fontSize: 13, color: '#1a1f36', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: '#d1d5db', textUnderlineOffset: 2, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}
                              title={task.name}
                            >
                              {task.name}
                            </span>
                            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }} title={`${task.clientName} · ${task.jobTitle}`}>
                              {task.clientName} · {task.jobTitle}
                            </div>
                          </div>
                        </div>
                      </td>
                      {/* Task Type */}
                      <td style={{ padding: '13px 16px' }}>
                        <TaskTypeBadge type={task.type} taskTypes={activeTaskTypes} />
                      </td>
                      {/* Priority - Now from job */}
                      <td style={{ padding: '13px 16px' }}>
                        <PriorityBadge priority={jobPriority} />
                      </td>
                      {/* Assigned To / By */}
                      <td style={{ padding: '13px 16px' }}>
                        {isManager ? (
                          <AssignedUsers userIds={task.assignedToIds || []} users={users} />
                        ) : (
                          task.createdByName ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#dbeafe', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                                {task.createdByName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2)}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1f36', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }} title={task.createdByName}>
                                  {task.createdByName}
                                </div>
                                {task.createdByEmail && (
                                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }} title={task.createdByEmail}>
                                    {task.createdByEmail}
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: '#9ca3af', fontSize: 12 }}>—</span>
                          )
                        )}
                      </td>
                      {/* Est. Hours */}
                      <td style={{ padding: '13px 16px', fontSize: 13, color: '#374151', whiteSpace: 'nowrap' }}>{task.estimatedHours}h</td>
                      {/* Billing Type */}
                      <td style={{ padding: '13px 16px' }}>
                        <BillablePill billable={task.billable} />
                      </td>
                      {/* Task Status */}
                      <td style={{ padding: '13px 16px', whiteSpace: 'nowrap' }}>
                        {task.status === 'completed' ? (
                          <span style={{ color: '#16a34a', fontWeight: 600, fontSize: 12 }}>COMPLETED</span>
                        ) : task.status === 'in_progress' ? (
                          <span style={{ color: '#2563eb', fontWeight: 600, fontSize: 12 }}>IN PROGRESS</span>
                        ) : (
                          <span style={{ color: '#6b7280', fontWeight: 600, fontSize: 12 }}>TO DO</span>
                        )}
                      </td>
                      {/* Time Tracking */}
                      <td style={{ padding: '13px 16px' }}>
                        {task.timerRunning ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'pulse 1.5s infinite', flexShrink: 0 }} />
                            <span style={{ fontFamily: 'DM Mono, monospace', fontWeight: 600, fontSize: 13, color: '#2563eb', whiteSpace: 'nowrap' }}>{formatTime(task.timerSeconds)}</span>
                          </div>
                        ) : (
                          <span style={{ fontSize: 13, color: '#374151', whiteSpace: 'nowrap' }}>
                            <strong>{task.actualHours}h</strong><span style={{ color: '#9ca3af' }}> / {task.estimatedHours}h</span>
                          </span>
                        )}
                      </td>
                      {/* Actions */}
                      <td style={{ padding: '13px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {task.status !== 'completed' && canControlTimer(task) && (
                            !task.timerRunning ? (
                              <IconBtn onClick={() => startTimer(task.id)} title="Start Timer" bg="#dbeafe" hoverBg="#bfdbfe" color="#1d4ed8"><Play size={13} /></IconBtn>
                            ) : (
                              <IconBtn onClick={() => pauseTimer(task.id)} title="Pause" bg="#fef3c7" hoverBg="#fde68a" color="#92400e"><Pause size={13} /></IconBtn>
                            )
                          )}
                          {task.status !== 'completed' && canControlTimer(task) && (
                            <IconBtn onClick={() => handleCompleteTask(task.id)} title="Mark Complete" bg="#d1fae5" hoverBg="#a7f3d0" color="#065f46">
                              <Square size={13} />
                            </IconBtn>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Task detail modal - Now passing jobs prop */}
        {detailTask && (
          <TaskDetailModal
            task={detailTask}
            users={users}
            jobs={jobs}
            onClose={() => setDetailTask(null)}
            canEdit={canEdit}
            onEdit={() => {
              setSelected(detailTask)
              setDetailTask(null)
              setShowModal(true)
            }}
            taskTypes={activeTaskTypes}
            dateFormat={dateFormat}
          />
        )}

        {/* Create/Edit modal */}
        {showModal && (
          <TaskModal
            open={showModal}
            onClose={() => setShowModal(false)}
            task={selected}
            jobs={jobs}
            users={users}
            taskTypes={activeTaskTypes}
            dateFormat={dateFormat}
            onSave={async t => {
              if (selected) {
                const ok = await updateTask(selected.id, t)
                if (ok) toast.success('Task updated successfully')
                else toast.error('Failed to update task')
              } else {
                // For new tasks, we no longer set priority - it comes from the job
                const ok = await createTask({ ...t, jobId: t.jobId })
                if (ok) toast.success('Task created successfully')
                else toast.error('Failed to create task')
              }
              setShowModal(false)
            }}
          />
        )}
      </div>
    </>
  )
}

/* ─────────────── Task Form Modal ─────────────── */

interface TaskModalProps {
  open: boolean
  onClose: () => void
  task: Task | null
  jobs: Array<{ id: string; jobId: string; title: string; clientName: string; priority: string }>
  users: Array<{ id: string; name: string; email: string }>
  taskTypes: Array<{ id: Key | null | undefined; name: string; color: string }>
  dateFormat: string
  onSave: (t: Partial<Task> & { jobId: string }) => void
}

const defaultTaskForm = {
  name: '', type: '', jobId: '', jobTitle: '', clientName: '',
  assignedToIds: [] as string[], assignedToNames: '',
  estimatedHours: 0, billable: true, status: 'todo' as TaskStatus, 
  description: '', // Removed priority from default form
}

function TaskModal({ open, onClose, task, jobs, users, taskTypes, dateFormat, onSave }: TaskModalProps) {
  const TOTAL_STEPS = task ? 3 : 4
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<Partial<Task> & { jobId: string; layoutId?: string; customFieldValues?: Record<string, unknown> }>(
    task ? { ...task, jobId: task.jobId, assignedToIds: task.assignedToIds || [] } : { ...defaultTaskForm, customFieldValues: {} }
  )

  const { layouts: taskLayouts, loading: layoutsLoading, defaultLayout } = useTaskLayouts()
  const [selectedLayout, setSelectedLayout] = useState<TaskLayout | null>(null)

  useEffect(() => {
    setStep(1)
    setForm(task
      ? { ...task, jobId: task.jobId, assignedToIds: task.assignedToIds || [], customFieldValues: (task as { customFieldValues?: Record<string, unknown> }).customFieldValues ?? {} }
      : { ...defaultTaskForm, customFieldValues: {} }
    )
    if (!task) setSelectedLayout(null)
  }, [task])

  useEffect(() => {
    if (!task && !selectedLayout && defaultLayout) {
      setSelectedLayout(defaultLayout)
      setForm(f => ({ ...f, layoutId: defaultLayout.id }))
    }
  }, [defaultLayout, task, selectedLayout])

  const s = (k: keyof Task | 'jobId', v: string | number | boolean | string[]) =>
    setForm(f => ({ ...f, [k]: v }))

  const handleJobChange = (jobId: string) => {
    const job = jobs.find(j => j.id === jobId)
    setForm(f => ({ 
      ...f, 
      jobId, 
      jobTitle: job?.title || '', 
      clientName: job?.clientName || ''
      // Removed priority assignment - it comes from job when displaying
    }))
  }

  const handleUserChange = (userId: string) => {
    const currentIds = form.assignedToIds as string[] || []
    const newIds = currentIds.includes(userId) ? currentIds.filter(id => id !== userId) : [...currentIds, userId]
    const selectedUsers = users.filter(u => newIds.includes(u.id))
    setForm(f => ({ ...f, assignedToIds: newIds, assignedToNames: selectedUsers.map(u => u.name).join(', ') }))
  }

  const removeUser = (userId: string) => {
    const newIds = (form.assignedToIds as string[] || []).filter(id => id !== userId)
    const selectedUsers = users.filter(u => newIds.includes(u.id))
    setForm(f => ({ ...f, assignedToIds: newIds, assignedToNames: selectedUsers.map(u => u.name).join(', ') }))
  }

  const darkInput: React.CSSProperties = {
    width: '100%', padding: '10px 13px', background: '#1e2d4a', border: '1px solid #2d4068',
    borderRadius: 8, color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
  }
  const lbl: React.CSSProperties = { fontSize: 13, color: '#94a3b8', fontWeight: 500, marginBottom: 5, display: 'block' }
  const req = <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>

  const setCF = (key: string, v: unknown) => setForm(f => ({ ...f, customFieldValues: { ...(f.customFieldValues ?? {}), [key]: v } }))

  const detailStep = task ? 1 : 2
  const assignStep = task ? 2 : 3
  const descStep   = task ? 3 : 4

  const handleNext = () => {
    if (step === detailStep) {
      if (!form.name?.trim()) { toast.error('Task name is required'); return }
      if (!form.jobId) { toast.error('Please select a job'); return }
    }
    setStep(s => s + 1)
  }

  const steps = task
    ? [{ num: 1, label: 'Task Details' }, { num: 2, label: 'Assignment' }, { num: 3, label: 'Description' }]
    : [{ num: 1, label: 'Select Layout' }, { num: 2, label: 'Task Details' }, { num: 3, label: 'Assignment' }, { num: 4, label: 'Description' }]

  const customFields: LayoutField[] = selectedLayout ? selectedLayout.fields.filter(f => !f.system) : []

  const renderCF = (f: LayoutField) => {
    const val = (form.customFieldValues ?? {})[f.key]
    if (f.type === 'text') return <input style={darkInput} value={(val as string) ?? ''} onChange={e => setCF(f.key, e.target.value)} placeholder={f.placeholder || f.label} />
    if (f.type === 'number') return <input style={darkInput} type="number" value={(val as string) ?? ''} onChange={e => setCF(f.key, e.target.value)} placeholder="0" />
    if (f.type === 'date') return <input style={darkInput} type="date" value={(val as string) ?? ''} onChange={e => setCF(f.key, e.target.value)} />
    if (f.type === 'textarea') return <textarea style={{ ...darkInput, resize: 'vertical', minHeight: 72 }} value={(val as string) ?? ''} onChange={e => setCF(f.key, e.target.value)} placeholder={f.placeholder || f.label} />
    if (f.type === 'select') return (
      <select style={{ ...darkInput, cursor: 'pointer' }} value={(val as string) ?? ''} onChange={e => setCF(f.key, e.target.value)}>
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

  // Get priority from selected job for display
  const selectedJobPriority = form.jobId ? jobs.find(j => j.id === form.jobId)?.priority : null

  return (
    <Modal open={open} onClose={onClose} title="" size="xl">
      <div className="modal-flex" style={{ background: '#152035', borderRadius: 12, margin: -24, padding: 0, display: 'flex', minHeight: 420, overflow: 'hidden' }}>

        {/* Left step sidebar */}
        <div className="modal-sidebar" style={{ width: 200, background: '#0f1a2e', padding: '32px 20px', flexShrink: 0 }}>
          <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 18, marginBottom: 32 }}>
            {task ? 'Edit Task' : 'Create Task'}
          </h2>
          {selectedLayout && !task && (
            <div style={{ background: '#1e2d4a', border: '1px solid #2d4068', borderRadius: 8, padding: '8px 10px', marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Layout</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>{selectedLayout.name}</div>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            {steps.map(st => (
              <div key={st.num} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', flexShrink: 0, fontSize: 13, fontWeight: 700,
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
          {!task && step === 1 && (
            <div>
              <h3 style={{ color: '#fff', fontWeight: 600, fontSize: 16, marginBottom: 6 }}>Select a Layout</h3>
              <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>Choose which form template to use for this task.</p>
              {layoutsLoading ? (
                <div style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                  <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} />
                </div>
              ) : taskLayouts.length === 0 ? (
                <div style={{ background: '#1e2d4a', border: '1px solid #2d4068', borderRadius: 10, padding: 20, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                  No layouts configured yet. Go to Settings → Jobs & Tasks → Task Layouts to create one.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {taskLayouts.map(l => (
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

          {/* Task Details step */}
          {step === detailStep && (
            <div>
              <h3 style={{ color: '#fff', fontWeight: 600, fontSize: 16, marginBottom: 22 }}>Task Details</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={lbl}>Task Name {req}</label>
                  <input style={darkInput} value={form.name ?? ''} onChange={e => s('name', e.target.value)} placeholder="e.g. Reconcile accounts" />
                </div>
                <div>
                  <label style={lbl}>Job {req}</label>
                  <select style={{ ...darkInput, cursor: 'pointer' }} value={form.jobId ?? ''} onChange={e => handleJobChange(e.target.value)}>
                    <option value="">Select job…</option>
                    {jobs.map(j => (
                      <option key={j.id} value={j.id}>
                        {j.jobId} — {j.title} ({j.clientName}) [{j.priority}]
                      </option>
                    ))}
                  </select>
                </div>
                <div className="modal-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={lbl}>Task Type</label>
                    <select 
                      style={{ 
                        ...darkInput, 
                        cursor: 'pointer',
                        borderLeft: form.type ? `4px solid ${getTaskTypeColor(form.type as string, taskTypes)}` : '1px solid #2d4068'
                      }} 
                      value={form.type ?? ''} 
                      onChange={e => s('type', e.target.value)}
                    >
                      <option value="">Select type…</option>
                      {taskTypes.length > 0
                        ? taskTypes.map(t => (
                            <option key={t.id} value={t.name} style={{ color: t.color }}>
                              {t.name}
                            </option>
                          ))
                        : ['Data Collection','Data Entry','Tax Work','Review','Reconciliation','Advisory','Bookkeeping','Non-billable'].map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))
                      }
                    </select>
                    {form.type && (
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 6, 
                        marginTop: 6,
                        fontSize: 11,
                        color: '#94a3b8'
                      }}>
                        <span style={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          background: getTaskTypeColor(form.type as string, taskTypes),
                          display: 'inline-block'
                        }} />
                        <span>Color indicator for "{form.type}"</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={lbl}>Task Status</label>
                    <select style={{ ...darkInput, cursor: 'pointer' }} value={form.status ?? 'todo'} onChange={e => s('status', e.target.value as TaskStatus)}>
                      <option value="todo">To Do</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                </div>

                {/* Show priority from job (read-only) - Now uses selectedJobPriority */}
                {form.jobId && (
                  <div style={{ 
                    background: '#1e2d4a', 
                    border: '1px solid #2d4068', 
                    borderRadius: 8, 
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}>
                    <Tag size={14} color="#64748b" />
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>Priority from job:</span>
                    <PriorityBadge priority={selectedJobPriority} />
                  </div>
                )}

                {/* Custom fields from layout */}
                {customFields.length > 0 && (
                  <>
                    <div style={{ height: 1, background: '#2d4068' }} />
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Layout size={10} /> Custom Fields
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      {customFields.map(f => (
                        <div key={f.key} style={f.type === 'textarea' ? { gridColumn: '1 / -1' } : {}}>
                          <label style={lbl}>{f.label}{f.required && req}</label>
                          {renderCF(f)}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Assignment step */}
          {step === assignStep && (
            <div>
              <h3 style={{ color: '#fff', fontWeight: 600, fontSize: 16, marginBottom: 22 }}>Assignment</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={lbl}>Assign To</label>
                  <select style={{ ...darkInput, cursor: 'pointer' }} value="" onChange={e => { if (e.target.value) handleUserChange(e.target.value) }}>
                    <option value="">Add team members…</option>
                    {users.filter(u => !(form.assignedToIds as string[] || []).includes(u.id)).map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                    ))}
                  </select>
                </div>
                {(form.assignedToIds as string[] || []).length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '10px 12px', background: '#1e2d4a', borderRadius: 8, border: '1px solid #2d4068' }}>
                    {(form.assignedToIds as string[] || []).map(userId => {
                      const u = users.find(u => u.id === userId)
                      if (!u) return null
                      return (
                        <div key={userId} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 8px 3px 4px', background: '#152035', borderRadius: 20, border: '1px solid #2d4068' }}>
                          <Avatar name={u.name} size="xs" />
                          <span style={{ fontSize: 12, color: '#e2e8f0' }}>{u.name}</span>
                          <button onClick={() => removeUser(userId)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2, display: 'flex', alignItems: 'center' }}>
                            <X size={12} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={lbl}>Estimated Hours</label>
                    <input style={darkInput} type="number" min="0" step="0.5" value={form.estimatedHours ?? 0} onChange={e => s('estimatedHours', Number(e.target.value))} />
                  </div>
                  <div>
                    <label style={lbl}>Billing Type</label>
                    <select style={{ ...darkInput, cursor: 'pointer' }} value={form.billable ? 'true' : 'false'} onChange={e => s('billable', e.target.value === 'true')}>
                      <option value="true">Billable</option>
                      <option value="false">Non-Billable</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Description step */}
          {step === descStep && (
            <div>
              <h3 style={{ color: '#fff', fontWeight: 600, fontSize: 16, marginBottom: 22 }}>Description</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={lbl}>Description (optional)</label>
                  <textarea
                    style={{ ...darkInput, resize: 'vertical', minHeight: 100 }}
                    value={form.description ?? ''}
                    onChange={e => s('description', e.target.value)}
                    placeholder="Brief description of the task…"
                  />
                </div>
                {/* Summary review */}
                <div className="modal-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { label: 'Task', value: form.name || '—' },
                    { label: 'Job', value: form.jobTitle || '—' },
                    { 
                      label: 'Priority', 
                      value: selectedJobPriority || '—',
                      color: selectedJobPriority ? {
                        urgent: '#b91c1c',
                        high: '#9a3412',
                        medium: '#854d0e',
                        low: '#166534'
                      }[selectedJobPriority as 'urgent' | 'high' | 'medium' | 'low'] : undefined
                    },
                    { 
                      label: 'Type', 
                      value: form.type || '—',
                      color: form.type ? getTaskTypeColor(form.type, taskTypes) : undefined
                    },
                    { label: 'Status', value: (form.status ?? 'todo').replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) },
                    { label: 'Est. Hours', value: `${form.estimatedHours ?? 0}h` },
                    { label: 'Billing', value: form.billable ? 'Billable' : 'Non-Billable' },
                  ].map(item => (
                    <div key={item.label} style={{ 
                      background: '#1e2d4a', 
                      border: '1px solid #2d4068', 
                      borderRadius: 8, 
                      padding: '10px 12px',
                      ...(item.color ? { borderLeft: `4px solid ${item.color}` } : {})
                    }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{item.label}</div>
                      <div style={{ 
                        fontSize: 13, 
                        fontWeight: 600, 
                        color: item.color || '#e2e8f0', 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis', 
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        {item.color && <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />}
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Nav buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 'auto', paddingTop: 28 }}>
            {step > 1 && (
              <button onClick={() => setStep(s => s - 1)} style={{ padding: '10px 22px', border: '1px solid #2d4068', borderRadius: 8, background: 'transparent', color: '#94a3b8', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                BACK
              </button>
            )}
            <button onClick={onClose} style={{ padding: '10px 22px', border: '1px solid #2d4068', borderRadius: 8, background: 'transparent', color: '#94a3b8', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
              CANCEL
            </button>
            {step < TOTAL_STEPS ? (
              <button onClick={handleNext} style={{ padding: '10px 28px', border: 'none', borderRadius: 8, background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                NEXT
              </button>
            ) : (
              <button onClick={() => onSave(form)} style={{ padding: '10px 28px', border: 'none', borderRadius: 8, background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                {task ? 'SAVE' : 'CREATE'}
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}