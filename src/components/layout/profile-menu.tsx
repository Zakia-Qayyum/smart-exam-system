import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, LogOut } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/stores/auth-store'
import { roleLabels } from '@/config/roles'
import { useDismiss } from '@/lib/use-dismiss'
import { cn } from '@/lib/utils'

export function ProfileMenu() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useDismiss(wrapRef, () => setOpen(false))

  if (!user) return null

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
      >
        <Avatar name={user.name} size="sm" />
        <span className="hidden text-left lg:block">
          <span className="block max-w-[160px] truncate text-sm font-semibold leading-4 text-white">
            {user.name}
          </span>
          <span className="block text-[11px] font-medium leading-4 text-gold">
            {roleLabels[user.role]}
          </span>
        </span>
        <ChevronDown
          className={cn('h-4 w-4 text-white/60 transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-lg border border-line bg-card shadow-lift"
        >
          <div className="flex items-center gap-3 border-b border-line bg-surface/60 px-4 py-3">
            <Avatar name={user.name} size="md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-ink">{user.name}</p>
              <p className="truncate text-xs text-ink-muted">{user.email}</p>
              <Badge variant="gold" className="mt-1">
                {roleLabels[user.role]}
                {user.department ? ` · ${user.department}` : ''}
              </Badge>
            </div>
          </div>

          <div className="border-t border-line p-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                logout()
                navigate('/login')
              }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-danger transition-colors hover:bg-danger-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
