import { create } from 'zustand'
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/services/notifications-service'
import type { ApiNotification, MockNotification } from '@/lib/types'

function minutesSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
}

function toItem(n: ApiNotification): MockNotification {
  return {
    id: n.id,
    kind: n.type,
    title: n.title,
    body: n.body ?? '',
    minutesAgo: minutesSince(n.created_at),
    createdAt: n.created_at,
    read: n.read,
    link: n.link ?? '/notifications',
  }
}

const apply = (items: MockNotification[]) => ({
  items,
  unreadCount: items.filter((n) => !n.read).length,
})

interface NotificationsState {
  items: MockNotification[]
  unreadCount: number
  loading: boolean
  error: string
  refresh: () => Promise<void>
  /** Mark a single notification read — optimistic, then reconciled with the API. */
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
  /** Optimistic local-only toggle (no API call); readLocally + markRead for click-through. */
  readLocally: (id: string) => void
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  items: [],
  unreadCount: 0,
  loading: false,
  error: '',

  refresh: async () => {
    set({ loading: true, error: '' })
    try {
      const list = await fetchNotifications({ page_size: 100 })
      set(apply(list.notifications.map(toItem)))
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unable to load notifications' })
    } finally {
      set({ loading: false })
    }
  },

  markRead: async (id) => {
    const hadUnread = get().items.some((n) => n.id === id && !n.read)
    if (hadUnread) set((s) => apply(s.items.map((n) => (n.id === id ? { ...n, read: true } : n))))
    try {
      const updated = await markNotificationRead(id)
      set((s) => apply(s.items.map((n) => (n.id === id ? toItem(updated) : n))))
    } catch {
      // Best effort — the optimistic update already reflects the read state.
    }
  },

  markAllRead: async () => {
    if (get().unreadCount === 0) return
    set((s) => apply(s.items.map((n) => ({ ...n, read: true }))))
    try {
      await markAllNotificationsRead()
    } catch {
      // Best effort — next refresh reconciles.
    }
  },

  readLocally: (id) =>
    set((s) => apply(s.items.map((n) => (n.id === id ? { ...n, read: true } : n)))),
}))
