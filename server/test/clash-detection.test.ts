import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findClashesForCandidate, type EnrolledStudent, type StudentExam } from '../src/lib/clash-detection.js'

const CANDIDATE = { sectionId: 'sec-candidate', date: '2026-08-10', timeSlotId: 'ts-morning' }

function enrolled(rows: Array<[string, string, string]>): EnrolledStudent[] {
  return rows.map(([studentId, regId, name]) => ({ studentId, regId, name }))
}

function exams(rows: Array<[string, string, string, string, string, string]>): StudentExam[] {
  return rows.map(([studentId, entryId, sectionId, date, timeSlotId, courseCode]) => ({
    studentId,
    entryId,
    sectionId,
    date,
    timeSlotId,
    courseCode,
  }))
}

test('clean slot produces no clashes and no day-load warnings', () => {
  const result = findClashesForCandidate(
    CANDIDATE,
    enrolled([['s1', 'R1', 'Ayesha']]),
    exams([['s1', 'e2', 'sec-other', '2026-08-11', 'ts-morning', 'CS-102']]),
  )
  assert.equal(result.clashes.length, 0)
  assert.equal(result.dayLoadWarnings.length, 0)
})

test('same date + same slot is a blocking same_slot clash (high)', () => {
  const result = findClashesForCandidate(
    CANDIDATE,
    enrolled([['s1', 'R1', 'Ayesha']]),
    exams([['s1', 'e2', 'sec-other', '2026-08-10', 'ts-morning', 'CS-102']]),
  )
  assert.equal(result.clashes.length, 1)
  assert.equal(result.clashes[0].type, 'same_slot')
  assert.equal(result.clashes[0].severity, 'high')
  assert.equal(result.clashes[0].student.regId, 'R1')
  assert.equal(result.clashes[0].conflictCourseCode, 'CS-102')
  assert.equal(result.clashes[0].conflictEntryId, 'e2')
  assert.equal(result.dayLoadWarnings.length, 0)
})

test('same date + different slot is a non-blocking same_day warning (medium)', () => {
  const result = findClashesForCandidate(
    CANDIDATE,
    enrolled([['s1', 'R1', 'Ayesha']]),
    exams([['s1', 'e2', 'sec-other', '2026-08-10', 'ts-afternoon', 'CS-102']]),
  )
  assert.equal(result.clashes.length, 0)
  assert.equal(result.dayLoadWarnings.length, 1)
  assert.equal(result.dayLoadWarnings[0].type, 'same_day')
  assert.equal(result.dayLoadWarnings[0].severity, 'medium')
})

test('exams on other dates are ignored', () => {
  const result = findClashesForCandidate(
    CANDIDATE,
    enrolled([['s1', 'R1', 'Ayesha']]),
    exams([['s1', 'e2', 'sec-other', '2026-08-09', 'ts-morning', 'CS-102']]),
  )
  assert.equal(result.clashes.length, 0)
  assert.equal(result.dayLoadWarnings.length, 0)
})

test('exams of other students never affect the candidate', () => {
  const result = findClashesForCandidate(
    CANDIDATE,
    enrolled([['s1', 'R1', 'Ayesha']]),
    exams([['s2', 'e9', 'sec-other', '2026-08-10', 'ts-morning', 'EE-101']]),
  )
  assert.equal(result.clashes.length, 0)
  assert.equal(result.dayLoadWarnings.length, 0)
})

test('the candidate section itself is never reported as a conflict', () => {
  const result = findClashesForCandidate(
    CANDIDATE,
    enrolled([['s1', 'R1', 'Ayesha']]),
    exams([['s1', 'e1', 'sec-candidate', '2026-08-10', 'ts-morning', 'CS-101']]),
  )
  assert.equal(result.clashes.length, 0)
  assert.equal(result.dayLoadWarnings.length, 0)
})

test('one student colliding with two exams yields two same_slot hits', () => {
  const result = findClashesForCandidate(
    CANDIDATE,
    enrolled([['s1', 'R1', 'Ayesha']]),
    exams([
      ['s1', 'e2', 'sec-a', '2026-08-10', 'ts-morning', 'CS-102'],
      ['s1', 'e3', 'sec-b', '2026-08-10', 'ts-morning', 'CS-203'],
    ]),
  )
  assert.equal(result.clashes.length, 2)
  assert.deepEqual(
    result.clashes.map((c) => c.conflictCourseCode),
    ['CS-102', 'CS-203'],
  )
})

test('a student with one same-slot and one same-day exam reports both kinds', () => {
  const result = findClashesForCandidate(
    CANDIDATE,
    enrolled([['s1', 'R1', 'Ayesha']]),
    exams([
      ['s1', 'e2', 'sec-a', '2026-08-10', 'ts-morning', 'CS-102'],
      ['s1', 'e3', 'sec-b', '2026-08-10', 'ts-afternoon', 'CS-203'],
    ]),
  )
  assert.equal(result.clashes.length, 1)
  assert.equal(result.clashes[0].type, 'same_slot')
  assert.equal(result.dayLoadWarnings.length, 1)
  assert.equal(result.dayLoadWarnings[0].type, 'same_day')
})

test('two enrolled students each produce their own clash hit', () => {
  const result = findClashesForCandidate(
    CANDIDATE,
    enrolled([
      ['s1', 'R1', 'Ayesha'],
      ['s2', 'R2', 'Bilal'],
    ]),
    exams([
      ['s1', 'e2', 'sec-a', '2026-08-10', 'ts-morning', 'CS-102'],
      ['s2', 'e2', 'sec-a', '2026-08-10', 'ts-morning', 'CS-102'],
    ]),
  )
  assert.equal(result.clashes.length, 2)
  assert.deepEqual(
    result.clashes.map((c) => c.student.regId),
    ['R1', 'R2'],
  )
})
