import type { NextFunction, Request, Response } from 'express'
import { env } from '../config/env.js'

/**
 * Sliding-window per-IP rate limiter, in-memory. Applied to the whole
 * /api/auth router (default 20 req / 15 min per IP).
 */
export function ipRateLimit(options?: { max?: number; windowMs?: number }) {
  const max = options?.max ?? env.RATE_LIMIT_MAX
  const windowMs = options?.windowMs ?? env.RATE_LIMIT_WINDOW_MS
  const hits = new Map<string, number[]>()

  const prune = (key: string, now: number) => {
    const list = hits.get(key)
    if (!list) return []
    const cutoff = now - windowMs
    const alive = list.filter((t) => t > cutoff)
    if (alive.length === 0) hits.delete(key)
    else hits.set(key, alive)
    return alive
  }

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip ?? 'unknown'
    const now = Date.now()
    const alive = prune(key, now)
    alive.push(now)
    hits.set(key, alive)

    res.setHeader('RateLimit-Limit', String(max))
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - alive.length)))

    if (alive.length > max) {
      const retryAfterSeconds = Math.max(1, Math.ceil(windowMs / 1000))
      res.setHeader('Retry-After', String(retryAfterSeconds))
      res.status(429).json({ status: 'rate_limited', retryAfterSeconds })
      return
    }
    next()
  }
}
