import { Router, type RequestHandler, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { validateBody } from '../lib/validate-body.js'
import { requireAuth, requireRole } from '../middleware/require-auth.js'
import { schedulingService } from '../services/scheduling.service.js'
import { clashService } from '../services/clash-detection.service.js'
import { resolveExamCycle } from '../lib/schedule-utils.js'

export const schedulingRouter = Router()

// Every scheduling endpoint requires an authenticated session.
schedulingRouter.use(requireAuth)

const READ_ROLES = ['admin', 'exam-coordinator', 'dept-coordinator', 'hod'] as const
const WRITE_ROLES = ['admin', 'exam-coordinator'] as const

const datePattern = /^\d{4}-\d{2}-\d{2}$/

const entryBodySchema = z
  .object({
    exam_cycle_id: z.string().min(1).optional(),
    section_id: z.string().min(1),
    date: z.string().regex(datePattern, 'date must be YYYY-MM-DD'),
    time_slot_id: z.string().min(1),
    room_id: z.string().min(1),
    force: z.boolean().optional(),
    override_reason: z.string().min(1).optional(),
  })
  .refine((v) => !v.force || (v.force && !!v.override_reason), {
    message: 'override_reason is required when force is true',
    path: ['override_reason'],
  })

const generateBodySchema = z.object({
  exam_cycle_id: z.string().min(1).optional(),
})

const clashCheckSchema = z.object({
  exam_cycle_id: z.string().min(1).optional(),
  section_id: z.string().min(1),
  date: z.string().regex(datePattern, 'date must be YYYY-MM-DD'),
  time_slot_id: z.string().min(1),
  existing_entry_id: z.string().min(1).optional(),
})

// ── POST /clash-check ───────────────────────────────────────────────────────
// Synchronous, read-only clash check for the manual-entry screen. Uses the
// same detection path as a real save so the banner matches the save result.
schedulingRouter.post(
  '/clash-check',
  requireRole(...WRITE_ROLES),
  validateBody(clashCheckSchema),
  async (req, res) => {
    const body = req.body as z.infer<typeof clashCheckSchema>
    const cycle = await resolveExamCycle(body.exam_cycle_id)
    const result = await clashService.detectCandidateClashes({
      cycleId: cycle.id,
      sectionId: body.section_id,
      date: body.date,
      timeSlotId: body.time_slot_id,
      existingId: body.existing_entry_id,
    })
    res.json(result)
  },
)

// ── POST /schedule-entries ─────────────────────────────────────────────────
schedulingRouter.post(
  '/schedule-entries',
  requireRole(...WRITE_ROLES),
  validateBody(entryBodySchema),
  async (req, res) => {
    const body = req.body as z.infer<typeof entryBodySchema>
    const result = await schedulingService.createEntry(body, {
      createdBy: res.locals.user.id,
      force: body.force,
      override_reason: body.override_reason,
    })
    res.status(201).json(result)
  },
)

// ── PUT /schedule-entries/:id ──────────────────────────────────────────────
schedulingRouter.put(
  '/schedule-entries/:id',
  requireRole(...WRITE_ROLES),
  validateBody(entryBodySchema),
  async (req, res) => {
    const body = req.body as z.infer<typeof entryBodySchema>
    const result = await schedulingService.updateEntry(String(req.params.id), body, {
      createdBy: res.locals.user.id,
      force: body.force,
      override_reason: body.override_reason,
    })
    res.json(result)
  },
)

// ── DELETE /schedule-entries/:id ───────────────────────────────────────────
schedulingRouter.delete(
  '/schedule-entries/:id',
  requireRole(...WRITE_ROLES),
  async (req, res) => {
    await schedulingService.deleteEntry(String(req.params.id), res.locals.user.id)
    res.json({ status: 'ok' })
  },
)

// ── GET /schedule-entries ──────────────────────────────────────────────────
schedulingRouter.get(
  '/schedule-entries',
  requireRole(...READ_ROLES),
  (async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = req.query as Record<string, string | undefined>
      const result = await schedulingService.listEntries({
        exam_cycle_id: q.cycle || undefined,
        department_id: q.department || undefined,
        course_code: q.course || undefined,
        status: q.status === 'scheduled' || q.status === 'needs_review' ? q.status : undefined,
        from: q.from || undefined,
        to: q.to || undefined,
        page: q.page ? Number.parseInt(q.page, 10) : undefined,
        page_size: q.page_size ? Number.parseInt(q.page_size, 10) : undefined,
      })
      res.json(result)
    } catch (err) {
      next(err)
    }
  }) as RequestHandler,
)

// ── GET /schedule-entries/calendar-summary ─────────────────────────────────
schedulingRouter.get(
  '/schedule-entries/calendar-summary',
  requireRole(...READ_ROLES),
  async (req, res) => {
    const cycle = typeof req.query.cycle === 'string' && req.query.cycle ? req.query.cycle : undefined
    res.json(await schedulingService.calendarSummary(cycle))
  },
)

// ── POST /schedule/generate ────────────────────────────────────────────────
schedulingRouter.post(
  '/generate',
  requireRole(...WRITE_ROLES),
  validateBody(generateBodySchema),
  async (req, res) => {
    const body = req.body as z.infer<typeof generateBodySchema>
    const job = schedulingService.startGenerate({ examCycleId: body.exam_cycle_id, createdBy: res.locals.user.id })
    res.status(202).json({ jobId: job.id, status: job.status })
  },
)

// ── GET /schedule/generate/:jobId/status ───────────────────────────────────
schedulingRouter.get(
  '/generate/:jobId/status',
  requireRole(...WRITE_ROLES),
  async (req, res) => {
    const job = schedulingService.getGenerateJob(String(req.params.jobId))
    if (!job) {
      res.status(404).json({ status: 'not_found', error: 'Generation job not found' })
      return
    }
    res.json(job)
  },
)
