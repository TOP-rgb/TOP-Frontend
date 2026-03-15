import { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Lock, Eye, EyeOff, ArrowLeft, CheckCircle, AlertTriangle } from 'lucide-react'
import { api } from '@/lib/api'
import { toast } from 'sonner'

export function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')

  const [password, setPassword]       = useState('')
  const [confirmPw, setConfirmPw]     = useState('')
  const [showPw, setShowPw]           = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading]         = useState(false)
  const [done, setDone]               = useState(false)
  const [error, setError]             = useState('')

  // Password strength
  const checks = [
    { label: 'At least 8 characters', ok: password.length >= 8 },
    { label: 'Contains uppercase letter', ok: /[A-Z]/.test(password) },
    { label: 'Contains lowercase letter', ok: /[a-z]/.test(password) },
    { label: 'Contains a number', ok: /\d/.test(password) },
  ]
  const allPass = checks.every(c => c.ok)
  const passwordsMatch = password === confirmPw && confirmPw.length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!allPass) { setError('Password does not meet requirements'); return }
    if (!passwordsMatch) { setError('Passwords do not match'); return }
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/reset-password', { token, newPassword: password })
      setDone(true)
      toast.success('Password reset successfully!')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reset password. The link may have expired.'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  // No token provided
  if (!token) {
    return (
      <div className="min-h-screen flex bg-slate-50">
        <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative flex-col justify-between p-12 overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950">
          <div className="absolute -top-40 -right-20 w-96 h-96 rounded-full bg-blue-600/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-40 -left-20 w-80 h-80 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-white/5 pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full border border-white/5 pointer-events-none" />
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            </div>
            <div>
              <p className="text-white font-bold text-base leading-none">TOP Internal</p>
              <p className="text-slate-500 text-xs mt-0.5">Job Management System</p>
            </div>
          </div>
          <div className="relative z-10" />
          <p className="relative z-10 text-slate-600 text-xs">&copy; 2024 TOP Internal. All rights reserved.</p>
        </div>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-[400px]">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-8 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-7 h-7 text-amber-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Invalid reset link</h1>
                <p className="text-slate-500 text-sm mt-2">
                  This password reset link is invalid or missing a token. Please request a new reset link.
                </p>
              </div>
              <div className="pt-2 space-y-3">
                <Link to="/forgot-password">
                  <Button className="w-full">Request New Reset Link</Button>
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
                >
                  <ArrowLeft size={14} />
                  Back to sign in
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Left hero panel */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative flex-col justify-between p-12 overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950">
        <div className="absolute -top-40 -right-20 w-96 h-96 rounded-full bg-blue-600/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -left-20 w-80 h-80 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-white/5 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full border border-white/5 pointer-events-none" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          </div>
          <div>
            <p className="text-white font-bold text-base leading-none">TOP Internal</p>
            <p className="text-slate-500 text-xs mt-0.5">Job Management System</p>
          </div>
        </div>

        <div className="relative z-10 space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-3 py-1">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-blue-300 text-xs font-medium">Secure reset</span>
            </div>
            <h2 className="text-4xl font-bold text-white leading-[1.15] max-w-sm">
              Set your new<br />
              <span className="text-blue-400">password.</span>
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed max-w-sm">
              Choose a strong password that you haven't used before. Your account security matters.
            </p>
          </div>
        </div>

        <p className="relative z-10 text-slate-600 text-xs">&copy; 2024 TOP Internal. All rights reserved.</p>
      </div>

      {/* Right form panel */}
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

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-8">
            {done ? (
              /* ── Success state ── */
              <div className="text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center mx-auto">
                  <CheckCircle className="w-7 h-7 text-green-600" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900">Password reset!</h1>
                  <p className="text-slate-500 text-sm mt-2">
                    Your password has been reset successfully. You can now sign in with your new password.
                  </p>
                </div>
                <Button className="w-full" onClick={() => navigate('/login')}>
                  Sign In
                </Button>
              </div>
            ) : (
              /* ── Form state ── */
              <>
                <div className="mb-6">
                  <h1 className="text-xl font-bold text-slate-900">Create new password</h1>
                  <p className="text-slate-500 text-sm mt-1">
                    Your new password must be different from previously used passwords.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <Input
                    label="New password"
                    type={showPw ? 'text' : 'password'}
                    placeholder="Enter new password"
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
                    autoComplete="new-password"
                    autoFocus
                  />

                  {/* Password requirements */}
                  {password.length > 0 && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
                      {checks.map(c => (
                        <div key={c.label} className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${c.ok ? 'bg-green-100' : 'bg-slate-200'}`}>
                            {c.ok ? (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                            ) : (
                              <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            )}
                          </div>
                          <span className={`text-xs ${c.ok ? 'text-green-700' : 'text-slate-500'}`}>{c.label}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <Input
                    label="Confirm password"
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Re-enter new password"
                    value={confirmPw}
                    onChange={e => setConfirmPw(e.target.value)}
                    leftIcon={<Lock size={14} />}
                    rightIcon={
                      <button
                        type="button"
                        onClick={() => setShowConfirm(v => !v)}
                        className="hover:text-slate-600 transition-colors"
                        aria-label={showConfirm ? 'Hide password' : 'Show password'}
                      >
                        {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    }
                    required
                    autoComplete="new-password"
                    error={confirmPw.length > 0 && !passwordsMatch ? 'Passwords do not match' : undefined}
                  />

                  {error && (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-600 text-xs px-3 py-2.5 rounded-lg">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                      {error}
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loading || !allPass || !passwordsMatch}
                  >
                    {loading ? 'Resetting password...' : 'Reset Password'}
                  </Button>
                </form>

                <div className="mt-5 text-center">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    <ArrowLeft size={14} />
                    Back to sign in
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
