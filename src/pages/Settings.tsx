import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import {
  Building2, Globe, Users, Briefcase, DollarSign, Bell,
  Plug, AlertTriangle, Loader2, Check, Plus, Trash2,
  Download, Shield, ChevronRight,
  GripVertical, Edit2, X, Upload, Camera,
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
  borderRadius: 12,
  marginBottom: 20,
  overflow: 'hidden',
}

const cardHead: React.CSSProperties = {
  padding: '14px 16px',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: 10,
}

const cardBody: React.CSSProperties = { padding: '16px' }

const cardFoot: React.CSSProperties = {
  padding: '12px 16px',
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
  marginBottom: 6,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid #d1d5db',
  borderRadius: 8,
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
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
  const allItems = NAV_GROUPS.flatMap(g => g.items)
  return (
    <>
      {/* Desktop: vertical sidebar */}
      <div className="hidden md:block bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700" style={{ borderRadius: 12, overflow: 'hidden', padding: '8px 0' }}>
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="text-slate-400 dark:text-slate-500" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', padding: '12px 16px 4px' }}>
              {group.label}
            </div>
            {group.items.map((item) => {
              const isActive = active === item.id
              const isDanger = item.id === 'danger'
              return (
                <button
                  key={item.id}
                  onClick={() => onSelect(item.id)}
                  className={[
                    'w-full text-left flex items-center gap-2.5 px-4 py-2 border-none cursor-pointer text-[13px] font-medium transition-all duration-150',
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-r-2 border-blue-500'
                      : isDanger
                        ? 'bg-transparent text-red-500 border-r-2 border-transparent hover:bg-red-50 dark:hover:bg-red-900/20'
                        : 'bg-transparent text-slate-700 dark:text-slate-300 border-r-2 border-transparent hover:bg-slate-50 dark:hover:bg-slate-700/50',
                  ].join(' ')}
                >
                  <span className={
                    isActive ? 'text-blue-500' : isDanger ? 'text-red-500' : 'text-slate-400 dark:text-slate-500'
                  }>{item.icon}</span>
                  {item.label}
                  {isActive && <ChevronRight size={13} className="ml-auto text-blue-500" />}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {/* Mobile: horizontal scrollable tab bar */}
      <div className="md:hidden w-full overflow-x-auto hide-scrollbar bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700" style={{ borderRadius: 12 }}>
        <div style={{ display: 'flex', padding: '6px', gap: 4, minWidth: 'max-content' }}>
          {allItems.map((item) => {
            const isActive = active === item.id
            const isDanger = item.id === 'danger'
            return (
              <button
                key={item.id}
                onClick={() => onSelect(item.id)}
                className={[
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-none cursor-pointer text-xs font-semibold whitespace-nowrap transition-all duration-150',
                  isActive
                    ? isDanger
                      ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                      : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    : isDanger
                      ? 'bg-transparent text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                      : 'bg-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50',
                ].join(' ')}
              >
                <span className={
                  isActive ? (isDanger ? 'text-red-500' : 'text-blue-500') : isDanger ? 'text-red-400' : 'text-slate-400 dark:text-slate-500'
                }>{item.icon}</span>
                {item.label}
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}

// ── Organisation Section ──────────────────────────────────────────────────────

function OrganisationSection({ data, saving, onSave }: { data: OrgSettings; saving: SettingsSection | null; onSave: (s: SettingsSection, p: Partial<OrgSettings>) => Promise<boolean> }) {
  const { orgLogoUrl: storeLogoUrl, loadSettings } = useSettingsStore()
  const [form, setForm] = useState({ name: data.orgName, abn: data.abn ?? '', address: data.address ?? '', phone: data.phone ?? '', website: data.website ?? '', timezone: data.timezone })
  useEffect(() => { setForm({ name: data.orgName, abn: data.abn ?? '', address: data.address ?? '', phone: data.phone ?? '', website: data.website ?? '', timezone: data.timezone }) }, [data])

  const [logoUploading, setLogoUploading] = useState(false)
  const [logoRemoving, setLogoRemoving] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSave = async () => {
    const ok = await onSave('profile', { ...form })
    if (ok) toast.success('Organisation profile saved')
    else toast.error('Failed to save profile')
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return }
    if (file.size > 2 * 1024 * 1024) { toast.error('Image must be under 2 MB'); return }
    setLogoUploading(true)
    try {
      const formData = new FormData()
      formData.append('logo', file)
      const { api } = await import('@/lib/api')
      const res = await api.upload<{ success: boolean; data: { logoUrl: string } }>('/settings/logo', formData)
      if ((res as { success?: boolean }).success) {
        await loadSettings()
        toast.success('Logo uploaded')
      } else {
        toast.error('Upload failed')
      }
    } catch {
      toast.error('Upload failed')
    } finally {
      setLogoUploading(false)
      e.target.value = ''
    }
  }

  const handleLogoRemove = async () => {
    setLogoRemoving(true)
    try {
      const { api } = await import('@/lib/api')
      const res = await api.delete<{ success: boolean }>('/settings/logo')
      if ((res as { success?: boolean }).success) { await loadSettings(); toast.success('Logo removed') }
      else toast.error('Failed to remove logo')
    } catch { toast.error('Failed to remove logo') }
    finally { setLogoRemoving(false) }
  }

  const initials = form.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() || '??'
  const logoUrl = storeLogoUrl || data.logoUrl

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700" style={card}>
      <div className="border-b border-slate-100 dark:border-slate-700/50" style={cardHead}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, background: '#eff6ff', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Building2 size={18} style={{ color: '#3b82f6' }} />
          </div>
          <div>
            <div className="text-slate-900 dark:text-slate-100" style={{ fontSize: 15, fontWeight: 600 }}>Organisation Profile</div>
            <div className="text-slate-400 dark:text-slate-500" style={{ fontSize: 12 }}>Update your organisation's public details</div>
          </div>
        </div>
        {/* Logo preview */}
        <div style={{ width: 52, height: 52, borderRadius: 10, background: logoUrl ? '#f8fafc' : '#1a1f36', border: logoUrl ? '1px solid #e5e7eb' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#fff', flexShrink: 0, overflow: 'hidden', padding: logoUrl ? 4 : 0 }}>
          {logoUrl ? <img src={logoUrl} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : initials}
        </div>
      </div>
      <div style={cardBody}>
        <div className="modal-grid-2" style={fieldRow}>
          <div><label className="text-slate-700 dark:text-slate-300" style={label}>Company Name</label><input className="bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-600" style={inputStyle} value={form.name} onChange={set('name')} placeholder="Acme Pty Ltd" /></div>
          <div><label className="text-slate-700 dark:text-slate-300" style={label}>ABN / Tax ID</label><input className="bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-600" style={inputStyle} value={form.abn} onChange={set('abn')} placeholder="12 345 678 901" /></div>
        </div>
        <div style={{ marginBottom: 16 }}><label className="text-slate-700 dark:text-slate-300" style={label}>Address</label><input className="bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-600" style={inputStyle} value={form.address} onChange={set('address')} placeholder="123 Main St, Sydney NSW 2000" /></div>
        <div className="modal-grid-2" style={fieldRow}>
          <div><label className="text-slate-700 dark:text-slate-300" style={label}>Phone</label><input className="bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-600" style={inputStyle} value={form.phone} onChange={set('phone')} placeholder="+61 2 9000 0000" /></div>
          <div><label className="text-slate-700 dark:text-slate-300" style={label}>Website</label><input className="bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-600" style={inputStyle} value={form.website} onChange={set('website')} placeholder="https://example.com" /></div>
        </div>
        <div className="modal-grid-2" style={fieldRow}>
          <div>
            <label className="text-slate-700 dark:text-slate-300" style={label}>Timezone</label>
            <select className="bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-600" style={selectStyle} value={form.timezone} onChange={set('timezone')}>
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="text-slate-700 dark:text-slate-300" style={label}>Organisation Logo</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
              {/* Preview box */}
              <div style={{ width: 56, height: 56, borderRadius: 10, background: logoUrl ? '#f8fafc' : '#1a1f36', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#fff', flexShrink: 0, overflow: 'hidden', border: '2px solid #e5e7eb', padding: logoUrl ? 4 : 0 }}>
                {logoUrl ? <img src={logoUrl} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <span style={{ fontSize: 13 }}>{initials}</span>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={logoUploading}
                  className="bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: '1px solid', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: logoUploading ? 'not-allowed' : 'pointer', opacity: logoUploading ? 0.6 : 1 }}
                >
                  {logoUploading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Camera size={12} />}
                  {logoUploading ? 'Uploading…' : (logoUrl ? 'Change Logo' : 'Upload Logo')}
                </button>
                {logoUrl && (
                  <button
                    type="button"
                    onClick={handleLogoRemove}
                    disabled={logoRemoving}
                    className="border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 7, fontSize: 11, cursor: 'pointer' }}
                  >
                    {logoRemoving ? <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} /> : <X size={10} />}
                    Remove
                  </button>
                )}
              </div>
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            </div>
            <p className="text-slate-400 dark:text-slate-500" style={{ fontSize: 11, marginTop: 5 }}>PNG, JPG or SVG · max 2 MB</p>
          </div>
        </div>
      </div>
      <div className="border-t border-slate-100 dark:border-slate-700/50" style={cardFoot}><SaveButton saving={saving} section="profile" onClick={handleSave} /></div>
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
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700" style={card}>
      <div className="border-b border-slate-100 dark:border-slate-700/50" style={cardHead}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="bg-green-50 dark:bg-green-900/30" style={{ width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Globe size={18} style={{ color: '#22c55e' }} />
          </div>
          <div>
            <div className="text-slate-900 dark:text-slate-100" style={{ fontSize: 15, fontWeight: 600 }}>Localisation</div>
            <div className="text-slate-400 dark:text-slate-500" style={{ fontSize: 12 }}>Currency, date format, and number formatting</div>
          </div>
        </div>
        {/* Live preview */}
        <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300" style={{ borderRadius: 8, padding: '6px 14px', fontSize: 13 }}>
          <span className="text-slate-400 dark:text-slate-500" style={{ marginRight: 6 }}>Preview:</span>
          <strong>{previewAmount}</strong>
          <span className="text-slate-300 dark:text-slate-600" style={{ margin: '0 8px' }}>·</span>
          <strong>{form.dateFormat === 'DD/MM/YYYY' ? '25/02/2026' : form.dateFormat === 'MM/DD/YYYY' ? '02/25/2026' : '2026-02-25'}</strong>
        </div>
      </div>
      <div style={cardBody}>
        <div className="modal-grid-2" style={fieldRow}>
          <div>
            <label className="text-slate-700 dark:text-slate-300" style={label}>Currency</label>
            <select className="bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-600" style={selectStyle} value={form.currency} onChange={set('currency')}>
              {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-slate-700 dark:text-slate-300" style={label}>Date Format</label>
            <select className="bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-600" style={selectStyle} value={form.dateFormat} onChange={set('dateFormat')}>
              {DATE_FORMATS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-slate-700 dark:text-slate-300" style={label}>Number Format</label>
          <select className="bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-600" style={selectStyle} value={form.numberFormat} onChange={set('numberFormat')}>
            {NUMBER_FORMATS.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
          </select>
        </div>
      </div>
      <div className="border-t border-slate-100 dark:border-slate-700/50" style={cardFoot}><SaveButton saving={saving} section="localisation" onClick={handleSave} /></div>
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
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700" style={card}>
      <div className="border-b border-slate-100 dark:border-slate-700/50" style={cardHead}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="bg-orange-50 dark:bg-orange-900/20" style={{ width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bell size={18} style={{ color: '#f97316' }} />
          </div>
          <div>
            <div className="text-slate-900 dark:text-slate-100" style={{ fontSize: 15, fontWeight: 600 }}>Notifications</div>
            <div className="text-slate-400 dark:text-slate-500" style={{ fontSize: 12 }}>Configure which events trigger alerts</div>
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
          <input type="number" min={1} max={90} className="bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-600" style={{ ...inputStyle, width: 70 }} value={form.overdueInvoiceDays} onChange={e => setForm(f => ({ ...f, overdueInvoiceDays: Number(e.target.value) }))} />
          <span className="text-slate-500 dark:text-slate-400" style={{ fontSize: 13 }}>days</span>
        </div>
      </div>
      <div className="border-t border-slate-100 dark:border-slate-700/50" style={cardFoot}><SaveButton saving={saving} section="notifications" onClick={handleSave} /></div>
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
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700" style={card}>
        <div className="border-b border-slate-100 dark:border-slate-700/50" style={cardHead}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, background: '#f0f4ff', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={18} style={{ color: '#3b82f6' }} />
            </div>
            <div>
              <div className="text-slate-900 dark:text-slate-100" style={{ fontSize: 15, fontWeight: 600 }}>Team Members</div>
              <div className="text-slate-400 dark:text-slate-500" style={{ fontSize: 12 }}>{users.length} members · {departments.length} department{departments.length !== 1 ? 's' : ''}</div>
            </div>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          {loading ? (
            <div className="text-slate-400 dark:text-slate-500" style={{ padding: 40, textAlign: 'center' }}>
              <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} />
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60">
                  {['Name', 'Email', 'Role', 'Department', 'Status', ''].map(h => (
                    <th key={h} className="text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700" style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1a1f36', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>
                          {u.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                        </div>
                        <span className="text-slate-900 dark:text-slate-100" style={{ fontSize: 13, fontWeight: 500 }}>{u.name}</span>
                      </div>
                    </td>
                    <td className="text-slate-500 dark:text-slate-400" style={{ padding: '12px 16px', fontSize: 13 }}>{u.email}</td>
                    <td style={{ padding: '12px 16px' }}>
                      {editingRole === u.id ? (
                        <select
                          autoFocus
                          defaultValue={u.role}
                          onBlur={() => setEditingRole(null)}
                          onChange={e => handleRoleChange(u.id, e.target.value)}
                          className="bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-600" style={{ ...selectStyle, width: 'auto', fontSize: 12, padding: '4px 8px' }}
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
                    <td className="text-slate-500 dark:text-slate-400" style={{ padding: '12px 16px', fontSize: 13 }}>{u.department || '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className={u.status === 'active' ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'} style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
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
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700" style={card}>
          <div className="border-b border-slate-100 dark:border-slate-700/50" style={cardHead}>
            <div className="text-slate-900 dark:text-slate-100" style={{ fontSize: 14, fontWeight: 600 }}>Departments</div>
          </div>
          <div style={{ ...cardBody, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {departments.map(d => (
              <span key={d} className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300" style={{ padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 500 }}>{d}</span>
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
    blockSubmitUnderThreshold: data.blockSubmitUnderThreshold,
    blockSubmitOverThreshold: data.blockSubmitOverThreshold,
    hourlyCostRatio: data.hourlyCostRatio,
    requireClientForJob: data.requireClientForJob,
    managerScopedView: data.managerScopedView ?? false,
  })
  useEffect(() => setWf({
    dailyHoursThreshold: data.dailyHoursThreshold,
    flagUnderHours: data.flagUnderHours,
    flagOverHours: data.flagOverHours,
    flagJobOvertime: data.flagJobOvertime,
    blockSubmitUnderThreshold: data.blockSubmitUnderThreshold,
    blockSubmitOverThreshold: data.blockSubmitOverThreshold,
    hourlyCostRatio: data.hourlyCostRatio,
    requireClientForJob: data.requireClientForJob,
    managerScopedView: data.managerScopedView ?? false,
  }), [data])

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
      <div className="hide-scrollbar bg-slate-100 dark:bg-slate-800/60" style={{ display: 'flex', gap: 2, marginBottom: 24, padding: 4, borderRadius: 10, overflowX: 'auto' }}>
        {subTabs.map(t => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={subTab === t.key ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100' : 'text-slate-500 dark:text-slate-100 hover:text-slate-700 dark:hover:text-white'}
            style={{
              padding: '7px 14px', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', transition: 'all .15s', whiteSpace: 'nowrap', flexShrink: 0,
              background: subTab === t.key ? undefined : 'transparent',
              boxShadow: subTab === t.key ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Job Layouts tab ── */}
      {subTab === 'jobLayouts' && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700" style={card}>
          <div style={cardBody}>
            <LayoutBuilder
              title="Job Layouts"
              subtitle="Create reusable templates with custom fields for job creation. System dropdown options are customisable per layout."
              layouts={jobLayouts.layouts}
              loading={jobLayouts.loading}
              onCreate={async (name, customFields, isDefault, systemFieldOverrides) => {
                const r = await jobLayouts.create(name, customFields, isDefault, systemFieldOverrides)
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
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700" style={card}>
          <div style={cardBody}>
            <LayoutBuilder
              title="Task Layouts"
              subtitle="Create reusable templates with custom fields for task creation. System dropdown options are customisable per layout."
              layouts={taskLayouts.layouts}
              loading={taskLayouts.loading}
              onCreate={async (name, customFields, isDefault, systemFieldOverrides) => {
                const r = await taskLayouts.create(name, customFields, isDefault, systemFieldOverrides)
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
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700" style={card}>
            <div className="border-b border-slate-100 dark:border-slate-700/50" style={cardHead}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, background: '#faf5ff', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Briefcase size={18} style={{ color: '#8b5cf6' }} />
                </div>
                <div>
                  <div className="text-slate-900 dark:text-slate-100" style={{ fontSize: 15, fontWeight: 600 }}>Task Types</div>
                  <div className="text-slate-400 dark:text-slate-500" style={{ fontSize: 12 }}>Manage the catalog of task types used when creating tasks</div>
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
                <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700" style={{ borderRadius: 10, padding: 16, marginBottom: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <label className="text-slate-700 dark:text-slate-300" style={label}>Name</label>
                      <input className="bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-600" style={inputStyle} placeholder="e.g. Tax Return" value={newType.name} onChange={e => setNewType(f => ({ ...f, name: e.target.value }))} onKeyDown={e => e.key === 'Enter' && handleAddType()} autoFocus />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                      <div>
                        <label className="text-slate-700 dark:text-slate-300" style={label}>Colour</label>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                          {PRESET_COLORS.map(c => (
                            <button key={c} onClick={() => setNewType(f => ({ ...f, color: c }))} style={{ width: 24, height: 24, borderRadius: '50%', background: c, border: newType.color === c ? '3px solid #111' : '2px solid transparent', cursor: 'pointer' }} />
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-slate-700 dark:text-slate-300" style={label}>Billable</label>
                        <Switch checked={newType.billableByDefault} onCheckedChange={v => setNewType(f => ({ ...f, billableByDefault: v }))} />
                      </div>
                    </div>
                    <button onClick={handleAddType} style={{ padding: '8px 18px', background: '#1a1f36', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', alignSelf: 'flex-end' }}>
                      Add
                    </button>
                  </div>
                </div>
              )}

              {/* Task type list */}
              {activeTypes.length === 0 && !adding ? (
                <div className="text-slate-400 dark:text-slate-500" style={{ textAlign: 'center', padding: '32px 0', fontSize: 13 }}>
                  No task types yet. Click "Add Type" to create your first one.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {activeTypes.map(t => (
                    <div key={t.id} className={`border ${editingId === t.id ? 'bg-slate-50 dark:bg-slate-700/50' : 'bg-white dark:bg-slate-800'} border-slate-100 dark:border-slate-700/50`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 8 }}>
                      <GripVertical size={14} style={{ color: '#d1d5db', cursor: 'grab' }} />
                      {editingId === t.id ? (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <input className="bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-600" style={{ ...inputStyle }} value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} autoFocus />
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', gap: 4 }}>
                              {PRESET_COLORS.map(c => <button key={c} onClick={() => setEditForm(f => ({ ...f, color: c }))} style={{ width: 18, height: 18, borderRadius: '50%', background: c, border: editForm.color === c ? '2px solid #111' : '1px solid transparent', cursor: 'pointer' }} />)}
                            </div>
                            <Switch checked={editForm.billableByDefault} onCheckedChange={v => setEditForm(f => ({ ...f, billableByDefault: v }))} label="Billable" />
                            <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
                              <button onClick={() => handleEditSave(t.id)} style={{ padding: '4px 12px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}><Check size={12} /></button>
                              <button onClick={() => setEditingId(null)} className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300" style={{ padding: '4px 10px', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}><X size={12} /></button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
                          <span className="text-slate-900 dark:text-slate-100" style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{t.name}</span>
                          <span className={t.billableByDefault ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>
                            {t.billableByDefault ? 'Billable' : 'Non-billable'}
                          </span>
                          <button onClick={() => startEdit(t)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><Edit2 size={14} /></button>
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
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700" style={card}>
          <div className="border-b border-slate-100 dark:border-slate-700/50" style={cardHead}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="bg-orange-50 dark:bg-orange-900/20" style={{ width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Shield size={18} style={{ color: '#f97316' }} />
              </div>
              <div>
                <div className="text-slate-900 dark:text-slate-100" style={{ fontSize: 15, fontWeight: 600 }}>Approval Workflow</div>
                <div className="text-slate-400 dark:text-slate-500" style={{ fontSize: 12 }}>Configure timesheet flagging thresholds and job financial rules</div>
              </div>
            </div>
          </div>
          <div style={cardBody}>
            <div className="modal-grid-2" style={fieldRow}>
              <div>
                <label className="text-slate-700 dark:text-slate-300" style={label}>Daily Hours Threshold</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <input type="number" min={0} max={24} step={0.5} className="bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-600" style={{ ...inputStyle, width: 80, flexShrink: 0 }} value={wf.dailyHoursThreshold} onChange={e => setWf(f => ({ ...f, dailyHoursThreshold: Number(e.target.value) }))} />
                  <span className="text-slate-500 dark:text-slate-400" style={{ fontSize: 13 }}>hours/day before flagging</span>
                </div>
              </div>
              <div>
                <label className="text-slate-700 dark:text-slate-300" style={label}>Hourly Cost Ratio</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <input type="number" min={0} max={1} step={0.01} className="bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-600" style={{ ...inputStyle, width: 80, flexShrink: 0 }} value={wf.hourlyCostRatio} onChange={e => setWf(f => ({ ...f, hourlyCostRatio: Number(e.target.value) }))} />
                  <span className="text-slate-500 dark:text-slate-400" style={{ fontSize: 13 }}>e.g. 0.70 = 70% of revenue</span>
                </div>
              </div>
            </div>
            <Switch checked={wf.flagUnderHours} onCheckedChange={v => setWf(f => ({ ...f, flagUnderHours: v }))} label="Flag Under-Hours" description="Flag timesheets where daily total is below the threshold" />
            <Switch checked={wf.flagOverHours} onCheckedChange={v => setWf(f => ({ ...f, flagOverHours: v }))} label="Flag Over-Hours" description="Flag timesheets where daily total exceeds the threshold" />
            <Switch checked={wf.flagJobOvertime} onCheckedChange={v => setWf(f => ({ ...f, flagJobOvertime: v }))} label="Flag Job Overtime" description="Flag when total hours logged on a job exceed quoted hours" />
            <Switch checked={wf.blockSubmitUnderThreshold} onCheckedChange={v => setWf(f => ({ ...f, blockSubmitUnderThreshold: v }))} label="Block Submit if Under Threshold" description="Disable the timesheet submit button when hours are below the daily threshold" />
            <Switch checked={wf.blockSubmitOverThreshold} onCheckedChange={v => setWf(f => ({ ...f, blockSubmitOverThreshold: v }))} label="Block Submit if Over Threshold" description="Disable the timesheet submit button when hours exceed the daily threshold" />
            <Switch checked={wf.requireClientForJob} onCheckedChange={v => setWf(f => ({ ...f, requireClientForJob: v }))} label="Require Client for Job" description="Jobs must be linked to a client before creation" />
            <Switch checked={wf.managerScopedView} onCheckedChange={v => setWf(f => ({ ...f, managerScopedView: v }))} label="Manager Scoped View" description="When enabled, managers only see jobs assigned to them, tasks they created, and the related invoices and reports" />
          </div>
          <div className="border-t border-slate-100 dark:border-slate-700/50" style={cardFoot}><SaveButton saving={saving} section="workflow" onClick={handleWfSave} /></div>
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
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700" style={card}>
      <div className="border-b border-slate-100 dark:border-slate-700/50" style={cardHead}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, background: '#fefce8', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DollarSign size={18} style={{ color: '#eab308' }} />
          </div>
          <div>
            <div className="text-slate-900 dark:text-slate-100" style={{ fontSize: 15, fontWeight: 600 }}>Billing & Rates</div>
            <div className="text-slate-400 dark:text-slate-500" style={{ fontSize: 12 }}>Default rates, invoice settings, and tax configuration</div>
          </div>
        </div>
        {/* Invoice preview */}
        <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300" style={{ borderRadius: 8, padding: '6px 14px', fontSize: 13 }}>
          <span className="text-slate-400 dark:text-slate-500" style={{ marginRight: 6 }}>Next invoice:</span>
          <strong>{(form.invoicePrefix || 'INV').toUpperCase()}-0001</strong>
        </div>
      </div>
      <div style={cardBody}>
        <div className="modal-grid-2" style={fieldRow}>
          <div>
            <label className="text-slate-700 dark:text-slate-300" style={label}>Default Hourly Rate</label>
            <div style={{ position: 'relative' }}>
            <span className="text-slate-500 dark:text-slate-400" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14 }}>
  {currencySymbol}
</span>
              <input type="number" min={0} step={5} className="bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-600" style={{ ...inputStyle, paddingLeft: 26 }} value={form.defaultHourlyRate} onChange={e => setForm(f => ({ ...f, defaultHourlyRate: e.target.value }))} placeholder="150" />
            </div>
          </div>
          <div>
            <label className="text-slate-700 dark:text-slate-300" style={label}>Billing Increment</label>
            <select className="bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-600" style={selectStyle} value={form.billingIncrement} onChange={set('billingIncrement')}>
              <option value={6}>6 minutes</option>
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>60 minutes</option>
            </select>
          </div>
        </div>
        <div className="modal-grid-2" style={fieldRow}>
          <div>
            <label className="text-slate-700 dark:text-slate-300" style={label}>Default Tax Rate (%)</label>
            <div style={{ position: 'relative' }}>
              <input type="number" min={0} max={100} step={0.5} className="bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-600" style={{ ...inputStyle, paddingRight: 28 }} value={form.defaultTaxRate} onChange={set('defaultTaxRate')} />
              <span className="text-slate-500 dark:text-slate-400" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14 }}>%</span>
            </div>
          </div>
          <div>
            <label className="text-slate-700 dark:text-slate-300" style={label}>Invoice Number Prefix</label>
            <input className="bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-600" style={inputStyle} value={form.invoicePrefix} onChange={set('invoicePrefix')} placeholder="INV" maxLength={10} />
          </div>
        </div>
        <div style={{ maxWidth: '50%' }}>
          <label className="text-slate-700 dark:text-slate-300" style={label}>Payment Terms (days)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="number" min={1} max={365} className="bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-600" style={{ ...inputStyle, width: 80 }} value={form.invoicePaymentTermsDays} onChange={set('invoicePaymentTermsDays')} />
            <span className="text-slate-500 dark:text-slate-400" style={{ fontSize: 13 }}>days after invoice date</span>
          </div>
        </div>
      </div>
      <div className="border-t border-slate-100 dark:border-slate-700/50" style={cardFoot}><SaveButton saving={saving} section="billing" onClick={handleSave} /></div>
    </div>
  )
}

// ── Integrations Section ──────────────────────────────────────────────────────

function IntegrationsSection() {

  // ── Document Storage ──────────────────────────────────────────────────────
  const API_BASE_URL = (import.meta as { env: Record<string, string> }).env.VITE_API_URL || 'https://top-backend-l2ax.onrender.com/api'
  const [storageBackend, setStorageBackend] = useState<'db' | 'google' | 'onedrive'>('db')
  const [storageConnected, setStorageConnected] = useState<{ google: boolean; onedrive: boolean }>({ google: false, onedrive: false })
  const [storageSaving, setStorageSaving] = useState(false)
  const [storageLoading, setStorageLoading] = useState(true)

  // Per-provider permission toggles
  const [providerPerms, setProviderPerms] = useState({
    allowUserGoogleCalendar: true,
    allowUserMicrosoftCalendar: true,
    allowUserGoogleDrive: false,
    allowUserMicrosoftDrive: false,
  })
  const [savingPerm, setSavingPerm] = useState<string | null>(null)

  type StorageSettings = {
    storageBackend: string
    storageConfig?: { googleTokens?: unknown; microsoftTokens?: unknown } | null
    allowUserStorage?: boolean
    allowUserGoogleCalendar?: boolean
    allowUserMicrosoftCalendar?: boolean
    allowUserGoogleDrive?: boolean
    allowUserMicrosoftDrive?: boolean
  }

  const loadStorageSettings = useCallback(() => {
    return api.get<{ success: boolean; data: { settings: StorageSettings } }>('/settings')
      .then(res => {
        if (res.success && res.data?.settings) {
          const s = res.data.settings
          if (s.storageBackend) setStorageBackend(s.storageBackend as 'db' | 'google' | 'onedrive')
          setStorageConnected({
            google: !!s.storageConfig?.googleTokens,
            onedrive: !!s.storageConfig?.microsoftTokens,
          })
          setProviderPerms({
            allowUserGoogleCalendar:    typeof s.allowUserGoogleCalendar    === 'boolean' ? s.allowUserGoogleCalendar    : true,
            allowUserMicrosoftCalendar: typeof s.allowUserMicrosoftCalendar === 'boolean' ? s.allowUserMicrosoftCalendar : true,
            allowUserGoogleDrive:       typeof s.allowUserGoogleDrive       === 'boolean' ? s.allowUserGoogleDrive       : false,
            allowUserMicrosoftDrive:    typeof s.allowUserMicrosoftDrive    === 'boolean' ? s.allowUserMicrosoftDrive    : false,
          })
        }
      })
  }, [])

  const togglePerm = async (key: keyof typeof providerPerms) => {
    setSavingPerm(key)
    try {
      const next = !providerPerms[key]
      const res = await api.patch<{ success: boolean }>('/settings/storage', { [key]: next })
      if (res.success) {
        setProviderPerms(p => ({ ...p, [key]: next }))
        toast.success('Setting updated')
      } else {
        toast.error('Failed to update setting')
      }
    } catch { toast.error('Failed to update setting') }
    finally { setSavingPerm(null) }
  }

  useEffect(() => {
    loadStorageSettings().finally(() => setStorageLoading(false))
  }, [loadStorageSettings])

  // Handle redirect back from OAuth (Google/Microsoft post-connect)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const success = params.get('success')
    const error = params.get('error')
    if (success === 'google_drive') {
      toast.success('Google Drive connected successfully!')
      loadStorageSettings()
      window.history.replaceState({}, '', window.location.pathname)
    } else if (success === 'onedrive') {
      toast.success('OneDrive connected successfully!')
      loadStorageSettings()
      window.history.replaceState({}, '', window.location.pathname)
    } else if (error === 'oauth_failed') {
      toast.error('OAuth connection failed. Please try again.')
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [loadStorageSettings])

  const saveStorageBackend = async (backend: 'db' | 'google' | 'onedrive') => {
    setStorageSaving(true)
    try {
      const res = await api.put<{ success: boolean }>('/documents/storage/backend', { storageBackend: backend })
      if (res.success) {
        setStorageBackend(backend)
        toast.success('Storage backend updated')
      } else {
        toast.error('Failed to update storage backend')
      }
    } catch { toast.error('Failed to update storage backend') }
    finally { setStorageSaving(false) }
  }

  const connectGoogleDrive = () => {
    const token = localStorage.getItem('top_jwt_token')
    window.location.href = `${API_BASE_URL}/documents/oauth/google?token=${token}`
  }

  const connectOneDrive = () => {
    const token = localStorage.getItem('top_jwt_token')
    window.location.href = `${API_BASE_URL}/documents/oauth/microsoft?token=${token}`
  }

  const disconnectStorage = async (provider: 'google' | 'microsoft') => {
    setStorageSaving(true)
    try {
      const res = await api.delete<{ success: boolean }>(`/documents/storage/connection/${provider}`)
      if (res.success) {
        setStorageBackend('db')
        setStorageConnected(prev => ({
          ...prev,
          [provider === 'google' ? 'google' : 'onedrive']: false,
        }))
        toast.success(`${provider === 'google' ? 'Google Drive' : 'OneDrive'} disconnected`)
      } else {
        toast.error('Failed to disconnect')
      }
    } catch { toast.error('Failed to disconnect') }
    finally { setStorageSaving(false) }
  }

  return (
    <div>
      {/* ── Document Storage card ── */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700" style={card}>
        {/* <div style={cardHead}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 24 }}>🗄️</div>
            <div>
              <div className="text-slate-900 dark:text-slate-100" style={{ fontSize: 15, fontWeight: 600 }}>Document Storage</div>
              <div style={{ fontSize: 12, color: '#9ca3af', maxWidth: 440 }}>
                Choose where uploaded files are stored. Google Drive and OneDrive require OAuth connection.
              </div>
            </div>
          </div>
          {storageSaving && <Loader2 size={16} className="text-slate-500 dark:text-slate-400" style={{ animation: 'spin 1s linear infinite' }} />}
        </div> */}
        <div style={cardBody}>
          {storageLoading ? (
            <div className="text-slate-400 dark:text-slate-500" style={{ fontSize: 13 }}>Loading…</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              
            </div>
          )}

          {/* ── User Integration Permissions ── */}
          {!storageLoading && (() => {
            const permRows: { key: keyof typeof providerPerms; label: string; desc: string }[] = [
              { key: 'allowUserGoogleCalendar',    label: 'Allow Google Calendar',    desc: 'Let users connect their personal Google Calendar to sync meetings.' },
              { key: 'allowUserMicrosoftCalendar', label: 'Allow Microsoft Calendar', desc: 'Let users connect their Outlook/Microsoft Calendar to sync meetings.' },
              { key: 'allowUserGoogleDrive',       label: 'Allow Google Drive',       desc: 'Let users connect their personal Google Drive for file storage.' },
              { key: 'allowUserMicrosoftDrive',    label: 'Allow OneDrive',           desc: 'Let users connect their personal Microsoft OneDrive for file storage.' },
            ]
            return (
              <div className="border-t border-slate-200 dark:border-slate-700" style={{ marginTop: 16, paddingTop: 16 }}>
                <div className="text-slate-500 dark:text-slate-400" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                  User Integration Permissions
                </div>
                {permRows.map(({ key, label, desc }) => {
                  const enabled = providerPerms[key]
                  const saving = savingPerm === key
                  return (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 10 }}>
                      <div>
                        <div className="text-slate-900 dark:text-slate-100" style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
                        <div className="text-slate-400 dark:text-slate-500" style={{ fontSize: 12, marginTop: 1 }}>{desc}</div>
                      </div>
                      <button
                        onClick={() => togglePerm(key)}
                        disabled={saving}
                        style={{
                          flexShrink: 0,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 14px',
                          background: enabled ? '#6366f1' : '#f3f4f6',
                          color: enabled ? '#fff' : '#374151',
                          border: `1.5px solid ${enabled ? '#6366f1' : '#e5e7eb'}`,
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: saving ? 'not-allowed' : 'pointer',
                          transition: 'background .15s, color .15s',
                          opacity: saving ? 0.6 : 1,
                          minWidth: 80,
                        }}
                      >
                        {saving ? 'Saving…' : enabled ? '✓ Enabled' : 'Disabled'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      </div>

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
      a.download = `top-jobs-export-${data.orgSlug}-${new Date().toISOString().slice(0, 10)}.xlsx`
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
      <div className="bg-white dark:bg-slate-800" style={{ ...card, border: '1px solid #fecaca' }}>
        <div className="border-b border-slate-100 dark:border-slate-700/50" style={cardHead}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="bg-red-50 dark:bg-red-900/20" style={{ width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Download size={18} style={{ color: '#ef4444' }} />
            </div>
            <div>
              <div className="text-slate-900 dark:text-slate-100" style={{ fontSize: 15, fontWeight: 600 }}>Export All Data</div>
              <div className="text-slate-400 dark:text-slate-500" style={{ fontSize: 12 }}>Download a complete Excel export of all your organisation's data</div>
            </div>
          </div>
        </div>
        <div className="bg-red-50 dark:bg-red-950/20" style={cardBody}>
          <p className="text-slate-500 dark:text-slate-400" style={{ fontSize: 13, marginBottom: 14 }}>This export includes all users, clients, jobs, tasks, timesheets, invoices, attendance, leave, shifts, and more — each as a separate sheet. The file may be large for organisations with extensive data.</p>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="bg-white dark:bg-slate-800" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', border: '1px solid #fecaca', borderRadius: 8, color: '#ef4444', fontSize: 13, fontWeight: 500, cursor: exporting ? 'not-allowed' : 'pointer' }}
          >
            {exporting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={14} />}
            {exporting ? 'Exporting…' : 'Export Data'}
          </button>
        </div>
      </div>

      {/* Deactivate */}
      <div className="bg-white dark:bg-slate-800" style={{ ...card, border: '1px solid #fecaca' }}>
        <div className="border-b border-slate-100 dark:border-slate-700/50" style={cardHead}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="bg-red-50 dark:bg-red-900/20" style={{ width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={18} style={{ color: '#ef4444' }} />
            </div>
            <div>
              <div className="text-slate-900 dark:text-slate-100" style={{ fontSize: 15, fontWeight: 600 }}>Deactivate Organisation</div>
              <div className="text-slate-400 dark:text-slate-500" style={{ fontSize: 12 }}>Set all users to inactive and close all open jobs</div>
            </div>
          </div>
        </div>
        <div className="bg-red-50 dark:bg-red-950/20" style={cardBody}>
          <p className="text-slate-500 dark:text-slate-400" style={{ fontSize: 13, marginBottom: 14 }}>This will set all users to inactive and all open jobs to closed. <strong>No data is deleted.</strong> You can reactivate by contacting support.</p>
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
          <div className="bg-white dark:bg-slate-800" style={{ borderRadius: 14, padding: 28, maxWidth: 420, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div className="text-slate-900 dark:text-slate-100" style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Confirm Deactivation</div>
            <p className="text-slate-500 dark:text-slate-400" style={{ fontSize: 14, marginBottom: 18 }}>Type your organisation slug <strong className="text-slate-900 dark:text-slate-100">{data.orgSlug}</strong> to confirm.</p>
            <input className="bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" style={{ ...inputStyle, marginBottom: 16, border: '1px solid #fecaca' }} placeholder={data.orgSlug} value={confirmSlug} onChange={e => setConfirmSlug(e.target.value)} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowModal(false); setConfirmSlug('') }} className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300" style={{ padding: '8px 16px', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
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
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700" style={{ ...card, padding: 24 }}>
      {[180, 120, 100].map((h, i) => (
        <div key={i} className="bg-slate-100 dark:bg-slate-700" style={{ height: h, borderRadius: 8, marginBottom: 16, animation: 'pulse 1.5s infinite' }} />
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

  // Auto-switch to integrations tab when redirected back from OAuth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('section') === 'integrations') {
      setActiveTab('integrations')
    }
  }, [])

  return (
    <div style={{ fontFamily: 'inherit' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 className="text-slate-900 dark:text-slate-100" style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Settings</h1>
        <p className="text-slate-500 dark:text-slate-400" style={{ fontSize: 13, margin: '3px 0 0' }}>
          Manage your organisation's configuration
        </p>
      </div>

      {/* Mobile: horizontal tab bar */}
      <div className="md:hidden mb-4">
        <SettingsNav active={activeTab} onSelect={setActiveTab} />
      </div>

      {/* Two-column layout */}
      <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-start">
        {/* Left nav — desktop only */}
        <div className="hidden md:block md:w-[220px] md:flex-shrink-0 md:sticky md:top-20">
          <SettingsNav active={activeTab} onSelect={setActiveTab} />
        </div>

        {/* Right content */}
        <div className="flex-1 min-w-0 w-full">
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