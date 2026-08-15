import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Loader2, Pencil, RefreshCw, Save, Siren } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { toast } from '@/components/ui/toast-store'
import { ApiError } from '@/services/api-client'
import { CalendarPicker } from '@/components/scheduling/calendar-picker'
import {
  affectedStudents,
  checkClash,
  conflictingCourses,
  createEntry,
  deleteEntry,
  fetchCatalog,
  fetchScheduleEntries,
  updateEntry,
} from '@/services/scheduling-service'
import { formatDateLabel } from '@/config/scheduling-data'
import { notifyScheduleChanged } from '@/lib/schedule-sync'
import { useInvigilatorsStore } from '@/stores/invigilators-store'
import { cn } from '@/lib/utils'
import type {
  ApiClashCheckResult,
  ApiClashHit,
  ApiScheduleEntry,
  ApiTimeSlot,
  DirectoryInvigilator,
  SchedulingCatalog,
} from '@/lib/types'

function SlotChip({
  slot,
  active,
  onSelect,
}: {
  slot: ApiTimeSlot
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex flex-col items-start rounded-md border px-3 py-2 text-left transition-all',
        active
          ? 'border-navy bg-navy/5 text-navy'
          : 'border-line bg-card text-ink-muted hover:border-navy/40 hover:text-ink',
      )}
    >
      <span className="text-sm font-bold">{slot.label}</span>
      <span className="text-[11px] font-medium opacity-70">
        {slot.start_time}–{slot.end_time}
      </span>
    </button>
  )
}

