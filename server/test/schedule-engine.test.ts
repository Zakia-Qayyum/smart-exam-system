import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildDraftSchedule, type DraftAssignment, type DraftRoom, type DraftSectionInput } from '../src/services/schedule-engine.service.js'

const DAYS = ['2026-08-10', '2026-08-11']
const SLOTS = [
  { id: 'ts-morning', label: 'Morning' },
  { id: 'ts-afternoon', label: 'Afternoon' },
]
const ROOMS: DraftRoom[] = [
  { id: 'r1', name: 'Hall A', capacity: 60 },
  { id: 'r2', name: 'Hall B', capacity: 40 },
]

const sec = (id: string, code: string, enrolledCount: number, studentIds: string[]): DraftSectionInput => ({
  sectionId: id,
  courseCode: code,
  enrolledCount,
  studentIds,
})

test('places every section with a free room and within capacity', () => {
  const sections = [
    sec('sec-1', 'CS-101', 10, ['s1', 's2']),
    sec('sec-2', 'CS-102', 20, ['s3', 's4', 's5']),
    sec('sec-3', 'EE-101', 5, ['s6']),
  ]
  const result = buildDraftSchedule({ days: DAYS, timeSlots: SLOTS, rooms: ROOMS, sections })
  assert.equal(result.length, 3)
  assert.ok(result.every((a) => a.status === 'scheduled'))

  for (const assignment of result) {
    const room = ROOMS.find((r) => r.id === assignment.roomId)!
    const section = sections.find((s) => s.sectionId === assignment.sectionId)!
    assert.ok(room.capacity >= section.enrolledCount, `${section.courseCode} must fit in ${room.name}`)
  }
})

test('never double-books a student into two exams in the same time slot', () => {
  const sections = [
    sec('sec-1', 'CS-101', 2, ['s1']),
    sec('sec-2', 'CS-102', 2, ['s1']),
    sec('sec-3', 'CS-201', 2, ['s2']),
  ]
  const result = buildDraftSchedule({ days: DAYS, timeSlots: SLOTS, rooms: ROOMS, sections })

  const slotsForStudent = (studentId: string) =>
    result
      .filter((a) => sections.find((s) => s.sectionId === a.sectionId)!.studentIds.includes(studentId))
      .map((a) => `${a.date}|${a.timeSlotId}`)

  const slotsS1 = slotsForStudent('s1')
  assert.equal(slotsS1.length, 2)
  assert.equal(new Set(slotsS1).size, 2, 'student s1 must be in two distinct time slots')
})

test('never double-books a room in the same time slot', () => {
  const sections = [
    sec('sec-1', 'CS-101', 10, ['s1']),
    sec('sec-2', 'CS-102', 10, ['s2']),
    sec('sec-3', 'CS-201', 10, ['s3']),
    sec('sec-4', 'CS-202', 10, ['s4']),
    sec('sec-5', 'CS-301', 10, ['s5']),
  ]
  const result = buildDraftSchedule({ days: DAYS, timeSlots: SLOTS, rooms: ROOMS, sections })

  const key = (a: DraftAssignment) => `${a.date}|${a.timeSlotId}|${a.roomId}`
  assert.equal(new Set(result.map(key)).size, result.length, 'each room+slot may only hold one exam')
})

test('processes the largest enrollment first (big section wins the only big room)', () => {
  const sections = [
    sec('sec-small', 'CS-101', 1, ['s1']),
    sec('sec-big', 'CS-301', 50, ['s2', 's3', 's4']),
  ]
  // One day, one slot, one room big enough for exactly the 50-student section.
  const result = buildDraftSchedule({
    days: ['2026-08-10'],
    timeSlots: [{ id: 'ts-morning', label: 'Morning' }],
    rooms: [{ id: 'r1', name: 'Hall A', capacity: 50 }],
    sections,
  })

  const big = result.find((a) => a.sectionId === 'sec-big')!
  const small = result.find((a) => a.sectionId === 'sec-small')!
  assert.equal(big.roomId, 'r1')
  assert.equal(big.status, 'scheduled')
  assert.equal(small.status, 'needs_review')
})

test('flags capacity_exceeded when no room is large enough', () => {
  const result = buildDraftSchedule({
    days: ['2026-08-10'],
    timeSlots: [{ id: 'ts-morning', label: 'Morning' }],
    rooms: [{ id: 'r1', name: 'Lab', capacity: 5 }],
    sections: [sec('sec-1', 'CS-101', 10, ['s1', 's2', 's3'])],
  })
  assert.equal(result.length, 1)
  assert.equal(result[0].status, 'needs_review')
  assert.equal(result[0].reason, 'capacity_exceeded')
})

test('minimizes same-day load when a student has multiple exams', () => {
  // Student s1 is in all three sections — the engine should spread them across
  // both days rather than piling all three onto a single day.
  const sections = [
    sec('sec-1', 'CS-101', 2, ['s1']),
    sec('sec-2', 'CS-102', 2, ['s1']),
    sec('sec-3', 'CS-201', 2, ['s1']),
  ]
  const result = buildDraftSchedule({ days: DAYS, timeSlots: SLOTS, rooms: ROOMS, sections })

  const daysForStudent = new Set(
    result.filter((a) => a.sectionId !== 'sec-1').map((a) => a.date),
  )
  assert.ok(daysForStudent.size > 1, 's1 should not have all exams on one day')
})
