/**
 * Scheduling service — validation, clash-blocking save, listing, calendar
 * summary and the async draft generator. DB-backed; the pure algorithms live
 * in lib/clash-detection.ts and schedule-engine.service.ts and are unit tested
 * in isolation, while clash detection persistence is delegated to the
 * DB-backed clash-detection.service.ts (see scanFullCycle).
 */
import { prisma } from '../lib/prisma.js'
import { logger } from '../lib/logger.js'
import { HttpError } from '../lib/http-error.js'
import { dateFromKey, dateKey, enumerateDays, resolveExamCycle } from '../lib/schedule-utils.js'
import type { ClashHit } from '../lib/clash-detection.js'
import { clashService } from './clash-detection.service.js'
import { notificationsWriteService, type NotificationClient } from './notifications.service.js'
import { buildDraftSchedule, type DraftAssignment, type DraftRoom, type DraftSectionInput, type DraftTimeSlot } from './schedule-engine.service.js'

export interface EntryInput {
  exam_cycle_id?: string
  section_id: string
  /** ISO date key, e.g. '2026-08-10' */
  date: string
  time_slot_id: string
  room_id: string
  /**
   * Optional invigilator to assign to this entry. An empty string clears the
   * assignment; `undefined` leaves any existing assignment untouched (used by
   * flows that save entries without touching invigilation).
   */
  invigilator_id?: string
}

export interface SaveOptions {
  createdBy: string
  existingId?: string
  force?: boolean
  override_reason?: string
}

export interface ApiScheduleEntry {
  id: string
  exam_cycle_id: string
  section_id: string
  course_code: string
  course_title: string
  department_id: string
  department_code: string
  department_name: string
  batch: string
  semester: string
  date: string
  time_slot_id: string
  time_slot_label: string
  room_id: string
  room_name: string
  room_capacity: number
  enrolled_count: number
  status: 'scheduled' | 'needs_review'
  invigilators: Array<{ id: string; name: string; assignment_id: string; status: string }>
  created_by: string
  created_at: string
}

export interface ScheduleSaveResult {
  entry: ApiScheduleEntry
  clashes: ClashHit[]
  dayLoadWarnings: ClashHit[]
  overridden: boolean
}

export interface ListQuery {
  exam_cycle_id?: string
  department_id?: string
  course_code?: string
  status?: 'scheduled' | 'needs_review'
  from?: string
  to?: string
  page?: number
  page_size?: number
}

export interface ListResult {
  entries: ApiScheduleEntry[]
  total: number
  page: number
  page_size: number
  summary: { total: number; scheduled: number; needs_review: number; same_slot: number; same_day: number }
}

export interface CalendarSummary {
  cycle: { id: string; name: string; term: string; start_date: string; end_date: string; status: string }
  days: Array<{
    date: string
    exams: number
    rooms_used: number
    needs_review: number
    same_slot: number
    same_day: number
    has_clashes: boolean
  }>
  summary: {
    total_exams: number
    scheduled: number
    needs_review: number
    same_slot: number
    same_day: number
    rooms_used: number
  }
}

export interface GenerateJob {
  id: string
  status: 'running' | 'completed' | 'failed'
  createdAt: string
  completedAt?: string
  result?: GenerateResult
  error?: string
}

