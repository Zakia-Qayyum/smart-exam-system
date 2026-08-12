import type { AuthUser } from '@/lib/types'

const API_BASE: string = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'

let accessToken: string | null = null
let refreshInFlight: Promise<RefreshResult | null> | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function getAccessToken() {
  return accessToken
}

export class ApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(status: number, body: unknown, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  auth?: boolean
}

export interface ApiResponse<T = unknown> {
  status: number
  body: T
}

export interface RefreshResult {
  accessToken: string
  user: AuthUser
}

/**
 * Exchange the httpOnly refresh cookie for a fresh access token. Safe to call
 * concurrently — only one refresh runs at a time.
 */
export async function refreshSession(): Promise<RefreshResult | null> {
  if (refreshInFlight) return refreshInFlight
  refreshInFlight = (async () => {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, { method: 'POST', credentials: 'include' })
    const body = (await res.json().catch(() => ({}))) as {
      status?: string
      accessToken?: string
      user?: AuthUser
    }
    if (res.status === 200 && body.status === 'ok' && body.accessToken && body.user) {
      accessToken = body.accessToken
      return { accessToken: body.accessToken, user: body.user }
    }
    accessToken = null
    return null
  })().finally(() => {
    refreshInFlight = null
  })
  return refreshInFlight
}

async function rawRequest<T>(path: string, options: ApiRequestOptions, retried: boolean): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {}
  if (options.body !== undefined) headers['content-type'] = 'application/json'
  if (options.auth && accessToken) headers.authorization = `Bearer ${accessToken}`

  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers,
    credentials: 'include',
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })
  const body = (await res.json().catch(() => ({}))) as T

  // Silent session renewal: on an expired/invalid access token, refresh once
  // via the httpOnly cookie and replay the original request.
  if (options.auth && res.status === 401 && !retried && (body as { status?: string })?.status === 'invalid_token') {
    const result = await refreshSession()
    if (result) return rawRequest<T>(path, options, true)
  }

  return { status: res.status, body }
}

export function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<ApiResponse<T>> {
  return rawRequest<T>(path, options, false)
}
