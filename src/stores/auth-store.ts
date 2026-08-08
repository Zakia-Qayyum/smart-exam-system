import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authService } from '@/services/auth-service'
import { getAccessToken } from '@/services/api-client'
import type { LoginResult, VerifyOtpResult } from '@/services/auth-service'
import type { AuthUser, Role } from '@/lib/types'

interface PendingAuth {
  email: string
  role: Role
  mustChangePassword: boolean
  otpExpiresAt: number
  otpAttemptsRemaining: number
  mfaToken: string | null
}

export type VerifyOtpScreenResult =
  | { status: 'ok'; next: 'home' | 'password-change' }
  | { status: 'invalid_otp'; attemptsRemaining: number }
  | { status: 'locked'; until: number }
  | { status: 'expired' }

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  pending: PendingAuth | null
  lockedEmail: string | null
  lockedUntil: number | null
  login: (email: string, password: string) => Promise<LoginResult>
  verifyOtp: (code: string) => Promise<VerifyOtpScreenResult>
  resendOtp: () => Promise<void>
  changePassword: (newPassword: string) => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  logout: () => Promise<void>
  restoreSession: () => Promise<void>
  clearPending: () => void
  clearLocked: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      pending: null,
      lockedEmail: null,
      lockedUntil: null,

      login: async (email, password) => {
        const res = await authService.login(email, password)
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
              mfaToken: res.mfaPendingToken,
            },
          })
          if (!res.requiresMfa && !res.mustChangePassword) {
            set({ user: res.user, accessToken: res.accessToken, pending: null })
          }
        } else if (res.status === 'locked') {
          set({ lockedEmail: res.email, lockedUntil: res.until })
        }
        return res
      },

      verifyOtp: async (code) => {
        const pending = get().pending
        if (!pending || !pending.mfaToken) return { status: 'expired' }
        const res: VerifyOtpResult = await authService.verifyOtp(pending.mfaToken, code)
        if (res.status === 'ok') {
          if (pending.mustChangePassword) {
            set({
              accessToken: res.accessToken,
              pending: { ...pending, mfaToken: null, otpExpiresAt: 0, otpAttemptsRemaining: 0 },
            })
            return { status: 'ok', next: 'password-change' }
          }
          set({ user: res.user, accessToken: res.accessToken, pending: null })
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
        if (!pending || !pending.mfaToken) return
        try {
          const res = await authService.resendOtp(pending.mfaToken)
          set({ pending: { ...pending, otpExpiresAt: res.expiresAt, otpAttemptsRemaining: 3 } })
        } catch {
          // Cooldown or expired challenge — keep the current OTP state.
        }
      },

      changePassword: async (newPassword) => {
        const pending = get().pending
        if (!pending) throw new Error('No pending authentication session')
        const res = await authService.changePassword(newPassword)
        set({ user: res.user, accessToken: res.accessToken, pending: null })
      },

      requestPasswordReset: async (email) => {
        await authService.requestPasswordReset(email)
      },

      logout: async () => {
        await authService.logout()
        set({ user: null, pending: null, accessToken: null, lockedEmail: null, lockedUntil: null })
      },

      restoreSession: async () => {
        const user = await authService.restoreSession()
        if (user) set({ user, accessToken: getAccessToken() })
        else set({ user: null, accessToken: null })
      },

      clearPending: () => set({ pending: null }),
      clearLocked: () => set({ lockedEmail: null, lockedUntil: null }),
    }),
    {
      name: 'ses.auth',
      partialize: (s) => ({ user: s.user }),
      onRehydrateStorage: () => (state) => {
        if (state?.user) {
          void useAuthStore.getState().restoreSession()
        }
      },
    },
  ),
)
