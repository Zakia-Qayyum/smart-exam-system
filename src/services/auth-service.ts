import { demoAccounts } from '@/config/mock-data'
import type { Role } from '@/lib/types'

export type LoginResult =
  | {
      status: 'ok'
      email: string
      role: Role
      requiresMfa: boolean
      mustChangePassword: boolean
      otpExpiresAt: number
    }
  | { status: 'invalid_credentials' }
  | { status: 'locked'; email: string; until: number }

export type VerifyOtpResult =
  | { status: 'ok'; role: Role }
  | { status: 'invalid_otp'; attemptsRemaining: number }
  | { status: 'locked'; until: number }
  | { status: 'expired' }

/**
 * Contract the auth screens depend on. Step 6 will swap `authService` for an
 * implementation backed by the real API — no screen code needs to change.
 */
export interface AuthService {
  login(email: string, password: string): Promise<LoginResult>
  verifyOtp(email: string, code: string): Promise<VerifyOtpResult>
  resendOtp(email: string): Promise<{ expiresAt: number }>
  changePassword(email: string, newPassword: string): Promise<void>
  requestPasswordReset(email: string): Promise<void>
  logout(): Promise<void>
}

const LOCK_THRESHOLD = 5
const LOCK_DURATION_MS = 15 * 60 * 1000
const OTP_TTL_MS = 10 * 60 * 1000
const OTP_MAX_ATTEMPTS = 3

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const accountByEmail = new Map(demoAccounts.map((a) => [a.email.toLowerCase(), a]))

const failedLogins: Record<string, number> = {}
const otpFailures: Record<string, number> = {}
const lockedUntil: Record<string, number> = {}
let otp: { email: string; code: string; expiresAt: number } | null = null

function randomCode() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

function lockAccount(email: string) {
  lockedUntil[email] = Date.now() + LOCK_DURATION_MS
  failedLogins[email] = 0
  otpFailures[email] = 0
}

export const mockAuthService: AuthService = {
  async login(email, password) {
    await delay(700)
    const key = email.trim().toLowerCase()
    const account = accountByEmail.get(key)

    const locked = lockedUntil[key] && lockedUntil[key] > Date.now()
    if (locked || account?.isLocked) {
      return {
        status: 'locked',
        email: key,
        until: lockedUntil[key] ?? Date.now() + LOCK_DURATION_MS,
      }
    }

    if (!account || account.password !== password) {
      failedLogins[key] = (failedLogins[key] ?? 0) + 1
      if (failedLogins[key] >= LOCK_THRESHOLD) {
        lockAccount(key)
        return { status: 'locked', email: key, until: lockedUntil[key] }
      }
      return { status: 'invalid_credentials' }
    }

    failedLogins[key] = 0
    otpFailures[key] = 0
    otp = { email: key, code: randomCode(), expiresAt: Date.now() + OTP_TTL_MS }
    // Demo aid: surface the code the real system would send by email.
    // eslint-disable-next-line no-console
    console.info(`[mock-auth] OTP for ${key}: ${otp.code} (expires ${new Date(otp.expiresAt).toLocaleTimeString()})`)

    return {
      status: 'ok',
      email: key,
      role: account.role,
      requiresMfa: account.requiresMfa,
      mustChangePassword: account.mustChangePassword,
      otpExpiresAt: otp.expiresAt,
    }
  },

  async verifyOtp(email, code) {
    await delay(500)
    if (!otp || otp.email !== email) return { status: 'expired' }
    if (Date.now() > otp.expiresAt) return { status: 'expired' }

    if (otp.code !== code) {
      otpFailures[email] = (otpFailures[email] ?? 0) + 1
      if (otpFailures[email] >= OTP_MAX_ATTEMPTS) {
        lockAccount(email)
        otp = null
        return { status: 'locked', until: lockedUntil[email] }
      }
      return { status: 'invalid_otp', attemptsRemaining: OTP_MAX_ATTEMPTS - otpFailures[email] }
    }

    otpFailures[email] = 0
    otp = null
    return { status: 'ok', role: accountByEmail.get(email)!.role }
  },

  async resendOtp(email) {
    await delay(600)
    otp = { email, code: randomCode(), expiresAt: Date.now() + OTP_TTL_MS }
    otpFailures[email] = 0
    // eslint-disable-next-line no-console
    console.info(`[mock-auth] OTP for ${email}: ${otp.code}`)
    return { expiresAt: otp.expiresAt }
  },

  async changePassword(email, newPassword) {
    await delay(700)
    const account = accountByEmail.get(email)
    if (account) account.password = newPassword
  },

  async requestPasswordReset(_email) {
    await delay(900)
    // Deliberately a no-op: the UI always shows a generic "check your email".
  },

  async logout() {
    otp = null
  },
}