export interface GenerateResult {
  cycle_id: string
  scheduled: number
  needs_review: number
  same_slot: number
  same_day: number
  entries: ApiScheduleEntry[]
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function toApiEntry(row: {
  id: string
  exam_cycle_id: string
  section_id: string
  date: Date
  time_slot_id: string
  room_id: string
  status: string
  created_by: string
  created_at: Date
  section: { batch: string; semester: string; course: { course_code: string; title: string; department: { id: string; code: string; name: string } } }
  time_slot: { id: string; label: string }
  room: { id: string; name: string; capacity: number }
  invigilator_assignments: Array<{
    id: string
    status: string
    invigilator: { id: string; user: { name: string } }
  }>
}): Promise<ApiScheduleEntry> {
  const enrolled_count = await prisma.enrollment.count({ where: { section_id: row.section_id } })
  return {
    id: row.id,
    exam_cycle_id: row.exam_cycle_id,
    section_id: row.section_id,
    course_code: row.section.course.course_code,
    course_title: row.section.course.title,
    department_id: row.section.course.department.id,
    department_code: row.section.course.department.code,
    department_name: row.section.course.department.name,
    batch: row.section.batch,
    semester: row.section.semester,
    date: dateKey(row.date),
    time_slot_id: row.time_slot.id,
    time_slot_label: row.time_slot.label,
    room_id: row.room.id,
    room_name: row.room.name,
    room_capacity: row.room.capacity,
    enrolled_count,
    status: row.status === 'needs_review' ? 'needs_review' : 'scheduled',
    invigilators: row.invigilator_assignments.map((a) => ({
      id: a.invigilator.id,
      name: a.invigilator.user.name,
      assignment_id: a.id,
      status: a.status,
    })),
    created_by: row.created_by,
    created_at: row.created_at.toISOString(),
  }
}

/** Publishing a cycle locks casual editing — all writes are refused on non-draft cycles. */
function assertEditable(cycle: { status: string }) {
  if (cycle.status !== 'draft') {
    throw new HttpError(
      409,
      'cycle_not_editable',
      'This cycle is already published — editing the timetable is locked',
    )
  }
}

async function validateEntry(input: EntryInput, existingId?: string) {
  const cycle = await resolveExamCycle(input.exam_cycle_id)
  assertEditable(cycle)

  const startKey = dateKey(cycle.start_date)
  const endKey = dateKey(cycle.end_date)
  if (input.date < startKey || input.date > endKey) {
    throw new HttpError(422, 'date_out_of_window', `Exam date must fall within ${startKey} to ${endKey}`)
  }

  const section = await prisma.section.findUnique({ where: { id: input.section_id } })
  if (!section) throw new HttpError(404, 'section_not_found', 'Section not found')

  const room = await prisma.room.findUnique({ where: { id: input.room_id } })
  if (!room) throw new HttpError(404, 'room_not_found', 'Room not found')

  const slot = await prisma.timeSlot.findUnique({ where: { id: input.time_slot_id } })
  if (!slot || slot.exam_cycle_id !== cycle.id) {
    throw new HttpError(422, 'time_slot_invalid', 'Time slot does not belong to the selected exam cycle')
  }

  const enrolled_count = await prisma.enrollment.count({ where: { section_id: input.section_id } })
  if (room.capacity < enrolled_count) {
    throw new HttpError(422, 'room_capacity', `Room capacity (${room.capacity}) is less than enrolled students (${enrolled_count})`, {
      capacity: room.capacity,
      enrolled_count,
    })
  }

  const invigilatorId = input.invigilator_id?.trim() ?? ''
  if (invigilatorId) {
    const invigilator = await prisma.invigilator.findUnique({ where: { id: invigilatorId } })
    if (!invigilator) {
      throw new HttpError(404, 'invigilator_not_found', 'Invigilator not found in the directory')
    }
  }

  const sectionWhere = { exam_cycle_id: cycle.id, section_id: input.section_id }
  const duplicate = existingId
    ? await prisma.scheduleEntry.findFirst({ where: { ...sectionWhere, id: { not: existingId } } })
    : await prisma.scheduleEntry.findFirst({ where: sectionWhere })
  if (duplicate) {
    throw new HttpError(409, 'section_already_scheduled', 'This section already has an exam in the selected cycle')
  }

  return { cycle, room, enrolled_count, invigilatorId }
}

// ── Create / update / delete ───────────────────────────────────────────────

async function notifyCreatedClashes(tx: NotificationClient, cycleName: string, departmentId: string | undefined, count: number) {
  const notice = {
    type: 'clash' as const,
    title: 'New clashes detected',
    body: `${count} new clash${count === 1 ? '' : 'es'} found in ${cycleName}. Review and resolve them.`,
    link: '/clashes',
  }
  await notificationsWriteService.notifyRole('coordinator', notice, { client: tx })
  if (departmentId) {
    await notificationsWriteService.notifyRole('dept-coordinator', notice, { departmentScope: departmentId, client: tx })
  }
}

async function saveEntry(input: EntryInput, options: SaveOptions): Promise<ScheduleSaveResult> {
  const { cycle, room, invigilatorId } = await validateEntry(input, options.existingId)
  assertEditable(cycle)
  const invigilatorProvided = typeof input.invigilator_id === 'string'

  // Department whose dept-coordinator should be looped in when this save
  // produces fresh (non-forced) clash rows.
  const sectionWithCourse = await prisma.section.findUnique({
    where: { id: input.section_id },
    include: { course: { select: { department_id: true } } },
  })
  const clashDepartmentId = sectionWithCourse?.course.department_id

  if (options.existingId) {
    const existing = await prisma.scheduleEntry.findUnique({ where: { id: options.existingId } })
    if (!existing) throw new HttpError(404, 'entry_not_found', 'Schedule entry not found')
  }

  const result = await clashService.detectCandidateClashes({
    cycleId: cycle.id,
    sectionId: input.section_id,
    date: input.date,
    timeSlotId: input.time_slot_id,
    existingId: options.existingId,
  })
  const force = options.force === true && result.clashes.length > 0
  if (force && !options.override_reason) {
    throw new HttpError(422, 'override_reason_required', 'override_reason is required to force-save a clashing entry')
  }
  if (!force && result.clashes.length > 0) {
    throw new HttpError(409, 'clash_blocked', 'Conflicting exams detected for enrolled students', {
      clashes: result.clashes,
      dayLoadWarnings: result.dayLoadWarnings,
    })
  }

  const date = dateFromKey(input.date)
  const baseData = {
    exam_cycle_id: cycle.id,
    section_id: input.section_id,
    date,
    time_slot_id: input.time_slot_id,
    room_id: input.room_id,
    status: 'scheduled' as const,
  }

  const makeClashRows = (entryId: string) => [
    ...result.clashes.map((hit) => ({
      type: 'same_slot' as const,
      exam_cycle_id: cycle.id,
      student_id: hit.student.id,
      schedule_entry_ids: [entryId, hit.conflictEntryId],
      severity: 'high' as const,
      status: force ? ('overridden' as const) : ('open' as const),
      override_reason: force ? options.override_reason : null,
    })),
    ...result.dayLoadWarnings.map((hit) => ({
      type: 'same_day' as const,
      exam_cycle_id: cycle.id,
      student_id: hit.student.id,
      schedule_entry_ids: [entryId, hit.conflictEntryId],
      severity: 'medium' as const,
      status: 'open' as const,
      override_reason: null,
    })),
  ]

  let entryId = ''
  if (options.existingId) {
    entryId = options.existingId
    await prisma.$transaction(async (tx) => {
      await tx.clashRecord.deleteMany({ where: { schedule_entry_ids: { has: entryId } } })
      await tx.scheduleEntry.update({ where: { id: entryId }, data: baseData })
      if (invigilatorProvided) {
        await tx.invigilatorAssignment.deleteMany({ where: { schedule_entry_id: entryId } })
        if (invigilatorId) {
          await tx.invigilatorAssignment.create({
            data: { schedule_entry_id: entryId, invigilator_id: invigilatorId },
          })
        }
      }
      const clashRows = makeClashRows(entryId)
      if (clashRows.length) await tx.clashRecord.createMany({ data: clashRows })
      if (!force && clashRows.length) {
        await notifyCreatedClashes(tx, cycle.name, clashDepartmentId, clashRows.length)
      }
      if (force) {
        await tx.overrideRequest.create({
          data: {
            raised_by: options.createdBy,
            approved_by: options.createdBy,
            target_type: 'schedule_entry',
            target_id: entryId,
            reason: options.override_reason!,
            status: 'approved',
            decided_at: new Date(),
          },
        })
      }
      await tx.auditLog.create({
        data: {
          action_type: force ? 'schedule_entry.override' : 'schedule_entry.update',
          target_type: 'schedule_entry',
          target_id: entryId,
          performed_by: options.createdBy,
          meta: { clashes: result.clashes.length, day_warnings: result.dayLoadWarnings.length, room: room.name, invigilator_id: invigilatorId || null },
        },
      })
    })
  } else {
    await prisma.$transaction(async (tx) => {
      const created = await tx.scheduleEntry.create({ data: { ...baseData, created_by: options.createdBy } })
      entryId = created.id
      if (invigilatorId) {
        await tx.invigilatorAssignment.create({
          data: { schedule_entry_id: entryId, invigilator_id: invigilatorId },
        })
      }
      const clashRows = makeClashRows(entryId)
      if (clashRows.length) await tx.clashRecord.createMany({ data: clashRows })
      if (!force && clashRows.length) {
        await notifyCreatedClashes(tx, cycle.name, clashDepartmentId, clashRows.length)
      }
      if (force) {
        await tx.overrideRequest.create({
          data: {
            raised_by: options.createdBy,
            approved_by: options.createdBy,
            target_type: 'schedule_entry',
            target_id: entryId,
            reason: options.override_reason!,
            status: 'approved',
            decided_at: new Date(),
          },
        })
      }
      await tx.auditLog.create({
        data: {
          action_type: force ? 'schedule_entry.override' : 'schedule_entry.create',
          target_type: 'schedule_entry',
          target_id: entryId,
          performed_by: options.createdBy,
          meta: { clashes: result.clashes.length, day_warnings: result.dayLoadWarnings.length, room: room.name, invigilator_id: invigilatorId || null },
        },
      })
    })
  }

  const row = await prisma.scheduleEntry.findUnique({
    where: { id: entryId },
    include: {
      section: { include: { course: { include: { department: true } } } },
      time_slot: true,
      room: true,
      invigilator_assignments: { include: { invigilator: { include: { user: { select: { name: true } } } } } },
    },
  })
  if (!row) throw new HttpError(500, 'entry_not_saved', 'Saved entry could not be loaded')

  return {
    entry: await toApiEntry(row),
    clashes: force ? result.clashes : [],
    dayLoadWarnings: result.dayLoadWarnings,
    overridden: force,
  }
}

async function deleteEntry(id: string, createdBy: string): Promise<void> {
  const entry = await prisma.scheduleEntry.findUnique({ where: { id } })
  if (!entry) throw new HttpError(404, 'entry_not_found', 'Schedule entry not found')
  const cycle = await prisma.examCycle.findUnique({ where: { id: entry.exam_cycle_id } })
  if (cycle) assertEditable(cycle)

  await prisma.$transaction(async (tx) => {
    await tx.clashRecord.deleteMany({ where: { schedule_entry_ids: { has: id } } })
    await tx.scheduleEntry.delete({ where: { id } })
    await tx.auditLog.create({
      data: {
        action_type: 'schedule_entry.delete',
        target_type: 'schedule_entry',
        target_id: id,
        performed_by: createdBy,
        meta: { section_id: entry.section_id, date: dateKey(entry.date) },
      },
    })
  })
}

// ── Listing & calendar summary ─────────────────────────────────────────────

async function listEntries(query: ListQuery): Promise<ListResult> {
  const cycle = await resolveExamCycle(query.exam_cycle_id)

  const courseFilter: { department_id?: string; course_code?: string } = {}
  if (query.department_id) courseFilter.department_id = query.department_id
  if (query.course_code) courseFilter.course_code = query.course_code

  const where = {
    exam_cycle_id: cycle.id,
    ...(Object.keys(courseFilter).length > 0 ? { section: { course: courseFilter } } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.from || query.to
      ? {
          date: {
            ...(query.from ? { gte: dateFromKey(query.from) } : {}),
            ...(query.to ? { lte: dateFromKey(query.to) } : {}),
          },
        }
      : {}),
  }

  const page = Math.max(1, query.page ?? 1)
  const page_size = Math.min(200, Math.max(1, query.page_size ?? 50))

  const [rows, total] = await Promise.all([
    prisma.scheduleEntry.findMany({
      where,
      include: {
        section: { include: { course: { include: { department: true } } } },
        time_slot: true,
        room: true,
        invigilator_assignments: { include: { invigilator: { include: { user: { select: { name: true } } } } } },
      },
      orderBy: [{ date: 'asc' }, { time_slot: { start_time: 'asc' } }],
      skip: (page - 1) * page_size,
      take: page_size,
    }),
    prisma.scheduleEntry.count({ where }),
  ])

  const entries = await Promise.all(rows.map((row) => toApiEntry(row)))

  const statusCounts = await prisma.scheduleEntry.groupBy({
    by: ['status'],
    where,
    _count: true,
  })
  const scheduled = statusCounts.find((s) => s.status === 'scheduled')?._count ?? 0
  const needs_review = statusCounts.find((s) => s.status === 'needs_review')?._count ?? 0

  const clashCounts = await prisma.clashRecord.groupBy({
    by: ['type'],
    where: { exam_cycle_id: cycle.id, status: 'open' },
    _count: true,
  })
  const same_slot = clashCounts.find((c) => c.type === 'same_slot')?._count ?? 0
  const same_day = clashCounts.find((c) => c.type === 'same_day')?._count ?? 0

  return {
    entries,
    total,
    page,
    page_size,
    summary: { total, scheduled, needs_review, same_slot, same_day },
  }
}

async function calendarSummary(examCycleId?: string): Promise<CalendarSummary> {
  const cycle = await resolveExamCycle(examCycleId)

  const [entries, clashes] = await Promise.all([
    prisma.scheduleEntry.findMany({ where: { exam_cycle_id: cycle.id } }),
    prisma.clashRecord.findMany({ where: { exam_cycle_id: cycle.id, status: 'open' } }),
  ])

  const days = enumerateDays(cycle.start_date, cycle.end_date).map((date) => ({
    date,
    exams: 0,
    rooms_used: 0,
    needs_review: 0,
    same_slot: 0,
    same_day: 0,
    has_clashes: false,
  }))
  const byDate = new Map(days.map((d) => [d.date, d]))

  const roomsByDate = new Map<string, Set<string>>()
  for (const entry of entries) {
    const key = dateKey(entry.date)
    const day = byDate.get(key)
    if (!day) continue
    day.exams += 1
    if (entry.status === 'needs_review') day.needs_review += 1
    const rooms = roomsByDate.get(key) ?? new Set<string>()
    rooms.add(entry.room_id)
    roomsByDate.set(key, rooms)
  }
  for (const [key, rooms] of roomsByDate) {
    const day = byDate.get(key)
    if (day) day.rooms_used = rooms.size
  }

  const entryDateById = new Map(entries.map((e) => [e.id, dateKey(e.date)]))
  for (const clash of clashes) {
    const affectedDates = new Set<string>()
    for (const entryId of clash.schedule_entry_ids) {
      const key = entryDateById.get(entryId)
      if (key) affectedDates.add(key)
    }
    for (const key of affectedDates) {
      const day = byDate.get(key)
      if (!day) continue
      if (clash.type === 'same_slot') day.same_slot += 1
      else day.same_day += 1
      day.has_clashes = true
    }
  }

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
    summary: {
      total_exams: entries.length,
      scheduled: entries.filter((e) => e.status === 'scheduled').length,
      needs_review: entries.filter((e) => e.status === 'needs_review').length,
      same_slot: clashes.filter((c) => c.type === 'same_slot').length,
      same_day: clashes.filter((c) => c.type === 'same_day').length,
      rooms_used: new Set(entries.map((e) => e.room_id)).size,
    },
  }
}

