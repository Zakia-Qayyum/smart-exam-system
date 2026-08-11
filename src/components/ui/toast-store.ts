import { create } from 'zustand'

export type ToastVariant = 'success' | 'danger' | 'warning' | 'info'

export interface ToastItem {
  id: string
  title: string
  description?: string
  variant: ToastVariant
  duration?: number
  action?: { label: string; onClick: () => void }
}

interface ToastStore {
  toasts: ToastItem[]
  add: (toast: Omit<ToastItem, 'id'>) => void
  remove: (id: string) => void
}

let counter = 0
const genId = () => `toast-${Date.now()}-${counter++}`

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (t) => set((s) => ({ toasts: [...s.toasts, { ...t, id: genId() }] })),
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export function toast(item: Omit<ToastItem, 'id'>) {
  useToastStore.getState().add(item)
}
