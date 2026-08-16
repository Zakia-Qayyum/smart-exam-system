/**
 * DB-backed clash detection. The pure algorithms live in lib/clash-detection.ts
 * and are unit-tested in isolation; this service loads real enrollments +
 * schedule data, runs those algorithms and persists `ClashRecord` rows.
 *
 * Responsibilities:
 *   - detectCandidateClashes(): synchronous check for the schedule-entry save
 *     flow (Step 9) so clashing saves are blocked with 409 clash_blocked.
 *   - detectSameSlotClashes() / detectSameDayOverload(): full-cycle analysis.
 *   - scanFullCycle(): upsert semantics — create new records, resolve stale
 *     open records, preserve overridden/resolved history, never delete rows.
 *   - listClashes() / resolveClash() / overrideClash(): the /api/clashes API.
 */
import { prisma } from '../lib/prisma.js'
import { HttpError } from '../lib/http-error.js'
import { dateKey, resolveExamCycle } from '../lib/schedule-utils.js'
import { notificationsWriteService } from './notifications.service.js'
import {
  detectSameDayOverload as detectSameDayOverloadPure,
  findClashesForCandidate,
  groupSameSlotClashes,
  type ClashHit,
  type ClashResult,
  type EnrolledStudent,
  type SameDayOverload,
  type SameSlotClashGroup,
  type StudentExam,
} from '../lib/clash-detection.js'

export type { ClashHit, ClashResult, EnrolledStudent, SameDayOverload, SameSlotClashGroup, StudentExam }

export interface DetectedClashes extends ClashResult {}

export interface CandidateClashInput {
  cycleId: string
  sectionId: string
  /** ISO date key, e.g. '2026-08-10' */
  date: string
  timeSlotId: string
  /** Omit when creating, pass the entry id when editing it. */
  existingId?: string
}

export interface ScanSummary {
  exam_cycle_id: string
  created: number
  resolved: number
  unchanged: number
  same_slot: number
  same_day: number
  scanned_at: string
}

export interface ApiClashRecord {
  id: string
  type: string
  exam_cycle_id: string
  student: { id: string; reg_id: string; name: string }
  schedule_entry_ids: string[]
  entries: Array<{ id: string; date: string; time_slot_id: string; time_slot_label: string; course_code: string }>
  severity: string
  status: string
  override_reason: string | null
  created_at: string
}

export interface ClashListQuery {
  exam_cycle_id?: string
  type?: 'same_slot' | 'same_day'
  status?: 'open' | 'overridden' | 'resolved' | 'all'
  student_id?: string
  page?: number
  page_size?: number
}

export interface ClashListResult {
  clashes: ApiClashRecord[]
  total: number
  page: number
  page_size: number
  summary: { open: number; overridden: number; resolved: number; same_slot: number; same_day: number }
}

interface ClashRow {
  id: string
  type: string
  exam_cycle_id: string
  student_id: string
  schedule_entry_ids: string[]
  severity: string
  status: string
  override_reason: string | null
  created_at: Date
  student: { id: string; reg_id: string; name: string }
}

// ── Data loading ───────────────────────────────────────────────────────────

/**
 * One batched load of every scheduled exam in the cycle plus every enrollment
 * (joined with section → course). Returns the per-student exam list and the
 * deduplicated student index — no N+1 queries regardless of data size.
 */
async function loadCycleData(examCycleId: string) {
  const [entries, enrollments] = await Promise.all([
    prisma.scheduleEntry.findMany({
      where: { exam_cycle_id: examCycleId },
      select: { id: true, section_id: true, date: true, time_slot_id: true, status: true },
    }),
    prisma.enrollment.findMany({
      select: {
        student_id: true,
        student: { select: { reg_id: true, name: true } },
        section: { select: { id: true, course: { select: { course_code: true } } } },
      },
    }),
  ])

  const entryBySection = new Map(entries.map((e) => [e.section_id, e]))
  const students = new Map<string, EnrolledStudent>()
  const exams: StudentExam[] = []

  for (const en of enrollments) {
    const entry = entryBySection.get(en.section.id)
    if (!entry) continue
    if (!students.has(en.student_id)) {
      students.set(en.student_id, { studentId: en.student_id, regId: en.student.reg_id, name: en.student.name })
    }
    exams.push({
      studentId: en.student_id,
      entryId: entry.id,
      sectionId: en.section.id,
      date: dateKey(entry.date),
      timeSlotId: entry.time_slot_id,
      courseCode: en.section.course.course_code,
    })
  }

  return { exams, students: [...students.values()], entries }
}

// ── Candidate check (schedule-entry save flow) ─────────────────────────────

