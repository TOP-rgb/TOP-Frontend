import { useState, useRef, useEffect, useCallback } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import type { DateSelectArg, EventClickArg, EventDropArg, EventInput } from '@fullcalendar/core'
import { toast } from 'sonner'
import {
  ChevronLeft, ChevronRight, Plus, RefreshCw, Calendar as CalendarIcon,
  X, MapPin, AlignLeft, Users, Check, Chrome, Trash2,
  UserPlus, Mail, Clock, Search, Video, Edit2, ExternalLink, User,
} from 'lucide-react'
import {
  useCalendar,
  type CalendarEventData,
  type CreateEventPayload,
  type ExternalAttendee,
  type AvailabilityResult,
  EVENT_COLORS,
} from '@/hooks/useCalendar'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'

// ── Helpers ───────────────────────────────────────────────────────────────────

function viewLabel(view: string) {
  return { dayGridMonth: 'Month', timeGridWeek: 'Week', timeGridDay: 'Day', listWeek: 'List' }[view] ?? view
}

function toFullCalendarEvents(events: CalendarEventData[]): EventInput[] {
  return events.map((evt) => {
    const colors = EVENT_COLORS[evt.eventType] ?? EVENT_COLORS.other
    return {
      id: evt.id,
      title: evt.title,
      start: evt.startAt,
      end: evt.endAt,
      allDay: evt.allDay,
      backgroundColor: colors.border,
      borderColor: colors.border,
      textColor: '#fff',
      extendedProps: { ...evt },
    }
  })
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

function isBusy(slot: { start: string; end: string }, busy: { start: string; end: string }[]): boolean {
  const slotStart = new Date(slot.start).getTime()
  const slotEnd = new Date(slot.end).getTime()
  return busy.some((b) => {
    const bs = new Date(b.start).getTime()
    const be = new Date(b.end).getTime()
    return bs < slotEnd && be > slotStart
  })
}

// ── Legend Dot ────────────────────────────────────────────────────────────────

function LegendDot({ type, label }: { type: string; label: string }) {
  const colors = EVENT_COLORS[type] ?? EVENT_COLORS.other
  return (
    <span className="flex items-center gap-1.5 text-xs text-slate-600">
      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors.border }} />
      {label}
    </span>
  )
}

// ── OrgUser type (local) ───────────────────────────────────────────────────────

interface OrgUser {
  id: string
  firstName: string
  lastName: string
  email: string
  role: string
}

// ── Availability Grid ─────────────────────────────────────────────────────────

