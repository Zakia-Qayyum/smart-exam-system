import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { CheckCircle2, Mail } from 'lucide-react'
import AuthCard from '@/components/auth/auth-card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth-store'
import { EMAIL_RE } from '@/lib/validators'

export function ForgotPasswordPage() {
  const user = useAuthStore((s) => s.user)
  const requestPasswordReset = useAuthStore((s) => s.requestPasswordReset)

  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  if (user) return <Navigate to="/dashboard" replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!EMAIL_RE.test(email.trim())) {
      setError('Enter a valid university email address.')
      return
    }
    setError(null)
    setLoading(true)
    await requestPasswordReset(email.trim())
    setLoading(false)
    setSent(true)
  }

  if (sent) {
    return (
      <AuthCard
        title="Check your email"
        subtitle="If an account exists for that address, a password reset link is on its way."
        footer={
          <Link to="/login" className="font-semibold text-gold underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        }
      >
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-light/60">
            <CheckCircle2 className="h-7 w-7 text-success" aria-hidden="true" />
          </span>
          <p className="text-sm leading-relaxed text-ink-muted">
            We sent instructions to <span className="font-semibold text-ink">{email.trim()}</span>. The link expires
            in 30 minutes. If you don't see it, check your spam folder.
          </p>
          <p className="text-xs text-ink-muted">
            Demo note: no email is actually sent — in Step 6 this calls the reset endpoint.
          </p>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Reset your password"
      subtitle="Enter your university email and we'll send you a link to create a new one."
      footer={
        <Link to="/login" className="font-semibold text-gold underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={submit} noValidate className="grid gap-4">
        <Input
          label="University email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error ?? undefined}
          leading={<Mail className="h-4 w-4" aria-hidden="true" />}
        />
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          {loading ? 'Sending…' : 'Send reset link'}
        </Button>
        <p className="text-center text-xs text-ink-muted">
          For security, we never reveal whether an address is registered.
        </p>
      </form>
    </AuthCard>
  )
}
