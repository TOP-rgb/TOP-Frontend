import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '@/lib/api'
import type { ApiResponse } from '@/lib/api'
import type { AttendanceRecord, RegularizationRequest, WorkMode, CompOffCredit } from '@/types'

interface TodayResponse {
  record: AttendanceRecord | null
  isHoliday: boolean
  holiday: { name: string } | null
  isOnLeave: boolean
  leaveType: { name: string; color: string } | null
  approvedWFH: { id: string; mode: WorkMode } | null
  shift: { name: string; startTime: string; endTime: string; gracePeriodMinutes: number; workingDays: number[] } | null
  workingDays: number[] | null  // always present — even on off days when shift is null
}

interface CheckInPayload {
  latitude?: number
  longitude?: number
  isRemote?: boolean
  workMode?: WorkMode
}

interface RegularizationPayload {
  recordId?: string   // for existing records
  date?: string       // for absent (synthetic) records — YYYY-MM-DD
  requestedCheckIn: string
  requestedCheckOut?: string
  reason: string
}

// checkout response extends the standard shape with the top-level comp-off flag
interface CheckOutApiResponse extends ApiResponse<AttendanceRecord> {
  compOffEarned?: boolean
}

export function useAttendance() {
  const [todayData, setTodayData] = useState<TodayResponse | null>(null)
  const [history, setHistory] = useState<AttendanceRecord[]>([])
  const [calendarHistory, setCalendarHistory] = useState<AttendanceRecord[]>([])
  const [calendarLoading, setCalendarLoading] = useState(false)
  const [myRegularizations, setMyRegularizations] = useState<RegularizationRequest[]>([])
  const [compOffCredits, setCompOffCredits] = useState<CompOffCredit[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Remembers the most recently used date filter so that param-less calls
  // (e.g. after check-in / check-out, or the chained auto-close fetch on mount)
  // always re-use the current filter instead of falling back to the backend's
  // default "current month" range and overwriting whatever the UI filter shows.
  const lastHistoryParamsRef = useRef<{ startDate?: string; endDate?: string; limit?: number; offset?: number } | undefined>(undefined)

  const fetchToday = useCallback(async () => {
    try {
      const res = await api.get<ApiResponse<TodayResponse>>('/attendance/today')
      setTodayData(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load today status')
    }
  }, [])

  const fetchHistory = useCallback(async (params?: { startDate?: string; endDate?: string; limit?: number; offset?: number }) => {
    // Persist explicit params for future param-less calls (auto-refresh after
    // check-in/out, or the chained auto-close fetch on mount).
    if (params !== undefined) lastHistoryParamsRef.current = params
    // If called without params, re-use the last known filter so the visible
    // date range in the UI stays consistent.
    const effectiveParams = params ?? lastHistoryParamsRef.current
    try {
      setLoading(true)
      const q = new URLSearchParams()
      if (effectiveParams?.startDate) q.set('startDate', effectiveParams.startDate)
      if (effectiveParams?.endDate) q.set('endDate', effectiveParams.endDate)
      if (effectiveParams?.limit) q.set('limit', String(effectiveParams.limit))
      if (effectiveParams?.offset) q.set('offset', String(effectiveParams.offset))
      const res = await api.get<ApiResponse<AttendanceRecord[]>>(`/attendance/mine?${q}`)
      setHistory(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchCalendarHistory = useCallback(async (startDate: string, endDate: string) => {
    try {
      setCalendarLoading(true)
      // limit=62: max 31 days + up to 31 synthetic absent entries
      const q = new URLSearchParams({ startDate, endDate, limit: '62' })
      const res = await api.get<ApiResponse<AttendanceRecord[]>>(`/attendance/mine?${q}`)
      setCalendarHistory(res.data)
    } catch {
      // non-critical — calendar shows fewer absent entries but still works
    } finally {
      setCalendarLoading(false)
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
    // fetchToday runs autoCloseStaleRecords on the backend — sequence fetchHistory
    // after it resolves so history always reflects the auto-closed workMinutes,
    // not the stale open record from a previous day.
    fetchToday().then(() => fetchHistory())
    fetchMyRegularizations()
  }, [fetchToday, fetchHistory, fetchMyRegularizations])

  const checkIn = useCallback(async (coords?: CheckInPayload) => {
    const res = await api.post<ApiResponse<AttendanceRecord>>('/attendance/checkin', coords ?? {})
    await fetchToday()
    fetchHistory()   // keep history in sync (clears stale checkOutAt on re-check-in)
    return res.data
  }, [fetchToday, fetchHistory])

  const checkOut = useCallback(async (coords?: CheckInPayload) => {
    const res = await api.patch<CheckOutApiResponse>('/attendance/checkout', coords ?? {})
    await fetchToday()
    fetchHistory()   // refresh so history Hours column shows updated workMinutes immediately
    // Return the full response so the caller can read compOffEarned
    return res
  }, [fetchToday, fetchHistory])

  const fetchCompOffCredits = useCallback(async (params?: { status?: string; limit?: number; offset?: number }) => {
    try {
      const q = new URLSearchParams()
      if (params?.status) q.set('status', params.status)
      if (params?.limit)  q.set('limit',  String(params.limit))
      if (params?.offset) q.set('offset', String(params.offset))
      const res = await api.get<ApiResponse<CompOffCredit[]>>(`/attendance/compoff/credits?${q}`)
      setCompOffCredits(res.data)
    } catch {
      // non-critical — comp-off table just stays empty
    }
  }, [])

  const submitRegularization = useCallback(async (payload: RegularizationPayload) => {
    const res = await api.post<ApiResponse<RegularizationRequest>>('/attendance/regularizations', payload)
    await fetchMyRegularizations()
    return res.data
  }, [fetchMyRegularizations])

  return {
    todayData,
    todayRecord: todayData?.record ?? null,
    history,
    calendarHistory,
    calendarLoading,
    myRegularizations,
    compOffCredits,
    loading,
    error,
    checkIn,
    checkOut,
    submitRegularization,
    refetchToday: fetchToday,
    refetchHistory: fetchHistory,
    fetchCalendarHistory,
    refetchRegularizations: fetchMyRegularizations,
    refetchCompOffCredits: fetchCompOffCredits,
  }
}
