/**
 * Invigilator Assignment Board — Step 19.
 *
 * Backs the Step 18 drag-and-drop board with real persistence:
 *   - `listUnassignedMatrix` → GET  /api/scheduling/schedule-entries/:examCycleId/unassigned
 *   - `createAssignment`      → POST   /api/invigilator-assignments
 *   - `deleteAssignment`      → DELETE /api/invigilator-assignments/:id
 *   - `proposeAutoAssign`     → POST   /api/invigilator-assignments/auto-assign        (no commit)
 *   - `commitAutoAssign`      → POST   /api/invigilator-assignments/auto-assign/commit
 *
 * Every write is validated server-side even though the board already checks on
 * the client: the same invigilator cannot serve two sessions at the same
 * date+time slot (double-booking), and each invigilator's cycle load cannot
 * exceed `max_assignments_per_cycle`. Writes always append an audit-log row and
 * notify the affected invigilator.
 */
import { prisma } from '../lib/prisma.js'
import { HttpError } from '../lib/http-error.js'
import { dateKey, enumerateDays, resolveExamCycle } from '../lib/schedule-utils.js'

export type AssignmentStatus = 'assigned' | 'confirmed' | 'declined'

export interface ApiAssignment {
  id: string
  schedule_entry_id: string
  invigilator_id: string
  invigilator_name: string
  course_code: string
  course_title: string
  department_id: string
  date: string
  time_slot_id: string
  time_slot_label: string
  room_id: string
  room_name: string
  status: AssignmentStatus
}

export interface CreateAssignmentInput {
  schedule_entry_id: string
  invigilator_id: string
  status?: AssignmentStatus
}

export interface UnassignedMatrixCell {
  date: string
  time_slot_id: string
  time_slot_label: string
  start_time: string
  end_time: string
  room_id: string
  room_name: string
  room_capacity: number
  schedule_entry_id: string | null
  course_code: string | null
  course_title: string | null
  department_id: string | null
  batch: string | null
  semester: string | null
  enrolled_count: number | null
  invigilators_needed: number
  assigned_invigilators: Array<{ id: string; assignment_id: string; name: string; status: AssignmentStatus }>
  needs_assignment: boolean
}

const datePattern = /^\d{4}-\d{2}-\d{2}$/

const timeLabel = (d: Date) => d.toISOString().slice(11, 16)

// ── Validation ─────────────────────────────────────────────────────────────
// A Prisma client or an in-flight transaction both expose the same query API.
// Validation runs inside the write transaction so concurrent assignments cannot
// slip past the double-booking / max-load checks.

type TxLike = Pick<typeof prisma, 'scheduleEntry' | 'invigilator' | 'invigilatorAssignment'>

interface AssignmentContext {
  entry: {
    id: string
    exam_cycle_id: string
    date: Date
    time_slot_id: string
    room_id: string
    time_slot: { label: string }
    room: { name: string }
    section: { course: { course_code: string; title: string; department_id: string } }
  }
  invigilator: { id: string; user_id: string; user: { name: string }; max_assignments_per_cycle: number }
}

type ValidationError =
  | 'entry_not_found'
  | 'invigilator_not_found'
  | 'assignment_exists'
  | 'double_booking'
  | 'max_assignments_exceeded'

type ValidateResult = { ok: true; ctx: AssignmentContext } | { ok: false; error: ValidationError; max?: number }

