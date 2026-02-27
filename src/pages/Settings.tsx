import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Building2, Globe, Users, Briefcase, DollarSign, Bell,
  Plug, AlertTriangle, Loader2, Check, Plus, Trash2,
  Download, Shield, RefreshCw, Eye, EyeOff, ChevronRight,
  GripVertical, Edit2, X,
} from 'lucide-react'
import { useSettings, type OrgSettings, type TaskType, type SettingsSection } from '@/hooks/useSettings'
import { useSettingsStore } from '@/store/settingsStore'
import { useUsers } from '@/hooks/useUsers'
import { useJobLayouts, useTaskLayouts } from '@/hooks/useLayouts'
import { Switch } from '@/components/ui/Switch'
import { LayoutBuilder } from '@/components/LayoutBuilder'
import { api } from '@/lib/api'
import type { ApiResponse } from '@/lib/api'

// ── Constants ─────────────────────────────────────────────────────────────────

const CURRENCIES = [
  { code: 'AUD', symbol: '$', label: 'Australian Dollar (AUD)' },
  { code: 'USD', symbol: '$', label: 'US Dollar (USD)' },
  { code: 'GBP', symbol: '£', label: 'British Pound (GBP)' },
  { code: 'EUR', symbol: '€', label: 'Euro (EUR)' },
  { code: 'INR', symbol: '₹', label: 'Indian Rupee (INR)' },
  { code: 'CAD', symbol: '$', label: 'Canadian Dollar (CAD)' },
  { code: 'NZD', symbol: '$', label: 'New Zealand Dollar (NZD)' },
  { code: 'SGD', symbol: '$', label: 'Singapore Dollar (SGD)' },
]

const TIMEZONES = [
  'Australia/Sydney', 'Australia/Melbourne', 'Australia/Brisbane',
  'Australia/Perth', 'Australia/Adelaide', 'Pacific/Auckland',
  'Asia/Singapore', 'Asia/Kolkata', 'Asia/Tokyo', 'Asia/Shanghai',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin',
  'America/New_York', 'America/Chicago', 'America/Denver',
  'America/Los_Angeles', 'America/Toronto', 'UTC',
]

const DATE_FORMATS = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (Australian)' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (US)' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (ISO 8601)' },
]

const NUMBER_FORMATS = [
  { value: '1,234.56', label: '1,234.56 (English)' },
  { value: '1.234,56', label: '1.234,56 (European)' },
]

// ── Style helpers ─────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  border: '1px solid #e5e7eb',
  marginBottom: 20,
  overflow: 'hidden',
}

const cardHead: React.CSSProperties = {
  padding: '18px 24px 14px',
  borderBottom: '1px solid #f3f4f6',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
}

const cardBody: React.CSSProperties = { padding: '20px 24px' }

const cardFoot: React.CSSProperties = {
  padding: '14px 24px',
  borderTop: '1px solid #f3f4f6',
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
}

const fieldRow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 16,
  marginBottom: 16,
}

const label: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 500,
  color: '#374151',
  marginBottom: 6,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid #d1d5db',
  borderRadius: 8,
  fontSize: 14,
  color: '#111827',
  outline: 'none',
  boxSizing: 'border-box',
  background: '#fff',
}

const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' }

type SettingsTab = 'organisation' | 'localisation' | 'team' | 'jobs' | 'billing' | 'notifications' | 'integrations' | 'danger'

// ── Settings Nav ──────────────────────────────────────────────────────────────

const NAV_GROUPS: { label: string; items: { id: SettingsTab; label: string; icon: React.ReactNode }[] }[] = [
  {
    label: 'GENERAL',
    items: [
      { id: 'organisation', label: 'Organisation Profile', icon: <Building2 size={15} /> },
      { id: 'localisation', label: 'Localisation', icon: <Globe size={15} /> },
    ],
  },
  {
    label: 'MANAGEMENT',
    items: [
      { id: 'team', label: 'Team & Roles', icon: <Users size={15} /> },
      { id: 'jobs', label: 'Jobs & Tasks', icon: <Briefcase size={15} /> },
      { id: 'billing', label: 'Billing & Rates', icon: <DollarSign size={15} /> },
    ],
  },
  {
    label: 'SYSTEM',
    items: [
      { id: 'notifications', label: 'Notifications', icon: <Bell size={15} /> },
      { id: 'integrations', label: 'Integrations', icon: <Plug size={15} /> },
    ],
  },
  {
    label: 'DANGER ZONE',
    items: [
      { id: 'danger', label: 'Danger Zone', icon: <AlertTriangle size={15} /> },
    ],
  },
]

