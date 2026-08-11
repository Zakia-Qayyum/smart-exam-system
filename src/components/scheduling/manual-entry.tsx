import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Save, Siren } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { toast } from '@/components/ui/toast-store'
import { CalendarPicker } from '@/components/scheduling/calendar-picker'
import {
  buildScheduleEntries,
  courses,
  departments,
  EXAM_CYCLE,
  EXAM_WINDOW,
  formatDateLabel,
  invigilators,
  rooms,
  sectionsFor,
  timeSlots,
} from '@/config/scheduling-data'
import {
  detectClashes,
  hasBlockingClash,
  hasDayLoadWarning,
  roomSameDayLoad,
} from '@/lib/clash-check'
import { cn } from '@/lib/utils'
import type { MockScheduleEntry, MockTimeSlot } from '@/lib/types'

function SlotChip({
  slot,
  active,
  onSelect,
}: {
  slot: MockTimeSlot
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
  const [departmentId, setDepartmentId] = useState('')
  const [courseCode, setCourseCode] = useState('')
  const [date, setDate] = useState('')
  const [slotId, setSlotId] = useState('')
  const [roomId, setRoomId] = useState('')
  const [invigilatorId, setInvigilatorId] = useState('')
  const [overrideReason, setOverrideReason] = useState('')
  const [savedEntries, setSavedEntries] = useState<MockScheduleEntry[]>([])
  const [confirmOpen, setConfirmOpen] = useState(false)

  const baseEntries = useMemo(() => buildScheduleEntries().entries, [])
  const entries = useMemo(() => [...baseEntries, ...savedEntries], [baseEntries, savedEntries])

  const course = useMemo(
    () => courses.find((c) => c.course_code === courseCode) ?? null,
    [courseCode],
  )
  const slot = useMemo(
    () => timeSlots.find((s) => s.id === slotId) ?? null,
    [slotId],
  )
  const room = useMemo(() => rooms.find((r) => r.id === roomId) ?? null, [roomId])
  const invigilator = useMemo(
    () => invigilators.find((i) => i.id === invigilatorId) ?? null,
    [invigilatorId],
  )

  const typicalEnroll = useMemo(() => {
    if (!course) return 0
    const courseIndex = courses.findIndex((c) => c.course_code === course.course_code)
    return Math.max(...sectionsFor(courseIndex, course).map((s) => s.enrolled_count))
  }, [course])

  const clashes = useMemo(() => {
    if (!course || !date || !slot) return []
    return detectClashes({ program: course.program_code, date, time_slot_id: slot.id }, entries)
  }, [course, date, slot, entries])

  const roomLoad = useMemo(() => {
    if (!date || !room) return []
    return roomSameDayLoad(entries, date, room.id)
  }, [date, room, entries])

  const blocking = hasBlockingClash(clashes)
  const dayWarn = hasDayLoadWarning(clashes) || roomLoad.length > 0
  const checksRun = Boolean(course && date && slot)

  const courseOptions = useMemo(
    () =>
      courses
        .filter((c) => c.department_id === departmentId)
        .map((c) => ({ value: c.course_code, label: `${c.course_code} — ${c.title}` })),
    [departmentId],
  )
  const roomOptions = useMemo(
    () => rooms.map((r) => ({ value: r.id, label: `${r.name} · Cap ${r.capacity}` })),
    [],
  )
  const invigilatorOptions = useMemo(
    () =>
      invigilators.map((i) => ({
        value: i.id,
        label: `${i.name} · ${i.department_name} · ${i.availability} (${i.assigned_count}/${i.max_assignments_per_cycle})`,
      })),
    [],
  )

  const canSave =
    Boolean(departmentId && courseCode && date && slotId && roomId && invigilatorId) &&
    (!blocking || overrideReason.trim().length > 0)

  const resetForm = () => {
    setCourseCode('')
    setDate('')
    setSlotId('')
    setRoomId('')
    setInvigilatorId('')
    setOverrideReason('')
  }

  const handleSave = () => {
    if (!course || !slot || !room || !invigilator) return
    const entry: MockScheduleEntry = {
      id: `se-manual-${Date.now()}`,
      exam_cycle_id: EXAM_CYCLE.id,
      section_id: `sec-manual-${course.course_code.toLowerCase()}-2024`,
      course_code: course.course_code,
      course_title: course.title,
      department_id: course.department_id,
      program: course.program_code,
      batch: '2024',
      date,
      time_slot_id: slot.id,
      time_slot_label: slot.label,
      room_id: room.id,
      room_name: room.name,
      room_capacity: room.capacity,
      enrolled_count: typicalEnroll,
      status: 'scheduled',
    }
    setSavedEntries((list) => [...list, entry])
    toast({
      variant: 'success',
      title: 'Schedule entry saved',
      description: `${entry.course_code} · ${formatDateLabel(entry.date)} · ${entry.time_slot_label} · ${entry.room_name}`,
      duration: 8000,
      action: {
        label: 'Undo',
        onClick: () => {
          setSavedEntries((list) => list.filter((e) => e.id !== entry.id))
          toast({ variant: 'info', title: 'Save undone', description: `${entry.course_code} was removed from the timetable.` })
        },
      },
    })
    resetForm()
    setConfirmOpen(false)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>New schedule entry</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Select
              label="Department"
              options={departments.map((d) => ({ value: d.id, label: `${d.code} · ${d.name}` }))}
              value={departmentId}
              onChange={(v) => {
                setDepartmentId(v)
                setCourseCode('')
              }}
              placeholder="Search department…"
              clearable
            />
            <Select
              label="Course"
              options={courseOptions}
              value={courseCode}
              onChange={setCourseCode}
              placeholder="Filtered by department…"
              disabled={!departmentId}
              clearable
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <p className="mb-1.5 text-sm font-medium text-ink">Date</p>
              <CalendarPicker
                value={date}
                onChange={setDate}
                min={EXAM_WINDOW.start}
                max={EXAM_WINDOW.end}
              />
              <p className="mt-1.5 text-xs text-ink-muted">
                Exam window {formatDateLabel(EXAM_WINDOW.start)} – {formatDateLabel(EXAM_WINDOW.end)}
              </p>
            </div>
            <div>
              <p className="mb-1.5 text-sm font-medium text-ink">Time slot</p>
              <div className="grid grid-cols-2 gap-2">
                {timeSlots.map((s) => (
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
              {room && course && (
                <p
                  className={cn(
                    'mt-1.5 text-xs font-semibold',
                    room.capacity >= typicalEnroll ? 'text-success' : 'text-danger',
                  )}
                >
                  {room.capacity >= typicalEnroll
                    ? `${room.capacity} capacity fits ~${typicalEnroll} enrolled`
                    : `Insufficient capacity — ${room.capacity} < ${typicalEnroll} enrolled`}
                </p>
              )}
            </div>
            <div>
              <Select
                label="Invigilator"
                options={invigilatorOptions}
                value={invigilatorId}
                onChange={setInvigilatorId}
                placeholder="Search name or department…"
                clearable
              />
              {invigilator && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Badge variant="info" dot>
                    {invigilator.department_name}
                  </Badge>
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
          </div>
        </CardContent>
      </Card>

      {checksRun && (
        <div className="space-y-2">
          {blocking && (
            <div className="flex items-start gap-3 rounded-md border border-danger/40 bg-danger-light p-4">
              <Siren className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-danger">Clash detected — save blocked</p>
                <ul className="mt-1.5 space-y-1 text-sm text-ink">
                  {clashes
                    .filter((c) => c.type === 'same_slot')
                    .map((c) => (
                      <li key={c.entry.id}>
                        {c.entry.course_code} · {formatDateLabel(c.entry.date)} ·{' '}
                        {c.entry.time_slot_label} — {c.entry.enrolled_count} student(s) affected
                      </li>
                    ))}
                </ul>
                <p className="mt-1 text-xs text-ink-muted">
                  These students already have an exam in this slot. Provide an override reason to
                  save anyway.
                </p>
              </div>
            </div>
          )}
          {!blocking && dayWarn && (
            <div className="flex items-start gap-3 rounded-md border border-warning/40 bg-warning-light p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning-deep" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-warning-deep">Same-day load warning</p>
                <ul className="mt-1 space-y-1 text-sm text-ink">
                  {clashes
                    .filter((c) => c.type === 'same_day')
                    .map((c) => (
                      <li key={c.entry.id}>
                        {c.entry.course_code} · {c.entry.time_slot_label} already on this date
                      </li>
                    ))}
                  {roomLoad.map((e) => (
                    <li key={e.id}>
                      {e.course_code} already uses {room?.name} on this date ({e.time_slot_label})
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-xs text-ink-muted">
                  Non-blocking — you can still save.
                </p>
              </div>
            </div>
          )}
          {!blocking && !dayWarn && (
            <div className="flex items-center gap-3 rounded-md border border-success/40 bg-success-light p-4">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden="true" />
              <p className="text-sm font-bold text-success">No clashes detected — safe to save</p>
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
              hint="This reason is attached to the entry and visible in the clash log."
            />
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button variant="secondary" onClick={resetForm} disabled={!departmentId && !courseCode && !date && !slotId && !roomId && !invigilatorId}>
          Clear
        </Button>
        <Button variant="primary" disabled={!canSave} onClick={() => setConfirmOpen(true)}>
          <Save className="h-4 w-4" aria-hidden="true" /> Save entry
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleSave}
        title="Save this schedule entry?"
        description={
          course && slot && room && invigilator
            ? `${course.course_code} · ${formatDateLabel(date)} · ${slot.label} · ${room.name} · ${invigilator.name}${
                blocking && overrideReason.trim()
                  ? `\nOverride reason: “${overrideReason.trim()}”`
                  : ''
              }`
            : undefined
        }
        confirmLabel="Save entry"
        cancelLabel="Cancel"
        variant="primary"
      />
    </div>
  )
}
