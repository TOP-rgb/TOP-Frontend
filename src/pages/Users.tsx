import { useState, useEffect } from 'react'
import type { User, UserRole } from '@/types'
import { Avatar } from '@/components/ui/Avatar'
import { Modal } from '@/components/ui/Modal'
import { Search, Plus, Edit2, UserX, UserCheck, Loader2, Check, Trash2, Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useUsers } from '@/hooks/useUsers'
import { toast } from 'sonner'

const roleTabs: { key: 'all' | UserRole; label: string }[] = [
  { key: 'all', label: 'All Users' },
  { key: 'employee', label: 'Employees' },
  { key: 'manager', label: 'Managers' },
  { key: 'admin', label: 'Admins' },
]

export function Users() {
  const { user: currentUser } = useAuthStore()
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | UserRole>('all')
  const [showModal, setShowModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const { users, loading, error, deactivateUser, updateUser, createUser, deleteUser } = useUsers()

  if (loading) return (
    <div className="flex items-center justify-center h-64 gap-3 text-slate-500">
      <Loader2 className="animate-spin" size={20} />
      <span className="text-sm">Loading users...</span>
    </div>
  )

  if (error) return (
    <div className="rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm px-5 py-4">
      Failed to load users: {error}
    </div>
  )

  const filtered = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.department ?? '').toLowerCase().includes(search.toLowerCase())
    const matchesTab = activeTab === 'all' || u.role === activeTab
    return matchesSearch && matchesTab
  })

  const counts = {
    all: users.length,
    employee: users.filter(u => u.role === 'employee').length,
    manager: users.filter(u => u.role === 'manager').length,
    admin: users.filter(u => u.role === 'admin').length,
  }

  const toggleStatus = async (id: string) => {
    const u = users.find(u => u.id === id)
    if (!u) return
    if (u.status === 'active') await deactivateUser(id)
    else await updateUser(id, { status: 'active' })
  }

  const handleDelete = async (id: string) => {
    const userToDelete = users.find(u => u.id === id)
    if (!userToDelete) return
    
    if (window.confirm(`Are you sure you want to permanently delete ${userToDelete.name}? This action cannot be undone.`)) {
      const success = await deleteUser(id)
      if (success) {
        setDeleteConfirm(null)
        toast.success('User deleted')
      } else {
        toast.error('Failed to delete user')
      }
    }
  }

  return (
    <div style={{ fontFamily: 'inherit' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1f36', margin: 0 }}>User Management</h1>
        {currentUser?.role === 'admin' && (
          <button
            onClick={() => { setSelectedUser(null); setShowModal(true) }}
            style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
          >
            <Plus size={16} /> Add user
          </button>
        )}
      </div>

      {/* Table Card */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        {/* Tabs + Search toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', borderBottom: '1px solid #f1f3f9' }}>
          {/* Role tabs */}
          <div style={{ display: 'flex', gap: 0 }}>
            {roleTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '14px 16px', border: 'none', borderBottom: activeTab === tab.key ? '2px solid #2563eb' : '2px solid transparent',
                  background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  color: activeTab === tab.key ? '#2563eb' : '#6b7280', whiteSpace: 'nowrap',
                }}
              >
                {tab.label}
                <span style={{ marginLeft: 6, padding: '2px 7px', borderRadius: 20, background: '#f3f4f6', fontSize: 11, color: '#6b7280' }}>
                  {counts[tab.key]}
                </span>
              </button>
            ))}
          </div>
          {/* Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input
                placeholder="Search users..."
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
                {['Name', 'Role', 'Department', 'Email', 'Phone', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '11px 18px', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '48px 18px', color: '#9ca3af', fontSize: 14 }}>No users found</td></tr>
              ) : filtered.map((user, i) => (
                <tr key={user.id} style={{ borderTop: '1px solid #f1f3f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ padding: '13px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar name={user.name} size="sm" />
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1f36' }}>{user.name}</div>
                        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>Joined {user.joinedDate}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '13px 18px', fontSize: 13, color: '#374151', textTransform: 'capitalize' }}>{user.role}</td>
                  <td style={{ padding: '13px 18px', fontSize: 13, color: '#6b7280' }}>{user.department || '—'}</td>
                  <td style={{ padding: '13px 18px', fontSize: 13, color: '#374151' }}>{user.email}</td>
                  <td style={{ padding: '13px 18px', fontSize: 13, color: '#6b7280' }}>{user.phone || '—'}</td>
                  <td style={{ padding: '13px 18px' }}>
                    <span style={{ color: user.status === 'active' ? '#16a34a' : '#dc2626', fontWeight: 600, fontSize: 13 }}>
                      {user.status.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '13px 18px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => { setSelectedUser(user); setShowModal(true) }}
                        style={{ padding: '5px 8px', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#6b7280' }}
                        title="Edit"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => toggleStatus(user.id)}
                        style={{ padding: '5px 8px', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: 'pointer', color: user.status === 'active' ? '#dc2626' : '#16a34a' }}
                        title={user.status === 'active' ? 'Deactivate' : 'Activate'}
                      >
                        {user.status === 'active' ? <UserX size={14} /> : <UserCheck size={14} />}
                      </button>
                      
                      {/* Delete button - only for admins and not current user */}
                      {currentUser?.role === 'admin' && currentUser.id !== user.id && (
                        <button
                          onClick={() => handleDelete(user.id)}
                          style={{ padding: '5px 8px', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#dc2626' }}
                          title="Delete Permanently"
                        >
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

      <UserModal
        open={showModal}
        onClose={() => setShowModal(false)}
        user={selectedUser}
        onSave={async (u) => {
          if (selectedUser) {
            const ok = await updateUser(selectedUser.id, {
              name: u.name,
              email: u.email,
              role: u.role,
              department: u.department,
              phone: u.phone,
              status: u.status
            })
            if (ok) toast.success('User updated successfully')
            else toast.error('Failed to update user')
          } else {
            const parts = (u.name ?? '').trim().split(' ')
            const firstName = parts[0] ?? ''
            const lastName = parts.slice(1).join(' ') || firstName
            const ok = await createUser({
              firstName,
              lastName,
              email: u.email ?? '',
              password: (u as User & { password?: string }).password ?? '',
              role: u.role ?? 'employee',
              department: u.department,
              phone: u.phone,
            })
            if (ok) toast.success('User created successfully')
            else toast.error('Failed to create user')
          }
          setShowModal(false)
        }}
      />
    </div>
  )
}

// ── 3-step Add User modal ──────────────────────────────────────────────────

interface UserModalProps {
  open: boolean
  onClose: () => void
  user: User | null
  onSave: (u: User) => void
}

type UserFormData = Partial<User> & { password?: string; confirmPassword?: string }

function UserModal({ open, onClose, user, onSave }: UserModalProps) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<UserFormData>(user ?? {
    name: '', email: '', role: 'employee', department: '', phone: '', status: 'active',
    joinedDate: new Date().toISOString().split('T')[0], costRate: 0, password: '', confirmPassword: '',
  })
  const [showPw, setShowPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)

  useEffect(() => {
    setStep(1)
    setShowPw(false)
    setShowConfirmPw(false)
    setForm(user ?? {
      name: '', email: '', role: 'employee', department: '', phone: '', status: 'active',
      joinedDate: new Date().toISOString().split('T')[0], costRate: 0, password: '', confirmPassword: '',
    })
  }, [user, open])

  const set = (k: keyof UserFormData, v: string | number) => setForm(f => ({ ...f, [k]: v }))

  const steps = [
    { num: 1, label: 'Personal details' },
    { num: 2, label: 'Account' },
    { num: 3, label: 'Role' },
  ]

  const darkInput: React.CSSProperties = {
    width: '100%', padding: '12px 14px', background: '#1e2d4a', border: '1px solid #2d4068',
    borderRadius: 8, color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box',
  }
  const lbl: React.CSSProperties = { fontSize: 13, color: '#94a3b8', fontWeight: 500, marginBottom: 5, display: 'block' }
  const req = <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>
  const pwInputStyle: React.CSSProperties = { ...darkInput, paddingRight: 42 }
  const eyeBtn: React.CSSProperties = { position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', padding: 0 }

  const handleNext = () => {
    if (step === 1) {
      const firstName = (form.name ?? '').split(' ')[0]?.trim() ?? ''
      const lastName = (form.name ?? '').split(' ').slice(1).join(' ').trim()
      if (!firstName) { toast.error('First name is required'); return }
      if (!lastName) { toast.error('Last name is required'); return }
    }
    if (step === 2) {
      if (!form.email?.trim()) { toast.error('Email is required'); return }
      if (!user) {
        if (!form.password) { toast.error('Password is required'); return }
        if ((form.password?.length ?? 0) < 8) { toast.error('Password must be at least 8 characters'); return }
        if (!form.confirmPassword) { toast.error('Please confirm your password'); return }
        if (form.password !== form.confirmPassword) { toast.error('Passwords do not match'); return }
      }
    }
    setStep(s => s + 1)
  }

  const handleSave = () => {
    onSave(form as User & { password?: string })
    setStep(1)
  }

  const handleClose = () => { onClose(); setStep(1) }

  return (
    <Modal open={open} onClose={handleClose} title="" size="xl">
      <div className="modal-flex" style={{ background: '#152035', borderRadius: 12, margin: -24, padding: 0, display: 'flex', minHeight: 460, overflow: 'hidden' }}>
        {/* Left step sidebar */}
        <div className="modal-sidebar" style={{ width: 180, background: '#0f1a2e', padding: '32px 20px', flexShrink: 0 }}>
          <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 18, marginBottom: 32 }}>
            {user ? 'Edit User' : 'Add User'}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {steps.map(s => (
              <div key={s.num} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, fontSize: 13, fontWeight: 700,
                  background: step > s.num ? '#16a34a' : step === s.num ? '#2563eb' : '#1e2d4a',
                  color: '#fff',
                  border: step === s.num ? '2px solid #3b82f6' : 'none',
                }}>
                  {step > s.num ? <Check size={14} /> : s.num}
                </div>
                <span style={{ fontSize: 13, color: step === s.num ? '#fff' : '#64748b', fontWeight: step === s.num ? 600 : 400 }}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right form area */}
        <div style={{ flex: 1, padding: '36px 36px' }}>
          {/* Step 1 — Personal details */}
          {step === 1 && (
            <div>
              <h3 style={{ color: '#fff', fontWeight: 600, fontSize: 16, marginBottom: 22 }}>Personal Details</h3>
              <div className="modal-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div>
                  <label style={lbl}>First Name {req}</label>
                  <input style={darkInput} value={(form.name ?? '').split(' ')[0] ?? ''} onChange={e => {
                    const parts = (form.name ?? '').split(' ')
                    parts[0] = e.target.value
                    set('name', parts.join(' '))
                  }} placeholder="John" />
                </div>
                <div>
                  <label style={lbl}>Last Name {req}</label>
                  <input style={darkInput} value={(form.name ?? '').split(' ').slice(1).join(' ') ?? ''} onChange={e => {
                    const first = (form.name ?? '').split(' ')[0] ?? ''
                    set('name', `${first} ${e.target.value}`.trim())
                  }} placeholder="Smith" />
                </div>
                <div>
                  <label style={lbl}>Phone No.</label>
                  <input style={darkInput} value={form.phone ?? ''} onChange={e => set('phone', e.target.value)} placeholder="+61 400 000 000" />
                </div>
                <div>
                  <label style={lbl}>Department</label>
                  <select style={{ ...darkInput, cursor: 'pointer' }} value={form.department ?? ''} onChange={e => set('department', e.target.value)}>
                    <option value="">Select department</option>
                    <option value="Tax & Compliance">Tax & Compliance</option>
                    <option value="Bookkeeping">Bookkeeping</option>
                    <option value="Advisory">Advisory</option>
                    <option value="Operations">Operations</option>
                    <option value="Management">Management</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 2 — Account Details */}
          {step === 2 && (
            <div>
              <h3 style={{ color: '#fff', fontWeight: 600, fontSize: 16, marginBottom: 22 }}>Account Details</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <label style={lbl}>Email {req}</label>
                  <input style={darkInput} type="email" value={form.email ?? ''} onChange={e => set('email', e.target.value)} placeholder="john@top.com" />
                </div>
                {!user && (
                  <>
                    <div>
                      <label style={lbl}>Password {req}</label>
                      <div style={{ position: 'relative' }}>
                        <input style={pwInputStyle} type={showPw ? 'text' : 'password'} value={form.password ?? ''} onChange={e => set('password', e.target.value)} placeholder="Min 8 chars" />
                        <button type="button" onClick={() => setShowPw(v => !v)} style={eyeBtn}>
                          {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label style={lbl}>Confirm Password {req}</label>
                      <div style={{ position: 'relative' }}>
                        <input style={pwInputStyle} type={showConfirmPw ? 'text' : 'password'} value={form.confirmPassword ?? ''} onChange={e => set('confirmPassword', e.target.value)} placeholder="Repeat password" />
                        <button type="button" onClick={() => setShowConfirmPw(v => !v)} style={eyeBtn}>
                          {showConfirmPw ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Step 3 — Role */}
          {step === 3 && (
            <div>
              <h3 style={{ color: '#fff', fontWeight: 600, fontSize: 16, marginBottom: 22 }}>Select Role</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {(['admin', 'manager', 'employee'] as UserRole[]).map(r => (
                  <button
                    key={r}
                    onClick={() => set('role', r)}
                    style={{
                      padding: '13px 18px', borderRadius: 9, textAlign: 'left',
                      border: form.role === r ? '2px solid #2563eb' : '1px solid #2d4068',
                      background: form.role === r ? '#1e3a6e' : '#1e2d4a',
                      color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 14, textTransform: 'capitalize',
                    }}
                  >
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Nav buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 28 }}>
            <button onClick={handleClose} style={{ padding: '10px 22px', border: '1px solid #2d4068', borderRadius: 8, background: 'transparent', color: '#94a3b8', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
              CANCEL
            </button>
            {step > 1 && (
              <button onClick={() => setStep(s => s - 1)} style={{ padding: '10px 22px', border: '1px solid #2d4068', borderRadius: 8, background: 'transparent', color: '#94a3b8', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                BACK
              </button>
            )}
            {step < 3 ? (
              <button onClick={handleNext} style={{ padding: '10px 28px', border: 'none', borderRadius: 8, background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                NEXT
              </button>
            ) : (
              <button onClick={handleSave} style={{ padding: '10px 28px', border: 'none', borderRadius: 8, background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                {user ? 'SAVE' : 'ADD'}
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}