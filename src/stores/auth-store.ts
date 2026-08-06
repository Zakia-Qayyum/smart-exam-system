import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { mockUsers } from '@/config/mock-data'
import { mockAuthService } from '@/services/auth-service'
import type { LoginResult, VerifyOtpResult } from '@/services/auth-service'
import type { MockUser, Role } from '@/lib/types'

interface PendingAuth {
  email: string
  role: Role
  mustChangePassword: boolean
  otpExpiresAt: number
  otpAttemptsRemaining: number
}

export type VerifyOtpScreenResult =
  | { status: 'ok'; next: 'home' | 'password-change' }
  | { status: 'invalid_otp'; attemptsRemaining: number }
  | { status: 'locked'; until: number }
  | { status: 'expired' }

interface AuthState {
  user: MockUser | null
  pending: PendingAuth | null
  lockedEmail: string | null
  lockedUntil: number | null
  login: (email: string, password: string) => Promise<LoginResult>
  verifyOtp: (code: string) => Promise<VerifyOtpScreenResult>
  resendOtp: () => Promise<void>
  changePassword: (newPassword: string) => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  impersonate: (role: Role) => void
  logout: () => Promise<void>
  clearPending: () => void
  clearLocked: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      pending: null,
      lockedEmail: null,
      lockedUntil: null,

      login: async (email, password) => {
        const res = await mockAuthService.login(email, password)
        if (res.status === 'ok') {
          set({
            lockedEmail: null,
            lockedUntil: null,
            pending: {
              email: res.email,
              role: res.role,
              mustChangePassword: res.mustChangePassword,
              otpExpiresAt: res.requiresMfa ? res.otpExpiresAt : 0,
              otpAttemptsRemaining: 3,
            },
          })
          if (!res.requiresMfa && !res.mustChangePassword) {
            set({ user: mockUsers[res.role], pending: null })
          }
        } else if (res.status === 'locked') {
          set({ lockedEmail: res.email, lockedUntil: res.until })
        }
        return res
      },

      verifyOtp: async (code) => {
        const pending = get().pending
        if (!pending) return { status: 'expired' }
        const res: VerifyOtpResult = await mockAuthService.verifyOtp(pending.email, code)
        if (res.status === 'ok') {
          if (pending.mustChangePassword) {
            set({ pending: { ...pending, otpExpiresAt: 0, otpAttemptsRemaining: 0 } })
            return { status: 'ok', next: 'password-change' }
          }
          set({ user: mockUsers[pending.role], pending: null })
          return { status: 'ok', next: 'home' }
        }
        if (res.status === 'invalid_otp') {
          set({ pending: { ...pending, otpAttemptsRemaining: res.attemptsRemaining } })
          return res
        }
        if (res.status === 'locked') {
          set({ lockedEmail: pending.email, lockedUntil: res.until, pending: null })
          return res
        }
        return res
      },

      resendOtp: async () => {
        const pending = get().pending
        if (!pending) return
        const res = await mockAuthService.resendOtp(pending.email)
        set({ pending: { ...pending, otpExpiresAt: res.expiresAt, otpAttemptsRemaining: 3 } })
      },

      changePassword: async (newPassword) => {
        const pending = get().pending
        if (!pending) throw new Error('No pending authentication session')
        await mockAuthService.changePassword(pending.email, newPassword)
        set({ user: mockUsers[pending.role], pending: null })
      },

      requestPasswordReset: async (email) => {
        await mockAuthService.requestPasswordReset(email)
      },

      impersonate: (role) =>
        set({
          user: mockUsers[role],
          pending: null,
          lockedEmail: null,
          lockedUntil: null,
        }),

      logout: async () => {
        await mockAuthService.logout()
        set({ user: null, pending: null, lockedEmail: null, lockedUntil: null })
      },

      clearPending: () => set({ pending: null }),
      clearLocked: () => set({ lockedEmail: null, lockedUntil: null }),
    }),
    { name: 'ses.auth', partialize: (s) => ({ user: s.user }) },
  ),
)
