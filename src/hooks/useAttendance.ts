import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import type { ApiResponse } from '@/lib/api'
import type { AttendanceRecord, RegularizationRequest, WorkMode } from '@/types'

interface TodayResponse {
  record: AttendanceRecord | null
  isHoliday: boolean
  holiday: { name: string } | null
  isOnLeave: boolean
  leaveType: { name: string; color: string } | null
  approvedWFH: { id: string; mode: WorkMode } | null
  shift: { name: string; startTime: string; endTime: string; gracePeriodMinutes: number; workingDays: number[] } | null
}

interface CheckInPayload {
  latitude?: number
  longitude?: number
  isRemote?: boolean
  workMode?: WorkMode
}

interface RegularizationPayload {
  recordId: string
  requestedCheckIn: string
  requestedCheckOut?: string
  reason: string
}

export function useAttendance() {
  const [todayData, setTodayData] = useState<TodayResponse | null>(null)
  const [history, setHistory] = useState<AttendanceRecord[]>([])
  const [myRegularizations, setMyRegularizations] = useState<RegularizationRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchToday = useCallback(async () => {
    try {
      const res = await api.get<ApiResponse<TodayResponse>>('/attendance/today')
      setTodayData(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load today status')
    }
  }, [])

  const fetchHistory = useCallback(async (params?: { startDate?: string; endDate?: string; limit?: number; offset?: number }) => {
    try {
      setLoading(true)
      const q = new URLSearchParams()
      if (params?.startDate) q.set('startDate', params.startDate)
      if (params?.endDate) q.set('endDate', params.endDate)
      if (params?.limit) q.set('limit', String(params.limit))
      if (params?.offset) q.set('offset', String(params.offset))
      const res = await api.get<ApiResponse<AttendanceRecord[]>>(`/attendance/mine?${q}`)
      setHistory(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchMyRegularizations = useCallback(async () => {
    try {
      const res = await api.get<ApiResponse<RegularizationRequest[]>>('/attendance/regularizations/mine')
      setMyRegularizations(res.data)
    } catch {
      // non-critical
    }
  }, [])

  useEffect(() => {
    fetchToday()
    fetchHistory()
    fetchMyRegularizations()
  }, [fetchToday, fetchHistory, fetchMyRegularizations])

  const checkIn = useCallback(async (coords?: CheckInPayload) => {
    const res = await api.post<ApiResponse<AttendanceRecord>>('/attendance/checkin', coords ?? {})
    await fetchToday()
    return res.data
  }, [fetchToday])

  const checkOut = useCallback(async (coords?: CheckInPayload) => {
    const res = await api.patch<ApiResponse<AttendanceRecord>>('/attendance/checkout', coords ?? {})
    await fetchToday()
    return res.data
  }, [fetchToday])

  const submitRegularization = useCallback(async (payload: RegularizationPayload) => {
    const res = await api.post<ApiResponse<RegularizationRequest>>('/attendance/regularizations', payload)
    await fetchMyRegularizations()
    return res.data
  }, [fetchMyRegularizations])

  return {
    todayData,
    todayRecord: todayData?.record ?? null,
    history,
    myRegularizations,
    loading,
    error,
    checkIn,
    checkOut,
    submitRegularization,
    refetchToday: fetchToday,
    refetchHistory: fetchHistory,
    refetchRegularizations: fetchMyRegularizations,
  }
}
