import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarCheck,
  Check,
  CheckCircle2,
  DoorOpen,
  Loader2,
  RefreshCw,
  Siren,
  Sparkles,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Modal } from '@/components/ui/modal'
import { toast } from '@/components/ui/toast-store'
import {
  fetchCatalog,
  fetchClashes,
  getGenerateJob,
  startGenerate as startGenerateJob,
} from '@/services/scheduling-service'
import { formatDateLabel } from '@/config/scheduling-data'
import { cn } from '@/lib/utils'
import type {
  ApiClashRecord,
  ApiGenerateResult,
  ApiScheduleEntry,
  ApiTimeSlot,
  SchedulingCatalog,
} from '@/lib/types'

const STEPS = [
  { label: 'Cycle & programs', hint: 'Review the current exam cycle' },
  { label: 'Date range & slots', hint: 'Cycle window and daily time slots' },
  { label: 'Rooms & capacity', hint: 'The room pool used by the engine' },
  { label: 'Review & generate', hint: 'Confirm and run the real scheduler' },
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

function InfoChip({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-line bg-card px-3 py-2 text-left text-sm font-semibold text-ink">
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-line bg-surface">
        <Check className="h-3 w-3 text-success" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block truncate">{label}</span>
        {sub && <span className="block truncate text-[11px] font-medium opacity-70">{sub}</span>}
      </span>
    </div>
  )
}

function ResultSummary({
  result,
  onRegenerate,
  onBack,
}: {
  result: ApiGenerateResult
  onRegenerate: () => void
  onBack: () => void
}) {
  return (
    <Card className="border-navy/15 bg-navy/[0.04]">
      <CardContent className="flex flex-wrap items-center gap-x-10 gap-y-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-success-light">
            <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />
          </span>
          <div>
            <p className="text-2xl font-black tracking-tight text-ink">{result.scheduled}</p>
            <p className="text-xs font-semibold text-ink-muted">scheduled</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-warning-light">
            <AlertTriangle className="h-5 w-5 text-warning-deep" aria-hidden="true" />
          </span>
          <div>
            <p className="text-2xl font-black tracking-tight text-ink">{result.needs_review}</p>
            <p className="text-xs font-semibold text-ink-muted">need manual resolution</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-danger-light">
            <Siren className="h-5 w-5 text-danger" aria-hidden="true" />
          </span>
          <div>
            <p className="text-2xl font-black tracking-tight text-ink">{result.same_slot}</p>
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
  )
}

export function BulkGenerate() {
  const [catalog, setCatalog] = useState<SchedulingCatalog | null>(null)
  const [loadError, setLoadError] = useState('')
  const [step, setStep] = useState(0)
  const [phase, setPhase] = useState<'options' | 'progress' | 'done'>('options')
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<ApiGenerateResult | null>(null)
  const [generateError, setGenerateError] = useState('')
  const [viewClashId, setViewClashId] = useState<string | null>(null)
  const [entryClashes, setEntryClashes] = useState<ApiClashRecord[]>([])
  const [clashLoading, setClashLoading] = useState(false)

  const cycle = catalog?.cycle ?? null
  const timeSlots: ApiTimeSlot[] = catalog?.time_slots ?? []

  useEffect(() => {
    let cancelled = false
    fetchCatalog()
      .then((cat) => {
        if (!cancelled) setCatalog(cat)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load scheduling data')
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const canGenerate = Boolean(catalog && cycle)

  const pollJob = async (jobId: string, attemptsLeft: number): Promise<void> => {
    if (attemptsLeft <= 0) {
      setGenerateError('Generation timed out — try again.')
      setPhase('options')
      toast({ variant: 'danger', title: 'Generation timed out', description: 'The job did not finish in time.' })
      return
    }
    let job
    try {
      job = await getGenerateJob(jobId)
    } catch (err) {
      setPhase('options')
      toast({
        variant: 'danger',
        title: 'Generation status lost',
        description: err instanceof Error ? err.message : 'Unexpected error',
      })
      return
    }
    if (job.status === 'completed' && job.result) {
      setProgress(100)
      setTimeout(() => {
        setResult(job.result!)
        setPhase('done')
      }, 300)
      return
    }
    if (job.status === 'failed') {
      setGenerateError(job.error ?? 'Generation failed')
      setPhase('options')
      toast({ variant: 'danger', title: 'Generation failed', description: job.error ?? 'Unknown error' })
      return
    }
    setProgress((p) => Math.min(92, p + 8 + Math.floor(Math.random() * 6)))
    await new Promise((r) => setTimeout(r, 1100))
    return pollJob(jobId, attemptsLeft - 1)
  }

  const startGenerate = async () => {
    setPhase('progress')
    setProgress(0)
    setResult(null)
    setGenerateError('')
    try {
      const { jobId } = await startGenerateJob(cycle?.id)
      await pollJob(jobId, 180)
    } catch (err) {
      setPhase('options')
      toast({
        variant: 'danger',
        title: 'Could not start generation',
        description: err instanceof Error ? err.message : 'Unexpected error',
      })
    }
  }

  const openClash = async (entryId: string) => {
    setViewClashId(entryId)
    setEntryClashes([])
    setClashLoading(true)
    try {
      const list = await fetchClashes({ status: 'all', page_size: 200 })
      setEntryClashes(list.clashes.filter((c) => c.schedule_entry_ids.includes(entryId)))
    } catch (err) {
      toast({
        variant: 'danger',
        title: 'Could not load clash details',
        description: err instanceof Error ? err.message : 'Unexpected error',
      })
    } finally {
      setClashLoading(false)
    }
  }

  const columns: Column<ApiScheduleEntry>[] = useMemo(
    () => [
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
        key: 'department_code',
        header: 'Dept',
        sortable: true,
        render: (r) => <Badge variant="default">{r.department_code}</Badge>,
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
            <Button variant="outline" size="sm" onClick={() => openClash(r.id)}>
              View clash
            </Button>
          ) : (
            <span className="text-ink-muted/50">—</span>
          ),
      },
    ],
    [],
  )

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

  if (phase === 'done' && result) {
    const clashEntry = result.entries.find((e) => e.id === viewClashId) ?? null
    return (
      <div className="space-y-4">
        <ResultSummary
          result={result}
          onRegenerate={startGenerate}
          onBack={() => {
            setPhase('options')
            setStep(0)
          }}
        />
        <DataTable
          columns={columns}
          data={result.entries}
          getRowKey={(r) => r.id}
          pageSize={8}
          emptyTitle="No entries generated"
          emptyDescription="Run the generator again with different options."
        />
        <Modal
          open={Boolean(clashEntry)}
          onClose={() => setViewClashId(null)}
          title={clashEntry ? `Clash · ${clashEntry.course_code}` : ''}
          description={clashEntry ? `${clashEntry.department_name} · Batch ${clashEntry.batch}` : undefined}
          footer={
            <Button variant="secondary" onClick={() => setViewClashId(null)}>
              Close
            </Button>
          }
        >
          {clashLoading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-ink-muted">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading clash records…
            </div>
          ) : entryClashes.length === 0 ? (
            <p className="rounded-md border border-line bg-surface px-3 py-4 text-center text-xs font-semibold text-ink-muted">
              No open clash records reference this entry.
            </p>
          ) : (
            <div className="space-y-2">
              {entryClashes.map((c) => (
                <div
                  key={c.id}
                  className={cn(
                    'flex items-start gap-3 rounded-md border p-3',
                    c.type === 'same_slot' ? 'border-danger/25 bg-danger-light' : 'border-warning/40 bg-warning-light',
                  )}
                >
                  <Siren
                    className={cn(
                      'mt-0.5 h-4 w-4 shrink-0',
                      c.type === 'same_slot' ? 'text-danger' : 'text-warning-deep',
                    )}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-bold text-ink">
                      {c.student.name} · {c.student.reg_id}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {c.entries.map((e) => e.course_code).join(', ')} — {c.entries[0]?.date} ·{' '}
                      {c.entries[0]?.time_slot_label}
                    </p>
                  </div>
                  <Badge variant={c.type === 'same_slot' ? 'danger' : 'warning'}>
                    {c.type === 'same_slot' ? 'Same-slot' : 'Same-day'}
                  </Badge>
                </div>
              ))}
              <p className="w-full rounded-md border border-line bg-surface px-3 py-2 text-center text-xs font-semibold text-ink-muted">
                Review and resolve in the Clash Center (later step)
              </p>
            </div>
          )}
        </Modal>
      </div>
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
                  ? 'Running the real scheduler — reserving rooms and assigning sections…'
                  : progress < 80
                    ? 'Running clash detection across the cycle…'
                    : 'Finalizing the draft timetable…'}{' '}
                {progress}%
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-ink-muted">
            Generation runs as an async job on the backend and reports live status while it works.
          </p>
        </CardContent>
      </Card>
    )
  }

  const sectionsCount = catalog.sections.length

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
                    <p className="truncate text-sm font-semibold text-ink">{cycle?.name}</p>
                    <p className="text-xs text-ink-muted">
                      {cycle ? `${formatDateLabel(cycle.start_date)} – ${formatDateLabel(cycle.end_date)}` : '—'}
                    </p>
                  </div>
                  {cycle && <Badge variant="gold" className="ml-auto">{cycle.term}</Badge>}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-bold text-ink">Departments</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {catalog.departments.map((d) => (
                    <InfoChip key={d.id} label={d.code} sub={d.name} />
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-bold text-ink">Scope</p>
                <p className="text-sm text-ink-muted">
                  The scheduler covers all {catalog.courses.length} courses / {sectionsCount} sections
                  across the selected cycle. It auto-assigns dates, slots and rooms, then runs clash
                  detection over every enrollment.
                </p>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-md border border-line bg-surface px-4 py-3">
                  <p className="text-xs font-semibold text-ink-muted">Start date</p>
                  <p className="text-lg font-black text-ink">{cycle?.start_date}</p>
                </div>
                <div className="rounded-md border border-line bg-surface px-4 py-3">
                  <p className="text-xs font-semibold text-ink-muted">End date</p>
                  <p className="text-lg font-black text-ink">{cycle?.end_date}</p>
                </div>
              </div>
              <p className="text-xs text-ink-muted">
                Bounded to the {cycle?.term} exam window ({cycle?.start_date} – {cycle?.end_date}).
              </p>

              <div>
                <p className="mb-2 text-sm font-bold text-ink">Time slots per day</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {timeSlots.map((slot) => (
                    <InfoChip key={slot.id} label={slot.label} sub={`${slot.start_time}–${slot.end_time}`} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <p className="mb-2 text-sm font-bold text-ink">Room &amp; capacity pool</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {catalog.rooms.map((room) => (
                  <InfoChip key={room.id} label={room.name} sub={`Capacity ${room.capacity}`} />
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
                  { label: 'Courses', value: catalog.courses.length },
                  { label: 'Sections', value: sectionsCount },
                  { label: 'Slots / day', value: timeSlots.length },
                  { label: 'Rooms', value: catalog.rooms.length },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-md border border-line bg-surface px-4 py-3">
                    <p className="text-xl font-black text-ink">{stat.value}</p>
                    <p className="text-xs font-semibold text-ink-muted">{stat.label}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-md border border-line bg-card p-4 text-sm">
                <p className="font-bold text-ink">Range</p>
                <p className="mt-1 text-ink-muted">
                  {cycle ? `${formatDateLabel(cycle.start_date)} – ${formatDateLabel(cycle.end_date)}` : '—'}
                </p>
                <p className="mt-3 font-bold text-ink">Active time slots</p>
                <ul className="mt-1 space-y-1 text-ink-muted">
                  {timeSlots.map((s) => (
                    <li key={s.id}>
                      {s.label} · {s.start_time}–{s.end_time}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 rounded-md border border-line bg-surface px-3 py-2 text-xs text-ink-muted">
                  The generator builds a draft for the whole cycle, then flags every clash as real
                  clash records. Run it again to rebuild the draft from scratch.
                </p>
              </div>
              {generateError && (
                <p className="rounded-md border border-danger/40 bg-danger-light px-3 py-2 text-sm font-semibold text-danger">
                  {generateError}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button variant="primary" onClick={() => setStep((s) => s + 1)}>
            Continue
          </Button>
        ) : (
          <Button variant="gold" disabled={!canGenerate} onClick={startGenerate}>
            <Sparkles className="h-4 w-4" aria-hidden="true" /> Generate schedule
          </Button>
        )}
      </div>
    </div>
  )
}