async function loadAssignmentContext(entryId: string, invigilatorId: string, tx: TxLike): Promise<ValidateResult> {
  const entry = await tx.scheduleEntry.findUnique({
    where: { id: entryId },
    include: {
      time_slot: { select: { label: true } },
      room: { select: { name: true } },
      section: { select: { course: { select: { course_code: true, title: true, department_id: true } } } },
    },
  })
  if (!entry) return { ok: false, error: 'entry_not_found' }

  const invigilator = await tx.invigilator.findUnique({
    where: { id: invigilatorId },
    include: { user: { select: { name: true } } },
  })
  if (!invigilator) return { ok: false, error: 'invigilator_not_found' }

  const existing = await tx.invigilatorAssignment.findUnique({
    where: {
      schedule_entry_id_invigilator_id: { schedule_entry_id: entryId, invigilator_id: invigilatorId },
    },
  })
  if (existing) return { ok: false, error: 'assignment_exists' }

  // A different session on the same date + time slot is a double booking.
  const clash = await tx.invigilatorAssignment.findFirst({
    where: {
      invigilator_id: invigilatorId,
      NOT: { schedule_entry_id: entryId },
      schedule_entry: { exam_cycle_id: entry.exam_cycle_id, date: entry.date, time_slot_id: entry.time_slot_id },
    },
    select: { id: true },
  })
  if (clash) return { ok: false, error: 'double_booking' }

  const cycleLoad = await tx.invigilatorAssignment.count({
    where: {
      invigilator_id: invigilatorId,
      status: { in: ['assigned', 'confirmed'] },
      schedule_entry: { exam_cycle_id: entry.exam_cycle_id },
    },
  })
  if (cycleLoad + 1 > invigilator.max_assignments_per_cycle) {
    return { ok: false, error: 'max_assignments_exceeded', max: invigilator.max_assignments_per_cycle }
  }

  return {
    ok: true,
    ctx: {
      entry: {
        id: entry.id,
        exam_cycle_id: entry.exam_cycle_id,
        date: entry.date,
        time_slot_id: entry.time_slot_id,
        room_id: entry.room_id,
        time_slot: entry.time_slot,
        room: entry.room,
        section: entry.section,
      },
      invigilator: { id: invigilator.id, user_id: invigilator.user_id, user: invigilator.user, max_assignments_per_cycle: invigilator.max_assignments_per_cycle },
    },
  }
}

function validationHttpError(result: Extract<ValidateResult, { ok: false }>): HttpError {
  switch (result.error) {
    case 'entry_not_found':
      return new HttpError(404, 'entry_not_found', 'Schedule entry not found')
    case 'invigilator_not_found':
      return new HttpError(404, 'invigilator_not_found', 'Invigilator not found')
    case 'assignment_exists':
      return new HttpError(409, 'assignment_exists', 'This invigilator is already assigned to this session')
    case 'double_booking':
      return new HttpError(409, 'double_booking', 'Invigilator is already on duty in another session at this date and time')
    case 'max_assignments_exceeded':
      return new HttpError(409, 'max_assignments_exceeded', `Invigilator is at their ${result.max ?? 'unknown'} assignment limit for this cycle`)
  }
}

function assignmentMeta(ctx: AssignmentContext['entry']) {
  return {
    schedule_entry_id: ctx.id,
    course_code: ctx.section.course.course_code,
    course_title: ctx.section.course.title,
    date: dateKey(ctx.date),
    time_slot_label: ctx.time_slot.label,
    room_name: ctx.room.name,
  }
}

const dutyLine = (ctx: AssignmentContext['entry']) =>
  `${ctx.section.course.course_code} · ${dateKey(ctx.date)} · ${ctx.time_slot.label} · ${ctx.room.name}`

async function notifyDuty(tx: Pick<typeof prisma, 'notification'>, userId: string, kind: 'assigned' | 'removed', ctx: AssignmentContext['entry']) {
  await tx.notification.create({
    data: {
      user_id: userId,
      type: 'assignment',
      title: kind === 'assigned' ? 'Invigilation duty assigned' : 'Invigilation duty removed',
      body: kind === 'assigned' ? `You have been assigned to ${dutyLine(ctx)}.` : `You were removed from ${dutyLine(ctx)}.`,
      link: '/my-assignments',
    },
  })
}

