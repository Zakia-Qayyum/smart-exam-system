import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, CheckCircle2, Siren } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast-store'
import { mockCoordinatorDashboard } from '@/config/mock-data'
import { roleLabels } from '@/config/roles'
import { fetchClashes } from '@/services/scheduling-service'
import { useInvigilatorsStore } from '@/stores/invigilators-store'
import { onScheduleChanged } from '@/lib/schedule-sync'
import { firstName, kindIcon, kindTone, timeAgo } from '@/lib/visuals'
import { cn } from '@/lib/utils'
import type { AuthUser, CoordinatorKpi, NotificationKind } from '@/lib/types'

const kpiTone: Record<CoordinatorKpi['tone'], string> = {
  navy: 'bg-navy text-white',
  gold: 'bg-gold/15 text-gold-dark',
  success: 'bg-success-light text-success',
  danger: 'bg-danger-light text-danger',
  warning: 'bg-warning-light text-warning-deep',
  info: 'bg-info-light text-info',
}

const barTone: Record<CoordinatorKpi['tone'], string> = {
  navy: 'bg-navy',
  gold: 'bg-gold-dark',
  success: 'bg-success',
  danger: 'bg-danger',
  warning: 'bg-warning-deep',
  info: 'bg-info',
}

const activityBorder: Record<NotificationKind, string> = {
  clash: 'border-l-danger',
  published: 'border-l-navy',
  assignment: 'border-l-info',
  approval: 'border-l-success',
  info: 'border-l-ink-muted',
}

function KpiCard({ kpi }: { kpi: CoordinatorKpi }) {
  const Icon = kpi.icon
  const isDanger = kpi.tone === 'danger'
  const pct = kpi.fraction ? Math.round((kpi.fraction.current / kpi.fraction.total) * 100) : 0
  return (
    <Card
      className={cn(
        'relative flex flex-col gap-3 p-5',
        isDanger && 'border-danger/40 bg-danger/[0.03]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
            kpiTone[kpi.tone],
          )}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        {isDanger && <Badge variant="danger" dot>Needs attention</Badge>}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">
          {kpi.label}
        </p>
        <p className="mt-0.5 text-2xl font-black tracking-tight text-ink">{kpi.value}</p>
        <p className="mt-0.5 truncate text-xs text-ink-muted">{kpi.hint}</p>
      </div>
      {kpi.fraction && (
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-surface"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${kpi.fraction.current} of ${kpi.fraction.total}`}
        >
          <div className={cn('h-full rounded-full', barTone[kpi.tone])} style={{ width: `${pct}%` }} />
        </div>
      )}
    </Card>
  )
}

function ExamDaysStrip() {
  const { examDays, cycleLabel } = mockCoordinatorDashboard()
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Upcoming Exam Days</CardTitle>
        <Link
          to="/calendar"
          className="flex items-center gap-1 text-xs font-bold text-navy hover:text-navy-deep"
        >
          Open calendar <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </CardHeader>
      <CardContent className="pt-1">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {examDays.map((day, i) => (
            <Link
              key={day.id}
              to="/calendar"
              className={cn(
                'flex w-[5.5rem] shrink-0 flex-col items-center gap-1.5 rounded-lg border border-line px-2 py-3 text-center transition-all hover:-translate-y-0.5 hover:border-gold/50 hover:shadow-soft',
                i === 0 && 'ring-1 ring-gold/60',
                day.hasClash && 'border-danger/40',
              )}
            >
              <span className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">
                {day.dayLabel}
              </span>
              <span className={cn('text-sm font-black', day.isExamDay ? 'text-ink' : 'text-ink-muted')}>
                {day.dateLabel}
              </span>
              {day.isExamDay ? (
                <span className="flex items-center gap-1">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                      day.hasClash
                        ? 'bg-danger-light text-danger'
                        : 'bg-success-light text-success',
                    )}
                  >
                    {day.hasClash && <Siren className="h-3 w-3" aria-hidden="true" />}
                    {day.sessionCount} sessions
                  </span>
                </span>
              ) : (
                <span className="text-[11px] text-ink-muted/70">No exams</span>
              )}
            </Link>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-muted">
          {cycleLabel} cycle · sessions per day shown on exam days. Click a day to open the
          Datesheet Calendar.
        </p>
      </CardContent>
    </Card>
  )
}

function ActivityFeed() {
  const { activity } = mockCoordinatorDashboard()
  const sorted = [...activity].sort((a, b) => a.minutesAgo - b.minutesAgo)
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Recent Activity</CardTitle>
        <span className="text-xs font-semibold text-ink-muted">{sorted.length} events</span>
      </CardHeader>
      <CardContent className="pt-1">
        <ul className="space-y-1">
          {sorted.map((item) => {
            const Icon = kindIcon[item.kind]
            return (
              <li
                key={item.id}
                className={cn(
                  'flex items-start gap-3 rounded-md border-l-2 px-3 py-2.5 transition-colors hover:bg-surface',
                  activityBorder[item.kind],
                )}
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface">
                  <Icon className={cn('h-4 w-4', kindTone[item.kind])} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">{item.title}</span>
                  <span className="mt-0.5 block text-xs leading-4 text-ink-muted">
                    {item.detail}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] font-medium text-ink-muted/70">
                  {timeAgo(item.minutesAgo)}
                </span>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}

function ClashesCard() {
  const { clashes } = mockCoordinatorDashboard()
  const resolve = (code: string) =>
    toast({
      variant: 'info',
      title: 'Resolution flow coming soon',
      description: `${code} will deep-link to the Clash Center in a later step.`,
    })
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Clashes Requiring Attention</CardTitle>
        <Badge variant="danger" dot>{clashes.length}</Badge>
      </CardHeader>
      <CardContent className="pt-1">
        <ul className="space-y-2">
          {clashes.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-3 rounded-md border border-line bg-card px-3 py-2.5"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">
                  {c.code} · {c.title}
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-muted">
                  <span className="font-semibold text-danger">{c.affected} students</span>
                  <span>· {c.dateLabel} · {c.slot}</span>
                </span>
              </span>
              <Badge variant={c.kind === 'same-slot' ? 'danger' : 'warning'}>
                {c.kind === 'same-slot' ? 'Same-slot' : 'Same-day'}
              </Badge>
              <Button variant="outline" size="sm" onClick={() => resolve(c.code)}>
                Resolve
              </Button>
            </li>
          ))}
        </ul>
        <Link
          to="/clashes"
          className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'mt-3 w-full')}
        >
          Open clash center <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </CardContent>
    </Card>
  )
}

