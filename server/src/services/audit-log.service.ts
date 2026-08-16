/**
 * Audit Log API — Step 22.
 *
 * Filterable, paginated read of the audit trail. Read-only — audit rows are
 * only ever written by the mutations themselves.
 */
import { prisma } from '../lib/prisma.js'
import { dateFromKey } from '../lib/schedule-utils.js'

export interface AuditLogQuery {
  action_type?: string
  target_type?: string
  target_id?: string
  performed_by?: string
  from?: string
  to?: string
  search?: string
  page?: number
  page_size?: number
}

export interface ApiAuditLogEntry {
  id: string
  action_type: string
  target_type: string
  target_id: string
  performed_by: { id: string; name: string; email: string; role: string } | null
  timestamp: string
  meta: Record<string, unknown> | null
}

export async function listAuditLog(query: AuditLogQuery) {
  const where: Record<string, unknown> = {}

  if (query.action_type) where.action_type = { contains: query.action_type }
  if (query.target_type) where.target_type = query.target_type
  if (query.target_id) where.target_id = { contains: query.target_id }
  if (query.performed_by) where.performed_by = query.performed_by

  const timeFilters: { gte?: Date; lte?: Date } = {}
  if (query.from) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(query.from)) timeFilters.gte = dateFromKey(query.from)
    else timeFilters.gte = new Date(query.from)
  }
  if (query.to) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(query.to)) {
      const end = dateFromKey(query.to)
      end.setUTCDate(end.getUTCDate() + 1)
      timeFilters.lte = end
    } else {
      timeFilters.lte = new Date(query.to)
    }
  }
  if (Object.keys(timeFilters).length > 0) where.timestamp = timeFilters

  const search = query.search?.trim()
  if (search) {
    where.OR = [
      { action_type: { contains: search } },
      { target_type: { contains: search } },
      { target_id: { contains: search } },
    ]
  }

  const page = Math.max(1, query.page ?? 1)
  const page_size = Math.min(200, Math.max(1, query.page_size ?? 50))

  const [rows, total, actionCounts] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { performer: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { timestamp: 'desc' },
      skip: (page - 1) * page_size,
      take: page_size,
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({ by: ['action_type'], _count: true, orderBy: { _count: { action_type: 'desc' } }, take: 25 }),
  ])

  const entries: ApiAuditLogEntry[] = rows.map((r) => ({
    id: r.id,
    action_type: r.action_type,
    target_type: r.target_type,
    target_id: r.target_id,
    performed_by: r.performer,
    timestamp: r.timestamp.toISOString(),
    meta: (r.meta as Record<string, unknown> | null) ?? null,
  }))

  return {
    entries,
    total,
    page,
    page_size,
    summary: {
      actions: actionCounts.map((a) => ({ action_type: a.action_type, count: a._count })),
    },
  }
}

export const auditLogService = { listAuditLog }
