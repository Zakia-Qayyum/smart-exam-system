import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ExamCoordinatorDashboard } from '@/components/dashboard/coordinator-dashboard'
import { navByRole, roleLabels } from '@/config/roles'
import { mockStats } from '@/config/mock-data'
import { useAuthStore } from '@/stores/auth-store'
import { useNotificationsStore } from '@/stores/notifications-store'
import { kindIcon, kindTone, timeAgo, firstName } from '@/lib/visuals'
import { cn } from '@/lib/utils'
import type { DashboardStat } from '@/lib/types'

const statTone: Record<DashboardStat['tone'], string> = {
  navy: 'bg-navy text-white',
  gold: 'bg-gold/15 text-gold-dark',
  success: 'bg-success-light text-success',
  danger: 'bg-danger-light text-danger',
  warning: 'bg-warning-light text-warning-deep',
  info: 'bg-info-light text-info',
}

export function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const items = useNotificationsStore((s) => s.items)
  if (!user) return null

  if (user.role === 'exam-coordinator') return <ExamCoordinatorDashboard user={user} />

  const stats = mockStats(user.role)
  const quickActions = navByRole[user.role].slice(0, 4)
  const recent = [...items]
    .sort((a, b) => a.minutesAgo - b.minutesAgo)
    .slice(0, 4)

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-ink">
            Welcome back, {firstName(user.name)}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Here&apos;s what&apos;s happening in the Fall-2026 exam cycle.
          </p>
        </div>
        <Badge variant="gold" dot>
          {roleLabels[user.role]}
          {user.department ? ` · ${user.department}` : ''}
        </Badge>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="flex items-center gap-4">
            <span
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-black',
                statTone[stat.tone],
              )}
            >
              {stat.value}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{stat.label}</p>
              <p className="truncate text-xs text-ink-muted">{stat.hint}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Recent notifications</CardTitle>
            <Link
              to="/notifications"
              className="flex items-center gap-1 text-xs font-bold text-navy hover:text-navy-deep"
            >
              View all <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-1 pt-1">
            {recent.map((n) => {
              const Icon = kindIcon[n.kind]
              return (
                <Link
                  key={n.id}
                  to={n.link}
                  className="flex items-start gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-surface"
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface">
                    <Icon className={cn('h-4 w-4', kindTone[n.kind])} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        'block truncate text-sm font-semibold',
                        n.read ? 'text-ink-muted' : 'text-ink',
                      )}
                    >
                      {n.title}
                    </span>
                    <span className="block truncate text-xs text-ink-muted">{n.body}</span>
                  </span>
                  <span className="shrink-0 text-[11px] font-medium text-ink-muted/70">
                    {timeAgo(n.minutesAgo)}
                  </span>
                </Link>
              )
            })}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {quickActions.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className="group flex items-center gap-3 rounded-md border border-line bg-card px-3 py-3 transition-all hover:-translate-y-0.5 hover:border-gold/50 hover:shadow-soft"
                >
                  <Icon className="h-5 w-5 shrink-0 text-navy" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {item.label}
                    </span>
                    <span className="block text-xs text-ink-muted">Open module</span>
                  </span>
                </Link>
              )
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
