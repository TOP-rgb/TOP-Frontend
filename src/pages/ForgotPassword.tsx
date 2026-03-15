import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react'
import { api } from '@/lib/api'
import { toast } from 'sonner'

export function ForgotPassword() {
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/auth/forgot-password', { email })
      setSent(true)
      toast.success('Password reset link sent to your email')
    } catch (err: unknown) {
      // Always show success even on error to prevent email enumeration
      setSent(true)
      toast.success('If the email exists, a reset link has been sent')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Left hero panel — same as Login */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative flex-col justify-between p-12 overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950">
        <div className="absolute -top-40 -right-20 w-96 h-96 rounded-full bg-blue-600/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -left-20 w-80 h-80 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-white/5 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full border border-white/5 pointer-events-none" />

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

        <div className="relative z-10 space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-3 py-1">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-blue-300 text-xs font-medium">Account recovery</span>
            </div>
            <h2 className="text-4xl font-bold text-white leading-[1.15] max-w-sm">
              Forgot your<br />
              <span className="text-blue-400">password?</span>
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed max-w-sm">
              No worries. Enter your email and we'll send you a secure link to reset your password.
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
            {sent ? (
              /* ── Success state ── */
              <div className="text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center mx-auto">
                  <CheckCircle className="w-7 h-7 text-green-600" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900">Check your email</h1>
                  <p className="text-slate-500 text-sm mt-2 leading-relaxed">
                    We've sent a password reset link to <span className="font-medium text-slate-700">{email}</span>.
                    The link will expire in 1 hour.
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left">
                  <p className="text-xs font-semibold text-slate-600 mb-1.5">Didn't receive the email?</p>
                  <ul className="text-xs text-slate-500 space-y-1">
                    <li>&bull; Check your spam or junk folder</li>
                    <li>&bull; Make sure the email address is correct</li>
                    <li>&bull; Wait a few minutes and try again</li>
                  </ul>
                </div>

                <button
                  onClick={() => { setSent(false); setEmail('') }}
                  className="text-sm text-blue-600 hover:text-blue-700 font-semibold transition-colors"
                >
                  Try a different email
                </button>

                <div className="pt-2">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    <ArrowLeft size={14} />
                    Back to sign in
                  </Link>
                </div>
              </div>
            ) : (
              /* ── Form state ── */
              <>
                <div className="mb-6">
                  <h1 className="text-xl font-bold text-slate-900">Reset your password</h1>
                  <p className="text-slate-500 text-sm mt-1">
                    Enter the email address associated with your account and we'll send you a link to reset your password.
                  </p>
                </div>

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
                    autoFocus
                  />

                  <Button type="submit" className="w-full" disabled={loading || !email.trim()}>
                    {loading ? 'Sending reset link...' : 'Send Reset Link'}
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
