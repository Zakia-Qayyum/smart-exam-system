import type { NextFunction, Request, Response } from 'express'
import { verifyAccessToken } from '../lib/jwt.js'
import type { FrontendRole } from '../lib/roles.js'

export interface AuthenticatedUser {
  id: string
  email: string
  name: string
  role: FrontendRole
  departmentId: string | null
  mustChangePassword: boolean
}

/**
 * Endpoints a user can still reach while their password change is pending.
 * Everything else responds 403 { status: 'password_change_required' } until
 * the access token is re-issued without the mustChangePassword claim.
 */
const PASSWORD_CHANGE_ALLOWED = new Set([
  '/api/auth/change-password',
  '/api/auth/logout',
  '/api/auth/refresh',
  '/api/auth/me',
])

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined
  if (!token) {
    res.status(401).json({ status: 'invalid_token', error: 'Missing bearer token' })
    return
  }

  const claims = await verifyAccessToken(token)
  if (!claims) {
    res.status(401).json({ status: 'invalid_token', error: 'Invalid or expired token' })
    return
  }

  const path = req.originalUrl.split('?')[0]
  if (claims.mustChangePassword && !PASSWORD_CHANGE_ALLOWED.has(path)) {
    res.status(403).json({ status: 'password_change_required', error: 'Password change required before continuing' })
    return
  }

  res.locals.user = {
    id: claims.sub,
    email: claims.email,
    name: claims.name,
    role: claims.role,
    departmentId: claims.departmentId,
    mustChangePassword: claims.mustChangePassword,
  } satisfies AuthenticatedUser

  next()
}

export function requireRole(...roles: FrontendRole[]) {
  return (_req: Request, res: Response, next: NextFunction) => {
    const user = res.locals.user as AuthenticatedUser | undefined
    if (!user) {
      res.status(401).json({ status: 'invalid_token', error: 'Not authenticated' })
      return
    }
    if (!roles.includes(user.role)) {
      res.status(403).json({ status: 'forbidden', error: 'Insufficient role' })
      return
    }
    next()
  }
}

/**
 * Ownership guard. `resolveOwnerId` maps the request to the user id that owns
 * the target resource:
 *   - returns `undefined` when the resource does not exist → 404
 *   - returns any other id when the requester is not the owner → 403
 *   - returns the requester's own id → allowed
 */
export function requireOwnership(
  resolveOwnerId: (req: Request, user: AuthenticatedUser) => Promise<string | undefined>,
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = res.locals.user as AuthenticatedUser | undefined
    if (!user) {
      res.status(401).json({ status: 'invalid_token', error: 'Not authenticated' })
      return
    }
    const ownerId = await resolveOwnerId(req, user)
    if (ownerId === undefined) {
      res.status(404).json({ status: 'not_found', error: 'Resource not found' })
      return
    }
    if (ownerId !== user.id) {
      res.status(403).json({ status: 'forbidden', error: 'Not your resource' })
      return
    }
    next()
  }
}