export function ManualEntry() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [catalog, setCatalog] = useState<SchedulingCatalog | null>(null)
  const [loadError, setLoadError] = useState('')
  const [entries, setEntries] = useState<ApiScheduleEntry[]>([])
  const [saving, setSaving] = useState(false)

  const [editing, setEditing] = useState<ApiScheduleEntry | null>(null)
  const [departmentId, setDepartmentId] = useState('')
  const [courseId, setCourseId] = useState('')
  const [sectionId, setSectionId] = useState('')
  const [date, setDate] = useState('')
  const [slotId, setSlotId] = useState('')
  const [roomId, setRoomId] = useState('')
  const [invigilatorId, setInvigilatorId] = useState('')
  const [overrideReason, setOverrideReason] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)

  const invigilatorRoster = useInvigilatorsStore((s) => s.invigilators)

  const [clashResult, setClashResult] = useState<ApiClashCheckResult | null>(null)
  const [checking, setChecking] = useState(false)
  const clashSeq = useRef(0)
  const deepLinkApplied = useRef(false)

  const entryParam = searchParams.get('entry')
  const sectionParam = searchParams.get('section')

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
        setLoadError(err instanceof Error ? err.message : 'Failed to load scheduling data')
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Apply the Clash Center deep link once the catalog + entries are in.
  useEffect(() => {
    if (deepLinkApplied.current || !catalog) return

    const clearDeepLink = () => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const key of ['entry', 'section', 'date', 'slot', 'room']) next.delete(key)
          return next
        },
        { replace: true },
      )
    }

    if (entryParam) {
      const entry = entries.find((e) => e.id === entryParam)
      if (!entry) return
      const section = catalog.sections.find((s) => s.id === entry.section_id)
      const course = section ? catalog.courses.find((c) => c.id === section.course_id) : undefined
      deepLinkApplied.current = true
      setEditing(entry)
      setDepartmentId(course?.department_id ?? '')
      setCourseId(section?.course_id ?? '')
      setSectionId(entry.section_id)
      setDate(entry.date)
      setSlotId(entry.time_slot_id)
      setRoomId(entry.room_id)
      setInvigilatorId(entry.invigilators[0]?.id ?? '')
      clearDeepLink()
    } else if (sectionParam) {
      const section = catalog.sections.find((s) => s.id === sectionParam)
      if (!section) {
        deepLinkApplied.current = true
        return
      }
      const course = catalog.courses.find((c) => c.id === section.course_id)
      deepLinkApplied.current = true
      setDepartmentId(course?.department_id ?? '')
      setCourseId(section.course_id)
      setSectionId(section.id)
      setDate(searchParams.get('date') ?? '')
      setSlotId(searchParams.get('slot') ?? '')
      setRoomId(searchParams.get('room') ?? '')
      clearDeepLink()
    } else {
      deepLinkApplied.current = true
    }
  }, [catalog, entries, entryParam, sectionParam, searchParams, setSearchParams])

  useEffect(() => {
    if (!sectionId || !date || !slotId) {
      setClashResult(null)
      return
    }
    const seq = ++clashSeq.current
    setChecking(true)
    const timer = setTimeout(async () => {
      try {
        const res = await checkClash({
          section_id: sectionId,
          date,
          time_slot_id: slotId,
          ...(editing ? { existing_entry_id: editing.id } : {}),
        })
        if (clashSeq.current === seq) setClashResult(res)
      } catch (err: unknown) {
        if (clashSeq.current === seq) {
          setClashResult(null)
          toast({
            variant: 'danger',
            title: 'Clash check failed',
            description: err instanceof Error ? err.message : 'Unexpected error',
          })
        }
      } finally {
        if (clashSeq.current === seq) setChecking(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [sectionId, date, slotId, editing])

  const cycle = catalog?.cycle ?? null
  const course = useMemo(
    () => catalog?.courses.find((c) => c.id === courseId) ?? null,
    [catalog, courseId],
  )
  const section = useMemo(
    () => catalog?.sections.find((s) => s.id === sectionId) ?? null,
    [catalog, sectionId],
  )
  const slot = useMemo(
    () => catalog?.time_slots.find((s) => s.id === slotId) ?? null,
    [catalog, slotId],
  )
  const room = useMemo(() => catalog?.rooms.find((r) => r.id === roomId) ?? null, [catalog, roomId])
  const roomLoad = useMemo(
    () => entries.filter((e) => e.date === date && e.room_id === roomId),
    [entries, date, roomId],
  )
  const invigilator = useMemo<DirectoryInvigilator | null>(
    () => invigilatorRoster.find((i) => i.id === invigilatorId) ?? null,
    [invigilatorRoster, invigilatorId],
  )

  const blocking = Boolean(clashResult && clashResult.clashes.length > 0)
  const dayWarn = Boolean(clashResult && clashResult.dayLoadWarnings.length > 0) || roomLoad.length > 0
  const checksRun = Boolean(sectionId && date && slotId)

  const courseOptions = useMemo(
    () =>
      (catalog?.courses ?? [])
        .filter((c) => c.department_id === departmentId)
        .map((c) => ({ value: c.id, label: `${c.course_code} — ${c.title}` })),
    [catalog, departmentId],
  )
  const sectionOptions = useMemo(
    () =>
      (catalog?.sections ?? [])
        .filter((s) => s.course_id === courseId)
        .map((s) => ({
          value: s.id,
          label: `Batch ${s.batch} · ${s.semester} · ${s.enrolled_count} enrolled`,
        })),
    [catalog, courseId],
  )
  const roomOptions = useMemo(
    () => (catalog?.rooms ?? []).map((r) => ({ value: r.id, label: `${r.name} · Cap ${r.capacity}` })),
    [catalog],
  )
  const invigilatorOptions = useMemo(
    () =>
      invigilatorRoster.map((i) => ({
        value: i.id,
        label: `${i.name} · ${i.department_name} · ${i.availability} (${i.assigned_count}/${i.max_assignments_per_cycle})`,
      })),
    [invigilatorRoster],
  )

  const canSave =
    Boolean(departmentId && courseId && sectionId && date && slotId && roomId && invigilatorId) &&
    (!blocking || overrideReason.trim().length > 0) &&
    cycle?.status === 'draft' &&
    !saving

  const resetForm = () => {
    setEditing(null)
    setCourseId('')
    setSectionId('')
    setDate('')
    setSlotId('')
    setRoomId('')
    setInvigilatorId('')
    setOverrideReason('')
    setClashResult(null)
  }

  const handleSave = async () => {
    if (!section || !slot || !room || !invigilator) return
    const force = Boolean(blocking && overrideReason.trim())
    setSaving(true)
    try {
      const input = {
        section_id: section.id,
        date,
        time_slot_id: slot.id,
        room_id: room.id,
        invigilator_id: invigilatorId,
        ...(force ? { force: true, override_reason: overrideReason.trim() } : {}),
      }
      const result = editing ? await updateEntry(editing.id, input) : await createEntry(input)
      setEntries((list) =>
        editing ? list.map((e) => (e.id === editing.id ? result.entry : e)) : [result.entry, ...list],
      )
      notifyScheduleChanged()
      void useInvigilatorsStore.getState().refresh()
      toast({
        variant: 'success',
        title: result.overridden
          ? 'Schedule entry saved (override)'
          : editing
            ? 'Schedule entry updated'
            : 'Schedule entry saved',
        description: `${result.entry.course_code} · ${formatDateLabel(result.entry.date)} · ${result.entry.time_slot_label} · ${result.entry.room_name}`,
        duration: 8000,
        ...(editing
          ? {}
          : {
              action: {
                label: 'Undo',
                onClick: async () => {
                  try {
                    await deleteEntry(result.entry.id)
                    setEntries((list) => list.filter((e) => e.id !== result.entry.id))
                    notifyScheduleChanged()
                    toast({ variant: 'info', title: 'Save undone', description: `${result.entry.course_code} was removed from the timetable.` })
                  } catch {
                    toast({ variant: 'danger', title: 'Could not undo', description: 'The entry was not removed.' })
                  }
                },
              },
            }),
      })
      resetForm()
      setConfirmOpen(false)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.body && typeof err.body === 'object') {
        const body = err.body as {
          details?: { clashes?: ApiClashHit[]; dayLoadWarnings?: ApiClashHit[] }
          clashes?: ApiClashHit[]
          dayLoadWarnings?: ApiClashHit[]
          status?: string
          error?: string
        }
        const clashHits = body.details?.clashes ?? body.clashes ?? []
        if (clashHits.length > 0) {
          setClashResult({
            clashes: clashHits,
            dayLoadWarnings: body.details?.dayLoadWarnings ?? body.dayLoadWarnings ?? [],
          })
          toast({
            variant: 'danger',
            title: 'Clash detected — save blocked',
            description: 'These students already have an exam in that slot. Add an override reason to save anyway.',
          })
        } else if (body.status === 'cycle_not_editable') {
          toast({
            variant: 'danger',
            title: 'Datesheet is published',
            description: body.error ?? 'This cycle is published — editing the timetable is locked.',
          })
        } else {
          toast({
            variant: 'danger',
            title: 'Save failed',
            description: body.error ?? (err instanceof Error ? err.message : 'Unexpected error'),
          })
        }
      } else {
        toast({
          variant: 'danger',
          title: 'Save failed',
          description: err instanceof Error ? err.message : 'Unexpected error',
        })
      }
    } finally {
      setSaving(false)
    }
  }

  if (loadError) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <Siren className="h-8 w-8 text-danger" aria-hidden="true" />
          <div>
            <p className="font-bold text-ink">Could not load scheduling data</p>
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
          <p className="text-sm font-semibold text-ink-muted">Loading scheduling data…</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {cycle?.status === 'published' && (
        <div className="flex items-start gap-3 rounded-md border border-navy/20 bg-navy px-4 py-3 text-white shadow-soft animate-[modalIn_220ms_ease-out]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">This datesheet is published — editing is locked</p>
            <p className="text-xs text-white/80">
              {cycle.name} is live. The backend refuses timetable changes on a published cycle
              (HTTP 409), so the save controls are disabled here.
            </p>
          </div>
        </div>
      )}

      {editing && (
        <div className="flex items-start gap-3 rounded-md border border-navy/20 bg-navy px-4 py-3 text-white shadow-soft animate-[modalIn_220ms_ease-out]">
          <Pencil className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">Editing {editing.course_code} · Batch {editing.batch}</p>
            <p className="text-xs text-white/80">
              Currently {formatDateLabel(editing.date)} · {editing.time_slot_label} · {editing.room_name}.
              Pick a new date or slot and save — the previous slot is released once you save.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/10 hover:text-white"
            onClick={() => {
              resetForm()
              setSearchParams((prev) => {
                const next = new URLSearchParams(prev)
                next.delete('entry')
                return next
              }, { replace: true })
            }}
          >
            Cancel edit
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{editing ? 'Edit schedule entry' : 'New schedule entry'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Select
              label="Department"
              options={(catalog.departments ?? []).map((d) => ({ value: d.id, label: `${d.code} · ${d.name}` }))}
              value={departmentId}
              onChange={(v) => {
                setDepartmentId(v)
                setCourseId('')
                setSectionId('')
              }}
              placeholder="Search department…"
              clearable
            />
            <Select
              label="Course"
              options={courseOptions}
              value={courseId}
              onChange={(v) => {
                setCourseId(v)
                setSectionId('')
              }}
              placeholder="Filtered by department…"
              disabled={!departmentId}
              clearable
            />
            <Select
              label="Section / Batch"
              options={sectionOptions}
              value={sectionId}
              onChange={setSectionId}
              placeholder="Filtered by course…"
              disabled={!courseId}
              clearable
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <p className="mb-1.5 text-sm font-medium text-ink">Date</p>
              <CalendarPicker
                value={date}
                onChange={setDate}
                min={cycle?.start_date}
                max={cycle?.end_date}
              />
              <p className="mt-1.5 text-xs text-ink-muted">
                {cycle
                  ? `Exam window ${formatDateLabel(cycle.start_date)} – ${formatDateLabel(cycle.end_date)}`
                  : 'No active exam cycle'}
              </p>
            </div>
            <div>
              <p className="mb-1.5 text-sm font-medium text-ink">Time slot</p>
              <div className="grid grid-cols-2 gap-2">
                {(catalog.time_slots ?? []).map((s) => (
                  <SlotChip key={s.id} slot={s} active={s.id === slotId} onSelect={() => setSlotId(s.id)} />
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <Select
                label="Room (capacity vs enrolled)"
                options={roomOptions}
                value={roomId}
                onChange={setRoomId}
                placeholder="Search room…"
                clearable
              />
              {room && section && (
                <p
                  className={cn(
                    'mt-1.5 text-xs font-semibold',
                    room.capacity >= section.enrolled_count ? 'text-success' : 'text-danger',
                  )}
                >
                  {room.capacity >= section.enrolled_count
                    ? `${room.capacity} capacity fits ~${section.enrolled_count} enrolled`
                    : `Insufficient capacity — ${room.capacity} < ${section.enrolled_count} enrolled`}
                </p>
              )}
            </div>
            <div>
              <p className="mb-1.5 text-sm font-medium text-ink">Selected section</p>
              <div className="flex flex-wrap gap-1.5">
                {section ? (
                  <>
                    <Badge variant="info" dot>{section.semester}</Badge>
                    <Badge variant="outline">Batch {section.batch}</Badge>
                    <Badge variant="outline">{section.enrolled_count} enrolled</Badge>
                  </>
                ) : (
                  <p className="text-sm text-ink-muted">Pick a course and section first.</p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <Select
                label="Invigilator"
                options={invigilatorOptions}
                value={invigilatorId}
                onChange={setInvigilatorId}
                placeholder="Search name or department…"
                clearable
              />
              {invigilatorRoster.length === 0 && (
                <p className="mt-1.5 text-xs text-ink-muted">Loading invigilator roster…</p>
              )}
              {invigilator && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Badge variant="info" dot>{invigilator.department_name}</Badge>
                  <Badge
                    variant={
                      invigilator.availability === 'Available'
                        ? 'success'
                        : invigilator.availability === 'Busy'
                          ? 'warning'
                          : 'default'
                    }
                    dot
                  >
                    {invigilator.availability}
                  </Badge>
                  <Badge variant="outline">
                    {invigilator.assigned_count}/{invigilator.max_assignments_per_cycle} assigned
                  </Badge>
                </div>
              )}
            </div>
            <div>
              <p className="mb-1.5 text-sm font-medium text-ink">Assignment recap</p>
              {invigilator ? (
                <div className="rounded-md border border-line bg-surface/60 p-3 text-sm text-ink">
                  <p className="font-semibold">{invigilator.name} will invigilate this exam.</p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {invigilator.designation} · {invigilator.email} — saving assigns them to this entry
                    and updates their duty count in the Directory.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-ink-muted">
                  Pick an invigilator from the directory — assignments update their duty count in the
                  Invigilator Directory.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {checksRun && (
        <div className="space-y-2">
          {blocking && (
            <div className="flex items-start gap-3 rounded-md border border-danger/40 bg-danger-light p-4">
              <Siren className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-danger">
                  {checking ? 'Checking clashes…' : `Clash detected — ${affectedStudents(clashResult?.clashes ?? []).length} student(s) affected`}
                </p>
                <ul className="mt-1.5 space-y-1 text-sm text-ink">
                  {affectedStudents(clashResult?.clashes ?? []).map((stu) => (
                    <li key={stu.id}>
                      <span className="font-semibold">{stu.regId}</span> · {stu.name} — also sitting{' '}
                      {conflictingCourses(
                        (clashResult?.clashes ?? []).filter((h) => h.student.id === stu.id),
                      ).join(', ')}{' '}
                      in this slot
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-xs text-ink-muted">
                  These students already have an exam in this slot. Provide an override reason to save
                  anyway.
                </p>
              </div>
            </div>
          )}
          {!blocking && dayWarn && (
            <div className="flex items-start gap-3 rounded-md border border-warning/40 bg-warning-light p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning-deep" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-warning-deep">
                  {checking ? 'Checking clashes…' : 'Same-day load warning'}
                </p>
                <ul className="mt-1 space-y-1 text-sm text-ink">
                  {affectedStudents(clashResult?.dayLoadWarnings ?? []).map((stu) => (
                    <li key={stu.id}>
                      <span className="font-semibold">{stu.regId}</span> · {stu.name} also has{' '}
                      {conflictingCourses(
                        (clashResult?.dayLoadWarnings ?? []).filter((h) => h.student.id === stu.id),
                      ).join(', ')}{' '}
                      on this date
                    </li>
                  ))}
                  {roomLoad.map((e) => (
                    <li key={e.id}>
                      {e.course_code} already uses {room?.name} on this date ({e.time_slot_label})
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-xs text-ink-muted">Non-blocking — you can still save.</p>
              </div>
            </div>
          )}
          {!blocking && !dayWarn && (
            <div className="flex items-center gap-3 rounded-md border border-success/40 bg-success-light p-4">
              {checking ? (
                <Loader2 className="h-5 w-5 animate-spin text-success" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden="true" />
              )}
              <p className="text-sm font-bold text-success">
                {checking ? 'Checking clashes…' : 'No clashes detected — safe to save'}
              </p>
            </div>
          )}
        </div>
      )}

      {blocking && (
        <Card className="border-danger/40">
          <CardContent>
            <Input
              label="Override reason (required to save)"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              hint="Written to the override request and visible in the clash log."
            />
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button
          variant="secondary"
          onClick={resetForm}
          disabled={!courseId && !sectionId && !date && !slotId && !roomId && !invigilatorId}
        >
          Clear
        </Button>
        <Button variant="primary" disabled={!canSave} onClick={() => setConfirmOpen(true)}>
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="h-4 w-4" aria-hidden="true" />
          )}
          {editing ? 'Save changes' : blocking ? 'Force-save with override' : 'Save entry'}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleSave}
        title={editing ? 'Save these changes?' : 'Save this schedule entry?'}
        description={
          course && section && slot && room && invigilator
            ? `${course.course_code} · Batch ${section.batch} · ${formatDateLabel(date)} · ${slot.label} · ${room.name} · ${invigilator.name}${
                blocking && overrideReason.trim()
                  ? `\nOverride reason: “${overrideReason.trim()}”`
                  : ''
              }`
            : undefined
        }
        confirmLabel={editing ? 'Save changes' : blocking ? 'Force-save' : 'Save entry'}
        cancelLabel="Cancel"
        variant="primary"
      />
    </div>
  )
}
