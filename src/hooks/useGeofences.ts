import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import type { ApiResponse } from '@/lib/api'
import type { GeofenceLocation } from '@/types'

export function useGeofences() {
  const [geofences, setGeofences] = useState<GeofenceLocation[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchGeofences = useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.get<ApiResponse<GeofenceLocation[]>>('/geofences')
      setGeofences(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load geofences')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchGeofences() }, [fetchGeofences])

  const createGeofence = useCallback(async (data: Partial<GeofenceLocation>) => {
    const res = await api.post<ApiResponse<GeofenceLocation>>('/geofences', data)
    setGeofences(prev => [...prev, res.data])
    return res.data
  }, [])

  const updateGeofence = useCallback(async (id: string, data: Partial<GeofenceLocation>) => {
    const res = await api.put<ApiResponse<GeofenceLocation>>(`/geofences/${id}`, data)
    setGeofences(prev => prev.map(g => g.id === id ? res.data : g))
    return res.data
  }, [])

  const deactivateGeofence = useCallback(async (id: string) => {
    const res = await api.put<ApiResponse<GeofenceLocation>>(`/geofences/${id}`, { isActive: false })
    setGeofences(prev => prev.map(g => g.id === id ? res.data : g))
    return res.data
  }, [])

  const deleteGeofence = useCallback(async (id: string) => {
    await api.delete(`/geofences/${id}`)
    setGeofences(prev => prev.filter(g => g.id !== id))
  }, [])

  return { geofences, loading, error, createGeofence, updateGeofence, deactivateGeofence, deleteGeofence, refetch: fetchGeofences }
}
