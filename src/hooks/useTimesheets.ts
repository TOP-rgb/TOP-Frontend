import { useState, useEffect, useCallback } from 'react'
import { api, getToken } from '@/lib/api'
import type { ApiResponse } from '@/lib/api'

export interface TimesheetEntry {
  id: string
  userId: string
  userName: string
  jobId: string
  jobTitle: string
  clientName: string
  taskId?: string
  taskName?: string
  date: string
  hours: number
  description: string
  billable: boolean
  status: string  // 'pending_normal' | 'pending_approval' | 'approved' | 'rejected'
  flagReason?: string
  rejectionNote?: string
}

interface ApiTimesheetEntry {
  id: string
  userId: string
  user: { id: string; firstName: string; lastName: string }
  jobId: string
  job: { id: string; jobId: string; title: string; clientId: string; client?: { company: string } }
  taskId?: string | null
  task?: { id: string; title: string; billable?: boolean } | null
  date: string
  hours: number
  description: string | null
  status: string
  flagReason?: string | null
  rejectionNote?: string | null
}

function normaliseEntry(t: ApiTimesheetEntry): TimesheetEntry {
  // Parse date in local time to avoid UTC timezone shift (e.g. AEST UTC+10)
  const rawDate = t.date ? new Date(t.date) : null
  const localDate = rawDate
    ? `${rawDate.getFullYear()}-${String(rawDate.getMonth() + 1).padStart(2, '0')}-${String(rawDate.getDate()).padStart(2, '0')}`
    : ''
  return {
    id: t.id,
    userId: t.userId,
    userName: `${t.user?.firstName ?? ''} ${t.user?.lastName ?? ''}`.trim(),
    jobId: t.jobId,
    jobTitle: t.job?.title ?? '',
    clientName: t.job?.client?.company ?? '',
    taskId: t.taskId ?? undefined,
    taskName: t.task?.title ?? undefined,
    date: localDate,
    hours: t.hours,
    description: t.description ?? '',
    // billable is stored on Task, not on Timesheet — derive from linked task
    billable: t.task?.billable ?? false,
    status: (t.status ?? 'PENDING_NORMAL').toLowerCase() as string,
    flagReason: t.flagReason ?? undefined,
    rejectionNote: t.rejectionNote ?? undefined,
  }
}

interface UseTimesheetsOptions {
  userId?: string
  jobId?: string
  startDate?: string
  endDate?: string
}

export function useTimesheets(options: UseTimesheetsOptions = {}) {
  const [entries, setEntries] = useState<TimesheetEntry[]>([])
  const [pendingEntries, setPendingEntries] = useState<TimesheetEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTimesheets = useCallback(async () => {
    if (!getToken()) { return }
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({ limit: '200' })
      if (options.userId) params.set('userId', options.userId)
      if (options.jobId) params.set('jobId', options.jobId)
      if (options.startDate) params.set('startDate', options.startDate)
      if (options.endDate) params.set('endDate', options.endDate)

      const res = await api.get<ApiResponse<ApiTimesheetEntry[]>>(`/timesheets?${params}`)
      setEntries((res.data ?? []).map(normaliseEntry))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load timesheets')
    } finally {
      setLoading(false)
    }
  }, [options.userId, options.jobId, options.startDate, options.endDate])

  useEffect(() => { fetchTimesheets() }, [fetchTimesheets])

  const fetchPending = useCallback(async () => {
    if (!getToken()) return
    try {
      const res = await api.get<ApiResponse<ApiTimesheetEntry[]>>('/timesheets/pending')
      setPendingEntries((res.data ?? []).map(normaliseEntry))
    } catch {
      // Non-managers will get 403 — silently ignore
    }
  }, [])

  const logTime = async (data: {
    userId: string
    jobId: string
    taskId?: string
    date: string
    hours: number
    description?: string
  }): Promise<TimesheetEntry | null> => {
    try {
      const res = await api.post<ApiResponse<ApiTimesheetEntry>>('/timesheets', data)
      const entry = normaliseEntry(res.data)
      setEntries(prev => [entry, ...prev])
      return entry
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to log time')
      return null
    }
  }

  const deleteEntry = async (id: string): Promise<boolean> => {
    try {
      await api.delete(`/timesheets/${id}`)
      setEntries(prev => prev.filter(e => e.id !== id))
      return true
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete entry')
      return false
    }
  }

  const approveEntry = async (id: string): Promise<boolean> => {
    try {
      const res = await api.patch<ApiResponse<ApiTimesheetEntry>>(`/timesheets/${id}/approve`, {})
      const updated = normaliseEntry(res.data)
      setEntries(prev => prev.map(e => e.id === id ? updated : e))
      setPendingEntries(prev => prev.filter(e => e.id !== id))
      return true
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to approve entry')
      return false
    }
  }

  const rejectEntry = async (id: string, rejectionNote: string): Promise<boolean> => {
    try {
      const res = await api.patch<ApiResponse<ApiTimesheetEntry>>(`/timesheets/${id}/reject`, { rejectionNote })
      const updated = normaliseEntry(res.data)
      setEntries(prev => prev.map(e => e.id === id ? updated : e))
      setPendingEntries(prev => prev.filter(e => e.id !== id))
      return true
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to reject entry')
      return false
    }
  }

  // Aggregate total hours for a specific user
  const totalHoursForUser = (userId: string) =>
    entries.filter(e => e.userId === userId).reduce((sum, e) => sum + e.hours, 0)

  return {
    entries,
    pendingEntries,
    loading,
    error,
    refetch: fetchTimesheets,
    fetchPending,
    logTime,
    deleteEntry,
    approveEntry,
    rejectEntry,
    totalHoursForUser,
  }
}
