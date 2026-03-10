import { useState, useCallback } from 'react'
import { api } from '@/lib/api'
import type { ApiResponse } from '@/lib/api'
import type { AttendanceWorkPolicy, WorkMode } from '@/types'

export function useWorkPolicies() {
  const [policies, setPolicies] = useState<AttendanceWorkPolicy[]>([])
  const [loading, setLoading] = useState(false)
  const [hasFetched, setHasFetched] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPolicies = useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.get<ApiResponse<AttendanceWorkPolicy[]>>('/attendance/work-policies')
      setPolicies(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load work policies')
    } finally {
      setLoading(false)
      setHasFetched(true)
    }
  }, [])

  /** Create or update a policy for a specific user */
  const upsertPolicy = useCallback(async (userId: string, allowedModes: WorkMode[]) => {
    const res = await api.put<ApiResponse<AttendanceWorkPolicy>>(
      `/attendance/work-policies/${userId}`,
      { allowedModes },
    )
    setPolicies(prev => {
      const exists = prev.find(p => p.userId === userId)
      return exists
        ? prev.map(p => p.userId === userId ? res.data : p)
        : [...prev, res.data]
    })
    return res.data
  }, [])

  /** Remove the policy for a user (resets to unrestricted — all modes allowed) */
  const deletePolicy = useCallback(async (userId: string) => {
    await api.delete(`/attendance/work-policies/${userId}`)
    setPolicies(prev => prev.filter(p => p.userId !== userId))
  }, [])

  return { policies, loading, hasFetched, error, fetchPolicies, upsertPolicy, deletePolicy }
}
