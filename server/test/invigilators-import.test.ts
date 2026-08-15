import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  deriveAvailability,
  parseCsvLines,
  toInvigilatorDto,
  validateImportRows,
  type ImportRowContext,
  type RosterRow,
} from '../src/services/invigilators.service.js'

const departments = [
  { id: 'd-cs', code: 'CS', name: 'Computer Science' },
  { id: 'd-se', code: 'SE', name: 'Software Engineering' },
]

function context(overrides?: Partial<ImportRowContext>): ImportRowContext {
  return {
    departments,
    existingEmails: new Set(['already@airuni.edu.pk']),
    existingNames: new Set(['ayesha khan']),
    ...overrides,
  }
}

// ── parseCsvLines ──────────────────────────────────────────────────────────

test('parseCsvLines splits rows and trims cells', () => {
  assert.deepEqual(parseCsvLines('A, B, C\nD, E, F'), [
    ['A', 'B', 'C'],
    ['D', 'E', 'F'],
  ])
})

test('parseCsvLines handles quoted commas and escaped quotes', () => {
  const rows = parseCsvLines('"Ahmed, Raza", ahmed@x.pk, CS\n"Bilal ""BJ"" Ahmed", b@x.pk, SE')
  assert.deepEqual(rows, [
    ['Ahmed, Raza', 'ahmed@x.pk', 'CS'],
    ['Bilal "BJ" Ahmed', 'b@x.pk', 'SE'],
  ])
})

test('parseCsvLines ignores blank lines and handles CRLF', () => {
  assert.deepEqual(parseCsvLines('A, B\r\n\r\nC, D\r\n'), [
    ['A', 'B'],
    ['C', 'D'],
  ])
})

// ── validateImportRows ─────────────────────────────────────────────────────

test('validateImportRows accepts a valid row and resolves department by code', () => {
  const rows = validateImportRows([['Adeel Rana', 'adeel@airuni.edu.pk', 'CS', 'Lecturer', '5', 'Programming; Databases']], context())
  assert.equal(rows.length, 1)
  const row = rows[0]
  assert.equal(row.errors.length, 0)
  assert.equal(row.duplicate, false)
  assert.equal(row.department_id, 'd-cs')
  assert.equal(row.department_name, 'Computer Science')
  assert.equal(row.max_assignments_per_cycle, 5)
  assert.deepEqual(row.specialization_tags, ['Programming', 'Databases'])
})

test('validateImportRows resolves department by id and name', () => {
  const byId = validateImportRows([['A', 'a@x.pk', 'd-se']], context())[0]
  assert.equal(byId.department_id, 'd-se')
  const byName = validateImportRows([['A', 'a@x.pk', 'Software Engineering']], context())[0]
  assert.equal(byName.department_id, 'd-se')
})

test('validateImportRows flags missing and malformed fields', () => {
  const row = validateImportRows([['', 'bad-email', 'XR', '', '0', '']], context())[0]
  assert.ok(row.errors.includes('Name is required'))
  assert.ok(row.errors.includes('Email is not a valid address'))
  assert.ok(row.errors.includes('Unknown department “XR”'))
  assert.ok(row.errors.includes('Max assignments must be a positive number'))
  assert.equal(row.duplicate, false)
})

test('validateImportRows flags duplicate emails from the roster and the file', () => {
  const roster = validateImportRows([['New Person', 'already@airuni.edu.pk', 'CS']], context())[0]
  assert.ok(roster.errors.includes('Duplicate email'))
  assert.equal(roster.duplicate, true)

  const file = validateImportRows(
    [
      ['Person A', 'same@x.pk', 'CS'],
      ['Person B', 'same@x.pk', 'CS'],
    ],
    context(),
  )
  assert.ok(file[0].errors.length === 0)
  assert.ok(file[1].errors.includes('Duplicate email'))
  assert.equal(file[1].duplicate, true)
})

