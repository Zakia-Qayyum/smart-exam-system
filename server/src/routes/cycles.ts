import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/require-auth.js'
import { publishCycle } from '../services/exam-cycles.service.js'
import { prisma } from '../lib/prisma.js'
import { dateKey } from '../lib/schedule-utils.js'

export const cyclesRouter = Router()

// Every cycle endpoint requires an authenticated session.
cyclesRouter.use(requireAuth)

const READ_ROLES = ['admin', 'exam-coordinator', 'dept-coordinator', 'hod'] as const
const WRITE_ROLES = ['admin', 'exam-coordinator'] as const

/**
 * List all exam cycles (for dropdowns, reports, etc.).
 */
cyclesRouter.get('/', requireRole(...READ_ROLES), async (_req, res, next) => {
  try {
    const cycles = await prisma.examCycle.findMany({
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        name: true,
        term: true,
        status: true,
        start_date: true,
        end_date: true,
        created_at: true,
      },
    })
    res.json({
      cycles: cycles.map((c) => ({
        id: c.id,
        name: c.name,
        term: c.term,
        status: c.status,
        start_date: dateKey(c.start_date),
        end_date: dateKey(c.end_date),
        created_at: c.created_at.toISOString(),
      })),
    })
  } catch (err) {
    next(err)
  }
})

/**
 * Publish the datesheet for an exam cycle. Delegates to the shared exam-cycle
 * service so this URL style and /api/exam-cycles/:id/publish behave
 * identically: status → published (locking timetable writes), bulk
 * notifications to everyone with an entry in the cycle, and an audit row.
 * Idempotent — publishing twice is a no-op that still returns the cycle.
 */
cyclesRouter.post('/:id/publish', requireRole(...WRITE_ROLES), async (req, res) => {
  res.json({ cycle: await publishCycle(String(req.params.id), res.locals.user.id) })
})
