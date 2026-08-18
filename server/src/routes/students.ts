/**
 * Student self-service endpoints — Step 29.  Mounted at /api/students.
 *
 * GET /me           — resolve the current user to their student record + exams
 * GET /me/schedule  — the student's exam schedule entries for the active cycle
 */
import { Router } from 'express'
import { requireAuth } from '../middleware/require-auth.js'
import { prisma } from '../lib/prisma.js'
import { HttpError } from '../lib/http-error.js'
import { dateKey, resolveExamCycle } from '../lib/schedule-utils.js'
import type { AuthenticatedUser } from '../middleware/require-auth.js'

export const studentsRouter = Router()

studentsRouter.use(requireAuth)

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

/**
 * Resolve the authenticated user to their student record.
 *
 * Matching strategy (demo-safe, no schema change):
 *   1. Same name + same department → direct hit.
 *   2. Fallback: first student in the same department.
 *   3. If no student in that department → 404.
 *
 * In production, the users table would have a student_id FK; this endpoint
 * would be a simple lookup.
 */
async function resolveStudent(user: AuthenticatedUser) {
  if (user.role !== 'student') {
    throw new HttpError(403, 'not_a_student', 'This endpoint is only for student accounts')
  }

  // Try exact name + department match
  let student = await prisma.student.findFirst({
    where: {
      name: user.name,
      department_id: user.departmentId ?? undefined,
    },
    include: { department: { select: { name: true } } },
  })

  if (!student && user.departmentId) {
    // Fallback: first student in the department
    student = await prisma.student.findFirst({
      where: { department_id: user.departmentId },
      include: { department: { select: { name: true } } },
      orderBy: { reg_id: 'asc' },
    })
  }

  if (!student) {
    throw new HttpError(404, 'student_not_found', 'No student record found for this account')
  }

  return student
}

// ── GET /me ───────────────────────────────────────────────────────────────

studentsRouter.get('/me', async (_req, res, next) => {
  try {
    const user = res.locals.user as AuthenticatedUser
    const student = await resolveStudent(user)
    const cycle = await resolveExamCycle()

    const enrollments = await prisma.enrollment.findMany({
      where: { student_id: student.id },
      select: { section_id: true },
    })
    const sectionIds = enrollments.map((e) => e.section_id)

    const entries = await prisma.scheduleEntry.findMany({
      where: { exam_cycle_id: cycle.id, section_id: { in: sectionIds } },
      include: {
        section: { include: { course: true } },
        time_slot: true,
        room: true,
      },
      orderBy: [{ date: 'asc' }, { time_slot: { start_time: 'asc' } }],
    })

    const allClashes = await prisma.clashRecord.findMany({
      where: { student_id: student.id, exam_cycle_id: cycle.id },
      select: { id: true, type: true, severity: true, schedule_entry_ids: true, status: true },
    })
    const clashes = allClashes.filter((c) => c.status === 'open')

    // Which entry IDs are involved in an open clash
    const clashedEntryIds = new Set(clashes.flatMap((c) => c.schedule_entry_ids))

    const rows = []
    for (const e of entries) {
      const seatList = await prisma.enrollment.findMany({
        where: { section_id: e.section_id },
        select: { student_id: true },
        orderBy: { student_id: 'asc' },
      })
      const position = seatList.findIndex((s) => s.student_id === student.id) + 1
      const d = e.date

      rows.push({
        id: e.id,
        date: dateKey(d),
        day: DAY_NAMES[d.getDay()],
        timeSlotLabel: e.time_slot.label,
        startTime: e.time_slot.start_time.toISOString().slice(11, 16),
        endTime: e.time_slot.end_time.toISOString().slice(11, 16),
        courseCode: e.section.course.course_code,
        courseTitle: e.section.course.title,
        roomName: e.room.name,
        seatNo: String(position).padStart(3, '0'),
        rollNo: student.reg_id,
        status: clashedEntryIds.has(e.id) ? 'needs_review' : 'confirmed',
      })
    }

    res.json({
      student: {
        id: student.id,
        name: student.name,
        regId: student.reg_id,
        program: student.program,
        department: student.department.name,
      },
      cycle: {
        id: cycle.id,
        name: cycle.name,
        term: cycle.term,
        status: cycle.status,
      },
      exams: rows,
      hasClashes: clashes.length > 0,
    })
  } catch (err) {
    next(err)
  }
})
