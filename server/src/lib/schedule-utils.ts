/**
 * Shared scheduling helpers — exam-cycle resolution and calendar-day math.
 * Used by scheduling.service.ts and the DB-backed clash-detection.service.ts
 * so both agree on the same "current draft cycle" and date-key conventions.
 */
import { prisma } from './prisma.js'
import { HttpError } from './http-error.js'

/** 'YYYY-MM-DD' key of a Date in UTC. */
export const dateKey = (d: Date) => d.toISOString().slice(0, 10)

/** Midnight-UTC Date for a 'YYYY-MM-DD' key. */
export const dateFromKey = (key: string) => new Date(`${key}T00:00:00.000Z`)

/** Every 'YYYY-MM-DD' key from `start` to `end` inclusive, in order. */
export function enumerateDays(start: Date, end: Date): string[] {
  const days: string[] = []
  const endKey = dateKey(end)
  const current = new Date(`${dateKey(start)}T00:00:00.000Z`)
  while (dateKey(current) <= endKey) {
    days.push(dateKey(current))
    current.setUTCDate(current.getUTCDate() + 1)
  }
  return days
}

/**
 * Resolve the exam cycle a request refers to. When no id is given the most
 * recently created `draft` cycle is used, matching the coordinator's "work on
 * the current cycle" flow. Once a cycle is published there is no draft, so the
 * latest non-archived cycle is returned instead — this keeps the calendar and
 * clash views readable after publishing.
 */
export async function resolveExamCycle(examCycleId?: string) {
  const cycle = examCycleId
    ? await prisma.examCycle.findUnique({ where: { id: examCycleId } })
    : await prisma.examCycle.findFirst({
        where: { status: { in: ['draft', 'published'] } },
        orderBy: { created_at: 'desc' },
      })
  if (!cycle) throw new HttpError(404, 'cycle_not_found', 'No active exam cycle found')
  return cycle
}
