/**
 * Notifications API — Step 25. Mounted at /api/notifications.
 *
 *   GET  /api/notifications?unread=true        — list (filterable, paginated)
 *   POST /api/notifications/:id/read           — mark one notification read
 *   POST /api/notifications/mark-all-read      — mark every unread one read
 *
 * Notifications are created by the notification service from other features
 * (clash detection, assignments, approvals, publish); this router is the
 * read + read-state surface for the signed-in user only.
 */
import { Router } from 'express'
import { requireAuth } from '../middleware/require-auth.js'
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/notifications.service.js'

export const notificationsRouter = Router()

notificationsRouter.use(requireAuth)

notificationsRouter.get('/', async (req, res) => {
  const q = req.query as Record<string, string | undefined>
  const page = q.page ? Number.parseInt(q.page, 10) : undefined
  const page_size = q.page_size ? Number.parseInt(q.page_size, 10) : undefined
  res.json(
    await listNotifications({
      userId: res.locals.user.id,
      unread: q.unread !== undefined ? q.unread === 'true' : undefined,
      page: page && !Number.isNaN(page) ? page : undefined,
      page_size: page_size && !Number.isNaN(page_size) ? page_size : undefined,
    }),
  )
})

// Registered before /:id/read so the literal path wins.
notificationsRouter.post('/mark-all-read', async (_req, res) => {
  const updated = await markAllNotificationsRead(res.locals.user.id)
  res.json({ status: 'ok', updated })
})

notificationsRouter.post('/:id/read', async (req, res) => {
  res.json({ notification: await markNotificationRead(String(req.params.id), res.locals.user.id) })
})
