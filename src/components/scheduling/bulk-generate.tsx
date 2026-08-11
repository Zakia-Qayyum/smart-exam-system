import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarCheck,
  Check,
  CheckCircle2,
  DoorOpen,
  RefreshCw,
  Siren,
  Sparkles,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import {
  buildScheduleEntries,
  departments,
  EXAM_CYCLE,
  formatDateLabel,
  programs,
  rooms,
  timeSlots,
} from '@/config/scheduling-data'
import { cn } from '@/lib/utils'
import type { MockScheduleEntry, MockTimeSlot, ScheduleSummary } from '@/lib/types'

const STEPS = [
  { label: 'Cycle & programs', hint: 'Pick the exam cycle and target programs' },
  { label: 'Date range & slots', hint: 'Set days and time slots per day' },
  { label: 'Rooms & capacity', hint: 'Choose the room pool' },
  { label: 'Review & generate', hint: 'Confirm and run the generator' },
]

function StepHeader({ step }: { step: number }) {
  return (
    <ol className="flex items-center gap-2 overflow-x-auto">
      {STEPS.map((s, i) => {
        const done = i < step
        const active = i === step
        return (
          <li key={s.label} className="flex items-center gap-2">
            <div
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-black transition-colors',
                done && 'border-success bg-success text-white',
                active && 'border-navy bg-navy text-white',
                !done && !active && 'border-line bg-card text-ink-muted',
              )}
            >
              {done ? <Check className="h-4 w-4" aria-hidden="true" /> : i + 1}
            </div>
            <div className="min-w-0">
              <p
                className={cn(
                  'whitespace-nowrap text-xs font-bold',
                  active ? 'text-ink' : done ? 'text-success' : 'text-ink-muted',
                )}
              >
                {s.label}
              </p>
              <p className="hidden whitespace-nowrap text-[11px] text-ink-muted/70 sm:block">
                {s.hint}
              </p>
            </div>
            {i < STEPS.length - 1 && <span className="mx-1 h-px w-8 bg-line" aria-hidden="true" />}
          </li>
        )
      })}
    </ol>
  )
}

function ToggleChip({
  active,
  onClick,
  label,
  sub,
}: {
  active: boolean
  onClick: () => void
  label: string
  sub?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm font-semibold transition-all',
        active
          ? 'border-navy bg-navy/5 text-navy'
          : 'border-line bg-card text-ink-muted hover:border-navy/40 hover:text-ink',
      )}
    >
      <span
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-colors',
          active ? 'border-navy bg-navy text-white' : 'border-line bg-surface',
        )}
      >
        {active && <Check className="h-3 w-3" aria-hidden="true" />}
      </span>
      <span className="min-w-0">
        <span className="block truncate">{label}</span>
        {sub && <span className="block truncate text-[11px] font-medium opacity-70">{sub}</span>}
      </span>
    </button>
  )
}

