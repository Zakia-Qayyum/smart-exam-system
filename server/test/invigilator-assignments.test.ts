import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  pickAutoAssignments,
  type AutoAssignCandidate,
  type AutoAssignTarget,
} from '../src/services/invigilator-assignments.service.js'

const inv = (overrides: Partial<AutoAssignCandidate>): AutoAssignCandidate => ({
  id: 'i-1',
  name: 'Alisha Khan',
  department_id: 'd-cs',
  specialization_tags: ['Programming', 'Data Structures'],
  max_assignments_per_cycle: 5,
  user_status: 'active',
  current_load: 1,
  busy_slots: [],
  ...overrides,
})

const target = (overrides: Partial<AutoAssignTarget>): AutoAssignTarget => ({
  key: 'entry:e-1',
  schedule_entry_id: 'e-1',
  department_id: 'd-cs',
  date: '2026-08-10',
  time_slot_id: 's-1',
  needs: 2,
  ...overrides,
})

const tagPool = (dept: string, tags: string[]): Record<string, Set<string>> => ({
  [dept]: new Set(tags),
})

test('prefers invigilators whose specialization tags match the course department', () => {
  const cs = inv({ id: 'cs-1', name: 'Alisha Khan', department_id: 'd-cs', specialization_tags: ['Programming'], current_load: 4 })
  const se = inv({ id: 'se-1', name: 'Bilal Ahmed', department_id: 'd-se', specialization_tags: ['Networks'], current_load: 0 })
  const picks = pickAutoAssignments([target({ needs: 1 })], [se, cs], tagPool('d-cs', ['Programming', 'Data Structures']))
  assert.equal(picks[0].invigilator_id, 'cs-1')
  assert.ok(picks[0].reason.startsWith('Specialization match'))
})

test('round-robins by current load when specialization scores tie', () => {
  const loaded = inv({ id: 'busy', name: 'Zara Ali', current_load: 4 })
  const free = inv({ id: 'free', name: 'Imran Javed', current_load: 0 })
  const picks = pickAutoAssignments([target({ needs: 1 })], [loaded, free], tagPool('d-cs', ['Programming']))
  assert.equal(picks[0].invigilator_id, 'free')
})

test('excludes invigilators already on duty at the same date and time slot', () => {
  const busy = inv({ id: 'busy', busy_slots: [{ date: '2026-08-10', time_slot_id: 's-1' }], current_load: 0 })
  const free = inv({ id: 'free', name: 'Imran Javed', current_load: 1 })
  const picks = pickAutoAssignments([target({ needs: 1 })], [busy, free], tagPool('d-cs', ['Programming']))
  assert.equal(picks[0].invigilator_id, 'free')
})

test('excludes invigilators at their cycle max assignment limit', () => {
  const maxed = inv({ id: 'maxed', current_load: 5, max_assignments_per_cycle: 5 })
  const free = inv({ id: 'free', name: 'Imran Javed', current_load: 2 })
  const picks = pickAutoAssignments([target({ needs: 1 })], [maxed, free], tagPool('d-cs', ['Programming']))
  assert.equal(picks[0].invigilator_id, 'free')
})

test('excludes disabled (on-leave) users', () => {
  const leave = inv({ id: 'leave', user_status: 'disabled', current_load: 0 })
  const free = inv({ id: 'free', name: 'Imran Javed', current_load: 2 })
  const picks = pickAutoAssignments([target({ needs: 1 })], [leave, free], tagPool('d-cs', ['Programming']))
  assert.equal(picks[0].invigilator_id, 'free')
})

test('fills multiple seats with distinct invigilators', () => {
  const a = inv({ id: 'a', name: 'Alisha Khan', current_load: 0 })
  const b = inv({ id: 'b', name: 'Bilal Ahmed', current_load: 0 })
  const c = inv({ id: 'c', name: 'Chaman Bibi', current_load: 0 })
  const picks = pickAutoAssignments([target({ needs: 2 })], [a, b, c], tagPool('d-cs', ['Programming']))
  assert.equal(picks.length, 2)
  assert.notEqual(picks[0].invigilator_id, picks[1].invigilator_id)
})

test('does not propose when no eligible invigilator exists', () => {
  const busy = inv({ id: 'busy', busy_slots: [{ date: '2026-08-10', time_slot_id: 's-1' }] })
  const picks = pickAutoAssignments([target({ needs: 1 })], [busy], tagPool('d-cs', ['Programming']))
  assert.equal(picks.length, 0)
})

test('respects the proposal limit across targets', () => {
  const pool = Array.from({ length: 5 }, (_, i) => inv({ id: `i-${i}`, name: `Faculty ${i}`, current_load: 0 }))
  const targets = [target({ key: 'e-1' }), target({ key: 'e-2' }), target({ key: 'e-3' })]
  const picks = pickAutoAssignments(targets, pool, tagPool('d-cs', ['Programming']), 3)
  assert.equal(picks.length, 3)
})