function toApiAssignment(a: {
  id: string
  schedule_entry_id: string
  invigilator_id: string
  status: string
  invigilator: { id: string; user: { name: string } }
  schedule_entry: {
    id: string
    exam_cycle_id: string
    date: Date
    time_slot_id: string
    room_id: string
    time_slot: { label: string }
    room: { name: string }
    section: { course: { course_code: string; title: string; department_id: string } }
  }
}): ApiAssignment {
  return {
    id: a.id,
    schedule_entry_id: a.schedule_entry_id,
    invigilator_id: a.invigilator_id,
    invigilator_name: a.invigilator.user.name,
    course_code: a.schedule_entry.section.course.course_code,
    course_title: a.schedule_entry.section.course.title,
    department_id: a.schedule_entry.section.course.department_id,
    date: dateKey(a.schedule_entry.date),
    time_slot_id: a.schedule_entry.time_slot_id,
    time_slot_label: a.schedule_entry.time_slot.label,
    room_id: a.schedule_entry.room_id,
    room_name: a.schedule_entry.room.name,
    status: a.status as AssignmentStatus,
  }
}

// ── Matrix listing ─────────────────────────────────────────────────────────

export async function listUnassignedMatrix(examCycleId: string, date?: string) {
  if (date !== undefined && !datePattern.test(date)) {
    throw new HttpError(400, 'invalid_date', 'date must be YYYY-MM-DD')
  }

  const cycle = await prisma.examCycle.findUnique({ where: { id: examCycleId } })
  if (!cycle) throw new HttpError(404, 'cycle_not_found', 'Exam cycle not found')

  const days = date ? [date] : enumerateDays(cycle.start_date, cycle.end_date)
  const dateSet = new Set(days)

  const [slots, rooms, entries] = await Promise.all([
    prisma.timeSlot.findMany({ where: { exam_cycle_id: cycle.id }, orderBy: { start_time: 'asc' } }),
    prisma.room.findMany({ orderBy: { name: 'asc' } }),
    prisma.scheduleEntry.findMany({
      where: { exam_cycle_id: cycle.id },
      include: {
        time_slot: { select: { label: true } },
        room: { select: { name: true } },
        section: {
          select: {
            batch: true,
            semester: true,
            course: { select: { course_code: true, title: true, department_id: true } },
            _count: { select: { enrollments: true } },
          },
        },
        invigilator_assignments: {
          include: { invigilator: { include: { user: { select: { name: true } } } } },
          orderBy: { invigilator: { user: { name: 'asc' } } },
        },
      },
    }),
  ])

  const entryByCell = new Map<string, (typeof entries)[number]>()
  for (const e of entries) {
    const d = dateKey(e.date)
    if (!dateSet.has(d)) continue
    entryByCell.set(`${d}|${e.time_slot_id}|${e.room_id}`, e)
  }

  const cells: UnassignedMatrixCell[] = []
  for (const day of days) {
    for (const slot of slots) {
      for (const room of rooms) {
        const entry = entryByCell.get(`${day}|${slot.id}|${room.id}`)
        const assigned = (entry?.invigilator_assignments ?? []).map((a) => ({
          id: a.invigilator_id,
          assignment_id: a.id,
          name: a.invigilator.user.name,
          status: a.status as AssignmentStatus,
        }))
        const needs = entry ? 2 : 0
        cells.push({
          date: day,
          time_slot_id: slot.id,
          time_slot_label: slot.label,
          start_time: timeLabel(slot.start_time),
          end_time: timeLabel(slot.end_time),
          room_id: room.id,
          room_name: room.name,
          room_capacity: room.capacity,
          schedule_entry_id: entry?.id ?? null,
          course_code: entry?.section.course.course_code ?? null,
          course_title: entry?.section.course.title ?? null,
          department_id: entry?.section.course.department_id ?? null,
          batch: entry?.section.batch ?? null,
          semester: entry?.section.semester ?? null,
          enrolled_count: entry?.section._count.enrollments ?? null,
          invigilators_needed: needs,
          assigned_invigilators: assigned,
          needs_assignment: needs > assigned.length,
        })
      }
    }
  }

  const withEntries = cells.filter((c) => c.schedule_entry_id).length
  const seatsRemaining = cells.reduce((sum, c) => sum + Math.max(0, c.invigilators_needed - c.assigned_invigilators.length), 0)

  return {
    cycle: {
      id: cycle.id,
      name: cycle.name,
      term: cycle.term,
      start_date: dateKey(cycle.start_date),
      end_date: dateKey(cycle.end_date),
      status: cycle.status,
    },
    days,
    time_slots: slots.map((s) => ({
      id: s.id,
      label: s.label,
      start_time: timeLabel(s.start_time),
      end_time: timeLabel(s.end_time),
    })),
    rooms: rooms.map((r) => ({ id: r.id, name: r.name, capacity: r.capacity })),
    cells,
    summary: {
      sessions: cells.length,
      with_entries: withEntries,
      open_sessions: cells.length - withEntries,
      unassigned_sessions: cells.filter((c) => c.needs_assignment).length,
      assigned: cells.reduce((sum, c) => sum + c.assigned_invigilators.length, 0),
      seats_remaining: seatsRemaining,
    },
  }
}