async function detectCandidateClashes(input: CandidateClashInput): Promise<DetectedClashes> {
  const enrolledRows = await prisma.enrollment.findMany({
    where: { section_id: input.sectionId },
    select: { student: { select: { id: true, reg_id: true, name: true } } },
  })
  const enrolled: EnrolledStudent[] = enrolledRows.map((r) => ({
    studentId: r.student.id,
    regId: r.student.reg_id,
    name: r.student.name,
  }))
  const studentIds = enrolled.map((s) => s.studentId)

  const otherEnrollments = studentIds.length
    ? await prisma.enrollment.findMany({
        where: { student_id: { in: studentIds } },
        select: {
          student_id: true,
          section: {
            select: {
              id: true,
              course: { select: { course_code: true } },
              schedule_entries: {
                where: { exam_cycle_id: input.cycleId, ...(input.existingId ? { id: { not: input.existingId } } : {}) },
                select: { id: true, date: true, time_slot_id: true },
              },
            },
          },
        },
      })
    : []

  const studentExams: StudentExam[] = []
  for (const en of otherEnrollments) {
    for (const se of en.section.schedule_entries) {
      studentExams.push({
        studentId: en.student_id,
        entryId: se.id,
        sectionId: en.section.id,
        date: dateKey(se.date),
        timeSlotId: se.time_slot_id,
        courseCode: en.section.course.course_code,
      })
    }
  }

  return findClashesForCandidate(
    { sectionId: input.sectionId, date: input.date, timeSlotId: input.timeSlotId },
    enrolled,
    studentExams,
  )
}

// ── Full-cycle analysis ────────────────────────────────────────────────────

async function detectSameSlotClashes(examCycleId: string, candidate?: CandidateClashInput): Promise<SameSlotClashGroup[]> {
  if (candidate) {
    const detected = await detectCandidateClashes(candidate)
    return groupCandidateHits(detected.clashes)
  }
  const { exams, students } = await loadCycleData(examCycleId)
  return groupSameSlotClashes(exams, students)
}

async function detectSameDayOverload(examCycleId: string, studentId?: string, threshold = 2): Promise<SameDayOverload[]> {
  const { exams, students } = await loadCycleData(examCycleId)
  const filtered = studentId ? exams.filter((e) => e.studentId === studentId) : exams
  return detectSameDayOverloadPure(filtered, students, threshold)
}

/** Project same-slot ClashHits (from a candidate check) into clash groups. */
function groupCandidateHits(hits: ClashHit[]): SameSlotClashGroup[] {
  const byKey = new Map<string, SameSlotClashGroup>()
  for (const hit of hits) {
    if (hit.type !== 'same_slot') continue
    const key = `${hit.student.id}|${hit.conflictDate}|${hit.conflictTimeSlotId}`
    let group = byKey.get(key)
    if (!group) {
      group = {
        student: { studentId: hit.student.id, regId: hit.student.regId, name: hit.student.name },
        date: hit.conflictDate,
        timeSlotId: hit.conflictTimeSlotId,
        entries: [],
      }
      byKey.set(key, group)
    }
    group.entries.push({ entryId: hit.conflictEntryId, sectionId: hit.conflictSectionId, courseCode: hit.conflictCourseCode })
  }
  return [...byKey.values()].map((g) => ({
    ...g,
    entries: g.entries.sort((a, b) => a.courseCode.localeCompare(b.courseCode)),
  }))
}

// ── Scan (upsert) ──────────────────────────────────────────────────────────

const expectedKey = (row: { type: string; student_id: string; schedule_entry_ids: string[] }) =>
  `${row.type}|${row.student_id}|${[...row.schedule_entry_ids].sort().join(',')}`

