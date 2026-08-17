import { useMemo, useState } from 'react'
import {
  Download,
  FileDown,
  FileText,
  Filter,
  Loader2,
  Printer,
  Clock,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import { toast } from '@/components/ui/toast-store'
import { useAuthStore } from '@/stores/auth-store'
import {
  mockCycles,
  mockDepartments,
  mockExportTypes,
  mockExportHistory,
  mockCsvPreview,
  mockDatesheetPreview,
} from '@/config/mock-data'
import type { MockExportRecord, ExportType } from '@/lib/types'

const typeBadgeVariant: Record<ExportType, 'info' | 'gold' | 'success' | 'purple'> = {
  schedule: 'info',
  'roll-no-slips': 'gold',
  invigilators: 'success',
  'audit-log': 'purple',
}

const typeLabel: Record<ExportType, string> = {
  schedule: 'Schedule',
  'roll-no-slips': 'Roll No Slips',
  invigilators: 'Invigilator Roster',
  'audit-log': 'Audit Log',
}

export function ReportsPage() {
  const user = useAuthStore((s) => s.user)

  // ── Filter builder state ──────────────────────────────────────────────
  const [selectedCycle, setSelectedCycle] = useState(mockCycles[0]?.id ?? '')
  const [selectedDept, setSelectedDept] = useState('')
  const [selectedType, setSelectedType] = useState<ExportType>('schedule')
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(false)

  // ── History ───────────────────────────────────────────────────────────
  const [history, setHistory] = useState<MockExportRecord[]>(mockExportHistory)

  const csvPreview = useMemo(() => mockCsvPreview(), [])
  const datesheetRows = useMemo(() => mockDatesheetPreview(), [])
  const csvHeaders = csvPreview.length > 0 ? Object.keys(csvPreview[0]) : []

  const selectedCycleName = mockCycles.find((c) => c.id === selectedCycle)?.name ?? '—'
  const selectedDeptLabel = mockDepartments.find((d) => d.id === selectedDept)?.name ?? 'All departments'

  const filtersLabel = `${selectedCycleName} · ${selectedDeptLabel}`

  // ── Handlers ──────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    setGenerating(true)
    setGenerated(false)
    // Simulate generation delay
    await new Promise((r) => setTimeout(r, 1200))
    const now = new Date().toISOString()
    const record: MockExportRecord = {
      id: `ex-${Date.now()}`,
      type: selectedType,
      label: `${typeLabel[selectedType]} — ${selectedCycleName}`,
      filename: `${selectedType}-${selectedCycleName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.csv`,
      generatedAt: now,
      generatedBy: user?.name ?? 'Unknown',
      rowCount: csvPreview.length,
      filters: filtersLabel,
    }
    setHistory((prev) => [record, ...prev])
    setGenerated(true)
    setGenerating(false)
    toast({ variant: 'success', title: 'Export generated', description: `${record.label} is ready to download.` })
  }

  const handleDownload = () => {
    if (!generated) return
    const headerRow = csvHeaders.join(',')
    const dataRows = csvPreview.map((row) => csvHeaders.map((h) => row[h]).join(',')).join('\n')
    const csv = `${headerRow}\n${dataRows}`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedType}-${selectedCycleName.toLowerCase().replace(/\s+/g, '-')}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast({ variant: 'success', title: 'Downloaded', description: 'CSV file saved.' })
  }

  const handlePrintDatesheet = () => {
    window.print()
  }

  const handleDownloadPdf = () => {
    toast({ variant: 'info', title: 'PDF generation', description: 'Full PDF export will be available in a future step.' })
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-ink">Export & Reports</h1>
        <p className="mt-1 text-sm text-ink-muted">Generate CSVs, preview the official datesheet PDF, and browse previous exports.</p>
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Select
                label="Exam cycle"
                value={selectedCycle}
                onChange={setSelectedCycle}
                options={mockCycles.map((c) => ({ value: c.id, label: `${c.name} (${c.status})` }))}
              />
              <Select
                label="Department"
                value={selectedDept}
                onChange={setSelectedDept}
                options={[{ value: '', label: 'All departments' }, ...mockDepartments.map((d) => ({ value: d.id, label: d.name }))]}
              />
              <Select
                label="Export type"
                value={selectedType}
                onChange={(v) => { setSelectedType(v as ExportType); setGenerated(false) }}
                options={mockExportTypes.map((t) => ({ value: t.value, label: t.label }))}
              />
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={handleGenerate} disabled={generating || !selectedCycle}>
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Filter className="h-4 w-4" aria-hidden="true" />
                )}
                {generating ? 'Generating…' : 'Generate preview'}
              </Button>
              {generated && (
                <Button variant="secondary" onClick={handleDownload}>
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Download CSV
                </Button>
              )}
            </div>

            {/* Preview table */}
            {generated && (
              <div className="overflow-x-auto rounded-lg border border-line">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-line bg-surface">
                      {csvHeaders.map((h) => (
                        <th key={h} className="px-3 py-2 font-bold uppercase tracking-wide text-ink-muted">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreview.map((row, i) => (
                      <tr key={i} className="border-b border-line/50 last:border-b-0">
                        {csvHeaders.map((h) => (
                          <td key={h} className="px-3 py-2 text-ink">{row[h]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {generated && (
              <p className="text-xs text-ink-muted">{csvPreview.length} rows previewed · Full export will contain all matching records.</p>
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
            <p className="text-sm text-ink-muted">Live preview of the official datesheet document styled for print.</p>

            <div className="flex items-center gap-3">
              <Button variant="secondary" onClick={handlePrintDatesheet}>
                <Printer className="h-4 w-4" aria-hidden="true" />
                Print
              </Button>
              <Button variant="secondary" onClick={handleDownloadPdf}>
                <Download className="h-4 w-4" aria-hidden="true" />
                Download PDF
              </Button>
            </div>

            {/* Print-ready document preview */}
            <div className="datesheet-pdf rounded-lg border border-line bg-white p-4 text-ink print:border-0 print:p-0 print:shadow-none">
              {/* Header */}
              <div className="flex items-start gap-4 border-b-2 border-navy pb-4 print:border-b print:pb-2">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-gold bg-navy">
                  <span className="text-xs font-black text-gold">AU</span>
                </div>
                <div className="min-w-0 text-center flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-navy-muted">Air University</p>
                  <h2 className="mt-1 text-lg font-black tracking-tight text-navy">
                    Date Sheet — {selectedCycleName}
                  </h2>
                  <p className="text-[11px] text-ink-muted">Final Examinations · {selectedCycleName}</p>
                </div>
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-gold bg-navy">
                  <span className="text-[10px] font-black text-gold">2026</span>
                </div>
              </div>

              {/* Bordered table */}
              <div className="mt-3 overflow-x-auto">
                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-navy text-white">
                      {['Date', 'Day', 'Time', 'Course', 'Title', 'Room', 'Invigilator'].map((h) => (
                        <th key={h} className="border border-navy-light px-2 py-1.5 text-left font-bold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {datesheetRows.map((row, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-surface'}>
                        <td className="border border-line px-2 py-1.5 font-medium">{row.date}</td>
                        <td className="border border-line px-2 py-1.5">{row.day}</td>
                        <td className="border border-line px-2 py-1.5">{row.timeSlot}</td>
                        <td className="border border-line px-2 py-1.5 font-bold text-navy">{row.courseCode}</td>
                        <td className="border border-line px-2 py-1.5">{row.courseTitle}</td>
                        <td className="border border-line px-2 py-1.5">{row.room}</td>
                        <td className="border border-line px-2 py-1.5">{row.invigilator}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Signature line */}
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
          </CardContent>
        </Card>
      </div>

      {/* ── Export History ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-navy" aria-hidden="true" />
            Export History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
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
                    <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wide text-ink-muted">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((rec) => {
                    return (
                      <tr key={rec.id} className="border-b border-line/50 last:border-b-0 hover:bg-surface/50">
                        <td className="px-4 py-3">
                          <Badge variant={typeBadgeVariant[rec.type]}>{typeLabel[rec.type]}</Badge>
                        </td>
                        <td className="px-4 py-3 font-medium text-ink">{rec.label}</td>
                        <td className="px-4 py-3 text-ink-muted">{rec.filters}</td>
                        <td className="px-4 py-3 text-ink-muted">{rec.rowCount.toLocaleString()}</td>
                        <td className="px-4 py-3 text-ink-muted">{rec.generatedBy}</td>
                        <td className="px-4 py-3 text-ink-muted">
                          {new Date(rec.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="ghost" size="sm" onClick={() => toast({ variant: 'info', title: 'Download', description: `${rec.filename} — download simulated.` })}>
                            <Download className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
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
