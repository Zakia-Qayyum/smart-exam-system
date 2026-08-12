import { Router, type RequestHandler } from 'express'
import { requireAuth, requireRole } from '../middleware/require-auth.js'
import { prisma } from '../lib/prisma.js'
import { dateKey } from '../lib/schedule-utils.js'
import { HttpError } from '../lib/http-error.js'

export const cyclesRouter = Router()

// Every cycle endpoint requires an authenticated session.
cyclesRouter.use(requireAuth)

const WRITE_ROLES = ['admin', 'exam-coordinator'] as const

/**
 * Publish the datesheet for an exam cycle. Notifies every user in the system
 * and locks further timetable editing (writes are refused on non-draft cycles
 * by the scheduling service). Idempotent — publishing twice is a no-op that
 * still returns the published cycle.
 */
cyclesRouter.post(
  '/:id/publish',
  requireRole(...WRITE_ROLES),
  (async (req, res, next) => {
    try {
      const id = String(req.params.id)
      const cycle = await prisma.examCycle.findUnique({ where: { id } })
      if (!cycle) throw new HttpError(404, 'cycle_not_found', 'Exam cycle not found')
      if (cycle.status === 'archived') {
        throw new HttpError(409, 'cycle_archived', 'Archived cycles cannot be published')
      }

      // Publishing is idempotent — only the draft→published transition notifies
      // users and writes the audit trail.
      if (cycle.status === 'published') {
        res.json({
          cycle: {
            id: cycle.id,
            name: cycle.name,
            term: cycle.term,
            start_date: dateKey(cycle.start_date),
            end_date: dateKey(cycle.end_date),
            status: cycle.status,
          },
        })
        return
      }

      const updated = await prisma.$transaction(async (tx) => {
        const current = await tx.examCycle.update({
          where: { id },
          data: { status: 'published' },
        })
        const recipients = await tx.user.findMany({ where: { status: 'active' }, select: { id: true } })
        await tx.notification.createMany({
          data: recipients.map((u) => ({
            user_id: u.id,
            type: 'published',
            title: 'Datesheet published',
            body: `The ${current.name} datesheet is now live. View it on the Datesheet Calendar.`,
            link: '/calendar',
          })),
        })
        await tx.auditLog.create({
          data: {
            action_type: 'cycle.publish',
            target_type: 'exam_cycle',
            target_id: current.id,
            performed_by: res.locals.user.id,
          },
        })
        return current
      })

      res.json({
        cycle: {
          id: updated.id,
          name: updated.name,
          term: updated.term,
          start_date: dateKey(updated.start_date),
          end_date: dateKey(updated.end_date),
          status: updated.status,
        },
      })
    } catch (err) {
      next(err)
    }
  }) as RequestHandler,
)
