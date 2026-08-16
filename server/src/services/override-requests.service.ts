/**
 * Override Requests API — Step 22.
 *
 * The HOD approval queue backend. Coordinators raise a request against a
 * schedule entry or a clash record; admins / HODs (or dept-coordinators with
 * the `approve_overrides` permission) approve or reject it.
 *
 * Approving applies the underlying effect in the SAME transaction as the
 * status update — for a schedule-entry override the entry is confirmed and its
 * open clashes are marked overridden; for a clash-record override the record
 * is marked overridden. Rejecting requires mandatory remarks, enforced
 * server-side. Every decision is audited and the raiser is notified.
 */
import { prisma } from '../lib/prisma.js'
import { HttpError } from '../lib/http-error.js'
import { dateKey } from '../lib/schedule-utils.js'
import { notificationsWriteService } from './notifications.service.js'

export type OverrideStatus = 'pending' | 'approved' | 'rejected'
export type OverrideTargetType = 'schedule_entry' | 'clash_record'

export const OVERRIDE_STATUSES: OverrideStatus[] = ['pending', 'approved', 'rejected']
export const OVERRIDE_TARGET_TYPES: OverrideTargetType[] = ['schedule_entry', 'clash_record']

export function isOverrideStatus(value: unknown): value is OverrideStatus {
  return typeof value === 'string' && (OVERRIDE_STATUSES as string[]).includes(value)
}

export function isOverrideTargetType(value: unknown): value is OverrideTargetType {
  return typeof value === 'string' && (OVERRIDE_TARGET_TYPES as string[]).includes(value)
}

export interface RaiseOverrideInput {
  target_type: OverrideTargetType
  target_id: string
  reason: string
}

interface RequestRow {
  id: string
  raised_by: string
  approved_by: string | null
  target_type: string
  target_id: string
  reason: string
  status: string
  remarks: string | null
  created_at: Date
  decided_at: Date | null
  raiser: { id: string; name: string; email: string; role: string }
  approver: { id: string; name: string } | null
}

export interface ApiOverrideRequest {
  id: string
  target_type: OverrideTargetType
  target_id: string
  reason: string
  status: OverrideStatus
  remarks: string | null
  created_at: string
  decided_at: string | null
  raised_by: { id: string; name: string; email: string; role: string }
  decided_by: { id: string; name: string } | null
  target: {
    schedule_entry?: {
      id: string
      course_code: string
      course_title: string
      date: string
      time_slot_label: string
      room_name: string
      status: string
    }
    clash_record?: {
      id: string
      type: string
      severity: string
      status: string
      student: { reg_id: string; name: string }
      schedule_entry_ids: string[]
    }
  }
}

const requestInclude = {
  raiser: { select: { id: true, name: true, email: true, role: true } },
  approver: { select: { id: true, name: true } },
} as const

// ── Target enrichment (batched, no N+1) ───────────────────────────────────

interface TargetEnrichment {
  schedule_entry?: ApiOverrideRequest['target']['schedule_entry']
  clash_record?: ApiOverrideRequest['target']['clash_record']
}

async function enrichTargets(rows: RequestRow[]): Promise<TargetEnrichment[]> {
  const entryIds = rows.filter((r) => r.target_type === 'schedule_entry').map((r) => r.target_id)
  const clashIds = rows.filter((r) => r.target_type === 'clash_record').map((r) => r.target_id)

  const [entries, clashes] = await Promise.all([
    entryIds.length
      ? prisma.scheduleEntry.findMany({
          where: { id: { in: entryIds } },
          include: {
            time_slot: { select: { label: true } },
            room: { select: { name: true } },
            section: { select: { course: { select: { course_code: true, title: true } } } },
          },
        })
      : Promise.resolve([]),
    clashIds.length
      ? prisma.clashRecord.findMany({
          where: { id: { in: clashIds } },
          include: { student: { select: { reg_id: true, name: true } } },
        })
      : Promise.resolve([]),
  ])

  const entryById = new Map(entries.map((e) => [e.id, e]))
  const clashById = new Map(clashes.map((c) => [c.id, c]))

  return rows.map((r) => {
    if (r.target_type === 'schedule_entry') {
      const e = entryById.get(r.target_id)
      return {
        schedule_entry: e
          ? {
              id: e.id,
              course_code: e.section.course.course_code,
              course_title: e.section.course.title,
              date: dateKey(e.date),
              time_slot_label: e.time_slot.label,
              room_name: e.room.name,
              status: e.status,
            }
          : undefined,
      }
    }
    const c = clashById.get(r.target_id)
    return {
      clash_record: c
        ? {
            id: c.id,
            type: c.type,
            severity: c.severity,
            status: c.status,
            student: { reg_id: c.student.reg_id, name: c.student.name },
            schedule_entry_ids: c.schedule_entry_ids,
          }
        : undefined,
    }
  })
}

