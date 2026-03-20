import { useState, useEffect, useRef, type ComponentType } from 'react'
import { Plus, Edit2, Trash2, X, Upload, MapPin, Loader2, RotateCcw, ChevronDown, Check, Building2, Home, Plane, PowerOff } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { useShifts } from '@/hooks/useShifts'
import { useGeofences } from '@/hooks/useGeofences'
import { useHolidays } from '@/hooks/useHolidays'
import { useLeaves } from '@/hooks/useLeaves'
import { useUsers } from '@/hooks/useUsers'
import { useWorkPolicies } from '@/hooks/useWorkPolicies'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import type { ShiftTemplate, ShiftAssignment, GeofenceLocation, PublicHoliday, LeaveType, EmployeeType, WorkMode } from '@/types'

const EMPLOYEE_TYPE_OPTIONS: { value: EmployeeType; label: string }[] = [
  { value: 'PERMANENT', label: 'Permanent' },
  { value: 'PROBATION', label: 'Probation' },
  { value: 'INTERN',    label: 'Intern' },
  { value: 'CONTRACT',  label: 'Contract' },
]

// ── Day helpers ───────────────────────────────────────────────────────────────
const DAY_LABELS = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAYS_OPTIONS = [1, 2, 3, 4, 5, 6, 7]

