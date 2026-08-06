import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Clock, Lock, ShieldAlert } from 'lucide-react'
import AuthCard from '@/components/auth/auth-card'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth-store'

function useCountdown(until: number | null) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!until) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [until])
  const remaining = until ? Math.max(0, Math.ceil((until - now) / 1000)) : 0
  return remaining
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m} min ${s.toString().padStart(2, '0')}s`
}

export function LockedPage() {
  const lockedEmail = useAuthStore((s) => s.lockedEmail)
  const lockedUntil = useAuthStore((s) => s.lockedUntil)
  const clearLocked = useAuthStore((s) => s.clearLocked)
  const navigate = useNavigate()

  const remaining = useCountdown(lockedUntil)
  const [open, setOpen] = useState(false)
  const locked = lockedEmail !== null && lockedUntil !== null && remaining > 0

  useEffect(() => {
    if (!locked && lockedEmail !== null && lockedUntil !== null) {
      clearLocked()
      navigate('/login', { replace: true })
    }
  }, [locked, lockedEmail, lockedUntil, clearLocked, navigate])

  if (!locked) return <Navigate to="/login" replace />

  return (
    <AuthCard
      title="Account temporarily locked"
      subtitle="Too many failed attempts. Your account is locked to protect it from unauthorized access."
      footer={
        <span className="text-white/60">
          Need urgent access? Contact the Examinations Section at examsoffice@airuni.edu.pk.
        </span>
      }
    >
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-danger-light/60">
          <Lock className="h-7 w-7 text-danger" aria-hidden="true" />
        </span>

        <div className="rounded-lg border border-line bg-surface/60 px-4 py-3">
          <p className="flex items-center justify-center gap-2 text-sm font-semibold text-ink">
            <Clock className="h-4 w-4 text-danger" aria-hidden="true" />
            Auto-unlocks in {formatDuration(remaining)}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            Account: {lockedEmail}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-xs font-semibold text-navy underline underline-offset-2 hover:text-navy-deep"
        >
          What triggered this?
        </button>

        {open && (
          <p className="rounded-md border border-line bg-surface/60 px-3 py-2.5 text-left text-xs leading-relaxed text-ink-muted">
            Accounts lock after 5 incorrect password attempts, or 3 incorrect verification codes, as a security
            measure. Lockouts lift automatically after 15 minutes — no manual reset is required.
          </p>
        )}

        <div className="mt-2 flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => {
              clearLocked()
              navigate('/login', { replace: true })
            }}
          >
            <ShieldAlert className="h-4 w-4" aria-hidden="true" />
            Try again
          </Button>
          <Link
            to="/forgot-password"
            className="text-sm font-semibold text-navy underline-offset-4 hover:underline"
          >
            Forgot your password?
          </Link>
        </div>
      </div>
    </AuthCard>
  )
}