test('validateImportRows flags duplicate names from the roster', () => {
  const row = validateImportRows([['ayesha khan', 'new.email@x.pk', 'CS']], context())[0]
  assert.ok(row.errors.includes('Duplicate name'))
})

test('validateImportRows defaults designation and max assignments', () => {
  const row = validateImportRows([['A', 'a@x.pk', 'CS', '', '', '']], context())[0]
  assert.equal(row.designation, 'Teaching Fellow')
  assert.equal(row.max_assignments_per_cycle, null)
})

// ── deriveAvailability ─────────────────────────────────────────────────────

test('deriveAvailability maps user status and cycle load', () => {
  assert.equal(deriveAvailability(0, 5, 'active'), 'Available')
  assert.equal(deriveAvailability(5, 5, 'active'), 'Busy')
  assert.equal(deriveAvailability(0, 5, 'disabled'), 'On leave')
})

// ── toInvigilatorDto ───────────────────────────────────────────────────────

function rosterRow(overrides?: Partial<RosterRow>): RosterRow {
  return {
    id: 'inv-1',
    department_id: 'd-cs',
    max_assignments_per_cycle: 5,
    specialization_tags: ['databases'],
    user: { name: 'Ayesha Khan', email: 'ayesha@airuni.edu.pk', status: 'active' },
    department: { name: 'Computer Science' },
    assignments: [
      {
        id: 'asg-1',
        status: 'assigned',
        schedule_entry: {
          date: new Date('2026-08-10T00:00:00.000Z'),
          section: { course: { course_code: 'CS-101', title: 'Programming Fundamentals' } },
          time_slot: { label: 'Morning' },
          room: { name: 'Hall A' },
        },
      },
      {
        id: 'asg-2',
        status: 'confirmed',
        schedule_entry: {
          date: new Date('2026-08-11T00:00:00.000Z'),
          section: { course: { course_code: 'CS-102', title: 'OOP' } },
          time_slot: { label: 'Afternoon' },
          room: { name: 'Hall B' },
        },
      },
      {
        id: 'asg-3',
        status: 'declined',
        schedule_entry: {
          date: new Date('2026-08-12T00:00:00.000Z'),
          section: { course: { course_code: 'CS-201', title: 'Data Structures' } },
          time_slot: { label: 'Morning' },
          room: { name: 'Hall C' },
        },
      },
    ],
    ...overrides,
  }
}

test('toInvigilatorDto matches the Step 15 shape with derived fields', () => {
  const dto = toInvigilatorDto(rosterRow())
  assert.equal(dto.name, 'Ayesha Khan')
  assert.equal(dto.email, 'ayesha@airuni.edu.pk')
  assert.equal(dto.department_id, 'd-cs')
  assert.equal(dto.department_name, 'Computer Science')
  assert.equal(dto.max_assignments_per_cycle, 5)
  assert.equal(dto.phone, '')
  assert.equal(dto.designation, 'Faculty')
  assert.deepEqual(dto.specialization_tags, ['databases'])
  assert.equal(dto.availability, 'Available')
  assert.equal(dto.assigned_count, 2, 'declined assignments must not count toward load')
  assert.equal(dto.assignment_history.length, 3, 'history keeps every assignment including declined')
  assert.equal(dto.assignment_history[0].course_code, 'CS-101')
  assert.equal(dto.assignment_history[0].date, '2026-08-10')
  assert.equal(dto.assignment_history[0].time_slot_label, 'Morning')
  assert.equal(dto.assignment_history[0].room_name, 'Hall A')
})

test('toInvigilatorDto derives Busy when the invigilator is at full load', () => {
  const dto = toInvigilatorDto(rosterRow({ max_assignments_per_cycle: 2 }))
  assert.equal(dto.availability, 'Busy')
})

test('toInvigilatorDto derives On leave for disabled users', () => {
  const dto = toInvigilatorDto(rosterRow({ user: { name: 'X', email: 'x@x.pk', status: 'disabled' } }))
  assert.equal(dto.availability, 'On leave')
})
