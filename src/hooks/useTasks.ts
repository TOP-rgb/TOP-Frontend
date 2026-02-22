import { useState, useEffect, useCallback } from 'react'
import { api, normStr, getToken } from '@/lib/api'
import type { ApiResponse } from '@/lib/api'
import type { Task, TaskStatus } from '@/types'

interface ApiTask {
  id: string
  jobId: string
  title: string
  type: string
  assignedUserIds: string[] | null
  estimatedHours: number
  actualHours: number
  billable: boolean
  status: string
  description: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  timerRunning: boolean
  timerSeconds: number
  lastStartedAt: string | null
  job: {
    id: string
    jobId: string
    title: string
    client: { id: string; company: string }
  }
  assignedUsers: Array<{
    id: string
    firstName: string
    lastName: string
    email: string
  }> | null
  createdBy?: { id: string; firstName: string; lastName: string; email: string } | null
}

/**
 * Convert API task to frontend Task.
 * If timer is running, compute the live seconds = DB_timerSeconds + (now - lastStartedAt)
 * so that page refresh shows the correct time without waiting for the next tick.
 */
function normaliseTask(t: ApiTask): Task {
  let timerSeconds = t.timerSeconds || 0
  if (t.timerRunning && t.lastStartedAt) {
    const elapsed = Math.floor((Date.now() - new Date(t.lastStartedAt).getTime()) / 1000)
    timerSeconds = (t.timerSeconds || 0) + Math.max(0, elapsed)
  }

  return {
    id: t.id,
    name: t.title,
    type: t.type,
    jobId: t.jobId,
    jobTitle: t.job?.title ?? '',
    clientName: t.job?.client?.company ?? '',
    assignedToNames: t.assignedUsers?.map(u => `${u.firstName} ${u.lastName}`).join(', ') || '',
    assignedToIds: t.assignedUserIds || [],
    createdByName: t.createdBy ? `${t.createdBy.firstName} ${t.createdBy.lastName}` : undefined,
    createdByEmail: t.createdBy?.email ?? undefined,
    estimatedHours: t.estimatedHours,
    actualHours: t.actualHours,
    billable: t.billable,
    status: normStr(t.status) as TaskStatus,
    startedAt: t.startedAt ?? undefined,
    completedAt: t.completedAt ?? undefined,
    timerRunning: t.timerRunning || false,
    timerSeconds,
    description: t.description ?? undefined,
  }
}

interface UseTasksOptions {
  jobId?: string
  status?: string
  search?: string
  assignedUserId?: string
}

