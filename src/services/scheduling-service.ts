import { ApiError, apiFetch } from '@/services/api-client'
import type {
  ApiClashCheckResult,
  ApiClashList,
  ApiClashRecord,
  ApiGenerateJob,
  ApiSaveResult,
  ApiScheduleEntry,
  ApiScheduleList,
  SchedulingCatalog,
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

/** Reference data for the scheduling screens (departments, sections, rooms…). */
export async function fetchCatalog(): Promise<SchedulingCatalog> {
  const { status, body } = await apiFetch<SchedulingCatalog>('/api/catalog', { auth: true })
  if (status !== 200) throwFor(status, body, 'Unable to load scheduling data')
  return body
}

export async function fetchScheduleEntries(params?: {
  cycle?: string
  status?: 'scheduled' | 'needs_review'
  page?: number
  page_size?: number
}): Promise<ApiScheduleList> {
  const { status, body } = await apiFetch<ApiScheduleList>(
    `/api/scheduling/schedule-entries${toQuery(params ?? {})}`,
    { auth: true },
  )
  if (status !== 200) throwFor(status, body, 'Unable to load schedule entries')
  return body
}

export interface SaveEntryInput {
  exam_cycle_id?: string
  section_id: string
  date: string
  time_slot_id: string
  room_id: string
  force?: boolean
  override_reason?: string
}

export interface ClashCheckInput {
  exam_cycle_id?: string
  section_id: string
  date: string
  time_slot_id: string
}

/** Synchronous clash check used by the manual-entry screen before saving. */
export async function checkClash(input: ClashCheckInput): Promise<ApiClashCheckResult> {
  const { status, body } = await apiFetch<ApiClashCheckResult>('/api/scheduling/clash-check', {
    method: 'POST',
    body: input,
    auth: true,
  })
  if (status !== 200) throwFor(status, body, 'Unable to run clash check')
  return body
}

/** Create a schedule entry. A blocking clash without force rejects with 409. */
export async function createEntry(input: SaveEntryInput): Promise<ApiSaveResult> {
  const { status, body } = await apiFetch<ApiSaveResult>('/api/scheduling/schedule-entries', {
    method: 'POST',
    body: input,
    auth: true,
  })
  if (status !== 201) throwFor(status, body, 'Unable to save schedule entry')
  return body
}

export async function updateEntry(id: string, input: SaveEntryInput): Promise<ApiSaveResult> {
  const { status, body } = await apiFetch<ApiSaveResult>(`/api/scheduling/schedule-entries/${id}`, {
    method: 'PUT',
    body: input,
    auth: true,
  })
  if (status !== 200) throwFor(status, body, 'Unable to update schedule entry')
  return body
}

export async function deleteEntry(id: string): Promise<void> {
  const { status, body } = await apiFetch<{ status: string }>(`/api/scheduling/schedule-entries/${id}`, {
    method: 'DELETE',
    auth: true,
  })
  if (status !== 200) throwFor(status, body, 'Unable to delete schedule entry')
}

/** Kick off the real async scheduler. Returns the job id to poll. */
export async function startGenerate(examCycleId?: string): Promise<{ jobId: string; status: string }> {
  const { status, body } = await apiFetch<{ jobId: string; status: string }>('/api/scheduling/generate', {
    method: 'POST',
    body: examCycleId ? { exam_cycle_id: examCycleId } : {},
    auth: true,
  })
  if (status !== 202) throwFor(status, body, 'Unable to start generation')
  return body
}

export async function getGenerateJob(jobId: string): Promise<ApiGenerateJob> {
  const { status, body } = await apiFetch<ApiGenerateJob>(`/api/scheduling/generate/${jobId}/status`, {
    auth: true,
  })
  if (status !== 200) throwFor(status, body, 'Unable to read generation status')
  return body
}

export interface ClashQuery {
  cycle?: string
  type?: 'same_slot' | 'same_day'
  status?: 'open' | 'overridden' | 'resolved' | 'all'
  page?: number
  page_size?: number
}

export async function fetchClashes(params?: ClashQuery): Promise<ApiClashList> {
  const { status, body } = await apiFetch<ApiClashList>(`/api/clashes${toQuery(params ?? {})}`, {
    auth: true,
  })
  if (status !== 200) throwFor(status, body, 'Unable to load clashes')
  return body
}

export async function resolveClash(id: string, reason: string): Promise<ApiClashRecord> {
  const { status, body } = await apiFetch<ApiClashRecord>(`/api/clashes/${id}/resolve`, {
    method: 'POST',
    body: { reason },
    auth: true,
  })
  if (status !== 200) throwFor(status, body, 'Unable to resolve clash')
  return body
}

export async function overrideClash(id: string, reason: string): Promise<ApiClashRecord> {
  const { status, body } = await apiFetch<ApiClashRecord>(`/api/clashes/${id}/override`, {
    method: 'POST',
    body: { reason },
    auth: true,
  })
  if (status !== 200) throwFor(status, body, 'Unable to override clash')
  return body
}

/** Distinct affected students in a list of clash hits. */
export function affectedStudents(hits: Array<{ student: { id: string; regId: string; name: string } }>) {
  const seen = new Map<string, { id: string; regId: string; name: string }>()
  for (const h of hits) {
    if (!seen.has(h.student.id)) {
      seen.set(h.student.id, { id: h.student.id, regId: h.student.regId, name: h.student.name })
    }
  }
  return [...seen.values()]
}

/** Distinct conflicting course codes across a list of clash hits. */
export function conflictingCourses(hits: Array<{ conflictCourseCode: string }>): string[] {
  return [...new Set(hits.map((h) => h.conflictCourseCode))].sort()
}

export type { ApiScheduleEntry }
