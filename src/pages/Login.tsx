import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Eye, EyeOff, Mail, Lock } from 'lucide-react'

// const DEMO_ACCOUNTS = [
//   { role: 'employee', label: 'Processor', email: 'employee@top.com', desc: 'View tasks & submit timesheets', color: 'bg-slate-100 text-slate-700 border-slate-200 hover:border-slate-400 hover:bg-slate-50' },
//   { role: 'manager',  label: 'Manager',   email: 'manager@top.com',  desc: 'Approve timesheets & manage jobs', color: 'bg-blue-50 text-blue-700 border-blue-200 hover:border-blue-400 hover:bg-blue-50' },
//   { role: 'admin',    label: 'Admin',     email: 'admin@top.com',    desc: 'Full system access & analytics', color: 'bg-purple-50 text-purple-700 border-purple-200 hover:border-purple-400 hover:bg-purple-50' },
// ]

export function Login() {
  const navigate = useNavigate()
  const { login } = useAuthStore()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const ok = await login(email, password)
    setLoading(false)
    if (ok) navigate('/dashboard')
    else setError('Invalid credentials. Try a demo account below.')
  }

  // const handleDemo = async (demoEmail: string) => {
  //   setError('')
  //   setLoading(true)
  //   const ok = await login(demoEmail, 'password')
  //   setLoading(false)
  //   if (ok) navigate('/dashboard')
  // }

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* ── Left hero panel ── */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative flex-col justify-between p-12 overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950">
        {/* Decorative orbs */}
        <div className="absolute -top-40 -right-20 w-96 h-96 rounded-full bg-blue-600/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -left-20 w-80 h-80 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-white/5 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full border border-white/5 pointer-events-none" />

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
              <span className="text-blue-300 text-xs font-medium">Live platform</span>
            </div>
            <h2 className="text-4xl font-bold text-white leading-[1.15] max-w-sm">
              Track every job.<br />
              <span className="text-blue-400">Measure every dollar.</span>
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed max-w-sm">
              Real-time job tracking, time billing, invoice performance and team productivity — built for accounting firms.
            </p>
          </div>

          {/* KPI tiles */}
          <div className="grid grid-cols-2 gap-3 max-w-sm">
            {[
              { label: 'Invoice Realisation', value: '94%', icon: '📈', desc: 'avg this quarter' },
              { label: 'Active Jobs',         value: '47',   icon: '💼', desc: 'across 6 clients' },
              { label: 'Billable Hours',      value: '384h', icon: '⏱',  desc: 'this month' },
              { label: 'Avg Job Score',       value: '82',   icon: '⭐', desc: 'out of 100' },
            ].map(kpi => (
              <div key={kpi.label} className="bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-sm">
                <div className="flex items-start justify-between mb-1">
                  <span className="text-xl">{kpi.icon}</span>
                </div>
                <p className="text-white font-bold text-xl leading-none">{kpi.value}</p>
                <p className="text-white/70 text-xs font-medium mt-1">{kpi.label}</p>
                <p className="text-slate-500 text-[11px] mt-0.5">{kpi.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-slate-600 text-xs">© 2024 TOP Internal. All rights reserved.</p>
      </div>

      {/* ── Right login panel ── */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[400px]">
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

          {/* Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-8">
            <div className="mb-6">
              <h1 className="text-xl font-bold text-slate-900">Welcome back</h1>
              <p className="text-slate-500 text-sm mt-1">Sign in to your account to continue.</p>
            </div>

            {/* Demo role buttons
            <div className="mb-6">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Quick demo access</p>
              <div className="space-y-2">
                {DEMO_ACCOUNTS.map(acc => (
                  <button
                    key={acc.role}
                    onClick={() => handleDemo(acc.email)}
                    disabled={loading}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-200 text-left group disabled:opacity-50 ${acc.color}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold leading-none">{acc.label}</p>
                      <p className="text-xs opacity-70 mt-0.5">{acc.desc}</p>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </button>
                ))}
              </div>
            </div> */}

            {/* Divider */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px bg-slate-100" />
              <span className="text-xs text-slate-400 font-medium">or sign in manually</span>
              <div className="flex-1 h-px bg-slate-100" />
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Email address"
                type="email"
                placeholder="you@top.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                leftIcon={<Mail size={14} />}
                required
                autoComplete="email"
              />
              <Input
                label="Password"
                type={showPw ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                leftIcon={<Lock size={14} />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="hover:text-slate-600 transition-colors"
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                  >
                    {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                }
                required
                autoComplete="current-password"
              />


{error && (
  <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-600 text-xs px-3 py-2.5 rounded-lg">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
    {error}
  </div>
)}

              <div className="flex items-center justify-between pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-blue-600 accent-blue-600" />
                  <span className="text-sm text-slate-600">Remember me</span>
                </label>
                <button type="button" className="text-sm text-blue-600 hover:text-blue-700 font-semibold transition-colors">
                  Forgot password?
                </button>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>

            <p className="text-center text-sm text-slate-500 mt-5">
              Don't have an account?{' '}
              <a href="/signup" className="text-blue-600 hover:text-blue-700 font-semibold transition-colors">
                Sign up free
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
