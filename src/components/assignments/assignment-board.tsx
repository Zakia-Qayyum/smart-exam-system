import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  DndContext,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  CheckCircle2,
  GripVertical,
  Loader2,
  MousePointerClick,
  RefreshCw,
  Siren,
  Sparkles,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { toast } from '@/components/ui/toast-store'
import { cn } from '@/lib/utils'
import { fetchCatalog, fetchScheduleEntries } from '@/services/scheduling-service'
import { formatDateLabel } from '@/config/scheduling-data'
import { useInvigilatorsStore } from '@/stores/invigilators-store'
import type {
  ApiRoom,
  ApiScheduleEntry,
  ApiTimeSlot,
  DirectoryInvigilator,
  SchedulingCatalog,
} from '@/lib/types'

type ChipSource = 'existing' | 'manual' | 'auto'

interface BoardChip {
  id: string
  invigilator_id: string
  name: string
  availability: DirectoryInvigilator['availability']
  status: 'assigned' | 'confirmed'
  source: ChipSource
}

interface DayBoardState {
  pending: Record<string, BoardChip[]>
  removed: string[]
  committed: boolean
}

interface CellRow {
  cellKey: string
  chip: BoardChip
}

const cellKeyOf = (slotId: string, roomId: string) => `${slotId}::${roomId}`

let chipSeq = 0
const chipId = () => `chip-${Date.now()}-${chipSeq++}`

const emptyDay = (): DayBoardState => ({ pending: {}, removed: [], committed: false })

function PoolCard({
  inv,
  load,
  pending,
  maxed,
  armed,
  interactive,
  onArm,
}: {
  inv: DirectoryInvigilator
  load: number
  pending: number
  maxed: boolean
  armed: boolean
  interactive: boolean
  onArm: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `pool-${inv.id}`,
    disabled: !interactive,
  })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onArm}
      className={cn(
        'group cursor-grab rounded-md border bg-card p-2.5 shadow-soft transition-all active:cursor-grabbing',
        armed ? 'border-navy ring-2 ring-navy/20' : 'border-line hover:border-navy/40',
        isDragging && 'opacity-50',
        !interactive && 'pointer-events-none opacity-60',
      )}
      style={transform ? ({ transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 40 } satisfies CSSProperties) : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-bold text-ink">{inv.name}</p>
        <GripVertical className="h-4 w-4 shrink-0 text-ink-muted opacity-60 transition-opacity group-hover:opacity-100" aria-hidden="true" />
      </div>
      <p className="mt-0.5 truncate text-[11px] font-medium text-ink-muted">
        {inv.department_name} · {inv.designation}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        <Badge
          variant={inv.availability === 'Available' ? 'success' : inv.availability === 'Busy' ? 'warning' : 'default'}
          dot
        >
          {inv.availability}
        </Badge>
        <Badge variant={maxed ? 'danger' : 'outline'}>
          {load}/{inv.max_assignments_per_cycle} assigned{pending > 0 ? ` · +${pending}` : ''}
        </Badge>
      </div>
    </div>
  )
}

