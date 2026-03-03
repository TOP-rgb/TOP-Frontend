import { useState, useCallback } from 'react'
import { api } from '@/lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ExternalAttendee {
  name: string
  email: string
  isOrganizer?: boolean
}

export interface CalendarEventData {
  id: string
  title: string
  description: string | null
  startAt: string
  endAt: string
  allDay: boolean
  location: string | null
  eventType: string // "meeting" | "deadline" | "task" | "external"
  jobId: string | null
  taskId: string | null
  organizationId: string
  createdById: string | null
  attendeeIds: string[]
  externalAttendees?: ExternalAttendee[] | null
  googleEventId: string | null
  microsoftEventId: string | null
  meetingUrl?: string | null
  createdAt?: string
  updatedAt?: string
  // Joined
  createdBy?: { id: string; firstName: string; lastName: string }
  job?: { id: string; jobId: string; title: string } | null
  // Derived events (not stored)
  _derived?: boolean
}

export interface CalendarIntegration {
  id: string
  service: string // "google_calendar" | "microsoft_calendar"
  syncEnabled: boolean
  lastSyncAt: string | null
  calendarId: string | null
  expiresAt: string | null
}

export interface CreateEventPayload {
  title: string
  description?: string
  startAt: string
  endAt: string
  allDay?: boolean
  location?: string
  eventType?: string
  jobId?: string
  taskId?: string
  attendeeIds?: string[]
  externalAttendees?: ExternalAttendee[]
}

export interface AvailabilitySlot {
  start: string
  end: string
}

export interface AvailabilityResult {
  userId: string
  busy: AvailabilitySlot[]
  source?: 'google' | 'microsoft'
  unknown?: boolean
}

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

// Event colour map by type
export const EVENT_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  deadline: { bg: '#fef2f2', border: '#ef4444', text: '#b91c1c' },
  task:     { bg: '#fffbeb', border: '#f59e0b', text: '#b45309' },
  meeting:  { bg: '#eff6ff', border: '#3b82f6', text: '#1d4ed8' },
  external: { bg: '#f5f3ff', border: '#8b5cf6', text: '#6d28d9' },
  other:    { bg: '#f0fdf4', border: '#22c55e', text: '#15803d' },
}

// ── Hook ──────────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL || 'https://top-backend-l2ax.onrender.com/api'
const TOKEN_KEY = 'top_jwt_token'

export function useCalendar() {
  const [events, setEvents] = useState<CalendarEventData[]>([])
  const [integrations, setIntegrations] = useState<CalendarIntegration[]>([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Fetch events ───────────────────────────────────────────────────────────

  const fetchEvents = useCallback(async (start?: Date, end?: Date) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (start) params.append('start', start.toISOString())
      if (end) params.append('end', end.toISOString())
      const res = await api.get<ApiResponse<CalendarEventData[]>>(
        `/calendar/events${params.toString() ? `?${params}` : ''}`
      )
      if (res.success) setEvents(res.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load events')
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Fetch integrations ─────────────────────────────────────────────────────

  const fetchIntegrations = useCallback(async () => {
    try {
      const res = await api.get<ApiResponse<CalendarIntegration[]>>('/calendar/integrations')
      if (res.success) setIntegrations(res.data ?? [])
    } catch { /* silent */ }
  }, [])

  // ── Create event ───────────────────────────────────────────────────────────

  const createEvent = useCallback(async (data: CreateEventPayload): Promise<CalendarEventData | null> => {
    try {
      const res = await api.post<ApiResponse<CalendarEventData>>('/calendar/events', data)
      if (res.success && res.data) {
        setEvents((prev) => [...prev, res.data!])
        return res.data
      }
      return null
    } catch { return null }
  }, [])

  // ── Update event ───────────────────────────────────────────────────────────

  const updateEvent = useCallback(async (id: string, data: Partial<CreateEventPayload>): Promise<boolean> => {
    try {
      const res = await api.put<ApiResponse<CalendarEventData>>(`/calendar/events/${id}`, data)
      if (res.success && res.data) {
        setEvents((prev) => prev.map((e) => e.id === id ? res.data! : e))
        return true
      }
      return false
    } catch { return false }
  }, [])

  // ── Delete event ───────────────────────────────────────────────────────────

  const deleteEvent = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await api.delete<ApiResponse<null>>(`/calendar/events/${id}`)
      if (res.success) {
        setEvents((prev) => prev.filter((e) => e.id !== id))
        return true
      }
      return false
    } catch { return false }
  }, [])

  // ── Sync ───────────────────────────────────────────────────────────────────

  const syncNow = useCallback(async () => {
    setSyncing(true)
    try {
      await api.post('/calendar/sync', {})
      await fetchEvents()
      await fetchIntegrations()
    } catch { /* silent */ } finally {
      setSyncing(false)
    }
  }, [fetchEvents, fetchIntegrations])

  // ── Disconnect integration ─────────────────────────────────────────────────

  const disconnectIntegration = useCallback(async (service: string): Promise<boolean> => {
    try {
      const res = await api.delete<ApiResponse<null>>(`/calendar/integrations/${service}`)
      if (res.success) {
        setIntegrations((prev) => prev.filter((i) => i.service !== service))
        return true
      }
      return false
    } catch { return false }
  }, [])

  // ── Availability (freebusy) ────────────────────────────────────────────────

  const getAvailability = useCallback(async (
    userIds: string[],
    start: Date,
    end: Date
  ): Promise<AvailabilityResult[]> => {
    if (!userIds.length) return []
    try {
      const params = new URLSearchParams()
      params.append('userIds', userIds.join(','))
      params.append('start', start.toISOString())
      params.append('end', end.toISOString())
      const res = await api.get<ApiResponse<AvailabilityResult[]>>(
        `/calendar/availability?${params}`
      )
      return res.success ? (res.data ?? []) : []
    } catch { return [] }
  }, [])

  // ── OAuth redirects ────────────────────────────────────────────────────────

  const connectGoogle = useCallback(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    window.location.href = `${API_BASE}/calendar/oauth/google?token=${token}`
  }, [])

  const connectMicrosoft = useCallback(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    window.location.href = `${API_BASE}/calendar/oauth/microsoft?token=${token}`
  }, [])

  return {
    events,
    integrations,
    loading,
    syncing,
    error,
    fetchEvents,
    fetchIntegrations,
    createEvent,
    updateEvent,
    deleteEvent,
    syncNow,
    disconnectIntegration,
    getAvailability,
    connectGoogle,
    connectMicrosoft,
  }
}
