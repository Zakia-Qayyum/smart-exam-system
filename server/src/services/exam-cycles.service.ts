/**
 * Exam Cycle API — Step 22.
 *
 * Full CRUD plus explicit status transitions. Publishing locks the timetable
 * for casual edits (the scheduling service refuses writes on non-draft cycles)
 * and fires bulk notifications to everyone with an entry in the cycle. The
 * explicit "unlock for correction" endpoint moves a published cycle back to
 * draft and is itself audited.
 *
 * The publish path is shared with the legacy /api/cycles/:id/publish route so
 * both URL styles behave identically.
 */
import { prisma } from '../lib/prisma.js'
import { HttpError } from '../lib/http-error.js'
import { dateFromKey, dateKey } from '../lib/schedule-utils.js'

export type CycleStatus = 'draft' | 'published' | 'archived'

const CYCLE_STATUSES: CycleStatus[] = ['draft', 'published', 'archived']

const datePattern = /^\d{4}-\d{2}-\d{2}$/

export interface ExamCycleInput {
  name: string
  term: string
  start_date: string
  end_date: string
}

export interface ApiExamCycle {
  id: string
  name: string
  term: string
  start_date: string
  end_date: string
  status: CycleStatus
  created_at: string
  entries_count: number
  time_slots_count: number
}

export function isCycleStatus(value: unknown): value is CycleStatus {
  return typeof value === 'string' && (CYCLE_STATUSES as string[]).includes(value)
}

/** Pure validation — a cycle's end date must not precede its start date. */
export function assertValidDates(start: string, end: string): void {
  if (!datePattern.test(start) || !datePattern.test(end)) {
    throw new HttpError(422, 'invalid_date', 'start_date and end_date must be YYYY-MM-DD')
  }
  if (start > end) {
    throw new HttpError(422, 'invalid_date_range', 'end_date must not be before start_date')
  }
}

interface CycleRow {
  id: string
  name: string
  term: string
  start_date: Date
  end_date: Date
  status: string
  created_at: Date
  _count?: { schedule_entries: number; time_slots: number }
}

function toApiCycle(c: CycleRow): ApiExamCycle {
  return {
    id: c.id,
    name: c.name,
    term: c.term,
    start_date: dateKey(c.start_date),
    end_date: dateKey(c.end_date),
    status: isCycleStatus(c.status) ? c.status : 'draft',
    created_at: c.created_at.toISOString(),
    entries_count: c._count?.schedule_entries ?? 0,
    time_slots_count: c._count?.time_slots ?? 0,
  }
}

export async function listCycles(query: { status?: string; page?: number; page_size?: number }) {
  const where = query.status && isCycleStatus(query.status) ? { status: query.status } : {}
  const page = Math.max(1, query.page ?? 1)
  const page_size = Math.min(200, Math.max(1, query.page_size ?? 50))

  const [rows, total] = await Promise.all([
    prisma.examCycle.findMany({
      where,
      include: { _count: { select: { schedule_entries: true, time_slots: true } } },
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * page_size,
      take: page_size,
    }),
    prisma.examCycle.count({ where }),
  ])

  const statusCounts = await prisma.examCycle.groupBy({ by: ['status'], _count: true })

  return {
    cycles: rows.map(toApiCycle),
    total,
    page,
    page_size,
    summary: {
      draft: statusCounts.find((s) => s.status === 'draft')?._count ?? 0,
      published: statusCounts.find((s) => s.status === 'published')?._count ?? 0,
      archived: statusCounts.find((s) => s.status === 'archived')?._count ?? 0,
    },
  }
}

async function getCycleOrThrow(id: string) {
  const cycle = await prisma.examCycle.findUnique({ where: { id } })
  if (!cycle) throw new HttpError(404, 'cycle_not_found', 'Exam cycle not found')
  return cycle
}

export async function createCycle(input: ExamCycleInput, performedBy: string): Promise<ApiExamCycle> {
  const name = input.name.trim()
  const term = input.term.trim()
  assertValidDates(input.start_date, input.end_date)
  if (!name) throw new HttpError(422, 'name_required', 'Cycle name is required')
  if (!term) throw new HttpError(422, 'term_required', 'Term is required')

  const created = await prisma.$transaction(async (tx) => {
    const cycle = await tx.examCycle.create({
      data: {
        name,
        term,
        start_date: dateFromKey(input.start_date),
        end_date: dateFromKey(input.end_date),
        status: 'draft',
      },
    })
    await tx.auditLog.create({
      data: {
        action_type: 'exam_cycle.create',
        target_type: 'exam_cycle',
        target_id: cycle.id,
        performed_by: performedBy,
        meta: { name, term, start_date: input.start_date, end_date: input.end_date },
      },
    })
    return cycle
  })

  return toApiCycle({ ...created, _count: { schedule_entries: 0, time_slots: 0 } })
}