function toApiRequest(row: RequestRow, target: TargetEnrichment): ApiOverrideRequest {
  return {
    id: row.id,
    target_type: row.target_type as OverrideTargetType,
    target_id: row.target_id,
    reason: row.reason,
    status: (isOverrideStatus(row.status) ? row.status : 'pending') as OverrideStatus,
    remarks: row.remarks,
    created_at: row.created_at.toISOString(),
    decided_at: row.decided_at ? row.decided_at.toISOString() : null,
    raised_by: row.raiser,
    decided_by: row.approver,
    target: {
      ...(target.schedule_entry ? { schedule_entry: target.schedule_entry } : {}),
      ...(target.clash_record ? { clash_record: target.clash_record } : {}),
    },
  }
}

// ── Raise / list ───────────────────────────────────────────────────────────

export async function raiseOverrideRequest(input: RaiseOverrideInput, raisedBy: string): Promise<ApiOverrideRequest> {
  if (!isOverrideTargetType(input.target_type)) throw new HttpError(422, 'invalid_target_type', 'target_type must be schedule_entry or clash_record')
  const reason = input.reason.trim()
  if (!reason) throw new HttpError(422, 'reason_required', 'A reason is required to raise an override request')

  if (input.target_type === 'schedule_entry') {
    const entry = await prisma.scheduleEntry.findUnique({ where: { id: input.target_id } })
    if (!entry) throw new HttpError(404, 'entry_not_found', 'Schedule entry not found')
  } else {
    const clash = await prisma.clashRecord.findUnique({ where: { id: input.target_id } })
    if (!clash) throw new HttpError(404, 'clash_not_found', 'Clash record not found')
  }

  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.overrideRequest.create({
      data: {
        raised_by: raisedBy,
        target_type: input.target_type,
        target_id: input.target_id,
        reason,
        status: 'pending',
      },
      include: requestInclude,
    })
    await tx.auditLog.create({
      data: {
        action_type: 'override_request.create',
        target_type: 'override_request',
        target_id: created.id,
        performed_by: raisedBy,
        meta: { target_type: input.target_type, target_id: input.target_id, reason },
      },
    })
    // Notify every active admin + HOD that there is a new request to review.
    const notice = {
      type: 'approval' as const,
      title: 'New override request',
      body: `${created.raiser.name} raised: ${reason}`,
      link: '/approvals',
    }
    await notificationsWriteService.notifyRole('admin', notice, { client: tx })
    await notificationsWriteService.notifyRole('hod', notice, { client: tx })
    return created
  })

  const target = (await enrichTargets([row]))[0]
  return toApiRequest(row, target)
}

export async function listOverrideRequests(query: { status?: string; target_type?: string; page?: number; page_size?: number }) {
  const status = query.status && isOverrideStatus(query.status) ? query.status : undefined
  const targetType = query.target_type && isOverrideTargetType(query.target_type) ? query.target_type : undefined

  const where = {
    ...(status ? { status } : {}),
    ...(targetType ? { target_type: targetType } : {}),
  }

  const page = Math.max(1, query.page ?? 1)
  const page_size = Math.min(200, Math.max(1, query.page_size ?? 50))

  const [rows, total] = await Promise.all([
    prisma.overrideRequest.findMany({
      where,
      include: requestInclude,
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * page_size,
      take: page_size,
    }),
    prisma.overrideRequest.count({ where }),
  ])

  const statusCounts = await prisma.overrideRequest.groupBy({ by: ['status'], _count: true })
  const countOf = (s: string) => statusCounts.find((c) => c.status === s)?._count ?? 0

  const targets = await enrichTargets(rows)
  return {
    requests: rows.map((r, i) => toApiRequest(r, targets[i])),
    total,
    page,
    page_size,
    summary: {
      pending: countOf('pending'),
      approved: countOf('approved'),
      rejected: countOf('rejected'),
    },
  }
}

