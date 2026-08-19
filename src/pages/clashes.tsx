import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  ExternalLink,
  Loader2,
  Radar,
  RefreshCw,
  Siren,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Modal } from '@/components/ui/modal'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast-store'
import {
  fetchCatalog,
  fetchClashes,
  overrideClash,
  resolveClash,
  scanClashes,
} from '@/services/scheduling-service'
import { formatDateLabel } from '@/config/scheduling-data'
import { onScheduleChanged, notifyScheduleChanged } from '@/lib/schedule-sync'
import { timeAgo } from '@/lib/visuals'
import { cn } from '@/lib/utils'
import type {
  ApiClashEntryRef,
  ApiClashRecord,
  ApiClashScanResult,
  SchedulingCatalog,
} from '@/lib/types'

const LAST_SCAN_KEY = 'ses.clashes.lastScan'

type ClashTab = 'same_slot' | 'same_day'
type StatusFilter = 'open' | 'overridden' | 'resolved' | 'all'
type GroupStatus = 'open' | 'overridden' | 'resolved' | 'mixed'
type GroupSeverity = 'critical' | 'high' | 'medium'

interface ClashGroup {
  key: string
  type: ClashTab
  records: ApiClashRecord[]
  entries: ApiClashEntryRef[]
  students: Array<{ id: string; reg_id: string; name: string }>
  severity: GroupSeverity
  status: GroupStatus
}

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'open', label: 'Open' },
  { value: 'overridden', label: 'Overridden' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'all', label: 'All' },
]

function readLastScan(): string | null {
  try {
    return localStorage.getItem(LAST_SCAN_KEY)
  } catch {
    return null
  }
}

function groupClashes(clashes: ApiClashRecord[], type: ClashTab): ClashGroup[] {
  const byKey = new Map<string, ClashGroup>()
  const ordered: ClashGroup[] = []

  for (const record of clashes) {
    if (record.type !== type) continue
    const key = type === 'same_slot' ? [...record.schedule_entry_ids].sort().join('|') : record.student.id
    let group = byKey.get(key)
    if (!group) {
      group = {
        key,
        type,
        records: [],
        entries: [],
        students: [],
        severity: 'medium',
        status: 'open',
      }
      byKey.set(key, group)
      ordered.push(group)
    }
    group.records.push(record)
    for (const entry of record.entries) {
      if (!group.entries.some((e) => e.id === entry.id)) group.entries.push(entry)
    }
    if (!group.students.some((s) => s.id === record.student.id)) {
      group.students.push(record.student)
    }
  }

  for (const group of ordered) {
    group.severity =
      group.students.length > 5
        ? 'critical'
        : group.records.some((r) => r.severity === 'high')
          ? 'high'
          : 'medium'
    const statuses = new Set(group.records.map((r) => r.status))
    group.status = statuses.size === 1 ? (statuses.values().next().value as GroupStatus) : 'mixed'
  }

  return ordered
}

function severityBadge(severity: GroupSeverity, affected: number): { label: string; variant: 'danger' | 'warning' } {
  if (affected > 5) return { label: 'Critical', variant: 'danger' }
  if (severity === 'high') return { label: 'High', variant: 'danger' }
  return { label: 'Medium', variant: 'warning' }
}

function statusBadge(status: GroupStatus): { label: string; variant: 'danger' | 'warning' | 'success' | 'default' } {
  switch (status) {
    case 'open':
      return { label: 'Open', variant: 'danger' }
    case 'overridden':
      return { label: 'Overridden', variant: 'warning' }
    case 'resolved':
      return { label: 'Resolved', variant: 'success' }
    case 'mixed':
      return { label: 'Mixed', variant: 'default' }
  }
}

function scanAgoLabel(iso: string | null): string {
  if (!iso) return 'No scan recorded yet'
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  return `last scanned ${timeAgo(minutes)}`
}

// ── Group row ────────────────────────────────────────────────────────────────

