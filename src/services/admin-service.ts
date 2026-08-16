import { ApiError, apiFetch } from '@/services/api-client'
import type {
  ApiAdminUser,
  ApiAuditLogList,
  ApiDepartmentAdmin,
  ApiExamCycleAdmin,
  ApiPermissionMatrixAccount,
  ApiRoomAdmin,
  ApiTimeSlotAdmin,
  CycleStatus,
  PermissionKey,
  PermissionMap,
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

// ── Departments ─────────────────────────────────────────────────────────────

export async function fetchDepartments(): Promise<ApiDepartmentAdmin[]> {
  const { status, body } = await apiFetch<{ departments: ApiDepartmentAdmin[] }>('/api/departments', { auth: true })
  if (status !== 200) throwFor(status, body, 'Unable to load departments')
  return body.departments
}

export async function createDepartment(input: { name: string; code: string }): Promise<ApiDepartmentAdmin> {
  const { status, body } = await apiFetch<{ department: ApiDepartmentAdmin }>('/api/departments', {
    method: 'POST',
    body: input,
    auth: true,
  })
  if (status !== 201) throwFor(status, body, 'Unable to create the department')
  return body.department
}

export async function deleteDepartment(id: string): Promise<void> {
  const { status, body } = await apiFetch<{ id: string }>(`/api/departments/${id}`, { method: 'DELETE', auth: true })
  if (status !== 200) throwFor(status, body, 'Unable to delete the department')
}

// ── Rooms ───────────────────────────────────────────────────────────────────

export async function fetchRooms(): Promise<ApiRoomAdmin[]> {
  const { status, body } = await apiFetch<{ rooms: ApiRoomAdmin[] }>('/api/rooms', { auth: true })
  if (status !== 200) throwFor(status, body, 'Unable to load rooms')
  return body.rooms
}

export async function createRoom(input: { name: string; capacity: number; department_id?: string | null }): Promise<ApiRoomAdmin> {
  const { status, body } = await apiFetch<{ room: ApiRoomAdmin }>('/api/rooms', { method: 'POST', body: input, auth: true })
  if (status !== 201) throwFor(status, body, 'Unable to create the room')
  return body.room
}

export async function deleteRoom(id: string): Promise<void> {
  const { status, body } = await apiFetch<{ id: string }>(`/api/rooms/${id}`, { method: 'DELETE', auth: true })
  if (status !== 200) throwFor(status, body, 'Unable to delete the room')
}

// ── Time slots ──────────────────────────────────────────────────────────────

export async function fetchTimeSlots(examCycleId?: string): Promise<ApiTimeSlotAdmin[]> {
  const { status, body } = await apiFetch<{ time_slots: ApiTimeSlotAdmin[] }>(
    `/api/time-slots${toQuery(examCycleId ? { exam_cycle_id: examCycleId } : {})}`,
    { auth: true },
  )
  if (status !== 200) throwFor(status, body, 'Unable to load time slots')
  return body.time_slots
}

export async function createTimeSlot(input: {
  label: string
  start_time: string
  end_time: string
  exam_cycle_id: string
}): Promise<ApiTimeSlotAdmin> {
  const { status, body } = await apiFetch<{ time_slot: ApiTimeSlotAdmin }>('/api/time-slots', {
    method: 'POST',
    body: input,
    auth: true,
  })
  if (status !== 201) throwFor(status, body, 'Unable to create the time slot')
  return body.time_slot
}

export async function deleteTimeSlot(id: string): Promise<void> {
  const { status, body } = await apiFetch<{ id: string }>(`/api/time-slots/${id}`, { method: 'DELETE', auth: true })
  if (status !== 200) throwFor(status, body, 'Unable to delete the time slot')
}

// ── Exam cycles ─────────────────────────────────────────────────────────────

export interface ApiCycleListResult {
  cycles: ApiExamCycleAdmin[]
  total: number
  page: number
  page_size: number
  summary: { draft: number; published: number; archived: number }
}

export async function fetchExamCycles(params?: { status?: CycleStatus; page_size?: number }): Promise<ApiCycleListResult> {
  const { status, body } = await apiFetch<ApiCycleListResult>(`/api/exam-cycles${toQuery(params ?? {})}`, { auth: true })
  if (status !== 200) throwFor(status, body, 'Unable to load exam cycles')
  return body
}

export async function createExamCycle(input: {
  name: string
  term: string
  start_date: string
  end_date: string
}): Promise<ApiExamCycleAdmin> {
  const { status, body } = await apiFetch<{ cycle: ApiExamCycleAdmin }>('/api/exam-cycles', {
    method: 'POST',
    body: input,
    auth: true,
  })
  if (status !== 201) throwFor(status, body, 'Unable to create the exam cycle')
  return body.cycle
}

export async function publishExamCycle(id: string): Promise<ApiExamCycleAdmin> {
  const { status, body } = await apiFetch<{ cycle: ApiExamCycleAdmin }>(`/api/exam-cycles/${id}/publish`, {
    method: 'POST',
    body: {},
    auth: true,
  })
  if (status !== 200) throwFor(status, body, 'Unable to publish the exam cycle')
  return body.cycle
}

export async function unlockExamCycle(id: string): Promise<ApiExamCycleAdmin> {
  const { status, body } = await apiFetch<{ cycle: ApiExamCycleAdmin }>(`/api/exam-cycles/${id}/unlock`, {
    method: 'POST',
    body: {},
    auth: true,
  })
  if (status !== 200) throwFor(status, body, 'Unable to unlock the exam cycle')
  return body.cycle
}

export async function deleteExamCycle(id: string): Promise<void> {
  const { status, body } = await apiFetch<{ id: string }>(`/api/exam-cycles/${id}`, { method: 'DELETE', auth: true })
  if (status !== 200) throwFor(status, body, 'Unable to delete the exam cycle')
}

// ── Permissions ─────────────────────────────────────────────────────────────

export async function fetchPermissionMatrix(): Promise<ApiPermissionMatrixAccount[]> {
  const { status, body } = await apiFetch<{ accounts: ApiPermissionMatrixAccount[] }>('/api/permissions/matrix', { auth: true })
  if (status !== 200) throwFor(status, body, 'Unable to load the permission matrix')
  return body.accounts
}

export async function updatePermissions(id: string, permissions: Partial<PermissionMap>): Promise<PermissionMap> {
  const { status, body } = await apiFetch<{ permissions: PermissionMap }>(`/api/users/${id}/permissions`, {
    method: 'PUT',
    body: { permissions },
    auth: true,
  })
  if (status !== 200) throwFor(status, body, 'Unable to update permissions')
  return body.permissions
}

// ── User accounts ───────────────────────────────────────────────────────────

export async function fetchAdminUsers(): Promise<ApiAdminUser[]> {
  const { status, body } = await apiFetch<{ users: ApiAdminUser[] }>('/api/users', { auth: true })
  if (status !== 200) throwFor(status, body, 'Unable to load user accounts')
  return body.users
}

export async function updateAdminUser(
  id: string,
  input: { status?: 'active' | 'disabled'; must_change_password?: boolean },
): Promise<ApiAdminUser> {
  const { status, body } = await apiFetch<{ user: ApiAdminUser }>(`/api/users/${id}`, {
    method: 'PATCH',
    body: input,
    auth: true,
  })
  if (status !== 200) throwFor(status, body, 'Unable to update the account')
  return body.user
}

export async function resetUserPassword(id: string): Promise<{ email: string; temporary_password_issued: boolean }> {
  const { status, body } = await apiFetch<{ email: string; temporary_password_issued: boolean }>(
    `/api/users/${id}/reset-password`,
    { method: 'POST', body: {}, auth: true },
  )
  if (status !== 200) throwFor(status, body, 'Unable to reset the password')
  return body
}

// ── Audit log ───────────────────────────────────────────────────────────────

export async function fetchAuditLog(params?: { page?: number; page_size?: number }): Promise<ApiAuditLogList> {
  const { status, body } = await apiFetch<ApiAuditLogList>(`/api/audit-log${toQuery(params ?? {})}`, { auth: true })
  if (status !== 200) throwFor(status, body, 'Unable to load the audit log')
  return body
}

// ── Shared error helpers ────────────────────────────────────────────────────

export interface AdminApiErrorDetail {
  status?: string
  error?: string
}

/** Pull the machine error code out of an ApiError body (e.g. `department_exists`). */
export function apiErrorCode(err: unknown): string | null {
  if (err instanceof ApiError && err.body && typeof err.body === 'object') {
    return ((err.body as AdminApiErrorDetail).status as string | undefined) ?? null
  }
  return null
}

/** Human-readable message from an ApiError body, falling back to err.message. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.body && typeof err.body === 'object') {
    const detail = err.body as AdminApiErrorDetail
    if (detail.error) return detail.error
  }
  return err instanceof Error ? err.message : fallback
}

export type { PermissionKey }