async function getRequestOrThrow(id: string): Promise<RequestRow> {
  const row = await prisma.overrideRequest.findUnique({ where: { id }, include: requestInclude })
  if (!row) throw new HttpError(404, 'request_not_found', 'Override request not found')
  return row
}

// ── Approve / reject ───────────────────────────────────────────────────────

export async function approveOverrideRequest(id: string, options: { performedBy: string; remarks?: string }): Promise<ApiOverrideRequest> {
  const row = await getRequestOrThrow(id)
  if (row.status !== 'pending') throw new HttpError(409, 'request_not_pending', 'Only pending requests can be approved')

  const remarks = options.remarks?.trim() || null

  const updated = await prisma.$transaction(async (tx) => {
    const request = await tx.overrideRequest.update({
      where: { id },
      data: { status: 'approved', approved_by: options.performedBy, remarks, decided_at: new Date() },
      include: requestInclude,
    })

    // Apply the underlying effect in the same transaction.
    let effect: 'applied' | 'target_missing' = 'target_missing'
    if (request.target_type === 'clash_record') {
      const clash = await tx.clashRecord.findUnique({ where: { id: request.target_id } })
      if (clash) {
        if (clash.status === 'open') {
          await tx.clashRecord.update({
            where: { id: clash.id },
            data: { status: 'overridden', override_reason: request.reason },
          })
        }
        effect = 'applied'
      }
    } else {
      const entry = await tx.scheduleEntry.findUnique({ where: { id: request.target_id } })
      if (entry) {
        await tx.scheduleEntry.update({ where: { id: entry.id }, data: { status: 'scheduled' } })
        await tx.clashRecord.updateMany({
          where: { schedule_entry_ids: { has: entry.id }, status: 'open' },
          data: { status: 'overridden', override_reason: request.reason },
        })
        effect = 'applied'
      }
    }

    await tx.auditLog.create({
      data: {
        action_type: 'override_request.approve',
        target_type: 'override_request',
        target_id: id,
        performed_by: options.performedBy,
        meta: { target_type: request.target_type, target_id: request.target_id, effect, remarks },
      },
    })

    await notificationsWriteService.notifyUser(
      request.raised_by,
      {
        type: 'approval',
        title: 'Override request approved',
        body: `Your override request for ${request.target_type === 'clash_record' ? 'a clash record' : 'a schedule entry'} was approved.`,
        link: '/approvals',
      },
      { client: tx },
    )

    return request
  })

  const target = (await enrichTargets([updated]))[0]
  return toApiRequest(updated, target)
}

export async function rejectOverrideRequest(id: string, options: { performedBy: string; remarks: string }): Promise<ApiOverrideRequest> {
  const row = await getRequestOrThrow(id)
  if (row.status !== 'pending') throw new HttpError(409, 'request_not_pending', 'Only pending requests can be rejected')

  const remarks = options.remarks.trim()
  if (!remarks) throw new HttpError(422, 'remarks_required', 'Remarks are required to reject a request')

  const updated = await prisma.$transaction(async (tx) => {
    const request = await tx.overrideRequest.update({
      where: { id },
      data: { status: 'rejected', approved_by: options.performedBy, remarks, decided_at: new Date() },
      include: requestInclude,
    })

    await tx.auditLog.create({
      data: {
        action_type: 'override_request.reject',
        target_type: 'override_request',
        target_id: id,
        performed_by: options.performedBy,
        meta: { target_type: request.target_type, target_id: request.target_id, remarks },
      },
    })

    await notificationsWriteService.notifyUser(
      request.raised_by,
      {
        type: 'approval',
        title: 'Override request rejected',
        body: `Your override request was rejected — ${remarks}`,
        link: '/approvals',
      },
      { client: tx },
    )

    return request
  })

  const target = (await enrichTargets([updated]))[0]
  return toApiRequest(updated, target)
}

export const overrideRequestsService = {
  raiseOverrideRequest,
  listOverrideRequests,
  approveOverrideRequest,
  rejectOverrideRequest,
}