export function useTasks(options: UseTasksOptions = {}) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(!!getToken())
  const [error, setError] = useState<string | null>(null)

  const fetchTasks = useCallback(async () => {
    if (!getToken()) { setLoading(false); return }
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({ limit: '200' })
      if (options.jobId) params.set('jobId', options.jobId)
      if (options.status && options.status !== 'all') params.set('status', options.status.toUpperCase())
      if (options.search) params.set('search', options.search)
      if (options.assignedUserId) params.set('assignedUserId', options.assignedUserId)

      const res = await api.get<ApiResponse<ApiTask[]>>(`/tasks?${params}`)
      setTasks((res.data ?? []).map(normaliseTask))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }, [options.jobId, options.status, options.search, options.assignedUserId])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  const createTask = async (data: Partial<Task> & { jobId: string }): Promise<Task | null> => {
    try {
      const res = await api.post<ApiResponse<ApiTask>>('/tasks', {
        jobId: data.jobId,
        title: data.name,
        type: data.type,
        assignedUserIds: data.assignedToIds || [],
        estimatedHours: data.estimatedHours ?? 0,
        billable: data.billable ?? true,
        description: data.description,
        status: (data.status ?? 'todo').toUpperCase(),
      })
      const created = normaliseTask(res.data)
      setTasks(prev => [created, ...prev])
      return created
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create task')
      return null
    }
  }

  const updateTask = async (id: string, data: Partial<Task>): Promise<boolean> => {
    try {
      const payload: Record<string, unknown> = {}
      if (data.name !== undefined) payload.title = data.name
      if (data.type !== undefined) payload.type = data.type
      if (data.assignedToIds !== undefined) payload.assignedUserIds = data.assignedToIds
      if (data.estimatedHours !== undefined) payload.estimatedHours = data.estimatedHours
      if (data.actualHours !== undefined) payload.actualHours = data.actualHours
      if (data.billable !== undefined) payload.billable = data.billable
      if (data.status !== undefined) payload.status = data.status.toUpperCase()
      if (data.description !== undefined) payload.description = data.description

      const res = await api.put<ApiResponse<ApiTask>>(`/tasks/${id}`, payload)
      const updated = normaliseTask(res.data)
      // Preserve live timer state when editing other fields
      setTasks(prev => prev.map(t => t.id === id ? { ...updated, timerRunning: t.timerRunning, timerSeconds: t.timerSeconds } : t))
      return true
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update task')
      return false
    }
  }

  const updateStatus = async (id: string, status: TaskStatus): Promise<boolean> => {
    try {
      await api.patch<ApiResponse<ApiTask>>(`/tasks/${id}/status`, { status: status.toUpperCase() })
      setTasks(prev => prev.map(t => t.id === id ? {
        ...t,
        status,
        startedAt: status === 'in_progress' && !t.startedAt ? new Date().toISOString() : t.startedAt,
        completedAt: status === 'completed' ? new Date().toISOString() : t.completedAt,
      } : t))
      return true
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update task status')
      return false
    }
  }

  const deleteTask = async (id: string): Promise<boolean> => {
    try {
      await api.delete(`/tasks/${id}`)
      setTasks(prev => prev.filter(t => t.id !== id))
      return true
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete task')
      return false
    }
  }

  /**
   * Start the timer for a task.
   * Backend sets lastStartedAt = now, keeps existing timerSeconds.
   */
  const startTimer = async (id: string): Promise<boolean> => {
    try {
      // Optimistically mark running in UI
      setTasks(prev => prev.map(t => ({
        ...t,
        timerRunning: t.id === id ? true : false, // only one at a time
      })))
      const res = await api.patch<ApiResponse<ApiTask>>(`/tasks/${id}/timer`, { timerRunning: true })
      const updated = normaliseTask(res.data)
      setTasks(prev => prev.map(t => t.id === id ? updated : t))
      return true
    } catch (e: unknown) {
      // Revert optimistic update
      setTasks(prev => prev.map(t => t.id === id ? { ...t, timerRunning: false } : t))
      setError(e instanceof Error ? e.message : 'Failed to start timer')
      return false
    }
  }

  /**
   * Pause the timer for a task.
   * Backend computes session seconds from lastStartedAt and accumulates into timerSeconds.
   * The returned task has the accurate accumulated timerSeconds.
   */
  const pauseTimer = async (id: string): Promise<boolean> => {
    try {
      // Optimistically stop in UI
      setTasks(prev => prev.map(t => t.id === id ? { ...t, timerRunning: false } : t))
      const res = await api.patch<ApiResponse<ApiTask>>(`/tasks/${id}/timer`, { timerRunning: false })
      const updated = normaliseTask(res.data)
      setTasks(prev => prev.map(t => t.id === id ? updated : t))
      return true
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to pause timer')
      return false
    }
  }

  // Tick the local timer every second for running tasks (UI only)
  const setTimerSeconds = (id: string, seconds: number) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, timerSeconds: seconds } : t))
  }

  // Tick timer by 1 second — uses functional update so never reads stale state
  const tickTimer = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, timerSeconds: t.timerSeconds + 1 } : t))
  }

  // Legacy setTimerRunning (kept for compat — startTimer/pauseTimer preferred)
  const setTimerRunning = (id: string, running: boolean) => {
    setTasks(prev => prev.map(t => ({
      ...t,
      timerRunning: t.id === id ? running : (running ? false : t.timerRunning),
    })))
  }

  // Legacy updateTimer — just sends a PING to backend (no longer updates timerSeconds)
  const updateTimer = async (id: string, timerData: { timerRunning: boolean; timerSeconds?: number }): Promise<boolean> => {
    try {
      await api.patch<ApiResponse<ApiTask>>(`/tasks/${id}/timer`, { timerRunning: timerData.timerRunning })
      return true
    } catch {
      return false
    }
  }

  return {
    tasks, setTasks, loading, error, refetch: fetchTasks,
    createTask, updateTask, updateStatus, deleteTask,
    startTimer, pauseTimer,
    setTimerSeconds, tickTimer, setTimerRunning, updateTimer,
  }
}
