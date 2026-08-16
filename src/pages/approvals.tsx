import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Users, XCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Modal } from '@/components/ui/modal'
import { Select } from '@/components/ui/select'
import { DataTable, type Column } from '@/components/ui/data-table'
import { StatusChip } from '@/components/ui/status-chip'
import { Tabs } from '@/components/ui/tabs'
import { EmptyState } from '@/components/ui/empty-state'
import { toast } from '@/components/ui/toast-store'
import { DatesheetCalendar } from '@/components/calendar/datesheet-calendar'
import { approvalKindMeta, type ApprovalKind, type ApprovalRequest } from '@/config/approval-mock'
import { roleLabelFor } from '@/config/roles'
import { formatDateLabel } from '@/config/scheduling-data'
import { approveOverrideRequest, fetchOverrideRequests, rejectOverrideRequest } from '@/services/approvals-service'
import type { ApiOverrideRequest } from '@/lib/types'
import { timeAgo } from '@/lib/visuals'
import { cn } from '@/lib/utils'

type Decision = 'approve' | 'reject'

function minutesSince(iso: string | null): number | null {
  if (!iso) return null
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
}

/** Map the backend override-request shape onto the queue card view-model. */
function toApprovalRequest(r: ApiOverrideRequest): ApprovalRequest {
  const entry = r.target.schedule_entry
  const clash = r.target.clash_record
  const kind: ApprovalKind = r.target_type === 'clash_record' ? 'clash-override' : 'invigilator-override'
  return {
    id: r.id,
    kind,
    title: entry
      ? `${entry.course_code} · ${formatDateLabel(entry.date)} ${entry.time_slot_label}`
      : clash
        ? `Clash override for ${clash.student.reg_id}`
        : 'Override request',
    requester: r.raised_by.name,
    requesterRole: roleLabelFor(r.raised_by.role),
    department: '',
    reason: r.reason,
    courses: entry ? [entry.course_code] : [],
    affectedStudents: clash ? 1 : null,
    detail: entry
      ? `${entry.course_code} · ${entry.course_title} · ${formatDateLabel(entry.date)} · ${entry.time_slot_label} · ${entry.room_name}`
      : clash
        ? `${clash.type} clash · ${clash.severity} severity · ${clash.student.name} (${clash.student.reg_id})`
        : '',
    minutesAgo: minutesSince(r.created_at) ?? 0,
    status: r.status,
    decidedBy: r.decided_by?.name,
    decisionNote: r.remarks ?? undefined,
    decidedMinutesAgo: minutesSince(r.decided_at) ?? undefined,
  }
}