function QuickActionsCard() {
  const { quickActions } = mockCoordinatorDashboard()
  const notifyComing = (label: string) =>
    toast({
      variant: 'info',
      title: 'Coming in a later step',
      description: `${label} will be wired up once the API modules exist.`,
    })
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-1">
        {quickActions.map((action) => {
          const Icon = action.icon
          const inner = (
            <>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy text-white">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-ink">
                  {action.label}
                </span>
                <span className="block text-xs text-ink-muted">{action.description}</span>
              </span>
            </>
          )
          const className =
            'group flex items-center gap-3 rounded-md border border-line bg-card px-3 py-3 transition-all hover:-translate-y-0.5 hover:border-gold/50 hover:shadow-soft'
          return action.path ? (
            <Link key={action.id} to={action.path} className={className}>
              {inner}
            </Link>
          ) : (
            <button
              key={action.id}
              type="button"
              onClick={() => notifyComing(action.label)}
              className={cn(className, 'w-full text-left')}
            >
              {inner}
            </button>
          )
        })}
      </CardContent>
    </Card>
  )
}

function DashboardSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-lg" />
        ))}
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <Skeleton className="h-44 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
        <div className="space-y-4 lg:col-span-2">
          <Skeleton className="h-72 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </div>
    </div>
  )
}

export function ExamCoordinatorDashboard({ user }: { user: AuthUser }) {
  const [loading, setLoading] = useState(true)
  const [pendingClashes, setPendingClashes] = useState<number | null>(null)
  const invigilators = useInvigilatorsStore((s) => s.invigilators)
  const invigilatorsLoaded = useInvigilatorsStore((s) => s.loaded)
  const data = mockCoordinatorDashboard()

  const loadClashKpi = useCallback(() => {
    let cancelled = false
    fetchClashes({ status: 'open', page_size: 1 })
      .then((list) => {
        if (!cancelled) setPendingClashes(list.summary.open)
      })
      .catch(() => {
        /* keep the mock fallback when the API is unreachable */
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => loadClashKpi(), [loadClashKpi])

  // Keep the open-clash KPI in step with the Clash Center / Scheduling Engine.
  useEffect(() => onScheduleChanged(loadClashKpi), [loadClashKpi])

  // Real invigilation numbers for the "Invigilators Assigned" KPI. The board
  // refreshes this store after every assignment write, so this stays in step.
  useEffect(() => {
    if (!invigilatorsLoaded) void useInvigilatorsStore.getState().refresh()
  }, [invigilatorsLoaded])

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 700)
    return () => clearTimeout(timer)
  }, [])

  const invigilatorsAssigned = invigilators.reduce((sum, i) => sum + i.assigned_count, 0)
  const invigilatorsCapacity = invigilators.reduce((sum, i) => sum + i.max_assignments_per_cycle, 0)

  const kpis = data.kpis.map((kpi) => {
    if (kpi.id === 'kpi-clashes' && pendingClashes !== null) {
      return { ...kpi, value: String(pendingClashes), hint: 'open clashes in the current cycle' }
    }
    if (kpi.id === 'kpi-invigilators' && invigilatorsLoaded && invigilatorsCapacity > 0) {
      return {
        ...kpi,
        value: `${invigilatorsAssigned}/${invigilatorsCapacity}`,
        hint: 'duty slots filled',
        fraction: { current: invigilatorsAssigned, total: invigilatorsCapacity },
      }
    }
    return kpi
  })

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl">
        <DashboardSkeleton />
      </div>
    )
  }

  if (!data.hasActiveCycle) {
    return (
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-ink">
              Welcome back, {firstName(user.name)}
            </h1>
            <p className="mt-1 text-sm text-ink-muted">Exam cycle overview.</p>
          </div>
          <Badge variant="gold" dot>{roleLabels[user.role]}</Badge>
        </div>
        <div className="mt-6">
          <EmptyState
            title="No active exam cycle"
            description="Start a new one to schedule papers, assign invigilators and publish the datesheet."
            icon={<CalendarDays className="h-7 w-7" />}
            action={
              <Link to="/scheduling" className={buttonVariants({ variant: 'primary', size: 'sm' })}>
                Start a new cycle
              </Link>
            }
          />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-ink">
            Welcome back, {firstName(user.name)}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Here&apos;s what&apos;s happening in the {data.cycleLabel} exam cycle.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="success" dot>Cycle active</Badge>
          <Badge variant="gold" dot>{roleLabels[user.role]}</Badge>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.id} kpi={kpi} />
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <ExamDaysStrip />
          <ActivityFeed />
        </div>
        <div className="space-y-4 lg:col-span-2">
          <ClashesCard />
          <QuickActionsCard />
        </div>
      </div>

      <p className="mt-6 flex items-center gap-1.5 text-xs text-ink-muted">
        <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden="true" />
        Pending Clashes is live from the clash API (Step 10); the remaining tiles are wired in later
        steps.
      </p>
    </div>
  )
}
