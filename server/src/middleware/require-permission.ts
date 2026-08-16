/**
 * requirePermission — Step 22.
 *
 * Reads the user's stored `permissions` JSON from the database on every
 * request, so a Permission Manager toggle takes effect immediately without a
 * re-login. The toggles restrict department coordinators specifically:
 *   - admin / exam-coordinator hold every permission implicitly;
 *   - dept-coordinator must have each requested key enabled, else 403;
 *   - any other role is unaffected here — its access is already governed by
 *     the role gate that runs before this middleware.
 */
import type { NextFunction, Request, Response } from 'express'
import { prisma } from '../lib/prisma.js'
import { FULL_ACCESS_ROLES, hasPermission, type PermissionKey } from '../lib/permissions.js'
import type { AuthenticatedUser } from './require-auth.js'

export function requirePermission(...keys: PermissionKey[]) {
  return async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = res.locals.user as AuthenticatedUser | undefined
    if (!user) {
      res.status(401).json({ status: 'invalid_token', error: 'Not authenticated' })
      return
    }
    if ((FULL_ACCESS_ROLES as readonly string[]).includes(user.role)) {
      next()
      return
    }
    if (user.role !== 'dept-coordinator') {
      next()
      return
    }

    const record = await prisma.user.findUnique({
      where: { id: user.id },
      select: { permissions: true },
    })
    const granted = keys.every((key) => hasPermission(record?.permissions, key))
    if (!granted) {
      res.status(403).json({
        status: 'insufficient_permissions',
        error: 'You do not have the permission required for this action',
      })
      return
    }
    next()
  }
}