export async function updateCycle(id: string, input: Partial<ExamCycleInput>, performedBy: string): Promise<ApiExamCycle> {
  const cycle = await getCycleOrThrow(id)
  if (cycle.status !== 'draft') {
    throw new HttpError(409, 'cycle_not_editable', 'Only draft cycles can be edited — publish locks the cycle, use unlock for corrections')
  }

  const next = {
    name: input.name !== undefined ? input.name.trim() : cycle.name,
    term: input.term !== undefined ? input.term.trim() : cycle.term,
    start_date: input.start_date !== undefined ? input.start_date : dateKey(cycle.start_date),
    end_date: input.end_date !== undefined ? input.end_date : dateKey(cycle.end_date),
  }
  assertValidDates(next.start_date, next.end_date)

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.examCycle.update({
      where: { id },
      data: {
        name: next.name,
        term: next.term,
        start_date: dateFromKey(next.start_date),
        end_date: dateFromKey(next.end_date),
      },
      include: { _count: { select: { schedule_entries: true, time_slots: true } } },
    })
    await tx.auditLog.create({
      data: {
        action_type: 'exam_cycle.update',
        target_type: 'exam_cycle',
        target_id: id,
        performed_by: performedBy,
        meta: { name: next.name, term: next.term, start_date: next.start_date, end_date: next.end_date },
      },
    })
    return row
  })

  return toApiCycle(updated)
}

export async function deleteCycle(id: string, performedBy: string): Promise<{ id: string }> {
  const cycle = await getCycleOrThrow(id)
  if (cycle.status !== 'draft') {
    throw new HttpError(409, 'cycle_not_editable', 'Only draft cycles can be deleted')
  }
  const entriesCount = await prisma.scheduleEntry.count({ where: { exam_cycle_id: id } })
  if (entriesCount > 0) {
    throw new HttpError(409, 'cycle_in_use', 'Delete the schedule entries first before removing this cycle')
  }

  await prisma.$transaction(async (tx) => {
    await tx.examCycle.delete({ where: { id } })
    await tx.auditLog.create({
      data: {
        action_type: 'exam_cycle.delete',
        target_type: 'exam_cycle',
        target_id: id,
        performed_by: performedBy,
        meta: { name: cycle.name },
      },
    })
  })

  return { id }
}

/**
 * Publish a cycle — idempotent (publishing twice is a no-op). The transition
 * marks the cycle published (locking schedule-entry writes), notifies everyone
 * with an entry in the cycle (entry creators + assigned invigilators), and
 * writes an audit row.
 */
export async function publishCycle(id: string, performedBy: string): Promise<ApiExamCycle> {
  const cycle = await getCycleOrThrow(id)
  if (cycle.status === 'archived') {
    throw new HttpError(409, 'cycle_archived', 'Archived cycles cannot be published')
  }
  if (cycle.status === 'published') {
    return toApiCycle({ ...cycle, _count: { schedule_entries: 0, time_slots: 0 } })
  }

  const updated = await prisma.$transaction(async (tx) => {
    const current = await tx.examCycle.update({
      where: { id },
      data: { status: 'published' },
    })

    // Everyone with an entry in this cycle: the coordinators who created the
    // entries plus the invigilators assigned to them.
    const entryUsers = await tx.scheduleEntry.findMany({
      where: { exam_cycle_id: id },
      select: {
        created_by: true,
        invigilator_assignments: { select: { invigilator: { select: { user_id: true } } } },
      },
    })
    const recipientIds = new Set<string>()
    for (const entry of entryUsers) {
      if (entry.created_by) recipientIds.add(entry.created_by)
      for (const a of entry.invigilator_assignments) recipientIds.add(a.invigilator.user_id)
    }
    if (recipientIds.size > 0) {
      await tx.notification.createMany({
        data: [...recipientIds].map((user_id) => ({
          user_id,
          type: 'published',
          title: 'Datesheet published',
          body: `The ${current.name} datesheet is now live. View it on the Datesheet Calendar.`,
          link: '/calendar',
        })),
      })
    }

    await tx.auditLog.create({
      data: {
        action_type: 'cycle.publish',
        target_type: 'exam_cycle',
        target_id: current.id,
        performed_by: performedBy,
        meta: { name: current.name, recipients: recipientIds.size },
      },
    })
    return current
  })

  return toApiCycle({ ...updated, _count: { schedule_entries: 0, time_slots: 0 } })
}

/**
 * Unlock a published cycle for corrections — the explicit counterpart of
 * publish. Moves status back to draft so the scheduling service accepts
 * writes again. Idempotent when already draft; archived cycles are locked
 * forever. Always audited.
 */
export async function unlockCycle(id: string, performedBy: string): Promise<ApiExamCycle> {
  const cycle = await getCycleOrThrow(id)
  if (cycle.status === 'archived') {
    throw new HttpError(409, 'cycle_archived', 'Archived cycles are permanently locked')
  }
  if (cycle.status === 'draft') {
    return toApiCycle({ ...cycle, _count: { schedule_entries: 0, time_slots: 0 } })
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.examCycle.update({
      where: { id },
      data: { status: 'draft' },
    })
    await tx.auditLog.create({
      data: {
        action_type: 'cycle.unlock',
        target_type: 'exam_cycle',
        target_id: id,
        performed_by: performedBy,
        meta: { name: row.name },
      },
    })
    return row
  })

  return toApiCycle({ ...updated, _count: { schedule_entries: 0, time_slots: 0 } })
}