function SettingsNav({ active, onSelect }: { active: SettingsTab; onSelect: (t: SettingsTab) => void }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', padding: '8px 0' }}>
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.08em', padding: '12px 16px 4px' }}>
            {group.label}
          </div>
          {group.items.map((item) => {
            const isActive = active === item.id
            const isDanger = item.id === 'danger'
            return (
              <button
                key={item.id}
                onClick={() => onSelect(item.id)}
                style={{
                  width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                  background: isActive ? '#f0f4ff' : 'transparent',
                  color: isDanger ? '#ef4444' : isActive ? '#3b82f6' : '#374151',
                  borderRight: isActive ? '2px solid #3b82f6' : '2px solid transparent',
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ color: isDanger ? '#ef4444' : isActive ? '#3b82f6' : '#9ca3af' }}>{item.icon}</span>
                {item.label}
                {isActive && <ChevronRight size={13} style={{ marginLeft: 'auto', color: '#3b82f6' }} />}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ── Organisation Section ──────────────────────────────────────────────────────

function OrganisationSection({ data, saving, onSave }: { data: OrgSettings; saving: SettingsSection | null; onSave: (s: SettingsSection, p: Partial<OrgSettings>) => Promise<boolean> }) {
  const [form, setForm] = useState({ name: data.orgName, abn: data.abn ?? '', address: data.address ?? '', phone: data.phone ?? '', website: data.website ?? '', timezone: data.timezone, logoUrl: data.logoUrl ?? '' })
  useEffect(() => { setForm({ name: data.orgName, abn: data.abn ?? '', address: data.address ?? '', phone: data.phone ?? '', website: data.website ?? '', timezone: data.timezone, logoUrl: data.logoUrl ?? '' }) }, [data])

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSave = async () => {
    const ok = await onSave('profile', { ...form })
    if (ok) toast.success('Organisation profile saved')
    else toast.error('Failed to save profile')
  }

  const initials = form.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() || '??'

  return (
    <div style={card}>
      <div style={cardHead}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, background: '#eff6ff', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Building2 size={18} style={{ color: '#3b82f6' }} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Organisation Profile</div>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>Update your organisation's public details</div>
          </div>
        </div>
        {/* Avatar preview */}
        <div style={{ width: 52, height: 52, borderRadius: 10, background: '#1a1f36', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#fff', flexShrink: 0, overflow: 'hidden' }}>
          {form.logoUrl ? <img src={form.logoUrl} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} /> : initials}
        </div>
      </div>
      <div style={cardBody}>
        <div style={fieldRow}>
          <div><label style={label}>Company Name</label><input style={inputStyle} value={form.name} onChange={set('name')} placeholder="Acme Pty Ltd" /></div>
          <div><label style={label}>ABN / Tax ID</label><input style={inputStyle} value={form.abn} onChange={set('abn')} placeholder="12 345 678 901" /></div>
        </div>
        <div style={{ marginBottom: 16 }}><label style={label}>Address</label><input style={inputStyle} value={form.address} onChange={set('address')} placeholder="123 Main St, Sydney NSW 2000" /></div>
        <div style={fieldRow}>
          <div><label style={label}>Phone</label><input style={inputStyle} value={form.phone} onChange={set('phone')} placeholder="+61 2 9000 0000" /></div>
          <div><label style={label}>Website</label><input style={inputStyle} value={form.website} onChange={set('website')} placeholder="https://example.com" /></div>
        </div>
        <div style={fieldRow}>
          <div>
            <label style={label}>Timezone</label>
            <select style={selectStyle} value={form.timezone} onChange={set('timezone')}>
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div><label style={label}>Logo URL</label><input style={inputStyle} value={form.logoUrl} onChange={set('logoUrl')} placeholder="https://example.com/logo.png" /></div>
        </div>
      </div>
      <div style={cardFoot}><SaveButton saving={saving} section="profile" onClick={handleSave} /></div>
    </div>
  )
}

// ── Localisation Section ──────────────────────────────────────────────────────

function LocalisationSection({ data, saving, onSave }: { data: OrgSettings; saving: SettingsSection | null; onSave: (s: SettingsSection, p: Partial<OrgSettings>) => Promise<boolean> }) {
  const { setLocale } = useSettingsStore()
  const [form, setForm] = useState({ currency: data.currency, dateFormat: data.dateFormat, numberFormat: data.numberFormat })
  useEffect(() => { setForm({ currency: data.currency, dateFormat: data.dateFormat, numberFormat: data.numberFormat }) }, [data])

  const set = (k: string) => (e: React.ChangeEvent<HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  const selectedCurrency = CURRENCIES.find(c => c.code === form.currency) || CURRENCIES[0]

  // Live preview
  const previewAmount = selectedCurrency.symbol + '1' + (form.numberFormat.startsWith('1.') ? '.' : ',') + '234' + (form.numberFormat.startsWith('1.') ? ',56' : '.56')

  const handleSave = async () => {
    const payload = { currency: form.currency, currencySymbol: selectedCurrency.symbol, dateFormat: form.dateFormat, numberFormat: form.numberFormat }
    const ok = await onSave('localisation', payload)
    if (ok) {
      setLocale({ currency: form.currency, currencySymbol: selectedCurrency.symbol, dateFormat: form.dateFormat, numberFormat: form.numberFormat })
      toast.success(`Localisation saved — currency set to ${form.currency}`)
    } else {
      toast.error('Failed to save localisation')
    }
  }

  return (
    <div style={card}>
      <div style={cardHead}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, background: '#f0fdf4', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Globe size={18} style={{ color: '#22c55e' }} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Localisation</div>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>Currency, date format, and number formatting</div>
          </div>
        </div>
        {/* Live preview */}
        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 14px', fontSize: 13, color: '#374151' }}>
          <span style={{ color: '#9ca3af', marginRight: 6 }}>Preview:</span>
          <strong>{previewAmount}</strong>
          <span style={{ color: '#d1d5db', margin: '0 8px' }}>·</span>
          <strong>{form.dateFormat === 'DD/MM/YYYY' ? '25/02/2026' : form.dateFormat === 'MM/DD/YYYY' ? '02/25/2026' : '2026-02-25'}</strong>
        </div>
      </div>
      <div style={cardBody}>
        <div style={fieldRow}>
          <div>
            <label style={label}>Currency</label>
            <select style={selectStyle} value={form.currency} onChange={set('currency')}>
              {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>Date Format</label>
            <select style={selectStyle} value={form.dateFormat} onChange={set('dateFormat')}>
              {DATE_FORMATS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
        </div>
        <div style={{ maxWidth: '50%' }}>
          <label style={label}>Number Format</label>
          <select style={selectStyle} value={form.numberFormat} onChange={set('numberFormat')}>
            {NUMBER_FORMATS.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
          </select>
        </div>
      </div>
      <div style={cardFoot}><SaveButton saving={saving} section="localisation" onClick={handleSave} /></div>
    </div>
  )
}

// ── Notifications Section ─────────────────────────────────────────────────────

function NotificationsSection({ data, saving, onSave }: { data: OrgSettings; saving: SettingsSection | null; onSave: (s: SettingsSection, p: Partial<OrgSettings>) => Promise<boolean> }) {
  const [form, setForm] = useState({
    notifyTimesheetApproval: data.notifyTimesheetApproval,
    notifyInvoiceOverdue: data.notifyInvoiceOverdue,
    notifyFlaggedTimesheets: data.notifyFlaggedTimesheets,
    notifyJobDeadline: data.notifyJobDeadline,
    notifyNewUser: data.notifyNewUser,
    overdueInvoiceDays: data.overdueInvoiceDays,
  })
  useEffect(() => setForm({ notifyTimesheetApproval: data.notifyTimesheetApproval, notifyInvoiceOverdue: data.notifyInvoiceOverdue, notifyFlaggedTimesheets: data.notifyFlaggedTimesheets, notifyJobDeadline: data.notifyJobDeadline, notifyNewUser: data.notifyNewUser, overdueInvoiceDays: data.overdueInvoiceDays }), [data])

  const toggle = (k: keyof typeof form) => (v: boolean) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    const ok = await onSave('notifications', form)
    if (ok) toast.success('Notification preferences saved')
    else toast.error('Failed to save notifications')
  }

  return (
    <div style={card}>
      <div style={cardHead}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, background: '#fff7ed', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bell size={18} style={{ color: '#f97316' }} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Notifications</div>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>Configure which events trigger alerts</div>
          </div>
        </div>
      </div>
      <div style={cardBody}>
        <Switch checked={form.notifyTimesheetApproval} onCheckedChange={toggle('notifyTimesheetApproval')} label="Timesheet Approvals" description="Alert when timesheets are flagged and need review" />
        <Switch checked={form.notifyInvoiceOverdue} onCheckedChange={toggle('notifyInvoiceOverdue')} label="Invoice Overdue" description="Alert when invoices pass their due date" />
        <Switch checked={form.notifyFlaggedTimesheets} onCheckedChange={toggle('notifyFlaggedTimesheets')} label="Flagged Timesheets" description="Alert when timesheets are auto-flagged for under/over hours" />
        <Switch checked={form.notifyJobDeadline} onCheckedChange={toggle('notifyJobDeadline')} label="Job Deadlines" description="Alert when jobs approach their deadline" />
        <Switch checked={form.notifyNewUser} onCheckedChange={toggle('notifyNewUser')} label="New User Added" description="Alert when a new user joins the organisation" />
        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ ...label, marginBottom: 0, whiteSpace: 'nowrap' }}>Flag invoice overdue after</label>
          <input type="number" min={1} max={90} style={{ ...inputStyle, width: 70 }} value={form.overdueInvoiceDays} onChange={e => setForm(f => ({ ...f, overdueInvoiceDays: Number(e.target.value) }))} />
          <span style={{ fontSize: 13, color: '#6b7280' }}>days</span>
        </div>
      </div>
      <div style={cardFoot}><SaveButton saving={saving} section="notifications" onClick={handleSave} /></div>
    </div>
  )
}

// ── Team Section ──────────────────────────────────────────────────────────────

function TeamSection() {
  const { users, loading, updateUserRole, updateUser } = useUsers()
  const [editingRole, setEditingRole] = useState<string | null>(null)

  const ROLE_COLORS: Record<string, string> = { employee: '#22c55e', manager: '#3b82f6', admin: '#8b5cf6' }

  const departments = [...new Set(users.map(u => u.department).filter(Boolean))]

  const handleRoleChange = async (userId: string, role: string) => {
    const ok = await updateUserRole(userId, role as 'employee' | 'manager' | 'admin')
    if (ok) toast.success('Role updated')
    else toast.error('Failed to update role')
    setEditingRole(null)
  }

  const handleToggleStatus = async (u: { id: string; status: string; name: string }) => {
    const newStatus = u.status === 'active' ? 'inactive' : 'active'
    const ok = await updateUser(u.id, { status: newStatus } as Parameters<typeof updateUser>[1])
    if (ok) toast.success(`${u.name} set to ${newStatus}`)
    else toast.error('Failed to update status')
  }

  return (
    <div>
      <div style={card}>
        <div style={cardHead}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, background: '#f0f4ff', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={18} style={{ color: '#3b82f6' }} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Team Members</div>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>{users.length} members · {departments.length} department{departments.length !== 1 ? 's' : ''}</div>
            </div>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
              <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} />
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Name', 'Email', 'Role', 'Department', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f3f4f6' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid #f9fafb' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1a1f36', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>
                          {u.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{u.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#6b7280' }}>{u.email}</td>
                    <td style={{ padding: '12px 16px' }}>
                      {editingRole === u.id ? (
                        <select
                          autoFocus
                          defaultValue={u.role}
                          onBlur={() => setEditingRole(null)}
                          onChange={e => handleRoleChange(u.id, e.target.value)}
                          style={{ ...selectStyle, width: 'auto', fontSize: 12, padding: '4px 8px' }}
                        >
                          <option value="employee">Employee</option>
                          <option value="manager">Manager</option>
                          <option value="admin">Admin</option>
                        </select>
                      ) : (
                        <button onClick={() => setEditingRole(u.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, textTransform: 'capitalize', background: ROLE_COLORS[u.role] + '20', color: ROLE_COLORS[u.role] }}>
                          {u.role} <Edit2 size={10} />
                        </button>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#6b7280' }}>{u.department || '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: u.status === 'active' ? '#f0fdf4' : '#f9fafb', color: u.status === 'active' ? '#16a34a' : '#9ca3af' }}>
                        {u.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <button
                        onClick={() => handleToggleStatus(u)}
                        style={{ fontSize: 12, color: u.status === 'active' ? '#ef4444' : '#22c55e', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
                      >
                        {u.status === 'active' ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Departments summary */}
      {departments.length > 0 && (
        <div style={card}>
          <div style={cardHead}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Departments</div>
          </div>
          <div style={{ ...cardBody, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {departments.map(d => (
              <span key={d} style={{ padding: '4px 12px', background: '#f3f4f6', borderRadius: 20, fontSize: 13, color: '#374151', fontWeight: 500 }}>{d}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Jobs & Tasks Section ──────────────────────────────────────────────────────

const PRESET_COLORS = ['#6366f1', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#64748b']

type JobsSubTab = 'taskTypes' | 'workflow' | 'jobLayouts' | 'taskLayouts'

function JobsSection({ taskTypes, saving, onSave, createTaskType, updateTaskType, deleteTaskType, data }: {
  taskTypes: TaskType[]
  saving: SettingsSection | null
  onSave: (s: SettingsSection, p: Partial<OrgSettings>) => Promise<boolean>
  createTaskType: (p: { name: string; color: string; billableByDefault: boolean }) => Promise<boolean>
  updateTaskType: (id: string, p: Partial<TaskType>) => Promise<boolean>
  deleteTaskType: (id: string) => Promise<boolean>
  data: OrgSettings
}) {
  const [subTab, setSubTab] = useState<JobsSubTab>('taskTypes')
  const [newType, setNewType] = useState({ name: '', color: '#6366f1', billableByDefault: true })
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', color: '#6366f1', billableByDefault: true })

  // Layout builder hooks
  const jobLayouts = useJobLayouts()
  const taskLayouts = useTaskLayouts()

  const [wf, setWf] = useState({
    dailyHoursThreshold: data.dailyHoursThreshold,
    flagUnderHours: data.flagUnderHours,
    flagOverHours: data.flagOverHours,
    flagJobOvertime: data.flagJobOvertime,
    hourlyCostRatio: data.hourlyCostRatio,
    requireClientForJob: data.requireClientForJob,
  })
  useEffect(() => setWf({ dailyHoursThreshold: data.dailyHoursThreshold, flagUnderHours: data.flagUnderHours, flagOverHours: data.flagOverHours, flagJobOvertime: data.flagJobOvertime, hourlyCostRatio: data.hourlyCostRatio, requireClientForJob: data.requireClientForJob }), [data])

  const handleAddType = async () => {
    if (!newType.name.trim()) { toast.error('Name is required'); return }
    const ok = await createTaskType(newType)
    if (ok) { setNewType({ name: '', color: '#6366f1', billableByDefault: true }); setAdding(false); toast.success('Task type added') }
    else toast.error('Failed to add task type')
  }

  const startEdit = (t: TaskType) => { setEditingId(t.id); setEditForm({ name: t.name, color: t.color, billableByDefault: t.billableByDefault }) }

  const handleEditSave = async (id: string) => {
    const ok = await updateTaskType(id, editForm)
    if (ok) { setEditingId(null); toast.success('Task type updated') }
    else toast.error('Failed to update')
  }

  const handleDelete = async (id: string, name: string) => {
    const ok = await deleteTaskType(id)
    if (ok) toast.success(`"${name}" deactivated`)
    else toast.error('Failed to deactivate')
  }

  const handleWfSave = async () => {
    const ok = await onSave('workflow', wf)
    if (ok) toast.success('Workflow settings saved')
    else toast.error('Failed to save workflow settings')
  }

  const activeTypes = taskTypes.filter(t => t.isActive)

  const subTabs: { key: JobsSubTab; label: string }[] = [
    { key: 'taskTypes', label: 'Task Types' },
    { key: 'workflow', label: 'Workflow Rules' },
    { key: 'jobLayouts', label: 'Job Layouts' },
    { key: 'taskLayouts', label: 'Task Layouts' },
  ]

  return (
    <div>
      {/* Sub-tab switcher */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 24, background: '#f3f4f6', padding: 4, borderRadius: 10, width: 'fit-content' }}>
        {subTabs.map(t => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            style={{
              padding: '7px 18px', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', transition: 'all .15s',
              background: subTab === t.key ? '#fff' : 'transparent',
              color: subTab === t.key ? '#1a1f36' : '#6b7280',
              boxShadow: subTab === t.key ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Job Layouts tab ── */}
      {subTab === 'jobLayouts' && (
        <div style={card}>
          <div style={cardBody}>
            <LayoutBuilder
              title="Job Layouts"
              subtitle="Create reusable templates with custom fields for job creation. System fields always appear."
              layouts={jobLayouts.layouts}
              loading={jobLayouts.loading}
              onCreate={async (name, customFields, isDefault) => {
                const r = await jobLayouts.create(name, customFields, isDefault)
                return r !== null
              }}
              onUpdate={async (id, payload) => jobLayouts.update(id, payload)}
              onDelete={async (id) => jobLayouts.remove(id)}
              onSetDefault={async (id) => jobLayouts.setDefault(id)}
            />
          </div>
        </div>
      )}

      {/* ── Task Layouts tab ── */}
      {subTab === 'taskLayouts' && (
        <div style={card}>
          <div style={cardBody}>
            <LayoutBuilder
              title="Task Layouts"
              subtitle="Create reusable templates with custom fields for task creation. System fields always appear."
              layouts={taskLayouts.layouts}
              loading={taskLayouts.loading}
              onCreate={async (name, customFields, isDefault) => {
                const r = await taskLayouts.create(name, customFields, isDefault)
                return r !== null
              }}
              onUpdate={async (id, payload) => taskLayouts.update(id, payload)}
              onDelete={async (id) => taskLayouts.remove(id)}
              onSetDefault={async (id) => taskLayouts.setDefault(id)}
            />
          </div>
        </div>
      )}

      {/* ── Task Types tab ── */}
      {subTab === 'taskTypes' && (
        <div>
          {/* Task Type Manager */}
          <div style={card}>
            <div style={cardHead}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, background: '#faf5ff', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Briefcase size={18} style={{ color: '#8b5cf6' }} />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Task Types</div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>Manage the catalog of task types used when creating tasks</div>
                </div>
              </div>
              <button
                onClick={() => setAdding(a => !a)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: adding ? '#f3f4f6' : '#1a1f36', color: adding ? '#374151' : '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
              >
                {adding ? <X size={14} /> : <Plus size={14} />}
                {adding ? 'Cancel' : 'Add Type'}
              </button>
            </div>
            <div style={cardBody}>
              {/* Add form */}
              {adding && (
                <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16, marginBottom: 16 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                      <label style={label}>Name</label>
                      <input style={inputStyle} placeholder="e.g. Tax Return" value={newType.name} onChange={e => setNewType(f => ({ ...f, name: e.target.value }))} onKeyDown={e => e.key === 'Enter' && handleAddType()} autoFocus />
                    </div>
                    <div>
                      <label style={label}>Colour</label>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                        {PRESET_COLORS.map(c => (
                          <button key={c} onClick={() => setNewType(f => ({ ...f, color: c }))} style={{ width: 24, height: 24, borderRadius: '50%', background: c, border: newType.color === c ? '3px solid #111' : '2px solid transparent', cursor: 'pointer' }} />
                        ))}
                      </div>
                    </div>
                    <div>
                      <label style={label}>Billable</label>
                      <Switch checked={newType.billableByDefault} onCheckedChange={v => setNewType(f => ({ ...f, billableByDefault: v }))} />
                    </div>
                    <button onClick={handleAddType} style={{ padding: '8px 18px', background: '#1a1f36', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', marginBottom: 2 }}>
                      Add
                    </button>
                  </div>
                </div>
              )}

              {/* Task type list */}
              {activeTypes.length === 0 && !adding ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af', fontSize: 13 }}>
                  No task types yet. Click "Add Type" to create your first one.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {activeTypes.map(t => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 8, border: '1px solid #f3f4f6', background: editingId === t.id ? '#f9fafb' : '#fff' }}>
                      <GripVertical size={14} style={{ color: '#d1d5db', cursor: 'grab' }} />
                      {editingId === t.id ? (
                        <>
                          <div style={{ flex: 1, display: 'flex', gap: 10, alignItems: 'center' }}>
                            <input style={{ ...inputStyle, width: 160 }} value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} autoFocus />
                            <div style={{ display: 'flex', gap: 4 }}>
                              {PRESET_COLORS.map(c => <button key={c} onClick={() => setEditForm(f => ({ ...f, color: c }))} style={{ width: 18, height: 18, borderRadius: '50%', background: c, border: editForm.color === c ? '2px solid #111' : '1px solid transparent', cursor: 'pointer' }} />)}
                            </div>
                            <Switch checked={editForm.billableByDefault} onCheckedChange={v => setEditForm(f => ({ ...f, billableByDefault: v }))} label="Billable" />
                          </div>
                          <button onClick={() => handleEditSave(t.id)} style={{ padding: '4px 12px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}><Check size={12} /></button>
                          <button onClick={() => setEditingId(null)} style={{ padding: '4px 10px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}><X size={12} /></button>
                        </>
                      ) : (
                        <>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
                          <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: '#111827' }}>{t.name}</span>
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: t.billableByDefault ? '#f0fdf4' : '#f9fafb', color: t.billableByDefault ? '#16a34a' : '#9ca3af', fontWeight: 600 }}>
                            {t.billableByDefault ? 'Billable' : 'Non-billable'}
                          </span>
                          <button onClick={() => startEdit(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 4 }}><Edit2 size={14} /></button>
                          <button onClick={() => handleDelete(t.id, t.name)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fca5a5', padding: 4 }}><Trash2 size={14} /></button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Workflow tab ── */}
      {subTab === 'workflow' && (
        <div style={card}>
          <div style={cardHead}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, background: '#fff7ed', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Shield size={18} style={{ color: '#f97316' }} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Approval Workflow</div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>Configure timesheet flagging thresholds and job financial rules</div>
              </div>
            </div>
          </div>
          <div style={cardBody}>
            <div style={fieldRow}>
              <div>
                <label style={label}>Daily Hours Threshold</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="number" min={0} max={24} step={0.5} style={{ ...inputStyle, width: 80 }} value={wf.dailyHoursThreshold} onChange={e => setWf(f => ({ ...f, dailyHoursThreshold: Number(e.target.value) }))} />
                  <span style={{ fontSize: 13, color: '#6b7280' }}>hours/day before flagging</span>
                </div>
              </div>
              <div>
                <label style={label}>Hourly Cost Ratio</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="number" min={0} max={1} step={0.01} style={{ ...inputStyle, width: 80 }} value={wf.hourlyCostRatio} onChange={e => setWf(f => ({ ...f, hourlyCostRatio: Number(e.target.value) }))} />
                  <span style={{ fontSize: 13, color: '#6b7280' }}>(e.g. 0.70 = 70% of revenue)</span>
                </div>
              </div>
            </div>
            <Switch checked={wf.flagUnderHours} onCheckedChange={v => setWf(f => ({ ...f, flagUnderHours: v }))} label="Flag Under-Hours" description="Flag timesheets where daily total is below the threshold" />
            <Switch checked={wf.flagOverHours} onCheckedChange={v => setWf(f => ({ ...f, flagOverHours: v }))} label="Flag Over-Hours" description="Flag timesheets where daily total exceeds the threshold" />
            <Switch checked={wf.flagJobOvertime} onCheckedChange={v => setWf(f => ({ ...f, flagJobOvertime: v }))} label="Flag Job Overtime" description="Flag when total hours logged on a job exceed quoted hours" />
            <Switch checked={wf.requireClientForJob} onCheckedChange={v => setWf(f => ({ ...f, requireClientForJob: v }))} label="Require Client for Job" description="Jobs must be linked to a client before creation" />
          </div>
          <div style={cardFoot}><SaveButton saving={saving} section="workflow" onClick={handleWfSave} /></div>
        </div>
      )}
    </div>
  )
}

// ── Billing Section ───────────────────────────────────────────────────────────

function BillingSection({ data, saving, onSave }: { data: OrgSettings; saving: SettingsSection | null; onSave: (s: SettingsSection, p: Partial<OrgSettings>) => Promise<boolean> }) {
  const [form, setForm] = useState({
    defaultHourlyRate: data.defaultHourlyRate ?? '',
    billingIncrement: data.billingIncrement,
    defaultTaxRate: data.defaultTaxRate,
    invoicePrefix: data.invoicePrefix,
    invoicePaymentTermsDays: data.invoicePaymentTermsDays,
  })
  useEffect(() => setForm({ defaultHourlyRate: data.defaultHourlyRate ?? '', billingIncrement: data.billingIncrement, defaultTaxRate: data.defaultTaxRate, invoicePrefix: data.invoicePrefix, invoicePaymentTermsDays: data.invoicePaymentTermsDays }), [data])

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.type === 'number' ? Number(e.target.value) : e.target.value }))
  const currencySymbol = data.currencySymbol || '$'
  const handleSave = async () => {
    const ok = await onSave('billing', {
      defaultHourlyRate: form.defaultHourlyRate === '' ? null : Number(form.defaultHourlyRate),
      billingIncrement: Number(form.billingIncrement),
      defaultTaxRate: Number(form.defaultTaxRate),
      invoicePrefix: String(form.invoicePrefix),
      invoicePaymentTermsDays: Number(form.invoicePaymentTermsDays),
    })
    if (ok) toast.success('Billing settings saved')
    else toast.error('Failed to save billing settings')
  }

  return (
    <div style={card}>
      <div style={cardHead}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, background: '#fefce8', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DollarSign size={18} style={{ color: '#eab308' }} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Billing & Rates</div>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>Default rates, invoice settings, and tax configuration</div>
          </div>
        </div>
        {/* Invoice preview */}
        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 14px', fontSize: 13, color: '#374151' }}>
          <span style={{ color: '#9ca3af', marginRight: 6 }}>Next invoice:</span>
          <strong>{(form.invoicePrefix || 'INV').toUpperCase()}-0001</strong>
        </div>
      </div>
      <div style={cardBody}>
        <div style={fieldRow}>
          <div>
            <label style={label}>Default Hourly Rate</label>
            <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#6b7280', fontSize: 14 }}>
  {currencySymbol}
</span>
              <input type="number" min={0} step={5} style={{ ...inputStyle, paddingLeft: 26 }} value={form.defaultHourlyRate} onChange={e => setForm(f => ({ ...f, defaultHourlyRate: e.target.value }))} placeholder="150" />
            </div>
          </div>
          <div>
            <label style={label}>Billing Increment</label>
            <select style={selectStyle} value={form.billingIncrement} onChange={set('billingIncrement')}>
              <option value={6}>6 minutes</option>
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>60 minutes</option>
            </select>
          </div>
        </div>
        <div style={fieldRow}>
          <div>
            <label style={label}>Default Tax Rate (%)</label>
            <div style={{ position: 'relative' }}>
              <input type="number" min={0} max={100} step={0.5} style={{ ...inputStyle, paddingRight: 28 }} value={form.defaultTaxRate} onChange={set('defaultTaxRate')} />
              <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#6b7280', fontSize: 14 }}>%</span>
            </div>
          </div>
          <div>
            <label style={label}>Invoice Number Prefix</label>
            <input style={inputStyle} value={form.invoicePrefix} onChange={set('invoicePrefix')} placeholder="INV" maxLength={10} />
          </div>
        </div>
        <div style={{ maxWidth: '50%' }}>
          <label style={label}>Payment Terms (days)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="number" min={1} max={365} style={{ ...inputStyle, width: 80 }} value={form.invoicePaymentTermsDays} onChange={set('invoicePaymentTermsDays')} />
            <span style={{ fontSize: 13, color: '#6b7280' }}>days after invoice date</span>
          </div>
        </div>
      </div>
      <div style={cardFoot}><SaveButton saving={saving} section="billing" onClick={handleSave} /></div>
    </div>
  )
}

// ── Integrations Section ──────────────────────────────────────────────────────

interface Integration {
  id: string
  service: string
  label: string | null
  apiKey: string | null
  webhookUrl: string | null
  isActive: boolean
  config: Record<string, string> | null
}

function IntegrationsSection() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [showKey, setShowKey] = useState(false)
  const [rawKey, setRawKey] = useState<string | null>(null)

  const [forms, setForms] = useState<Record<string, Record<string, string | boolean>>>({})

  useEffect(() => {
    api.get<{ success: boolean; data: Integration[] }>('/settings/integrations')
      .then(res => {
        if (res.success) {
          setIntegrations(res.data ?? [])
          const initial: Record<string, Record<string, string | boolean>> = {}
          for (const intg of res.data ?? []) {
            initial[intg.service] = { webhookUrl: intg.webhookUrl ?? '', isActive: intg.isActive, label: intg.label ?? '', apiKey: '' }
          }
          setForms(initial)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const getIntg = (service: string) => integrations.find(i => i.service === service)
  const getForm = (service: string) => forms[service] ?? {}
  const setFormField = (service: string, key: string, value: string | boolean) =>
    setForms(f => ({ ...f, [service]: { ...f[service], [key]: value } }))

  const save = async (service: string, extra?: Record<string, string | boolean>) => {
    setSaving(service)
    try {
      const payload = { ...getForm(service), ...extra }
      const res = await api.put<{ success: boolean; data: Integration & { rawApiKey?: string } }>(`/settings/integrations/${service}`, payload)
      if (res.success) {
        setIntegrations(prev => {
          const exists = prev.find(i => i.service === service)
          if (exists) return prev.map(i => i.service === service ? { ...i, ...res.data } : i)
          return [...prev, res.data as Integration]
        })
        if (res.data?.rawApiKey) setRawKey(res.data.rawApiKey)
        toast.success('Integration saved')
      } else {
        toast.error('Failed to save')
      }
    } catch { toast.error('Failed to save') }
    finally { setSaving(null) }
  }

  const regenerateKey = () => save('api_key', { apiKey: 'regenerate' })

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}><Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} /></div>

  const serviceCards: { service: string; title: string; icon: string; description: string; hasApiKey: boolean; hasWebhook: boolean; hasLabel: boolean }[] = [
    { service: 'api_key', title: 'Internal API Key', icon: '🔑', description: 'Use this key to authenticate API requests to TOP JOBS from external tools.', hasApiKey: true, hasWebhook: false, hasLabel: false },
    { service: 'webhook', title: 'Webhooks', icon: '🔗', description: 'Receive real-time event notifications at your endpoint when timesheets, jobs, or invoices change.', hasApiKey: false, hasWebhook: true, hasLabel: true },
    { service: 'xero', title: 'Xero', icon: '💼', description: 'Sync invoices and financial data with Xero accounting software.', hasApiKey: true, hasWebhook: false, hasLabel: false },
    { service: 'slack', title: 'Slack', icon: '💬', description: 'Send notifications to a Slack channel for approvals, overdue invoices, and flagged timesheets.', hasApiKey: false, hasWebhook: true, hasLabel: true },
  ]

  return (
    <div>
      {/* Show raw API key banner */}
      {rawKey && (
        <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#854d0e', marginBottom: 4 }}>⚠️ Copy your API key now — it won't be shown again</div>
            <code style={{ fontSize: 13, background: '#fff', padding: '4px 10px', borderRadius: 6, border: '1px solid #fde047', userSelect: 'all', letterSpacing: 1 }}>{rawKey}</code>
          </div>
          <button onClick={() => setRawKey(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#854d0e' }}><X size={18} /></button>
        </div>
      )}

      {serviceCards.map(({ service, title, icon, description, hasApiKey, hasWebhook, hasLabel }) => {
        const intg = getIntg(service)
        const form = getForm(service)
        const isConnected = intg?.isActive ?? false
        const isSavingThis = saving === service

        return (
          <div key={service} style={card}>
            <div style={cardHead}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 24 }}>{icon}</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {title}
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: isConnected ? '#f0fdf4' : '#f9fafb', color: isConnected ? '#16a34a' : '#9ca3af' }}>
                      {isConnected ? '● Connected' : '○ Not connected'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#9ca3af', maxWidth: 400 }}>{description}</div>
                </div>
              </div>
              <Switch checked={form.isActive as boolean ?? false} onCheckedChange={v => setFormField(service, 'isActive', v)} />
            </div>
            <div style={cardBody}>
              {hasLabel && (
                <div style={{ marginBottom: 12 }}>
                  <label style={label}>Label / Channel</label>
                  <input style={{ ...inputStyle, maxWidth: 300 }} placeholder={service === 'slack' ? '#general' : 'My Webhook'} value={form.label as string ?? ''} onChange={e => setFormField(service, 'label', e.target.value)} />
                </div>
              )}
              {hasApiKey && (
                <div style={{ marginBottom: 12 }}>
                  <label style={label}>{service === 'api_key' ? 'API Key' : 'API Key / Client Secret'}</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
                      <input type={showKey ? 'text' : 'password'} style={{ ...inputStyle, paddingRight: 40 }} value={intg?.apiKey ? (showKey ? intg.apiKey : '••••••••' + (intg.apiKey.slice(-4) || '')) : (form.apiKey as string ?? '')} onChange={e => setFormField(service, 'apiKey', e.target.value)} placeholder={intg?.apiKey ? '(set)' : 'Paste API key here'} readOnly={service === 'api_key' && !!intg?.apiKey} />
                      {service === 'api_key' && intg?.apiKey && (
                        <button onClick={() => setShowKey(s => !s)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
                          {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      )}
                    </div>
                    {service === 'api_key' && (
                      <button onClick={regenerateKey} disabled={isSavingThis} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
                        <RefreshCw size={13} /> Regenerate
                      </button>
                    )}
                  </div>
                </div>
              )}
              {hasWebhook && (
                <div>
                  <label style={label}>Webhook URL</label>
                  <input style={{ ...inputStyle, maxWidth: 440 }} placeholder="https://hooks.example.com/..." value={form.webhookUrl as string ?? ''} onChange={e => setFormField(service, 'webhookUrl', e.target.value)} />
                </div>
              )}
            </div>
            <div style={cardFoot}>
              <button
                onClick={() => save(service)}
                disabled={isSavingThis}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', background: isSavingThis ? '#9ca3af' : '#1a1f36', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: isSavingThis ? 'not-allowed' : 'pointer' }}
              >
                {isSavingThis ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={14} />}
                {isSavingThis ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Danger Zone Section ───────────────────────────────────────────────────────

function DangerSection({ data }: { data: OrgSettings }) {
  const [confirmSlug, setConfirmSlug] = useState('')
  const [deactivating, setDeactivating] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await fetch(
        `${(import.meta as { env: Record<string, string> }).env.VITE_API_URL || 'https://top-backend-l2ax.onrender.com/api'}/settings/export`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('top_jwt_token')}` } }
      )
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `top-jobs-export-${data.orgSlug}-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Data exported successfully')
    } catch { toast.error('Export failed') }
    finally { setExporting(false) }
  }

  const handleDeactivate = async () => {
    if (confirmSlug !== data.orgSlug) { toast.error('Slug does not match'); return }
    setDeactivating(true)
    try {
      const res = await api.post<ApiResponse<{ message: string }>>('/settings/deactivate', { confirmSlug })
      if (res.success) {
        toast.success('Organisation deactivated')
        setShowModal(false)
      } else {
        toast.error('Deactivation failed')
      }
    } catch { toast.error('Deactivation failed') }
    finally { setDeactivating(false) }
  }

  return (
    <div>
      {/* Export */}
      <div style={{ ...card, border: '1px solid #fecaca' }}>
        <div style={cardHead}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, background: '#fff5f5', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Download size={18} style={{ color: '#ef4444' }} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Export All Data</div>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>Download a complete JSON export of all your organisation's data</div>
            </div>
          </div>
        </div>
        <div style={{ ...cardBody, background: '#fff5f5' }}>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 14 }}>This export includes all users, clients, jobs, tasks, timesheets, invoices, and settings. The file may be large for organisations with extensive data.</p>
          <button
            onClick={handleExport}
            disabled={exporting}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', background: '#fff', border: '1px solid #fecaca', borderRadius: 8, color: '#ef4444', fontSize: 13, fontWeight: 500, cursor: exporting ? 'not-allowed' : 'pointer' }}
          >
            {exporting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={14} />}
            {exporting ? 'Exporting…' : 'Export Data'}
          </button>
        </div>
      </div>

      {/* Deactivate */}
      <div style={{ ...card, border: '1px solid #fecaca' }}>
        <div style={cardHead}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, background: '#fff5f5', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={18} style={{ color: '#ef4444' }} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Deactivate Organisation</div>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>Set all users to inactive and close all open jobs</div>
            </div>
          </div>
        </div>
        <div style={{ ...cardBody, background: '#fff5f5' }}>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 14 }}>This will set all users to inactive and all open jobs to closed. <strong>No data is deleted.</strong> You can reactivate by contacting support.</p>
          <button
            onClick={() => setShowModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', background: '#ef4444', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
          >
            <AlertTriangle size={14} /> Deactivate Organisation
          </button>
        </div>
      </div>

      {/* Confirm Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, maxWidth: 420, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Confirm Deactivation</div>
            <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 18 }}>Type your organisation slug <strong style={{ color: '#111827' }}>{data.orgSlug}</strong> to confirm.</p>
            <input style={{ ...inputStyle, marginBottom: 16, border: '1px solid #fecaca' }} placeholder={data.orgSlug} value={confirmSlug} onChange={e => setConfirmSlug(e.target.value)} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowModal(false); setConfirmSlug('') }} style={{ padding: '8px 16px', background: '#f3f4f6', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button
                onClick={handleDeactivate}
                disabled={confirmSlug !== data.orgSlug || deactivating}
                style={{ padding: '8px 16px', background: confirmSlug === data.orgSlug ? '#ef4444' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: confirmSlug === data.orgSlug ? 'pointer' : 'not-allowed' }}
              >
                {deactivating ? 'Deactivating…' : 'Confirm Deactivation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function SettingsSkeleton() {
  return (
    <div style={{ ...card, padding: 24 }}>
      {[180, 120, 100].map((h, i) => (
        <div key={i} style={{ height: h, background: '#f3f4f6', borderRadius: 8, marginBottom: 16, animation: 'pulse 1.5s infinite' }} />
      ))}
    </div>
  )
}

// ── SaveButton ────────────────────────────────────────────────────────────────

function SaveButton({ saving, section, label: lbl = 'Save Changes', onClick }: { saving: SettingsSection | null; section: SettingsSection; label?: string; onClick?: () => void }) {
  const isSaving = saving === section
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isSaving}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px',
        background: isSaving ? '#9ca3af' : '#1a1f36', color: '#fff',
        border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500,
        cursor: isSaving ? 'not-allowed' : 'pointer',
      }}
    >
      {isSaving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={14} />}
      {isSaving ? 'Saving…' : lbl}
    </button>
  )
}

// ── Main Settings Component ───────────────────────────────────────────────────

export function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('organisation')
  const { data, taskTypes, loading, saving, save, createTaskType, updateTaskType, deleteTaskType, reorderTaskTypes } = useSettings()

  return (
    <div style={{ fontFamily: 'inherit' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1f36', margin: 0 }}>Settings</h1>
        <p style={{ fontSize: 13, color: '#6b7280', margin: '3px 0 0' }}>
          Manage your organisation's configuration
        </p>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        {/* Left nav */}
        <div style={{ width: 220, flexShrink: 0, position: 'sticky', top: 80 }}>
          <SettingsNav active={activeTab} onSelect={setActiveTab} />
        </div>

        {/* Right content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {loading ? (
            <SettingsSkeleton />
          ) : (
            <>
              {activeTab === 'organisation'  && <OrganisationSection data={data} saving={saving} onSave={save} />}
              {activeTab === 'localisation'  && <LocalisationSection data={data} saving={saving} onSave={save} />}
              {activeTab === 'notifications' && <NotificationsSection data={data} saving={saving} onSave={save} />}
              {activeTab === 'team'          && <TeamSection />}
              {activeTab === 'jobs'          && <JobsSection data={data} saving={saving} onSave={save} taskTypes={taskTypes} createTaskType={createTaskType} updateTaskType={updateTaskType} deleteTaskType={deleteTaskType} />}
              {activeTab === 'billing'       && <BillingSection data={data} saving={saving} onSave={save} />}
              {activeTab === 'integrations'  && <IntegrationsSection />}
              {activeTab === 'danger'        && <DangerSection data={data} />}
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </div>
  )
}