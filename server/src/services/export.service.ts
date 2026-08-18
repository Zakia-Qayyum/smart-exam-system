/**
 * Export & Reporting service — Step 28.
 *
 * A single shared query powers both the CSV and datesheet-PDF endpoints so
 * the two formats can never drift.  The roll-no-slip endpoint uses its own
 * narrower query (single student) but the date/slot/room data comes from the
 * same Prisma includes.
 */
import { prisma } from '../lib/prisma.js'
import { HttpError } from '../lib/http-error.js'
import { dateFromKey, dateKey, resolveExamCycle } from '../lib/schedule-utils.js'
import type { Prisma } from '../generated/prisma/client.js'

// ── Shared query ──────────────────────────────────────────────────────────

export interface ExportFilter {
  examCycleId?: string
  departmentId?: string
  from?: string
  to?: string
}

/** Flat row shape returned by the shared query — used by CSV and PDF alike. */
export interface DatesheetRow {
  date: string
  day: string
  timeSlotLabel: string
  timeSlotStart: string
  timeSlotEnd: string
  courseCode: string
  courseTitle: string
  sectionBatch: string
  semester: string
  departmentCode: string
  departmentName: string
  roomName: string
  roomCapacity: number
  enrolledCount: number
  status: string
  invigilators: string
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

/**
 * The single source of truth for export queries — CSV and datesheet PDF both
 * call this function, guaranteeing identical rows.
 */
export async function queryDatesheetRows(filter: ExportFilter): Promise<{
  cycle: { id: string; name: string; term: string; status: string; start_date: string; end_date: string }
  rows: DatesheetRow[]
  totalRooms: number
  totalStudents: number
}> {
  const cycle = await resolveExamCycle(filter.examCycleId)

  const where: Prisma.ScheduleEntryWhereInput = {
    exam_cycle_id: cycle.id,
  }

  if (filter.departmentId) {
    where.section = { course: { department_id: filter.departmentId } }
  }

  if (filter.from || filter.to) {
    where.date = {
      ...(filter.from ? { gte: dateFromKey(filter.from) } : {}),
      ...(filter.to ? { lte: dateFromKey(filter.to) } : {}),
    }
  }

  const entries = await prisma.scheduleEntry.findMany({
    where,
    include: {
      section: {
        include: {
          course: { include: { department: true } },
        },
      },
      time_slot: true,
      room: true,
      invigilator_assignments: {
        include: { invigilator: { include: { user: { select: { name: true } } } } },
      },
    },
    orderBy: [{ date: 'asc' }, { time_slot: { start_time: 'asc' } }],
  })

  const rowPromises = entries.map(async (e) => {
    const enrolledCount = await prisma.enrollment.count({ where: { section_id: e.section_id } })
    const d = e.date
    return {
      date: dateKey(d),
      day: DAY_NAMES[d.getDay()],
      timeSlotLabel: e.time_slot.label,
      timeSlotStart: e.time_slot.start_time.toISOString().slice(11, 16),
      timeSlotEnd: e.time_slot.end_time.toISOString().slice(11, 16),
      courseCode: e.section.course.course_code,
      courseTitle: e.section.course.title,
      sectionBatch: e.section.batch,
      semester: e.section.semester,
      departmentCode: e.section.course.department.code,
      departmentName: e.section.course.department.name,
      roomName: e.room.name,
      roomCapacity: e.room.capacity,
      enrolledCount,
      status: e.status,
      invigilators: e.invigilator_assignments.map((a) => a.invigilator.user.name).join(', '),
    }
  })

  const rows = await Promise.all(rowPromises)

  const roomSet = new Set(rows.map((r) => r.roomName))
  const totalStudents = rows.reduce((sum, r) => sum + r.enrolledCount, 0)

  return {
    cycle: {
      id: cycle.id,
      name: cycle.name,
      term: cycle.term,
      status: cycle.status,
      start_date: dateKey(cycle.start_date),
      end_date: dateKey(cycle.end_date),
    },
    rows,
    totalRooms: roomSet.size,
    totalStudents,
  }
}

// ── Roll-no-slip query ────────────────────────────────────────────────────

export interface RollSlipRow {
  date: string
  day: string
  timeSlotLabel: string
  timeSlotStart: string
  timeSlotEnd: string
  courseCode: string
  courseTitle: string
  roomName: string
  seatNo: string
  rollNo: string
}

/**
 * Build a student's roll-no-slip rows for a given cycle.
 * The seat number is derived deterministically from the student's position in
 * the enrollment list for each section.
 */
export async function queryRollSlipRows(
  studentId: string,
  examCycleId?: string,
): Promise<{
  student: { id: string; name: string; regId: string; program: string; department: string }
  cycle: { id: string; name: string; term: string; status: string }
  rows: RollSlipRow[]
}> {
  const cycle = await resolveExamCycle(examCycleId)

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { department: { select: { name: true } } },
  })
  if (!student) throw new HttpError(404, 'student_not_found', 'Student not found')

  const enrollments = await prisma.enrollment.findMany({
    where: { student_id: studentId },
    select: { section_id: true },
  })
  const sectionIds = enrollments.map((e) => e.section_id)

  if (sectionIds.length === 0) {
    return {
      student: {
        id: student.id,
        name: student.name,
        regId: student.reg_id,
        program: student.program,
        department: student.department.name,
      },
      cycle: { id: cycle.id, name: cycle.name, term: cycle.term, status: cycle.status },
      rows: [],
    }
  }

  const entries = await prisma.scheduleEntry.findMany({
    where: { exam_cycle_id: cycle.id, section_id: { in: sectionIds } },
    include: {
      section: { include: { course: true } },
      time_slot: true,
      room: true,
    },
    orderBy: [{ date: 'asc' }, { time_slot: { start_time: 'asc' } }],
  })

  const rows: RollSlipRow[] = []

  for (const e of entries) {
    const allStudents = await prisma.enrollment.findMany({
      where: { section_id: e.section_id },
      select: { student_id: true },
      orderBy: { student_id: 'asc' },
    })
    const position = allStudents.findIndex((s) => s.student_id === studentId) + 1
    const d = e.date

    rows.push({
      date: dateKey(d),
      day: DAY_NAMES[d.getDay()],
      timeSlotLabel: e.time_slot.label,
      timeSlotStart: e.time_slot.start_time.toISOString().slice(11, 16),
      timeSlotEnd: e.time_slot.end_time.toISOString().slice(11, 16),
      courseCode: e.section.course.course_code,
      courseTitle: e.section.course.title,
      roomName: e.room.name,
      seatNo: String(position).padStart(3, '0'),
      rollNo: student.reg_id,
    })
  }

  return {
    student: {
      id: student.id,
      name: student.name,
      regId: student.reg_id,
      program: student.program,
      department: student.department.name,
    },
    cycle: { id: cycle.id, name: cycle.name, term: cycle.term, status: cycle.status },
    rows,
  }
}

