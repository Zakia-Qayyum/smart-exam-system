/**
 * Admin API — Step 22.
 *
 * Master data CRUD (/departments, /rooms, /time-slots, /exam-cycles), explicit
 * exam-cycle status transitions (/publish, /unlock) and the user permission
 * endpoints (/users/:id/permissions) that the RBAC middleware actually reads.
 *
 * Mounted at /api — paths below are relative to that prefix.
 */
import { Router } from 'express'
import { z } from 'zod'
import { validateBody } from '../lib/validate-body.js'
import { requireAuth, requireRole } from '../middleware/require-auth.js'
import { prisma } from '../lib/prisma.js'
import { HttpError } from '../lib/http-error.js'
import {
  createDepartment,
  createRoom,
  createTimeSlot,
  deleteDepartment,
  deleteRoom,
  deleteTimeSlot,
  listDepartments,
  listRooms,
  listTimeSlots,
  updateDepartment,
  updateRoom,
  updateTimeSlot,
} from '../services/master-data.service.js'
import {
  createCycle,
  deleteCycle,
  listCycles,
  publishCycle,
  unlockCycle,
  updateCycle,
} from '../services/exam-cycles.service.js'
import { PERMISSION_KEYS, effectivePermissions, type PermissionMap } from '../lib/permissions.js'
import { toFrontendRole } from '../lib/roles.js'

export const adminRouter = Router()

adminRouter.use(requireAuth)

const READ_ROLES = ['admin', 'exam-coordinator'] as const
const WRITE_ROLES = ['admin', 'exam-coordinator'] as const

const datePattern = /^\d{4}-\d{2}-\d{2}$/

const departmentSchema = z.object({
  name: z.string().min(1).max(200),
  code: z.string().min(1).max(20),
})

const roomSchema = z.object({
  name: z.string().min(1).max(200),
  capacity: z.number().int().min(1).max(100000),
  department_id: z.string().min(1).nullable().optional(),
})

const timeSlotSchema = z.object({
  label: z.string().min(1).max(100),
  start_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'start_time must be HH:MM'),
  end_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'end_time must be HH:MM'),
  exam_cycle_id: z.string().min(1),
})

const cycleSchema = z.object({
  name: z.string().min(1).max(200),
  term: z.string().min(1).max(100),
  start_date: z.string().regex(datePattern, 'start_date must be YYYY-MM-DD'),
  end_date: z.string().regex(datePattern, 'end_date must be YYYY-MM-DD'),
})

const permissionsSchema = z.object({
  permissions: z
    .object({
      manage_schedule_entries: z.boolean().optional(),
      manage_invigilators: z.boolean().optional(),
      approve_overrides: z.boolean().optional(),
      view_reports: z.boolean().optional(),
    })
    .refine((v) => Object.keys(v).length > 0, { message: 'At least one permission is required' }),
})

function parsePage(value: unknown, max: number): number | undefined {
  if (typeof value !== 'string' || !value) return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? undefined : Math.min(max, Math.max(1, parsed))
}

// ── Departments ────────────────────────────────────────────────────────────

adminRouter.get('/departments', requireRole(...READ_ROLES), async (_req, res) => {
  res.json({ departments: await listDepartments() })
})

adminRouter.post('/departments', requireRole(...WRITE_ROLES), validateBody(departmentSchema), async (req, res) => {
  const body = req.body as z.infer<typeof departmentSchema>
  res.status(201).json({ department: await createDepartment(body, res.locals.user.id) })
})

adminRouter.put('/departments/:id', requireRole(...WRITE_ROLES), validateBody(departmentSchema.partial()), async (req, res) => {
  const body = req.body as Partial<z.infer<typeof departmentSchema>>
  res.json({ department: await updateDepartment(String(req.params.id), body, res.locals.user.id) })
})

adminRouter.delete('/departments/:id', requireRole(...WRITE_ROLES), async (req, res) => {
  res.json(await deleteDepartment(String(req.params.id), res.locals.user.id))
})

// ── Rooms ──────────────────────────────────────────────────────────────────

adminRouter.get('/rooms', requireRole(...READ_ROLES), async (_req, res) => {
  res.json({ rooms: await listRooms() })
})

adminRouter.post('/rooms', requireRole(...WRITE_ROLES), validateBody(roomSchema), async (req, res) => {
  const body = req.body as z.infer<typeof roomSchema>
  res.status(201).json({ room: await createRoom(body, res.locals.user.id) })
})

adminRouter.put('/rooms/:id', requireRole(...WRITE_ROLES), validateBody(roomSchema.partial()), async (req, res) => {
  const body = req.body as Partial<z.infer<typeof roomSchema>>
  res.json({ room: await updateRoom(String(req.params.id), body, res.locals.user.id) })
})

adminRouter.delete('/rooms/:id', requireRole(...WRITE_ROLES), async (req, res) => {
  res.json(await deleteRoom(String(req.params.id), res.locals.user.id))
})

// ── Time slots ─────────────────────────────────────────────────────────────

