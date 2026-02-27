import { useState, useEffect, useCallback } from 'react'
import { api, getToken } from '@/lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OrgSettings {
  // Org identity
  orgName: string
  orgSlug: string
  // Profile
  logoUrl: string | null
  address: string | null
  timezone: string
  website: string | null
  phone: string | null
  abn: string | null
  // Localisation
  currency: string
  currencySymbol: string
  dateFormat: string
  numberFormat: string
  // Notifications
  notifyTimesheetApproval: boolean
  notifyInvoiceOverdue: boolean
  notifyFlaggedTimesheets: boolean
  notifyJobDeadline: boolean
  notifyNewUser: boolean
  overdueInvoiceDays: number
  // Billing
  defaultHourlyRate: number | null
  billingIncrement: number
  defaultTaxRate: number
  invoicePrefix: string
  invoicePaymentTermsDays: number
  // Workflow
  dailyHoursThreshold: number
  flagUnderHours: boolean
  flagOverHours: boolean
  flagJobOvertime: boolean
  hourlyCostRatio: number
  requireClientForJob: boolean
}

export interface TaskType {
  id: string
  name: string
  color: string
  billableByDefault: boolean
  isActive: boolean
  displayOrder: number
}

export type SettingsSection = 'profile' | 'localisation' | 'notifications' | 'billing' | 'workflow'

interface ApiResponse<T> {
  success: boolean
  data?: T
}

interface SettingsApiResponse {
  org: { id: string; name: string; slug: string }
  settings: Record<string, unknown>
}

// ── Default values ────────────────────────────────────────────────────────────

const DEFAULTS: OrgSettings = {
  orgName: '',
  orgSlug: '',
  logoUrl: null,
  address: null,
  timezone: 'Australia/Sydney',
  website: null,
  phone: null,
  abn: null,
  currency: 'AUD',
  currencySymbol: '$',
  dateFormat: 'DD/MM/YYYY',
  numberFormat: '1,234.56',
  notifyTimesheetApproval: true,
  notifyInvoiceOverdue: true,
  notifyFlaggedTimesheets: true,
  notifyJobDeadline: true,
  notifyNewUser: false,
  overdueInvoiceDays: 7,
  defaultHourlyRate: null,
  billingIncrement: 15,
  defaultTaxRate: 10,
  invoicePrefix: 'INV',
  invoicePaymentTermsDays: 30,
  dailyHoursThreshold: 8,
  flagUnderHours: true,
  flagOverHours: true,
  flagJobOvertime: true,
  hourlyCostRatio: 0.70,
  requireClientForJob: false,
}