async function scanFullCycle(examCycleId?: string, performedBy?: string): Promise<ScanSummary> {
  const cycle = await resolveExamCycle(examCycleId)
  const { exams, students } = await loadCycleData(cycle.id)

  const groups = groupSameSlotClashes(exams, students)
  const overloads = detectSameDayOverloadPure(exams, students, 2)

  // A day overload whose papers all share one slot is already captured by the
  // same_slot record — skip it so the coordinator is not shown the clash twice.
  const purelySameSlotDays = new Set(
    overloads
      .filter((o) => o.papers.length >= 2 && new Set(o.papers.map((p) => p.timeSlotId)).size === 1)
      .map((o) => `${o.student.studentId}|${o.date}`),
  )

  const expectedRows: Array<{
    type: 'same_slot' | 'same_day'
    exam_cycle_id: string
    student_id: string
    schedule_entry_ids: string[]
    severity: 'high' | 'medium'
  }> = []

  for (const g of groups) {
    expectedRows.push({
      type: 'same_slot',
      exam_cycle_id: cycle.id,
      student_id: g.student.studentId,
      schedule_entry_ids: g.entries.map((e) => e.entryId).sort(),
      severity: 'high',
    })
  }
  for (const o of overloads) {
    if (purelySameSlotDays.has(`${o.student.studentId}|${o.date}`)) continue
    expectedRows.push({
      type: 'same_day',
      exam_cycle_id: cycle.id,
      student_id: o.student.studentId,
      schedule_entry_ids: o.papers.map((p) => p.entryId).sort(),
      severity: 'medium',
    })
  }

  const existing = await prisma.clashRecord.findMany({
    where: { exam_cycle_id: cycle.id, status: { in: ['open', 'overridden'] } },
    select: { id: true, type: true, student_id: true, schedule_entry_ids: true, status: true },
  })

  const existingByKey = new Map<string, Array<(typeof existing)[number]>>()
  for (const record of existing) {
    const key = expectedKey(record)
    existingByKey.set(key, [...(existingByKey.get(key) ?? []), record])
  }

  const toCreate = expectedRows.filter((row) => {
    const present = existingByKey.get(expectedKey(row)) ?? []
    if (present.some((p) => p.status === 'open')) return false
    if (present.some((p) => p.status === 'overridden')) return false
    return true
  })

  const openKeys = new Set(
    existing.filter((p) => p.status === 'open').map((p) => expectedKey(p)),
  )
  const toResolve = existing.filter((r) => r.status === 'open' && !openKeys.has(expectedKey(r)))

  const needsReviewIds = new Set(groups.flatMap((g) => g.entries.map((e) => e.entryId)))

  await prisma.$transaction(async (tx) => {
    if (toCreate.length) {
      await tx.clashRecord.createMany({
        data: toCreate.map((row) => ({ ...row, status: 'open' as const })),
      })

      // Fan out to the exam coordinator and the dept-coordinators whose
      // sections are implicated in the freshly detected clashes.
      const affectedEntryIds = [...new Set(toCreate.flatMap((row) => row.schedule_entry_ids))]
      const affectedSections = await tx.scheduleEntry.findMany({
        where: { id: { in: affectedEntryIds } },
        select: { section: { select: { course: { select: { department_id: true } } } } },
      })
      const clashNotice = {
        type: 'clash' as const,
        title: 'New clashes detected',
        body: `${toCreate.length} new clash${toCreate.length === 1 ? '' : 'es'} found in ${cycle.name}. Review and resolve them.`,
        link: '/clashes',
      }
      await notificationsWriteService.notifyRole('coordinator', clashNotice, { client: tx })
      for (const departmentId of new Set(affectedSections.map((s) => s.section.course.department_id))) {
        await notificationsWriteService.notifyRole('dept-coordinator', clashNotice, { departmentScope: departmentId, client: tx })
      }
    }
    if (toResolve.length) {
      await tx.clashRecord.updateMany({
        where: { id: { in: toResolve.map((r) => r.id) } },
        data: { status: 'resolved' },
      })
    }
    if (needsReviewIds.size) {
      await tx.scheduleEntry.updateMany({
        where: { id: { in: [...needsReviewIds] }, status: 'scheduled' },
        data: { status: 'needs_review' },
      })
    }
    if (performedBy) {
      await tx.auditLog.create({
        data: {
          action_type: 'clash.scan',
          target_type: 'exam_cycle',
          target_id: cycle.id,
          performed_by: performedBy,
          meta: {
            created: toCreate.length,
            resolved: toResolve.length,
            same_slot: groups.length,
            same_day: expectedRows.filter((r) => r.type === 'same_day').length,
          },
        },
      })
    }
  })

  return {
    exam_cycle_id: cycle.id,
    created: toCreate.length,
    resolved: toResolve.length,
    unchanged: expectedRows.length - toCreate.length,
    same_slot: groups.length,
    same_day: expectedRows.filter((r) => r.type === 'same_day').length,
    scanned_at: new Date().toISOString(),
  }
}

// ── Listing ────────────────────────────────────────────────────────────────

