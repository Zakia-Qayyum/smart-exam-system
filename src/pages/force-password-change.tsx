import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { KeyRound, ShieldAlert, ShieldCheck } from 'lucide-react'
import AuthCard from '@/components/auth/auth-card'
import PasswordChecklist from '@/components/auth/password-checklist'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth-store'
import { homeByRole } from '@/config/roles'
import { passwordMeetsPolicy } from '@/lib/validators'
import { toast } from '@/components/ui/toast-store'

export function ForcedPasswordChangePage() {
  const pending = useAuthStore((s) => s.pending)
  const user = useAuthStore((s) => s.user)
  const changePassword = useAuthStore((s) => s.changePassword)
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirm?: string }>({})
  const [loading, setLoading] = useState(false)

  if (user) return <Navigate to={homeByRole[user.role]} replace />
  if (!pending) return <Navigate to="/login" replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errors: typeof fieldErrors = {}
    if (!passwordMeetsPolicy(password)) errors.password = 'Password does not meet the security policy'
    if (confirm !== password) errors.confirm = 'Passwords do not match'
    setFieldErrors(errors)
    if (Object.keys(errors).length) return

    setLoading(true)
    await changePassword(password)
    setLoading(false)
    toast({ title: 'Password updated', description: 'Your new password is in effect. Welcome back.', variant: 'success' })
    navigate(homeByRole[pending.role])
  }

  return (
    <AuthCard
      title="Create a new password"
      subtitle="For security, you must change your password before continuing. Your new password must meet all of the requirements below."
      footer={<span className="text-white/60">Account security protects your academic record.</span>}
    >
      <div className="mb-5 flex items-start gap-2 rounded-md border border-warning/30 bg-warning-light/40 px-3 py-2.5 text-xs leading-relaxed text-warning-dark">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>This is your first sign-in, or your password has expired. Temporary passwords cannot be reused.</span>
      </div>

      <form onSubmit={submit} noValidate className="grid gap-4">
        <div>
          <Input
            label="New password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors.password}
            leading={<KeyRound className="h-4 w-4" aria-hidden="true" />}
          />
          <PasswordChecklist password={password} />
        </div>

        <Input
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={fieldErrors.confirm}
          leading={<KeyRound className="h-4 w-4" aria-hidden="true" />}
        />

        {passwordMeetsPolicy(password) && confirm === password && password.length > 0 ? (
          <div role="status" className="flex items-center gap-2 rounded-md border border-success/30 bg-success-light/40 px-3 py-2 text-xs font-semibold text-success-dark">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Your password meets all requirements.
          </div>
        ) : null}

        <Button type="submit" size="lg" className="w-full" loading={loading}>
          {loading ? 'Updating…' : 'Update password'}
        </Button>
      </form>
    </AuthCard>
  )
}