// ── Async draft generator ──────────────────────────────────────────────────

async function generateSchedule(options: { examCycleId?: string; createdBy: string }): Promise<GenerateResult> {
  const cycle = await resolveExamCycle(options.examCycleId)
  assertEditable(cycle)
  const days = enumerateDays(cycle.start_date, cycle.end_date)

  const [timeSlots, rooms, sections, enrollments] = await Promise.all([
    prisma.timeSlot.findMany({ where: { exam_cycle_id: cycle.id }, orderBy: { start_time: 'asc' } }),
    prisma.room.findMany({ orderBy: { capacity: 'asc' } }),
    prisma.section.findMany({ include: { course: true } }),
    prisma.enrollment.findMany({ select: { student_id: true, section_id: true } }),
  ])

  const studentsBySection = new Map<string, string[]>()
  for (const en of enrollments) {
    const list = studentsBySection.get(en.section_id) ?? []
    list.push(en.student_id)
    studentsBySection.set(en.section_id, list)
  }

  const draftSections: DraftSectionInput[] = sections.map((s) => ({
    sectionId: s.id,
    courseCode: s.course.course_code,
    enrolledCount: (studentsBySection.get(s.id) ?? []).length,
    studentIds: studentsBySection.get(s.id) ?? [],
  }))
  const draftSlots: DraftTimeSlot[] = timeSlots.map((s) => ({ id: s.id, label: s.label }))
  const draftRooms: DraftRoom[] = rooms.map((r) => ({ id: r.id, name: r.name, capacity: r.capacity }))

  const assignments: DraftAssignment[] = buildDraftSchedule({ days, timeSlots: draftSlots, rooms: draftRooms, sections: draftSections })

  await prisma.$transaction(async (tx) => {
    await tx.scheduleEntry.deleteMany({ where: { exam_cycle_id: cycle.id } })
    await tx.clashRecord.deleteMany({ where: { exam_cycle_id: cycle.id } })
    await tx.scheduleEntry.createMany({
      data: assignments.map((a) => ({
        exam_cycle_id: cycle.id,
        section_id: a.sectionId,
        date: dateFromKey(a.date),
        time_slot_id: a.timeSlotId,
        room_id: a.roomId,
        status: a.status,
        created_by: options.createdBy,
      })),
    })
    await tx.auditLog.create({
      data: {
        action_type: 'schedule.generate',
        target_type: 'exam_cycle',
        target_id: cycle.id,
        performed_by: options.createdBy,
        meta: { entries_created: assignments.length },
      },
    })
  })

  const scan = await clashService.scanFullCycle(cycle.id)

  const list = await listEntries({ exam_cycle_id: cycle.id, page_size: 200 })
  return {
    cycle_id: cycle.id,
    scheduled: list.summary.scheduled,
    needs_review: list.summary.needs_review,
    same_slot: scan.same_slot,
    same_day: scan.same_day,
    entries: list.entries,
  }
}

