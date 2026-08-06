import { useCallback, useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Lock, MailOpen, RefreshCcw, ShieldAlert, Timer } from 'lucide-react'
import AuthCard from '@/components/auth/auth-card'
import OtpInput from '@/components/auth/otp-input'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth-store'
import { homeByRole, roleLabels } from '@/config/roles'
import { toast } from '@/components/ui/toast-store'

function useCountdown(deadline: number | null) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!deadline) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [deadline])
  const remaining = deadline ? Math.max(0, Math.floor((deadline - now) / 1000)) : 0
  return remaining
}

function format(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function MfaPage() {
  const pending = useAuthStore((s) => s.pending)
  const user = useAuthStore((s) => s.user)
  const lockedEmail = useAuthStore((s) => s.lockedEmail)
  const verifyOtp = useAuthStore((s) => s.verifyOtp)
  const resendOtp = useAuthStore((s) => s.resendOtp)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resendCooldown, setResendCooldown] = useState(0)

  const otpExpiresAt = pending?.otpExpiresAt ?? null
  const expiresIn = useCountdown(otpExpiresAt)
  const canResend = resendCooldown === 0
  const attemptsRemaining = pending?.otpAttemptsRemaining ?? 0

  useEffect(() => {
    if (!pending) return
    const id = window.setInterval(() => setResendCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => window.clearInterval(id)
  }, [pending, canResend])

  const handleResend = useCallback(async () => {
    await resendOtp()
    setResendCooldown(30)
    setCode('')
    setError(null)
    toast({ title: 'Code sent', description: 'A new 6-digit code was sent to your email.', variant: 'success' })
  }, [resendOtp])

  if (user) return <Navigate to={homeByRole[user.role]} replace />
  if (lockedEmail) return <Navigate to="/locked" replace />
  if (!pending) return <Navigate to="/login" replace />

  const submit = async () => {
    if (code.length < 6) {
      setError('Enter all 6 digits to continue.')
      return
    }
    setLoading(true)
    setError(null)
    const res = await verifyOtp(code)
    setLoading(false)
    if (res.status === 'ok') {
      if (res.next === 'password-change') navigate('/force-password-change')
      else {
        toast({ title: 'Verification successful', variant: 'success' })
        navigate(homeByRole[pending.role])
      }
    } else if (res.status === 'invalid_otp') {
      setError(res.attemptsRemaining > 1 ? `That code is incorrect — ${res.attemptsRemaining} attempts left.` : 'That code is incorrect — 1 attempt left.')
    } else if (res.status === 'locked') {
      navigate('/locked')
    } else {
      setError('This code has expired. Request a new one and try again.')
    }
  }

  return (
    <AuthCard
      title="Two-step verification"
      subtitle="Enter the 6-digit code we emailed to your university inbox. It is valid for 10 minutes."
      footer={
        <span className="text-white/60">
          Signed in as {pending.email.split('@')[0]} · {roleLabels[pending.role]}
        </span>
      }
    >
      <div className="grid gap-4">
        <OtpInput value={code} onChange={setCode} />

        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-md border border-danger/25 bg-danger-light/50 px-3 py-2.5 text-xs text-danger">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-1 flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-ink-muted">
            <Timer className="h-3.5 w-3.5" aria-hidden="true" />
            Code expires in <span className="font-semibold tabular-nums text-ink">{format(expiresIn)}</span>
          </span>
          {attemptsRemaining > 0 && attemptsRemaining < 3 ? (
            <span className="font-semibold text-warning">{attemptsRemaining} attempts left</span>
          ) : null}
        </div>

        <Button onClick={submit} size="lg" className="w-full" loading={loading}>
          {loading ? 'Verifying…' : 'Verify & continue'}
        </Button>

        <div className="flex items-center justify-between border-t border-line pt-4 text-sm">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResend}
            disabled={!canResend}
            className="px-2"
          >
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            {canResend ? 'Resend code' : `Resend in ${resendCooldown}s`}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              logout()
              navigate('/login')
            }}
            className="px-2"
          >
            <Lock className="h-4 w-4" aria-hidden="true" />
            Sign out
          </Button>
        </div>
      </div>

      <div className="mt-6 flex items-start gap-2 rounded-md border border-line bg-surface/60 px-3 py-2.5 text-xs leading-relaxed text-ink-muted">
        <MailOpen className="mt-0.5 h-4 w-4 shrink-0 text-navy" aria-hidden="true" />
        <span>
          In the demo, the code is a random 6-digit number. Check the console, or use the{' '}
          <button
            type="button"
            onClick={handleResend}
            className="font-semibold text-navy underline underline-offset-2 hover:text-navy-deep"
          >
            Resend
          </button>{' '}
          button to rotate it.
        </span>
      </div>
    </AuthCard>
  )
}
