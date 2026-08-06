import { Link } from 'react-router-dom'
import { CheckCheck } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/stores/auth-store'
import { useNotificationsStore } from '@/stores/notifications-store'
import { kindIcon, kindTone, timeAgo } from '@/lib/visuals'
import { cn } from '@/lib/utils'

const kindLabel = {
  clash: 'Clash',
  published: 'Schedule',
  assignment: 'Assignment',
  approval: 'Approval',
  info: 'Info',
} as const

export function NotificationsPage() {
  const role = useAuthStore((s) => s.user?.role)
  const byRole = useNotificationsStore((s) => s.byRole)
  const markRead = useNotificationsStore((s) => s.markRead)
  const markAllRead = useNotificationsStore((s) => s.markAllRead)

  if (!role) return null

  const notifications = [...(byRole[role] ?? [])].sort((a, b) => a.minutesAgo - b.minutesAgo)
  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-ink">Notifications</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Clash alerts, schedule notices and account updates.
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="secondary" size="sm" onClick={() => markAllRead(role)}>
            <CheckCheck className="h-4 w-4" aria-hidden="true" />
            Mark all read
          </Button>
        )}
      </div>

      <Card className="mt-6">
        <CardContent className="p-2">
          {notifications.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-ink-muted">
              You&apos;re all caught up.
            </p>
          ) : (
            <ul>
              {notifications.map((n) => {
                const Icon = kindIcon[n.kind]
                return (
                  <li key={n.id} className="border-b border-line/70 last:border-b-0">
                    <Link
                      to={n.link}
                      onMouseDown={() => markRead(role, n.id)}
                      className="flex items-start gap-3 rounded-md px-3 py-3.5 transition-colors hover:bg-surface"
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                          n.read ? 'bg-surface' : 'bg-navy',
                        )}
                      >
                        <Icon
                          className={cn('h-4 w-4', n.read ? kindTone[n.kind] : 'text-gold')}
                          aria-hidden="true"
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              'text-sm font-bold',
                              n.read ? 'text-ink' : 'text-ink',
                            )}
                          >
                            {n.title}
                          </span>
                          <Badge
                            variant={
                              n.kind === 'clash'
                                ? 'danger'
                                : n.kind === 'published'
                                  ? 'published'
                                  : 'default'
                            }
                          >
                            {kindLabel[n.kind]}
                          </Badge>
                          {!n.read && <span className="h-2 w-2 rounded-full bg-gold-dark" />}
                        </span>
                        <span className="mt-0.5 block text-sm leading-5 text-ink-muted">
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
          )}
        </CardContent>
      </Card>
    </div>
  )
}