function mergeApiResponse(raw: SettingsApiResponse): OrgSettings {
  const s = raw.settings ?? {}
  return {
    orgName: raw.org?.name ?? '',
    orgSlug: raw.org?.slug ?? '',
    logoUrl: (s.logoUrl as string | null) ?? null,
    address: (s.address as string | null) ?? null,
    timezone: (s.timezone as string) || 'Australia/Sydney',
    website: (s.website as string | null) ?? null,
    phone: (s.phone as string | null) ?? null,
    abn: (s.abn as string | null) ?? null,
    currency: (s.currency as string) || 'AUD',
    currencySymbol: (s.currencySymbol as string) || '$',
    dateFormat: (s.dateFormat as string) || 'DD/MM/YYYY',
    numberFormat: (s.numberFormat as string) || '1,234.56',
    notifyTimesheetApproval: (s.notifyTimesheetApproval as boolean) ?? true,
    notifyInvoiceOverdue: (s.notifyInvoiceOverdue as boolean) ?? true,
    notifyFlaggedTimesheets: (s.notifyFlaggedTimesheets as boolean) ?? true,
    notifyJobDeadline: (s.notifyJobDeadline as boolean) ?? true,
    notifyNewUser: (s.notifyNewUser as boolean) ?? false,
    overdueInvoiceDays: (s.overdueInvoiceDays as number) ?? 7,
    defaultHourlyRate: (s.defaultHourlyRate as number | null) ?? null,
    billingIncrement: (s.billingIncrement as number) ?? 15,
    defaultTaxRate: (s.defaultTaxRate as number) ?? 10,
    invoicePrefix: (s.invoicePrefix as string) || 'INV',
    invoicePaymentTermsDays: (s.invoicePaymentTermsDays as number) ?? 30,
    dailyHoursThreshold: (s.dailyHoursThreshold as number) ?? 8,
    flagUnderHours: (s.flagUnderHours as boolean) ?? true,
    flagOverHours: (s.flagOverHours as boolean) ?? true,
    flagJobOvertime: (s.flagJobOvertime as boolean) ?? true,
    hourlyCostRatio: (s.hourlyCostRatio as number) ?? 0.70,
    requireClientForJob: (s.requireClientForJob as boolean) ?? false,
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useSettings() {
  const [data, setData] = useState<OrgSettings>(DEFAULTS)
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<SettingsSection | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    if (!getToken()) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const [settingsRes, typesRes] = await Promise.all([
        api.get<ApiResponse<SettingsApiResponse>>('/settings'),
        api.get<ApiResponse<TaskType[]>>('/settings/task-types'),
      ])
      if (settingsRes.success && settingsRes.data) {
        setData(mergeApiResponse(settingsRes.data))
      }
      if (typesRes.success && typesRes.data) {
        setTaskTypes(typesRes.data)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Per-section save ───────────────────────────────────────────────────────
  const save = useCallback(async (section: SettingsSection, payload: Partial<OrgSettings>): Promise<boolean> => {
    setSaving(section)
    try {
      const res = await api.put<ApiResponse<SettingsApiResponse | Record<string, unknown>>>(`/settings/${section}`, payload)
      if (res.success && res.data) {
        // For profile, the response wraps { org, settings }
        if ('org' in res.data && 'settings' in res.data) {
          setData(mergeApiResponse(res.data as SettingsApiResponse))
        } else {
          // For other sections (localisation, notifications, billing, workflow) response is the flat settings object
          setData(prev => ({ ...prev, ...res.data as Partial<OrgSettings> }))
        }
      }
      return !!res.success
    } catch {
      return false
    } finally {
      setSaving(null)
    }
  }, [])

  // ── Task type CRUD ─────────────────────────────────────────────────────────
  const createTaskType = useCallback(async (payload: { name: string; color: string; billableByDefault: boolean }): Promise<boolean> => {
    try {
      const res = await api.post<ApiResponse<TaskType>>('/settings/task-types', payload)
      if (res.success && res.data) {
        setTaskTypes(prev => [...prev, res.data!].sort((a, b) => a.displayOrder - b.displayOrder))
        return true
      }
      return false
    } catch { return false }
  }, [])

  const updateTaskType = useCallback(async (id: string, payload: Partial<TaskType>): Promise<boolean> => {
    try {
      const res = await api.put<ApiResponse<TaskType>>(`/settings/task-types/${id}`, payload)
      if (res.success && res.data) {
        setTaskTypes(prev => prev.map(t => t.id === id ? { ...t, ...res.data! } : t))
        return true
      }
      return false
    } catch { return false }
  }, [])

  const deleteTaskType = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await api.delete<ApiResponse<TaskType>>(`/settings/task-types/${id}`)
      if (res.success) {
        setTaskTypes(prev => prev.map(t => t.id === id ? { ...t, isActive: false } : t))
        return true
      }
      return false
    } catch { return false }
  }, [])

  const reorderTaskTypes = useCallback(async (order: { id: string; displayOrder: number }[]): Promise<boolean> => {
    // Optimistic update
    setTaskTypes(prev => {
      const updated = prev.map(t => {
        const match = order.find(o => o.id === t.id)
        return match ? { ...t, displayOrder: match.displayOrder } : t
      })
      return updated.sort((a, b) => a.displayOrder - b.displayOrder)
    })
    try {
      const res = await api.patch<ApiResponse<TaskType[]>>('/settings/task-types/reorder', { order })
      if (res.success && res.data) { setTaskTypes(res.data); return true }
      return false
    } catch { return false }
  }, [])

  return {
    data,
    taskTypes,
    loading,
    saving,
    error,
    save,
    refetch: fetchAll,
    createTaskType,
    updateTaskType,
    deleteTaskType,
    reorderTaskTypes,
  }
}
