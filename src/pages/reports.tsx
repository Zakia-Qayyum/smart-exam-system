import { useEffect, useState } from 'react'
import {
  Download,
  FileDown,
  FileText,
  Filter,
  Loader2,
  Printer,
  Clock,
  RefreshCw,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast-store'
import { apiFetch, getAccessToken } from '@/services/api-client'
import type { ExportCycle, ExportDepartment, ExportScheduleEntry, ExportHistoryEntry } from '@/lib/types'

type ExportType = 'schedule' | 'roll-no-slips'

const typeBadgeVariant: Record<ExportType, 'info' | 'gold'> = {
  schedule: 'info',
  'roll-no-slips': 'gold',
}

const typeLabel: Record<ExportType, string> = {
  schedule: 'Schedule',
  'roll-no-slips': 'Roll No Slips',
}

export function ReportsPage() {
  // ── Data ───────────────────────────────────────────────────────────────
  const [cycles, setCycles] = useState<ExportCycle[]>([])
  const [departments, setDepartments] = useState<ExportDepartment[]>([])
  const [loading, setLoading] = useState(true)

  // ── Filter state ──────────────────────────────────────────────────────
  const [selectedCycle, setSelectedCycle] = useState('')
  const [selectedDept, setSelectedDept] = useState('')
  const [selectedType, setSelectedType] = useState<ExportType>('schedule')

  // ── Preview state ─────────────────────────────────────────────────────
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewRows, setPreviewRows] = useState<ExportScheduleEntry[]>([])
  const [previewTotal, setPreviewTotal] = useState(0)

  // ── Download state ────────────────────────────────────────────────────
  const [downloading, setDownloading] = useState(false)

  // ── Watermark state ─────────────────────────────────────────────────
  const [showWatermark, setShowWatermark] = useState(false)

  // ── History ───────────────────────────────────────────────────────────
  const [history, setHistory] = useState<ExportHistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)

  const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'

  // ── Load reference data ───────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [cycleRes, deptRes] = await Promise.all([
          apiFetch<{ cycles: ExportCycle[] }>('/api/cycles', { auth: true }),
          apiFetch<{ departments: ExportDepartment[] }>('/api/catalog', { auth: true }),
        ])
        if (cancelled) return
        if (cycleRes.status === 200) setCycles(cycleRes.body.cycles ?? [])
        if (deptRes.status === 200) setDepartments(deptRes.body.departments ?? [])
      } catch { /* ignore */ }
      finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // ── Load history ──────────────────────────────────────────────────────
  const refreshHistory = async () => {
    setHistoryLoading(true)
    try {
      const { status, body } = await apiFetch<{ entries: ExportHistoryEntry[] }>('/api/export/history', { auth: true })
      if (status === 200) setHistory(body.entries ?? [])
    } catch { /* ignore */ }
    finally { setHistoryLoading(false) }
  }

  useEffect(() => { refreshHistory() }, [])

  // ── Handlers ──────────────────────────────────────────────────────────
  const handlePreview = async () => {
    if (!selectedCycle) return
    setPreviewLoading(true)
    setPreviewRows([])
    try {
      const params = new URLSearchParams({ page_size: '10' })
      if (selectedCycle) params.set('cycle', selectedCycle)
      if (selectedDept) params.set('department', selectedDept)
      const { status, body } = await apiFetch<{ entries: ExportScheduleEntry[]; total: number }>(
        `/api/scheduling/schedule-entries?${params}`,
        { auth: true },
      )
      if (status === 200) {
        setPreviewRows(body.entries ?? [])
        setPreviewTotal(body.total ?? 0)
      }
    } catch { /* ignore */ }
    finally { setPreviewLoading(false) }
  }

  const handleDownloadCsv = async () => {
    if (!selectedCycle) return
    setDownloading(true)
    try {
      const params = new URLSearchParams()
      if (selectedCycle) params.set('examCycleId', selectedCycle)
      if (selectedDept) params.set('departmentId', selectedDept)
      const token = getAccessToken()
      const headers: Record<string, string> = {}
      if (token) headers.authorization = `Bearer ${token}`
      const res = await fetch(`${API_BASE}/api/export/csv?${params}`, { credentials: 'include', headers })
      if (!res.ok) throw new Error(`Export failed (${res.status})`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `datesheet-export.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast({ variant: 'success', title: 'CSV exported', description: 'Your CSV file has been downloaded.' })
      refreshHistory()
    } catch (err) {
      toast({ variant: 'danger', title: 'Export failed', description: err instanceof Error ? err.message : 'Unable to export CSV.' })
    } finally {
      setDownloading(false)
    }
  }

  const handleDownloadPdf = async () => {
    if (!selectedCycle) return
    setDownloading(true)
    try {
      const params = new URLSearchParams()
      if (selectedCycle) params.set('examCycleId', selectedCycle)
      if (selectedDept) params.set('departmentId', selectedDept)
      const token = getAccessToken()
      const headers: Record<string, string> = {}
      if (token) headers.authorization = `Bearer ${token}`
      const res = await fetch(`${API_BASE}/api/export/datesheet-pdf?${params}`, { credentials: 'include', headers })
      if (!res.ok) throw new Error(`Export failed (${res.status})`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `datesheet.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast({ variant: 'success', title: 'PDF exported', description: 'Your datesheet PDF has been downloaded.' })
      refreshHistory()
    } catch (err) {
      toast({ variant: 'danger', title: 'Export failed', description: err instanceof Error ? err.message : 'Unable to export PDF.' })
    } finally {
      setDownloading(false)
    }
  }

  const handlePrintDatesheet = () => {
    window.print()
  }

  const selectedCycleName = cycles.find((c) => c.id === selectedCycle)?.name ?? '—'

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-ink">Export & Reports</h1>
        <p className="mt-1 text-sm text-ink-muted">Generate CSVs, download the official datesheet PDF, and browse previous exports.</p>
      </div>

      {/* ── Two-column top area ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* ── CSV Export Card ──────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileDown className="h-5 w-5 text-navy" aria-hidden="true" />
              CSV Export
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-1/2" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Select
                    label="Exam cycle"
                    value={selectedCycle}
                    onChange={setSelectedCycle}
                    options={cycles.map((c) => ({ value: c.id, label: `${c.name} (${c.status})` }))}
                  />
                  <Select
                    label="Department"
                    value={selectedDept}
                    onChange={setSelectedDept}
                    options={[{ value: '', label: 'All departments' }, ...departments.map((d) => ({ value: d.id, label: d.name }))]}
                  />
                  <Select
                    label="Export type"
                    value={selectedType}
                    onChange={(v) => setSelectedType(v as ExportType)}
                    options={[
                      { value: 'schedule', label: 'Schedule (CSV)' },
                      { value: 'roll-no-slips', label: 'Roll No Slips (PDF)' },
                    ]}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <Button onClick={handlePreview} disabled={!selectedCycle || previewLoading}>
                    {previewLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Filter className="h-4 w-4" aria-hidden="true" />}
                    {previewLoading ? 'Loading…' : 'Preview'}
                  </Button>
                  <Button variant="secondary" onClick={handleDownloadCsv} disabled={!selectedCycle || downloading}>
                    {downloading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
                    Download CSV
                  </Button>
                </div>
              </>
            )}

            {/* Preview table */}
            {previewRows.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-line">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-line bg-surface">
                      {['Date', 'Day', 'Time', 'Course', 'Room', 'Status', 'Invigilators'].map((h) => (
                        <th key={h} className="px-3 py-2 font-bold uppercase tracking-wide text-ink-muted">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row) => (
                      <tr key={row.id} className="border-b border-line/50 last:border-b-0">
                        <td className="px-3 py-2 font-medium text-ink">{row.date}</td>
                        <td className="px-3 py-2 text-ink">{new Date(row.date).toLocaleDateString('en-US', { weekday: 'short' })}</td>
                        <td className="px-3 py-2 text-ink">{row.time_slot_label}</td>
                        <td className="px-3 py-2 font-bold text-navy">{row.course_code}</td>
                        <td className="px-3 py-2 text-ink">{row.room_name}</td>
                        <td className="px-3 py-2">
                          <Badge variant={row.status === 'needs_review' ? 'danger' : 'success'}>
                            {row.status === 'needs_review' ? '⚠ Review' : '✓ OK'}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-ink">{row.invigilators?.map((i) => i.name).join(', ') ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {previewRows.length > 0 && (
              <p className="text-xs text-ink-muted">Showing {previewRows.length} of {previewTotal} sessions · Full export downloads all rows.</p>
            )}
          </CardContent>
        </Card>

        {/* ── PDF Datesheet Card ───────────────────────────────────────── */}
        <Card className="print:border-0 print:shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-navy" aria-hidden="true" />
              PDF Datesheet
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-ink-muted">Download the official datesheet as a print-ready PDF document.</p>

            <div className="flex items-center gap-3">
              <Button variant="secondary" onClick={handlePrintDatesheet}>
                <Printer className="h-4 w-4" aria-hidden="true" />
                Print Preview
              </Button>
              <Button variant="secondary" onClick={handleDownloadPdf} disabled={!selectedCycle || downloading}>
                {downloading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
                Download PDF
              </Button>
              <label className="flex items-center gap-2 text-xs font-medium text-ink-muted select-none">
                <input
                  type="checkbox"
                  checked={showWatermark}
                  onChange={(e) => setShowWatermark(e.target.checked)}
                  className="h-4 w-4 rounded border-line accent-navy"
                  aria-label="Toggle confidential watermark"
                />
                Show watermark
              </label>
            </div>

            {/* Live preview when rows loaded */}
            {previewRows.length > 0 ? (
              <div className="relative datesheet-pdf rounded-lg border border-line bg-white p-4 text-ink print:border-0 print:p-0 print:shadow-none">
                {showWatermark && (
                  <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center overflow-hidden print:z-0" aria-hidden="true">
                    <span className="rotate-[-35deg] select-none text-[72px] font-black uppercase tracking-widest text-danger/15">
                      {selectedCycleName.includes('Published') || selectedCycleName.includes('Final') ? 'Official' : 'Confidential'}
                    </span>
                  </div>
                )}
                <div className="flex items-start gap-4 border-b-2 border-navy pb-4 print:border-b print:pb-2">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-gold bg-navy">
                    <span className="text-xs font-black text-gold">AU</span>
                  </div>
                  <div className="min-w-0 text-center flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-navy-muted">Air University</p>
                    <h2 className="mt-1 text-lg font-black tracking-tight text-navy">Date Sheet — {selectedCycleName}</h2>
                    <p className="text-[11px] text-ink-muted">{selectedCycleName}</p>
                  </div>
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-gold bg-navy">
                    <span className="text-[10px] font-black text-gold">2026</span>
                  </div>
                </div>

                <div className="mt-3 overflow-x-auto">
                  <table className="w-full border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-navy text-white">
                        {['Date', 'Time', 'Course', 'Room', 'Status', 'Invigilators'].map((h) => (
                          <th key={h} className="border border-navy-light px-2 py-1.5 text-left font-bold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, i) => (
                        <tr key={row.id} className={i % 2 === 0 ? 'bg-white' : 'bg-surface'}>
                          <td className="border border-line px-2 py-1.5 font-medium">{row.date}</td>
                          <td className="border border-line px-2 py-1.5">{row.time_slot_label}</td>
                          <td className="border border-line px-2 py-1.5 font-bold text-navy">{row.course_code}</td>
                          <td className="border border-line px-2 py-1.5">{row.room_name}</td>
                          <td className="border border-line px-2 py-1.5">{row.status === 'needs_review' ? '⚠ Review' : '✓ OK'}</td>
                          <td className="border border-line px-2 py-1.5">{row.invigilators?.map((inv) => inv.name).join(', ') ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-8 flex items-end justify-between border-t border-line pt-4 print:mt-6">
                  <div className="text-center">
                    <div className="mx-auto h-px w-40 bg-ink" />
                    <p className="mt-1 text-[10px] font-bold text-ink">Prepared by</p>
                    <p className="text-[9px] text-ink-muted">Exam Coordination Cell</p>
                  </div>
                  <div className="text-center">
                    <div className="mx-auto h-px w-40 bg-ink" />
                    <p className="mt-1 text-[10px] font-bold text-ink">Controller of Examinations</p>
                    <p className="text-[9px] text-ink-muted">Air University</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-ink-muted">
                Select a cycle and click <strong>Preview</strong> to see the datesheet here.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Export History ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-navy" aria-hidden="true" />
            Export History
            <Button variant="ghost" size="sm" onClick={refreshHistory} className="ml-auto" disabled={historyLoading} aria-label="Refresh export history">
              <RefreshCw className={`h-3.5 w-3.5 ${historyLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : history.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-7 w-7" aria-hidden="true" />}
              title="No exports yet"
              description="Generate your first export above."
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface">
                    <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-ink-muted">Type</th>
                    <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-ink-muted">Label</th>
                    <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-ink-muted">Filters</th>
                    <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-ink-muted">Rows</th>
                    <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-ink-muted">Generated by</th>
                    <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-ink-muted">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((rec) => {
                    const et = rec.exportType as ExportType
                    return (
                      <tr key={rec.id} className="border-b border-line/50 last:border-b-0 hover:bg-surface/50">
                        <td className="px-4 py-3">
                          <Badge variant={typeBadgeVariant[et] ?? 'info'}>{typeLabel[et] ?? rec.exportType}</Badge>
                        </td>
                        <td className="px-4 py-3 font-medium text-ink">{rec.label}</td>
                        <td className="px-4 py-3 text-ink-muted">{rec.filters}</td>
                        <td className="px-4 py-3 text-ink-muted">{rec.rowCount.toLocaleString()}</td>
                        <td className="px-4 py-3 text-ink-muted">{rec.generatedBy?.name ?? '—'}</td>
                        <td className="px-4 py-3 text-ink-muted">
                          {new Date(rec.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
