import { Router, type RequestHandler } from 'express'
import { requireAuth, requireRole } from '../middleware/require-auth.js'
import { prisma } from '../lib/prisma.js'
import { dateKey } from '../lib/schedule-utils.js'

export const catalogRouter = Router()

// Every catalog endpoint requires an authenticated session.
catalogRouter.use(requireAuth)

const READ_ROLES = ['admin', 'exam-coordinator', 'dept-coordinator', 'hod'] as const

const time = (d: Date) => new Date(d).toISOString().slice(11, 16)

/**
 * Reference data for the scheduling screens: the active exam cycle (draft or
 * published — matching the scheduling service's cycle resolution, so the UI
 * can surface the publish lock), plus departments, courses, sections (with
 * enrollment counts), rooms and the cycle's time slots. Read-only; the
 * frontend uses this instead of the mock Step 8 config.
 */
catalogRouter.get(
  '/',
  requireRole(...READ_ROLES),
  (async (_req, res, next) => {
    try {
      const cycle = await prisma.examCycle.findFirst({
        where: { status: { in: ['draft', 'published'] } },
        orderBy: { created_at: 'desc' },
      })

      const [departments, courses, sections, rooms, timeSlots, invigilators] = await Promise.all([
        prisma.department.findMany({
          orderBy: { code: 'asc' },
          select: { id: true, code: true, name: true },
        }),
        prisma.course.findMany({
          orderBy: { course_code: 'asc' },
          select: { id: true, course_code: true, title: true, department_id: true, credit_hours: true },
        }),
        prisma.section.findMany({
          orderBy: { course: { course_code: 'asc' } },
          select: {
            id: true,
            course_id: true,
            batch: true,
            semester: true,
            course: { select: { course_code: true, title: true, department_id: true } },
            _count: { select: { enrollments: true } },
          },
        }),
        prisma.room.findMany({
          orderBy: { name: 'asc' },
          select: { id: true, name: true, department_id: true, capacity: true },
        }),
        prisma.timeSlot.findMany({
          where: cycle ? { exam_cycle_id: cycle.id } : {},
          orderBy: { start_time: 'asc' },
          select: { id: true, label: true, start_time: true, end_time: true },
        }),
        prisma.invigilator.findMany({
          orderBy: { user: { name: 'asc' } },
          select: { id: true, department_id: true, user: { select: { name: true } } },
        }),
      ])

      res.json({
        cycle: cycle
          ? {
              id: cycle.id,
              name: cycle.name,
              term: cycle.term,
              start_date: dateKey(cycle.start_date),
              end_date: dateKey(cycle.end_date),
              status: cycle.status,
            }
          : null,
        departments,
        courses,
        sections: sections.map((s) => ({
          id: s.id,
          course_id: s.course_id,
          course_code: s.course.course_code,
          title: s.course.title,
          department_id: s.course.department_id,
          batch: s.batch,
          semester: s.semester,
          enrolled_count: s._count.enrollments,
        })),
        rooms,
        time_slots: timeSlots.map((t) => ({
          id: t.id,
          label: t.label,
          start_time: time(t.start_time),
          end_time: time(t.end_time),
        })),
        batches: [...new Set(sections.map((s) => s.batch))].sort(),
        invigilators: invigilators.map((inv) => ({
          id: inv.id,
          name: inv.user.name,
          department_id: inv.department_id,
        })),
      })
    } catch (err) {
      next(err)
    }
  }) as RequestHandler,
)
