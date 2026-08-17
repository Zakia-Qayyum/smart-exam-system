import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CheckCheck, FilterX, Inbox, Loader2, RefreshCw } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { useNotificationsStore } from '@/stores/notifications-store'
import { kindIcon, kindTint, timeAgo } from '@/lib/visuals'
import { cn } from '@/lib/utils'
import type { MockNotification, NotificationKind } from '@/lib/types'

const kindLabel: Record<NotificationKind, string> = {
  clash: 'Clash',
  published: 'Published',
  assignment: 'Assignment',
  approval: 'Approval',
  info: 'Info',
}

const kindBadge: Record<NotificationKind, BadgeProps['variant']> = {
  clash: 'danger',
  published: 'gold',
  assignment: 'info',
  approval: 'purple',
  info: 'default',
}

const kindOptions: Array<{ value: NotificationKind | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'clash', label: 'Clash' },
  { value: 'assignment', label: 'Assignment' },
  { value: 'published', label: 'Published' },
  { value: 'approval', label: 'Approval' },
  { value: 'info', label: 'Info' },
]

type ReadFilter = 'all' | 'unread' | 'read'

const readOptions: Array<{ value: ReadFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'read', label: 'Read' },
]

type DayBucket = 'today' | 'yesterday' | 'earlier'

const BUCKET_ORDER: DayBucket[] = ['today', 'yesterday', 'earlier']

const bucketLabel: Record<DayBucket, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  earlier: 'Earlier',
}

function bucketFor(minutesAgo: number): DayBucket {
  if (minutesAgo < 60 * 24) return 'today'
  if (minutesAgo < 60 * 24 * 2) return 'yesterday'
  return 'earlier'
}

interface PillProps {
  active: boolean
  onClick: () => void
  children: ReactNode
}

function Pill({ active, onClick, children }: PillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60',
        active
          ? 'border-navy bg-navy text-white shadow-soft'
          : 'border-line bg-card text-ink-muted hover:border-navy/40 hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}

export function NotificationsPage() {
  const items = useNotificationsStore((s) => s.items)
  const unreadCount = useNotificationsStore((s) => s.unreadCount)
  const loading = useNotificationsStore((s) => s.loading)
  const error = useNotificationsStore((s) => s.error)
  const refresh = useNotificationsStore((s) => s.refresh)
  const markRead = useNotificationsStore((s) => s.markRead)
  const markAllRead = useNotificationsStore((s) => s.markAllRead)
  const [typeFilter, setTypeFilter] = useState<NotificationKind | 'all'>('all')
  const [readFilter, setReadFilter] = useState<ReadFilter>('all')

  useEffect(() => {
    void refresh()
  }, [refresh])

  const notifications = useMemo(
    () => [...items].sort((a, b) => a.minutesAgo - b.minutesAgo),
    [items],
  )

  const filtered = useMemo(
    () =>
      notifications.filter(
        (n) =>
          (typeFilter === 'all' || n.kind === typeFilter) &&
          (readFilter === 'all' || (readFilter === 'unread' ? !n.read : n.read)),
      ),
    [notifications, typeFilter, readFilter],
  )

  const groups = useMemo(() => {
    const byBucket = new Map<DayBucket, MockNotification[]>()
    for (const n of filtered) {
      const bucket = bucketFor(n.minutesAgo)
      const items = byBucket.get(bucket) ?? []
      items.push(n)
      byBucket.set(bucket, items)
    }
    return BUCKET_ORDER.filter((b) => byBucket.has(b)).map((b) => ({ bucket: b, items: byBucket.get(b)! }))
  }, [filtered])

  const hasFilters = typeFilter !== 'all' || readFilter !== 'all'
  const resetFilters = () => {
    setTypeFilter('all')
    setReadFilter('all')
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-ink">Notifications</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {loading
              ? 'Refreshing…'
              : unreadCount > 0
                ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}.`
                : 'You\u2019re all caught up.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} aria-hidden="true" />
            Refresh
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void markAllRead()} disabled={unreadCount === 0}>
            <CheckCheck className="h-4 w-4" aria-hidden="true" />
            Mark all as read
          </Button>
        </div>
      </div>

      {error && (
        <Card className="mt-6 border-danger/40">
          <CardContent className="p-4">
            <p className="text-sm font-semibold text-danger">Couldn&apos;t load notifications.</p>
            <p className="mt-1 text-xs text-ink-muted">{error}</p>
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            {kindOptions.map((opt) => (
              <Pill key={opt.value} active={typeFilter === opt.value} onClick={() => setTypeFilter(opt.value)}>
                {opt.label}
              </Pill>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Status</span>
            {readOptions.map((opt) => (
              <Pill key={opt.value} active={readFilter === opt.value} onClick={() => setReadFilter(opt.value)}>
                {opt.label}
              </Pill>
            ))}
            {hasFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="ml-auto flex items-center gap-1 text-xs font-bold text-navy transition-colors hover:text-navy-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
              >
                <FilterX className="h-3.5 w-3.5" aria-hidden="true" />
                Reset filters
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {!loading && notifications.length === 0 ? (
        <Card className="mt-4">
          <CardContent className="p-4">
            <EmptyState
              icon={<Inbox className="h-7 w-7" aria-hidden="true" />}
              title="You\u2019re all caught up"
              description="New clash alerts, assignments and approvals will show up here."
            />
          </CardContent>
        </Card>
      ) : !loading && filtered.length === 0 ? (
        <Card className="mt-4">
          <CardContent className="p-4">
            <EmptyState
              icon={<FilterX className="h-7 w-7" aria-hidden="true" />}
              title="No matching notifications"
              description="Nothing matches the current type and read-state filters."
              action={
                <Button variant="secondary" size="sm" onClick={resetFilters}>
                  Reset filters
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : loading && notifications.length === 0 ? (
        <Card className="mt-4">
          <CardContent className="p-4">
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-ink-muted">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              Loading notifications…
            </div>
          </CardContent>
        </Card>
      ) : (
        groups.map(({ bucket, items }) => (
          <Card key={bucket} className="mt-4">
            <CardContent className="p-2">
              <p className="px-3 pb-1 pt-2 text-[11px] font-black uppercase tracking-wider text-ink-muted">
                {bucketLabel[bucket]}
                <span className="ml-2 rounded-full bg-surface px-2 py-0.5 text-[10px] font-bold text-ink-muted">
                  {items.length}
                </span>
              </p>
              <ul>
                {items.map((n) => {
                  const Icon = kindIcon[n.kind]
                  return (
                    <li key={n.id} className="border-b border-line/70 last:border-b-0">
                      <Link
                        to={n.link}
                        onMouseDown={() => void markRead(n.id)}
                        className="flex items-start gap-3 rounded-md px-3 py-3.5 transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
                      >
                        <span
                          className={cn(
                            'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                            kindTint[n.kind],
                          )}
                        >
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                'text-sm leading-5',
                                n.read ? 'font-semibold text-ink' : 'font-bold text-ink',
                              )}
                            >
                              {n.title}
                            </span>
                            <Badge variant={kindBadge[n.kind]}>{kindLabel[n.kind]}</Badge>
                            {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-gold-dark" />}
                          </span>
                          <span className="mt-0.5 block text-sm leading-5 text-ink-muted">{n.body}</span>
                          <span className="mt-1 block text-[11px] font-medium text-ink-muted/70">
                            {timeAgo(n.minutesAgo)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
