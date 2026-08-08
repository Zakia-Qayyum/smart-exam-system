import { ApiError, apiFetch, refreshSession, setAccessToken } from '@/services/api-client'
import type { AuthUser, Role } from '@/lib/types'

export type LoginResult =
  | {
      status: 'ok'
      email: string
      role: Role
      requiresMfa: boolean
      mustChangePassword: boolean
      otpExpiresAt: number
      mfaPendingToken: string | null
      accessToken: string | null
      user: AuthUser
    }
  | { status: 'invalid_credentials' }
  | { status: 'locked'; email: string; until: number }

export type VerifyOtpResult =
  | { status: 'ok'; role: Role; accessToken: string; user: AuthUser }
  | { status: 'invalid_otp'; attemptsRemaining: number }
  | { status: 'locked'; until: number }
  | { status: 'expired' }

/**
 * Real API-backed auth service (Step 6). The auth screens depend only on the
 * store, which maps these results onto the exact shapes the screens render.
 */
export interface AuthService {
  login(email: string, password: string): Promise<LoginResult>
  verifyOtp(mfaToken: string, code: string): Promise<VerifyOtpResult>
  resendOtp(mfaToken: string): Promise<{ expiresAt: number }>
  changePassword(newPassword: string): Promise<{ accessToken: string; user: AuthUser }>
  requestPasswordReset(email: string): Promise<void>
  logout(): Promise<void>
  restoreSession(): Promise<AuthUser | null>
}

interface AuthBody {
  status?: string
  email?: string
  role?: Role
  requiresMfa?: boolean
  mustChangePassword?: boolean
  otpExpiresAt?: number
  mfaPendingToken?: string
  accessToken?: string
  user?: AuthUser
  until?: number
  attemptsRemaining?: number
}

export const authService: AuthService = {
  async login(email, password) {
    const { status, body } = await apiFetch<AuthBody>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    })
    if (status === 200 && body.status === 'ok' && body.user) {
      if (!body.requiresMfa && body.accessToken) setAccessToken(body.accessToken)
      return {
        status: 'ok',
        email: body.email ?? email,
        role: body.role ?? 'admin',
        requiresMfa: body.requiresMfa ?? false,
        mustChangePassword: body.mustChangePassword ?? false,
        otpExpiresAt: body.otpExpiresAt ?? 0,
        mfaPendingToken: body.mfaPendingToken ?? null,
        accessToken: body.accessToken ?? null,
        user: body.user,
      }
    }
    if (status === 423 && body.status === 'locked') {
      return { status: 'locked', email: body.email ?? email, until: body.until ?? Date.now() }
    }
    return { status: 'invalid_credentials' }
  },

  async verifyOtp(mfaToken, code) {
    const { status, body } = await apiFetch<AuthBody>('/api/auth/verify-otp', {
      method: 'POST',
      body: { token: mfaToken, code },
    })
    if (status === 200 && body.status === 'ok' && body.accessToken && body.user) {
      setAccessToken(body.accessToken)
      return { status: 'ok', role: body.role ?? 'admin', accessToken: body.accessToken, user: body.user }
    }
    if (status === 401 && body.status === 'invalid_otp') {
      return { status: 'invalid_otp', attemptsRemaining: body.attemptsRemaining ?? 0 }
    }
    if (status === 403 && body.status === 'locked') {
      return { status: 'locked', until: body.until ?? Date.now() }
    }
    return { status: 'expired' }
  },

  async resendOtp(mfaToken) {
    const { status, body } = await apiFetch<AuthBody>('/api/auth/resend-otp', {
      method: 'POST',
      body: { token: mfaToken },
    })
    if (status === 200 && body.status === 'ok' && body.otpExpiresAt) {
      return { expiresAt: body.otpExpiresAt }
    }
    throw new ApiError(status, body, 'Unable to resend verification code')
  },

  async changePassword(newPassword) {
    const { status, body } = await apiFetch<AuthBody>('/api/auth/change-password', {
      method: 'POST',
      body: { newPassword },
      auth: true,
    })
    if (status === 200 && body.status === 'ok' && body.accessToken && body.user) {
      setAccessToken(body.accessToken)
      return { accessToken: body.accessToken, user: body.user }
    }
    throw new ApiError(status, body, 'Unable to change password')
  },

  async requestPasswordReset(email) {
    await apiFetch('/api/auth/forgot-password', { method: 'POST', body: { email } })
  },

  async logout() {
    await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {
      /* best-effort server-side revocation */
    })
    setAccessToken(null)
  },

  async restoreSession() {
    const result = await refreshSession()
    return result?.user ?? null
  },
}