// ── Single assignment (POST/DELETE) ────────────────────────────────────────

export async function createAssignment(input: CreateAssignmentInput, performedBy: string): Promise<ApiAssignment> {
  const status = input.status ?? 'assigned'
  const { schedule_entry_id, invigilator_id } = input

  const created = await prisma.$transaction(async (tx) => {
    const result = await loadAssignmentContext(schedule_entry_id, invigilator_id, tx)
    if (!result.ok) throw validationHttpError(result)

    let record
    try {
      record = await tx.invigilatorAssignment.create({
        data: { schedule_entry_id, invigilator_id, status },
      })
    } catch (err) {
      // Unique(schedule_entry_id, invigilator_id) raced with a concurrent write.
      if (isUniqueViolation(err)) throw new HttpError(409, 'assignment_exists', 'This invigilator is already assigned to this session')
      throw err
    }

    await notifyDuty(tx, result.ctx.invigilator.user_id, 'assigned', result.ctx.entry)
    await tx.auditLog.create({
      data: {
        action_type: 'invigilator_assignment.create',
        target_type: 'invigilator_assignment',
        target_id: record.id,
        performed_by: performedBy,
        meta: { ...assignmentMeta(result.ctx.entry), invigilator_id, status },
      },
    })
    return record
  })

  const row = await prisma.invigilatorAssignment.findUnique({
    where: { id: created.id },
    include: {
      invigilator: { include: { user: { select: { name: true } } } },
      schedule_entry: {
        include: {
          time_slot: { select: { label: true } },
          room: { select: { name: true } },
          section: { select: { course: { select: { course_code: true, title: true, department_id: true } } } },
        },
      },
    },
  })
  if (!row) throw new HttpError(500, 'create_failed', 'Assignment could not be loaded')
  return toApiAssignment(row)
}

export async function deleteAssignment(id: string, performedBy: string): Promise<ApiAssignment> {
  const row = await prisma.invigilatorAssignment.findUnique({
    where: { id },
    include: {
      invigilator: { include: { user: { select: { name: true } } } },
      schedule_entry: {
        include: {
          time_slot: { select: { label: true } },
          room: { select: { name: true } },
          section: { select: { course: { select: { course_code: true, title: true, department_id: true } } } },
        },
      },
    },
  })
  if (!row) throw new HttpError(404, 'assignment_not_found', 'Invigilator assignment not found')

  await prisma.$transaction(async (tx) => {
    await tx.invigilatorAssignment.delete({ where: { id } })
    await notifyDuty(tx, row.invigilator.user_id, 'removed', {
      id: row.schedule_entry.id,
      exam_cycle_id: row.schedule_entry.exam_cycle_id,
      date: row.schedule_entry.date,
      time_slot_id: row.schedule_entry.time_slot_id,
      room_id: row.schedule_entry.room_id,
      time_slot: row.schedule_entry.time_slot,
      room: row.schedule_entry.room,
      section: row.schedule_entry.section,
    })
    await tx.auditLog.create({
      data: {
        action_type: 'invigilator_assignment.delete',
        target_type: 'invigilator_assignment',
        target_id: id,
        performed_by: performedBy,
        meta: { ...assignmentMeta(row.schedule_entry), invigilator_id: row.invigilator_id, invigilator_name: row.invigilator.user.name },
      },
    })
  })

  return toApiAssignment(row)
}

