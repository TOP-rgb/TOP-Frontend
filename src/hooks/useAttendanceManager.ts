import { useState, useCallback } from 'react'
import { api } from '@/lib/api'
import type { ApiResponse } from '@/lib/api'
import type { AttendanceRecord, AttendanceException, RegularizationRequest, TeamStatus } from '@/types'

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
  const [exceptions, setExceptions] = useState<AttendanceException[]>([])
  const [exceptionsTotal, setExceptionsTotal] = useState(0)
  const [pendingRegularizations, setPendingRegularizations] = useState<RegularizationRequest[]>([])
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
      const res = await api.get<ApiResponse<AttendanceRecord[]>>(`/attendance/history?${q}`)
      setHistoryRecords(res.data)
      setHistoryTotal(res.pagination?.total ?? res.data.length)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchExceptions = useCallback(async (params?: ExceptionParams) => {
    try {
      setLoading(true)
      const q = new URLSearchParams()
      if (params?.userId) q.set('userId', params.userId)
      if (params?.type) q.set('type', params.type)
      if (params?.isReviewed !== undefined) q.set('isReviewed', String(params.isReviewed))
      if (params?.limit) q.set('limit', String(params.limit))
      if (params?.offset) q.set('offset', String(params.offset))
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
    exceptions,
    exceptionsTotal,
    pendingRegularizations,
    loading,
    error,
    fetchTeamStatus,
    fetchHistory,
    fetchExceptions,
    fetchPendingRegularizations,
    reviewException,
    reviewRegularization,
  }
}
