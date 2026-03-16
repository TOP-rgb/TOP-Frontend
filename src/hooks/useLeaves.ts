import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import type { ApiResponse } from '@/lib/api'
import type { LeaveType, LeaveBalance, LeaveRequest } from '@/types'

interface SubmitLeavePayload {
  leaveTypeId: string
  startDate: string
  endDate: string
  reason?: string
}

export function useLeaves() {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])
  const [myBalance, setMyBalance] = useState<LeaveBalance[]>([])
  const [myLeaves, setMyLeaves] = useState<LeaveRequest[]>([])
  const [pendingLeaves, setPendingLeaves] = useState<LeaveRequest[]>([])
  const [teamBalances, setTeamBalances] = useState<LeaveBalance[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchLeaveTypes = useCallback(async () => {
    try {
      const res = await api.get<ApiResponse<LeaveType[]>>('/leaves/types')
      setLeaveTypes(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leave types')
    }
  }, [])

  const fetchMyBalance = useCallback(async (year?: number) => {
    try {
      const q = year ? `?year=${year}` : ''
      const res = await api.get<ApiResponse<LeaveBalance[]>>(`/leaves/balance/mine${q}`)
      setMyBalance(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load balance')
    }
  }, [])

  const fetchMyLeaves = useCallback(async (params?: { year?: number; limit?: number; offset?: number }) => {
    try {
      setLoading(true)
      const q = new URLSearchParams()
      if (params?.year) q.set('year', String(params.year))
      if (params?.limit) q.set('limit', String(params.limit))
      if (params?.offset) q.set('offset', String(params.offset))
      const res = await api.get<ApiResponse<LeaveRequest[]>>(`/leaves/mine?${q}`)
      setMyLeaves(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leaves')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchPendingLeaves = useCallback(async () => {
    try {
      const res = await api.get<ApiResponse<LeaveRequest[]>>('/leaves/pending')
      setPendingLeaves(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pending leaves')
    }
  }, [])

  const fetchTeamBalances = useCallback(async (userId?: string, year?: number) => {
    try {
      const q = new URLSearchParams()
      if (userId) q.set('userId', userId)
      if (year) q.set('year', String(year))
      const res = await api.get<ApiResponse<LeaveBalance[]>>(`/leaves/balance?${q}`)
      setTeamBalances(res.data)
      return res.data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load team balances')
      return []
    }
  }, [])

  useEffect(() => {
    fetchLeaveTypes()
    fetchMyBalance()
    fetchMyLeaves()
  }, [fetchLeaveTypes, fetchMyBalance, fetchMyLeaves])

  const submitLeave = useCallback(async (payload: SubmitLeavePayload) => {
    const res = await api.post<ApiResponse<LeaveRequest>>('/leaves', payload)
    await Promise.all([fetchMyLeaves(), fetchMyBalance()])
    return res.data
  }, [fetchMyLeaves, fetchMyBalance])

  const cancelLeave = useCallback(async (id: string) => {
    await api.delete(`/leaves/${id}`)
    setMyLeaves(prev => prev.filter(l => l.id !== id))
    await fetchMyBalance()
  }, [fetchMyBalance])

  const cancelApprovedLeave = useCallback(async (id: string) => {
    await api.patch(`/leaves/${id}/cancel`, {})
    await fetchMyLeaves()
    await fetchMyBalance()
  }, [fetchMyLeaves, fetchMyBalance])

  const reviewLeave = useCallback(async (id: string, status: 'APPROVED' | 'REJECTED', reviewNote?: string) => {
    await api.patch<ApiResponse<LeaveRequest>>(`/leaves/${id}`, { status, reviewNote })
    setPendingLeaves(prev => prev.filter(l => l.id !== id))
  }, [])

  const createLeaveType = useCallback(async (data: Partial<LeaveType>) => {
    const res = await api.post<ApiResponse<LeaveType>>('/leaves/types', data)
    setLeaveTypes(prev => [...prev, res.data])
    return res.data
  }, [])

  const updateLeaveType = useCallback(async (id: string, data: Partial<LeaveType>) => {
    const res = await api.put<ApiResponse<LeaveType>>(`/leaves/types/${id}`, data)
    setLeaveTypes(prev => prev.map(t => t.id === id ? res.data : t))
    return res.data
  }, [])

  const deleteLeaveType = useCallback(async (id: string) => {
    const res = await api.delete<ApiResponse<{ deleted: boolean; message: string }>>(`/leaves/types/${id}`)
    if (res.data.deleted) {
      // Hard-deleted — remove from list entirely
      setLeaveTypes(prev => prev.filter(t => t.id !== id))
    } else {
      // Soft-deleted (usage exists) — mark inactive in list
      setLeaveTypes(prev => prev.map(t => t.id === id ? { ...t, isActive: false } : t))
    }
    return res.data
  }, [])

  const setLeaveBalance = useCallback(async (data: { userId: string; leaveTypeId: string; year: number; allocated: number }) => {
    const res = await api.post<ApiResponse<LeaveBalance>>('/leaves/balance', data)
    return res.data
  }, [])

  const processCarryForward = useCallback(async (fromYear: number) => {
    const res = await api.post<ApiResponse<{ processed: number; totalCarried: number }>>('/leaves/carry-forward', { fromYear })
    return res.data
  }, [])

  return {
    leaveTypes,
    myBalance,
    myLeaves,
    pendingLeaves,
    teamBalances,
    loading,
    error,
    submitLeave,
    cancelLeave,
    cancelApprovedLeave,
    reviewLeave,
    fetchPendingLeaves,
    fetchTeamBalances,
    fetchMyBalance,
    fetchMyLeaves,
    createLeaveType,
    updateLeaveType,
    deleteLeaveType,
    setLeaveBalance,
    processCarryForward,
    refetchTypes: fetchLeaveTypes,
  }
}