function fmtDays(days: number[]): string {
  return days.map(d => DAY_LABELS[d]).join(', ')
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Tab types ─────────────────────────────────────────────────────────────────
type Tab = 'shifts' | 'assignments' | 'geofences' | 'holidays' | 'leave-types' | 'work-modes' | 'comp-off' | 'attendance-rules'

// Countries supported by Nager.Date (free, no key required)
const NAGER_COUNTRY_CODES = [
  { code: 'AU', label: 'Australia' },
  { code: 'US', label: 'United States' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'NZ', label: 'New Zealand' },
  { code: 'CA', label: 'Canada' },
  { code: 'SG', label: 'Singapore' },
  { code: 'IE', label: 'Ireland' },
  { code: 'DE', label: 'Germany' },
  { code: 'FR', label: 'France' },
]
// All countries (for Calendarific — includes India and 230+ others)
const ALL_COUNTRY_CODES = [
  ...NAGER_COUNTRY_CODES,
  { code: 'IN', label: 'India 🔑' },   // requires Calendarific API key
]
// Country code → display name (used in the holidays table Source column)
const COUNTRY_LABEL: Record<string, string> = {
  AU: 'Australia', IN: 'India', US: 'United States', GB: 'United Kingdom',
  NZ: 'New Zealand', CA: 'Canada', SG: 'Singapore', IE: 'Ireland', DE: 'Germany', FR: 'France',
}

// For the "Add Holiday" country tag (manual entry — no API needed)
const COUNTRY_CODES = [
  { code: 'AU', label: 'Australia' },
  { code: 'IN', label: 'India' },
  { code: 'US', label: 'United States' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'NZ', label: 'New Zealand' },
  { code: 'CA', label: 'Canada' },
  { code: 'SG', label: 'Singapore' },
  { code: 'IE', label: 'Ireland' },
  { code: 'DE', label: 'Germany' },
  { code: 'FR', label: 'France' },
]

// ── Main ──────────────────────────────────────────────────────────────────────

export function AttendanceConfig() {
  const [activeTab, setActiveTab] = useState<Tab>('shifts')

  const shifts      = useShifts()
  const geofences   = useGeofences()
  const holidays    = useHolidays(undefined, true)   // all=true → admin/manager sees all countries
  const leaves      = useLeaves()
  const usersHook   = useUsers({ status: 'active' })
  const { users }   = usersHook
  const workPolicies = useWorkPolicies()

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Attendance Configuration</h1>
        <p className="text-sm text-slate-500 mt-0.5">Configure shifts, geofences, holidays, and leave policies</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700 overflow-x-auto hide-scrollbar">
        {(
          [
            { id: 'shifts',      label: 'Shifts' },
            { id: 'assignments', label: 'Shift Assignments' },
            { id: 'geofences',   label: 'Geofences' },
            { id: 'holidays',    label: 'Holidays' },
            { id: 'leave-types', label: 'Leave Types' },
            { id: 'work-modes',  label: 'Work Modes' },
            { id: 'comp-off',         label: 'Comp Off' },
            { id: 'attendance-rules', label: 'Attendance Rules' },
          ] as const
        ).map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              activeTab === t.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'shifts'      && <ShiftsTab shifts={shifts} />}
      {activeTab === 'assignments' && <AssignmentsTab shifts={shifts} users={users} />}
      {activeTab === 'geofences'   && <GeofencesTab geofences={geofences} />}
      {activeTab === 'holidays'    && <HolidaysTab holidays={holidays} />}
      {activeTab === 'leave-types' && <LeaveTypesTab leaves={leaves} users={users} usersHook={usersHook} />}
      {activeTab === 'work-modes'  && <WorkModesTab users={users} workPolicies={workPolicies} />}
      {activeTab === 'comp-off'         && <CompOffTab leaves={leaves} />}
      {activeTab === 'attendance-rules' && <AttendanceRulesTab />}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Shifts Tab
// ─────────────────────────────────────────────────────────────────────────────

function ShiftsTab({ shifts }: { shifts: ReturnType<typeof useShifts> }) {
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; shift?: ShiftTemplate } | null>(null)
  const [form, setForm] = useState({ name: '', startTime: '', endTime: '', gracePeriodMinutes: 15, workingDays: [1,2,3,4,5] as number[] })

  const openCreate = () => { setForm({ name: '', startTime: '09:00', endTime: '17:30', gracePeriodMinutes: 15, workingDays: [1,2,3,4,5] }); setModal({ mode: 'create' }) }
  const openEdit   = (s: ShiftTemplate) => { setForm({ name: s.name, startTime: s.startTime, endTime: s.endTime, gracePeriodMinutes: s.gracePeriodMinutes, workingDays: [...s.workingDays] }); setModal({ mode: 'edit', shift: s }) }

  const toggleDay = (d: number) => setForm(f => ({
    ...f,
    workingDays: f.workingDays.includes(d) ? f.workingDays.filter(x => x !== d) : [...f.workingDays, d].sort(),
  }))

  const handleSave = async () => {
    try {
      if (modal?.mode === 'create') {
        await shifts.createShift(form)
        toast.success('Shift created')
      } else if (modal?.shift) {
        await shifts.updateShift(modal.shift.id, form)
        toast.success('Shift updated')
      }
      setModal(null)
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed') }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-medium text-slate-800 dark:text-slate-200">Shift Templates</h2>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">
          <Plus size={13} /> Add Shift
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              {['Name','Start','End','Grace (min)','Working Days','Status','Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shifts.shifts.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No shifts yet</td></tr>
            )}
            {shifts.shifts.map(s => (
              <tr key={s.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3">{s.startTime}</td>
                <td className="px-4 py-3">{s.endTime}</td>
                <td className="px-4 py-3">{s.gracePeriodMinutes}</td>
                <td className="px-4 py-3 text-slate-500">{fmtDays(s.workingDays)}</td>
                <td className="px-4 py-3">
                  <Badge variant={s.isActive ? 'success' : 'secondary'}>{s.isActive ? 'Active' : 'Inactive'}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(s)} className="text-slate-400 hover:text-blue-600"><Edit2 size={14} /></button>
                    <button onClick={async () => { if (confirm('Deactivate this shift?')) { await shifts.deleteShift(s.id); toast.success('Deactivated') } }}
                      className="text-slate-400 hover:text-red-600"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.mode === 'create' ? 'Create Shift' : 'Edit Shift'}>
        <div className="space-y-4">
          <div>
            <label className={DK_LABEL}>Shift Name</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Morning Shift"
              className={DK_INPUT} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={DK_LABEL}>Start Time</label>
              <input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                className={DK_INPUT} style={{ colorScheme: 'dark' }} />
            </div>
            <div>
              <label className={DK_LABEL}>End Time</label>
              <input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                className={DK_INPUT} style={{ colorScheme: 'dark' }} />
            </div>
            <div>
              <label className={DK_LABEL}>Grace (min)</label>
              <input type="number" min={0} max={60} value={form.gracePeriodMinutes} onChange={e => setForm(f => ({ ...f, gracePeriodMinutes: parseInt(e.target.value) || 0 }))}
                className={DK_INPUT} />
            </div>
          </div>
          <div>
            <label className={DK_LABEL}>Working Days</label>
            <div className="flex gap-2 flex-wrap mt-1">
              {DAYS_OPTIONS.map(d => (
                <button key={d} type="button" onClick={() => toggleDay(d)}
                  className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                    form.workingDays.includes(d) ? 'bg-blue-600 text-white border-blue-600' : 'border-[#2d4068] text-slate-300 hover:border-blue-500'
                  }`}>{DAY_LABELS[d]}</button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setModal(null)} className={DK_CANCEL}>Cancel</button>
            <button onClick={handleSave} disabled={!form.name || !form.startTime || !form.endTime}
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-60">Save</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Assignments Tab
// ─────────────────────────────────────────────────────────────────────────────

// Shared input / label classes that work on the modal's dark bg-[#152035]
const DK_INPUT  = 'w-full rounded-lg border border-[#2d4068] bg-[#1e2d45] px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500'
const DK_LABEL  = 'block text-sm font-medium text-slate-300 mb-1'
const DK_CANCEL = 'px-4 py-2 text-sm rounded-lg border border-[#2d4068] text-slate-300 hover:bg-[#1e2d45] transition-colors'

function AssignmentsTab({ shifts, users }: { shifts: ReturnType<typeof useShifts>; users: ReturnType<typeof useUsers>['users'] }) {
  const [modal, setModal]         = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [dropOpen, setDropOpen]   = useState(false)
  const [search, setSearch]       = useState('')
  const [form, setForm]           = useState({ userIds: [] as string[], shiftId: '', effectiveFrom: '', effectiveTo: '' })
  const dropRef                   = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropOpen(false)
        setSearch('')
      }
    }
    if (dropOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dropOpen])

  const closeModal = () => {
    setModal(false)
    setDropOpen(false)
    setSearch('')
    setForm({ userIds: [], shiftId: '', effectiveFrom: '', effectiveTo: '' })
  }

  const toggleUser = (id: string) =>
    setForm(f => ({ ...f, userIds: f.userIds.includes(id) ? f.userIds.filter(x => x !== id) : [...f.userIds, id] }))

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleAssign = async () => {
    if (!form.userIds.length || !form.shiftId || !form.effectiveFrom) return
    setAssigning(true)
    try {
      await Promise.all(
        form.userIds.map(userId =>
          shifts.assignShift({ userId, shiftId: form.shiftId, effectiveFrom: form.effectiveFrom, effectiveTo: form.effectiveTo || undefined })
        )
      )
      toast.success(form.userIds.length === 1 ? 'Shift assigned' : `Shift assigned to ${form.userIds.length} employees`)
      closeModal()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed') }
    finally { setAssigning(false) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-medium text-slate-800 dark:text-slate-200">Shift Assignments</h2>
        <button onClick={() => setModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">
          <Plus size={13} /> Assign Shift
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              {['Employee','Shift','Effective From','Effective To','Action'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shifts.assignments.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No assignments yet</td></tr>
            )}
            {shifts.assignments.map((a: ShiftAssignment) => (
              <tr key={a.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                <td className="px-4 py-3 font-medium">{a.user ? `${a.user.firstName} ${a.user.lastName}` : a.userId}</td>
                <td className="px-4 py-3">{a.shift?.name ?? a.shiftId}</td>
                <td className="px-4 py-3">{fmtDate(a.effectiveFrom)}</td>
                <td className="px-4 py-3">{a.effectiveTo ? fmtDate(a.effectiveTo) : <span className="text-slate-400">Ongoing</span>}</td>
                <td className="px-4 py-3">
                  <button onClick={async () => { if (confirm('Remove this assignment?')) { await shifts.removeAssignment(a.id); toast.success('Removed') } }}
                    className="text-slate-400 hover:text-red-500 transition-colors"><X size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modal} onClose={closeModal} title="Assign Shift" size="lg">
        <div className="space-y-4">

          {/* ── Employee multi-select dropdown ── */}
          <div>
            <label className={DK_LABEL}>
              Employees
              {form.userIds.length > 0 && (
                <span className="ml-2 text-blue-400 font-normal">{form.userIds.length} selected</span>
              )}
            </label>

            {/* Dropdown trigger */}
            <div ref={dropRef} className="relative">
              <button
                type="button"
                onClick={() => { setDropOpen(o => !o); setSearch('') }}
                className="w-full flex items-center justify-between rounded-lg border border-[#2d4068] bg-[#1e2d45] px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                <span className={form.userIds.length === 0 ? 'text-slate-400' : 'text-white'}>
                  {form.userIds.length === 0
                    ? 'Select employees…'
                    : form.userIds.length === 1
                      ? users.find(u => u.id === form.userIds[0])?.name
                      : `${form.userIds.length} employees selected`}
                </span>
                <ChevronDown size={14} className={`text-slate-400 transition-transform ${dropOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown panel */}
              {dropOpen && (
                <div className="absolute z-50 mt-1 w-full rounded-lg border border-[#2d4068] bg-[#1e2d45] shadow-xl">
                  {/* Search */}
                  <div className="p-2 border-b border-[#2d4068]">
                    <input
                      autoFocus
                      type="text"
                      placeholder="Search…"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="w-full rounded-md border border-[#2d4068] bg-[#152035] px-3 py-1.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  {/* Options */}
                  <div className="max-h-48 overflow-y-auto divide-y divide-[#2d4068]">
                    {filteredUsers.length === 0 ? (
                      <div className="px-3 py-4 text-center text-sm text-slate-400">No employees found</div>
                    ) : (
                      filteredUsers.map(u => {
                        const selected = form.userIds.includes(u.id)
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => toggleUser(u.id)}
                            className={`w-full flex items-center justify-between px-3 py-2.5 text-sm text-left transition-colors ${selected ? 'bg-blue-600/20 text-blue-200' : 'text-slate-200 hover:bg-[#243553]'}`}
                          >
                            <span>{u.name}</span>
                            {selected && <Check size={13} className="text-blue-400 shrink-0" />}
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Selected chips */}
            {form.userIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {form.userIds.map(id => {
                  const u = users.find(u => u.id === id)
                  return (
                    <span key={id} className="flex items-center gap-1 pl-2.5 pr-1.5 py-0.5 rounded-full bg-blue-600/25 border border-blue-500/40 text-blue-300 text-xs font-medium">
                      {u?.name}
                      <button type="button" onClick={() => toggleUser(id)} className="ml-0.5 hover:text-white transition-colors">
                        <X size={10} />
                      </button>
                    </span>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Shift ── */}
          <div>
            <label className={DK_LABEL}>Shift</label>
            <select
              value={form.shiftId}
              onChange={e => setForm(f => ({ ...f, shiftId: e.target.value }))}
              className={DK_INPUT}
              style={{ colorScheme: 'dark' }}
            >
              <option value="">Select shift…</option>
              {shifts.shifts.filter(s => s.isActive).map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.startTime}–{s.endTime})</option>
              ))}
            </select>
          </div>

          {/* ── Dates ── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={DK_LABEL}>Effective From</label>
              <input
                type="date"
                value={form.effectiveFrom}
                onChange={e => setForm(f => ({ ...f, effectiveFrom: e.target.value }))}
                className={DK_INPUT}
                style={{ colorScheme: 'dark' }}
              />
            </div>
            <div>
              <label className={DK_LABEL}>Effective To <span className="text-slate-500 font-normal">(optional)</span></label>
              <input
                type="date"
                value={form.effectiveTo}
                onChange={e => setForm(f => ({ ...f, effectiveTo: e.target.value }))}
                className={DK_INPUT}
                style={{ colorScheme: 'dark' }}
              />
            </div>
          </div>

          {/* ── Actions ── */}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={closeModal} className={DK_CANCEL}>Cancel</button>
            <button
              onClick={handleAssign}
              disabled={!form.userIds.length || !form.shiftId || !form.effectiveFrom || assigning}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50 transition-colors"
            >
              {assigning && <Loader2 size={13} className="animate-spin" />}
              {assigning ? 'Assigning…' : `Assign${form.userIds.length > 1 ? ` (${form.userIds.length})` : ''}`}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Geofences Tab
// ─────────────────────────────────────────────────────────────────────────────

function GeofencesTab({ geofences }: { geofences: ReturnType<typeof useGeofences> }) {
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; geo?: GeofenceLocation } | null>(null)
  const [form, setForm] = useState({ name: '', latitude: '', longitude: '', radiusMeters: 200 })
  const [locating, setLocating] = useState(false)

  const fetchLocation = (silent = false) => {
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      p => {
        setForm(f => ({ ...f, latitude: String(p.coords.latitude.toFixed(6)), longitude: String(p.coords.longitude.toFixed(6)) }))
        setLocating(false)
        if (!silent) toast.success(`Location captured: ${p.coords.latitude.toFixed(4)}, ${p.coords.longitude.toFixed(4)}`)
      },
      () => { if (!silent) toast.error('Could not get location'); setLocating(false) }
    )
  }

  const openCreate = () => {
    setForm({ name: '', latitude: '', longitude: '', radiusMeters: 200 })
    setModal({ mode: 'create' })
    fetchLocation(true)
  }
  const openEdit = (g: GeofenceLocation) => { setForm({ name: g.name, latitude: String(g.latitude), longitude: String(g.longitude), radiusMeters: g.radiusMeters }); setModal({ mode: 'edit', geo: g }) }

  const testLocation = () => fetchLocation(false)

  const handleSave = async () => {
    try {
      const data = { name: form.name, latitude: parseFloat(form.latitude), longitude: parseFloat(form.longitude), radiusMeters: form.radiusMeters }
      if (modal?.mode === 'create') {
        await geofences.createGeofence(data); toast.success('Geofence created')
      } else if (modal?.geo) {
        await geofences.updateGeofence(modal.geo.id, data); toast.success('Geofence updated')
      }
      setModal(null)
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed') }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-medium text-slate-800 dark:text-slate-200">Geofence Locations</h2>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">
          <Plus size={13} /> Add Location
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {geofences.geofences.length === 0 && (
          <p className="text-sm text-slate-400 col-span-3 py-8 text-center">No geofences configured</p>
        )}
        {geofences.geofences.map((g: GeofenceLocation) => (
          <div key={g.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <MapPin size={14} className="text-blue-500 flex-shrink-0" />
                <span className="font-medium text-slate-800 dark:text-slate-200">{g.name}</span>
              </div>
              <Badge variant={g.isActive ? 'success' : 'secondary'} className="text-xs">{g.isActive ? 'Active' : 'Inactive'}</Badge>
            </div>
            <div className="text-xs text-slate-500 space-y-1 mb-3">
              <div>{g.latitude.toFixed(6)}, {g.longitude.toFixed(6)}</div>
              <div>Radius: <span className="font-medium text-slate-700 dark:text-slate-300">{g.radiusMeters}m</span></div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => openEdit(g)} className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600"><Edit2 size={11} /> Edit</button>
              {g.isActive && (
                <button
                  onClick={async () => { if (confirm('Deactivate this geofence? It will remain in the list but will no longer enforce check-in boundaries.')) { await geofences.deactivateGeofence(g.id); toast.success('Deactivated') } }}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-amber-600"
                ><PowerOff size={11} /> Deactivate</button>
              )}
              <button
                onClick={async () => { if (confirm(`Permanently delete "${g.name}"? This cannot be undone.`)) { try { await geofences.deleteGeofence(g.id); toast.success('Deleted') } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed to delete') } } }}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-600"
              ><Trash2 size={11} /> Delete</button>
            </div>
          </div>
        ))}
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.mode === 'create' ? 'Add Geofence Location' : 'Edit Geofence'}>
        <div className="space-y-4">
          <div>
            <label className={DK_LABEL}>Location Name</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Head Office"
              className={DK_INPUT} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={DK_LABEL}>Latitude</label>
              <input type="number" step="any" value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))} placeholder="-33.8688"
                className={DK_INPUT} />
            </div>
            <div>
              <label className={DK_LABEL}>Longitude</label>
              <input type="number" step="any" value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))} placeholder="151.2093"
                className={DK_INPUT} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={testLocation} disabled={locating}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-[#2d4068] text-slate-300 hover:bg-[#1e2d45] transition-colors">
              {locating ? <Loader2 size={12} className="animate-spin" /> : <MapPin size={12} />}
              Use My Location
            </button>
            <span className="text-xs text-slate-400">Captures your current GPS coordinates</span>
          </div>
          <div>
            <label className={DK_LABEL}>Radius (metres)</label>
            <input type="number" min={50} max={5000} value={form.radiusMeters} onChange={e => setForm(f => ({ ...f, radiusMeters: parseInt(e.target.value) || 200 }))}
              className={DK_INPUT} />
            <p className="text-xs text-slate-400 mt-1">Must be between 50 and 5000 metres</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setModal(null)} className={DK_CANCEL}>Cancel</button>
            <button onClick={handleSave} disabled={!form.name || !form.latitude || !form.longitude}
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-60">Save</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Holidays Tab
// ─────────────────────────────────────────────────────────────────────────────

function HolidaysTab({ holidays }: { holidays: ReturnType<typeof useHolidays> }) {
  const [modal, setModal]     = useState<'create' | 'import' | null>(null)
  const [filter, setFilter]   = useState<'all' | 'public' | 'company'>('all')
  const [form, setForm]       = useState({ name: '', date: '', type: 'public', countryCode: '' })
  const [importForm, setImportForm] = useState({ year: new Date().getFullYear(), countryCode: 'AU', apiKey: '' })
  const [importing, setImporting]   = useState(false)

  const handleCreate = async () => {
    try {
      await holidays.createHoliday({ ...form, countryCode: form.countryCode || undefined })
      toast.success('Holiday added')
      setModal(null)
      setForm({ name: '', date: '', type: 'public', countryCode: '' })
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed') }
  }

  const handleImport = async () => {
    setImporting(true)
    try {
      const result = await holidays.importHolidays(importForm.year, importForm.countryCode, importForm.apiKey || undefined)
      toast.success(`${result.imported} holidays imported, ${result.skipped} skipped`)
      setModal(null)
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Import failed') }
    finally { setImporting(false) }
  }

  const filtered = holidays.holidays.filter(h => filter === 'all' || h.type === filter)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          {(['all','public','company'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${filter === f ? 'bg-blue-600 text-white' : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-300'}`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setModal('import')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm text-slate-600 dark:text-slate-300">
            <Upload size={13} /> Import
          </button>
          <button onClick={() => { setForm({ name: '', date: '', type: 'public', countryCode: '' }); setModal('create') }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">
            <Plus size={13} /> Add Holiday
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              {['Name','Date','Type','Source','Action'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No holidays found</td></tr>
            )}
            {filtered.map((h: PublicHoliday) => (
              <tr key={h.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                <td className="px-4 py-3 font-medium">{h.name}</td>
                <td className="px-4 py-3">{fmtDate(h.date)}</td>
                <td className="px-4 py-3"><Badge variant={h.type === 'public' ? 'info' : 'secondary'}>{h.type}</Badge></td>
                <td className="px-4 py-3 text-slate-500">
                  {h.countryCode ? (COUNTRY_LABEL[h.countryCode] ?? h.countryCode) : 'All employees'}
                </td>
                <td className="px-4 py-3">
                  <button onClick={async () => { if (confirm('Delete this holiday?')) { await holidays.deleteHoliday(h.id); toast.success('Deleted') } }}
                    className="text-slate-400 hover:text-red-600"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create modal */}
      <Modal open={modal === 'create'} onClose={() => setModal(null)} title="Add Holiday">
        <div className="space-y-4">
          <div>
            <label className={DK_LABEL}>Holiday Name</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Christmas Day"
              className={DK_INPUT} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={DK_LABEL}>Date</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className={DK_INPUT} style={{ colorScheme: 'dark' }} />
            </div>
            <div>
              <label className={DK_LABEL}>Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className={DK_INPUT} style={{ colorScheme: 'dark' }}>
                <option value="public">Public</option>
                <option value="company">Company</option>
              </select>
            </div>
          </div>
          <div>
            <label className={DK_LABEL}>Country <span className="text-slate-500 font-normal">(optional — leave blank for all employees)</span></label>
            <select value={form.countryCode} onChange={e => setForm(f => ({ ...f, countryCode: e.target.value }))}
              className={DK_INPUT} style={{ colorScheme: 'dark' }}>
              <option value="">— All employees —</option>
              {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setModal(null)} className={DK_CANCEL}>Cancel</button>
            <button onClick={handleCreate} disabled={!form.name || !form.date}
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-60">Add</button>
          </div>
        </div>
      </Modal>

      {/* Import modal */}
      <Modal open={modal === 'import'} onClose={() => setModal(null)} title="Import Public Holidays">
        <div className="space-y-4">
          <p className="text-sm text-slate-400">Automatically import public holidays from an online database.</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={DK_LABEL}>Country</label>
              <select value={importForm.countryCode} onChange={e => setImportForm(f => ({ ...f, countryCode: e.target.value }))}
                className={DK_INPUT} style={{ colorScheme: 'dark' }}>
                {ALL_COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className={DK_LABEL}>Year</label>
              <input type="number" min={2020} max={2030} value={importForm.year} onChange={e => setImportForm(f => ({ ...f, year: parseInt(e.target.value) || new Date().getFullYear() }))}
                className={DK_INPUT} />
            </div>
          </div>
          <div>
            <label className={DK_LABEL}>
              Calendarific API Key{' '}
              <span className="text-slate-500 font-normal">(required for 🇮🇳 India and other unsupported countries)</span>
            </label>
            <input
              value={importForm.apiKey}
              onChange={e => setImportForm(f => ({ ...f, apiKey: e.target.value }))}
              placeholder="Leave blank for free countries (AU, US, GB…)"
              className={DK_INPUT}
            />
            <p className="text-xs text-slate-500 mt-1">
              Free tier available at{' '}
              <a href="https://calendarific.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">calendarific.com</a>
              {' '}(500 requests/month).
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setModal(null)} className={DK_CANCEL}>Cancel</button>
            <button onClick={handleImport} disabled={importing}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-60">
              {importing && <Loader2 size={13} className="animate-spin" />}
              Import
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Leave Types Tab
// ─────────────────────────────────────────────────────────────────────────────

function LeaveTypesTab({ leaves, users, usersHook }: { leaves: ReturnType<typeof useLeaves>; users: ReturnType<typeof useUsers>['users']; usersHook: ReturnType<typeof useUsers> }) {
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; type?: LeaveType } | null>(null)
  const [form, setForm]   = useState({ name: '', color: '#2563eb', maxDaysPerYear: 20, carryForwardDays: 0, isPaid: true, isActive: true, allowedEmployeeTypes: [] as string[] })
  const [cfYear, setCfYear] = useState(new Date().getFullYear() - 1)
  const [cfConfirm, setCfConfirm] = useState(false)
  const [cfLoading, setCfLoading] = useState(false)
  const [balanceUserId, setBalanceUserId] = useState('')
  const [teamBalances, setTeamBalances] = useState<ReturnType<typeof useLeaves>['teamBalances']>([])
  const [balanceEdits, setBalanceEdits] = useState<Record<string, string>>({})
  const [savingBalance, setSavingBalance] = useState<string | null>(null)
  const [savingEmpType, setSavingEmpType] = useState(false)

  const openCreate = () => { setForm({ name: '', color: '#2563eb', maxDaysPerYear: 20, carryForwardDays: 0, isPaid: true, isActive: true, allowedEmployeeTypes: [] }); setModal({ mode: 'create' }) }
  const openEdit = (t: LeaveType) => { setForm({ name: t.name, color: t.color, maxDaysPerYear: t.maxDaysPerYear, carryForwardDays: t.carryForwardDays ?? 0, isPaid: t.isPaid, isActive: t.isActive, allowedEmployeeTypes: t.allowedEmployeeTypes ?? [] }); setModal({ mode: 'edit', type: t }) }

  const toggleAllowedType = (val: string) =>
    setForm(f => ({ ...f, allowedEmployeeTypes: f.allowedEmployeeTypes.includes(val) ? f.allowedEmployeeTypes.filter(x => x !== val) : [...f.allowedEmployeeTypes, val] }))

  const handleSave = async () => {
    try {
      if (modal?.mode === 'create') {
        await leaves.createLeaveType(form); toast.success('Leave type created')
      } else if (modal?.type) {
        await leaves.updateLeaveType(modal.type.id, form); toast.success('Leave type updated')
      }
      setModal(null)
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed') }
  }

  const handleCarryForward = async () => {
    setCfLoading(true)
    try {
      const result = await leaves.processCarryForward(cfYear)
      toast.success(`Carried forward ${result.totalCarried.toFixed(1)} days across ${result.processed} employees to ${cfYear + 1}`)
      setCfConfirm(false)
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed') }
    finally { setCfLoading(false) }
  }

  const loadBalances = async (uid: string) => {
    setBalanceUserId(uid)
    if (uid) {
      const b = await leaves.fetchTeamBalances(uid, new Date().getFullYear())
      setTeamBalances(b)
      const edits: Record<string, string> = {}
      b.forEach(bal => { edits[bal.id] = String(bal.allocated) })
      setBalanceEdits(edits)
    } else {
      setTeamBalances([])
    }
  }

  const handleEmpTypeChange = async (newType: EmployeeType) => {
    if (!balanceUserId) return
    setSavingEmpType(true)
    try {
      await usersHook.updateEmployeeType(balanceUserId, newType)
      toast.success('Employee type updated')
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed') }
    finally { setSavingEmpType(false) }
  }

  const saveBalance = async (balance: typeof teamBalances[0]) => {
    const newAlloc = parseFloat(balanceEdits[balance.id] ?? String(balance.allocated))
    if (isNaN(newAlloc)) return
    setSavingBalance(balance.id)
    try {
      await leaves.setLeaveBalance({ userId: balance.userId, leaveTypeId: balance.leaveTypeId, year: balance.year, allocated: newAlloc })
      toast.success('Balance updated')
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed') }
    finally { setSavingBalance(null) }
  }

  return (
    <div className="space-y-6">
      {/* Leave types table */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium text-slate-800 dark:text-slate-200">Leave Types</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => setCfConfirm(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium">
              <RotateCcw size={13} /> Carry-Forward
            </button>
            <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">
              <Plus size={13} /> Add Leave Type
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-500 mb-3">Employees inherit these allocations. Override per-employee in the Team Balances section below.</p>

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                {['Name','Max Days/Year','Eligible For','Paid','Status','Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leaves.leaveTypes.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No leave types configured</td></tr>
              )}
              {leaves.leaveTypes.map((t: LeaveType) => (
                <tr key={t.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                      <span className="font-medium">{t.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {t.isCompOff
                      ? <span className="text-xs text-amber-600 dark:text-amber-400 italic font-medium">Credit-based</span>
                      : t.maxDaysPerYear}
                  </td>
                  <td className="px-4 py-3">
                    {(!t.allowedEmployeeTypes || t.allowedEmployeeTypes.length === 0)
                      ? <Badge variant="success">All</Badge>
                      : <div className="flex flex-wrap gap-1">
                          {t.allowedEmployeeTypes.map(et => (
                            <span key={et} className="px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                              {EMPLOYEE_TYPE_OPTIONS.find(o => o.value === et)?.label ?? et}
                            </span>
                          ))}
                        </div>
                    }
                  </td>
                  <td className="px-4 py-3"><Badge variant={t.isPaid ? 'success' : 'secondary'}>{t.isPaid ? 'Paid' : 'Unpaid'}</Badge></td>
                  <td className="px-4 py-3"><Badge variant={t.isActive ? 'success' : 'secondary'}>{t.isActive ? 'Active' : 'Inactive'}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(t)} className="text-slate-400 hover:text-blue-600 transition-colors"><Edit2 size={14} /></button>
                      <button
                        onClick={async () => {
                          const msg = t.isCompOff
                            ? `Delete the Comp Off leave type "${t.name}"? Any existing leave requests will be preserved (type will be deactivated instead of deleted).`
                            : `Delete leave type "${t.name}"? If it has existing leave requests it will be deactivated instead.`
                          if (!confirm(msg)) return
                          try {
                            const result = await leaves.deleteLeaveType(t.id)
                            toast.success(result.message)
                          } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed to delete') }
                        }}
                        className="text-slate-400 hover:text-red-600 transition-colors"
                        title="Delete leave type"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Team Balances override */}
      <div>
        <h2 className="font-medium text-slate-800 dark:text-slate-200 mb-3">Team Balances</h2>
        <div className="flex items-center gap-3 mb-4">
          <select value={balanceUserId} onChange={e => loadBalances(e.target.value)}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm">
            <option value="">Select employee…</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <span className="text-sm text-slate-500">({new Date().getFullYear()})</span>

          {/* Employee type inline editor — shown when a user is selected */}
          {balanceUserId && (() => {
            const selectedUser = users.find(u => u.id === balanceUserId)
            return selectedUser ? (
              <div className="flex items-center gap-2 ml-2 pl-3 border-l border-slate-200 dark:border-slate-700">
                <span className="text-sm text-slate-500 whitespace-nowrap">Employee Type:</span>
                <select
                  value={selectedUser.employeeType ?? 'PERMANENT'}
                  onChange={e => handleEmpTypeChange(e.target.value as EmployeeType)}
                  disabled={savingEmpType}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm disabled:opacity-60"
                >
                  {EMPLOYEE_TYPE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                {savingEmpType && <Loader2 size={13} className="animate-spin text-slate-400" />}
              </div>
            ) : null
          })()}
        </div>

        {teamBalances.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                  {['Leave Type','Allocated','Used','Pending','Remaining','Save'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teamBalances.map(b => (
                  <tr key={b.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: b.leaveType?.color ?? '#2563eb' }} />
                        {b.leaveType?.name}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <input type="number" step="0.5" min={0} value={balanceEdits[b.id] ?? b.allocated}
                        onChange={e => setBalanceEdits(prev => ({ ...prev, [b.id]: e.target.value }))}
                        className="w-20 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-sm" />
                    </td>
                    <td className="px-4 py-3">{b.used}</td>
                    <td className="px-4 py-3">{b.pending}</td>
                    <td className="px-4 py-3">{(b.allocated - b.used - b.pending).toFixed(1)}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => saveBalance(b)} disabled={savingBalance === b.id}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
                        {savingBalance === b.id && <Loader2 size={11} className="animate-spin" />}
                        Save
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Carry-Forward confirmation modal */}
      <Modal open={cfConfirm} onClose={() => setCfConfirm(false)} title="Process Year-End Carry-Forward">
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            This will add unused leave days (up to each type's carry-forward limit) from the selected year to employees' balances for the following year.
          </p>
          <div>
            <label className={DK_LABEL}>From Year</label>
            <input type="number" min={2020} max={new Date().getFullYear()} value={cfYear}
              onChange={e => setCfYear(parseInt(e.target.value) || cfYear)}
              className={DK_INPUT} />
            <p className="text-xs text-slate-400 mt-1">Unused days from {cfYear} will be added to {cfYear + 1} balances.</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setCfConfirm(false)} className={DK_CANCEL}>Cancel</button>
            <button onClick={handleCarryForward} disabled={cfLoading}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-60">
              {cfLoading && <Loader2 size={13} className="animate-spin" />}
              Process Carry-Forward
            </button>
          </div>
        </div>
      </Modal>

      {/* Create/Edit modal */}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.mode === 'create' ? 'Create Leave Type' : 'Edit Leave Type'}>
        <div className="space-y-4">
          <div>
            <label className={DK_LABEL}>Name</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Annual Leave"
              className={DK_INPUT} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={DK_LABEL}>Color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                  className="w-10 h-9 rounded cursor-pointer border border-[#2d4068]" />
                <input value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                  className="flex-1 rounded-lg border border-[#2d4068] bg-[#1e2d45] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div>
              <label className={DK_LABEL}>Max Days/Year</label>
              <input type="number" min={0} max={365} step={0.5} value={form.maxDaysPerYear}
                onChange={e => setForm(f => ({ ...f, maxDaysPerYear: parseFloat(e.target.value) || 0 }))}
                className={DK_INPUT} />
            </div>
          </div>
          <div>
            <label className={DK_LABEL}>Carry Forward Days</label>
            <input type="number" min={0} max={30} step={0.5} value={form.carryForwardDays}
              onChange={e => setForm(f => ({ ...f, carryForwardDays: parseFloat(e.target.value) || 0 }))}
              className={DK_INPUT} />
            <p className="text-xs text-slate-400 mt-1">Max unused days carried to next year. 0 = no carry-forward.</p>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.isPaid} onChange={e => setForm(f => ({ ...f, isPaid: e.target.checked }))} className="rounded" />
              <span className="text-slate-300">Paid Leave</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="rounded" />
              <span className="text-slate-300">Active</span>
            </label>
          </div>

          {/* ── Eligible For (employee type restriction) ── */}
          <div>
            <label className={DK_LABEL}>
              Eligible For
              <span className="ml-2 font-normal text-slate-500">
                {form.allowedEmployeeTypes.length === 0 ? '(All employee types)' : `(${form.allowedEmployeeTypes.length} selected)`}
              </span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {EMPLOYEE_TYPE_OPTIONS.map(opt => {
                const checked = form.allowedEmployeeTypes.includes(opt.value)
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleAllowedType(opt.value)}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors ${
                      checked
                        ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                        : 'border-[#2d4068] bg-[#1e2d45] text-slate-300 hover:bg-[#243553]'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {checked && <Check size={13} className="text-blue-400" />}
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-slate-500 mt-1">Leave all unselected to allow every employee type.</p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setModal(null)} className={DK_CANCEL}>Cancel</button>
            <button onClick={handleSave} disabled={!form.name}
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-60">Save</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Work Modes Tab
// ─────────────────────────────────────────────────────────────────────────────

const ALL_WORK_MODES: { mode: WorkMode; label: string; Icon: ComponentType<{ size?: number; className?: string }> }[] = [
  { mode: 'OFFICE',     label: 'Office',     Icon: Building2 },
  { mode: 'WFH',        label: 'WFH',        Icon: Home },
  { mode: 'TRAVELLING', label: 'Travelling', Icon: Plane },
]

function WorkModesTab({
  users,
  workPolicies,
}: {
  users: ReturnType<typeof useUsers>['users']
  workPolicies: ReturnType<typeof useWorkPolicies>
}) {
  const { policies, loading, hasFetched, fetchPolicies, upsertPolicy, deletePolicy } = workPolicies
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => { fetchPolicies() }, [fetchPolicies])

  const getPolicyModes = (userId: string): WorkMode[] => {
    const p = policies.find(p => p.userId === userId)
    return p?.allowedModes ?? []           // empty = unrestricted (all modes allowed)
  }

  const isRestricted = (userId: string) => getPolicyModes(userId).length > 0

  const handleToggle = async (userId: string, mode: WorkMode) => {
    setSaving(userId)
    try {
      const current = getPolicyModes(userId)
      const isUnrestricted = current.length === 0  // currently all-modes

      let next: WorkMode[]
      if (isUnrestricted) {
        // First click on an unrestricted employee = "allow ONLY this mode"
        next = [mode]
      } else if (current.includes(mode)) {
        next = current.filter(m => m !== mode)
      } else {
        next = [...current, mode]
      }

      if (next.length === 3 || next.length === 0) {
        // All three or none = unrestricted → remove policy
        await deletePolicy(userId)
        toast.success('Policy cleared — all modes allowed')
      } else {
        await upsertPolicy(userId, next)
        toast.success('Work mode policy updated')
      }
    } catch {
      toast.error('Failed to update policy')
    } finally {
      setSaving(null)
    }
  }

  const handleClearPolicy = async (userId: string) => {
    setSaving(userId)
    try {
      await deletePolicy(userId)
      toast.success('Policy cleared — all modes allowed')
    } catch {
      toast.error('Failed to clear policy')
    } finally {
      setSaving(null)
    }
  }

  const modeActive = (userId: string, mode: WorkMode) => {
    const modes = getPolicyModes(userId)
    return modes.length === 0 || modes.includes(mode)  // unrestricted → all shown as active
  }

  if (loading || !hasFetched) {
    return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-slate-400" size={24} /></div>
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Work Mode Policies</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Control which check-in modes each employee can use. No restriction means all modes are allowed.
        </p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-5 text-xs text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5"><Building2 size={12} /> Office — GPS + geofence enforced</span>
        <span className="flex items-center gap-1.5"><Home size={12} /> WFH — no GPS required</span>
        <span className="flex items-center gap-1.5"><Plane size={12} /> Travelling — GPS captured, no geofence check</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Employee</th>
              {ALL_WORK_MODES.map(({ mode, label, Icon }) => (
                <th key={mode} className="text-center px-4 py-3 font-medium text-slate-600 dark:text-slate-400">
                  <span className="flex items-center justify-center gap-1.5"><Icon size={13} />{label}</span>
                </th>
              ))}
              <th className="text-center px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {users.map(u => {
              const restricted = isRestricted(u.id)
              const isSavingRow = saving === u.id
              const policyModes = getPolicyModes(u.id)
              return (
                <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                    {u.name}
                    {u.department && <span className="ml-2 text-xs text-slate-400 font-normal">{u.department}</span>}
                  </td>
                  {ALL_WORK_MODES.map(({ mode, Icon }) => {
                    const active = modeActive(u.id, mode)
                    return (
                      <td key={mode} className="px-4 py-3 text-center">
                        <button
                          disabled={isSavingRow}
                          onClick={() => handleToggle(u.id, mode)}
                          title={`${active ? 'Disable' : 'Enable'} ${mode.toLowerCase()} for this employee`}
                          className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-colors disabled:opacity-50 ${
                            active
                              ? mode === 'OFFICE'
                                ? restricted ? 'bg-blue-600/20 border-blue-500/50 text-blue-400' : 'bg-blue-600/10 border-blue-500/30 text-blue-300'
                                : mode === 'WFH'
                                  ? restricted ? 'bg-purple-600/20 border-purple-500/50 text-purple-400' : 'bg-purple-600/10 border-purple-500/30 text-purple-300'
                                  : restricted ? 'bg-amber-600/20 border-amber-500/50 text-amber-400' : 'bg-amber-600/10 border-amber-500/30 text-amber-300'
                              : 'border-slate-200 dark:border-slate-700 text-slate-300 dark:text-slate-600 hover:border-slate-400'
                          }`}
                        >
                          <Icon size={13} />
                        </button>
                      </td>
                    )
                  })}
                  <td className="px-4 py-3 text-center">
                    {restricted
                      ? <Badge variant="default">{policyModes.length} mode{policyModes.length !== 1 ? 's' : ''}</Badge>
                      : <span className="text-xs text-slate-400 italic">Unrestricted</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-right">
                    {restricted && (
                      <button
                        disabled={isSavingRow}
                        onClick={() => handleClearPolicy(u.id)}
                        title="Clear restriction — allow all modes"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                      >
                        <RotateCcw size={13} />
                      </button>
                    )}
                    {isSavingRow && <Loader2 size={13} className="animate-spin text-slate-400 inline" />}
                  </td>
                </tr>
              )
            })}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500 text-sm">No active employees found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400">
        Tip: Click a mode icon to toggle it for an employee. Faded icons indicate the mode is available by default (no restriction set).
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Comp Off Tab
// ─────────────────────────────────────────────────────────────────────────────

function CompOffTab({ leaves }: { leaves: ReturnType<typeof useLeaves> }) {
  const [compOffEnabled,    setCompOffEnabled]    = useState(false)
  const [compOffExpiryDays, setCompOffExpiryDays] = useState(90)
  const [expiryInput,       setExpiryInput]       = useState('90')
  const [loading,           setLoading]           = useState(true)
  const [saving,            setSaving]            = useState(false)
  const [creatingType,      setCreatingType]      = useState(false)
  const [deactivating,      setDeactivating]      = useState(false)
  const [ltNameEdit,        setLtNameEdit]        = useState('')
  const [ltColorEdit,       setLtColorEdit]       = useState('')
  const [savingLt,          setSavingLt]          = useState(false)

  // Load current settings on mount
  // GET /settings returns { success, data: { org, settings } }
  useEffect(() => {
    api.get<{ success: boolean; data: { org: Record<string, unknown>; settings: Record<string, unknown> } }>('/settings')
      .then(res => {
        const s = res.data?.settings ?? {}
        const enabled = Boolean(s.compOffEnabled ?? false)
        const days    = Number(s.compOffExpiryDays ?? 90) || 90
        setCompOffEnabled(enabled)
        setCompOffExpiryDays(days)
        setExpiryInput(String(days))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const compOffLeaveType = leaves.leaveTypes.find(t => t.isCompOff && t.isActive)

  // Sync edit fields when leave type is loaded
  useEffect(() => {
    if (compOffLeaveType) {
      setLtNameEdit(compOffLeaveType.name)
      setLtColorEdit(compOffLeaveType.color)
    }
  }, [compOffLeaveType?.id])  // eslint-disable-line

  const handleSaveLeaveType = async () => {
    if (!compOffLeaveType) return
    setSavingLt(true)
    try {
      await leaves.updateLeaveType(compOffLeaveType.id, { name: ltNameEdit.trim() || compOffLeaveType.name, color: ltColorEdit })
      toast.success('Leave type updated')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSavingLt(false)
    }
  }

  const handleDeactivate = async () => {
    if (!compOffLeaveType) return
    if (!confirm(`Deactivate "${compOffLeaveType.name}"? Existing credits are unaffected, but employees won't be able to apply for comp-off leave until a new type is created.`)) return
    setDeactivating(true)
    try {
      await leaves.updateLeaveType(compOffLeaveType.id, { isActive: false })
      toast.success('Leave type deactivated — you can now create a new one')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setDeactivating(false)
    }
  }

  const handleToggleEnabled = async (enabled: boolean) => {
    setSaving(true)
    try {
      await api.put('/settings/comp-off', { compOffEnabled: enabled })
      setCompOffEnabled(enabled)
      toast.success(enabled ? 'Comp Off enabled' : 'Comp Off disabled')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveExpiry = async () => {
    const days = parseInt(expiryInput, 10)
    if (isNaN(days) || days < 1) { toast.error('Expiry days must be a positive number'); return }
    setSaving(true)
    try {
      await api.put('/settings/comp-off', { compOffExpiryDays: days })
      setCompOffExpiryDays(days)
      toast.success('Expiry days saved')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateLeaveType = async () => {
    setCreatingType(true)
    try {
      await leaves.createLeaveType({
        name: 'Compensatory Off',
        color: '#f59e0b',
        maxDaysPerYear: 365,   // effectively unlimited — governed by credits
        carryForwardDays: 0,
        isPaid: false,
        isCompOff: true,
        allowedEmployeeTypes: [],
      })
      toast.success('Comp Off leave type created')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to create')
    } finally {
      setCreatingType(false)
    }
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-slate-400" /></div>

  return (
    <div className="space-y-8 max-w-lg">
      <div>
        <h2 className="font-medium text-slate-800 dark:text-slate-200 mb-1">Compensatory Off</h2>
        <p className="text-sm text-slate-500">
          When enabled, employees who work ≥ 75% of their shift on a public holiday or their scheduled day off automatically earn one comp-off credit.
        </p>
      </div>

      {/* Enable/Disable toggle */}
      <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3">
        <div>
          <div className="font-medium text-sm text-slate-800 dark:text-slate-200">Enable Comp Off</div>
          <div className="text-xs text-slate-500 mt-0.5">Auto-award credits at checkout on holidays / off-days</div>
        </div>
        <button
          disabled={saving}
          onClick={() => handleToggleEnabled(!compOffEnabled)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
            compOffEnabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'
          }`}
        >
          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${compOffEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      {/* Expiry days */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 space-y-3">
        <div>
          <div className="font-medium text-sm text-slate-800 dark:text-slate-200">Credit Expiry</div>
          <div className="text-xs text-slate-500 mt-0.5">Credits expire this many days after being earned. Industry standard: 90 days.</div>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={1}
            value={expiryInput}
            onChange={e => setExpiryInput(e.target.value)}
            className="w-24 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm text-slate-500">days</span>
          <button
            disabled={saving || expiryInput === String(compOffExpiryDays)}
            onClick={handleSaveExpiry}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 size={13} className="animate-spin inline" /> : 'Save'}
          </button>
        </div>
      </div>

      {/* Comp Off Leave Type */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 space-y-3">
        <div>
          <div className="font-medium text-sm text-slate-800 dark:text-slate-200">Comp Off Leave Type</div>
          <div className="text-xs text-slate-500 mt-0.5">A dedicated leave type is required for employees to apply their comp-off credits.</div>
        </div>
        {compOffLeaveType ? (
          <>
            {/* Inline name + colour editor */}
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={ltColorEdit}
                onChange={e => setLtColorEdit(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border border-slate-200 dark:border-slate-700 p-0.5"
                title="Leave type colour"
              />
              <input
                type="text"
                value={ltNameEdit}
                onChange={e => setLtNameEdit(e.target.value)}
                className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                disabled={savingLt || (ltNameEdit === compOffLeaveType.name && ltColorEdit === compOffLeaveType.color)}
                onClick={handleSaveLeaveType}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {savingLt ? <Loader2 size={13} className="animate-spin inline" /> : 'Save'}
              </button>
            </div>
            {/* Deactivate / reset */}
            <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
              <button
                disabled={deactivating}
                onClick={handleDeactivate}
                className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50 transition-colors"
              >
                {deactivating ? <Loader2 size={11} className="animate-spin" /> : <PowerOff size={11} />}
                Deactivate & reconfigure
              </button>
              <span className="text-xs text-slate-400">— deactivating lets you create a replacement</span>
            </div>
          </>
        ) : (
          <button
            disabled={creatingType}
            onClick={handleCreateLeaveType}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium disabled:opacity-60 transition-colors"
          >
            {creatingType ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            Create Comp Off Leave Type
          </button>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Attendance Rules Tab
// ─────────────────────────────────────────────────────────────────────────────

function AttendanceRulesTab() {
  const [absentInput,  setAbsentInput]  = useState('25')
  const [halfDayInput, setHalfDayInput] = useState('75')
  const [otInput,      setOtInput]      = useState('0')
  const [closeInput,   setCloseInput]   = useState('23')
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)

  // Load current settings on mount
  useEffect(() => {
    api.get<{ success: boolean; data: { org: Record<string, unknown>; settings: Record<string, unknown> } }>('/settings')
      .then(res => {
        const s = res.data?.settings ?? {}
        setAbsentInput(String(s.absentThresholdPercent   ?? 25))
        setHalfDayInput(String(s.halfDayThresholdPercent ?? 75))
        setOtInput(String(s.overtimeThresholdMinutes     ?? 0))
        setCloseInput(String(s.defaultAutoCloseHour      ?? 23))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    const absent  = parseInt(absentInput,  10)
    const halfDay = parseInt(halfDayInput, 10)
    const ot      = parseInt(otInput,      10)
    const close   = parseInt(closeInput,   10)

    if (isNaN(absent)  || absent  < 1  || absent  > 49) { toast.error('Absent threshold must be 1–49%');              return }
    if (isNaN(halfDay) || halfDay < 2  || halfDay > 99) { toast.error('Half-day threshold must be 2–99%');            return }
    if (absent >= halfDay)                               { toast.error('Absent threshold must be less than half-day'); return }
    if (isNaN(ot)      || ot      < 0)                  { toast.error('Overtime buffer must be 0 or more');           return }
    if (isNaN(close)   || close   < 0  || close   > 23) { toast.error('Auto-close hour must be 0–23');                return }

    setSaving(true)
    try {
      await api.put('/settings/attendance-rules', {
        absentThresholdPercent:  absent,
        halfDayThresholdPercent: halfDay,
        overtimeThresholdMinutes: ot,
        defaultAutoCloseHour:    close,
      })
      toast.success('Attendance rules saved')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="max-w-lg space-y-6 py-4">

      {/* Status Tiers */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Status Tiers</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Determines ABSENT / HALF_DAY status at checkout based on % of shift worked.
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <label className="w-full sm:w-40 text-sm text-slate-700 dark:text-slate-300 sm:shrink-0">
              Absent threshold
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number" min={1} max={49}
                value={absentInput}
                onChange={e => setAbsentInput(e.target.value)}
                className="w-20 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-500">%</span>
            </div>
            <span className="text-xs text-slate-400">below this % of shift → Absent</span>
          </div>

          <div className="flex items-center gap-3">
            <label className="w-full sm:w-40 text-sm text-slate-700 dark:text-slate-300 sm:shrink-0">
              Half-day threshold
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number" min={2} max={99}
                value={halfDayInput}
                onChange={e => setHalfDayInput(e.target.value)}
                className="w-20 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-500">%</span>
            </div>
            <span className="text-xs text-slate-400">below this % of shift → Half Day</span>
          </div>
        </div>
      </div>

      {/* Overtime */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Overtime</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Extra minutes an employee must work beyond their shift before overtime is logged.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="w-full sm:w-40 text-sm text-slate-700 dark:text-slate-300 sm:shrink-0">
            Overtime buffer
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number" min={0}
              value={otInput}
              onChange={e => setOtInput(e.target.value)}
              className="w-20 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-500">min</span>
          </div>
          <span className="text-xs text-slate-400">0 = any extra minute counts</span>
        </div>
      </div>

      {/* Auto-close */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Auto-close Fallback</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            When the system auto-closes a stale record and the employee has no assigned shift, this hour is used as the checkout time.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="w-full sm:w-40 text-sm text-slate-700 dark:text-slate-300 sm:shrink-0">
            Close hour
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number" min={0} max={23}
              value={closeInput}
              onChange={e => setCloseInput(e.target.value)}
              className="w-20 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <span className="text-xs text-slate-400">hour 0–23 in org timezone</span>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-60 transition-colors"
        >
          {saving && <Loader2 size={13} className="animate-spin" />}
          Save Settings
        </button>
      </div>
    </div>
  )
}
