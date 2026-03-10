import { useState, useCallback } from 'react'
import { api } from '@/lib/api'
import type { ApiResponse } from '@/lib/api'
import type { WFHRequest, WorkMode } from '@/types'

export function useWFHRequests() {
  const [myRequests, setMyRequests] = useState<WFHRequest[]>([])
  const [pendingRequests, setPendingRequests] = useState<WFHRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /** Fetch calling employee's own WFH requests */
  const fetchMyRequests = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await api.get<ApiResponse<WFHRequest[]>>('/attendance/wfh-requests/mine')
      setMyRequests(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load WFH requests')
    } finally {
      setLoading(false)
    }
  }, [])

  /** Fetch all PENDING WFH requests for the org (manager only) */
  const fetchPending = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await api.get<ApiResponse<WFHRequest[]>>('/attendance/wfh-requests/pending')
      setPendingRequests(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pending WFH requests')
    } finally {
      setLoading(false)
    }
  }, [])

  /** Submit a new WFH / Travel request */
  const submitRequest = useCallback(async (
    startDate: string,
    endDate: string,
    mode: WorkMode,
    reason?: string,
  ) => {
    const res = await api.post<ApiResponse<WFHRequest>>('/attendance/wfh-requests', {
      startDate, endDate, mode, reason,
    })
    setMyRequests(prev => [res.data, ...prev])
    return res.data
  }, [])

  /** Approve or reject a request (manager only) */
  const reviewRequest = useCallback(async (
    id: string,
    status: 'APPROVED' | 'REJECTED',
    reviewNote?: string,
  ) => {
    const res = await api.patch<ApiResponse<WFHRequest>>(`/attendance/wfh-requests/${id}`, {
      status, reviewNote,
    })
    setPendingRequests(prev => prev.filter(r => r.id !== id))
    setMyRequests(prev => prev.map(r => r.id === id ? res.data : r))
    return res.data
  }, [])

  /** Cancel a pending request (employee only) */
  const cancelRequest = useCallback(async (id: string) => {
    await api.delete(`/attendance/wfh-requests/${id}`)
    setMyRequests(prev => prev.filter(r => r.id !== id))
  }, [])

  return {
    myRequests,
    pendingRequests,
    loading,
    error,
    fetchMyRequests,
    fetchPending,
    submitRequest,
    reviewRequest,
    cancelRequest,
  }
}
