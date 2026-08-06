import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, CheckCheck } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { useNotificationsStore } from '@/stores/notifications-store'
import { kindIcon, kindTone, timeAgo } from '@/lib/visuals'
import { useDismiss } from '@/lib/use-dismiss'
import { cn } from '@/lib/utils'

export function NotificationsDropdown() {
  const role = useAuthStore((s) => s.user?.role)
  const byRole = useNotificationsStore((s) => s.byRole)
  const markRead = useNotificationsStore((s) => s.markRead)
  const markAllRead = useNotificationsStore((s) => s.markAllRead)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useDismiss(wrapRef, () => setOpen(false))

  if (!role) return null

  const notifications = byRole[role] ?? []
  const unreadCount = notifications.filter((n) => !n.read).length
  const latest = [...notifications].sort((a, b) => a.minutesAgo - b.minutesAgo).slice(0, 5)

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        className="relative flex h-10 w-10 items-center justify-center rounded-md text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gold px-1 text-[10px] font-black text-navy-deep">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[22rem] overflow-hidden rounded-lg border border-line bg-card shadow-lift">
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <h3 className="text-sm font-bold text-ink">Notifications</h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllRead(role)}
                className="flex items-center gap-1 text-xs font-semibold text-navy hover:text-navy-deep focus-visible:outline-none"
              >
                <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Mark all read
              </button>
            )}
          </div>

          <ul className="max-h-96 overflow-y-auto">
            {latest.map((n) => {
              const Icon = kindIcon[n.kind]
              return (
                <li key={n.id} className="border-b border-line/70 last:border-b-0">
                  <Link
                    to={n.link}
                    onMouseDown={() => markRead(role, n.id)}
                    className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface"
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface',
                      )}
                    >
                      <Icon className={cn('h-4 w-4', kindTone[n.kind])} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span
                          className={cn(
                            'truncate text-sm font-semibold',
                            n.read ? 'text-ink-muted' : 'text-ink',
                          )}
                        >
                          {n.title}
                        </span>
                        {!n.read && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-gold-dark" />
                        )}
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-xs leading-4 text-ink-muted">
                        {n.body}
                      </span>
                      <span className="mt-1 block text-[11px] font-medium text-ink-muted/70">
                        {timeAgo(n.minutesAgo)}
                      </span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>

          <div className="border-t border-line p-2">
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="flex w-full items-center justify-center rounded-md py-2 text-sm font-bold text-navy transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
            >
              View all
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
