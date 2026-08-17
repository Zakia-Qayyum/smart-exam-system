import { ApiError, apiFetch } from '@/services/api-client'
import type { ApiNotification, ApiNotificationList } from '@/lib/types'

function throwFor(status: number, body: unknown, fallback: string): never {
  throw new ApiError(status, body, fallback)
}

function toQuery(params: object): string {
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') qs.set(key, String(value))
  }
  const s = qs.toString()
  return s ? `?${s}` : ''
}

/**
 * The user's notification feed (Step 25 API). Notifications are created
 * server-side by other features (clash detection, invigilator assignments,
 * override decisions, cycle publish) and scoped to the signed-in account —
 * this service is the read + read-state surface for that feed.
 */
export async function fetchNotifications(params?: {
  unread?: boolean
  page?: number
  page_size?: number
}): Promise<ApiNotificationList> {
  const { status, body } = await apiFetch<ApiNotificationList>(
    `/api/notifications${toQuery(params ?? {})}`,
    { auth: true },
  )
  if (status !== 200) throwFor(status, body, 'Unable to load notifications')
  return body
}

export async function markNotificationRead(id: string): Promise<ApiNotification> {
  const { status, body } = await apiFetch<{ notification: ApiNotification }>(
    `/api/notifications/${id}/read`,
    { method: 'POST', body: {}, auth: true },
  )
  if (status !== 200) throwFor(status, body, 'Unable to update the notification')
  return body.notification
}

export async function markAllNotificationsRead(): Promise<{ status: string; updated: number }> {
  const { status, body } = await apiFetch<{ status: string; updated: number }>(
    '/api/notifications/mark-all-read',
    { method: 'POST', body: {}, auth: true },
  )
  if (status !== 200) throwFor(status, body, 'Unable to update notifications')
  return body
}
