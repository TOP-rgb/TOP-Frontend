import { useState, useCallback, useRef } from 'react'
import { api } from '@/lib/api'
import type { ApiResponse } from '@/lib/api'
import type { AttendanceRecord, AttendanceException, RegularizationRequest, TeamStatus, AttendanceStats } from '@/types'

interface HistoryParams {
  userId?: string
  startDate?: string
  endDate?: string
  status?: string
  limit?: number
  offset?: number
}

interface ExceptionParams {
  userId?: string
  type?: string
  isReviewed?: boolean
  limit?: number
  offset?: number
}

export function useAttendanceManager() {
  const [teamStatus, setTeamStatus] = useState<TeamStatus | null>(null)
  const [historyRecords, setHistoryRecords] = useState<AttendanceRecord[]>([])
  const [historyTotal, setHistoryTotal] = useState(0)
  const [historyUserWorkingDays, setHistoryUserWorkingDays] = useState<number[] | null>(null)
  const [exceptions, setExceptions] = useState<AttendanceException[]>([])
  const [exceptionsTotal, setExceptionsTotal] = useState(0)
  const lastExceptionParamsRef = useRef<ExceptionParams | undefined>(undefined)
  const [pendingRegularizations, setPendingRegularizations] = useState<RegularizationRequest[]>([])
  const [stats, setStats] = useState<AttendanceStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTeamStatus = useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.get<ApiResponse<TeamStatus>>('/attendance/team')
      setTeamStatus(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load team status')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchHistory = useCallback(async (params?: HistoryParams) => {
    try {
      setLoading(true)
      const q = new URLSearchParams()
      if (params?.userId) q.set('userId', params.userId)
      if (params?.startDate) q.set('startDate', params.startDate)
      if (params?.endDate) q.set('endDate', params.endDate)
      if (params?.status) q.set('status', params.status)
      if (params?.limit) q.set('limit', String(params.limit))
      if (params?.offset) q.set('offset', String(params.offset))
      const res = await api.get<ApiResponse<AttendanceRecord[]> & { meta?: { userWorkingDays: number[] | null } }>(`/attendance/history?${q}`)
      setHistoryRecords(res.data)
      setHistoryTotal(res.pagination?.total ?? res.data.length)
      setHistoryUserWorkingDays(res.meta?.userWorkingDays ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchExceptions = useCallback(async (params?: ExceptionParams) => {
    // Save params so loadMoreExceptions can reuse the same filters
    lastExceptionParamsRef.current = params
    try {
      setLoading(true)
      const q = new URLSearchParams()
      if (params?.userId) q.set('userId', params.userId)
      if (params?.type) q.set('type', params.type)
      if (params?.isReviewed !== undefined) q.set('isReviewed', String(params.isReviewed))
      q.set('limit',  String(params?.limit ?? 20))  // always page the initial fetch
      // Fresh fetch — always start from offset 0 (reset the list)
      const res = await api.get<ApiResponse<AttendanceException[]>>(`/attendance/exceptions?${q}`)
      setExceptions(res.data)
      setExceptionsTotal(res.pagination?.total ?? res.data.length)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load exceptions')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchPendingRegularizations = useCallback(async () => {
    try {
      const res = await api.get<ApiResponse<RegularizationRequest[]>>('/attendance/regularizations/pending')
      setPendingRegularizations(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load regularizations')
    }
  }, [])

  const fetchStats = useCallback(async (params?: { startDate?: string; endDate?: string }) => {
    try {
      setStatsLoading(true)
      const q = new URLSearchParams()
      if (params?.startDate) q.set('startDate', params.startDate)
      if (params?.endDate) q.set('endDate', params.endDate)
      const res = await api.get<ApiResponse<AttendanceStats>>(`/attendance/stats?${q}`)
      setStats(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats')
    } finally {
      setStatsLoading(false)
    }
  }, [])

  const loadMoreExceptions = useCallback(async () => {
    // Reuse the same filters that were active during the last fetchExceptions call
    const p = lastExceptionParamsRef.current
    try {
      setLoading(true)
      const q = new URLSearchParams()
      if (p?.userId) q.set('userId', p.userId)
      if (p?.type) q.set('type', p.type)
      if (p?.isReviewed !== undefined) q.set('isReviewed', String(p.isReviewed))
      q.set('limit',  String(p?.limit ?? 20))
      q.set('offset', String(exceptions.length))  // append after already-loaded rows
      const res = await api.get<ApiResponse<AttendanceException[]>>(`/attendance/exceptions?${q}`)
      setExceptions(prev => [...prev, ...res.data])
      setExceptionsTotal(res.pagination?.total ?? exceptionsTotal)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more exceptions')
    } finally {
      setLoading(false)
    }
  }, [exceptions.length, exceptionsTotal])

  const reviewException = useCallback(async (id: string) => {
    await api.patch<ApiResponse<AttendanceException>>(`/attendance/exceptions/${id}/review`, {})
    setExceptions(prev => prev.map(e => e.id === id ? { ...e, isReviewed: true } : e))
  }, [])

  const reviewRegularization = useCallback(async (id: string, status: 'APPROVED' | 'REJECTED', reviewNote?: string) => {
    await api.patch<ApiResponse<RegularizationRequest>>(`/attendance/regularizations/${id}`, { status, reviewNote })
    setPendingRegularizations(prev => prev.filter(r => r.id !== id))
  }, [])

  return {
    teamStatus,
    historyRecords,
    historyTotal,
    historyUserWorkingDays,
    exceptions,
    exceptionsTotal,
    pendingRegularizations,
    stats,
    statsLoading,
    loading,
    error,
    fetchTeamStatus,
    fetchHistory,
    fetchExceptions,
    loadMoreExceptions,
    fetchPendingRegularizations,
    fetchStats,
    reviewException,
    reviewRegularization,
  }
}
