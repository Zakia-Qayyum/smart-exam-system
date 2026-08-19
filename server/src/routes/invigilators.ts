import { Router, type Request, type RequestHandler, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { validateBody } from '../lib/validate-body.js'
import { requireAuth, requireRole } from '../middleware/require-auth.js'
import { requireDeptScope } from '../middleware/require-dept-scope.js'
import { requirePermission } from '../middleware/require-permission.js'
import {
  commitBulkImport,
  createInvigilator,
  getInvigilator,
  listInvigilators,
  previewBulkImport,
  updateInvigilator,
  type InvigilatorAvailability,
} from '../services/invigilators.service.js'

export const invigilatorsRouter = Router()

// Every invigilator endpoint requires an authenticated session.
invigilatorsRouter.use(requireAuth)

const READ_ROLES = ['admin', 'exam-coordinator', 'dept-coordinator', 'hod'] as const
const WRITE_ROLES = ['admin', 'exam-coordinator', 'dept-coordinator'] as const

const emailPattern = /^\S+@\S+\.\S+$/
const AVAILABILITY = new Set<InvigilatorAvailability>(['Available', 'Busy', 'On leave'])

const createBodySchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().min(1).regex(emailPattern, 'email must be a valid address'),
  department_id: z.string().min(1),
  max_assignments_per_cycle: z.number().int().min(1).max(100).optional(),
  specialization_tags: z.array(z.string().min(1).max(100)).max(50).optional(),
})

const updateBodySchema = createBodySchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' })

const bulkBodySchema = z.object({
  text: z.string().min(1).max(1_000_000),
})

function parseIntQuery(value: unknown): number | undefined {
  if (typeof value !== 'string' || !value) return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? undefined : parsed
}

// ── GET / ──────────────────────────────────────────────────────────────────
// Searchable/filterable directory. `assigned_count` and `availability` are
// computed against the current exam cycle.
invigilatorsRouter.get(
  '/',
  requireRole(...READ_ROLES),
  requireDeptScope,
  (async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = req.query as Record<string, string | undefined>
      const availability = q.availability && AVAILABILITY.has(q.availability as InvigilatorAvailability)
        ? (q.availability as InvigilatorAvailability)
        : undefined
      res.json(
        await listInvigilators({
          cycleId: q.cycle || undefined,
          search: q.search || undefined,
          departmentId: q.department || undefined,
          availability,
          tag: q.tag || undefined,
          page: parseIntQuery(q.page),
          pageSize: parseIntQuery(q.page_size),
        }),
      )
    } catch (err) {
      next(err)
    }
  }) as RequestHandler,
)

// ── POST / ─────────────────────────────────────────────────────────────────
// Email-first: if the account already exists it is granted the invigilator
// role instead of duplicating the user.
invigilatorsRouter.post(
  '/',
  requireRole(...WRITE_ROLES),
  requirePermission('manage_invigilators'),
  validateBody(createBodySchema),
  async (req, res) => {
    const body = req.body as z.infer<typeof createBodySchema>
    const invigilator = await createInvigilator(body, res.locals.user.id)
    res.status(201).json(invigilator)
  },
)

// ── POST /bulk-import/preview ──────────────────────────────────────────────
// Parses + validates the CSV server-side and returns per-row results without
// writing anything to the database.
invigilatorsRouter.post(
  '/bulk-import/preview',
  requireRole(...WRITE_ROLES),
  requirePermission('manage_invigilators'),
  validateBody(bulkBodySchema),
  async (req, res) => {
    const body = req.body as z.infer<typeof bulkBodySchema>
    res.json(await previewBulkImport(body.text))
  },
)

// ── POST /bulk-import/commit ───────────────────────────────────────────────
// Re-validates the CSV, then imports valid rows with email-first idempotency:
// existing accounts get the invigilator role, new accounts are created with a
// forced password change. Returns { imported, skippedDuplicates, failed }.
invigilatorsRouter.post(
  '/bulk-import/commit',
  requireRole(...WRITE_ROLES),
  requirePermission('manage_invigilators'),
  validateBody(bulkBodySchema),
  async (req, res) => {
    const body = req.body as z.infer<typeof bulkBodySchema>
    const result = await commitBulkImport(body.text, res.locals.user.id)
    res.json(result)
  },
)

// ── GET /:id ───────────────────────────────────────────────────────────────
invigilatorsRouter.get(
  '/:id',
  requireRole(...READ_ROLES),
  async (req, res) => {
    const cycle = typeof req.query.cycle === 'string' && req.query.cycle ? req.query.cycle : undefined
    res.json(await getInvigilator(String(req.params.id), cycle))
  },
)

// ── PUT /:id ───────────────────────────────────────────────────────────────
invigilatorsRouter.put(
  '/:id',
  requireRole(...WRITE_ROLES),
  requirePermission('manage_invigilators'),
  validateBody(updateBodySchema),
  async (req, res) => {
    const body = req.body as z.infer<typeof updateBodySchema>
    const invigilator = await updateInvigilator(String(req.params.id), body, res.locals.user.id)
    res.json(invigilator)
  },
)