function toggleIn(set: Set<string>, value: string): Set<string> {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

function ResultsTable({
  entries,
  summary,
  onViewClash,
  onRegenerate,
  onBack,
}: {
  entries: MockScheduleEntry[]
  summary: ScheduleSummary
  onViewClash: (id: string) => void
  onRegenerate: () => void
  onBack: () => void
}) {
  const columns: Column<MockScheduleEntry>[] = [
    {
      key: 'course_code',
      header: 'Course',
      sortable: true,
      sortValue: (r) => r.course_code,
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{r.course_code}</p>
          <p className="truncate text-xs text-ink-muted">{r.course_title}</p>
        </div>
      ),
    },
    { key: 'batch', header: 'Batch', sortable: true },
    {
      key: 'program',
      header: 'Program',
      sortable: true,
      render: (r) => <Badge variant="default">{r.program}</Badge>,
    },
    {
      key: 'date',
      header: 'Date',
      sortable: true,
      sortValue: (r) => r.date,
      render: (r) => <span className="whitespace-nowrap">{formatDateLabel(r.date)}</span>,
    },
    {
      key: 'time_slot_label',
      header: 'Slot',
      sortable: true,
      render: (r) => (
        <div>
          <p className="text-ink">{r.time_slot_label}</p>
          <p className="text-[11px] text-ink-muted">{r.enrolled_count} students</p>
        </div>
      ),
    },
    {
      key: 'room_name',
      header: 'Room',
      sortable: true,
      render: (r) => (
        <div>
          <p className="text-ink">{r.room_name}</p>
          <p className="text-[11px] text-ink-muted">
            {r.enrolled_count}/{r.room_capacity} seats
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (r) =>
        r.status === 'scheduled' ? (
          <Badge variant="success">Scheduled</Badge>
        ) : (
          <Badge variant="warning">Needs review</Badge>
        ),
    },
    {
      key: 'action',
      header: 'Clash',
      align: 'right',
      render: (r) =>
        r.status === 'needs_review' ? (
          <Button variant="outline" size="sm" onClick={() => onViewClash(r.id)}>
            View clash
          </Button>
        ) : (
          <span className="text-ink-muted/50">—</span>
        ),
    },
  ]

  return (
    <div className="space-y-4">
      <Card className="border-navy/15 bg-navy/[0.04]">
        <CardContent className="flex flex-wrap items-center gap-x-10 gap-y-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-success-light">
              <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />
            </span>
            <div>
              <p className="text-2xl font-black tracking-tight text-ink">{summary.scheduled}</p>
              <p className="text-xs font-semibold text-ink-muted">scheduled</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-warning-light">
              <AlertTriangle className="h-5 w-5 text-warning-deep" aria-hidden="true" />
            </span>
            <div>
              <p className="text-2xl font-black tracking-tight text-ink">
                {summary.needs_review}
              </p>
              <p className="text-xs font-semibold text-ink-muted">need manual resolution</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-danger-light">
              <Siren className="h-5 w-5 text-danger" aria-hidden="true" />
            </span>
            <div>
              <p className="text-2xl font-black tracking-tight text-ink">{summary.same_slot}</p>
              <p className="text-xs font-semibold text-ink-muted">same-slot clashes</p>
            </div>
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="secondary" size="sm" onClick={onBack}>
              Back to options
            </Button>
            <Button variant="outline" size="sm" onClick={onRegenerate}>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Regenerate
            </Button>
          </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={entries}
        getRowKey={(r) => r.id}
        pageSize={8}
        emptyTitle="No entries generated"
        emptyDescription="Run the generator again with different options."
      />
    </div>
  )
}

export function BulkGenerate() {
  const [step, setStep] = useState(0)
  const [selectedDepartments, setSelectedDepartments] = useState(
    () => new Set(departments.map((d) => d.id)),
  )
  const [selectedPrograms, setSelectedPrograms] = useState(() => new Set(programs.map((p) => p.code)))
  const [range, setRange] = useState({ start: EXAM_CYCLE.start_date, end: EXAM_CYCLE.end_date })
  const [slots, setSlots] = useState<Array<MockTimeSlot & { enabled: boolean }>>(
    () => timeSlots.map((s) => ({ ...s, enabled: true })),
  )
  const [selectedRooms, setSelectedRooms] = useState(() => new Set(rooms.map((r) => r.id)))
  const [phase, setPhase] = useState<'options' | 'progress' | 'done'>('options')
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<{ entries: MockScheduleEntry[]; summary: ScheduleSummary } | null>(null)
  const [viewClashId, setViewClashId] = useState<string | null>(null)

  const visiblePrograms = programs.filter((p) => selectedDepartments.has(p.department_id))
  const canNext =
    (step === 0 && selectedPrograms.size > 0) ||
    (step === 1 && range.start <= range.end && slots.some((s) => s.enabled)) ||
    (step === 2 && selectedRooms.size > 0)

  const startGenerate = () => {
    setPhase('progress')
    setProgress(0)
    setResult(null)
  }

  useEffect(() => {
    if (phase !== 'progress') return
    const timer = setInterval(() => {
      setProgress((p) => {
        const next = Math.min(100, p + 4 + Math.floor(Math.random() * 5))
        if (next >= 100) {
          clearInterval(timer)
          setTimeout(() => {
            setResult(buildScheduleEntries())
            setPhase('done')
          }, 250)
        }
        return next
      })
    }, 60)
    return () => clearInterval(timer)
  }, [phase])

  const clashEntry = useMemo(
    () => result?.entries.find((e) => e.id === viewClashId) ?? null,
    [result, viewClashId],
  )

  if (phase === 'done' && result) {
    return (
      <ResultsTable
        entries={result.entries}
        summary={result.summary}
        onViewClash={setViewClashId}
        onRegenerate={startGenerate}
        onBack={() => {
          setPhase('options')
          setStep(0)
        }}
      />
    )
  }

  if (phase === 'progress') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Generating timetable…</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-navy/10">
              <Sparkles className="h-5 w-5 animate-pulse text-navy" aria-hidden="true" />
            </span>
            <div className="flex-1">
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface">
                <div
                  className="h-full rounded-full bg-navy transition-all duration-150"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-2 text-xs font-semibold text-ink-muted">
                {progress < 40
                  ? 'Reserving rooms and assigning sections…'
                  : progress < 80
                    ? 'Running clash detection across programs…'
                    : 'Finalizing the draft timetable…'}{' '}
                {progress}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <StepHeader step={step} />

      <Card>
        <CardHeader>
          <CardTitle>{STEPS[step].label}</CardTitle>
        </CardHeader>
        <CardContent>
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <p className="mb-2 text-sm font-bold text-ink">Exam cycle</p>
                <div className="flex items-center gap-3 rounded-md border border-line bg-card px-3 py-2.5">
                  <CalendarCheck className="h-4 w-4 text-navy" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{EXAM_CYCLE.name}</p>
                    <p className="text-xs text-ink-muted">
                      {formatDateLabel(EXAM_CYCLE.start_date)} – {formatDateLabel(EXAM_CYCLE.end_date)}
                    </p>
                  </div>
                  <Badge variant="gold" className="ml-auto">{EXAM_CYCLE.term}</Badge>
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-bold text-ink">Departments</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {departments.map((d) => (
                    <ToggleChip
                      key={d.id}
                      active={selectedDepartments.has(d.id)}
                      onClick={() => setSelectedDepartments((s) => toggleIn(s, d.id))}
                      label={d.code}
                      sub={d.name}
                    />
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-bold text-ink">Programs</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {visiblePrograms.map((p) => (
                    <ToggleChip
                      key={p.code}
                      active={selectedPrograms.has(p.code)}
                      onClick={() => setSelectedPrograms((s) => toggleIn(s, p.code))}
                      label={p.code}
                      sub={p.name}
                    />
                  ))}
                </div>
                {visiblePrograms.length === 0 && (
                  <p className="text-sm text-ink-muted">Select at least one department first.</p>
                )}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="Start date"
                  type="date"
                  min={EXAM_CYCLE.start_date}
                  max={EXAM_CYCLE.end_date}
                  value={range.start}
                  onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))}
                />
                <Input
                  label="End date"
                  type="date"
                  min={EXAM_CYCLE.start_date}
                  max={EXAM_CYCLE.end_date}
                  value={range.end}
                  onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))}
                />
              </div>
              <p className="text-xs text-ink-muted">
                Bounded to the {EXAM_CYCLE.term} exam window ({EXAM_CYCLE.start_date} –{' '}
                {EXAM_CYCLE.end_date}).
              </p>

              <div>
                <p className="mb-2 text-sm font-bold text-ink">Time slots per day</p>
                <div className="space-y-2">
                  {slots.map((slot, i) => (
                    <div
                      key={slot.id}
                      className="flex items-center gap-3 rounded-md border border-line bg-card px-3 py-2.5"
                    >
                      <ToggleChip
                        active={slot.enabled}
                        onClick={() =>
                          setSlots((list) =>
                            list.map((s) => (s.id === slot.id ? { ...s, enabled: !s.enabled } : s)),
                          )
                        }
                        label={slot.label}
                      />
                      <div className="ml-auto flex items-center gap-2">
                        <Input
                          label="Start"
                          type="time"
                          className="w-32"
                          value={slot.start_time}
                          disabled={!slot.enabled}
                          onChange={(e) =>
                            setSlots((list) =>
                              list.map((s, j) =>
                                j === i ? { ...s, start_time: e.target.value } : s,
                              ),
                            )
                          }
                        />
                        <Input
                          label="End"
                          type="time"
                          className="w-32"
                          value={slot.end_time}
                          disabled={!slot.enabled}
                          onChange={(e) =>
                            setSlots((list) =>
                              list.map((s, j) => (j === i ? { ...s, end_time: e.target.value } : s)),
                            )
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <p className="mb-2 text-sm font-bold text-ink">Room &amp; capacity pool</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {rooms.map((room) => (
                  <ToggleChip
                    key={room.id}
                    active={selectedRooms.has(room.id)}
                    onClick={() => setSelectedRooms((s) => toggleIn(s, room.id))}
                    label={room.name}
                    sub={`Capacity ${room.capacity} · ${room.department_id ? 'Departmental' : 'General purpose'}`}
                  />
                ))}
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-muted">
                <DoorOpen className="h-3.5 w-3.5" aria-hidden="true" />
                Sections are auto-assigned to the smallest room that fits their enrollment.
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'Programs', value: selectedPrograms.size },
                  { label: 'Departments', value: selectedDepartments.size },
                  { label: 'Slots / day', value: slots.filter((s) => s.enabled).length },
                  { label: 'Rooms', value: selectedRooms.size },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-md border border-line bg-surface px-4 py-3"
                  >
                    <p className="text-xl font-black text-ink">{stat.value}</p>
                    <p className="text-xs font-semibold text-ink-muted">{stat.label}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-md border border-line bg-card p-4 text-sm">
                <p className="font-bold text-ink">Range</p>
                <p className="mt-1 text-ink-muted">
                  {formatDateLabel(range.start)} – {formatDateLabel(range.end)}
                </p>
                <p className="mt-3 font-bold text-ink">Active time slots</p>
                <ul className="mt-1 space-y-1 text-ink-muted">
                  {slots
                    .filter((s) => s.enabled)
                    .map((s) => (
                      <li key={s.id}>
                        {s.label} · {s.start_time}–{s.end_time}
                      </li>
                    ))}
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button variant="primary" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
            Continue
          </Button>
        ) : (
          <Button variant="gold" onClick={startGenerate}>
            <Sparkles className="h-4 w-4" aria-hidden="true" /> Generate schedule
          </Button>
        )}
      </div>

      <Modal
        open={Boolean(clashEntry)}
        onClose={() => setViewClashId(null)}
        title={clashEntry ? `Clash · ${clashEntry.course_code}` : ''}
        description={clashEntry ? `${clashEntry.program} ${clashEntry.batch}` : undefined}
        footer={
          <Button variant="secondary" onClick={() => setViewClashId(null)}>
            Close
          </Button>
        }
      >
        {clashEntry && (
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3 rounded-md border border-danger/25 bg-danger-light p-3">
              <Siren className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
              <p className="text-ink">{clashEntry.clash_detail}</p>
            </div>
            <dl className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-xs font-semibold text-ink-muted">Course</dt>
                <dd className="font-semibold text-ink">
                  {clashEntry.course_code} · {clashEntry.course_title}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-ink-muted">When</dt>
                <dd className="font-semibold text-ink">
                  {formatDateLabel(clashEntry.date)} · {clashEntry.time_slot_label}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-ink-muted">Room</dt>
                <dd className="font-semibold text-ink">{clashEntry.room_name}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-ink-muted">Enrolled</dt>
                <dd className="font-semibold text-ink">{clashEntry.enrolled_count}</dd>
              </div>
            </dl>
            <p className="w-full rounded-md border border-line bg-surface px-3 py-2 text-center text-xs font-semibold text-ink-muted">
              Resolve in the Clash Center (later step)
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}
