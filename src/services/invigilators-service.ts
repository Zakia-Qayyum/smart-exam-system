import { ApiError, apiFetch } from '@/services/api-client'
import type {
  BulkImportResult,
  DirectoryInvigilator,
  ImportPreview,
  InvigilatorCreateInput,
  InvigilatorList,
  InvigilatorUpdateInput,
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

export interface InvigilatorListParams {
  cycle?: string
  search?: string
  department?: string
  availability?: 'Available' | 'Busy' | 'On leave'
  tag?: string
  page?: number
  page_size?: number
}

/** Full invigilation directory for the current cycle (Step 16 API). */
export async function fetchInvigilators(params?: InvigilatorListParams): Promise<InvigilatorList> {
  const { status, body } = await apiFetch<InvigilatorList>(`/api/invigilators${toQuery(params ?? {})}`, {
    auth: true,
  })
  if (status !== 200) throwFor(status, body, 'Unable to load the invigilator directory')
  return body
}

export async function fetchInvigilator(id: string): Promise<DirectoryInvigilator> {
  const { status, body } = await apiFetch<DirectoryInvigilator>(`/api/invigilators/${encodeURIComponent(id)}`, {
    auth: true,
  })
  if (status !== 200) throwFor(status, body, 'Unable to load invigilator')
  return body
}

export async function createInvigilator(input: InvigilatorCreateInput): Promise<DirectoryInvigilator> {
  const { status, body } = await apiFetch<DirectoryInvigilator>('/api/invigilators', {
    method: 'POST',
    body: input,
    auth: true,
  })
  if (status !== 201) throwFor(status, body, 'Unable to add invigilator')
  return body
}

export async function updateInvigilator(
  id: string,
  input: InvigilatorUpdateInput,
): Promise<DirectoryInvigilator> {
  const { status, body } = await apiFetch<DirectoryInvigilator>(`/api/invigilators/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: input,
    auth: true,
  })
  if (status !== 200) throwFor(status, body, 'Unable to update invigilator')
  return body
}

/** Two-phase bulk import — preview is read-only, commit actually imports. */
export async function previewBulkImport(text: string): Promise<ImportPreview> {
  const { status, body } = await apiFetch<ImportPreview>('/api/invigilators/bulk-import/preview', {
    method: 'POST',
    body: { text },
    auth: true,
  })
  if (status !== 200) throwFor(status, body, 'Unable to preview the import')
  return body
}

export async function commitBulkImport(text: string): Promise<BulkImportResult> {
  const { status, body } = await apiFetch<BulkImportResult>('/api/invigilators/bulk-import/commit', {
    method: 'POST',
    body: { text },
    auth: true,
  })
  if (status !== 200) throwFor(status, body, 'Unable to run the import')
  return body
}
