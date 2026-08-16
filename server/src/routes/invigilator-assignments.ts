/**
 * Invigilator Assignment API — Step 19.
 *
 * Mounted at /api/invigilator-assignments. The matrix read endpoint lives on
 * the scheduling router so the URL matches the spec:
 *   GET /api/scheduling/schedule-entries/:examCycleId/unassigned
 */
import { Router } from 'express'
import { z } from 'zod'
import { validateBody } from '../lib/validate-body.js'
import { requireAuth, requireRole } from '../middleware/require-auth.js'
import {
  createAssignment,
  deleteAssignment,
  proposeAutoAssign,
  commitAutoAssign,
} from '../services/invigilator-assignments.service.js'

export const invigilatorAssignmentsRouter = Router()

invigilatorAssignmentsRouter.use(requireAuth)

const WRITE_ROLES = ['admin', 'exam-coordinator'] as const

const assignmentStatusSchema = z.enum(['assigned', 'confirmed', 'declined'])

const createBodySchema = z.object({
  schedule_entry_id: z.string().min(1),
  invigilator_id: z.string().min(1),
  status: assignmentStatusSchema.optional(),
})

const autoAssignBodySchema = z.object({
  exam_cycle_id: z.string().min(1).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
    .optional(),
})

const commitBodySchema = z.object({
  proposals: z
    .array(
      z.object({
        schedule_entry_id: z.string().min(1),
        invigilator_id: z.string().min(1),
      }),
    )
    .max(100)
    .min(1),
})

// ── POST /api/invigilator-assignments ──────────────────────────────────────
invigilatorAssignmentsRouter.post(
  '/',
  requireRole(...WRITE_ROLES),
  validateBody(createBodySchema),
  async (req, res) => {
    const body = req.body as z.infer<typeof createBodySchema>
    const assignment = await createAssignment(body, res.locals.user.id)
    res.status(201).json({ assignment })
  },
)

// ── DELETE /api/invigilator-assignments/:id ────────────────────────────────
invigilatorAssignmentsRouter.delete(
  '/:id',
  requireRole(...WRITE_ROLES),
  async (req, res) => {
    const assignment = await deleteAssignment(String(req.params.id), res.locals.user.id)
    res.json({ status: 'ok', assignment })
  },
)

// ── POST /api/invigilator-assignments/auto-assign ──────────────────────────
// Proposes assignments without writing anything — the client reviews the plan
// and commits the accepted subset via .../auto-assign/commit.
invigilatorAssignmentsRouter.post(
  '/auto-assign',
  requireRole(...WRITE_ROLES),
  validateBody(autoAssignBodySchema),
  async (req, res) => {
    const body = req.body as z.infer<typeof autoAssignBodySchema>
    const plan = await proposeAutoAssign(body.exam_cycle_id, body.date)
    res.json(plan)
  },
)

// ── POST /api/invigilator-assignments/auto-assign/commit ───────────────────
invigilatorAssignmentsRouter.post(
  '/auto-assign/commit',
  requireRole(...WRITE_ROLES),
  validateBody(commitBodySchema),
  async (req, res) => {
    const body = req.body as z.infer<typeof commitBodySchema>
    const result = await commitAutoAssign(body.proposals, res.locals.user.id)
    res.status(201).json(result)
  },
)
