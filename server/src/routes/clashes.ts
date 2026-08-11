import { Router, type RequestHandler, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { validateBody } from '../lib/validate-body.js'
import { requireAuth, requireRole } from '../middleware/require-auth.js'
import { clashService } from '../services/clash-detection.service.js'

export const clashesRouter = Router()

// Every clash endpoint requires an authenticated session.
clashesRouter.use(requireAuth)

const READ_ROLES = ['admin', 'exam-coordinator', 'dept-coordinator', 'hod'] as const
const WRITE_ROLES = ['admin', 'exam-coordinator'] as const

const scanBodySchema = z.object({
  exam_cycle_id: z.string().min(1).optional(),
})

const actionBodySchema = z.object({
  reason: z.string().min(1, 'A justification is required'),
})

// ── GET /api/clashes ───────────────────────────────────────────────────────
clashesRouter.get(
  '/',
  requireRole(...READ_ROLES),
  (async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = req.query as Record<string, string | undefined>
      const result = await clashService.listClashes({
        exam_cycle_id: q.cycle || undefined,
        type: q.type === 'same_slot' || q.type === 'same_day' ? q.type : undefined,
        status:
          q.status === 'open' || q.status === 'overridden' || q.status === 'resolved' || q.status === 'all'
            ? q.status
            : undefined,
        student_id: q.student || undefined,
        page: q.page ? Number.parseInt(q.page, 10) : undefined,
        page_size: q.page_size ? Number.parseInt(q.page_size, 10) : undefined,
      })
      res.json(result)
    } catch (err) {
      next(err)
    }
  }) as RequestHandler,
)

// ── POST /api/clashes/scan ─────────────────────────────────────────────────
clashesRouter.post(
  '/scan',
  requireRole(...WRITE_ROLES),
  validateBody(scanBodySchema),
  async (req, res) => {
    const body = req.body as z.infer<typeof scanBodySchema>
    const result = await clashService.scanFullCycle(body.exam_cycle_id, res.locals.user.id)
    res.json(result)
  },
)

// ── POST /api/clashes/:id/resolve ──────────────────────────────────────────
clashesRouter.post(
  '/:id/resolve',
  requireRole(...WRITE_ROLES),
  validateBody(actionBodySchema),
  async (req, res) => {
    const body = req.body as z.infer<typeof actionBodySchema>
    const result = await clashService.resolveClash(String(req.params.id), {
      reason: body.reason,
      performedBy: res.locals.user.id,
    })
    res.json(result)
  },
)

// ── POST /api/clashes/:id/override ─────────────────────────────────────────
clashesRouter.post(
  '/:id/override',
  requireRole(...WRITE_ROLES),
  validateBody(actionBodySchema),
  async (req, res) => {
    const body = req.body as z.infer<typeof actionBodySchema>
    const result = await clashService.overrideClash(String(req.params.id), {
      reason: body.reason,
      performedBy: res.locals.user.id,
    })
    res.json(result)
  },
)
