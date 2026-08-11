import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  detectSameDayOverload,
  groupSameSlotClashes,
  type EnrolledStudent,
  type StudentExam,
} from '../src/lib/clash-detection.js'

const students: EnrolledStudent[] = [
  { studentId: 's1', regId: 'AU-001', name: 'Ayesha' },
  { studentId: 's2', regId: 'AU-002', name: 'Bilal' },
]

function exam(studentId: string, entryId: string, sectionId: string, date: string, timeSlotId: string, courseCode: string): StudentExam {
  return { studentId, entryId, sectionId, date, timeSlotId, courseCode }
}

test('groupSameSlotClashes reports one group per student-date-slot with >= 2 entries', () => {
  const groups = groupSameSlotClashes(
    [
      exam('s1', 'e1', 'sec-a', '2026-08-10', 'ts-morning', 'CS-101'),
      exam('s1', 'e2', 'sec-b', '2026-08-10', 'ts-morning', 'CS-102'),
      exam('s1', 'e3', 'sec-c', '2026-08-10', 'ts-afternoon', 'EE-101'),
    ],
    students,
  )
  assert.equal(groups.length, 1)
  assert.equal(groups[0].student.studentId, 's1')
  assert.equal(groups[0].date, '2026-08-10')
  assert.equal(groups[0].timeSlotId, 'ts-morning')
  assert.deepEqual(
    groups[0].entries.map((e) => e.entryId).sort(),
    ['e1', 'e2'],
  )
})

test('groupSameSlotClashes never flags a lone exam in a slot', () => {
  const groups = groupSameSlotClashes([exam('s1', 'e1', 'sec-a', '2026-08-10', 'ts-morning', 'CS-101')], students)
  assert.equal(groups.length, 0)
})

test('groupSameSlotClashes ignores unknown students', () => {
  const groups = groupSameSlotClashes(
    [
      exam('ghost', 'e1', 'sec-a', '2026-08-10', 'ts-morning', 'CS-101'),
      exam('ghost', 'e2', 'sec-b', '2026-08-10', 'ts-morning', 'CS-102'),
    ],
    students,
  )
  assert.equal(groups.length, 0)
})

test('groupSameSlotClashes sorts entries deterministically', () => {
  const groups = groupSameSlotClashes(
    [
      exam('s1', 'e-b', 'sec-b', '2026-08-10', 'ts-morning', 'CS-201'),
      exam('s1', 'e-a', 'sec-a', '2026-08-10', 'ts-morning', 'CS-101'),
    ],
    students,
  )
  assert.deepEqual(
    groups[0].entries.map((e) => e.courseCode),
    ['CS-101', 'CS-201'],
  )
})

test('detectSameDayOverload flags a day with >= threshold papers', () => {
  const overloads = detectSameDayOverload(
    [
      exam('s1', 'e1', 'sec-a', '2026-08-10', 'ts-morning', 'CS-101'),
      exam('s1', 'e2', 'sec-b', '2026-08-10', 'ts-afternoon', 'CS-102'),
    ],
    students,
  )
  assert.equal(overloads.length, 1)
  assert.equal(overloads[0].student.regId, 'AU-001')
  assert.equal(overloads[0].date, '2026-08-10')
  assert.equal(overloads[0].papers.length, 2)
})

test('detectSameDayOverload respects a custom threshold', () => {
  const overloads = detectSameDayOverload(
    [
      exam('s1', 'e1', 'sec-a', '2026-08-10', 'ts-morning', 'CS-101'),
      exam('s1', 'e2', 'sec-b', '2026-08-10', 'ts-afternoon', 'CS-102'),
    ],
    students,
    3,
  )
  assert.equal(overloads.length, 0)
})

test('detectSameDayOverload does not flag single-paper days', () => {
  const overloads = detectSameDayOverload(
    [
      exam('s1', 'e1', 'sec-a', '2026-08-10', 'ts-morning', 'CS-101'),
      exam('s1', 'e2', 'sec-b', '2026-08-11', 'ts-morning', 'CS-102'),
    ],
    students,
  )
  assert.equal(overloads.length, 0)
})

test('detectSameDayOverload groups by student and includes the day list', () => {
  const overloads = detectSameDayOverload(
    [
      exam('s1', 'e1', 'sec-a', '2026-08-10', 'ts-morning', 'CS-101'),
      exam('s1', 'e2', 'sec-b', '2026-08-10', 'ts-afternoon', 'CS-102'),
      exam('s2', 'e3', 'sec-c', '2026-08-10', 'ts-morning', 'EE-101'),
      exam('s2', 'e4', 'sec-d', '2026-08-10', 'ts-afternoon', 'EE-102'),
    ],
    students,
  )
  assert.equal(overloads.length, 2)
  const s1 = overloads.find((o) => o.student.studentId === 's1')!
  assert.deepEqual(
    s1.papers.map((p) => p.timeSlotId).sort(),
    ['ts-afternoon', 'ts-morning'],
  )
})
