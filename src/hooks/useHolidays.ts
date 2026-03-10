import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import type { ApiResponse } from '@/lib/api'
import type { PublicHoliday } from '@/types'

export function useHolidays(year?: number, all?: boolean) {
  const [holidays, setHolidays] = useState<PublicHoliday[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentYear = year ?? new Date().getFullYear()

  const fetchHolidays = useCallback(async (y?: number) => {
    try {
      setLoading(true)
      const url = `/holidays?year=${y ?? currentYear}${all ? '&all=true' : ''}`
      const res = await api.get<ApiResponse<PublicHoliday[]>>(url)
      setHolidays(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load holidays')
    } finally {
      setLoading(false)
    }
  }, [currentYear, all])

  useEffect(() => { fetchHolidays() }, [fetchHolidays])

  const createHoliday = useCallback(async (data: { name: string; date: string; type?: string; countryCode?: string }) => {
    const res = await api.post<ApiResponse<PublicHoliday>>('/holidays', data)
    setHolidays(prev => [...prev, res.data].sort((a, b) => a.date.localeCompare(b.date)))
    return res.data
  }, [])

  const updateHoliday = useCallback(async (id: string, data: Partial<PublicHoliday>) => {
    const res = await api.put<ApiResponse<PublicHoliday>>(`/holidays/${id}`, data)
    setHolidays(prev => prev.map(h => h.id === id ? res.data : h))
    return res.data
  }, [])

  const deleteHoliday = useCallback(async (id: string) => {
    await api.delete(`/holidays/${id}`)
    setHolidays(prev => prev.filter(h => h.id !== id))
  }, [])

  const importHolidays = useCallback(async (importYear: number, countryCode: string, apiKey?: string) => {
    const res = await api.post<ApiResponse<{ imported: number; skipped: number }>>(
      '/holidays/import',
      { year: importYear, countryCode, ...(apiKey ? { apiKey } : {}) }
    )
    await fetchHolidays(importYear)
    return res.data
  }, [fetchHolidays])

  return { holidays, loading, error, createHoliday, updateHoliday, deleteHoliday, importHolidays, refetch: fetchHolidays }
}
