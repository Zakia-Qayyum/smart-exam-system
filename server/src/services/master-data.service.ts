/**
 * Master Data API — Step 22.
 *
 * CRUD for departments, rooms and time slots behind the /api/departments,
 * /api/rooms and /api/time-slots endpoints. Every mutation writes an audit-log
 * row. Deletions that would orphan relational data (students, invigilators,
 * schedule entries) are refused with a 409 instead of failing deep inside a
 * cascade.
 */
import { prisma } from '../lib/prisma.js'
import { HttpError } from '../lib/http-error.js'

export interface ApiDepartment {
  id: string
  name: string
  code: string
  rooms_count: number
  invigilators_count: number
  courses_count: number
}

export interface ApiRoom {
  id: string
  name: string
  capacity: number
  department_id: string | null
  department_code: string | null
  department_name: string | null
}

export interface ApiTimeSlot {
  id: string
  label: string
  start_time: string
  end_time: string
  exam_cycle_id: string
}

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/

/**
 * Pure conversion of an "HH:MM" time to the fixed-date instant the schema uses
 * for TimeSlot.start_time/end_time (2000-01-01, mirroring the seed). Stored in
 * UTC so toISOString() round-trips to the exact clock time.
 */
export function timeToDate(hhmm: string): Date {
  const match = timePattern.exec(hhmm)
  if (!match) throw new HttpError(422, 'invalid_time', 'time must be an HH:MM clock time (24h)')
  return new Date(`2000-01-01T${match[1]}:${match[2]}:00.000Z`)
}

export function timeFromDate(d: Date): string {
  return d.toISOString().slice(11, 16)
}

export function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002'
}

export function isForeignKeyViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2003'
}

// ── Departments ────────────────────────────────────────────────────────────

export async function listDepartments(): Promise<ApiDepartment[]> {
  const rows = await prisma.department.findMany({
    include: {
      _count: { select: { rooms: true, invigilators: true, courses: true } },
    },
    orderBy: { code: 'asc' },
  })
  return rows.map((d) => ({
    id: d.id,
    name: d.name,
    code: d.code,
    rooms_count: d._count.rooms,
    invigilators_count: d._count.invigilators,
    courses_count: d._count.courses,
  }))
}

export async function createDepartment(input: { name: string; code: string }, performedBy: string): Promise<ApiDepartment> {
  const name = input.name.trim()
  const code = input.code.trim().toUpperCase()
  if (!name || !code) throw new HttpError(422, 'fields_required', 'Department name and code are required')

  const created = await prisma.$transaction(async (tx) => {
    try {
      const row = await tx.department.create({ data: { name, code } })
      await tx.auditLog.create({
        data: { action_type: 'department.create', target_type: 'department', target_id: row.id, performed_by: performedBy, meta: { name, code } },
      })
      return row
    } catch (err) {
      if (isUniqueViolation(err)) throw new HttpError(409, 'department_exists', 'A department with this name or code already exists')
      throw err
    }
  })

  return { id: created.id, name, code, rooms_count: 0, invigilators_count: 0, courses_count: 0 }
}

export async function updateDepartment(id: string, input: { name?: string; code?: string }, performedBy: string): Promise<ApiDepartment> {
  const existing = await prisma.department.findUnique({ where: { id } })
  if (!existing) throw new HttpError(404, 'department_not_found', 'Department not found')

  const name = input.name?.trim() || existing.name
  const code = input.code?.trim().toUpperCase() || existing.code

  await prisma.$transaction(async (tx) => {
    try {
      await tx.department.update({ where: { id }, data: { name, code } })
    } catch (err) {
      if (isUniqueViolation(err)) throw new HttpError(409, 'department_exists', 'A department with this name or code already exists')
      throw err
    }
    await tx.auditLog.create({
      data: { action_type: 'department.update', target_type: 'department', target_id: id, performed_by: performedBy, meta: { name, code } },
    })
  })

  const row = await prisma.department.findUnique({
    where: { id },
    include: { _count: { select: { rooms: true, invigilators: true, courses: true } } },
  })
  if (!row) throw new HttpError(404, 'department_not_found', 'Department not found')
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    rooms_count: row._count.rooms,
    invigilators_count: row._count.invigilators,
    courses_count: row._count.courses,
  }
}

export async function deleteDepartment(id: string, performedBy: string): Promise<{ id: string }> {
  const existing = await prisma.department.findUnique({ where: { id } })
  if (!existing) throw new HttpError(404, 'department_not_found', 'Department not found')

  await prisma.$transaction(async (tx) => {
    try {
      await tx.department.delete({ where: { id } })
    } catch (err) {
      if (isForeignKeyViolation(err)) {
        throw new HttpError(409, 'department_in_use', 'This department still has students or invigilators and cannot be deleted')
      }
      throw err
    }
    await tx.auditLog.create({
      data: { action_type: 'department.delete', target_type: 'department', target_id: id, performed_by: performedBy, meta: { name: existing.name } },
    })
  })

  return { id }
}

