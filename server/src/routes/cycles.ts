import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/require-auth.js'
import { publishCycle } from '../services/exam-cycles.service.js'

export const cyclesRouter = Router()

// Every cycle endpoint requires an authenticated session.
cyclesRouter.use(requireAuth)

const WRITE_ROLES = ['admin', 'exam-coordinator'] as const

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
