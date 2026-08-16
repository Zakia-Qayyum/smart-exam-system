/**
 * Audit Log API — Step 22. Mounted at /api/audit-log.
 *
 * Filterable (action_type, target_type, target_id, performed_by, from/to,
 * free-text search) and paginated, read-only.
 */
import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/require-auth.js'
import { auditLogService } from '../services/audit-log.service.js'

export const auditLogRouter = Router()

auditLogRouter.use(requireAuth)

auditLogRouter.get('/', requireRole('admin', 'exam-coordinator'), async (req, res) => {
  const q = req.query as Record<string, string | undefined>
  const page = q.page ? Number.parseInt(q.page, 10) : undefined
  const page_size = q.page_size ? Number.parseInt(q.page_size, 10) : undefined
  res.json(
    await auditLogService.listAuditLog({
      action_type: q.action_type,
      target_type: q.target_type,
      target_id: q.target_id,
      performed_by: q.performed_by,
      from: q.from,
      to: q.to,
      search: q.search,
      page: page && !Number.isNaN(page) ? page : undefined,
      page_size: page_size && !Number.isNaN(page_size) ? page_size : undefined,
    }),
  )
})
