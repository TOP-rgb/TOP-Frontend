import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────

export type FieldType = 'text' | 'number' | 'date' | 'select' | 'checkbox' | 'textarea' | 'client' | 'job' | 'tasktype' | 'users'

export interface LayoutField {
  key: string
  label: string
  type: FieldType
  required: boolean
  system: boolean       // true = cannot be removed
  order: number
  options?: string[]    // for 'select' type
  placeholder?: string
}

export interface JobLayout {
  id: string
  name: string
  isDefault: boolean
  fields: LayoutField[]
  createdAt: string
  updatedAt: string
}

export interface TaskLayout {
  id: string
  name: string
  isDefault: boolean
  fields: LayoutField[]
  createdAt: string
  updatedAt: string
}

interface ApiResponse<T> {
  success: boolean
  data?: T
  systemFields?: LayoutField[]
}

// ── Job Layouts Hook ──────────────────────────────────────────────────────────

export function useJobLayouts() {
  const [layouts, setLayouts] = useState<JobLayout[]>([])
  const [systemFields, setSystemFields] = useState<LayoutField[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<ApiResponse<JobLayout[]>>('/layouts/jobs')
      if (res.success) {
        setLayouts(res.data ?? [])
        if (res.systemFields) setSystemFields(res.systemFields)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load layouts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const create = useCallback(async (name: string, customFields: LayoutField[], isDefault = false): Promise<JobLayout | null> => {
    try {
      const res = await api.post<ApiResponse<JobLayout>>('/layouts/jobs', { name, customFields, isDefault })
      if (res.success && res.data) {
        setLayouts(prev => [...prev, res.data!])
        return res.data
      }
      return null
    } catch { return null }
  }, [])

  const update = useCallback(async (id: string, payload: { name?: string; customFields?: LayoutField[]; isDefault?: boolean }): Promise<boolean> => {
    try {
      const res = await api.put<ApiResponse<JobLayout>>(`/layouts/jobs/${id}`, payload)
      if (res.success && res.data) {
        setLayouts(prev => prev.map(l => l.id === id ? res.data! : l))
        return true
      }
      return false
    } catch { return false }
  }, [])

  const remove = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await api.delete<ApiResponse<null>>(`/layouts/jobs/${id}`)
      if (res.success) {
        setLayouts(prev => prev.filter(l => l.id !== id))
        return true
      }
      return false
    } catch { return false }
  }, [])

  const setDefault = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await api.patch<ApiResponse<JobLayout>>(`/layouts/jobs/${id}/default`, {})
      if (res.success && res.data) {
        setLayouts(prev => prev.map(l => ({ ...l, isDefault: l.id === id })))
        return true
      }
      return false
    } catch { return false }
  }, [])

  const defaultLayout = layouts.find(l => l.isDefault) ?? layouts[0] ?? null

  return { layouts, systemFields, loading, error, refetch: fetch, create, update, remove, setDefault, defaultLayout }
}

// ── Task Layouts Hook ─────────────────────────────────────────────────────────

export function useTaskLayouts() {
  const [layouts, setLayouts] = useState<TaskLayout[]>([])
  const [systemFields, setSystemFields] = useState<LayoutField[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<ApiResponse<TaskLayout[]>>('/layouts/tasks')
      if (res.success) {
        setLayouts(res.data ?? [])
        if (res.systemFields) setSystemFields(res.systemFields)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load layouts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const create = useCallback(async (name: string, customFields: LayoutField[], isDefault = false): Promise<TaskLayout | null> => {
    try {
      const res = await api.post<ApiResponse<TaskLayout>>('/layouts/tasks', { name, customFields, isDefault })
      if (res.success && res.data) {
        setLayouts(prev => [...prev, res.data!])
        return res.data
      }
      return null
    } catch { return null }
  }, [])

  const update = useCallback(async (id: string, payload: { name?: string; customFields?: LayoutField[]; isDefault?: boolean }): Promise<boolean> => {
    try {
      const res = await api.put<ApiResponse<TaskLayout>>(`/layouts/tasks/${id}`, payload)
      if (res.success && res.data) {
        setLayouts(prev => prev.map(l => l.id === id ? res.data! : l))
        return true
      }
      return false
    } catch { return false }
  }, [])

  const remove = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await api.delete<ApiResponse<null>>(`/layouts/tasks/${id}`)
      if (res.success) {
        setLayouts(prev => prev.filter(l => l.id !== id))
        return true
      }
      return false
    } catch { return false }
  }, [])

  const setDefault = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await api.patch<ApiResponse<TaskLayout>>(`/layouts/tasks/${id}/default`, {})
      if (res.success && res.data) {
        setLayouts(prev => prev.map(l => ({ ...l, isDefault: l.id === id })))
        return true
      }
      return false
    } catch { return false }
  }, [])

  const defaultLayout = layouts.find(l => l.isDefault) ?? layouts[0] ?? null

  return { layouts, systemFields, loading, error, refetch: fetch, create, update, remove, setDefault, defaultLayout }
}
