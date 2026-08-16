import { ApiError, apiFetch } from '@/services/api-client'
import type {
  ApiInvigilatorAssignment,
  AssignmentStatus,
  AutoAssignCommitResult,
  AutoAssignPlan,
  UnassignedMatrix,
} from '@/lib/types'

function throwFor(status: number, body: unknown, fallback: string): never {
  throw new ApiError(status, body, fallback)
}

function toQuery(params: object): string {
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') qs.set(key, String(value))
  }
  const s = qs.toString()
  return s ? `?${s}` : ''
}

/** Slot × room assignment matrix for the board (Step 19 API). */
export async function fetchUnassignedMatrix(
  examCycleId: string,
  date?: string,
): Promise<UnassignedMatrix> {
  const { status, body } = await apiFetch<UnassignedMatrix>(
    `/api/scheduling/schedule-entries/${encodeURIComponent(examCycleId)}/unassigned${toQuery(date ? { date } : {})}`,
    { auth: true },
  )
  if (status !== 200) throwFor(status, body, 'Unable to load the assignment board')
  return body
}

export interface CreateAssignmentInput {
  schedule_entry_id: string
  invigilator_id: string
  status?: AssignmentStatus
}

export async function createAssignment(input: CreateAssignmentInput): Promise<ApiInvigilatorAssignment> {
  const { status, body } = await apiFetch<{ assignment: ApiInvigilatorAssignment }>('/api/invigilator-assignments', {
    method: 'POST',
    body: input,
    auth: true,
  })
  if (status !== 201) throwFor(status, body, 'Unable to record the assignment')
  return body.assignment
}

export async function deleteAssignment(id: string): Promise<void> {
  const { status, body } = await apiFetch<{ status: string }>(
    `/api/invigilator-assignments/${encodeURIComponent(id)}`,
    { method: 'DELETE', auth: true },
  )
  if (status !== 200) throwFor(status, body, 'Unable to remove the assignment')
}

export interface AutoAssignInput {
  exam_cycle_id?: string
  date?: string
}

/** Propose auto-assignments — read-only, writes nothing until commit. */
export async function proposeAutoAssign(input?: AutoAssignInput): Promise<AutoAssignPlan> {
  const { status, body } = await apiFetch<AutoAssignPlan>('/api/invigilator-assignments/auto-assign', {
    method: 'POST',
    body: input ?? {},
    auth: true,
  })
  if (status !== 200) throwFor(status, body, 'Unable to run auto-assign')
  return body
}

/** Persist an accepted auto-assign plan. This is the explicit commit step. */
export async function commitAutoAssign(
  proposals: Array<{ schedule_entry_id: string; invigilator_id: string }>,
): Promise<AutoAssignCommitResult> {
  const { status, body } = await apiFetch<AutoAssignCommitResult>('/api/invigilator-assignments/auto-assign/commit', {
    method: 'POST',
    body: { proposals },
    auth: true,
  })
  if (status !== 201) throwFor(status, body, 'Unable to commit the auto-assignments')
  return body
}
