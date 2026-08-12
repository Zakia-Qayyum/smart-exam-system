import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Download,
  Megaphone,
  Siren,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { StatusChip } from '@/components/ui/status-chip'
import { EmptyState } from '@/components/ui/empty-state'
import { Modal } from '@/components/ui/modal'
import { Select } from '@/components/ui/select'
import { SkeletonText } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast-store'
import {
  fetchCalendarSummary,
  fetchCatalog,
  fetchClashes,
  fetchScheduleEntries,
  publishCycle,
} from '@/services/scheduling-service'
import type {
  ApiCalendarDay,
  ApiCalendarSummary,
  ApiDepartment,
  ApiScheduleEntry,
  ApiTimeSlot,
  SchedulingCatalog,
} from '@/lib/types'
import { cn } from '@/lib/utils'

type ViewMode = 'month' | 'week'

const DOT_COLORS = [
  '#0b2447',
  '#c9a227',
  '#1e8e5a',
  '#2563eb',
  '#d64545',
  '#e0a800',
  '#5b7aa5',
  '#7c3aed',
  '#0d9488',
  '#db2777',
]

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function parseDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`)
}

function isoFromDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function dayLabel(iso: string): string {
  return parseDate(iso).toLocaleDateString('en-US', { weekday: 'long' })
}

function longDateLabel(iso: string): string {
  return parseDate(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function shortDateLabel(iso: string): string {
  return parseDate(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function csvCell(value: string | number): string {
  const s = String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function downloadCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const lines = [header, ...rows].map((row) => row.map(csvCell).join(','))
  const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

// ── Department multi-select ────────────────────────────────────────────────

function DepartmentMultiSelect({
  departments,
  selected,
  onChange,
}: {
  departments: ApiDepartment[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const [open, setOpen] = useState(false)

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-12 w-full items-center justify-between gap-2 rounded-md border bg-card px-3 text-left text-sm transition-all duration-150',
          'hover:border-navy-muted/60 focus:outline-none focus:ring-2 focus:ring-navy/15',
          open ? 'border-navy ring-2 ring-navy/15' : 'border-line',
        )}
      >
        <span className="truncate">
          {selected.length === 0 ? (
            <span className="text-ink-muted">All departments</span>
          ) : (
            <span className="font-semibold text-navy">
              {selected.length === departments.length
                ? 'All departments'
                : `${selected.length} department${selected.length > 1 ? 's' : ''}`}
            </span>
          )}
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-ink-muted transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-md border border-line bg-card shadow-lift">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <span className="text-xs font-semibold text-ink-muted">Filter by department</span>
            <div className="flex gap-3 text-xs font-medium text-navy">
              <button type="button" onClick={() => onChange([])} className="hover:underline">
                All
              </button>
              <button type="button" onClick={() => onChange(departments.map((d) => d.id))} className="hover:underline">
                None
              </button>
            </div>
          </div>
          <ul className="max-h-64 overflow-auto p-1">
            {departments.map((dept, index) => {
              const checked = selected.includes(dept.id)
              return (
                <li key={dept.id}>
                  <button
                    type="button"
                    onClick={() => toggle(dept.id)}
                    className="flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-sm transition-colors hover:bg-surface"
                  >
                    <span
                      aria-hidden="true"
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: DOT_COLORS[index % DOT_COLORS.length] }}
                    />
                    <span className="flex-1 truncate text-left">{dept.name}</span>
                    <span
                      aria-hidden="true"
                      className={cn(
                        'flex h-4 w-4 items-center justify-center rounded-sm border text-[10px] font-bold',
                        checked ? 'border-navy bg-navy text-white' : 'border-line bg-card text-transparent',
                      )}
                    >
                      ✓
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

// ── Filter toggle ──────────────────────────────────────────────────────────

function FilterToggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex h-12 w-full items-center justify-between gap-3 rounded-md border border-line bg-card px-3 text-sm"
    >
      <span className="flex items-center gap-2 font-medium text-ink">
        <Siren className={cn('h-4 w-4', checked ? 'text-danger' : 'text-ink-muted')} />
        Show only conflicts
      </span>
      <span
        aria-hidden="true"
        className={cn(
          'relative h-5 w-9 shrink-0 rounded-full transition-colors',
          checked ? 'bg-danger' : 'bg-line',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all',
            checked ? 'left-[18px]' : 'left-0.5',
          )}
        />
      </span>
    </button>
  )
}

// ── Day drawer ─────────────────────────────────────────────────────────────

function DayDrawer({
  date,
  entries,
  openClashEntryIds,
  onClose,
}: {
  date: string
  entries: ApiScheduleEntry[]
  openClashEntryIds: Set<string>
  onClose: () => void
}) {
  if (!date) return null

  const ordered = [...entries].sort((a, b) => {
    if (a.time_slot_label !== b.time_slot_label) return a.time_slot_label.localeCompare(b.time_slot_label)
    return a.course_code.localeCompare(b.course_code)
  })

  const exportDay = () => {
    downloadCsv(
      `datesheet-${date}.csv`,
      ['Course Code', 'Course', 'Slot', 'Room', 'Room Capacity', 'Enrolled', 'Invigilators', 'Status'],
      ordered.map((e) => [
        e.course_code,
        e.course_title,
        e.time_slot_label,
        e.room_name,
        e.room_capacity,
        e.enrolled_count,
        e.invigilators.map((i) => i.name).join('; ') || 'TBA',
        e.status,
      ]),
    )
    toast({ title: 'Export started', description: `Downloading ${ordered.length} papers for ${longDateLabel(date)}.`, variant: 'info' })
  }

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-navy-deep/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Day details"
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-card shadow-lift animate-[drawerIn_220ms_ease-out]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {dayLabel(date)}
            </p>
            <h2 className="mt-0.5 text-lg font-bold text-ink">{shortDateLabel(date)}</h2>
            <p className="mt-0.5 text-sm text-ink-muted">
              {ordered.length} paper{ordered.length === 1 ? '' : 's'} this day
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-surface hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {ordered.length === 0 ? (
            <EmptyState
              title="No papers on this day"
              description="There are no exams scheduled for this date."
            />
          ) : (
            <ul className="space-y-3">
              {ordered.map((entry) => {
                const conflicted = openClashEntryIds.has(entry.id)
                return (
                  <li
                    key={entry.id}
                    className={cn(
                      'rounded-lg border p-4',
                      conflicted ? 'border-danger/40 bg-danger-light/40' : 'border-line bg-card',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-ink">{entry.course_code}</span>
                          {conflicted && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-danger">
                              <AlertTriangle className="h-3.5 w-3.5" /> Clash
                            </span>
                          )}
                        </div>
                        <p className="truncate text-sm text-ink-muted">{entry.course_title}</p>
                      </div>
                      <StatusChip
                        status={entry.status === 'needs_review' ? 'clash' : 'no-clash'}
                        label={entry.status === 'needs_review' ? 'Needs review' : 'Scheduled'}
                      />
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                      <div>
                        <dt className="text-xs font-medium text-ink-muted">Time</dt>
                        <dd className="font-semibold text-ink">{entry.time_slot_label}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-ink-muted">Room</dt>
                        <dd className="font-semibold text-ink">{entry.room_name}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-ink-muted">Invigilators</dt>
                        <dd className="font-semibold text-ink">
                          {entry.invigilators.length > 0
                            ? entry.invigilators.map((i) => i.name).join(', ')
                            : 'TBA'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-ink-muted">Enrolled</dt>
                        <dd className="font-semibold text-ink">{entry.enrolled_count} students</dd>
                      </div>
                    </dl>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-line p-4">
          <Button variant="primary" className="w-full" onClick={exportDay} disabled={ordered.length === 0}>
            <Download className="h-4 w-4" />
            Export this day
          </Button>
        </div>
      </aside>
    </div>,
    document.body,
  )
}

// ── Month grid cell ────────────────────────────────────────────────────────

function MonthCell({
  day,
  count,
  departmentIds,
  hasClashes,
  needsReview,
  inWindow,
  dimmed,
  onSelect,
}: {
  day: string
  count: number
  departmentIds: string[]
  hasClashes: boolean
  needsReview: number
  inWindow: boolean
  dimmed: boolean
  onSelect: (day: string) => void
}) {
  const d = parseDate(day)
  return (
    <button
      type="button"
      onClick={() => onSelect(day)}
      disabled={!inWindow}
      className={cn(
        'group flex min-h-24 flex-col rounded-lg border p-2 text-left transition-all duration-150',
        inWindow
          ? 'cursor-pointer border-line bg-card hover:border-navy/50 hover:shadow-soft'
          : 'border-transparent bg-surface/60',
        dimmed && inWindow && 'opacity-45',
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <span
          className={cn(
            'text-xs font-semibold',
            inWindow ? 'text-ink' : 'text-ink-muted',
          )}
        >
          {d.getUTCDate()}
        </span>
        {inWindow && count > 0 && (
          <span
            className={cn(
              'flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold',
              hasClashes ? 'bg-danger text-white' : 'bg-navy text-white',
            )}
          >
            {count}
          </span>
        )}
      </div>

      {inWindow && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {departmentIds.slice(0, 6).map((deptId, index) => (
            <span
              key={deptId}
              aria-hidden="true"
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: DOT_COLORS[index % DOT_COLORS.length] }}
            />
          ))}
          {departmentIds.length > 6 && (
            <span className="text-[10px] font-semibold text-ink-muted">+{departmentIds.length - 6}</span>
          )}
        </div>
      )}

      {inWindow && needsReview > 0 && (
        <span className="mt-auto pt-1 text-[10px] font-semibold text-danger">{needsReview} clash</span>
      )}
    </button>
  )
}

// ── Week view cell ─────────────────────────────────────────────────────────

function WeekCell({
  entries,
  openClashEntryIds,
  dimmed,
  onSelect,
}: {
  entries: ApiScheduleEntry[]
  openClashEntryIds: Set<string>
  dimmed: boolean
  onSelect: (day: string) => void
}) {
  const date = entries[0]?.date ?? ''
  const conflicted = entries.some((e) => openClashEntryIds.has(e.id))
  return (
    <button
      type="button"
      onClick={() => date && onSelect(date)}
      className={cn(
        'flex min-h-28 flex-col gap-1 rounded-lg border p-2 text-left transition-all duration-150',
        'cursor-pointer border-line bg-card hover:border-navy/50 hover:shadow-soft',
        conflicted && 'border-dashed border-danger/70 animate-[clashPulse_1s_ease-out_1]',
        dimmed && 'opacity-45',
      )}
    >
      {entries.length === 0 ? (
        <span className="m-auto text-xs text-ink-muted">—</span>
      ) : (
        entries.slice(0, 4).map((entry) => (
          <div key={entry.id} className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-xs font-bold text-ink">{entry.course_code}</span>
              {openClashEntryIds.has(entry.id) && (
                <AlertTriangle className="h-3 w-3 shrink-0 text-danger" aria-label="Has open clash" />
              )}
            </div>
            <div className="truncate text-[11px] text-ink-muted">
              {entry.room_name}
              <span className="mx-1">·</span>
              {entry.invigilators.length > 0 ? entry.invigilators.map((i) => initials(i.name)).join(', ') : 'TBA'}
            </div>
          </div>
        ))
      )}
      {entries.length > 4 && <span className="text-[10px] font-semibold text-ink-muted">+{entries.length - 4} more</span>}
    </button>
  )
}

// ── Main calendar ──────────────────────────────────────────────────────────

export function DatesheetCalendar() {
  const user = useAuthStore((s) => s.user)
  const canPublish = user?.role === 'exam-coordinator' || user?.role === 'admin'

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [catalog, setCatalog] = useState<SchedulingCatalog | null>(null)
  const [summary, setSummary] = useState<ApiCalendarSummary | null>(null)
  const [entries, setEntries] = useState<ApiScheduleEntry[]>([])
  const [openClashEntryIds, setOpenClashEntryIds] = useState<Set<string>>(new Set())

  const [view, setView] = useState<ViewMode>('month')
  const [departments, setDepartments] = useState<string[]>([])
  const [program, setProgram] = useState('')
  const [invigilatorId, setInvigilatorId] = useState('')
  const [conflictsOnly, setConflictsOnly] = useState(false)

  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [publishOpen, setPublishOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const cat = await fetchCatalog()
      setCatalog(cat)
      const cycleParam = cat.cycle?.id ? { cycle: cat.cycle.id } : {}
      const [cal, list, clashes] = await Promise.all([
        fetchCalendarSummary(cycleParam),
        fetchScheduleEntries({ page_size: 200, ...(cat.cycle?.id ? { cycle: cat.cycle.id } : {}) }),
        fetchClashes({ status: 'open', page_size: 200 }),
      ])
      setSummary(cal)
      setEntries(list.entries)
      setOpenClashEntryIds(new Set(clashes.clashes.flatMap((c) => c.schedule_entry_ids)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the datesheet calendar')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const entriesByDate = useMemo(() => {
    const map = new Map<string, ApiScheduleEntry[]>()
    for (const entry of entries) {
      const list = map.get(entry.date) ?? []
      list.push(entry)
      map.set(entry.date, list)
    }
    return map
  }, [entries])

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (departments.length > 0 && !departments.includes(entry.department_id)) return false
      if (program && entry.batch !== program) return false
      if (invigilatorId && !entry.invigilators.some((i) => i.id === invigilatorId)) return false
      if (conflictsOnly && !openClashEntryIds.has(entry.id)) return false
      return true
    })
  }, [entries, departments, program, invigilatorId, conflictsOnly, openClashEntryIds])

  const cycle = summary?.cycle ?? null

  // ── Month grid model ──
  const monthGrid = useMemo(() => {
    if (!cycle) return { cells: [] as Array<{ day: string; inWindow: boolean; count: number; departmentIds: string[]; hasClashes: boolean; needsReview: number; dimmed: boolean }>, monthLabel: '' }
    const start = parseDate(cycle.start_date)
    const firstOfMonth = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1))
    const endOfMonth = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0))
    const cells: Array<{ day: string; inWindow: boolean; count: number; departmentIds: string[]; hasClashes: boolean; needsReview: number; dimmed: boolean }> = []

    for (let d = new Date(firstOfMonth); d <= endOfMonth; d.setUTCDate(d.getUTCDate() + 1)) {
      const day = isoFromDate(d)
      const inWindow = day >= cycle.start_date && day <= cycle.end_date
      const dayEntries = inWindow ? filteredEntries.filter((e) => e.date === day) : []
      const dayMeta = summary?.days.find((meta: ApiCalendarDay) => meta.date === day)
      cells.push({
        day,
        inWindow,
        count: dayEntries.length,
        departmentIds: [...new Set(dayEntries.map((e) => e.department_id))],
        hasClashes: dayMeta?.has_clashes ?? false,
        needsReview: dayEntries.filter((e) => e.status === 'needs_review').length,
        dimmed: conflictsOnly && dayMeta ? dayEntries.length === 0 : false,
      })
    }

    const firstWeekday = firstOfMonth.getUTCDay()
    const padStart = Array.from({ length: firstWeekday }, (_, i) => ({
      day: `pad-${i}`,
      inWindow: false,
      count: 0,
      departmentIds: [],
      hasClashes: false,
      needsReview: 0,
      dimmed: false,
    }))
    const monthLabel = start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    return { cells: [...padStart, ...cells], monthLabel }
  }, [cycle, filteredEntries, summary, conflictsOnly])

  const timeSlots: ApiTimeSlot[] = useMemo(() => {
    if (catalog && catalog.time_slots.length > 0) return catalog.time_slots
    const byLabel = new Map<string, ApiTimeSlot>()
    for (const e of entries) {
      if (!byLabel.has(e.time_slot_label)) {
        byLabel.set(e.time_slot_label, { id: e.time_slot_id, label: e.time_slot_label, start_time: '', end_time: '' })
      }
    }
    return [...byLabel.values()]
  }, [catalog, entries])

  const weekDays = useMemo(() => {
    if (!cycle) return []
    const days: string[] = []
    const cursor = parseDate(cycle.start_date)
    while (isoFromDate(cursor) <= cycle.end_date) {
      days.push(isoFromDate(cursor))
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
    return days
  }, [cycle])

  const drawerEntries = selectedDate ? (entriesByDate.get(selectedDate) ?? []) : []
  const drawerVisibleEntries = drawerEntries.filter((entry) => {
    if (departments.length > 0 && !departments.includes(entry.department_id)) return false
    if (program && entry.batch !== program) return false
    if (invigilatorId && !entry.invigilators.some((i) => i.id === invigilatorId)) return false
    return true
  })

  const publish = async () => {
    if (!cycle) return
    setPublishing(true)
    try {
      const result = await publishCycle(cycle.id)
      setSummary((prev) => (prev ? { ...prev, cycle: result.cycle } : prev))
      setPublishOpen(false)
      toast({
        title: 'Datesheet published',
        description: `${result.cycle.name} is now live. Everyone has been notified and editing is locked.`,
        variant: 'success',
      })
    } catch (err) {
      toast({
        title: 'Publish failed',
        description: err instanceof Error ? err.message : 'Could not publish the datesheet.',
        variant: 'danger',
      })
    } finally {
      setPublishing(false)
    }
  }

  const resetFilters = () => {
    setDepartments([])
    setProgram('')
    setInvigilatorId('')
    setConflictsOnly(false)
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-line bg-card p-6">
        <div className="flex items-center justify-between">
          <SkeletonText lines={2} className="w-56" />
        </div>
        <div className="mt-6 grid grid-cols-7 gap-2">
          {Array.from({ length: 35 }, (_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-surface" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-line bg-card p-6">
        <div className="flex items-center gap-3 text-danger">
          <AlertTriangle className="h-5 w-5" />
          <p className="font-semibold">Could not load the datesheet calendar</p>
        </div>
        <p className="mt-1 text-sm text-ink-muted">{error}</p>
        <Button variant="secondary" className="mt-4" onClick={() => void load()}>
          Try again
        </Button>
      </div>
    )
  }

  if (!cycle) {
    return (
      <div className="rounded-lg border border-line bg-card p-6">
        <EmptyState
          title="No active exam cycle"
          description="Create and schedule an exam cycle first — the calendar appears here once a cycle exists."
        />
      </div>
    )
  }

  const published = cycle.status === 'published'

  return (
    <div>
      {published && (
        <div className="mb-5 flex items-center gap-3 rounded-lg border border-navy/20 bg-navy px-4 py-3 text-white shadow-soft animate-[modalIn_220ms_ease-out]">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-gold" />
          <div className="min-w-0">
            <p className="font-bold">This datesheet is published</p>
            <p className="text-sm text-white/80">
              Casual editing is locked and everyone has been notified. Further changes need an override.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex overflow-hidden rounded-md border border-line bg-card">
            <button
              type="button"
              onClick={() => setView('month')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-sm font-semibold transition-colors',
                view === 'month' ? 'bg-navy text-white' : 'text-ink-muted hover:bg-surface hover:text-ink',
              )}
            >
              <CalendarDays className="h-4 w-4" />
              Month
            </button>
            <button
              type="button"
              onClick={() => setView('week')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-sm font-semibold transition-colors',
                view === 'week' ? 'bg-navy text-white' : 'text-ink-muted hover:bg-surface hover:text-ink',
              )}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Week
            </button>
          </div>

          <span className="text-sm text-ink-muted">
            {cycle.name} · {shortDateLabel(cycle.start_date)} – {shortDateLabel(cycle.end_date)}
          </span>
        </div>

        {canPublish && (
          <Button
            variant={published ? 'secondary' : 'gold'}
            disabled={published}
            onClick={() => setPublishOpen(true)}
          >
            <Megaphone className="h-4 w-4" />
            {published ? 'Published' : 'Publish Datesheet'}
          </Button>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryChip label="Total exams" value={summary?.summary.total_exams ?? 0} />
        <SummaryChip label="Rooms in use" value={summary?.summary.rooms_used ?? 0} />
        <SummaryChip label="Needs review" value={summary?.summary.needs_review ?? 0} tone="danger" />
        <SummaryChip label="Open clashes" value={summary?.summary.same_slot ?? 0} tone="danger" />
      </div>

      <div className="mt-5 rounded-lg border border-line bg-card p-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          <DepartmentMultiSelect
            departments={catalog?.departments ?? []}
            selected={departments}
            onChange={setDepartments}
          />
          <Select
            label="Program level"
            placeholder="All batches"
            value={program}
            onChange={setProgram}
            clearable
            options={(catalog?.batches ?? []).map((batch) => ({ value: batch, label: `Batch ${batch}` }))}
          />
          <Select
            label="Invigilator"
            placeholder="All invigilators"
            value={invigilatorId}
            onChange={setInvigilatorId}
            clearable
            options={(catalog?.invigilators ?? []).map((inv) => ({ value: inv.id, label: inv.name }))}
          />
          <div className="flex flex-col justify-end">
            <FilterToggle checked={conflictsOnly} onChange={setConflictsOnly} />
          </div>
        </div>

        {(departments.length > 0 || program || invigilatorId || conflictsOnly) && (
          <div className="mt-3 flex items-center justify-between">
            <p className="text-sm text-ink-muted">
              Showing {filteredEntries.length} of {entries.length} papers
            </p>
            <button type="button" onClick={resetFilters} className="text-sm font-semibold text-navy hover:underline">
              Reset filters
            </button>
          </div>
        )}
      </div>

      {view === 'month' ? (
        <div className="mt-5 rounded-lg border border-line bg-card p-4">
          <h2 className="text-center text-sm font-bold uppercase tracking-wide text-ink-muted">{monthGrid.monthLabel}</h2>
          <div className="mt-4 grid grid-cols-7 gap-2">
            {WEEKDAYS.map((day) => (
              <div key={day} className="text-center text-xs font-bold uppercase tracking-wide text-ink-muted">
                {day}
              </div>
            ))}
            {monthGrid.cells.map((cell, index) =>
              cell.inWindow ? (
                <MonthCell
                  key={cell.day}
                  day={cell.day}
                  count={cell.count}
                  departmentIds={cell.departmentIds}
                  hasClashes={cell.hasClashes}
                  needsReview={cell.needsReview}
                  inWindow
                  dimmed={cell.dimmed}
                  onSelect={setSelectedDate}
                />
              ) : (
                <div key={index} className="min-h-24 rounded-lg border border-transparent bg-surface/60 p-2">
                  {cell.day.startsWith('pad-') ? null : <span className="text-xs font-semibold text-ink-muted">{parseDate(cell.day).getUTCDate()}</span>}
                </div>
              ),
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line pt-3">
            <span className="text-xs font-semibold text-ink-muted">Department colours:</span>
            {(catalog?.departments ?? []).map((dept, index) => (
              <span key={dept.id} className="flex items-center gap-1.5 text-xs text-ink">
                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: DOT_COLORS[index % DOT_COLORS.length] }} />
                {dept.name}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-lg border border-line bg-card p-4">
          <div className="grid min-w-[720px] gap-2" style={{ gridTemplateColumns: `100px repeat(${weekDays.length}, minmax(120px, 1fr))` }}>
            <div />
            {weekDays.map((day) => (
              <div key={day} className="pb-1 text-center">
                <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">{dayLabel(day)}</p>
                <p className="text-sm font-semibold text-ink">{parseDate(day).getUTCDate()} {parseDate(day).toLocaleDateString('en-US', { month: 'short' })}</p>
              </div>
            ))}
            {timeSlots.map((slot, slotIndex) => (
              <SlotRow
                key={slot.id}
                slotIndex={slotIndex}
                slot={slot}
                weekDays={weekDays}
                filteredEntries={filteredEntries}
                openClashEntryIds={openClashEntryIds}
                conflictsOnly={conflictsOnly}
                onSelect={setSelectedDate}
              />
            ))}
          </div>
        </div>
      )}

      <DayDrawer
        date={selectedDate ?? ''}
        entries={drawerVisibleEntries}
        openClashEntryIds={openClashEntryIds}
        onClose={() => setSelectedDate(null)}
      />

      <Modal
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        size="sm"
        title="Publish the datesheet?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPublishOpen(false)} disabled={publishing}>
              Cancel
            </Button>
            <Button variant="gold" onClick={() => void publish()} loading={publishing}>
              Publish Datesheet
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-ink-muted">
          <p>
            Publishing <span className="font-semibold text-ink">{cycle.name}</span> will:
          </p>
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-navy" />
              Notify every student, invigilator and coordinator in the system.
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              Lock casual editing of the timetable. Changes afterwards require an override.
            </li>
          </ul>
          <p className="text-xs text-ink-muted">This action cannot be undone from this screen.</p>
        </div>
      </Modal>
    </div>
  )
}

function SummaryChip({ label, value, tone }: { label: string; value: number; tone?: 'danger' }) {
  return (
    <div className="rounded-lg border border-line bg-card p-3">
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      <p className={cn('mt-0.5 text-2xl font-black', tone === 'danger' ? 'text-danger' : 'text-navy')}>{value}</p>
    </div>
  )
}

function SlotRow({
  slotIndex,
  slot,
  weekDays,
  filteredEntries,
  openClashEntryIds,
  conflictsOnly,
  onSelect,
}: {
  slotIndex: number
  slot: ApiTimeSlot
  weekDays: string[]
  filteredEntries: ApiScheduleEntry[]
  openClashEntryIds: Set<string>
  conflictsOnly: boolean
  onSelect: (day: string) => void
}) {
  return (
    <>
      <div className="flex flex-col justify-center rounded-md bg-surface px-2 py-1.5">
        <span className="text-xs font-black text-navy">Slot {slotIndex + 1}</span>
        <span className="truncate text-xs font-medium text-ink-muted">
          {slot.label}
          {slot.start_time ? ` · ${slot.start_time}` : ''}
        </span>
      </div>
      {weekDays.map((day) => {
        const cellEntries = filteredEntries.filter((e) => e.date === day && e.time_slot_id === slot.id)
        return (
          <WeekCell
            key={day}
            entries={cellEntries}
            openClashEntryIds={openClashEntryIds}
            dimmed={conflictsOnly && cellEntries.every((e) => !openClashEntryIds.has(e.id))}
            onSelect={onSelect}
          />
        )
      })}
    </>
  )
}