// ── Export history (from audit_log) ───────────────────────────────────────

export interface ExportHistoryEntry {
  id: string
  actionType: string
  exportType: string
  label: string
  filters: string
  rowCount: number
  filename: string
  generatedBy: { id: string; name: string; email: string } | null
  timestamp: string
}

export async function listExportHistory(performedBy?: string): Promise<ExportHistoryEntry[]> {
  const where: Prisma.AuditLogWhereInput = {
    target_type: 'export',
  }

  if (performedBy) where.performed_by = performedBy

  const logs = await prisma.auditLog.findMany({
    where,
    include: { performer: { select: { id: true, name: true, email: true } } },
    orderBy: { timestamp: 'desc' },
    take: 100,
  })

  return logs.map((log) => {
    const meta = (log.meta as Record<string, unknown>) ?? {}
    return {
      id: log.id,
      actionType: log.action_type,
      exportType: String(meta.export_type ?? 'schedule'),
      label: String(meta.label ?? ''),
      filters: String(meta.filters ?? ''),
      rowCount: Number(meta.row_count ?? 0),
      filename: String(meta.filename ?? ''),
      generatedBy: log.performer,
      timestamp: log.timestamp.toISOString(),
    }
  })
}

export const exportService = {
  queryDatesheetRows,
  queryRollSlipRows,
  listExportHistory,
}
