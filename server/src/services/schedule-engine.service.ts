/**
 * Constraint-satisfaction schedule builder. Pure and synchronous so it can be
 * unit-tested without a database (see server/test/schedule-engine.test.ts).
 *
 * Constraints honoured while placing each section (largest enrollment first):
 *   - no student is double-booked into two exams in the same time slot;
 *   - the assigned room capacity is >= the section's enrolled count;
 *   - a room is never booked twice in the same time slot;
 *   - same-day load is minimised via a greedy cost function.
 *
 * Sections that cannot be placed cleanly are still assigned a best-effort slot
 * but flagged `needs_review` with a `reason` the coordinator can act on.
 */

export interface DraftSectionInput {
  sectionId: string
  courseCode: string
  enrolledCount: number
  studentIds: string[]
}

export interface DraftTimeSlot {
  id: string
  label: string
}

export interface DraftRoom {
  id: string
  name: string
  capacity: number
}

export type DraftStatus = 'scheduled' | 'needs_review'

export interface DraftAssignment {
  sectionId: string
  courseCode: string
  /** ISO date key, e.g. '2026-08-10' */
  date: string
  timeSlotId: string
  roomId: string
  status: DraftStatus
  reason?: 'same_slot_student' | 'capacity_exceeded' | 'no_available_room'
}

export interface DraftScheduleInput {
  /** ISO date keys, in chronological order, e.g. ['2026-08-10', ...] */
  days: string[]
  timeSlots: DraftTimeSlot[]
  rooms: DraftRoom[]
  sections: DraftSectionInput[]
}

export function buildDraftSchedule(input: DraftScheduleInput): DraftAssignment[] {
  const { days, timeSlots, rooms, sections } = input
  const ordered = [...sections].sort((a, b) => b.enrolledCount - a.enrolledCount)

  const byStudent = new Map<string, Array<{ date: string; timeSlotId: string }>>()
  const usedRooms = new Map<string, Set<string>>()

  const slotKey = (date: string, timeSlotId: string) => `${date}|${timeSlotId}`

  const recordStudent = (studentIds: string[], date: string, timeSlotId: string) => {
    for (const studentId of studentIds) {
      const list = byStudent.get(studentId) ?? []
      list.push({ date, timeSlotId })
      byStudent.set(studentId, list)
    }
  }

  const occupyRoom = (date: string, timeSlotId: string, roomId: string) => {
    const key = slotKey(date, timeSlotId)
    const set = usedRooms.get(key) ?? new Set<string>()
    set.add(roomId)
    usedRooms.set(key, set)
  }

  const freeRoom = (date: string, timeSlotId: string, minCapacity: number): DraftRoom | undefined => {
    const key = slotKey(date, timeSlotId)
    const used = usedRooms.get(key) ?? new Set<string>()
    return rooms
      .filter((r) => r.capacity >= minCapacity && !used.has(r.id))
      .sort((a, b) => a.capacity - b.capacity)[0]
  }

  const collidingCount = (studentIds: string[], date: string, timeSlotId: string) =>
    studentIds.filter((sid) => (byStudent.get(sid) ?? []).some((s) => s.date === date && s.timeSlotId === timeSlotId)).length

  const sameDayCount = (studentIds: string[], date: string) =>
    studentIds.filter((sid) => (byStudent.get(sid) ?? []).some((s) => s.date === date)).length

  const dayLoad = (studentIds: string[], date: string) =>
    studentIds.reduce((n, sid) => n + (byStudent.get(sid) ?? []).filter((s) => s.date === date).length, 0)

  const assignments: DraftAssignment[] = []

  for (const section of ordered) {
    let best:
      | { date: string; timeSlotId: string; roomId: string; cost: number; colliding: number }
      | undefined

    for (const date of days) {
      for (const slot of timeSlots) {
        const room = freeRoom(date, slot.id, section.enrolledCount)
        if (!room) continue
        const colliding = collidingCount(section.studentIds, date, slot.id)
        const cost = colliding * 10000 + dayLoad(section.studentIds, date) * 10 + sameDayCount(section.studentIds, date)
        if (!best || cost < best.cost) {
          best = { date, timeSlotId: slot.id, roomId: room.id, cost, colliding }
        }
      }
    }

    if (best) {
      occupyRoom(best.date, best.timeSlotId, best.roomId)
      recordStudent(section.studentIds, best.date, best.timeSlotId)
      assignments.push({
        sectionId: section.sectionId,
        courseCode: section.courseCode,
        date: best.date,
        timeSlotId: best.timeSlotId,
        roomId: best.roomId,
        status: best.colliding > 0 ? 'needs_review' : 'scheduled',
        reason: best.colliding > 0 ? 'same_slot_student' : undefined,
      })
      continue
    }

    // No slot has a free room big enough — try any free room regardless of
    // capacity so the coordinator still sees the section in the draft.
    let fallback:
      | { date: string; timeSlotId: string; roomId: string; colliding: number; capacityExceeded: boolean }
      | undefined

    outer: for (const date of days) {
      for (const slot of timeSlots) {
        const room = freeRoom(date, slot.id, 0)
        if (room) {
          fallback = {
            date,
            timeSlotId: slot.id,
            roomId: room.id,
            colliding: collidingCount(section.studentIds, date, slot.id),
            capacityExceeded: room.capacity < section.enrolledCount,
          }
          break outer
        }
      }
    }

    if (fallback) {
      occupyRoom(fallback.date, fallback.timeSlotId, fallback.roomId)
      recordStudent(section.studentIds, fallback.date, fallback.timeSlotId)
      assignments.push({
        sectionId: section.sectionId,
        courseCode: section.courseCode,
        date: fallback.date,
        timeSlotId: fallback.timeSlotId,
        roomId: fallback.roomId,
        status: 'needs_review',
        reason: fallback.capacityExceeded ? 'capacity_exceeded' : 'same_slot_student',
      })
      continue
    }

    // Every slot/room is exhausted — double-book the first available spot.
    const date = days[0]
    const timeSlotId = timeSlots[0].id
    const roomId = rooms[0].id
    occupyRoom(date, timeSlotId, roomId)
    recordStudent(section.studentIds, date, timeSlotId)
    assignments.push({
      sectionId: section.sectionId,
      courseCode: section.courseCode,
      date,
      timeSlotId,
      roomId,
      status: 'needs_review',
      reason: 'no_available_room',
    })
  }

  return assignments
}
