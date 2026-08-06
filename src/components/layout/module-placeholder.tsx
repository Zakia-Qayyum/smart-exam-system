import { Link, useLocation } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { homeByRole, routeMeta } from '@/config/roles'
import { useAuthStore } from '@/stores/auth-store'

export function ModulePlaceholder() {
  const { pathname } = useLocation()
  const meta = routeMeta[pathname]
  const role = useAuthStore((s) => s.user?.role)
  const home = role ? homeByRole[role] : '/dashboard'

  if (!meta) return null

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-black tracking-tight text-ink">{meta.title}</h1>
      <p className="mt-1 text-sm text-ink-muted">{meta.description}</p>

      <div className="mt-6 flex flex-col items-center justify-center rounded-lg border border-dashed border-line bg-card px-6 py-16 text-center shadow-soft">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gold/15">
          <Sparkles className="h-7 w-7 text-gold-dark" aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-base font-bold text-ink">Coming in a later step</h2>
        <p className="mt-1 max-w-md text-sm leading-5 text-ink-muted">
          This module will be built on top of the Step 2 API. The app shell, role-based navigation
          and access rules are live now.
        </p>
        <Link
          to={home}
          className={buttonVariants({ variant: 'secondary', size: 'sm', className: 'mt-6' })}
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  )
}
