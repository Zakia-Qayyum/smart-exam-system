/**
 * Override Requests API — Step 22. Mounted at /api/override-requests.
 *
 *   GET  /api/override-requests?status=pending   — list (filterable, paginated)
 *   POST /api/override-requests                  — raise a request
 *   POST /api/override-requests/:id/approve      — approve (applies effect)
 *   POST /api/override-requests/:id/reject       — reject (remarks mandatory)
 *
 * Approvers are admins + HODs (and dept-coordinators who hold the
 * `approve_overrides` permission, enforced by requirePermission).
 */
import { Router } from 'express'
import { z } from 'zod'
import { validateBody } from '../lib/validate-body.js'
import { requireAuth, requireRole } from '../middleware/require-auth.js'
import { requirePermission } from '../middleware/require-permission.js'
import {
  approveOverrideRequest,
  listOverrideRequests,
  raiseOverrideRequest,
  rejectOverrideRequest,
} from '../services/override-requests.service.js'

export const overrideRequestsRouter = Router()

overrideRequestsRouter.use(requireAuth)

const READ_ROLES = ['admin', 'exam-coordinator', 'dept-coordinator', 'hod'] as const
const RAISE_ROLES = ['admin', 'exam-coordinator', 'dept-coordinator'] as const
const APPROVE_ROLES = ['admin', 'hod', 'dept-coordinator'] as const

const raiseBodySchema = z.object({
  target_type: z.enum(['schedule_entry', 'clash_record']),
  target_id: z.string().min(1),
  reason: z.string().min(1).max(2000),
})

const decideBodySchema = z.object({
  remarks: z.string().max(2000).optional(),
})

const rejectBodySchema = z.object({
  remarks: z.string().min(1).max(2000),
})

// ── GET /api/override-requests ─────────────────────────────────────────────
overrideRequestsRouter.get('/', requireRole(...READ_ROLES), async (req, res) => {
  const q = req.query as Record<string, string | undefined>
  const page = q.page ? Number.parseInt(q.page, 10) : undefined
  const page_size = q.page_size ? Number.parseInt(q.page_size, 10) : undefined
  res.json(
    await listOverrideRequests({
      status: q.status,
      target_type: q.target_type,
      page: page && !Number.isNaN(page) ? page : undefined,
      page_size: page_size && !Number.isNaN(page_size) ? page_size : undefined,
    }),
  )
})

// ── POST /api/override-requests ────────────────────────────────────────────
overrideRequestsRouter.post('/', requireRole(...RAISE_ROLES), validateBody(raiseBodySchema), async (req, res) => {
  const body = req.body as z.infer<typeof raiseBodySchema>
  const request = await raiseOverrideRequest(body, res.locals.user.id)
  res.status(201).json({ request })
})

// ── POST /api/override-requests/:id/approve ────────────────────────────────
overrideRequestsRouter.post(
  '/:id/approve',
  requireRole(...APPROVE_ROLES),
  requirePermission('approve_overrides'),
  validateBody(decideBodySchema),
  async (req, res) => {
    const body = req.body as z.infer<typeof decideBodySchema>
    const request = await approveOverrideRequest(String(req.params.id), {
      performedBy: res.locals.user.id,
      remarks: body.remarks,
    })
    res.json({ request })
  },
)

// ── POST /api/override-requests/:id/reject ─────────────────────────────────
overrideRequestsRouter.post(
  '/:id/reject',
  requireRole(...APPROVE_ROLES),
  requirePermission('approve_overrides'),
  validateBody(rejectBodySchema),
  async (req, res) => {
    const body = req.body as z.infer<typeof rejectBodySchema>
    const request = await rejectOverrideRequest(String(req.params.id), {
      performedBy: res.locals.user.id,
      remarks: body.remarks,
    })
    res.json({ request })
  },
)
