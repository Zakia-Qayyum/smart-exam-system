/**
 * Export & Reporting API client — Step 29.
 *
 * Typed wrappers around /api/export/* endpoints.  The Reports page does its
 * own inline fetch/download; this module is used by the My Datesheet page
 * for the roll-no-slip download.
 */
import { ApiError } from '@/services/api-client'

const API_BASE: string = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'

function getAccessToken(): string | null {
  try {
    const raw = localStorage.getItem('ses.auth')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.state?.accessToken ?? null
  } catch {
    return null
  }
}

async function downloadBlob(path: string, filename: string): Promise<void> {
  const token = getAccessToken()
  const headers: Record<string, string> = {}
  if (token) headers.authorization = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(res.status, body, `Download failed (${res.status})`)
  }

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Download a student's roll-no-slip PDF.
 */
export async function downloadRollNoSlip(studentId: string, examCycleId?: string): Promise<void> {
  const qs = examCycleId ? `?examCycleId=${encodeURIComponent(examCycleId)}` : ''
  const filename = `roll-no-slip-${studentId.slice(0, 12)}.pdf`
  await downloadBlob(`/api/export/roll-no-slip/${encodeURIComponent(studentId)}${qs}`, filename)
}