// ── In-memory job store (pollable generator) ───────────────────────────────

const generateJobs = new Map<string, GenerateJob>()
let jobCounter = 0

async function startGenerate(options: { examCycleId?: string; createdBy: string }): Promise<GenerateJob> {
  // Resolve + enforce the publish-lock here so a published datesheet is refused
  // immediately instead of letting the async job fail (or wipe entries).
  const cycle = await resolveExamCycle(options.examCycleId)
  assertEditable(cycle)

  const id = `gen_${Date.now().toString(36)}_${(jobCounter++).toString(36)}`
  const job: GenerateJob = { id, status: 'running', createdAt: new Date().toISOString() }
  generateJobs.set(id, job)

  void generateSchedule(options)
    .then((result) => {
      const current = generateJobs.get(id)
      if (current) {
        current.status = 'completed'
        current.completedAt = new Date().toISOString()
        current.result = result
      }
    })
    .catch((err) => {
      logger.error({ err, jobId: id }, 'schedule generation job failed')
      const current = generateJobs.get(id)
      if (current) {
        current.status = 'failed'
        current.completedAt = new Date().toISOString()
        current.error = err instanceof HttpError ? err.message : 'Schedule generation failed'
      }
    })

  return job
}

function getGenerateJob(id: string): GenerateJob | undefined {
  return generateJobs.get(id)
}

export const schedulingService = {
  createEntry: (input: EntryInput, options: { createdBy: string; force?: boolean; override_reason?: string }) =>
    saveEntry(input, { ...options, force: options.force }),
  updateEntry: (id: string, input: EntryInput, options: { createdBy: string; force?: boolean; override_reason?: string }) =>
    saveEntry(input, { ...options, existingId: id }),
  deleteEntry,
  listEntries,
  calendarSummary,
  startGenerate,
  getGenerateJob,
}

export type { DraftAssignment }