function AvailabilityGrid({
  attendeeIds,
  orgUsers,
  startAt,
  endAt,
  availability,
  loadingAvail,
}: {
  attendeeIds: string[]
  orgUsers: OrgUser[]
  startAt: string
  endAt: string
  availability: AvailabilityResult[]
  loadingAvail: boolean
}) {
  if (!attendeeIds.length) return null

  // Build 30-min slots between startAt and endAt
  const start = new Date(startAt)
  const end = new Date(endAt)
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return null

  const slots: { start: Date; end: Date }[] = []
  const cur = new Date(start)
  while (cur < end) {
    const next = new Date(cur.getTime() + 30 * 60_000)
    if (next > end) break
    slots.push({ start: new Date(cur), end: next })
    cur.setTime(next.getTime())
  }

  if (!slots.length) return null

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-600 flex items-center gap-1">
          <Clock className="w-3 h-3" /> Availability
        </span>
        {loadingAvail && (
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <div className="w-3 h-3 border border-slate-300 border-t-transparent rounded-full animate-spin" />
            Checking…
          </span>
        )}
      </div>

      <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
        {/* Header row — time slots */}
        <div className="flex bg-slate-50 border-b border-slate-200">
          <div className="w-28 shrink-0 px-2 py-1.5 font-medium text-slate-500">Attendee</div>
          {slots.map((s, i) => (
            <div
              key={i}
              className="flex-1 text-center py-1.5 border-l border-slate-200 text-slate-400 truncate px-0.5"
              style={{ minWidth: 0 }}
            >
              {i % 2 === 0 ? formatTime(s.start.toISOString()) : ''}
            </div>
          ))}
        </div>

        {/* Per-attendee rows */}
        {attendeeIds.map((uid) => {
          const user = orgUsers.find((u) => u.id === uid)
          const avail = availability.find((a) => a.userId === uid)
          const name = user ? `${user.firstName} ${user.lastName.charAt(0)}.` : uid.slice(0, 8)

          return (
            <div key={uid} className="flex border-b border-slate-100 last:border-0">
              <div
                className="w-28 shrink-0 px-2 py-1.5 font-medium text-slate-700 truncate"
                title={user ? `${user.firstName} ${user.lastName}` : uid}
              >
                {name}
              </div>
              {slots.map((s, i) => {
                const slotStr = { start: s.start.toISOString(), end: s.end.toISOString() }
                let bg = 'bg-green-100'
                let title = 'Free'
                if (!avail || avail.unknown) {
                  bg = 'bg-slate-100'
                  title = 'Unknown'
                } else if (isBusy(slotStr, avail.busy)) {
                  bg = 'bg-red-200'
                  title = 'Busy'
                }
                return (
                  <div
                    key={i}
                    className={`flex-1 border-l border-white py-1.5 ${bg}`}
                    title={title}
                    style={{ minWidth: 0 }}
                  />
                )
              })}
            </div>
          )
        })}

        {/* Legend */}
        <div className="flex items-center gap-3 px-2 py-1.5 bg-slate-50 border-t border-slate-200">
          <span className="flex items-center gap-1 text-slate-500">
            <span className="w-3 h-3 rounded-sm bg-green-100 border border-slate-200" /> Free
          </span>
          <span className="flex items-center gap-1 text-slate-500">
            <span className="w-3 h-3 rounded-sm bg-red-200 border border-slate-200" /> Busy
          </span>
          <span className="flex items-center gap-1 text-slate-500">
            <span className="w-3 h-3 rounded-sm bg-slate-100 border border-slate-200" /> Unknown
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Event Create / Edit Modal ─────────────────────────────────────────────────

interface EventModalProps {
  initial?: Partial<CreateEventPayload>
  existingId?: string
  integrations: ReturnType<typeof useCalendar>['integrations']
  onClose: () => void
  onSave: (data: CreateEventPayload) => Promise<void>
  onDelete?: () => Promise<void>
  getAvailability: (userIds: string[], start: Date, end: Date) => Promise<AvailabilityResult[]>
}

function EventModal({
  initial,
  existingId,
  integrations,
  onClose,
  onSave,
  onDelete,
  getAvailability,
}: EventModalProps) {
  const [form, setForm] = useState<CreateEventPayload>({
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    startAt: initial?.startAt ?? new Date().toISOString().slice(0, 16),
    endAt: initial?.endAt ?? new Date(Date.now() + 3600_000).toISOString().slice(0, 16),
    allDay: initial?.allDay ?? false,
    location: initial?.location ?? '',
    eventType: initial?.eventType ?? 'meeting',
    attendeeIds: initial?.attendeeIds ?? [],
    externalAttendees: initial?.externalAttendees ?? [],
  })

  // Org users
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([])
  const [userSearch, setUserSearch] = useState('')
  const [showUserDropdown, setShowUserDropdown] = useState(false)

  // External attendee form
  const [extName, setExtName] = useState('')
  const [extEmail, setExtEmail] = useState('')

  // Availability
  const [availability, setAvailability] = useState<AvailabilityResult[]>([])
  const [loadingAvail, setLoadingAvail] = useState(false)
  const availTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Load org users
  useEffect(() => {
    api.get<{ success: boolean; data?: OrgUser[] }>('/users?limit=200')
      .then((res) => { if (res.success) setOrgUsers(res.data ?? []) })
      .catch(() => {})
  }, [])

  // Fetch availability when attendeeIds or times change
  useEffect(() => {
    if (!form.attendeeIds?.length) { setAvailability([]); return }
    if (availTimerRef.current) clearTimeout(availTimerRef.current)
    availTimerRef.current = setTimeout(async () => {
      const start = new Date(form.startAt)
      const end = new Date(form.endAt)
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return
      setLoadingAvail(true)
      const res = await getAvailability(form.attendeeIds ?? [], start, end)
      setAvailability(res)
      setLoadingAvail(false)
    }, 600)
    return () => { if (availTimerRef.current) clearTimeout(availTimerRef.current) }
  }, [form.attendeeIds, form.startAt, form.endAt, getAvailability])

  const filteredUsers = orgUsers.filter((u) => {
    const q = userSearch.toLowerCase()
    const fullName = `${u.firstName} ${u.lastName}`.toLowerCase()
    return (
      !form.attendeeIds?.includes(u.id) &&
      (fullName.includes(q) || u.email.toLowerCase().includes(q))
    )
  })

  const addAttendee = (userId: string) => {
    setForm((f) => ({ ...f, attendeeIds: [...(f.attendeeIds ?? []), userId] }))
    setUserSearch('')
    setShowUserDropdown(false)
  }

  const removeAttendee = (userId: string) => {
    setForm((f) => ({ ...f, attendeeIds: (f.attendeeIds ?? []).filter((id) => id !== userId) }))
  }

  const addExternalAttendee = () => {
    if (!extEmail.trim() || !extEmail.includes('@')) { toast.error('Valid email required'); return }

    // If the typed email matches an org member, add them as an internal attendee instead
    const emailLower = extEmail.trim().toLowerCase()
    const matchedOrgUser = orgUsers.find((u) => u.email.toLowerCase() === emailLower)
    if (matchedOrgUser) {
      if (!(form.attendeeIds ?? []).includes(matchedOrgUser.id)) {
        setForm((f) => ({ ...f, attendeeIds: [...(f.attendeeIds ?? []), matchedOrgUser.id] }))
        toast.success(`${matchedOrgUser.firstName} ${matchedOrgUser.lastName} added as a team member`)
      } else {
        toast.info(`${matchedOrgUser.firstName} ${matchedOrgUser.lastName} is already added`)
      }
      setExtName('')
      setExtEmail('')
      return
    }

    const ext: ExternalAttendee = { name: extName.trim() || extEmail, email: extEmail.trim() }
    setForm((f) => ({ ...f, externalAttendees: [...(f.externalAttendees ?? []), ext] }))
    setExtName('')
    setExtEmail('')
  }

  const removeExternalAttendee = (email: string) => {
    setForm((f) => ({ ...f, externalAttendees: (f.externalAttendees ?? []).filter((a) => a.email !== email) }))
  }

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return }
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!onDelete) return
    setDeleting(true)
    await onDelete()
    setDeleting(false)
  }

  // Calendar sync indicator
  const googleConnected = integrations.some((i) => i.service === 'google_calendar' && i.syncEnabled)
  const msConnected = integrations.some((i) => i.service === 'microsoft_calendar' && i.syncEnabled)
  const syncBadges: string[] = []
  if (googleConnected) syncBadges.push('Google Calendar')
  if (msConnected) syncBadges.push('Outlook')

  const totalAttendees = (form.attendeeIds?.length ?? 0) + (form.externalAttendees?.length ?? 0)

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h3 className="font-semibold text-slate-900">
            {existingId ? 'Edit Event' : 'New Event'}
          </h3>
          <div className="flex items-center gap-3">
            {syncBadges.length > 0 && (
              <span className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-full px-2.5 py-0.5">
                Syncs to {syncBadges.join(' & ')}
              </span>
            )}
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Title *</label>
            <input
              autoFocus
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Event title"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Event type */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Type</label>
            <div className="flex gap-2 flex-wrap">
              {(['meeting', 'deadline', 'task', 'other'] as const).map((t) => {
                const colors = EVENT_COLORS[t]
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, eventType: t }))}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                      form.eventType === t
                        ? 'text-white'
                        : 'text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                    style={form.eventType === t ? { backgroundColor: colors.border, borderColor: colors.border } : {}}
                  >
                    {form.eventType === t && <Check className="w-3 h-3" />}
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Dates */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                id="allDay"
                checked={form.allDay}
                onChange={(e) => setForm((f) => ({ ...f, allDay: e.target.checked }))}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <label htmlFor="allDay" className="text-sm text-slate-700">All day</label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Start</label>
                <input
                  type={form.allDay ? 'date' : 'datetime-local'}
                  value={form.allDay ? form.startAt.slice(0, 10) : form.startAt.slice(0, 16)}
                  onChange={(e) => setForm((f) => ({ ...f, startAt: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">End</label>
                <input
                  type={form.allDay ? 'date' : 'datetime-local'}
                  value={form.allDay ? form.endAt.slice(0, 10) : form.endAt.slice(0, 16)}
                  onChange={(e) => setForm((f) => ({ ...f, endAt: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> Location</span>
            </label>
            <input
              value={form.location ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              placeholder="Add location (optional)"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              <span className="flex items-center gap-1"><AlignLeft className="w-3 h-3" /> Description</span>
            </label>
            <textarea
              value={form.description ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Add notes (optional)"
              rows={2}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* ── Attendees ── */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" /> Attendees
                {totalAttendees > 0 && (
                  <span className="ml-1 bg-blue-100 text-blue-700 rounded-full text-xs px-1.5 py-0.5 font-medium">
                    {totalAttendees}
                  </span>
                )}
              </span>
            </label>

            {/* Org user search */}
            <div className="relative mb-2">
              <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500">
                <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <input
                  value={userSearch}
                  onChange={(e) => { setUserSearch(e.target.value); setShowUserDropdown(true) }}
                  onFocus={() => setShowUserDropdown(true)}
                  placeholder="Search team members…"
                  className="flex-1 text-sm outline-none bg-transparent"
                />
              </div>
              {showUserDropdown && userSearch && filteredUsers.length > 0 && (
                <div className="absolute z-10 top-full mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-44 overflow-y-auto">
                  {filteredUsers.slice(0, 8).map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => addAttendee(u.id)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-slate-50"
                    >
                      <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold shrink-0">
                        {u.firstName.charAt(0)}{u.lastName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-800 truncate">{u.firstName} {u.lastName}</div>
                        <div className="text-xs text-slate-400 truncate">{u.email}</div>
                      </div>
                      <span className="text-xs text-slate-400 shrink-0">{u.role}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected org attendees chips */}
            {(form.attendeeIds?.length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {form.attendeeIds?.map((uid) => {
                  const u = orgUsers.find((x) => x.id === uid)
                  const label = u ? `${u.firstName} ${u.lastName}` : uid.slice(0, 8)
                  return (
                    <span
                      key={uid}
                      className="flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs px-2.5 py-1"
                    >
                      <span className="font-medium">{label}</span>
                      <button
                        type="button"
                        onClick={() => removeAttendee(uid)}
                        className="text-blue-400 hover:text-blue-600 ml-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )
                })}
              </div>
            )}

            {/* External attendees */}
            <div className="border border-slate-200 rounded-lg p-3 space-y-2 bg-slate-50">
              <p className="text-xs font-medium text-slate-500 flex items-center gap-1">
                <Mail className="w-3 h-3" /> Add external attendee
                <span className="text-slate-400 font-normal">(outside your org — team members use the search above)</span>
              </p>
              <div className="flex gap-2">
                <input
                  value={extName}
                  onChange={(e) => setExtName(e.target.value)}
                  placeholder="Name (optional)"
                  className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
                <input
                  value={extEmail}
                  onChange={(e) => setExtEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addExternalAttendee() } }}
                  placeholder="email@example.com *"
                  className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
                <button
                  type="button"
                  onClick={addExternalAttendee}
                  className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <UserPlus className="w-3 h-3" /> Add
                </button>
              </div>
              {(form.externalAttendees?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {form.externalAttendees?.map((a) => (
                    <span
                      key={a.email}
                      className="flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-full text-xs px-2.5 py-1"
                    >
                      <Mail className="w-2.5 h-2.5" />
                      <span>{a.name !== a.email ? `${a.name} <${a.email}>` : a.email}</span>
                      <button
                        type="button"
                        onClick={() => removeExternalAttendee(a.email)}
                        className="text-purple-400 hover:text-purple-600 ml-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Availability grid ── */}
          {(form.attendeeIds?.length ?? 0) > 0 && !form.allDay && (
            <AvailabilityGrid
              attendeeIds={form.attendeeIds ?? []}
              orgUsers={orgUsers}
              startAt={form.startAt}
              endAt={form.endAt}
              availability={availability}
              loadingAvail={loadingAvail}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 shrink-0">
          <div>
            {existingId && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 px-3 py-2 rounded-lg hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" /> {deleting ? 'Deleting…' : 'Delete'}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!form.title.trim() || saving}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : existingId ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Event Detail Modal (view mode — shown on click before edit) ───────────────

function EventDetailModal({
  event,
  currentUserId,
  onClose,
  onEdit,
  onDelete,
}: {
  event: CalendarEventData
  currentUserId: string
  onClose: () => void
  onEdit: () => void
  onDelete: () => Promise<void>
}) {
  const [deleting, setDeleting] = useState(false)
  const colors = EVENT_COLORS[event.eventType] ?? EVENT_COLORS.other
  const isOwner = event.createdById === currentUserId
  const isExternal = event.eventType === 'external'

  const fmt = (iso: string) => {
    try {
      return new Date(iso).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    } catch { return iso }
  }
  const fmtDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) }
    catch { return iso }
  }

  const handleDelete = async () => {
    if (!confirm('Delete this event?')) return
    setDeleting(true)
    await onDelete()
    setDeleting(false)
  }

  const allAttendees: { name: string; email?: string; isOrg?: boolean }[] = [
    ...(event.externalAttendees ?? []).map((a) => ({ name: a.name || a.email, email: a.email })),
  ]

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Colour bar + header */}
        <div style={{ background: colors.border }} className="px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-white font-semibold text-lg leading-snug">{event.title}</div>
              {isExternal && (
                <span className="inline-block mt-1 text-xs bg-white/20 text-white rounded-full px-2 py-0.5">
                  External
                </span>
              )}
            </div>
            <button onClick={onClose} className="text-white/80 hover:text-white shrink-0 mt-0.5">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3 overflow-y-auto max-h-[60vh]">

          {/* Time */}
          <div className="flex items-start gap-3">
            <Clock className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <div className="text-sm text-slate-700">
              {event.allDay
                ? fmtDate(event.startAt)
                : <>{fmt(event.startAt)}<span className="text-slate-400 mx-1">→</span>{fmt(event.endAt)}</>
              }
            </div>
          </div>

          {/* Organized by */}
          {(() => {
            if (isExternal) {
              // External events: find the real organizer stored in externalAttendees
              const organizer = event.externalAttendees?.find((a) => a.isOrganizer)
              if (!organizer) return null
              return (
                <div className="flex items-start gap-3">
                  <User className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div className="text-sm text-slate-700">
                    <span className="text-slate-400 text-xs">Organized by </span>
                    <span className="font-medium">{organizer.name || organizer.email}</span>
                  </div>
                </div>
              )
            }
            // Org-created events: show the DB creator
            if (!event.createdBy) return null
            return (
              <div className="flex items-start gap-3">
                <User className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div className="text-sm text-slate-700">
                  <span className="text-slate-400 text-xs">Organized by </span>
                  <span className="font-medium">
                    {event.createdBy.firstName} {event.createdBy.lastName}
                  </span>
                  {isOwner && (
                    <span className="ml-1.5 text-xs text-blue-500 font-normal">(you)</span>
                  )}
                </div>
              </div>
            )
          })()}

          {/* Location */}
          {event.location && (
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <div className="text-sm text-slate-700">{event.location}</div>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div className="flex items-start gap-3">
              <AlignLeft className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <div className="text-sm text-slate-600 whitespace-pre-wrap">{event.description}</div>
            </div>
          )}

          {/* Attendees */}
          {allAttendees.length > 0 && (
            <div className="flex items-start gap-3">
              <Users className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <div className="flex-1">
                <div className="text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                  Attendees ({allAttendees.length})
                </div>
                <div className="space-y-1.5">
                  {allAttendees.map((a, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-500 shrink-0">
                        {(a.name || a.email || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-700 leading-none">{a.name}</div>
                        {a.email && a.email !== a.name && (
                          <div className="text-xs text-slate-400">{a.email}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 py-4 border-t border-slate-100 flex items-center gap-2 flex-wrap">
          {/* Join meeting button */}
          {event.meetingUrl && (
            <a
              href={event.meetingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background: colors.border }}
            >
              <Video className="w-4 h-4" />
              Join Meeting
              <ExternalLink className="w-3 h-3 opacity-70" />
            </a>
          )}

          {/* Edit button — only owner can edit */}
          {isOwner && (
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
          )}

          {/* Delete button — only owner */}
          {isOwner && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border border-red-200 text-red-500 hover:bg-red-50 ml-auto disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Integration Strip ─────────────────────────────────────────────────────────

function IntegrationStrip({
  integrations, syncing, onConnectGoogle, onConnectMicrosoft, onDisconnect, onSync,
  allowGoogle, allowMicrosoft,
}: {
  integrations: ReturnType<typeof useCalendar>['integrations']
  syncing: boolean
  onConnectGoogle: () => void
  onConnectMicrosoft: () => void
  onDisconnect: (service: string) => void
  onSync: () => void
  allowGoogle: boolean
  allowMicrosoft: boolean
}) {
  const googleInt = integrations.find((i) => i.service === 'google_calendar')
  const msInt = integrations.find((i) => i.service === 'microsoft_calendar')

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Google Calendar */}
      {allowGoogle && (
        googleInt ? (
          <div className="flex items-center gap-2 text-xs bg-green-50 border border-green-200 text-green-700 rounded-full px-3 py-1">
            <Chrome className="w-3.5 h-3.5" />
            <span>Google Calendar connected</span>
            {googleInt.lastSyncAt && (
              <span className="text-green-500">· Synced {new Date(googleInt.lastSyncAt).toLocaleDateString()}</span>
            )}
            <button
              onClick={() => onDisconnect('google_calendar')}
              className="text-green-400 hover:text-green-600"
              title="Disconnect"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={onConnectGoogle}
            className="flex items-center gap-1.5 text-xs border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-full px-3 py-1"
          >
            <Chrome className="w-3.5 h-3.5" /> Connect Google Calendar
          </button>
        )
      )}

      {/* Microsoft Calendar */}
      {allowMicrosoft && (
        msInt ? (
          <div className="flex items-center gap-2 text-xs bg-blue-50 border border-blue-200 text-blue-700 rounded-full px-3 py-1">
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>Outlook connected</span>
            {msInt.lastSyncAt && (
              <span className="text-blue-500">· Synced {new Date(msInt.lastSyncAt).toLocaleDateString()}</span>
            )}
            <button
              onClick={() => onDisconnect('microsoft_calendar')}
              className="text-blue-400 hover:text-blue-600"
              title="Disconnect"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={onConnectMicrosoft}
            className="flex items-center gap-1.5 text-xs border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-full px-3 py-1"
          >
            <CalendarIcon className="w-3.5 h-3.5" /> Connect Outlook
          </button>
        )
      )}

      {/* Sync button (only if any integration is connected) */}
      {(googleInt || msInt) && (
        <button
          onClick={onSync}
          disabled={syncing}
          className="flex items-center gap-1.5 text-xs border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-full px-3 py-1 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing…' : 'Sync Now'}
        </button>
      )}
    </div>
  )
}

// ── Main Calendar Page ────────────────────────────────────────────────────────

export function Calendar() {
  const calRef = useRef<InstanceType<typeof FullCalendar>>(null)
  const [currentView, setCurrentView] = useState<string>('dayGridMonth')
  const [currentTitle, setCurrentTitle] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarEventData | null>(null)
  const [detailEvent, setDetailEvent] = useState<CalendarEventData | null>(null)
  const [selectRange, setSelectRange] = useState<{ startAt: string; endAt: string } | null>(null)
  const [calendarPerms, setCalendarPerms] = useState({ allowUserGoogleCalendar: true, allowUserMicrosoftCalendar: true })
  const currentUserId = useAuthStore((s) => s.user?.id ?? '')

  const {
    events, integrations, loading, syncing,
    fetchEvents, fetchIntegrations,
    createEvent, updateEvent, deleteEvent,
    syncNow, disconnectIntegration,
    connectGoogle, connectMicrosoft,
    getAvailability,
  } = useCalendar()

  useEffect(() => {
    fetchEvents()
    fetchIntegrations()
    api.get<{ success: boolean; data: { allowUserGoogleCalendar: boolean; allowUserMicrosoftCalendar: boolean } }>('/calendar/permissions')
      .then(res => { if (res.success && res.data) setCalendarPerms({ allowUserGoogleCalendar: res.data.allowUserGoogleCalendar, allowUserMicrosoftCalendar: res.data.allowUserMicrosoftCalendar }) })
      .catch(() => {})
  }, [fetchEvents, fetchIntegrations])

  // Poll for new events every 30 s + refresh when the tab regains focus
  // This ensures attendees see meetings created by others without a manual refresh
  useEffect(() => {
    const poll = setInterval(() => fetchEvents(), 30_000)
    const onVisible = () => { if (document.visibilityState === 'visible') fetchEvents() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(poll); document.removeEventListener('visibilitychange', onVisible) }
  }, [fetchEvents])

  // Auto-sync when integrations first load and haven't been synced yet
  const [autoSyncDone, setAutoSyncDone] = useState(false)
  useEffect(() => {
    if (autoSyncDone || integrations.length === 0) return
    const needsSync = integrations.some(i => i.syncEnabled && !i.lastSyncAt)
    if (needsSync) { syncNow(); setAutoSyncDone(true) }
  }, [integrations, autoSyncDone, syncNow])

  // Update title after view changes
  const updateTitle = useCallback(() => {
    const calApi = calRef.current?.getApi()
    if (calApi) setCurrentTitle(calApi.view.title)
  }, [])

  // Handle OAuth return — sync immediately after connecting so events appear right away
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const success = params.get('success')
    const error = params.get('error')
    if (success === 'google_calendar' || success === 'microsoft_calendar') {
      toast.success(success === 'google_calendar' ? 'Google Calendar connected!' : 'Outlook Calendar connected!')
      // Clean URL first, then sync + fetch to pull in external events immediately
      window.history.replaceState({}, '', window.location.pathname)
      fetchIntegrations()
      // Sync then re-fetch events so newly-connected calendar events appear
      syncNow().then(() => fetchEvents())
      setAutoSyncDone(true) // prevent the autoSync effect from also firing
      return
    }
    if (error) toast.error('Calendar connection failed')
    if (error) {
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [fetchIntegrations, syncNow, fetchEvents])

  const navigate = (dir: 'prev' | 'next' | 'today') => {
    const calApi = calRef.current?.getApi()
    if (!calApi) return
    if (dir === 'prev') calApi.prev()
    else if (dir === 'next') calApi.next()
    else calApi.today()
    setCurrentTitle(calApi.view.title)
  }

  const switchView = (view: string) => {
    const calApi = calRef.current?.getApi()
    if (!calApi) return
    calApi.changeView(view)
    setCurrentView(view)
    setCurrentTitle(calApi.view.title)
  }

  const handleDateSelect = (arg: DateSelectArg) => {
    setSelectRange({ startAt: arg.startStr, endAt: arg.endStr })
    setEditingEvent(null)
    setModalOpen(true)
  }

  const handleNewEvent = () => {
    const now = new Date()
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000)
    
    setSelectRange({ 
      startAt: now.toISOString(), 
      endAt: oneHourLater.toISOString() 
    })
    setEditingEvent(null)
    setModalOpen(true)
  }

  const handleEventClick = (arg: EventClickArg) => {
    const evt = arg.event.extendedProps as CalendarEventData
    if (evt._derived) return // read-only derived deadline events
    setDetailEvent(evt)
  }

  const handleEventDrop = async (arg: EventDropArg) => {
    const id = arg.event.id
    const ok = await updateEvent(id, {
      startAt: arg.event.startStr,
      endAt: arg.event.endStr ?? arg.event.startStr,
    })
    if (!ok) { arg.revert(); toast.error('Failed to move event') }
  }

  const handleSave = async (data: CreateEventPayload) => {
    if (editingEvent) {
      const ok = await updateEvent(editingEvent.id, data)
      if (ok) { toast.success('Event updated'); setModalOpen(false) }
      else toast.error('Failed to update event')
    } else {
      const evt = await createEvent(data)
      if (evt) {
        toast.success('Event created')
        setModalOpen(false)
        // Re-fetch after a short delay so the meetingUrl (set by Google push) is captured
        setTimeout(() => fetchEvents(), 2000)
      } else {
        toast.error('Failed to create event')
      }
    }
  }

  const handleDelete = async () => {
    if (!editingEvent) return
    const ok = await deleteEvent(editingEvent.id)
    if (ok) { toast.success('Event deleted'); setModalOpen(false); setEditingEvent(null) }
    else toast.error('Failed to delete event')
  }

  const handleDisconnect = async (service: string) => {
    if (!confirm(`Disconnect ${service === 'google_calendar' ? 'Google Calendar' : 'Outlook'}?`)) return
    const ok = await disconnectIntegration(service)
    if (ok) toast.success('Disconnected')
    else toast.error('Failed to disconnect')
  }

  const handleSync = async () => {
    await syncNow()
    toast.success('Calendar synced')
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingEvent(null)
    setSelectRange(null)
  }

  // Called from EventDetailModal's "Edit" button — switch from view to edit mode
  const handleDetailEdit = () => {
    if (!detailEvent) return
    setEditingEvent(detailEvent)
    setDetailEvent(null)
    setSelectRange(null)
    setModalOpen(true)
  }

  // Called from EventDetailModal's "Delete" button
  const handleDetailDelete = async () => {
    if (!detailEvent) return
    const ok = await deleteEvent(detailEvent.id)
    if (ok) { toast.success('Event deleted'); setDetailEvent(null) }
    else toast.error('Failed to delete event')
  }

  const fcEvents = toFullCalendarEvents(events)

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-white">
      {/* Top bar */}
      <div className="flex flex-col gap-3 px-5 py-3 border-b border-slate-100">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Navigation */}
          <div className="flex items-center gap-1 border border-slate-200 rounded-lg overflow-hidden">
            <button
              onClick={() => navigate('prev')}
              className="p-2 hover:bg-slate-50 text-slate-600"
              title="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate('today')}
              className="px-3 py-1.5 text-sm hover:bg-slate-50 text-slate-600"
            >
              Today
            </button>
            <button
              onClick={() => navigate('next')}
              className="p-2 hover:bg-slate-50 text-slate-600"
              title="Next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Current title */}
          <span className="text-base font-semibold text-slate-900 flex-1 min-w-0">{currentTitle}</span>

          {/* View selector */}
          <div className="flex border border-slate-200 rounded-lg overflow-hidden text-sm">
            {(['dayGridMonth', 'timeGridWeek', 'timeGridDay', 'listWeek'] as const).map((v) => (
              <button
                key={v}
                onClick={() => switchView(v)}
                className={`px-3 py-1.5 ${currentView === v ? 'bg-slate-100 font-medium' : 'hover:bg-slate-50 text-slate-600'}`}
              >
                {viewLabel(v)}
              </button>
            ))}
          </div>

          {/* New event */}
          <button
            onClick={handleNewEvent}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" /> New Event
          </button>
        </div>

        {/* Legend + integrations row */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-4">
            <LegendDot type="deadline" label="Deadlines" />
            <LegendDot type="task" label="Tasks" />
            <LegendDot type="meeting" label="Meetings" />
            <LegendDot type="external" label="External" />
          </div>
          <IntegrationStrip
            integrations={integrations}
            syncing={syncing}
            onConnectGoogle={connectGoogle}
            onConnectMicrosoft={connectMicrosoft}
            onDisconnect={handleDisconnect}
            onSync={handleSync}
            allowGoogle={calendarPerms.allowUserGoogleCalendar}
            allowMicrosoft={calendarPerms.allowUserMicrosoftCalendar}
          />
        </div>
      </div>

      {/* Calendar */}
      <div className="flex-1 overflow-hidden p-4 relative">
        {loading && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        <FullCalendar
          ref={calRef}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          initialView={currentView}
          headerToolbar={false}
          events={fcEvents}
          selectable={true}
          editable={true}
          select={handleDateSelect}
          eventClick={handleEventClick}
          eventDrop={handleEventDrop}
          height="100%"
          viewDidMount={updateTitle}
          datesSet={updateTitle}
          eventTimeFormat={{ hour: 'numeric', minute: '2-digit', meridiem: 'short' }}
          dayMaxEvents={4}
          moreLinkClick="popover"
          nowIndicator={true}
          firstDay={1}
        />
      </div>

      {/* Event Detail Modal (view mode — opens on click) */}
      {detailEvent && !modalOpen && (
        <EventDetailModal
          event={detailEvent}
          currentUserId={currentUserId}
          onClose={() => setDetailEvent(null)}
          onEdit={handleDetailEdit}
          onDelete={handleDetailDelete}
        />
      )}

      {/* Event Modal (create / edit) */}
      {modalOpen && (
        <EventModal
          initial={
            editingEvent
              ? {
                  title: editingEvent.title,
                  description: editingEvent.description ?? '',
                  startAt: editingEvent.startAt.slice(0, 16),
                  endAt: editingEvent.endAt.slice(0, 16),
                  allDay: editingEvent.allDay,
                  location: editingEvent.location ?? '',
                  eventType: editingEvent.eventType,
                  attendeeIds: editingEvent.attendeeIds,
                  externalAttendees: editingEvent.externalAttendees ?? [],
                }
              : selectRange
              ? {
                  startAt: new Date(selectRange.startAt).toISOString().slice(0, 16),
                  endAt: new Date(selectRange.endAt).toISOString().slice(0, 16),
                }
              : {
                  startAt: new Date().toISOString().slice(0, 16),
                  endAt: new Date(Date.now() + 3600000).toISOString().slice(0, 16),
                }
          }
          existingId={editingEvent?.id}
          integrations={integrations}
          onClose={closeModal}
          onSave={handleSave}
          onDelete={editingEvent ? handleDelete : undefined}
          getAvailability={getAvailability}
        />
      )}
    </div>
  )
}