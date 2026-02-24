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

  const { clients, loading, error, createClient, updateClient } = useClients()

  const filtered = clients.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.company.toLowerCase().includes(search.toLowerCase()) ||
      c.industry.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || c.status === statusFilter
    return matchSearch && matchStatus
  })

  if (loading) return (
    <div className="flex items-center justify-center h-64 gap-3 text-slate-500">
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1f36', margin: 0 }}>Client Management</h1>
        <button
          onClick={() => { setSelected(null); setShowModal(true) }}
          style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
        >
          <Plus size={16} /> Add client
        </button>
      </div>

      {/* Table Card */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #f1f3f9' }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em' }}>All Clients</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Status filter */}
            <div style={{ display: 'flex', gap: 4, background: '#f3f4f6', borderRadius: 7, padding: '3px' }}>
              {(['all', 'active', 'inactive'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  style={{
                    padding: '5px 14px', borderRadius: 5, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    background: statusFilter === s ? '#fff' : 'transparent',
                    color: statusFilter === s ? '#1a1f36' : '#6b7280',
                    boxShadow: statusFilter === s ? '0 1px 3px rgba(0,0,0,.1)' : 'none',
                    textTransform: 'capitalize',
                  }}
                >{s}</button>
              ))}
            </div>
            {/* Search */}
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input
                placeholder="Search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: 32, paddingRight: 12, paddingTop: 7, paddingBottom: 7, border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 13, outline: 'none', width: 200 }}
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Contact Name', 'Company', 'Onboarding Date', 'Email', 'Phone No.', 'Status', 'Action'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '11px 18px', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '48px 18px', color: '#9ca3af', fontSize: 14 }}>No clients found</td></tr>
              ) : filtered.map((client, i) => (
                <tr key={client.id} style={{ borderTop: '1px solid #f1f3f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ padding: '13px 18px', fontSize: 14, fontWeight: 500, color: '#1a1f36' }}>{client.name}</td>
                  <td style={{ padding: '13px 18px', fontSize: 14, color: '#374151' }}>{client.company}</td>
                  <td style={{ padding: '13px 18px', fontSize: 13, color: '#6b7280' }}>{client.createdAt?.slice(0, 10) ?? '—'}</td>
                  <td style={{ padding: '13px 18px', fontSize: 13, color: '#374151' }}>{client.email}</td>
                  <td style={{ padding: '13px 18px', fontSize: 13, color: '#374151' }}>{client.phone || '—'}</td>
                  <td style={{ padding: '13px 18px' }}>
                    <span style={{ color: client.status === 'active' ? '#16a34a' : '#dc2626', fontWeight: 600, fontSize: 13 }}>
                      {client.status.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '13px 18px' }}>
                    <button
                      onClick={() => { setSelected(client); setShowModal(true) }}
                      style={{ padding: '5px 8px', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#6b7280' }}
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