adminRouter.get('/time-slots', requireRole(...READ_ROLES), async (req, res) => {
  const cycle = typeof req.query.exam_cycle_id === 'string' && req.query.exam_cycle_id ? req.query.exam_cycle_id : undefined
  res.json({ time_slots: await listTimeSlots(cycle) })
})

adminRouter.post('/time-slots', requireRole(...WRITE_ROLES), validateBody(timeSlotSchema), async (req, res) => {
  const body = req.body as z.infer<typeof timeSlotSchema>
  res.status(201).json({ time_slot: await createTimeSlot(body, res.locals.user.id) })
})

adminRouter.put('/time-slots/:id', requireRole(...WRITE_ROLES), validateBody(timeSlotSchema.partial()), async (req, res) => {
  const body = req.body as Partial<z.infer<typeof timeSlotSchema>>
  res.json({ time_slot: await updateTimeSlot(String(req.params.id), body, res.locals.user.id) })
})

adminRouter.delete('/time-slots/:id', requireRole(...WRITE_ROLES), async (req, res) => {
  res.json(await deleteTimeSlot(String(req.params.id), res.locals.user.id))
})

// ── Exam cycles ────────────────────────────────────────────────────────────

adminRouter.get('/exam-cycles', requireRole(...READ_ROLES), async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined
  res.json(await listCycles({ status, page: parsePage(req.query.page, 1_000_000), page_size: parsePage(req.query.page_size, 200) }))
})

adminRouter.post('/exam-cycles', requireRole(...WRITE_ROLES), validateBody(cycleSchema), async (req, res) => {
  const body = req.body as z.infer<typeof cycleSchema>
  res.status(201).json({ cycle: await createCycle(body, res.locals.user.id) })
})

adminRouter.put('/exam-cycles/:id', requireRole(...WRITE_ROLES), validateBody(cycleSchema.partial()), async (req, res) => {
  const body = req.body as Partial<z.infer<typeof cycleSchema>>
  res.json({ cycle: await updateCycle(String(req.params.id), body, res.locals.user.id) })
})

adminRouter.delete('/exam-cycles/:id', requireRole(...WRITE_ROLES), async (req, res) => {
  res.json(await deleteCycle(String(req.params.id), res.locals.user.id))
})

// Explicit status transitions — the only way a cycle leaves draft / published.
adminRouter.post('/exam-cycles/:id/publish', requireRole(...WRITE_ROLES), async (req, res) => {
  res.json({ cycle: await publishCycle(String(req.params.id), res.locals.user.id) })
})

adminRouter.post('/exam-cycles/:id/unlock', requireRole(...WRITE_ROLES), async (req, res) => {
  res.json({ cycle: await unlockCycle(String(req.params.id), res.locals.user.id) })
})

// ── User permissions (read by requirePermission on every request) ──────────

adminRouter.get('/users/:id/permissions', requireRole(...READ_ROLES), async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: String(req.params.id) } })
  if (!user) throw new HttpError(404, 'user_not_found', 'User not found')
  res.json({
    user: { id: user.id, name: user.name, email: user.email, role: toFrontendRole(user.role) ?? user.role },
    permissions: effectivePermissions(toFrontendRole(user.role) ?? user.role, user.permissions),
  })
})

adminRouter.put('/users/:id/permissions', requireRole(...WRITE_ROLES), validateBody(permissionsSchema), async (req, res) => {
  const id = String(req.params.id)
  const body = req.body as z.infer<typeof permissionsSchema>
  const user = await prisma.user.findUnique({ where: { id } })
  if (!user) throw new HttpError(404, 'user_not_found', 'User not found')

  // Merge the submitted toggles over any stored map, keeping only known keys.
  const stored = effectivePermissions(user.role, user.permissions)
  const merged: PermissionMap = { ...stored }
  for (const key of PERMISSION_KEYS) {
    if (body.permissions[key] === true) merged[key] = true
    else if (body.permissions[key] === false) merged[key] = false
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { permissions: merged } })
    await tx.auditLog.create({
      data: {
        action_type: 'user.permissions_update',
        target_type: 'user',
        target_id: id,
        performed_by: res.locals.user.id,
        meta: { permissions: merged, updated_by: res.locals.user.id },
      },
    })
  })

  res.json({
    user: { id: user.id, name: user.name, email: user.email, role: toFrontendRole(user.role) ?? user.role },
    permissions: effectivePermissions(toFrontendRole(user.role) ?? user.role, merged),
  })
})

// Permission-manager convenience read: every dept-coordinator account + map.
adminRouter.get('/permissions/matrix', requireRole(...WRITE_ROLES), async (_req, res) => {
  const rows = await prisma.user.findMany({
    where: { role: 'dept-coordinator' },
    select: { id: true, name: true, email: true, role: true, permissions: true, department: { select: { code: true, name: true } } },
    orderBy: { name: 'asc' },
  })
  res.json({
    accounts: rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      role: r.role,
      department_code: r.department?.code ?? null,
      department_name: r.department?.name ?? null,
      permissions: effectivePermissions(toFrontendRole(r.role) ?? r.role, r.permissions),
    })),
  })
})