// ── Auto-assign proposal + commit ──────────────────────────────────────────

export interface AutoAssignCandidate {
  id: string
  name: string
  department_id: string
  specialization_tags: string[]
  max_assignments_per_cycle: number
  user_status: string
  current_load: number
  busy_slots: Array<{ date: string; time_slot_id: string }>
}

export interface AutoAssignTarget {
  key: string
  schedule_entry_id: string | null
  department_id: string | null
  date: string
  time_slot_id: string
  needs: number
}

export interface AutoAssignSelection {
  target_key: string
  schedule_entry_id: string | null
  date: string
  invigilator_id: string
  invigilator_name: string
  reason: string
}

/**
 * Pure matching engine (unit-tested in test/invigilator-assignments.test.ts).
 *
 * For each target in order, fills `needs` seats with the best available
 * invigilator: an active user who is not already on duty at the same
 * date+time slot, is not at their cycle max, and was not picked for this
 * target already. Candidates are ranked by specialization-tag overlap with the
 * target department's tag pool first (highest match wins), then by current
 * cycle load ascending (round-robin so the busiest faculty are never stacked),
 * then by name for a deterministic tie-break.
 */
export function pickAutoAssignments(
  targets: AutoAssignTarget[],
  invigilators: AutoAssignCandidate[],
  deptTagPool: Record<string, Set<string>>,
  limit = 50,
): AutoAssignSelection[] {
  const busyByInv = new Map<string, Set<string>>()
  for (const inv of invigilators) {
    busyByInv.set(inv.id, new Set(inv.busy_slots.map((s) => `${s.date}|${s.time_slot_id}`)))
  }

  const selections: AutoAssignSelection[] = []
  const pickedForTarget = new Map<string, Set<string>>()
  const runLoad = new Map<string, number>(invigilators.map((i) => [i.id, i.current_load]))

  for (const target of targets) {
    if (selections.length >= limit) break
    const picked = pickedForTarget.get(target.key) ?? new Set<string>()
    const targetSlot = `${target.date}|${target.time_slot_id}`

    for (let seat = 0; seat < target.needs; seat++) {
      if (selections.length >= limit) break
      const pool = invigilators.filter((inv) => {
        if (inv.user_status !== 'active') return false
        if (picked.has(inv.id)) return false
        if (busyByInv.get(inv.id)?.has(targetSlot)) return false
        if ((runLoad.get(inv.id) ?? 0) >= inv.max_assignments_per_cycle) return false
        return true
      })

      const deptPool = target.department_id ? deptTagPool[target.department_id] : undefined
      const score = (inv: AutoAssignCandidate) =>
        deptPool ? inv.specialization_tags.filter((t) => deptPool.has(t)).length : 0

      pool.sort((a, b) => {
        const sa = score(a)
        const sb = score(b)
        if (sb !== sa) return sb - sa
        const la = runLoad.get(a.id) ?? 0
        const lb = runLoad.get(b.id) ?? 0
        if (la !== lb) return la - lb
        return a.name.localeCompare(b.name)
      })

      const best = pool[0]
      if (!best) break
      const match = score(best)
      picked.add(best.id)
      pickedForTarget.set(target.key, picked)
      runLoad.set(best.id, (runLoad.get(best.id) ?? 0) + 1)
      selections.push({
        target_key: target.key,
        schedule_entry_id: target.schedule_entry_id,
        date: target.date,
        invigilator_id: best.id,
        invigilator_name: best.name,
        reason:
          match > 0
            ? `Specialization match · ${match} tag(s) · load ${best.current_load}/${best.max_assignments_per_cycle}`
            : `Round-robin · load ${best.current_load}/${best.max_assignments_per_cycle}`,
      })
    }
  }

  return selections
}

