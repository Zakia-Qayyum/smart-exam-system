import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, Mail, ShieldAlert } from 'lucide-react'
import AuthCard from '@/components/auth/auth-card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth-store'
import { homeByRole } from '@/config/roles'
import { demoAccounts } from '@/config/mock-data'
import { EMAIL_RE } from '@/lib/validators'
import { toast } from '@/components/ui/toast-store'

export function LoginPage() {
  const user = useAuthStore((s) => s.user)
  const lockedEmail = useAuthStore((s) => s.lockedEmail)
  const login = useAuthStore((s) => s.login)
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (user) return <Navigate to={homeByRole[user.role]} replace />
  if (lockedEmail) return <Navigate to="/locked" replace />

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const errors: typeof fieldErrors = {}
    if (!EMAIL_RE.test(email.trim())) errors.email = 'Enter a valid university email address'
    if (!password) errors.password = 'Enter your password'
    setFieldErrors(errors)
    if (Object.keys(errors).length) return

    setLoading(true)
    setFormError(null)
    const res = await login(email, password)
    setLoading(false)

    if (res.status === 'ok') {
      if (res.requiresMfa) navigate('/mfa')
      else if (res.mustChangePassword) navigate('/force-password-change')
      else {
        toast({ title: 'Welcome back', variant: 'success' })
        navigate(homeByRole[res.role])
      }
    } else if (res.status === 'locked') {
      navigate('/locked')
    } else {
      setFormError('Incorrect email or password. Check your credentials and try again.')
    }
  }

  const selectDemo = (demoEmail: string) => {
    const account = demoAccounts.find((a) => a.email === demoEmail)
    if (!account) return
    setEmail(account.email)
    setPassword(account.password)
    setFieldErrors({})
    setFormError(null)
  }

  return (
    <AuthCard
      title="Sign in"
      subtitle="Access the Smart Exam Scheduling & Invigilation System with your university account."
      footer={
        <span>
          Need help?{' '}
          <Link to="/forgot-password" className="font-semibold text-gold underline-offset-4 hover:underline">
            Forgot your password?
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="grid gap-4">
          <Input
            label="University email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldErrors.email}
            leading={<Mail className="h-4 w-4" aria-hidden="true" />}
          />

          <div className="relative">
            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={fieldErrors.password}
              leading={<Lock className="h-4 w-4" aria-hidden="true" />}
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="pointer-events-auto p-1 text-ink-muted transition-colors hover:text-ink"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              }
            />
          </div>
        </div>

        {formError && (
          <div role="alert" className="mt-4 flex items-start gap-2 rounded-md border border-danger/25 bg-danger-light/50 px-3 py-2.5 text-xs text-danger">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{formError}</span>
          </div>
        )}

        <Button type="submit" size="lg" className="mt-6 w-full" loading={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <div className="mt-8 border-t border-line pt-6">
        <p className="mb-3 text-center text-[11px] font-black uppercase tracking-widest text-ink-muted">
          Demo accounts — click to fill
        </p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {demoAccounts
            .filter((a) => !a.isLocked)
            .map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => selectDemo(account.email)}
                className="flex items-center gap-2 rounded-md border border-line bg-surface/50 px-2.5 py-1.5 text-left transition-colors hover:border-gold/60 hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
              >
                <Mail className="h-3.5 w-3.5 shrink-0 text-ink-muted" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-ink">{account.label}</span>
                  <span className="block truncate text-[11px] text-ink-muted">{account.email}</span>
                </span>
              </button>
            ))}
        </div>
      </div>
    </AuthCard>
  )
}