// ── Rooms ──────────────────────────────────────────────────────────────────

export async function listRooms(): Promise<ApiRoom[]> {
  const rows = await prisma.room.findMany({
    include: { department: { select: { code: true, name: true } } },
    orderBy: { name: 'asc' },
  })
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    capacity: r.capacity,
    department_id: r.department_id,
    department_code: r.department?.code ?? null,
    department_name: r.department?.name ?? null,
  }))
}

export async function createRoom(input: { name: string; capacity: number; department_id?: string | null }, performedBy: string): Promise<ApiRoom> {
  const name = input.name.trim()
  if (!name) throw new HttpError(422, 'fields_required', 'Room name is required')
  if (!Number.isInteger(input.capacity) || input.capacity < 1) {
    throw new HttpError(422, 'invalid_capacity', 'Capacity must be a positive integer')
  }
  if (input.department_id) {
    const dept = await prisma.department.findUnique({ where: { id: input.department_id } })
    if (!dept) throw new HttpError(404, 'department_not_found', 'Department not found')
  }

  const created = await prisma.$transaction(async (tx) => {
    try {
      const row = await tx.room.create({
        data: { name, capacity: input.capacity, department_id: input.department_id ?? null },
        include: { department: { select: { code: true, name: true } } },
      })
      await tx.auditLog.create({
        data: { action_type: 'room.create', target_type: 'room', target_id: row.id, performed_by: performedBy, meta: { name, capacity: input.capacity } },
      })
      return row
    } catch (err) {
      if (isUniqueViolation(err)) throw new HttpError(409, 'room_exists', 'A room with this name already exists')
      throw err
    }
  })

  return {
    id: created.id,
    name: created.name,
    capacity: created.capacity,
    department_id: created.department_id,
    department_code: created.department?.code ?? null,
    department_name: created.department?.name ?? null,
  }
}

export async function updateRoom(id: string, input: { name?: string; capacity?: number; department_id?: string | null }, performedBy: string): Promise<ApiRoom> {
  const existing = await prisma.room.findUnique({ where: { id } })
  if (!existing) throw new HttpError(404, 'room_not_found', 'Room not found')

  const capacity = input.capacity !== undefined ? input.capacity : existing.capacity
  if (!Number.isInteger(capacity) || capacity < 1) throw new HttpError(422, 'invalid_capacity', 'Capacity must be a positive integer')

  const hasDepartmentField = 'department_id' in input
  const departmentId = hasDepartmentField ? input.department_id ?? null : existing.department_id
  if (departmentId) {
    const dept = await prisma.department.findUnique({ where: { id: departmentId } })
    if (!dept) throw new HttpError(404, 'department_not_found', 'Department not found')
  }

  await prisma.$transaction(async (tx) => {
    try {
      await tx.room.update({ where: { id }, data: { name: input.name?.trim() || existing.name, capacity, department_id: departmentId } })
    } catch (err) {
      if (isUniqueViolation(err)) throw new HttpError(409, 'room_exists', 'A room with this name already exists')
      throw err
    }
    await tx.auditLog.create({
      data: { action_type: 'room.update', target_type: 'room', target_id: id, performed_by: performedBy, meta: { name: input.name?.trim() || existing.name, capacity } },
    })
  })

  const row = await prisma.room.findUnique({
    where: { id },
    include: { department: { select: { code: true, name: true } } },
  })
  if (!row) throw new HttpError(404, 'room_not_found', 'Room not found')
  return {
    id: row.id,
    name: row.name,
    capacity: row.capacity,
    department_id: row.department_id,
    department_code: row.department?.code ?? null,
    department_name: row.department?.name ?? null,
  }
}

export async function deleteRoom(id: string, performedBy: string): Promise<{ id: string }> {
  const existing = await prisma.room.findUnique({ where: { id } })
  if (!existing) throw new HttpError(404, 'room_not_found', 'Room not found')

  await prisma.$transaction(async (tx) => {
    try {
      await tx.room.delete({ where: { id } })
    } catch (err) {
      if (isForeignKeyViolation(err)) {
        throw new HttpError(409, 'room_in_use', 'This room has scheduled exams and cannot be deleted')
      }
      throw err
    }
    await tx.auditLog.create({
      data: { action_type: 'room.delete', target_type: 'room', target_id: id, performed_by: performedBy, meta: { name: existing.name } },
    })
  })

  return { id }
}

