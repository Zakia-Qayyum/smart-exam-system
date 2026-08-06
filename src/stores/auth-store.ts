import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { mockUsers } from '@/config/mock-data'
import type { MockUser, Role } from '@/lib/types'

interface AuthState {
  user: MockUser | null
  login: (role: Role) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      login: (role) => set({ user: mockUsers[role] }),
      logout: () => set({ user: null }),
    }),
    { name: 'ses.auth' },
  ),
)
