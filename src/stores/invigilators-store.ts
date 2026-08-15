import { create } from 'zustand'
import { fetchInvigilators } from '@/services/invigilators-service'
import type { DirectoryInvigilator } from '@/lib/types'

interface InvigilatorsState {
  invigilators: DirectoryInvigilator[]
  loading: boolean
  error: string
  loaded: boolean
  /** Load the roster from /api/invigilators. Safe to call repeatedly. */
  fetchAll: () => Promise<void>
  /** Alias for fetchAll — used after mutations so every screen stays in sync. */
  refresh: () => Promise<void>
  clear: () => void
}

/**
 * Shared invigilator roster for the current cycle. Both the Directory page and
 * the Scheduling Engine read from this store, so a name added via bulk import
 * is instantly searchable in the scheduler, and an assignment made in the
 * scheduler is immediately reflected in the Directory's assignment count.
 */
export const useInvigilatorsStore = create<InvigilatorsState>((set, get) => ({
  invigilators: [],
  loading: false,
  error: '',
  loaded: false,

  fetchAll: async () => {
    set({ loading: true, error: '' })
    try {
      const list = await fetchInvigilators({ page_size: 100 })
      set({ invigilators: list.invigilators, loaded: true })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load the invigilator directory' })
    } finally {
      set({ loading: false })
    }
  },

  refresh: async () => {
    await get().fetchAll()
  },

  clear: () => set({ invigilators: [], loaded: false, error: '' }),
}))