function Chip({ chip, onRemove }: { chip: BoardChip; onRemove: () => void }) {
  const newChip = chip.source !== 'existing'
  return (
    <span
      className={cn(
        'inline-flex animate-[chipIn_180ms_ease-out] items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold',
        newChip ? 'border-gold/40 bg-gold/10 text-gold-dark' : 'border-line bg-surface text-ink',
      )}
      title={chip.status === 'confirmed' ? 'Confirmed' : 'Assigned — unconfirmed'}
    >
      <span
        className={cn('h-1.5 w-1.5 shrink-0 rounded-full', chip.status === 'confirmed' ? 'bg-success' : 'bg-info')}
        aria-hidden="true"
      />
      <span className="max-w-[110px] truncate">{chip.name}</span>
      {newChip && (
        <span className="rounded-full bg-gold/15 px-1 text-[9px] font-bold uppercase tracking-wide text-gold-dark">
          new
        </span>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${chip.name}`}
        className="text-ink-muted transition-colors hover:text-danger"
      >
        <X className="h-3 w-3" aria-hidden="true" />
      </button>
    </span>
  )
}

function BoardCell({
  cellKey,
  room,
  entry,
  chips,
  armed,
  interactive,
  shaking,
  onCellClick,
  onRemoveChip,
}: {
  cellKey: string
  room: ApiRoom
  entry: ApiScheduleEntry | undefined
  chips: BoardChip[]
  armed: boolean
  interactive: boolean
  shaking: boolean
  onCellClick: () => void
  onRemoveChip: (cellKey: string, chip: BoardChip) => void
}) {
  const { isOver, setNodeRef } = useDroppable({ id: `cell-${cellKey}`, disabled: !interactive })
  return (
    <div
      ref={setNodeRef}
      onClick={onCellClick}
      className={cn(
        'flex min-h-[108px] flex-col gap-1.5 rounded-md border p-2 transition-colors duration-150',
        entry ? 'border-line bg-card' : 'border-dashed border-line bg-surface/50',
        isOver && 'border-navy bg-navy/5 ring-2 ring-navy/20',
        shaking && 'animate-[shake_380ms_ease-in-out] border-danger',
        !interactive && 'pointer-events-none opacity-60',
      )}
    >
      {entry && (
        <div className="flex items-center justify-between gap-1">
          <Badge variant="info" className="max-w-[70%] truncate">
            {entry.course_code}
          </Badge>
          <span className="shrink-0 text-[10px] font-semibold text-ink-muted">{room.capacity} cap</span>
        </div>
      )}
      {chips.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {chips.map((chip) => (
            <Chip key={chip.id} chip={chip} onRemove={() => onRemoveChip(cellKey, chip)} />
          ))}
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center text-center">
          <p className="text-[11px] font-medium text-ink-muted">
            {armed ? 'Click to assign' : 'Drop invigilator here'}
          </p>
        </div>
      )}
    </div>
  )
}

export function AssignmentBoard() {
  const [catalog, setCatalog] = useState<SchedulingCatalog | null>(null)
  const [entries, setEntries] = useState<ApiScheduleEntry[]>([])
  const [loadError, setLoadError] = useState('')
  const roster = useInvigilatorsStore((s) => s.invigilators)

  const [selectedDate, setSelectedDate] = useState('')
  const [board, setBoard] = useState<Record<string, DayBoardState>>({})

  const [search, setSearch] = useState('')
  const [deptId, setDeptId] = useState('')
  const [underMaxOnly, setUnderMaxOnly] = useState(false)

  const [armedId, setArmedId] = useState('')
  const [shakingCell, setShakingCell] = useState('')
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [autoRunning, setAutoRunning] = useState(false)
  const [autoProgress, setAutoProgress] = useState({ done: 0, total: 0 })
  const [showReview, setShowReview] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const [activeInv, setActiveInv] = useState<DirectoryInvigilator | null>(null)

  useEffect(() => {
    let cancelled = false
    void useInvigilatorsStore.getState().fetchAll()
    Promise.all([fetchCatalog(), fetchScheduleEntries({ page_size: 200 })])
      .then(([cat, list]) => {
        if (cancelled) return
        setCatalog(cat)
        setEntries(list.entries)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadError(err instanceof Error ? err.message : 'Failed to load assignment board data')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (selectedDate || !catalog?.cycle) return
    setSelectedDate(catalog.cycle.start_date)
  }, [catalog, selectedDate])

  useEffect(() => {
    if (!armedId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setArmedId('')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [armedId])

  const days = useMemo(() => {
    if (!catalog?.cycle) return []
    const out: string[] = []
    let cur = new Date(`${catalog.cycle.start_date}T00:00:00.000Z`)
    const endKey = catalog.cycle.end_date
    while (cur.toISOString().slice(0, 10) <= endKey) {
      out.push(cur.toISOString().slice(0, 10))
      cur.setUTCDate(cur.getUTCDate() + 1)
    }
    return out
  }, [catalog])

  const slots = catalog?.time_slots ?? []
  const rooms = catalog?.rooms ?? []

  const entryByCell = useMemo(() => {
    const m: Record<string, ApiScheduleEntry> = {}
    for (const e of entries) if (e.date === selectedDate) m[cellKeyOf(e.time_slot_id, e.room_id)] = e
    return m
  }, [entries, selectedDate])

  const dayState = board[selectedDate] ?? emptyDay()

  const updateDay = (fn: (day: DayBoardState) => DayBoardState) => {
    setBoard((prev) => ({
      ...prev,
      [selectedDate]: fn(prev[selectedDate] ?? emptyDay()),
    }))
  }

  const cells = useMemo(() => {
    const existing: Record<string, BoardChip[]> = {}
    for (const e of entries) {
      if (e.date !== selectedDate) continue
      const key = cellKeyOf(e.time_slot_id, e.room_id)
      existing[key] = e.invigilators.map((inv) => {
        const full = roster.find((r) => r.id === inv.id)
        return {
          id: `existing-${e.id}-${inv.id}`,
          invigilator_id: inv.id,
          name: inv.name,
          availability: full?.availability ?? 'Available',
          status: 'assigned' as const,
          source: 'existing' as const,
        }
      })
    }
    const removed = new Set(dayState.removed)
    const out: Record<string, BoardChip[]> = {}
    const keys = new Set([...Object.keys(existing), ...Object.keys(dayState.pending)])
    for (const key of keys) {
      const ex = (existing[key] ?? []).filter((c) => !removed.has(c.id))
      const pen = dayState.pending[key] ?? []
      const taken = new Set(ex.map((c) => c.invigilator_id))
      out[key] = [...ex, ...pen.filter((c) => !taken.has(c.invigilator_id))]
    }
    return out
  }, [entries, roster, selectedDate, dayState])

  const pendingCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const chips of Object.values(cells)) {
      for (const c of chips) {
        if (c.source !== 'existing') m.set(c.invigilator_id, (m.get(c.invigilator_id) ?? 0) + 1)
      }
    }
    return m
  }, [cells])

  const loadOf = useCallback(
    (inv: DirectoryInvigilator) => inv.assigned_count + (pendingCounts.get(inv.id) ?? 0),
    [pendingCounts],
  )

  const unconfirmed = useMemo(() => {
    const rows: CellRow[] = []
    for (const [cellKey, chips] of Object.entries(cells)) {
      for (const chip of chips) {
        if (chip.source !== 'existing' && chip.status === 'assigned') rows.push({ cellKey, chip })
      }
    }
    return rows
  }, [cells])

  const shake = (cellKey: string) => {
    setShakingCell(cellKey)
    if (shakeTimer.current) clearTimeout(shakeTimer.current)
    shakeTimer.current = setTimeout(() => setShakingCell(''), 400)
  }

  const slotLabel = (slotId: string) => slots.find((s) => s.id === slotId)?.label ?? 'Session'
  const cellLabel = (cellKey: string) => {
    const [slotId, roomId] = cellKey.split('::')
    const room = rooms.find((r) => r.id === roomId)
    return `${slotLabel(slotId)} · ${room?.name ?? 'Room'}`
  }

  const invigilatorInSlot = (invId: string, slotId: string, excludeKey: string) =>
    Object.entries(cells).some(([key, chips]) => {
      if (key === excludeKey) return false
      const [kSlot] = key.split('::')
      return kSlot === slotId && chips.some((c) => c.invigilator_id === invId)
    })

  const attemptAssign = (inv: DirectoryInvigilator, cellKey: string) => {
    if (autoRunning) return
    const [slotId] = cellKey.split('::')
    const inCell = cells[cellKey] ?? []
    if (inCell.some((c) => c.invigilator_id === inv.id)) {
      toast({ variant: 'info', title: 'Already assigned', description: `${inv.name} is already on this session.` })
      return
    }
    if (invigilatorInSlot(inv.id, slotId, cellKey)) {
      shake(cellKey)
      toast({
        variant: 'danger',
        title: 'Double-booking blocked',
        description: `${inv.name} is already assigned to the ${slotLabel(slotId)} session in another room.`,
      })
      return
    }
    if (inv.availability === 'On leave') {
      shake(cellKey)
      toast({ variant: 'danger', title: 'On leave', description: `${inv.name} is on leave and cannot be assigned.` })
      return
    }
    if (loadOf(inv) >= inv.max_assignments_per_cycle) {
      shake(cellKey)
      toast({
        variant: 'warning',
        title: 'At assignment limit',
        description: `${inv.name} is at ${loadOf(inv)}/${inv.max_assignments_per_cycle} — nothing left to assign.`,
      })
      return
    }
    updateDay((d) => ({
      ...d,
      committed: false,
      pending: {
        ...d.pending,
        [cellKey]: [
          ...(d.pending[cellKey] ?? []),
          {
            id: chipId(),
            invigilator_id: inv.id,
            name: inv.name,
            availability: inv.availability,
            status: 'assigned' as const,
            source: 'manual' as const,
          },
        ],
      },
    }))
    setArmedId('')
    toast({
      variant: 'success',
      title: 'Assigned',
      description: `${inv.name} → ${cellLabel(cellKey)}. Review before confirming.`,
    })
  }

  const removeChip = (cellKey: string, chip: BoardChip) => {
    updateDay((d) => {
      if (chip.source === 'existing') {
        return { ...d, committed: false, removed: [...d.removed, chip.id] }
      }
      return {
        ...d,
        committed: false,
        pending: {
          ...d.pending,
          [cellKey]: (d.pending[cellKey] ?? []).filter((c) => c.id !== chip.id),
        },
      }
    })
  }

  const handleDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id)
    setActiveInv(roster.find((i) => `pool-${i.id}` === id) ?? null)
  }

  const handleDragEnd = (e: DragEndEvent) => {
    const overId = e.over ? String(e.over.id) : ''
    if (overId.startsWith('cell-') && activeInv) {
      attemptAssign(activeInv, overId.slice('cell-'.length))
    }
    setActiveInv(null)
  }

  const toggleArm = (invId: string) => setArmedId((cur) => (cur === invId ? '' : invId))
  const armedInv = roster.find((i) => i.id === armedId) ?? null

  const filteredPool = useMemo(() => {
    const q = search.trim().toLowerCase()
    return roster.filter((inv) => {
      if (deptId && inv.department_id !== deptId) return false
      if (underMaxOnly && loadOf(inv) >= inv.max_assignments_per_cycle) return false
      if (q) {
        const hay = `${inv.name} ${inv.department_name} ${inv.designation} ${inv.specialization_tags.join(' ')}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [roster, search, deptId, underMaxOnly, loadOf])

  const pickBestInvigilator = (
    slot: ApiTimeSlot,
    entry: ApiScheduleEntry | undefined,
    pickedBySlot: Map<string, Set<string>>,
    planCounts: Map<string, number>,
  ): DirectoryInvigilator | null => {
    const candidates = filteredPool.filter((inv) => {
      if (inv.availability === 'On leave') return false
      if (loadOf(inv) + (planCounts.get(inv.id) ?? 0) >= inv.max_assignments_per_cycle) return false
      if (pickedBySlot.get(slot.id)?.has(inv.id)) return false
      const slotTaken = Object.entries(cells).some(([key, chips]) => {
        const [kSlot] = key.split('::')
        return kSlot === slot.id && chips.some((c) => c.invigilator_id === inv.id)
      })
      if (slotTaken) return false
      return true
    })
    const sorted = [...candidates].sort((a, b) => {
      const aAvail = a.availability === 'Available' ? 0 : 1
      const bAvail = b.availability === 'Available' ? 0 : 1
      if (aAvail !== bAvail) return aAvail - bAvail
      const aMatch = entry && entry.department_id === a.department_id ? 0 : 1
      const bMatch = entry && entry.department_id === b.department_id ? 0 : 1
      if (aMatch !== bMatch) return aMatch - bMatch
      const al = loadOf(a)
      const bl = loadOf(b)
      if (al !== bl) return al - bl
      return a.name.localeCompare(b.name)
    })
    return sorted[0] ?? null
  }

  const runAutoAssign = async () => {
    if (autoRunning) return
    const plan: Array<{ cellKey: string; invigilator: DirectoryInvigilator }> = []
    const pickedBySlot = new Map<string, Set<string>>()
    const planCounts = new Map<string, number>()
    const maxSeats = 12

    for (const slot of slots) {
      for (const room of rooms) {
        if (plan.length >= maxSeats) break
        const key = cellKeyOf(slot.id, room.id)
        const entry = entryByCell[key]
        const chips = cells[key] ?? []
        const need = Math.max(0, (entry ? 2 : 1) - chips.length)
        for (let n = 0; n < need; n++) {
          if (plan.length >= maxSeats) break
          const chosen = pickBestInvigilator(slot, entry, pickedBySlot, planCounts)
          if (!chosen) break
          pickedBySlot.set(slot.id, new Set([...(pickedBySlot.get(slot.id) ?? []), chosen.id]))
          planCounts.set(chosen.id, (planCounts.get(chosen.id) ?? 0) + 1)
          plan.push({ cellKey: key, invigilator: chosen })
        }
      }
    }

    if (plan.length === 0) {
      toast({ variant: 'info', title: 'Nothing to auto-assign', description: 'Every seat is already filled or no invigilators match the pool filters.' })
      return
    }

    setAutoRunning(true)
    setShowReview(false)
    setAutoProgress({ done: 0, total: plan.length })
    for (let i = 0; i < plan.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 240))
      const { cellKey, invigilator } = plan[i]
      setBoard((prev) => {
        const day = prev[selectedDate] ?? emptyDay()
        return {
          ...prev,
          [selectedDate]: {
            ...day,
            committed: false,
            pending: {
              ...day.pending,
              [cellKey]: [
                ...(day.pending[cellKey] ?? []),
                {
                  id: chipId(),
                  invigilator_id: invigilator.id,
                  name: invigilator.name,
                  availability: invigilator.availability,
                  status: 'assigned' as const,
                  source: 'auto' as const,
                },
              ],
            },
          },
        }
      })
      setAutoProgress({ done: i + 1, total: plan.length })
    }
    setAutoRunning(false)
    setShowReview(true)
    toast({
      variant: 'success',
      title: 'Auto-assign complete',
      description: `Mock matcher placed ${plan.length} invigilator(s). Review before confirming.`,
    })
  }

  const acceptAuto = () => {
    updateDay((d) => {
      const pending: Record<string, BoardChip[]> = {}
      for (const [k, chips] of Object.entries(d.pending)) {
        pending[k] = chips.map((c) => (c.source === 'auto' ? { ...c, source: 'manual' as const } : c))
      }
      return { ...d, pending }
    })
    setShowReview(false)
    toast({ variant: 'success', title: 'Auto-assignments accepted', description: 'They are still unconfirmed — press Confirm assignments to record them.' })
  }

  const clearAuto = () => {
    updateDay((d) => {
      const pending: Record<string, BoardChip[]> = {}
      for (const [k, chips] of Object.entries(d.pending)) {
        const kept = chips.filter((c) => c.source !== 'auto')
        if (kept.length) pending[k] = kept
      }
      return { ...d, pending }
    })
    setShowReview(false)
    toast({ variant: 'info', title: 'Auto-assignments cleared', description: 'The mock matcher placements were removed.' })
  }

  const resetDay = () => {
    updateDay(() => emptyDay())
    setShowReview(false)
    setArmedId('')
  }

  const confirmAssignments = () => {
    const count = unconfirmed.length
    updateDay((d) => ({
      committed: true,
      removed: d.removed,
      pending: Object.fromEntries(
        Object.entries(d.pending).map(([k, chips]) => [
          k,
          chips.map((c) => ({ ...c, status: 'confirmed' as const })),
        ]),
      ),
    }))
    setConfirmOpen(false)
    setShowReview(false)
    setArmedId('')
    toast({
      variant: 'success',
      title: 'Assignments confirmed',
      description: `${count} invigilator(s) recorded for ${formatDateLabel(selectedDate)} (mock). Mapped as invigilator_assignments rows — ready to swap to the real API.`,
      duration: 6000,
    })
  }

  if (loadError) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <Siren className="h-8 w-8 text-danger" aria-hidden="true" />
          <div>
            <p className="font-bold text-ink">Could not load the assignment board</p>
            <p className="mt-1 text-sm text-ink-muted">{loadError}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!catalog) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-3 py-10">
          <Loader2 className="h-5 w-5 animate-spin text-navy" aria-hidden="true" />
          <p className="text-sm font-semibold text-ink-muted">Loading assignment board…</p>
        </CardContent>
      </Card>
    )
  }

  const filledSeats = Object.values(cells).reduce((sum, chips) => sum + chips.length, 0)
  const totalCells = slots.length * rooms.length
  const dayEntryCount = entries.filter((e) => e.date === selectedDate).length

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveInv(null)}>
      <div className="space-y-4">
        {showReview && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-gold/40 bg-gold/10 px-4 py-3 shadow-soft animate-[modalIn_220ms_ease-out]">
            <div className="flex min-w-0 items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-gold-dark" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-ink">Review auto-assignments</p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  The mock matcher placed {autoProgress.done} invigilator(s). Accept them, adjust individual cells,
                  or clear them before confirming.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="secondary" size="sm" onClick={clearAuto}>
                Clear auto-assignments
              </Button>
              <Button variant="primary" size="sm" onClick={acceptAuto}>
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Accept all
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-ink-muted">Exam day</span>
          {days.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => setSelectedDate(day)}
              className={cn(
                'rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all',
                selectedDate === day
                  ? 'border-navy bg-navy text-white shadow-soft'
                  : 'border-line bg-card text-ink-muted hover:border-navy/40 hover:text-ink',
              )}
            >
              {formatDateLabel(day)}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline">
              {dayEntryCount} exam{dayEntryCount === 1 ? '' : 's'} · {formatDateLabel(selectedDate)}
            </Badge>
            <Badge variant={unconfirmed.length ? 'gold' : 'outline'}>{unconfirmed.length} unconfirmed</Badge>
            <Badge variant="outline">
              {filledSeats}/{totalCells} seats filled
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={autoRunning || (dayState.removed.length === 0 && unconfirmed.length === 0)}
              onClick={resetDay}
            >
              Reset day edits
            </Button>
            <Button variant="secondary" size="sm" onClick={runAutoAssign} disabled={autoRunning}>
              {autoRunning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Filling {autoProgress.done}/{autoProgress.total}…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" aria-hidden="true" /> Auto-assign remaining
                </>
              )}
            </Button>
            <Button size="sm" onClick={() => setConfirmOpen(true)} disabled={autoRunning || unconfirmed.length === 0}>
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Confirm assignments
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-md border border-line bg-card p-3 shadow-soft">
          <div
            className="grid"
            style={{ gridTemplateColumns: `minmax(140px, 180px) repeat(${rooms.length}, minmax(220px, 1fr))` }}
          >
            <div className="sticky left-0 flex items-end px-1 pb-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">Session</span>
            </div>
            {rooms.map((room) => (
              <div key={room.id} className="flex flex-col justify-end border-b border-line pb-2 pl-1">
                <p className="truncate text-sm font-bold text-ink">{room.name}</p>
                <p className="text-[10px] font-semibold text-ink-muted">Cap {room.capacity}</p>
              </div>
            ))}
            {slots.map((slot) => (
              <Fragment key={slot.id}>
                <div className="sticky left-0 flex flex-col justify-center border-r border-line bg-card pr-2">
                  <p className="text-sm font-bold text-navy">{slot.label}</p>
                  <p className="text-[10px] font-semibold text-ink-muted">
                    {slot.start_time}–{slot.end_time}
                  </p>
                </div>
                {rooms.map((room) => {
                  const key = cellKeyOf(slot.id, room.id)
                  return (
                    <BoardCell
                      key={key}
                      cellKey={key}
                      room={room}
                      entry={entryByCell[key]}
                      chips={cells[key] ?? []}
                      armed={armedId !== ''}
                      interactive={!autoRunning}
                      shaking={shakingCell === key}
                      onCellClick={() => {
                        if (armedInv) {
                          attemptAssign(armedInv, key)
                          setArmedId('')
                        }
                      }}
                      onRemoveChip={removeChip}
                    />
                  )
                })}
              </Fragment>
            ))}
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Invigilator pool</CardTitle>
            <Badge variant="outline">
              {filteredPool.length} of {roster.length} shown
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              <Input
                label="Search invigilator"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, department, tag…"
              />
              <Select
                label="Department"
                options={(catalog.departments ?? []).map((d) => ({ value: d.id, label: `${d.code} · ${d.name}` }))}
                value={deptId}
                onChange={setDeptId}
                placeholder="All departments"
                clearable
              />
              <label className="flex h-12 items-center gap-2.5 rounded-md border border-line bg-card px-3">
                <input
                  type="checkbox"
                  checked={underMaxOnly}
                  onChange={(e) => setUnderMaxOnly(e.target.checked)}
                  className="h-4 w-4 accent-gold"
                />
                <span className="text-sm font-semibold text-ink">Under max-assignment limit only</span>
              </label>
            </div>

            {armedInv && (
              <div className="mt-3 flex items-center gap-2 rounded-md border border-navy/20 bg-navy px-3 py-2 text-white animate-[modalIn_180ms_ease-out]">
                <MousePointerClick className="h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
                <p className="text-xs font-semibold">
                  Armed: <span className="text-gold">{armedInv.name}</span> — click an exam cell to assign, or click
                  the card again to cancel.
                </p>
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {filteredPool.map((inv) => (
                <PoolCard
                  key={inv.id}
                  inv={inv}
                  load={loadOf(inv)}
                  pending={pendingCounts.get(inv.id) ?? 0}
                  maxed={loadOf(inv) >= inv.max_assignments_per_cycle}
                  armed={armedId === inv.id}
                  interactive={!autoRunning}
                  onArm={() => toggleArm(inv.id)}
                />
              ))}
            </div>
            {filteredPool.length === 0 && (
              <p className="mt-6 text-center text-sm text-ink-muted">
                No invigilators match the current filters.
              </p>
            )}
          </CardContent>
        </Card>

        <ConfirmDialog
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onConfirm={confirmAssignments}
          title="Confirm these invigilator assignments?"
          description={
            unconfirmed.length
              ? `${unconfirmed.length} assignment(s) map to invigilator_assignments rows (schedule_entry_id, invigilator_id, status = 'assigned'). ${unconfirmed
                  .slice(0, 6)
                  .map((r) => `· ${r.chip.name} → ${cellLabel(r.cellKey)}`)
                  .join(' ')}${unconfirmed.length > 6 ? ` ·…and ${unconfirmed.length - 6} more` : ''}`
              : undefined
          }
          confirmLabel={`Confirm ${unconfirmed.length} assignment(s)`}
          cancelLabel="Keep editing"
          variant="primary"
        />
      </div>
    </DndContext>
  )
}