export interface AutoAssignPlan {
  exam_cycle_id: string
  proposals: Array<{
    id: string
    schedule_entry_id: string
    invigilator_id: string
    invigilator_name: string
    course_code: string
    course_title: string
    department_id: string
    date: string
    time_slot_id: string
    time_slot_label: string
    room_id: string
    room_name: string
    reason: string
  }>
  summary: { proposed: number; sessions_filled: number; seats_remaining: number; skipped: number }
}

export async function proposeAutoAssign(examCycleId?: string, date?: string): Promise<AutoAssignPlan> {
  if (date !== undefined && !datePattern.test(date)) {
    throw new HttpError(400, 'invalid_date', 'date must be YYYY-MM-DD')
  }
  const cycle = await resolveExamCycle(examCycleId)
  const targetDays = date ? [date] : enumerateDays(cycle.start_date, cycle.end_date)

  const [slots, rooms, entries, invigilators] = await Promise.all([
    prisma.timeSlot.findMany({ where: { exam_cycle_id: cycle.id }, orderBy: { start_time: 'asc' } }),
    prisma.room.findMany({ orderBy: { name: 'asc' } }),
    prisma.scheduleEntry.findMany({
      where: { exam_cycle_id: cycle.id },
      include: {
        time_slot: { select: { label: true, start_time: true } },
        room: { select: { name: true } },
        section: { select: { course: { select: { course_code: true, title: true, department_id: true } } } },
        invigilator_assignments: { select: { invigilator_id: true, status: true } },
      },
    }),
    prisma.invigilator.findMany({
      include: {
        user: { select: { name: true, status: true } },
        assignments: {
          where: { schedule_entry: { exam_cycle_id: cycle.id } },
          select: { status: true, schedule_entry: { select: { date: true, time_slot_id: true } } },
        },
      },
    }),
  ])

  const deptTagPool: Record<string, Set<string>> = {}
  const candidates: AutoAssignCandidate[] = invigilators.map((inv) => {
    deptTagPool[inv.department_id] = deptTagPool[inv.department_id] ?? new Set<string>()
    for (const tag of inv.specialization_tags) deptTagPool[inv.department_id].add(tag)
    return {
      id: inv.id,
      name: inv.user.name,
      department_id: inv.department_id,
      specialization_tags: inv.specialization_tags,
      max_assignments_per_cycle: inv.max_assignments_per_cycle,
      user_status: inv.user.status,
      current_load: inv.assignments.filter((a) => a.status === 'assigned' || a.status === 'confirmed').length,
      busy_slots: inv.assignments
        .filter((a) => a.status === 'assigned' || a.status === 'confirmed')
        .map((a) => ({ date: dateKey(a.schedule_entry.date), time_slot_id: a.schedule_entry.time_slot_id })),
    }
  })

  const assignedByEntry = new Map<string, number>()
  for (const e of entries) {
    assignedByEntry.set(e.id, e.invigilator_assignments.filter((a) => a.status === 'assigned' || a.status === 'confirmed').length)
  }

  // Real exam sessions first (they have a course and a target of two), then
  // only entries on the requested day(s). Sessions already fully staffed are
  // skipped entirely.
  const targets: AutoAssignTarget[] = []
  for (const e of entries) {
    const d = dateKey(e.date)
    if (!targetDays.includes(d)) continue
    const needs = 2 - (assignedByEntry.get(e.id) ?? 0)
    if (needs <= 0) continue
    targets.push({
      key: `entry:${e.id}`,
      schedule_entry_id: e.id,
      department_id: e.section.course.department_id,
      date: d,
      time_slot_id: e.time_slot_id,
      needs,
    })
  }
  targets.sort((a, b) => {
    const ea = entries.find((e) => e.id === a.schedule_entry_id)
    const eb = entries.find((e) => e.id === b.schedule_entry_id)
    return (ea?.time_slot.start_time.getTime() ?? 0) - (eb?.time_slot.start_time.getTime() ?? 0) || a.date.localeCompare(b.date)
  })

  const selections = pickAutoAssignments(targets, candidates, deptTagPool, 50)

  const proposalById = new Map<string, (typeof entries)[number]>()
  for (const e of entries) proposalById.set(e.id, e)
  const proposalBySlot = new Map(slots.map((s) => [s.id, s]))
  const proposalByRoom = new Map(rooms.map((r) => [r.id, r]))

  const proposals = selections.map((sel, index) => {
    const entry = proposalById.get(sel.schedule_entry_id ?? '')
    const slot = proposalBySlot.get(entry?.time_slot_id ?? '')
    const room = proposalByRoom.get(entry?.room_id ?? '')
    return {
      id: `prop-${index + 1}`,
      schedule_entry_id: entry?.id ?? '',
      invigilator_id: sel.invigilator_id,
      invigilator_name: sel.invigilator_name,
      course_code: entry?.section.course.course_code ?? '',
      course_title: entry?.section.course.title ?? '',
      department_id: entry?.section.course.department_id ?? '',
      date: sel.date,
      time_slot_id: entry?.time_slot_id ?? '',
      time_slot_label: slot?.label ?? '',
      room_id: entry?.room_id ?? '',
      room_name: room?.name ?? '',
      reason: sel.reason,
    }
  })

  const seatsRemaining = targets.reduce((sum, t) => sum + t.needs, 0) - selections.length
  const sessionsFilled = new Set(selections.map((s) => s.schedule_entry_id)).size

  return {
    exam_cycle_id: cycle.id,
    proposals,
    summary: { proposed: proposals.length, sessions_filled: sessionsFilled, seats_remaining: Math.max(0, seatsRemaining), skipped: 0 },
  }
}