async function listClashes(query: ClashListQuery): Promise<ClashListResult> {
  const cycle = await resolveExamCycle(query.exam_cycle_id)
  const status =
    query.status === 'all'
      ? undefined
      : query.status === 'open' || query.status === 'overridden' || query.status === 'resolved'
        ? query.status
        : 'open'

  const where = {
    exam_cycle_id: cycle.id,
    ...(query.type ? { type: query.type } : {}),
    ...(query.student_id ? { student_id: query.student_id } : {}),
    ...(status ? { status } : {}),
  }

  const page = Math.max(1, query.page ?? 1)
  const page_size = Math.min(200, Math.max(1, query.page_size ?? 50))

  const [rows, total] = await Promise.all([
    prisma.clashRecord.findMany({
      where,
      include: { student: { select: { id: true, reg_id: true, name: true } } },
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * page_size,
      take: page_size,
    }),
    prisma.clashRecord.count({ where }),
  ])

  const clashes = await Promise.all(rows.map((row) => enrichClash(row)))

  const [statusCounts, typeCounts] = await Promise.all([
    prisma.clashRecord.groupBy({ by: ['status'], where: { exam_cycle_id: cycle.id }, _count: true }),
    prisma.clashRecord.groupBy({ by: ['type'], where: { exam_cycle_id: cycle.id }, _count: true }),
  ])
  const countOf = (status: string) => statusCounts.find((c) => c.status === status)?._count ?? 0
  const countType = (type: string) => typeCounts.find((c) => c.type === type)?._count ?? 0

  return {
    clashes,
    total,
    page,
    page_size,
    summary: {
      open: countOf('open'),
      overridden: countOf('overridden'),
      resolved: countOf('resolved'),
      same_slot: countType('same_slot'),
      same_day: countType('same_day'),
    },
  }
}

async function getClashOrThrow(id: string): Promise<ClashRow> {
  const record = await prisma.clashRecord.findUnique({
    where: { id },
    include: { student: { select: { id: true, reg_id: true, name: true } } },
  })
  if (!record) throw new HttpError(404, 'clash_not_found', 'Clash record not found')
  return record
}

async function enrichClash(row: ClashRow): Promise<ApiClashRecord> {
  const entryIds = row.schedule_entry_ids
  const entryRows = entryIds.length
    ? await prisma.scheduleEntry.findMany({
        where: { id: { in: entryIds } },
        select: {
          id: true,
          date: true,
          time_slot: { select: { id: true, label: true } },
          section: { select: { course: { select: { course_code: true } } } },
        },
      })
    : []
  const byId = new Map(entryRows.map((e) => [e.id, e]))

  return {
    id: row.id,
    type: row.type,
    exam_cycle_id: row.exam_cycle_id,
    student: { id: row.student_id, reg_id: row.student.reg_id, name: row.student.name },
    schedule_entry_ids: row.schedule_entry_ids,
    entries: row.schedule_entry_ids.flatMap((entryId) => {
      const e = byId.get(entryId)
      return e
        ? [
            {
              id: e.id,
              date: dateKey(e.date),
              time_slot_id: e.time_slot.id,
              time_slot_label: e.time_slot.label,
              course_code: e.section.course.course_code,
            },
          ]
        : []
    }),
    severity: row.severity,
    status: row.status,
    override_reason: row.override_reason,
    created_at: row.created_at.toISOString(),
  }
}

// ── Resolve / override ─────────────────────────────────────────────────────

async function resolveClash(id: string, options: { reason: string; performedBy: string }): Promise<ApiClashRecord> {
  const record = await getClashOrThrow(id)
  if (record.status !== 'open') throw new HttpError(409, 'clash_not_open', 'Only open clashes can be resolved')
  if (!options.reason?.trim()) throw new HttpError(422, 'reason_required', 'A justification is required to resolve a clash')

  await prisma.$transaction(async (tx) => {
    await tx.clashRecord.update({ where: { id }, data: { status: 'resolved' } })
    await tx.auditLog.create({
      data: {
        action_type: 'clash.resolve',
        target_type: 'clash_record',
        target_id: id,
        performed_by: options.performedBy,
        meta: { reason: options.reason },
      },
    })
  })

  return enrichClash(await getClashOrThrow(id))
}

async function overrideClash(id: string, options: { reason: string; performedBy: string }): Promise<ApiClashRecord> {
  const record = await getClashOrThrow(id)
  if (record.status !== 'open') throw new HttpError(409, 'clash_not_open', 'Only open clashes can be overridden')
  if (!options.reason?.trim()) throw new HttpError(422, 'reason_required', 'A justification is required to override a clash')

  await prisma.$transaction(async (tx) => {
    await tx.clashRecord.update({ where: { id }, data: { status: 'overridden', override_reason: options.reason } })
    await tx.overrideRequest.create({
      data: {
        raised_by: options.performedBy,
        approved_by: options.performedBy,
        target_type: 'clash_record',
        target_id: id,
        reason: options.reason,
        status: 'approved',
        decided_at: new Date(),
      },
    })
    await tx.auditLog.create({
      data: {
        action_type: 'clash.override',
        target_type: 'clash_record',
        target_id: id,
        performed_by: options.performedBy,
        meta: { reason: options.reason },
      },
    })
  })

  return enrichClash(await getClashOrThrow(id))
}

export const clashService = {
  detectCandidateClashes,
  detectSameSlotClashes,
  detectSameDayOverload,
  scanFullCycle,
  listClashes,
  resolveClash,
  overrideClash,
}
