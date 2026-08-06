import { create } from 'zustand'
import { mockNotifications } from '@/config/mock-data'
import { ROLES } from '@/config/roles'
import type { MockNotification, Role } from '@/lib/types'

interface NotificationsState {
  byRole: Record<Role, MockNotification[]>
  markRead: (role: Role, id: string) => void
  markAllRead: (role: Role) => void
}

function seed(): Record<Role, MockNotification[]> {
  return ROLES.reduce(
    (acc, role) => {
      acc[role] = mockNotifications(role)
      return acc
    },
    {} as Record<Role, MockNotification[]>,
  )
}

export const useNotificationsStore = create<NotificationsState>((set) => ({
  byRole: seed(),
  markRead: (role, id) =>
    set((s) => ({
      byRole: {
        ...s.byRole,
        [role]: s.byRole[role].map((n) => (n.id === id ? { ...n, read: true } : n)),
      },
    })),
  markAllRead: (role) =>
    set((s) => ({
      byRole: { ...s.byRole, [role]: s.byRole[role].map((n) => ({ ...n, read: true })) },
    })),
}))
