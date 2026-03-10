import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import type { ApiResponse } from '@/lib/api'
import type { ShiftTemplate, ShiftAssignment } from '@/types'

export function useShifts() {
  const [shifts, setShifts] = useState<ShiftTemplate[]>([])
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchShifts = useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.get<ApiResponse<ShiftTemplate[]>>('/shifts')
      setShifts(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load shifts')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchAssignments = useCallback(async (userId?: string) => {
    try {
      const q = userId ? `?userId=${userId}` : ''
      const res = await api.get<ApiResponse<ShiftAssignment[]>>(`/shifts/assignments${q}`)
      setAssignments(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assignments')
    }
  }, [])

  useEffect(() => {
    fetchShifts()
    fetchAssignments()
  }, [fetchShifts, fetchAssignments])

  const createShift = useCallback(async (data: Partial<ShiftTemplate>) => {
    const res = await api.post<ApiResponse<ShiftTemplate>>('/shifts', data)
    await fetchShifts()
    return res.data
  }, [fetchShifts])

  const updateShift = useCallback(async (id: string, data: Partial<ShiftTemplate>) => {
    const res = await api.put<ApiResponse<ShiftTemplate>>(`/shifts/${id}`, data)
    setShifts(prev => prev.map(s => s.id === id ? res.data : s))
    return res.data
  }, [])

  const deleteShift = useCallback(async (id: string) => {
    await api.delete(`/shifts/${id}`)
    setShifts(prev => prev.map(s => s.id === id ? { ...s, isActive: false } : s))
  }, [])

  const assignShift = useCallback(async (data: { userId: string; shiftId: string; effectiveFrom: string; effectiveTo?: string }) => {
    const res = await api.post<ApiResponse<ShiftAssignment>>('/shifts/assign', data)
    await fetchAssignments()
    return res.data
  }, [fetchAssignments])

  const removeAssignment = useCallback(async (id: string) => {
    await api.delete(`/shifts/assignments/${id}`)
    setAssignments(prev => prev.filter(a => a.id !== id))
  }, [])

  const updateAssignment = useCallback(async (id: string, data: Partial<ShiftAssignment>) => {
    const res = await api.put<ApiResponse<ShiftAssignment>>(`/shifts/assignments/${id}`, data)
    setAssignments(prev => prev.map(a => a.id === id ? res.data : a))
    return res.data
  }, [])

  return {
    shifts,
    assignments,
    loading,
    error,
    createShift,
    updateShift,
    deleteShift,
    assignShift,
    removeAssignment,
    updateAssignment,
    fetchAssignments,
    refetch: fetchShifts,
  }
}
