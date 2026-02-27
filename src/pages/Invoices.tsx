import { useState, useRef } from 'react'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { useInvoices } from '@/hooks/useInvoices'
import { useJobs } from '@/hooks/useJobs'
import { useAuthStore } from '@/store/authStore'
import { useSettings } from '@/hooks/useSettings' // Replace with useSettings
import { Modal } from '@/components/ui/Modal'
import { toast } from 'sonner'
import {
  Plus, Search, Eye, FileText, Trash2, Check,
  Download, Send, DollarSign, Clock, AlertCircle, X,
} from 'lucide-react'
import type { Invoice, InvoiceLineItem, InvoiceStatus } from '@/types'

// ── Helpers ──────────────────────────────────────────────────────────────────

// Make formatter factory function that takes currency and symbol
function makeFmt(currency: string, symbol: string) {
  return (n: number) =>
    new Intl.NumberFormat('en-AU', { 
      style: 'currency', 
      currency, 
      currencyDisplay: 'symbol',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    }).format(n).replace(currency, symbol)
}

function fmtDate(d: string, format: string = 'DD/MM/YYYY') {
  if (!d) return '—'
  const date = new Date(d)
  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const year = date.getFullYear()
  
  switch(format) {
    case 'MM/DD/YYYY':
      return `${month}/${day}/${year}`
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`
    case 'DD/MM/YYYY':
    default:
      return `${day}/${month}/${year}`
  }
}

function isOverdue(inv: Invoice) {
  if (inv.status === 'paid' || inv.status === 'cancelled') return false
  return new Date(inv.dueDate) < new Date()
}

const statusConfig: Record<InvoiceStatus, { label: string; color: string; bg: string; dot: string }> = {
  draft:     { label: 'Draft',     color: '#6b7280', bg: '#f3f4f6', dot: '#9ca3af' },
  sent:      { label: 'Sent',      color: '#2563eb', bg: '#eff6ff', dot: '#3b82f6' },
  paid:      { label: 'Paid',      color: '#16a34a', bg: '#f0fdf4', dot: '#22c55e' },
  overdue:   { label: 'Overdue',   color: '#dc2626', bg: '#fef2f2', dot: '#ef4444' },
  cancelled: { label: 'Cancelled', color: '#64748b', bg: '#f8fafc', dot: '#94a3b8' },
}

function StatusPill({ status }: { status: InvoiceStatus }) {
  const cfg = statusConfig[status] ?? statusConfig.draft
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11, fontWeight: 700, color: cfg.color, background: cfg.bg,
      padding: '3px 10px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, display: 'inline-block' }} />
      {cfg.label}
    </span>
  )
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon, color }: { label: string; value: string; sub: string; icon: React.ReactNode; color: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ width: 44, height: 44, borderRadius: 10, background: color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1f36', lineHeight: 1.2 }}>{value}</div>
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{label}</div>
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{sub}</div>
      </div>
    </div>
  )
}

// ── Generate Invoice Number ──────────────────────────────────────────────────

function generateInvoiceNumber(prefix: string, lastNumber: number): string {
  const nextNumber = (lastNumber + 1).toString().padStart(5, '0')
  return `${prefix}-${nextNumber}`
}

// ── Calculate Due Date ───────────────────────────────────────────────────────

function calculateDueDate(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

// ── Round Hours Based on Billing Increment ───────────────────────────────────

function roundHours(hours: number, increment: number): number {
  const incrementHours = increment / 60
  return Math.ceil(hours / incrementHours) * incrementHours
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function Invoices() {
  const { invoices, loading, refetch, createInvoice, updateInvoice, updateStatus, deleteInvoice } = useInvoices()
  const { jobs } = useJobs()
  const { user } = useAuthStore()
  const { data: settings } = useSettings() // Get all settings

  // Extract all needed settings
  const currency = settings.currency
  const currencySymbol = settings.currencySymbol
  const dateFormat = settings.dateFormat
  const defaultTaxRate = settings.defaultTaxRate
  const invoicePrefix = settings.invoicePrefix
  const paymentTermsDays = settings.invoicePaymentTermsDays
  const billingIncrement = settings.billingIncrement
  const defaultHourlyRate = settings.defaultHourlyRate

  // Create currency formatter with symbol
  const fmt = (n: number) => makeFmt(currency, currencySymbol)(n)

  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null)
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null)

  // Derive effective status (check overdue)
  const enriched = invoices.map(inv => ({
    ...inv,
    status: (inv.status === 'sent' && isOverdue(inv) ? 'overdue' : inv.status) as InvoiceStatus,
  }))

  const filtered = enriched.filter(inv => {
    const matchStatus = statusFilter === 'all' || inv.status === statusFilter
    const matchSearch = !search ||
      inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      inv.clientCompany.toLowerCase().includes(search.toLowerCase()) ||
      (inv.jobTitle ?? '').toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  // Stat calculations
  const totalBilled = enriched.reduce((s, i) => s + i.total, 0)
  const totalPaid = enriched.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0)
  const totalOutstanding = enriched.filter(i => i.status === 'sent' || i.status === 'overdue').reduce((s, i) => s + i.total, 0)
  const totalOverdue = enriched.filter(i => i.status === 'overdue').reduce((s, i) => s + i.total, 0)
  const countPaid = enriched.filter(i => i.status === 'paid').length
  const countOutstanding = enriched.filter(i => i.status === 'sent' || i.status === 'overdue').length
  const countOverdue = enriched.filter(i => i.status === 'overdue').length

  const handleStatusChange = async (inv: Invoice, newStatus: InvoiceStatus) => {
    const ok = await updateStatus(inv.id, newStatus)
    if (ok) toast.success(`Invoice marked as ${newStatus}`)
    else toast.error('Failed to update status')
  }

  const handleDelete = async (inv: Invoice) => {
    if (!window.confirm(`Delete ${inv.invoiceNumber}? This cannot be undone.`)) return
    const ok = await deleteInvoice(inv.id)
    if (ok) toast.success('Invoice deleted')
    else toast.error('Cannot delete — only Draft invoices can be deleted')
  }

  const statusFilters = ['all', 'draft', 'sent', 'paid', 'overdue', 'cancelled']

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, gap: 10, color: '#6b7280' }}>
      <div style={{ width: 20, height: 20, border: '2px solid #e5e7eb', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      Loading invoices…
    </div>
  )

  return (
    <div style={{ fontFamily: 'inherit' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1a1f36', margin: 0 }}>Invoices</h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '3px 0 0' }}>{enriched.length} invoice{enriched.length !== 1 ? 's' : ''} total</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
        >
          <Plus size={16} /> New Invoice
        </button>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        <StatCard label="Total Billed" value={fmt(totalBilled)} sub={`${enriched.length} invoices`} icon={<FileText size={20} />} color="#2563eb" />
        <StatCard label="Collected" value={fmt(totalPaid)} sub={`${countPaid} paid`} icon={<Check size={20} />} color="#16a34a" />
        <StatCard label="Outstanding" value={fmt(totalOutstanding)} sub={`${countOutstanding} invoices`} icon={<Clock size={20} />} color="#f59e0b" />
        <StatCard label="Overdue" value={fmt(totalOverdue)} sub={`${countOverdue} overdue`} icon={<AlertCircle size={20} />} color="#dc2626" />
      </div>

      {/* Table card */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #f1f3f9', flexWrap: 'wrap', gap: 10 }}>
          {/* Status filters */}
          <div style={{ display: 'flex', gap: 4, background: '#f3f4f6', borderRadius: 8, padding: 3 }}>
            {statusFilters.map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                style={{
                  padding: '5px 13px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  background: statusFilter === s ? '#fff' : 'transparent',
                  color: statusFilter === s ? '#1a1f36' : '#6b7280',
                  boxShadow: statusFilter === s ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
                  textTransform: 'capitalize',
                }}
              >{s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}</button>
            ))}
          </div>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
            <input
              placeholder="Search invoices…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 32, paddingRight: 12, paddingTop: 8, paddingBottom: 8, border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 13, outline: 'none', width: 220 }}
            />
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Invoice #', 'Client', 'Job', 'Issue Date', 'Due Date', `Amount (${currency})`, 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '11px 18px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '56px 18px', color: '#9ca3af', fontSize: 14 }}>
                    <FileText size={32} style={{ marginBottom: 10, opacity: 0.3, display: 'block', margin: '0 auto 10px' }} />
                    {search || statusFilter !== 'all' ? 'No invoices match your filters' : 'No invoices yet. Create your first invoice!'}
                  </td>
                </tr>
              ) : filtered.map((inv, i) => (
                <tr key={inv.id} style={{ borderTop: '1px solid #f1f3f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ padding: '13px 18px', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1f36', fontFamily: 'monospace' }}>{inv.invoiceNumber}</span>
                  </td>
                  <td style={{ padding: '13px 18px' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1f36' }}>{inv.clientCompany}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{inv.clientEmail}</div>
                  </td>
                  <td style={{ padding: '13px 18px' }}>
                    <div style={{ fontSize: 13, color: '#374151' }}>{inv.jobTitle}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>{inv.jobRef}</div>
                  </td>
                  <td style={{ padding: '13px 18px', fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>{fmtDate(inv.issueDate, dateFormat)}</td>
                  <td style={{ padding: '13px 18px', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: 13, color: inv.status === 'overdue' ? '#dc2626' : '#6b7280', fontWeight: inv.status === 'overdue' ? 600 : 400 }}>{fmtDate(inv.dueDate, dateFormat)}</span>
                  </td>
                  <td style={{ padding: '13px 18px', whiteSpace: 'nowrap' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1f36' }}>{fmt(inv.total)}</div>
                    {inv.taxRate > 0 && <div style={{ fontSize: 11, color: '#9ca3af' }}>incl. GST {fmt(inv.taxAmount)}</div>}
                  </td>
                  <td style={{ padding: '13px 18px' }}><StatusPill status={inv.status} /></td>
                  <td style={{ padding: '13px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {/* View */}
                      <button onClick={() => setViewInvoice(inv)} title="View Invoice" style={actionBtn}>
                        <Eye size={14} />
                      </button>
                      {/* Edit (draft only) */}
                      {inv.status === 'draft' && (
                        <button onClick={() => setEditInvoice(inv)} title="Edit Invoice" style={actionBtn}>
                          <FileText size={14} />
                        </button>
                      )}
                      {/* Quick status */}
                      {inv.status === 'draft' && (
                        <button onClick={() => handleStatusChange(inv, 'sent')} title="Mark Sent" style={{ ...actionBtn, color: '#2563eb', borderColor: '#bfdbfe' }}>
                          <Send size={14} />
                        </button>
                      )}
                      {(inv.status === 'sent' || inv.status === 'overdue') && (
                        <button onClick={() => handleStatusChange(inv, 'paid')} title="Mark Paid" style={{ ...actionBtn, color: '#16a34a', borderColor: '#bbf7d0' }}>
                          <DollarSign size={14} />
                        </button>
                      )}
                      {/* Delete (draft only, admin) */}
                      {inv.status === 'draft' && user?.role === 'admin' && (
                        <button onClick={() => handleDelete(inv)} title="Delete" style={{ ...actionBtn, color: '#dc2626', borderColor: '#fecaca' }}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {showCreate && (
        <CreateInvoiceModal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          jobs={jobs}
          currency={currency}
          currencySymbol={currencySymbol}
          defaultTaxRate={defaultTaxRate}
          defaultDueDate={calculateDueDate(paymentTermsDays)}
          invoicePrefix={invoicePrefix}
          billingIncrement={billingIncrement}
          defaultHourlyRate={defaultHourlyRate}
          onCreated={async (data) => {
            const inv = await createInvoice(data)
            if (inv) { toast.success(`Invoice ${inv.invoiceNumber} created`); setShowCreate(false); setViewInvoice(inv) }
            else toast.error('Failed to create invoice')
          }}
        />
      )}

      {viewInvoice && (
        <InvoicePreviewModal
          open={!!viewInvoice}
          invoice={viewInvoice}
          currency={currency}
          currencySymbol={currencySymbol}
          dateFormat={dateFormat}
          onClose={() => setViewInvoice(null)}
          onStatusChange={async (status) => {
            const ok = await updateStatus(viewInvoice.id, status)
            if (ok) {
              toast.success(`Marked as ${status}`)
              setViewInvoice({ ...viewInvoice, status })
            } else toast.error('Failed to update status')
          }}
        />
      )}

      {editInvoice && (
        <EditInvoiceModal
          open={!!editInvoice}
          invoice={editInvoice}
          currency={currency}
          currencySymbol={currencySymbol}
          dateFormat={dateFormat}
          onClose={() => setEditInvoice(null)}
          onSave={async (data) => {
            const ok = await updateInvoice(editInvoice.id, data)
            if (ok) { toast.success('Invoice updated'); setEditInvoice(null); refetch() }
            else toast.error('Failed to update invoice')
          }}
        />
      )}
    </div>
  )
}

const actionBtn: React.CSSProperties = {
  padding: '5px 8px', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff',
  color: '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center',
}

// ── Create Invoice Modal ──────────────────────────────────────────────────────

interface CreateInvoiceModalProps {
  open: boolean
  onClose: () => void
  jobs: Array<{ id: string; jobId: string; title: string; clientName: string; status: string; billingType: string; billingRate: number; actualHours: number; revenue?: number }>
  currency: string
  currencySymbol: string
  defaultTaxRate: number
  defaultDueDate: string
  invoicePrefix: string
  billingIncrement: number
  defaultHourlyRate: number | null
  onCreated: (data: { jobId: string; taxRate: number; dueDate: string; notes: string; lineItems: InvoiceLineItem[] }) => void
}

function CreateInvoiceModal({ 
  open, 
  onClose, 
  jobs, 
  currency, 
  currencySymbol,
  defaultTaxRate,
  defaultDueDate,
  invoicePrefix,
  billingIncrement,
  defaultHourlyRate,
  onCreated 
}: CreateInvoiceModalProps) {
  const [step, setStep] = useState(1)
  const [jobId, setJobId] = useState('')
  const [taxRate, setTaxRate] = useState(defaultTaxRate)
  const [dueDate, setDueDateVal] = useState(defaultDueDate)
  const [notes, setNotes] = useState(`Payment is due within ${defaultDueDate} days of issue. Please include the invoice number on your payment.`)
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([])

  // Create currency formatter
  const fmt = (n: number) => makeFmt(currency, currencySymbol)(n)

  const availableJobs = jobs.filter(j => j.status !== 'invoiced' && j.status !== 'closed' && j.status !== 'cancelled')
  const selectedJob = jobs.find(j => j.id === jobId)

  const autoLineItems = (): InvoiceLineItem[] => {
    if (!selectedJob) return []
    
    // Round hours based on billing increment if hourly
    const qty = selectedJob.billingType === 'fixed' 
      ? 1 
      : roundHours(selectedJob.actualHours, billingIncrement)
    
    const rate = selectedJob.billingType === 'fixed'
      ? selectedJob.billingRate
      : (defaultHourlyRate || selectedJob.billingRate)
    
    const amount = selectedJob.billingType === 'fixed'
      ? selectedJob.billingRate
      : qty * rate

    return [{
      description: selectedJob.billingType === 'fixed'
        ? `${selectedJob.title} – Fixed Price`
        : `${selectedJob.title} – Hourly Service`,
      qty,
      rate,
      amount,
    }]
  }

  const handleJobSelect = (id: string) => {
    setJobId(id)
    setLineItems([])
  }

  const handleNext = () => {
    if (!jobId) { toast.error('Please select a job'); return }
    setLineItems(autoLineItems())
    setStep(2)
  }

  const subtotal = lineItems.reduce((s, l) => s + l.amount, 0)
  const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100
  const total = subtotal + taxAmount

  const updateLine = (i: number, field: keyof InvoiceLineItem, val: string | number) => {
    setLineItems(prev => prev.map((l, idx) => {
      if (idx !== i) return l
      const updated = { ...l, [field]: val }
      if (field === 'qty' || field === 'rate') updated.amount = Number(updated.qty) * Number(updated.rate)
      return updated
    }))
  }

  const addLine = () => setLineItems(prev => [...prev, { description: '', qty: 1, rate: defaultHourlyRate || 0, amount: defaultHourlyRate || 0 }])
  const removeLine = (i: number) => setLineItems(prev => prev.filter((_, idx) => idx !== i))

  const handleCreate = () => {
    if (!jobId) { toast.error('Please select a job'); return }
    if (lineItems.length === 0) { toast.error('At least one line item is required'); return }
    onCreated({ jobId, taxRate, dueDate, notes, lineItems })
  }

  const steps = [{ num: 1, label: 'Select Job' }, { num: 2, label: 'Invoice Details' }]

  const darkInput: React.CSSProperties = {
    width: '100%', padding: '10px 13px', background: '#1e2d4a', border: '1px solid #2d4068',
    borderRadius: 8, color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box',
  }
  const lbl: React.CSSProperties = { fontSize: 12, color: '#94a3b8', fontWeight: 500, marginBottom: 5, display: 'block' }

  return (
    <Modal open={open} onClose={() => { onClose(); setStep(1) }} title="" size="xl">
      <div className="modal-flex" style={{ background: '#152035', borderRadius: 12, margin: -24, padding: 0, display: 'flex', overflow: 'hidden' }}>
        {/* Sidebar */}
        <div className="modal-sidebar" style={{ width: 190, background: '#0f1a2e', padding: '32px 20px', flexShrink: 0 }}>
          <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 18, marginBottom: 32 }}>New Invoice</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            {steps.map(s => (
              <div key={s.num} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, fontSize: 13, fontWeight: 700,
                  background: step > s.num ? '#16a34a' : step === s.num ? '#2563eb' : '#1e2d4a',
                  color: '#fff', border: step === s.num ? '2px solid #3b82f6' : 'none',
                }}>
                  {step > s.num ? <Check size={14} /> : s.num}
                </div>
                <span style={{ fontSize: 13, color: step === s.num ? '#fff' : '#64748b', fontWeight: step === s.num ? 600 : 400 }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Form area */}
        <div style={{ flex: 1, padding: '32px 28px', display: 'flex', flexDirection: 'column' }}>
          {step === 1 && (
            <div style={{ flex: 1 }}>
              <h3 style={{ color: '#fff', fontWeight: 600, fontSize: 16, marginBottom: 22 }}>Select a Job</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={lbl}>Job <span style={{ color: '#ef4444' }}>*</span></label>
                  <select style={{ ...darkInput, cursor: 'pointer' }} value={jobId} onChange={e => handleJobSelect(e.target.value)}>
                    <option value="">Select job…</option>
                    {availableJobs.map(j => (
                      <option key={j.id} value={j.id}>{j.jobId} — {j.title} ({j.clientName})</option>
                    ))}
                  </select>
                </div>
                {selectedJob && (
                  <div style={{ background: '#1e2d4a', border: '1px solid #2d4068', borderRadius: 10, padding: 16 }}>
                    <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Job Preview</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {[
                        { label: 'Client', value: selectedJob.clientName },
                        { label: 'Billing Type', value: selectedJob.billingType === 'fixed' ? 'Fixed Price' : 'Hourly' },
                        { label: 'Rate', value: `${selectedJob.billingRate}/hr` },
                        { label: 'Hours', value: `${selectedJob.actualHours}h (rounded to ${billingIncrement}min)` },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>{label}</div>
                          <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 500 }}>{value}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 14, borderTop: '1px solid #2d4068', paddingTop: 12 }}>
                      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Auto-generated line item</div>
                      <div style={{ fontSize: 13, color: '#60a5fa' }}>{autoLineItems()[0]?.description}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#4ade80', marginTop: 4 }}>
                        {fmt(autoLineItems()[0]?.amount ?? 0)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>
              <h3 style={{ color: '#fff', fontWeight: 600, fontSize: 16, margin: 0 }}>Invoice Details</h3>

              {/* Due date + Tax */}
              <div className="modal-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={lbl}>Due Date</label>
                  <input style={darkInput} type="date" value={dueDate} onChange={e => setDueDateVal(e.target.value)} />
                </div>
                <div>
                  <label style={lbl}>Tax Rate (%)</label>
                  <input style={darkInput} type="number" min={0} max={100} value={taxRate} onChange={e => setTaxRate(Number(e.target.value))} placeholder={defaultTaxRate.toString()} />
                </div>
              </div>

              {/* Line items */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <label style={{ ...lbl, margin: 0 }}>Line Items</label>
                  <button onClick={addLine} style={{ fontSize: 12, color: '#60a5fa', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Plus size={13} /> Add Row
                  </button>
                </div>
                <div style={{ background: '#1e2d4a', borderRadius: 8, overflow: 'hidden', border: '1px solid #2d4068' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#172236' }}>
                        {['Description', 'Qty', `Rate (${currency})`, `Amount (${currency})`, ''].map(h => (
                          <th key={h} style={{ padding: '8px 10px', fontSize: 10, fontWeight: 700, color: '#64748b', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {lineItems.map((line, i) => (
                        <tr key={i} style={{ borderTop: '1px solid #253451' }}>
                          <td style={{ padding: '6px 8px' }}>
                            <input value={line.description} onChange={e => updateLine(i, 'description', e.target.value)}
                              style={{ ...darkInput, padding: '6px 8px', fontSize: 12, background: 'transparent', border: 'none', borderRadius: 4 }} />
                          </td>
                          <td style={{ padding: '6px 8px', width: 70 }}>
                            <input type="number" step="0.25" value={line.qty} onChange={e => updateLine(i, 'qty', Number(e.target.value))}
                              style={{ ...darkInput, padding: '6px 8px', fontSize: 12, background: 'transparent', border: 'none', width: 60 }} />
                          </td>
                          <td style={{ padding: '6px 8px', width: 90 }}>
                            <input type="number" step="0.01" value={line.rate} onChange={e => updateLine(i, 'rate', Number(e.target.value))}
                              style={{ ...darkInput, padding: '6px 8px', fontSize: 12, background: 'transparent', border: 'none', width: 80 }} />
                          </td>
                          <td style={{ padding: '6px 8px', fontSize: 13, fontWeight: 600, color: '#e2e8f0', whiteSpace: 'nowrap' }}>{fmt(line.amount)}</td>
                          <td style={{ padding: '6px 8px' }}>
                            {lineItems.length > 1 && (
                              <button onClick={() => removeLine(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex' }}>
                                <X size={13} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {/* Totals */}
                  <div style={{ padding: '12px 14px', borderTop: '1px solid #253451', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>Subtotal: <strong style={{ color: '#e2e8f0' }}>{fmt(subtotal)}</strong></div>
                    {taxRate > 0 && <div style={{ fontSize: 12, color: '#94a3b8' }}>GST ({taxRate}%): <strong style={{ color: '#e2e8f0' }}>{fmt(taxAmount)}</strong></div>}
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#4ade80' }}>Total: {fmt(total)}</div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label style={lbl}>Notes / Payment Terms</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                  style={{ ...darkInput, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }} />
              </div>
            </div>
          )}

          {/* Nav */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
            {step > 1 && (
              <button onClick={() => setStep(1)} style={{ padding: '10px 22px', border: '1px solid #2d4068', borderRadius: 8, background: 'transparent', color: '#94a3b8', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>BACK</button>
            )}
            <button onClick={onClose} style={{ padding: '10px 22px', border: '1px solid #2d4068', borderRadius: 8, background: 'transparent', color: '#94a3b8', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>CANCEL</button>
            {step < 2 ? (
              <button onClick={handleNext} style={{ padding: '10px 28px', border: 'none', borderRadius: 8, background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>NEXT</button>
            ) : (
              <button onClick={handleCreate} style={{ padding: '10px 28px', border: 'none', borderRadius: 8, background: '#16a34a', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>CREATE INVOICE</button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ── Invoice Preview Modal (A4-style, printable) ───────────────────────────────

interface InvoicePreviewModalProps {
  open: boolean
  invoice: Invoice
  currency: string
  currencySymbol: string
  dateFormat: string
  onClose: () => void
  onStatusChange: (status: InvoiceStatus) => void
}

function InvoicePreviewModal({ open, invoice, currency, currencySymbol, dateFormat, onClose, onStatusChange }: InvoicePreviewModalProps) {
  const printRef = useRef<HTMLDivElement>(null)
  const [downloading, setDownloading] = useState(false)

  // Create currency formatter
  const fmt = (n: number) => makeFmt(currency, currencySymbol)(n)

  const handleDownloadPDF = async () => {
    if (!printRef.current) return
    setDownloading(true)
    try {
      const el = printRef.current
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const ratio = canvas.width / canvas.height
      const pdfH = pageW / ratio
      // If content fits on one page
      if (pdfH <= pageH) {
        pdf.addImage(imgData, 'PNG', 0, 0, pageW, pdfH)
      } else {
        // Multi-page support
        let yPos = 0
        const pageImgH = (pageH * canvas.width) / pageW
        while (yPos < canvas.height) {
          const pageCanvas = document.createElement('canvas')
          pageCanvas.width = canvas.width
          pageCanvas.height = Math.min(pageImgH, canvas.height - yPos)
          const ctx = pageCanvas.getContext('2d')
          ctx?.drawImage(canvas, 0, -yPos, canvas.width, canvas.height)
          pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', 0, 0, pageW, (pageCanvas.height * pageW) / canvas.width)
          yPos += pageImgH
          if (yPos < canvas.height) pdf.addPage()
        }
      }
      pdf.save(`${invoice.invoiceNumber}.pdf`)
      toast.success(`${invoice.invoiceNumber}.pdf downloaded`)
    } catch (err) {
      console.error('PDF generation failed:', err)
      toast.error('Failed to generate PDF')
    } finally {
      setDownloading(false)
    }
  }

  const inv = invoice

  return (
    <Modal open={open} onClose={onClose} title="" size="full">
      <div style={{ margin: -24, background: '#f1f5f9' }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', background: '#1a1f36', borderBottom: '1px solid #2d3748' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>{inv.invoiceNumber}</span>
            <StatusPill status={inv.status} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {inv.status === 'draft' && (
              <button onClick={() => onStatusChange('sent')} style={previewBtn('#2563eb')}>
                <Send size={14} /> Mark Sent
              </button>
            )}
            {(inv.status === 'sent' || inv.status === 'overdue') && (
              <button onClick={() => onStatusChange('paid')} style={previewBtn('#16a34a')}>
                <DollarSign size={14} /> Mark Paid
              </button>
            )}
            <button onClick={handleDownloadPDF} disabled={downloading} style={{ ...previewBtn('#374151'), opacity: downloading ? 0.7 : 1 }}>
              <Download size={14} /> {downloading ? 'Generating…' : 'Download PDF'}
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* A4 Invoice */}
        <div style={{ padding: '32px 24px', display: 'flex', justifyContent: 'center' }}>
          <div id="invoice-preview" ref={printRef} style={{
            background: '#fff', width: '100%', maxWidth: 800, borderRadius: 4,
            boxShadow: '0 4px 24px rgba(0,0,0,0.10)', padding: '52px 56px', fontFamily: "'Inter', sans-serif",
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 48 }}>
              <div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#1a1f36', letterSpacing: '-0.5px', marginBottom: 6 }}>
                  {inv.organizationName}
                </div>
                <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
                  {inv.clientAddress && <div>{inv.clientAddress}</div>}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 32, fontWeight: 800, color: '#2563eb', letterSpacing: '1px', marginBottom: 10 }}>INVOICE</div>
                <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.8 }}>
                  <div><span style={{ color: '#9ca3af' }}>Invoice No:</span> <strong>{inv.invoiceNumber}</strong></div>
                  <div><span style={{ color: '#9ca3af' }}>Issued:</span> {fmtDate(inv.issueDate, dateFormat)}</div>
                  <div><span style={{ color: '#9ca3af' }}>Due:</span> <span style={{ color: inv.status === 'overdue' ? '#dc2626' : '#374151', fontWeight: inv.status === 'overdue' ? 700 : 400 }}>{fmtDate(inv.dueDate, dateFormat)}</span></div>
                </div>
              </div>
            </div>

            {/* Bill to */}
            <div style={{ marginBottom: 40 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Bill To</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1f36', marginBottom: 4 }}>{inv.clientCompany}</div>
              {inv.clientAddress && <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 2 }}>{inv.clientAddress}</div>}
              <div style={{ fontSize: 13, color: '#6b7280' }}>{inv.clientEmail}</div>
            </div>

            {/* Line items table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 32 }}>
              <thead>
                <tr style={{ background: '#1a1f36', borderRadius: 6 }}>
                  {['Description', 'Qty', `Rate (${currency})`, `Amount (${currency})`].map((h, i) => (
                    <th key={h} style={{
                      padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#e2e8f0',
                      textAlign: i === 0 ? 'left' : 'right', textTransform: 'uppercase', letterSpacing: '0.06em',
                      borderRadius: i === 0 ? '6px 0 0 6px' : i === 3 ? '0 6px 6px 0' : 0,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {inv.lineItems.map((line, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: '#374151' }}>{line.description}</td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: '#6b7280', textAlign: 'right' }}>
                      {Number(line.qty) % 1 === 0 ? line.qty : Number(line.qty).toFixed(2)}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: '#6b7280', textAlign: 'right' }}>{fmt(line.rate)}</td>
                    <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 600, color: '#1a1f36', textAlign: 'right' }}>{fmt(line.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 36 }}>
              <div style={{ minWidth: 260 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: 13, color: '#6b7280' }}>Subtotal</span>
                  <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>{fmt(inv.subtotal)}</span>
                </div>
                {inv.taxRate > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: 13, color: '#6b7280' }}>GST ({inv.taxRate}%)</span>
                    <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>{fmt(inv.taxAmount)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: '#1a1f36', borderRadius: 8, marginTop: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}>Total Due</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: '#4ade80' }}>{fmt(inv.total)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {inv.notes && (
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 24 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Notes & Payment Terms</div>
                <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>{inv.notes}</div>
              </div>
            )}

            {/* Footer */}
            <div style={{ marginTop: 48, paddingTop: 20, borderTop: '2px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>Thank you for your business</div>
              <div style={{ fontSize: 12, color: '#9ca3af', fontFamily: 'monospace' }}>{inv.invoiceNumber}</div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function previewBtn(bg: string): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px',
    background: bg, color: '#fff', border: 'none', borderRadius: 7,
    fontWeight: 600, fontSize: 13, cursor: 'pointer',
  }
}

// ── Edit Invoice Modal ────────────────────────────────────────────────────────

interface EditInvoiceModalProps {
  open: boolean
  invoice: Invoice
  currency: string
  currencySymbol: string
  dateFormat: string
  onClose: () => void
  onSave: (data: Partial<{ taxRate: number; dueDate: string; notes: string; lineItems: InvoiceLineItem[] }>) => void
}

function EditInvoiceModal({ open, invoice, currency, currencySymbol, dateFormat, onClose, onSave }: EditInvoiceModalProps) {
  const [taxRate, setTaxRate] = useState(invoice.taxRate)
  const [dueDate, setDueDateVal] = useState(invoice.dueDate?.split('T')[0] ?? '')
  const [notes, setNotes] = useState(invoice.notes ?? '')
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>(invoice.lineItems)

  // Create currency formatter
  const fmt = (n: number) => makeFmt(currency, currencySymbol)(n)

  const subtotal = lineItems.reduce((s, l) => s + l.amount, 0)
  const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100
  const total = subtotal + taxAmount

  const updateLine = (i: number, field: keyof InvoiceLineItem, val: string | number) => {
    setLineItems(prev => prev.map((l, idx) => {
      if (idx !== i) return l
      const updated = { ...l, [field]: val }
      if (field === 'qty' || field === 'rate') updated.amount = Number(updated.qty) * Number(updated.rate)
      return updated
    }))
  }

  const darkInput: React.CSSProperties = {
    width: '100%', padding: '10px 13px', background: '#1e2d4a', border: '1px solid #2d4068',
    borderRadius: 8, color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box',
  }
  const lbl: React.CSSProperties = { fontSize: 12, color: '#94a3b8', fontWeight: 500, marginBottom: 5, display: 'block' }

  return (
    <Modal open={open} onClose={onClose} title="" size="xl">
      <div style={{ background: '#152035', borderRadius: 12, margin: -24, padding: '32px 28px' }}>
        <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 18, marginBottom: 24 }}>Edit Invoice — {invoice.invoiceNumber}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="modal-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={lbl}>Due Date</label>
              <input style={darkInput} type="date" value={dueDate} onChange={e => setDueDateVal(e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Tax Rate (%)</label>
              <input style={darkInput} type="number" min={0} max={100} value={taxRate} onChange={e => setTaxRate(Number(e.target.value))} />
            </div>
          </div>

          {/* Line items */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{ ...lbl, margin: 0 }}>Line Items</label>
              <button onClick={() => setLineItems(prev => [...prev, { description: '', qty: 1, rate: 0, amount: 0 }])} style={{ fontSize: 12, color: '#60a5fa', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Plus size={13} /> Add Row
              </button>
            </div>
            <div style={{ background: '#1e2d4a', borderRadius: 8, overflow: 'hidden', border: '1px solid #2d4068' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#172236' }}>
                    {['Description', 'Qty', `Rate (${currency})`, `Amount (${currency})`, ''].map(h => (
                      <th key={h} style={{ padding: '8px 10px', fontSize: 10, fontWeight: 700, color: '#64748b', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((line, i) => (
                    <tr key={i} style={{ borderTop: '1px solid #253451' }}>
                      <td style={{ padding: '6px 8px' }}>
                        <input value={line.description} onChange={e => updateLine(i, 'description', e.target.value)}
                          style={{ ...darkInput, padding: '6px 8px', fontSize: 12, background: 'transparent', border: 'none' }} />
                      </td>
                      <td style={{ padding: '6px 8px', width: 70 }}>
                        <input type="number" step="0.25" value={line.qty} onChange={e => updateLine(i, 'qty', Number(e.target.value))}
                          style={{ ...darkInput, padding: '6px 8px', fontSize: 12, background: 'transparent', border: 'none', width: 60 }} />
                      </td>
                      <td style={{ padding: '6px 8px', width: 90 }}>
                        <input type="number" step="0.01" value={line.rate} onChange={e => updateLine(i, 'rate', Number(e.target.value))}
                          style={{ ...darkInput, padding: '6px 8px', fontSize: 12, background: 'transparent', border: 'none', width: 80 }} />
                      </td>
                      <td style={{ padding: '6px 8px', fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{fmt(line.amount)}</td>
                      <td style={{ padding: '6px 8px' }}>
                        {lineItems.length > 1 && (
                          <button onClick={() => setLineItems(prev => prev.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex' }}>
                            <X size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ padding: '10px 14px', borderTop: '1px solid #253451', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>Subtotal: <strong style={{ color: '#e2e8f0' }}>{fmt(subtotal)}</strong></div>
                {taxRate > 0 && <div style={{ fontSize: 12, color: '#94a3b8' }}>GST ({taxRate}%): <strong style={{ color: '#e2e8f0' }}>{fmt(taxAmount)}</strong></div>}
                <div style={{ fontSize: 15, fontWeight: 700, color: '#4ade80' }}>Total: {fmt(total)}</div>
              </div>
            </div>
          </div>

          <div>
            <label style={lbl}>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              style={{ ...darkInput, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
          <button onClick={onClose} style={{ padding: '10px 22px', border: '1px solid #2d4068', borderRadius: 8, background: 'transparent', color: '#94a3b8', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>CANCEL</button>
          <button onClick={() => onSave({ taxRate, dueDate, notes, lineItems })} style={{ padding: '10px 28px', border: 'none', borderRadius: 8, background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>SAVE CHANGES</button>
        </div>
      </div>
    </Modal>
  )
}