import type { Request, Response } from 'express'
import { env } from '../config/env.js'

export const REFRESH_COOKIE = 'ses_refresh'

export function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie
  if (!header) return {}
  const out: Record<string, string> = {}
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    const key = part.slice(0, idx).trim()
    const value = part.slice(idx + 1).trim()
    if (!key) continue
    try {
      out[key] = decodeURIComponent(value)
    } catch {
      out[key] = value
    }
  }
  return out
}

const cookieBase = () => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: env.NODE_ENV === 'production',
  path: '/',
})

export function setRefreshCookie(res: Response, token: string, maxAgeDays = env.REFRESH_TOKEN_TTL_DAYS): void {
  res.cookie(REFRESH_COOKIE, token, {
    ...cookieBase(),
    maxAge: maxAgeDays * 24 * 60 * 60 * 1000,
  })
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, cookieBase())
}
