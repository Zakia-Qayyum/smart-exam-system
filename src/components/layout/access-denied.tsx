import { Link } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { homeByRole } from '@/config/roles'
import { useAuthStore } from '@/stores/auth-store'

export function AccessDenied() {
  const role = useAuthStore((s) => s.user?.role)
  const home = role ? homeByRole[role] : '/login'

  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center rounded-lg border border-line bg-card px-8 py-14 text-center shadow-soft">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-danger-light">
        <Lock className="h-8 w-8 text-danger" aria-hidden="true" />
      </div>
      <h1 className="mt-5 text-lg font-bold text-ink">You don&apos;t have access</h1>
      <p className="mt-2 text-sm leading-5 text-ink-muted">
        This area is only available to specific roles. If you believe this is a mistake, contact
        your administrator.
      </p>
      <Link to={home} className={buttonVariants({ variant: 'primary', className: 'mt-6' })}>
        Go to my dashboard
      </Link>
    </div>
  )
}