export function ApprovalQueuePage() {
  const [requests, setRequests] = useState<ApprovalRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [pendingDialog, setPendingDialog] = useState<{ request: ApprovalRequest; decision: Decision } | null>(null)
  const [rejectRemarks, setRejectRemarks] = useState('')
  const [rejectError, setRejectError] = useState('')
  const [decisionLoading, setDecisionLoading] = useState(false)
  const [historyKind, setHistoryKind] = useState('')

  const load = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const list = await fetchOverrideRequests({ page_size: 200 })
      setRequests(list.requests.map(toApprovalRequest))
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load the approval queue')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const pending = useMemo(() => requests.filter((r) => r.status === 'pending'), [requests])
  const history = useMemo(() => requests.filter((r) => r.status !== 'pending'), [requests])

  const closeDialog = () => {
    if (decisionLoading) return
    setPendingDialog(null)
    setRejectRemarks('')
    setRejectError('')
  }

  const decide = async (decision: 'approved' | 'rejected') => {
    const target = pendingDialog?.request
    if (!target) return
    if (decision === 'rejected' && !rejectRemarks.trim()) {
      setRejectError('Remarks are required before a request can be rejected.')
      return
    }
    setDecisionLoading(true)
    try {
      const updated =
        decision === 'approved'
          ? await approveOverrideRequest(target.id)
          : await rejectOverrideRequest(target.id, rejectRemarks.trim())
      const mapped = toApprovalRequest(updated)
      setRequests((prev) => prev.map((r) => (r.id === target.id ? mapped : r)))
      setPendingDialog(null)
      setRejectRemarks('')
      setRejectError('')
      toast({
        variant: decision === 'approved' ? 'success' : 'warning',
        title: decision === 'approved' ? 'Request approved' : 'Request rejected',
        description: `${target.title} — ${decision === 'approved' ? 'approved' : 'rejected'} with remarks.`,
      })
    } catch (err) {
      toast({
        variant: 'danger',
        title: decision === 'approved' ? 'Could not approve' : 'Could not reject',
        description: err instanceof Error ? err.message : 'The request may already be decided — refresh the queue.',
      })
    } finally {
      setDecisionLoading(false)
    }
  }

  const pendingCount = pending.length
  const pendingByKind = (kind: ApprovalRequest['kind']) => pending.filter((r) => r.kind === kind).length
  const kindOptions = (Object.keys(approvalKindMeta) as ApprovalRequest['kind'][]).map((k) => ({
    value: k,
    label: approvalKindMeta[k].label,
  }))
  const filteredHistory = historyKind ? history.filter((r) => r.kind === historyKind) : history

  const historyColumns: Column<ApprovalRequest>[] = [
    {
      key: 'request',
      header: 'Request',
      sortable: true,
      sortValue: (r) => r.title,
      render: (r) => {
        const KindIcon = approvalKindMeta[r.kind].icon
        return (
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface">
              <KindIcon className="h-4 w-4 text-navy" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold text-ink">{r.title}</p>
              <Badge variant={approvalKindMeta[r.kind].badge}>{approvalKindMeta[r.kind].shortLabel}</Badge>
            </div>
          </div>
        )
      },
    },
    { key: 'requester', header: 'Requester', sortable: true, sortValue: (r) => r.requester, render: (r) => r.requester },
    {
      key: 'decision',
      header: 'Decision',
      render: (r) => (
        <StatusChip
          status={r.status === 'approved' ? 'no-clash' : 'clash'}
          label={r.status === 'approved' ? 'Approved' : 'Rejected'}
        />
      ),
    },
    {
      key: 'remarks',
      header: 'Remarks',
      className: 'max-w-[240px]',
      render: (r) => <span className="block truncate text-ink-muted" title={r.decisionNote}>{r.decisionNote}</span>,
    },
    { key: 'decidedBy', header: 'Decided by', sortable: true, sortValue: (r) => r.decidedBy ?? '', render: (r) => r.decidedBy },
    {
      key: 'time',
      header: 'Decided',
      sortable: true,
      sortValue: (r) => r.decidedMinutesAgo ?? 0,
      render: (r) => <span className="text-ink-muted">{timeAgo(r.decidedMinutesAgo ?? 0)}</span>,
    },
  ]

  const dialogRequest = pendingDialog?.request

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-ink">Approval Queue</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Review override requests for invigilators, room capacity and clash justifications before they affect the
            published schedule.
          </p>
        </div>
        <Badge variant={pendingCount > 0 ? 'gold' : 'outline'} dot>
          {pendingCount} pending
        </Badge>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryChip label="Pending" value={pendingCount} tone="warning" />
        <SummaryChip label="Invigilator overrides" value={pendingByKind('invigilator-override')} />
        <SummaryChip label="Capacity exceptions" value={pendingByKind('room-capacity')} />
        <SummaryChip label="Clash overrides" value={pendingByKind('clash-override')} tone="danger" />
      </div>

      {loading ? (
        <Card className="mt-6">
          <CardContent className="flex items-center justify-center gap-3 py-10">
            <Loader2 className="h-5 w-5 animate-spin text-navy" aria-hidden="true" />
            <p className="text-sm font-semibold text-ink-muted">Loading the approval queue…</p>
          </CardContent>
        </Card>
      ) : loadError ? (
        <Card className="mt-6">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <AlertTriangle className="h-8 w-8 text-danger" aria-hidden="true" />
            <div>
              <p className="font-bold text-ink">Could not load the approval queue</p>
              <p className="mt-1 text-sm text-ink-muted">{loadError}</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => void load()}>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Retry
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mt-6">
            <Tabs
          defaultValue="queue"
          tabs={[
            {
              value: 'queue',
              label: `Approval Queue (${pendingCount})`,
              content: (
                <div className="space-y-6">
                  {pending.length === 0 ? (
                    <EmptyState
                      icon={<CheckCircle2 className="h-7 w-7 text-success" aria-hidden="true" />}
                      title="Queue is clear"
                      description="Every request has been decided. New override requests will appear here."
                    />
                  ) : (
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                      {pending.map((req) => {
                        const meta = approvalKindMeta[req.kind]
                        const KindIcon = meta.icon
                        return (
                          <Card key={req.id} className="flex flex-col">
                            <CardContent className="flex flex-1 flex-col">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3">
                                  <span
                                    className={cn(
                                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                                      req.kind === 'clash-override'
                                        ? 'bg-danger-light'
                                        : req.kind === 'room-capacity'
                                          ? 'bg-info-light'
                                          : 'bg-warning-light',
                                    )}
                                  >
                                    <KindIcon
                                      className={cn(
                                        'h-5 w-5',
                                        req.kind === 'clash-override'
                                          ? 'text-danger'
                                          : req.kind === 'room-capacity'
                                            ? 'text-info'
                                            : 'text-warning-deep',
                                      )}
                                      aria-hidden="true"
                                    />
                                  </span>
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Badge variant={meta.badge}>{meta.label}</Badge>
                                      <span className="text-[11px] font-medium text-ink-muted/80">
                                        {timeAgo(req.minutesAgo)}
                                      </span>
                                    </div>
                                    <h3 className="mt-1 text-sm font-bold leading-5 text-ink">{req.title}</h3>
                                    <p className="mt-0.5 text-xs text-ink-muted">
                                      {[req.requester, req.requesterRole, req.department].filter(Boolean).join(' · ')}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              <div className="mt-4 rounded-md border border-line bg-surface px-3 py-2.5 text-sm leading-5 text-ink-muted">
                                {req.reason}
                              </div>

                              <dl className="mt-4 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                                <div>
                                  <dt className="font-semibold uppercase tracking-wide text-ink-muted">Affected courses</dt>
                                  <dd className="mt-1 flex flex-wrap gap-1">
                                    {req.courses.length > 0 ? (
                                      req.courses.map((code) => (
                                        <span
                                          key={code}
                                          className="rounded bg-navy/10 px-1.5 py-0.5 font-bold text-navy"
                                        >
                                          {code}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-ink-muted">—</span>
                                    )}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="font-semibold uppercase tracking-wide text-ink-muted">Impact</dt>
                                  <dd className="mt-1 flex items-start gap-1.5 font-semibold text-ink">
                                    <Users className="mt-0.5 h-3.5 w-3.5 text-ink-muted" aria-hidden="true" />
                                    {req.affectedStudents === null
                                      ? 'Affected count not recorded'
                                      : `${req.affectedStudents} students affected`}
                                  </dd>
                                </div>
                              </dl>
                              <p className="mt-2 text-xs text-ink-muted">{req.detail}</p>

                              <div className="mt-4 flex w-full justify-end gap-2 border-t border-line pt-4">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => {
                                    setRejectRemarks('')
                                    setRejectError('')
                                    setPendingDialog({ request: req, decision: 'reject' })
                                  }}
                                >
                                  <XCircle className="h-4 w-4 text-danger" aria-hidden="true" />
                                  Reject
                                </Button>
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => setPendingDialog({ request: req, decision: 'approve' })}
                                >
                                  <CheckCircle2 className="h-4 w-4 text-gold" aria-hidden="true" />
                                  Approve
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  )}

                  <section>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-bold text-ink">Datesheet reference</h2>
                      <Badge variant="outline">Read-only</Badge>
                    </div>
                    <p className="mt-1 text-sm text-ink-muted">
                      The live datesheet for the current cycle — reference it while deciding. Publishing and edits are
                      locked here; changes require an override request.
                    </p>
                    <div className="mt-4">
                      <DatesheetCalendar readOnly />
                    </div>
                  </section>
                </div>
              ),
            },
            {
              value: 'history',
              label: `Decision History (${history.length})`,
              content: (
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Past decisions</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-1">
                      <div className="max-w-xs">
                        <Select
                          label="Filter by request type"
                          placeholder="All request types"
                          clearable
                          value={historyKind}
                          onChange={setHistoryKind}
                          options={kindOptions}
                        />
                      </div>
                      <div className="mt-4">
                        <DataTable
                          columns={historyColumns}
                          data={filteredHistory}
                          getRowKey={(r) => r.id}
                          pageSize={8}
                          emptyTitle="No decisions yet"
                          emptyDescription="Decisions you make in the queue will appear here."
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ),
            },
          ]}
        />
          </div>
        </>
      )}

      {dialogRequest && pendingDialog?.decision === 'approve' && (
        <ConfirmDialog
          open
          onClose={closeDialog}
          onConfirm={() => void decide('approved')}
          title="Approve this request?"
          description={`${dialogRequest.title} by ${dialogRequest.requester} — ${dialogRequest.affectedStudents === null ? 'unknown' : `${dialogRequest.affectedStudents} student(s)`} across ${dialogRequest.courses.length > 0 ? dialogRequest.courses.join(', ') : 'N/A'}. This decision will be recorded in the audit log.`}
          confirmLabel="Approve request"
          cancelLabel="Keep reviewing"
          variant="success"
          loading={decisionLoading}
        />
      )}

      {dialogRequest && pendingDialog?.decision === 'reject' && (
        <Modal
          open
          onClose={closeDialog}
          size="md"
          title="Reject request"
          description="Rejecting a request requires written remarks so the requester understands the decision."
          footer={
            <>
              <Button variant="secondary" onClick={closeDialog} disabled={decisionLoading}>
                Cancel
              </Button>
              <Button variant="danger" onClick={() => void decide('rejected')} loading={decisionLoading}>
                <XCircle className="h-4 w-4" aria-hidden="true" />
                Reject request
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-md border border-danger/25 bg-danger-light/50 px-3 py-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
              <div className="text-sm text-ink-muted">
                <p className="font-semibold text-ink">{dialogRequest.title}</p>
                <p className="mt-0.5">
                  {[dialogRequest.requester, dialogRequest.requesterRole, dialogRequest.department].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>
            <div>
              <label htmlFor="reject-remarks" className="mb-1.5 block text-sm font-medium text-ink">
                Remarks <span className="text-danger">*</span>
              </label>
              <textarea
                id="reject-remarks"
                value={rejectRemarks}
                onChange={(e) => {
                  setRejectRemarks(e.target.value)
                  if (rejectError) setRejectError('')
                }}
                rows={4}
                placeholder="Explain why this request is being rejected…"
                className="w-full rounded-md border border-line bg-card px-3 py-2.5 text-sm text-ink outline-none transition-all duration-150 hover:border-navy-muted/60 focus:border-navy focus:ring-2 focus:ring-navy/15"
              />
              {rejectError && <p className="mt-1.5 text-xs text-danger">{rejectError}</p>}
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function SummaryChip({ label, value, tone }: { label: string; value: number; tone?: 'warning' | 'danger' }) {
  return (
    <div className="rounded-lg border border-line bg-card p-3 shadow-soft">
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      <p className={cn('mt-0.5 text-2xl font-black', tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning-deep' : 'text-navy')}>
        {value}
      </p>
    </div>
  )
}
