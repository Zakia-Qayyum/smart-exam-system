/**
 * Notifications service — Step 25.
 *
 * Central home for every notification a feature produces. Services no longer
 * write `prisma.notification.*` ad hoc — clash detection, invigilator
 * assignments, override requests and cycle publish all go through
 * `notify()` / the granular helpers here, so recipients, content and the
 * delivery path stay consistent.
 *
 *   notify({ userId | role + departmentScope, type, title, body, link })
 *
 * `type` mirrors the frontend's Step 24 mock kinds exactly:
 *   'clash' | 'published' | 'assignment' | 'approval' | 'info'
 *
 * Every insert also fans out through a push hook. The default handler is a
 * stub; a WebSocket/SSE broadcaster can register via `setPushHandler`
 * without any caller changing.
 */
import { prisma } from '../lib/prisma.js'
import { logger } from '../lib/logger.js'
import { HttpError } from '../lib/http-error.js'

export type NotificationType = 'clash' | 'published' | 'assignment' | 'approval' | 'info'

export const NOTIFICATION_TYPES: readonly NotificationType[] = ['clash', 'published', 'assignment', 'approval', 'info']

export function isNotificationType(value: unknown): value is NotificationType {
  return typeof value === 'string' && (NOTIFICATION_TYPES as readonly string[]).includes(value)
}

export interface NotifyInput {
  type: NotificationType
  title: string
  body?: string | null
  link?: string | null
}

export interface NotifyOptions {
  /** Notification target: exactly one of userId or role must be set. */
  userId?: string
  role?: string
  /** Department id to scope a role fan-out (used with `role`). */
  departmentScope?: string
  type: NotificationType
  title: string
  body?: string | null
  link?: string | null
  /** Transaction client to write within — defaults to `prisma`. */
  client?: NotificationClient
}

/** A client able to write notifications: `prisma` or a `$transaction` tx. */
export type NotificationClient = Pick<typeof prisma, 'notification'>

export interface ApiNotification {
  id: string
  type: NotificationType
  title: string
  body: string | null
  link: string | null
  read: boolean
  read_at: string | null
  created_at: string
}

// ── Push hook (real-time delivery stub) ────────────────────────────────────

export interface PushPayload {
  userId: string
  type: NotificationType
  title: string
  body: string | null
  link: string | null
}

let pushHandler: ((payloads: PushPayload[]) => void) | null = null

/**
 * Register the real-time broadcaster (WebSocket/SSE). Until one is wired up
 * the stub below logs the fan-out and drops it — persistence still works.
 */
export function setPushHandler(handler: ((payloads: PushPayload[]) => void) | null): void {
  pushHandler = handler
}

function emitPush(payloads: PushPayload[]): void {
  if (payloads.length === 0) return
  if (pushHandler) {
    pushHandler(payloads)
    return
  }
  logger.debug({ count: payloads.length }, 'push hook stub: notifications persisted, no realtime transport configured')
}

const toPush = (userId: string, input: NotifyInput): PushPayload => ({
  userId,
  type: input.type,
  title: input.title,
  body: input.body ?? null,
  link: input.link ?? null,
})

const toData = (input: NotifyInput) => ({
  type: input.type,
  title: input.title,
  body: input.body ?? null,
  link: input.link ?? null,
})

// ── Write path ─────────────────────────────────────────────────────────────

function notifyUser(userId: string, input: NotifyInput, options: { client?: NotificationClient } = {}): Promise<void> {
  const db = options.client ?? prisma
  return db.notification.create({ data: { user_id: userId, ...toData(input) } }).then(() => {
    emitPush([toPush(userId, input)])
  })
}

async function notifyUsers(userIds: string[], input: NotifyInput, options: { client?: NotificationClient } = {}): Promise<number> {
  const unique = [...new Set(userIds.filter((id) => id))]
  if (unique.length === 0) return 0
  const db = options.client ?? prisma
  await db.notification.createMany({
    data: unique.map((user_id) => ({ user_id, ...toData(input) })),
  })
  emitPush(unique.map((userId) => toPush(userId, input)))
  return unique.length
}

/**
 * Fan out to every active account of a role, optionally restricted to one
 * department. Read targeting uses the default client (data exists before the
 * caller's transaction); the inserts themselves honour `options.client`.
 */
async function notifyRole(
  role: string,
  input: NotifyInput,
  options: { departmentScope?: string; client?: NotificationClient } = {},
): Promise<number> {
  const users = await prisma.user.findMany({
    where: {
      status: 'active',
      role,
      ...(options.departmentScope ? { department_id: options.departmentScope } : {}),
    },
    select: { id: true },
  })
  return notifyUsers(
    users.map((u) => u.id),
    input,
    options,
  )
}

/**
 * Unified entry point matching the spec signature:
 *   notify({ userId | role + departmentScope, type, title, body, link })
 */
export async function notify(options: NotifyOptions): Promise<number> {
  const input: NotifyInput = {
    type: options.type,
    title: options.title,
    body: options.body,
    link: options.link,
  }
  const clientOpts = { client: options.client }

  if (options.userId) {
    await notifyUser(options.userId, input, clientOpts)
    return 1
  }
  if (options.role) {
    return notifyRole(options.role, input, {
      departmentScope: options.departmentScope,
      ...clientOpts,
    })
  }
  throw new Error('notify() requires either userId or role')
}

export const notificationsWriteService = {
  notify,
  notifyUser,
  notifyUsers,
  notifyRole,
}

// ── Read path ──────────────────────────────────────────────────────────────

function toApiNotification(n: {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  read_at: Date | null
  created_at: Date
}): ApiNotification {
  return {
    id: n.id,
    type: isNotificationType(n.type) ? n.type : 'info',
    title: n.title,
    body: n.body,
    link: n.link,
    read: n.read_at !== null,
    read_at: n.read_at ? n.read_at.toISOString() : null,
    created_at: n.created_at.toISOString(),
  }
}

export async function listNotifications(query: {
  userId: string
  unread?: boolean
  page?: number
  page_size?: number
}) {
  const where: Record<string, unknown> = { user_id: query.userId }
  if (query.unread === true) where.read_at = null

  const page = Math.max(1, query.page ?? 1)
  const page_size = Math.min(200, Math.max(1, query.page_size ?? 50))

  const [rows, total, unread_count] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * page_size,
      take: page_size,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { user_id: query.userId, read_at: null } }),
  ])

  return {
    notifications: rows.map(toApiNotification),
    total,
    unread_count,
    page,
    page_size,
  }
}

export async function markNotificationRead(id: string, userId: string): Promise<ApiNotification> {
  const existing = await prisma.notification.findFirst({ where: { id, user_id: userId } })
  if (!existing) throw new HttpError(404, 'notification_not_found', 'Notification not found')
  const updated = await prisma.notification.update({
    where: { id },
    data: { read_at: existing.read_at ?? new Date() },
  })
  return toApiNotification(updated)
}

export async function markAllNotificationsRead(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { user_id: userId, read_at: null },
    data: { read_at: new Date() },
  })
  return result.count
}

export const notificationsService = {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
}
