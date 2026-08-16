import { ApiError, apiFetch } from '@/services/api-client'
import type { ApiOverrideRequest, ApiOverrideRequestList } from '@/lib/types'

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

/**
 * The HOD approval queue. Pending + decided override requests come from the
 * real /api/override-requests endpoints (Step 22). Deciding writes the audit
 * log and — for an approval — applies the underlying effect (clash marked
 * overridden, entry confirmed) in the same server-side transaction.
 */
export async function fetchOverrideRequests(params?: {
  status?: 'pending' | 'approved' | 'rejected'
  target_type?: 'schedule_entry' | 'clash_record'
  page?: number
  page_size?: number
}): Promise<ApiOverrideRequestList> {
  const { status, body } = await apiFetch<ApiOverrideRequestList>(
    `/api/override-requests${toQuery(params ?? {})}`,
    { auth: true },
  )
  if (status !== 200) throwFor(status, body, 'Unable to load the approval queue')
  return body
}

export async function approveOverrideRequest(id: string, remarks?: string): Promise<ApiOverrideRequest> {
  const { status, body } = await apiFetch<{ request: ApiOverrideRequest }>(`/api/override-requests/${id}/approve`, {
    method: 'POST',
    body: remarks ? { remarks } : {},
    auth: true,
  })
  if (status !== 200) throwFor(status, body, 'Unable to approve the request')
  return body.request
}

export async function rejectOverrideRequest(id: string, remarks: string): Promise<ApiOverrideRequest> {
  const { status, body } = await apiFetch<{ request: ApiOverrideRequest }>(`/api/override-requests/${id}/reject`, {
    method: 'POST',
    body: { remarks },
    auth: true,
  })
  if (status !== 200) throwFor(status, body, 'Unable to reject the request')
  return body.request
}
