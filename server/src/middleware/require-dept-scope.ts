import type { Request, Response, NextFunction } from 'express'
import type { AuthenticatedUser } from './require-auth.js'

/**
 * Middleware that auto-injects department_id for dept-coordinator users.
 * Attach this to routes where department scoping is required.
 * 
 * It reads res.locals.user.departmentId and, if the user is a 
 * dept-coordinator, forces the query's department_id to match.
 * For admin/exam-coordinator/hod/other roles, it passes through.
 */
export function requireDeptScope(req: Request, res: Response, next: NextFunction) {
  const user = res.locals.user as AuthenticatedUser | undefined
  if (!user) {
    res.status(401).json({ status: 'invalid_token', error: 'Not authenticated' })
    return
  }
  
  if (user.role === 'dept-coordinator') {
    // Force department filter to the coordinator's own department
    if (user.departmentId) {
      // For query params
      if (req.query && typeof req.query === 'object') {
        (req.query as Record<string, string>).department = user.departmentId
        ;(req.query as Record<string, string>).departmentId = user.departmentId
      }
      // For body
      if (req.body && typeof req.body === 'object') {
        req.body.department_id = user.departmentId
      }
    }
  }
  next()
}
