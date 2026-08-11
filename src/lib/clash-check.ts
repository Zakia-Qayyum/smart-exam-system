import type { ClashCandidate, ClashHit, MockScheduleEntry } from '@/lib/types'

export function detectClashes(candidate: ClashCandidate, entries: MockScheduleEntry[]): ClashHit[] {
  return entries
    .filter((e) => e.program === candidate.program)
    .flatMap((e): ClashHit[] => {
      if (e.date === candidate.date && e.time_slot_id === candidate.time_slot_id) {
        return [{ entry: e, type: 'same_slot' as const, severity: 'high' as const }]
      }
      if (e.date === candidate.date) {
        return [{ entry: e, type: 'same_day' as const, severity: 'medium' as const }]
      }
      return []
    })
}

export function roomSameDayLoad(
  entries: MockScheduleEntry[],
  date: string,
  roomId: string,
): MockScheduleEntry[] {
  return entries.filter((e) => e.date === date && e.room_id === roomId)
}

export function hasBlockingClash(hits: ClashHit[]): boolean {
  return hits.some((h) => h.type === 'same_slot')
}

export function hasDayLoadWarning(hits: ClashHit[]): boolean {
  return hits.some((h) => h.type === 'same_day')
}