export interface CommitResult {
  committed: number
  skipped: number
  assignments: ApiAssignment[]
  skipped_reasons: Array<{ schedule_entry_id: string; invigilator_id: string; reason: string }>
}

/**
 * Persist an auto-assign proposal list. Each item is re-validated server-side;
 * items that fail (entry deleted, double-booking, cycle max reached) are
 * skipped and reported rather than aborting the batch.
 */
export async function commitAutoAssign(items: Array<{ schedule_entry_id: string; invigilator_id: string }>, performedBy: string): Promise<CommitResult> {
  const createdIds: string[] = []
  const skipped_reasons: CommitResult['skipped_reasons'] = []

  await prisma.$transaction(async (tx) => {
    for (const item of items) {
      const result = await loadAssignmentContext(item.schedule_entry_id, item.invigilator_id, tx)
      if (!result.ok) {
        skipped_reasons.push({
          schedule_entry_id: item.schedule_entry_id,
          invigilator_id: item.invigilator_id,
          reason: validationHttpError(result).code,
        })
        continue
      }
      try {
        const record = await tx.invigilatorAssignment.create({
          data: { schedule_entry_id: item.schedule_entry_id, invigilator_id: item.invigilator_id, status: 'assigned' },
        })
        await notifyDuty(tx, result.ctx.invigilator.user_id, 'assigned', result.ctx.entry)
        await tx.auditLog.create({
          data: {
            action_type: 'invigilator_assignment.auto_commit',
            target_type: 'invigilator_assignment',
            target_id: record.id,
            performed_by: performedBy,
            meta: { ...assignmentMeta(result.ctx.entry), invigilator_id: item.invigilator_id },
          },
        })
        createdIds.push(record.id)
      } catch (err) {
        if (isUniqueViolation(err)) {
          skipped_reasons.push({
            schedule_entry_id: item.schedule_entry_id,
            invigilator_id: item.invigilator_id,
            reason: 'assignment_exists',
          })
          continue
        }
        throw err
      }
    }
  })

  const rows = await prisma.invigilatorAssignment.findMany({
    where: { id: { in: createdIds } },
    include: {
      invigilator: { include: { user: { select: { name: true } } } },
      schedule_entry: {
        include: {
          time_slot: { select: { label: true } },
          room: { select: { name: true } },
          section: { select: { course: { select: { course_code: true, title: true, department_id: true } } } },
        },
      },
    },
  })

  return { committed: rows.length, skipped: skipped_reasons.length, assignments: rows.map(toApiAssignment), skipped_reasons }
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002'
}
