import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api, setToken } from '@/lib/api'
import { useAuthStore, type ApiUser } from '@/store/authStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Eye, EyeOff, Mail, Lock, User, Building2 } from 'lucide-react'

export function Signup() {
  const navigate = useNavigate()
  const { setAuthUser } = useAuthStore()

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    organizationName: '',
  })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.organizationName.trim()) {
      setError('Organization name is required.')
      return
    }
    setLoading(true)
    try {
      const res = await api.post<{
        success: boolean
        data: { user: ApiUser; organization: { id: string; name: string; slug: string }; token: string }
        message?: string
      }>('/auth/signup', form)
      if (res.success && res.data?.token) {
        setToken(res.data.token)
        setAuthUser(res.data.user)
        navigate('/dashboard')
      } else {
        setError(res.message || 'Signup failed. Please try again.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* ── Left hero panel ── */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative flex-col justify-between p-12 overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950">
        <div className="absolute -top-40 -right-20 w-96 h-96 rounded-full bg-blue-600/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -left-20 w-80 h-80 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />

        {/* Brand */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
          </div>
          <div>
            <p className="text-white font-bold text-base leading-none">TOP Internal</p>
            <p className="text-slate-500 text-xs mt-0.5">Job Management System</p>
          </div>
        </div>

        {/* Hero content */}
        <div className="relative z-10 space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-3 py-1">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-blue-300 text-xs font-medium">Get started free</span>
            </div>
            <h2 className="text-4xl font-bold text-white leading-[1.15] max-w-sm">
              Your firm.<br />
              <span className="text-blue-400">Your data. Always.</span>
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed max-w-sm">
              Sign up to create your organization. Invite your team, manage jobs, track time, and get paid — all in one place.
            </p>
          </div>

          <div className="space-y-3 max-w-sm">
            {[
              { icon: '🏢', title: 'Your own organization', desc: 'Your data is completely isolated from other firms' },
              { icon: '👥', title: 'Invite your team', desc: 'Add employees and managers after signing up' },
              { icon: '🔒', title: 'Secure by default', desc: 'Row-level data isolation on every request' },
            ].map(item => (
              <div key={item.title} className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-xl p-4">
                <span className="text-xl mt-0.5">{item.icon}</span>
                <div>
                  <p className="text-white font-semibold text-sm">{item.title}</p>
                  <p className="text-slate-400 text-xs mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-slate-600 text-xs">© 2024 TOP Internal. All rights reserved.</p>
      </div>

      {/* ── Right signup panel ── */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[420px]">
          {/* Mobile brand */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            </div>
            <div>
              <p className="font-bold text-slate-900">TOP Internal</p>
              <p className="text-xs text-slate-500">Job Management System</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-8">
            <div className="mb-6">
              <h1 className="text-xl font-bold text-slate-900">Create your organization</h1>
              <p className="text-slate-500 text-sm mt-1">You'll be the admin. Invite your team afterward.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Org name */}
              <Input
                label="Organization name"
                type="text"
                placeholder="e.g. Sharma & Co CA Firm"
                value={form.organizationName}
                onChange={set('organizationName')}
                leftIcon={<Building2 size={14} />}
                required
              />

              {/* Name row */}
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="First name"
                  type="text"
                  placeholder="John"
                  value={form.firstName}
                  onChange={set('firstName')}
                  leftIcon={<User size={14} />}
                  required
                />
                <Input
                  label="Last name"
                  type="text"
                  placeholder="Smith"
                  value={form.lastName}
                  onChange={set('lastName')}
                  required
                />
              </div>

              {/* Email */}
              <Input
                label="Email address"
                type="email"
                placeholder="you@yourfirm.com"
                value={form.email}
                onChange={set('email')}
                leftIcon={<Mail size={14} />}
                required
                autoComplete="email"
              />

              {/* Password */}
              <Input
                label="Password"
                type={showPw ? 'text' : 'password'}
                placeholder="Min 8 chars, 1 uppercase, 1 number"
                value={form.password}
                onChange={set('password')}
                leftIcon={<Lock size={14} />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="hover:text-slate-600 transition-colors"
                  >
                    {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                }
                required
                autoComplete="new-password"
              />

              {error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-600 text-xs px-3 py-2.5 rounded-lg">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Creating organization...' : 'Create Organization & Sign In'}
              </Button>
            </form>

            <p className="text-center text-sm text-slate-500 mt-5">
              Already have an account?{' '}
              <Link to="/login" className="text-blue-600 hover:text-blue-700 font-semibold transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
