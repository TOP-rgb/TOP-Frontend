import { useState, useEffect } from 'react'
import type { Client, ClientFormData } from '@/types'
import { Modal } from '@/components/ui/Modal'
import { Search, Plus, Edit2, Loader2 } from 'lucide-react'
import { useClients } from '@/hooks/useClients'
import { toast } from 'sonner'

export function Clients() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [showModal, setShowModal] = useState(false)
  const [selected, setSelected] = useState<Client | null>(null)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640)

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const { clients, loading, error, createClient, updateClient } = useClients()

  const filtered = clients.filter(c => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      (c.name     ?? '').toLowerCase().includes(q) ||
      (c.company  ?? '').toLowerCase().includes(q) ||
      (c.email    ?? '').toLowerCase().includes(q) ||
      (c.phone    ?? '').toLowerCase().includes(q) ||
      (c.industry ?? '').toLowerCase().includes(q)
    const matchStatus = statusFilter === 'all' || c.status === statusFilter
    return matchSearch && matchStatus
  })

  if (loading) return (
    <div className="flex items-center justify-center h-64 gap-3 text-slate-500 dark:text-slate-400">
      <Loader2 className="animate-spin" size={20} />
      <span className="text-sm">Loading clients...</span>
    </div>
  )

  if (error) return (
    <div className="rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm px-5 py-4">
      Failed to load clients: {error}
    </div>
  )

  return (
    <div style={{ fontFamily: 'inherit' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
        <h1 className="text-slate-900 dark:text-slate-100" style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Client Management</h1>
        <button
          onClick={() => { setSelected(null); setShowModal(true) }}
          style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
        >
          <Plus size={16} /> Add client
        </button>
      </div>

      {/* Table Card */}
      <div className="bg-white dark:bg-slate-800 dark:border-slate-700" style={{ borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        {/* Toolbar */}
        <div className="dark:border-slate-700/50" style={{ padding: isMobile ? '12px 14px' : '14px 20px', borderBottom: '1px solid #f1f3f9', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Row 1: title + filter pills */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span className="text-slate-700 dark:text-slate-300" style={{ fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>All Clients</span>
            {/* Status filter */}
            <div className="bg-slate-100 dark:bg-slate-700 hide-scrollbar" style={{ display: 'flex', gap: 4, borderRadius: 7, padding: '3px', overflowX: 'auto', flexShrink: 0 }}>
              {(['all', 'active', 'inactive'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={statusFilter === s ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-slate-100' : 'bg-transparent text-slate-500 dark:text-slate-400'}
                  style={{
                    padding: '5px 14px', borderRadius: 5, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    boxShadow: statusFilter === s ? '0 1px 3px rgba(0,0,0,.1)' : 'none',
                    textTransform: 'capitalize', whiteSpace: 'nowrap',
                  }}
                >{s}</button>
              ))}
            </div>
          </div>
          {/* Row 2: Search (constrained width) */}
          <div style={{ position: 'relative', maxWidth: 320 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
            <input
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600"
              style={{ paddingLeft: 32, paddingRight: 12, paddingTop: 7, paddingBottom: 7, border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 13, outline: 'none', width: '100%' }}
            />
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }} className="hide-scrollbar">
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480, tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '16%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '13%' }} />
              <col className="hidden sm:table-column" style={{ width: '20%' }} />
              <col className="hidden md:table-column" style={{ width: '14%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '8%' }} />
            </colgroup>
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50">
                <th className="text-slate-500 dark:text-slate-400" style={{ textAlign: 'left', padding: '11px 18px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Contact Name</th>
                <th className="text-slate-500 dark:text-slate-400" style={{ textAlign: 'left', padding: '11px 18px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Company</th>
                <th className="text-slate-500 dark:text-slate-400" style={{ textAlign: 'left', padding: '11px 18px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Onboarding Date</th>
                <th className="hidden sm:table-cell text-slate-500 dark:text-slate-400" style={{ textAlign: 'left', padding: '11px 18px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Email</th>
                <th className="hidden md:table-cell text-slate-500 dark:text-slate-400" style={{ textAlign: 'left', padding: '11px 18px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Phone No.</th>
                <th className="text-slate-500 dark:text-slate-400" style={{ textAlign: 'left', padding: '11px 18px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Status</th>
                <th className="text-slate-500 dark:text-slate-400" style={{ textAlign: 'left', padding: '11px 18px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-slate-400 dark:text-slate-500" style={{ textAlign: 'center', padding: '48px 18px', fontSize: 14 }}>No clients found</td></tr>
              ) : filtered.map((client, i) => (
                <tr key={client.id} className={`dark:border-slate-700/50 ${i % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-900/50'}`} style={{ borderTop: '1px solid #f1f3f9' }}>
                  <td className="text-slate-900 dark:text-slate-100" style={{ padding: '13px 18px', fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{client.name}</td>
                  <td className="text-slate-700 dark:text-slate-300" style={{ padding: '13px 18px', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{client.company}</td>
                  <td className="text-slate-500 dark:text-slate-400" style={{ padding: '13px 18px', fontSize: 13 }}>{client.createdAt?.slice(0, 10) ?? '—'}</td>
                  <td className="hidden sm:table-cell text-slate-700 dark:text-slate-300" style={{ padding: '13px 18px', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{client.email}</td>
                  <td className="hidden md:table-cell text-slate-700 dark:text-slate-300" style={{ padding: '13px 18px', fontSize: 13 }}>{client.phone || '—'}</td>
                  <td style={{ padding: '13px 18px' }}>
                    <span style={{ color: client.status === 'active' ? '#16a34a' : '#dc2626', fontWeight: 600, fontSize: 13 }}>
                      {client.status.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '13px 18px' }}>
                    <button
                      onClick={() => { setSelected(client); setShowModal(true) }}
                      className="bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-slate-300"
                      style={{ padding: '5px 8px', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', color: '#6b7280' }}
                      title="Edit"
                    >
                      <Edit2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ClientModal
      open={showModal}
      onClose={() => setShowModal(false)}
      client={selected}
      onSave={async (formData: ClientFormData) => {
        if (selected) {
          const ok = await updateClient(selected.id, formData)
          if (ok) toast.success('Client updated successfully')
          else toast.error('Failed to update client')
        } else {
          const ok = await createClient(formData)
          if (ok) toast.success('Client created successfully')
          else toast.error('Failed to create client')
        }
        setShowModal(false);
      }}
    />
    </div>
  )
}

interface ClientModalProps {
  open: boolean
  onClose: () => void
  client: Client | null
  onSave: (c: ClientFormData) => void
}

function ClientModal({ open, onClose, client, onSave }: ClientModalProps) {
  const [form, setForm] = useState<ClientFormData>({
    name: '',
    email: '',
    phone: '',
    company: '',
    industry: '',
    status: 'active',
    address: '',
    createdAt: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (client) {
      // Only include database fields, not computed ones
      setForm({
        name: client.name || '',
        email: client.email || '',
        phone: client.phone || '',
        company: client.company || '',
        industry: client.industry || '',
        status: client.status || 'active',
        address: client.address || '',
        createdAt: client.createdAt?.slice(0, 10) || new Date().toISOString().split('T')[0],
      });
    } else {
      setForm({
        name: '',
        email: '',
        phone: '',
        company: '',
        industry: '',
        status: 'active',
        address: '',
        createdAt: new Date().toISOString().split('T')[0],
      });
    }
  }, [client]);

  const handleChange = (field: keyof ClientFormData, value: string) => {
    setForm((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    if (!form.name.trim()) { toast.error('Contact name is required'); return }
    if (!form.company.trim()) { toast.error('Company name is required'); return }
    if (!form.email.trim()) { toast.error('Email is required'); return }
    if (!form.phone.trim()) { toast.error('Phone number is required'); return }
    onSave(form);
  };

  const darkInput: React.CSSProperties = {
    width: '100%', padding: '10px 13px', background: '#1e2d4a', border: '1px solid #2d4068',
    borderRadius: 8, color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box',
  };
  
  const label: React.CSSProperties = { 
    fontSize: 13, color: '#94a3b8', fontWeight: 500, marginBottom: 5, display: 'block' 
  };

  return (
    <Modal open={open} onClose={onClose} title="" size="lg">
      <div style={{ background: '#152035', borderRadius: 12, margin: -24, padding: 32 }}>
        <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 20, marginBottom: 28 }}>
          {client ? 'Edit Client' : 'Add New Client'}
        </h2>
        <div className="modal-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <div>
            <label style={label}>Contact Name *</label>
            <input 
              style={darkInput} 
              value={form.name} 
              onChange={e => handleChange('name', e.target.value)} 
              placeholder="John Smith" 
              required
            />
          </div>
          <div>
            <label style={label}>Company Name *</label>
            <input 
              style={darkInput} 
              value={form.company} 
              onChange={e => handleChange('company', e.target.value)} 
              placeholder="Acme Pty Ltd" 
              required
            />
          </div>
          <div>
            <label style={label}>Email *</label>
            <input 
              style={darkInput} 
              type="email" 
              value={form.email} 
              onChange={e => handleChange('email', e.target.value)} 
              placeholder="contact@company.com" 
              required
            />
          </div>
          <div>
            <label style={label}>Phone Number *</label>
            <input 
              style={darkInput} 
              value={form.phone} 
              onChange={e => handleChange('phone', e.target.value)} 
              placeholder="+61 400 000 000" 
              required
            />
          </div>
          <div>
            <label style={label}>Industry</label>
            <input 
              style={darkInput} 
              value={form.industry} 
              onChange={e => handleChange('industry', e.target.value)} 
              placeholder="Technology, Finance, etc." 
            />
          </div>
          <div>
            <label style={label}>Address</label>
            <input 
              style={darkInput} 
              value={form.address} 
              onChange={e => handleChange('address', e.target.value)} 
              placeholder="123 Business St" 
            />
          </div>
          <div>
            <label style={label}>Onboarding Date</label>
            <input 
              style={darkInput} 
              type="date" 
              value={form.createdAt} 
              onChange={e => handleChange('createdAt', e.target.value)} 
            />
          </div>
          <div>
            <label style={label}>Status</label>
            <select
              style={{ ...darkInput, cursor: 'pointer' }}
              value={form.status}
              onChange={e => handleChange('status', e.target.value as 'active' | 'inactive')}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 28 }}>
          <button 
            onClick={onClose} 
            style={{ padding: '10px 22px', border: '1px solid #2d4068', borderRadius: 8, background: 'transparent', color: '#94a3b8', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
          >
            CANCEL
          </button>
          <button 
            onClick={handleSubmit} 
            style={{ padding: '10px 28px', border: 'none', borderRadius: 8, background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
          >
            {client ? 'UPDATE' : 'CREATE'}
          </button>
        </div>
      </div>
    </Modal>
  );
}