function GroupRow({
  group,
  expanded,
  onToggle,
  rescheduleHref,
  splitHref,
  onOverride,
  onResolve,
}: {
  group: ClashGroup
  expanded: boolean
  onToggle: () => void
  rescheduleHref: (record: ApiClashRecord) => string | null
  splitHref: (record: ApiClashRecord) => string | null
  onOverride: (records: ApiClashRecord[]) => void
  onResolve: (records: ApiClashRecord[]) => void
}) {
  const badge = severityBadge(group.severity, group.students.length)
  const status = statusBadge(group.status)
  const isSameSlot = group.type === 'same_slot'
  const firstEntry = group.entries[0]
  const subtitle = isSameSlot && firstEntry
    ? `${formatDateLabel(firstEntry.date)} · ${firstEntry.time_slot_label}`
    : `${group.records.length} overloaded day${group.records.length === 1 ? '' : 's'} · ${group.entries.length} papers`

  const paperLinks = (record: ApiClashRecord) => {
    const reschedule = rescheduleHref(record)
    const split = splitHref(record)
    return (
      <>
        {reschedule ? (
          <Link to={reschedule} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Reschedule
          </Link>
        ) : (
          <Button variant="secondary" size="sm" disabled title="No paper entries to reschedule">
            Reschedule
          </Button>
        )}
        {split ? (
          <Link to={split} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /> Split
          </Link>
        ) : (
          <Button variant="secondary" size="sm" disabled title="No paper entries to split">
            Split
          </Button>
        )}
      </>
    )
  }

  return (
    <Card className={cn('overflow-hidden', group.status === 'open' && expanded && 'border-danger/40')}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface/70"
      >
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
            group.severity === 'medium' ? 'bg-warning-light' : 'bg-danger-light',
          )}
        >
          <Siren
            className={cn(
              'h-4 w-4',
              group.severity === 'medium' ? 'text-warning-deep' : 'text-danger',
            )}
            aria-hidden="true"
          />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-sm font-bold text-ink">
              {isSameSlot ? group.entries.map((e) => e.course_code).join(' + ') : group.students[0]?.name}
            </span>
            <Badge variant={badge.variant} dot>{badge.label}</Badge>
            {!isSameSlot && group.students[0]?.reg_id && (
              <span className="text-xs font-medium text-ink-muted">{group.students[0].reg_id}</span>
            )}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-muted">
            {isSameSlot ? (
              <>
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" /> {subtitle}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" /> {firstEntry?.time_slot_label}
                </span>
              </>
            ) : (
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" /> {subtitle}
              </span>
            )}
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-2">
          <Badge variant="default">
            <Users className="h-3.5 w-3.5" aria-hidden="true" /> {group.students.length} affected
          </Badge>
          <Badge variant={status.variant}>{status.label}</Badge>
          <ChevronDown
            className={cn(
              'h-4 w-4 text-ink-muted transition-transform duration-150',
              expanded && 'rotate-180',
            )}
            aria-hidden="true"
          />
        </span>
      </button>

      {expanded && (
        <div className="border-t border-line bg-surface/40 px-4 py-3.5 animate-[modalIn_160ms_ease-out]">
          <p className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">
            {isSameSlot ? 'Affected students' : 'Overloaded days'}
          </p>

          {isSameSlot ? (
            <ul className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {group.students.map((student) => (
                <li
                  key={student.id}
                  className="flex items-center gap-2 rounded-md border border-line bg-card px-3 py-2 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate font-semibold text-ink">{student.name}</span>
                  <span className="shrink-0 text-xs font-medium text-ink-muted">{student.reg_id}</span>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {group.records.map((record) => (
                <li
                  key={record.id}
                  className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-line bg-card px-3 py-2 text-sm"
                >
                  <span className="font-semibold text-ink">{formatDateLabel(record.entries[0]?.date ?? '')}</span>
                  <span className="text-xs text-ink-muted">·</span>
                  <span className="text-xs text-ink-muted">
                    {record.entries.map((e) => e.course_code).join(', ')} · {record.entries[0]?.time_slot_label}
                  </span>
                  <span className="ml-auto flex gap-1.5">{paperLinks(record)}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {paperLinks(group.records[0])}
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => onOverride(group.records)} disabled={group.status !== 'open'}>
                Override &amp; accept
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onResolve(group.records)} disabled={group.status !== 'open'}>
                Resolve
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export function ClashesPage() {
  const [catalog, setCatalog] = useState<SchedulingCatalog | null>(null)
  const [list, setList] = useState<Awaited<ReturnType<typeof fetchClashes>> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [tab, setTab] = useState<ClashTab>('same_slot')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const [scanning, setScanning] = useState(false)
  const [lastScannedAt, setLastScannedAt] = useState<string | null>(readLastScan)

  const [action, setAction] = useState<{ kind: 'override' | 'resolve'; records: ApiClashRecord[] } | null>(null)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [cat, clashList] = await Promise.all([
        fetchCatalog(),
        fetchClashes({ status: 'all', page_size: 200 }),
      ])
      setCatalog(cat)
      setList(clashList)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clashes')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Stay in sync with the Scheduling Engine and Calendar — refresh whenever a
  // schedule entry or the cycle is changed elsewhere.
  useEffect(() => onScheduleChanged(() => void load()), [load])

  const groups = useMemo(
    () => groupClashes(list?.clashes ?? [], tab),
    [list, tab],
  )

  const filteredGroups = useMemo(
    () =>
      statusFilter === 'all'
        ? groups
        : groups.filter((g) => g.status === statusFilter),
    [groups, statusFilter],
  )

  const summary = list?.summary
  const openCount = summary?.open ?? 0
  const overriddenCount = summary?.overridden ?? 0
  const resolvedCount = summary?.resolved ?? 0

  const toggleGroup = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const handleScan = async () => {
    setScanning(true)
    try {
      const [result] = await Promise.all([
        scanClashes(catalog?.cycle?.id),
        new Promise((r) => setTimeout(r, 1400)),
      ]) as [ApiClashScanResult, unknown]
      const scannedAt = result.scanned_at ?? new Date().toISOString()
      setLastScannedAt(scannedAt)
      try {
        localStorage.setItem(LAST_SCAN_KEY, scannedAt)
      } catch {
        /* ignore */
      }
      await load()
      notifyScheduleChanged()
      toast({
        variant: 'success',
        title: 'Scan complete',
        description:
          result.created > 0 || result.resolved > 0
            ? `${result.created} new clash(es) · ${result.resolved} resolved · ${result.unchanged} unchanged`
            : 'No changes — every known clash is still current.',
      })
    } catch (err) {
      toast({
        variant: 'danger',
        title: 'Scan failed',
        description: err instanceof Error ? err.message : 'Could not re-scan the cycle.',
      })
    } finally {
      setScanning(false)
    }
  }

  const submitAction = async () => {
    if (!action || !reason.trim()) return
    setSubmitting(true)
    try {
      for (const record of action.records) {
        if (action.kind === 'override') await overrideClash(record.id, reason.trim())
        else await resolveClash(record.id, reason.trim())
      }
      const count = action.records.length
      toast({
        variant: 'success',
        title: action.kind === 'override' ? 'Clash overridden' : 'Clash resolved',
        description:
          count === 1
            ? 'The clash record has been updated.'
            : `${count} clash records have been updated.`,
      })
      setAction(null)
      setReason('')
      await load()
      notifyScheduleChanged()
    } catch (err) {
      toast({
        variant: 'danger',
        title: 'Action failed',
        description: err instanceof Error ? err.message : 'Unexpected error',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const rescheduleHref = (record: ApiClashRecord): string | null => {
    const id = record.entries[0]?.id
    return id ? `/scheduling?tab=manual&entry=${encodeURIComponent(id)}` : null
  }
  const splitHref = (record: ApiClashRecord): string | null => {
    const id = record.entries[0]?.id
    return id ? `/scheduling?tab=manual&entry=${encodeURIComponent(id)}` : null
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl">
        <div className="space-y-3">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="mt-6 h-20 rounded-lg" />
        <div className="mt-6 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-ink">Clash Detection Center</h1>
          <p className="mt-1 text-sm text-ink-muted">Review and resolve detected timing and room conflicts.</p>
        </div>
        <Card className="mt-6">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Siren className="h-8 w-8 text-danger" aria-hidden="true" />
            <div>
              <p className="font-bold text-ink">Could not load clash data</p>
              <p className="mt-1 text-sm text-ink-muted">{error}</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => void load()}>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const tabs: Array<{ value: ClashTab; label: string; count: number }> = [
    { value: 'same_slot', label: 'Same-Slot Clashes', count: summary?.same_slot ?? 0 },
    { value: 'same_day', label: 'Same-Day Overload', count: summary?.same_day ?? 0 },
  ]

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-ink">Clash Detection Center</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Review every conflicting exam in the {catalog?.cycle?.name ?? 'current'} cycle, then reschedule,
            split or accept with a written justification.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void handleScan()} loading={scanning} disabled={scanning}>
          {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Radar className="h-3.5 w-3.5" aria-hidden="true" />}
          {scanning ? 'Scanning…' : 'Re-scan now'}
        </Button>
      </div>

      <div className="mt-6 rounded-lg border border-line bg-card px-5 py-4 shadow-soft">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'flex h-11 w-11 items-center justify-center rounded-full',
                openCount > 0 ? 'bg-danger-light animate-badge-pulse' : 'bg-success-light',
              )}
            >
              <Siren
                className={cn('h-5 w-5', openCount > 0 ? 'text-danger' : 'text-success')}
                aria-hidden="true"
              />
            </span>
            <div>
              <p className="text-2xl font-black tracking-tight text-ink">{openCount}</p>
              <p className="text-xs font-semibold text-ink-muted">
                {openCount === 1 ? 'active clash' : 'active clashes'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="warning" dot>{overriddenCount} overridden</Badge>
            <Badge variant="success" dot>{resolvedCount} resolved</Badge>
          </div>
          <p className="ml-auto flex items-center gap-1.5 text-xs font-medium text-ink-muted">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {scanAgoLabel(lastScannedAt)}
          </p>
        </div>
        {scanning && (
          <div className="mt-3 flex items-center gap-3 rounded-md border border-navy/15 bg-navy/5 px-4 py-3">
            <span className="relative flex h-3.5 w-3.5 shrink-0">
              <span className="absolute inline-flex h-full w-full rounded-full bg-navy/40 animate-[scanPing_1.2s_cubic-bezier(0,0,0.2,1)_infinite]" />
              <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-navy" />
            </span>
            <p className="text-sm font-semibold text-navy">
              Scanning the cycle for conflicts — this may take a moment…
            </p>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 overflow-x-auto border-b border-line">
          {tabs.map((t) => {
            const active = t.value === tab
            return (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setTab(t.value)
                  setExpanded(new Set())
                }}
                className={cn(
                  '-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors duration-150',
                  active ? 'border-gold text-navy' : 'border-transparent text-ink-muted hover:border-line hover:text-ink',
                )}
              >
                {t.label}
                <span
                  className={cn(
                    'flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold',
                    t.count > 0 ? 'bg-danger text-white' : 'bg-surface text-ink-muted',
                  )}
                >
                  {t.count}
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-1 rounded-md border border-line bg-card p-1">
          {STATUS_FILTERS.map((filter) => {
            const active = filter.value === statusFilter
            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => setStatusFilter(filter.value)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                  active ? 'bg-navy text-white shadow-soft' : 'text-ink-muted hover:bg-surface hover:text-ink',
                )}
              >
                {filter.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-4">
        {filteredGroups.length === 0 ? (
          statusFilter === 'open' && openCount === 0 ? (
            <Card>
              <CardContent className="pt-5">
                <EmptyState
                  title="No active clashes — the datesheet is clean"
                  description={`No ${tab === 'same_slot' ? 'same-slot' : 'same-day'} conflicts were detected in the current cycle. Run a scan anytime to confirm nothing slipped through.`}
                  icon={<CheckCircle2 className="h-7 w-7 text-success" />}
                  action={
                    <Button variant="primary" size="sm" onClick={() => void handleScan()} loading={scanning}>
                      {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Radar className="h-3.5 w-3.5" aria-hidden="true" />}
                      Re-scan now
                    </Button>
                  }
                />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-5">
                <EmptyState
                  title={`No ${statusFilter} ${tab === 'same_slot' ? 'same-slot' : 'same-day'} clashes`}
                  description="Nothing matches the current filter — try another status or run a fresh scan."
                  icon={<CheckCircle2 className="h-7 w-7 text-success" />}
                />
              </CardContent>
            </Card>
          )
        ) : (
          <div className="space-y-3">
            {filteredGroups.map((group) => (
              <GroupRow
                key={group.key}
                group={group}
                expanded={expanded.has(group.key)}
                onToggle={() => toggleGroup(group.key)}
                rescheduleHref={rescheduleHref}
                splitHref={splitHref}
                onOverride={(records) => {
                  setAction({ kind: 'override', records })
                  setReason('')
                }}
                onResolve={(records) => {
                  setAction({ kind: 'resolve', records })
                  setReason('')
                }}
              />
            ))}
          </div>
        )}
      </div>

      <p className="mt-6 flex items-center gap-1.5 text-xs text-ink-muted">
        <AlertTriangle className="h-3.5 w-3.5 text-warning-deep" aria-hidden="true" />
        Rescheduling a paper keeps the old slot until you save the new one in the Scheduling Engine, and
        overrides are recorded in the audit log.
      </p>

      <Modal
        open={Boolean(action)}
        onClose={() => setAction(null)}
        size="md"
        title={action?.kind === 'override' ? 'Override & accept this clash?' : 'Resolve this clash?'}
        description={
          action?.kind === 'override'
            ? 'Accepting the clash as-is means affected students sit both papers. A typed justification is required and will be recorded.'
            : 'Marking it resolved means the conflict no longer exists — typically after a paper was rescheduled.'
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setAction(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              variant={action?.kind === 'override' ? 'danger' : 'primary'}
              onClick={() => void submitAction()}
              disabled={!reason.trim() || submitting}
              loading={submitting}
            >
              {action?.kind === 'override' ? 'Override & accept' : 'Resolve clash'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="max-h-40 overflow-y-auto rounded-md border border-line bg-surface px-3 py-2 text-sm">
            {(action?.records ?? []).map((record) => (
              <p key={record.id} className="py-0.5 text-ink-muted">
                {record.student.name} · {record.student.reg_id} —{' '}
                {record.entries.map((e) => e.course_code).join(', ')}
              </p>
            ))}
          </div>
          <label className="block text-sm font-medium text-ink" htmlFor="clash-reason">
            Justification {action?.kind === 'override' ? '(required)' : '(required)'}
          </label>
          <textarea
            id="clash-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            autoFocus
            placeholder={
              action?.kind === 'override'
                ? 'e.g. Room swap approved by HOD; both papers stay in the morning slot.'
                : 'e.g. CS-202 moved to Midday slot — no overlap remains.'
            }
            className="w-full resize-none rounded-md border border-line bg-card px-3 py-2 text-sm text-ink outline-none transition-all duration-150 hover:border-navy-muted/60 focus:border-navy focus:ring-2 focus:ring-navy/15"
          />
        </div>
      </Modal>
    </div>
  )
}