// ── Time slots ─────────────────────────────────────────────────────────────

export async function listTimeSlots(examCycleId?: string): Promise<ApiTimeSlot[]> {
  const rows = await prisma.timeSlot.findMany({
    where: examCycleId ? { exam_cycle_id: examCycleId } : {},
    orderBy: { start_time: 'asc' },
  })
  return rows.map((s) => ({
    id: s.id,
    label: s.label,
    start_time: timeFromDate(s.start_time),
    end_time: timeFromDate(s.end_time),
    exam_cycle_id: s.exam_cycle_id,
  }))
}

export async function createTimeSlot(input: { label: string; start_time: string; end_time: string; exam_cycle_id: string }, performedBy: string): Promise<ApiTimeSlot> {
  const label = input.label.trim()
  if (!label) throw new HttpError(422, 'fields_required', 'Time slot label is required')
  const start = timeToDate(input.start_time)
  const end = timeToDate(input.end_time)
  if (end <= start) throw new HttpError(422, 'invalid_time_range', 'end_time must be after start_time')
  const cycle = await prisma.examCycle.findUnique({ where: { id: input.exam_cycle_id } })
  if (!cycle) throw new HttpError(404, 'cycle_not_found', 'Exam cycle not found')

  const created = await prisma.$transaction(async (tx) => {
    try {
      const row = await tx.timeSlot.create({
        data: { label, start_time: start, end_time: end, exam_cycle_id: input.exam_cycle_id },
      })
      await tx.auditLog.create({
        data: { action_type: 'time_slot.create', target_type: 'time_slot', target_id: row.id, performed_by: performedBy, meta: { label, start_time: input.start_time, end_time: input.end_time, exam_cycle_id: input.exam_cycle_id } },
      })
      return row
    } catch (err) {
      if (isUniqueViolation(err)) throw new HttpError(409, 'slot_exists', 'A time slot with this label already exists in the cycle')
      throw err
    }
  })

  return { id: created.id, label, start_time: timeFromDate(start), end_time: timeFromDate(end), exam_cycle_id: created.exam_cycle_id }
}

export async function updateTimeSlot(id: string, input: { label?: string; start_time?: string; end_time?: string; exam_cycle_id?: string }, performedBy: string): Promise<ApiTimeSlot> {
  const existing = await prisma.timeSlot.findUnique({ where: { id } })
  if (!existing) throw new HttpError(404, 'time_slot_not_found', 'Time slot not found')

  const label = input.label?.trim() || existing.label
  const start = input.start_time !== undefined ? timeToDate(input.start_time) : existing.start_time
  const end = input.end_time !== undefined ? timeToDate(input.end_time) : existing.end_time
  if (end <= start) throw new HttpError(422, 'invalid_time_range', 'end_time must be after start_time')

  const examCycleId = input.exam_cycle_id ?? existing.exam_cycle_id
  if (input.exam_cycle_id) {
    const cycle = await prisma.examCycle.findUnique({ where: { id: input.exam_cycle_id } })
    if (!cycle) throw new HttpError(404, 'cycle_not_found', 'Exam cycle not found')
  }

  await prisma.$transaction(async (tx) => {
    try {
      await tx.timeSlot.update({ where: { id }, data: { label, start_time: start, end_time: end, exam_cycle_id: examCycleId } })
    } catch (err) {
      if (isUniqueViolation(err)) throw new HttpError(409, 'slot_exists', 'A time slot with this label already exists in the cycle')
      throw err
    }
    await tx.auditLog.create({
      data: { action_type: 'time_slot.update', target_type: 'time_slot', target_id: id, performed_by: performedBy, meta: { label, start_time: timeFromDate(start), end_time: timeFromDate(end) } },
    })
  })

  return { id, label, start_time: timeFromDate(start), end_time: timeFromDate(end), exam_cycle_id: examCycleId }
}

export async function deleteTimeSlot(id: string, performedBy: string): Promise<{ id: string }> {
  const existing = await prisma.timeSlot.findUnique({ where: { id } })
  if (!existing) throw new HttpError(404, 'time_slot_not_found', 'Time slot not found')

  await prisma.$transaction(async (tx) => {
    try {
      await tx.timeSlot.delete({ where: { id } })
    } catch (err) {
      if (isForeignKeyViolation(err)) {
        throw new HttpError(409, 'time_slot_in_use', 'This time slot has scheduled exams and cannot be deleted')
      }
      throw err
    }
    await tx.auditLog.create({
      data: { action_type: 'time_slot.delete', target_type: 'time_slot', target_id: id, performed_by: performedBy, meta: { label: existing.label } },
    })
  })

  return { id }
}
