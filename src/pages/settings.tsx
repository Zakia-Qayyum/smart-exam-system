import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  CalendarPlus,
  Check,
  Clock,
  Database,
  DoorOpen,
  KeyRound,
  Loader2,
  Lock,
  Megaphone,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Unlock,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Select } from '@/components/ui/select'
import { Tabs } from '@/components/ui/tabs'
import { toast } from '@/components/ui/toast-store'
import {
  adminUserStatusMeta,
  auditMeta,
  permissionMeta,
  type AdminUserAccount,
  type AuditLogEntry,
  type DeptCoordinatorPermissions,
  type PermissionKey,
} from '@/config/admin-mock'
import { roleLabelFor, roleLabels } from '@/config/roles'
import { useAuthStore } from '@/stores/auth-store'
import {
  apiErrorMessage,
  createDepartment,
  createExamCycle,
  createRoom,
  createTimeSlot,
  deleteDepartment,
  deleteExamCycle,
  deleteRoom,
  deleteTimeSlot,
  fetchAdminUsers,
  fetchAuditLog,
  fetchDepartments,
  fetchExamCycles,
  fetchPermissionMatrix,
  fetchRooms,
  fetchTimeSlots,
  publishExamCycle,
  resetUserPassword,
  unlockExamCycle,
  updateAdminUser,
  updatePermissions,
} from '@/services/admin-service'
import { notifyScheduleChanged } from '@/lib/schedule-sync'
import type {
  ApiAdminUser,
  ApiAuditLogEntry,
  ApiDepartmentAdmin,
  ApiExamCycleAdmin,
  ApiPermissionMatrixAccount,
  ApiRoomAdmin,
  ApiTimeSlotAdmin,
  CycleStatus,
} from '@/lib/types'
import { timeAgo } from '@/lib/visuals'
import { cn } from '@/lib/utils'

const cycleStatusMeta: Record<CycleStatus, { label: string; badge: 'outline' | 'published' | 'default' }> = {
  draft: { label: 'Draft', badge: 'outline' },
  published: { label: 'Published', badge: 'published' },
  archived: { label: 'Archived', badge: 'default' },
}

function minutesSince(iso: string | null): number | null {
  if (!iso) return null
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
}

function LoadingState({ label }: { label: string }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-center gap-3 py-10">
        <Loader2 className="h-5 w-5 animate-spin text-navy" aria-hidden="true" />
        <p className="text-sm font-semibold text-ink-muted">{label}</p>
      </CardContent>
    </Card>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <AlertTriangle className="h-8 w-8 text-danger" aria-hidden="true" />
        <div>
          <p className="font-bold text-ink">Could not load this data</p>
          <p className="mt-1 text-sm text-ink-muted">{message}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Retry
        </Button>
      </CardContent>
    </Card>
  )
}

export function AdminSettingsPage() {
  const user = useAuthStore((s) => s.user)
  if (!user) return null
  const isAdmin = user.role === 'admin'

  const tabs = isAdmin
    ? [
        { value: 'users', label: 'Users & Roles', content: <UsersRolesTab /> },
        { value: 'master', label: 'Master Data', content: <MasterDataTab /> },
        { value: 'audit', label: 'Audit Log', content: <AuditLogTab /> },
      ]
    : [{ value: 'master', label: 'Master Data', content: <MasterDataTab /> }]

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-ink">Settings</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {isAdmin
              ? 'Manage accounts, roles and permissions, master data and the audit trail.'
              : 'Exam-cycle master data — departments, rooms, time slots and exam cycles.'}
          </p>
        </div>
        <Badge variant="outline" dot>
          {roleLabels[user.role]}
        </Badge>
      </div>

      <div className="mt-6">
        <Tabs defaultValue={isAdmin ? 'users' : 'master'} tabs={tabs} />
      </div>
    </div>
  )
}

// ── Toggle switch ───────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="flex h-6 w-11 items-center rounded-full bg-line px-0.5 transition-colors data-[checked=true]:bg-success"
      data-checked={checked}
    >
      <span
        className={cn(
          'h-5 w-5 rounded-full bg-white shadow transition-transform',
          checked && 'translate-x-5',
        )}
      />
    </button>
  )
}

// ── Users & Roles ───────────────────────────────────────────────────────────

type UserAction = 'reset' | 'force' | 'deactivate' | 'activate'

function toAccount(u: ApiAdminUser): AdminUserAccount {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    department: u.department_code,
    status: u.status === 'disabled' ? 'disabled' : u.must_change_password ? 'force-password-change' : 'active',
    mfaEnabled: u.mfa_enabled,
    lastActiveMinutesAgo: minutesSince(u.last_login_at),
  }
}

function toPermissionRow(a: ApiPermissionMatrixAccount): DeptCoordinatorPermissions {
  return {
    id: a.id,
    coordinator: a.name,
    department: a.department_code ?? '—',
    permissions: {
      manage_schedule_entries: Boolean(a.permissions.manage_schedule_entries),
      manage_invigilators: Boolean(a.permissions.manage_invigilators),
      approve_overrides: Boolean(a.permissions.approve_overrides),
      view_reports: Boolean(a.permissions.view_reports),
    },
  }
}

function UsersRolesTab() {
  const [users, setUsers] = useState<AdminUserAccount[]>([])
  const [permissions, setPermissions] = useState<DeptCoordinatorPermissions[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [dialog, setDialog] = useState<{ user: AdminUserAccount; action: UserAction } | null>(null)
  const [busy, setBusy] = useState(false)
  const toggling = useRef(new Set<string>())

  const load = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [userList, matrix] = await Promise.all([fetchAdminUsers(), fetchPermissionMatrix()])
      setUsers(userList.map(toAccount))
      setPermissions(matrix.map(toPermissionRow))
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load users and permissions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const runAction = async (action: UserAction) => {
    const target = dialog?.user
    if (!target) return
    setBusy(true)
    try {
      if (action === 'reset') {
        await resetUserPassword(target.id)
        setUsers((prev) => prev.map((u) => (u.id === target.id ? { ...u, status: 'force-password-change' } : u)))
        toast({
          variant: 'success',
          title: 'Password reset',
          description: `A temporary password was issued for ${target.email} — shown in the server console.`,
        })
      } else if (action === 'force') {
        await updateAdminUser(target.id, { must_change_password: true })
        setUsers((prev) => prev.map((u) => (u.id === target.id ? { ...u, status: 'force-password-change' } : u)))
        toast({
          variant: 'success',
          title: 'Password change forced',
          description: `${target.name} must set a new password on next sign-in.`,
        })
      } else if (action === 'deactivate') {
        await updateAdminUser(target.id, { status: 'disabled' })
        setUsers((prev) => prev.map((u) => (u.id === target.id ? { ...u, status: 'disabled' } : u)))
        toast({
          variant: 'success',
          title: 'Account deactivated',
          description: `${target.name} can no longer sign in.`,
        })
      } else {
        await updateAdminUser(target.id, { status: 'active' })
        setUsers((prev) => prev.map((u) => (u.id === target.id ? { ...u, status: 'active' } : u)))
        toast({
          variant: 'success',
          title: 'Account reactivated',
          description: `${target.name} can sign in again.`,
        })
      }
      setDialog(null)
    } catch (err) {
      toast({
        variant: 'danger',
        title: 'Action failed',
        description: apiErrorMessage(err, 'The account could not be updated.'),
      })
    } finally {
      setBusy(false)
    }
  }

  const actionMeta: Record<UserAction, { title: string; description: string; confirm: string; variant: 'primary' | 'danger' | 'success' }> = {
    reset: {
      title: 'Reset password?',
      description: `A temporary password will be issued for ${dialog?.user.email ?? 'this user'} and shown in the server console. They must set a new one on next sign-in.`,
      confirm: 'Reset password',
      variant: 'primary',
    },
    force: {
      title: 'Force password change?',
      description: `${dialog?.user.name ?? 'This user'} must create a new password on their next sign-in.`,
      confirm: 'Force password change',
      variant: 'primary',
    },
    deactivate: {
      title: 'Deactivate account?',
      description: `${dialog?.user.name ?? 'This user'} will be blocked from signing in until reactivated. Their data is kept.`,
      confirm: 'Deactivate account',
      variant: 'danger',
    },
    activate: {
      title: 'Reactivate account?',
      description: `${dialog?.user.name ?? 'This user'} will be able to sign in again.`,
      confirm: 'Reactivate account',
      variant: 'success',
    },
  }

  const columns: Column<AdminUserAccount>[] = [
    {
      key: 'name',
      header: 'Account',
      sortable: true,
      sortValue: (u) => u.name,
      render: (u) => (
        <div className="min-w-0">
          <p className="font-semibold text-ink">{u.name}</p>
          <p className="truncate text-xs text-ink-muted">{u.email}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      sortable: true,
      sortValue: (u) => u.role,
      render: (u) => <Badge variant="outline">{roleLabelFor(u.role)}</Badge>,
    },
    { key: 'department', header: 'Department', sortable: true, sortValue: (u) => u.department ?? '', render: (u) => u.department ?? '—' },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (u) => adminUserStatusMeta[u.status].label,
      render: (u) => {
        const meta = adminUserStatusMeta[u.status]
        return <Badge variant={meta.badge} dot>{meta.label}</Badge>
      },
    },
    {
      key: 'mfa',
      header: 'MFA',
      render: (u) =>
        u.mfaEnabled ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
            <ShieldCheck className="h-3.5 w-3.5" /> On
          </span>
        ) : (
          <span className="text-xs font-medium text-ink-muted">Off</span>
        ),
    },
    {
      key: 'lastActive',
      header: 'Last active',
      sortable: true,
      sortValue: (u) => u.lastActiveMinutesAgo ?? Number.MAX_SAFE_INTEGER,
      render: (u) => (u.lastActiveMinutesAgo === null ? 'Never' : timeAgo(u.lastActiveMinutesAgo)),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (u) => (
        <div className="flex flex-wrap justify-end gap-1.5">
          <Button variant="secondary" size="sm" onClick={() => setDialog({ user: u, action: 'reset' })} title="Issue a temporary password">
            <KeyRound className="h-3.5 w-3.5" /> Reset
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDialog({ user: u, action: 'force' })} title="Force a password change on next sign-in">
            <RotateCcw className="h-3.5 w-3.5" /> Force
          </Button>
          {u.status === 'disabled' ? (
            <Button variant="secondary" size="sm" onClick={() => setDialog({ user: u, action: 'activate' })} title="Reactivate account">
              <UserCheck className="h-3.5 w-3.5 text-success" /> Activate
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => setDialog({ user: u, action: 'deactivate' })} title="Deactivate account">
              <XCircle className="h-3.5 w-3.5 text-danger" /> Deactivate
            </Button>
          )}
        </div>
      ),
    },
  ]

  const togglePermission = async (permId: string, key: PermissionKey) => {
    if (toggling.current.has(permId)) return
    toggling.current.add(permId)
    const row = permissions.find((p) => p.id === permId)
    if (!row) {
      toggling.current.delete(permId)
      return
    }
    const nextValue = !row.permissions[key]
    const meta = permissionMeta[key]
    setPermissions((prev) =>
      prev.map((p) => (p.id === permId ? { ...p, permissions: { ...p.permissions, [key]: nextValue } } : p)),
    )
    try {
      const merged = await updatePermissions(permId, { [key]: nextValue })
      setPermissions((prev) =>
        prev.map((p) => (p.id === permId ? { ...p, permissions: { ...p.permissions, ...merged } } : p)),
      )
      toast({
        variant: 'success',
        title: 'Permission updated',
        description: `${row.coordinator} (${row.department}) · ${meta.label} ${nextValue ? 'granted' : 'revoked'}.`,
      })
    } catch (err) {
      setPermissions((prev) =>
        prev.map((p) => (p.id === permId ? { ...p, permissions: { ...p.permissions, [key]: !nextValue } } : p)),
      )
      toast({
        variant: 'danger',
        title: 'Could not update permission',
        description: apiErrorMessage(err, 'The permission was not changed.'),
      })
    } finally {
      toggling.current.delete(permId)
    }
  }

  if (loading) return <LoadingState label="Loading users and permissions…" />
  if (loadError) return <ErrorState message={loadError} onRetry={() => void load()} />

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>User accounts</CardTitle>
            <CardDescription className="mt-1">
              Reset passwords, force password changes and deactivate accounts. Every action is confirmed first and
              written to the audit log.
            </CardDescription>
          </div>
          <Badge variant="outline">{users.length} accounts</Badge>
        </CardHeader>
        <CardContent className="pt-1">
          <DataTable columns={columns} data={users} getRowKey={(u) => u.id} pageSize={8} emptyTitle="No accounts" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Permission Manager</CardTitle>
          <CardDescription className="mt-1">
            Toggle what each department coordinator can do. Changes are enforced server-side on their next request.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {permissions.length === 0 && (
            <p className="text-sm text-ink-muted">No department coordinators exist yet.</p>
          )}
          {permissions.map((row) => (
            <div key={row.id} className="rounded-lg border border-line bg-surface/60 p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-navy/10">
                  <Users className="h-4 w-4 text-navy" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-ink">{row.coordinator}</p>
                  <p className="text-xs text-ink-muted">{row.department} department coordinator</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {(Object.keys(permissionMeta) as PermissionKey[]).map((key) => {
                  const permMeta = permissionMeta[key]
                  const Icon = permMeta.icon
                  const enabled = row.permissions[key]
                  return (
                    <div
                      key={key}
                      className={cn(
                        'flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2.5 transition-colors',
                        enabled ? 'border-success/30' : 'border-line',
                      )}
                    >
                      <div className="flex min-w-0 items-start gap-2.5">
                        <Icon
                          className={cn('mt-0.5 h-4 w-4 shrink-0', enabled ? 'text-success' : 'text-ink-muted')}
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink">{permMeta.label}</p>
                          <p className="text-xs leading-4 text-ink-muted">{permMeta.description}</p>
                        </div>
                      </div>
                      <Toggle
                        checked={enabled}
                        label={`${permMeta.label} for ${row.coordinator}`}
                        onChange={() => void togglePermission(row.id, key)}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {dialog && (
        <ConfirmDialog
          open
          onClose={() => setDialog(null)}
          onConfirm={() => void runAction(dialog.action)}
          title={actionMeta[dialog.action].title}
          description={actionMeta[dialog.action].description}
          confirmLabel={actionMeta[dialog.action].confirm}
          cancelLabel="Cancel"
          variant={actionMeta[dialog.action].variant}
          loading={busy}
        />
      )}
    </div>
  )
}

// ── Master Data ─────────────────────────────────────────────────────────────

type AddTarget = 'department' | 'room' | 'slot' | 'cycle'
type CycleAction = 'publish' | 'unlock' | 'delete'

function MasterDataTab() {
  const [departments, setDepartments] = useState<ApiDepartmentAdmin[]>([])
  const [rooms, setRooms] = useState<ApiRoomAdmin[]>([])
  const [slots, setSlots] = useState<ApiTimeSlotAdmin[]>([])
  const [cycles, setCycles] = useState<ApiExamCycleAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [addTarget, setAddTarget] = useState<AddTarget | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [deleteTarget, setDeleteTarget] = useState<{ label: string; onConfirm: () => Promise<void> } | null>(null)
  const [cycleDialog, setCycleDialog] = useState<{ cycle: ApiExamCycleAdmin; action: CycleAction } | null>(null)
  const [busy, setBusy] = useState(false)

  const load = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [dept, room, slot, cyc] = await Promise.all([
        fetchDepartments(),
        fetchRooms(),
        fetchTimeSlots(),
        fetchExamCycles({ page_size: 200 }),
      ])
      setDepartments(dept)
      setRooms(room)
      setSlots(slot)
      setCycles(cyc.cycles)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load master data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const setField = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }))
  const cycleName = (id: string) => cycles.find((c) => c.id === id)?.name ?? id

  const openAdd = (target: AddTarget) => {
    setForm({})
    setAddTarget(target)
  }

  const submitAdd = async () => {
    if (!addTarget) return
    setBusy(true)
    try {
      if (addTarget === 'department') {
        const name = form.name?.trim()
        const code = form.code?.trim().toUpperCase()
        if (!name || !code) return
        const created = await createDepartment({ name, code })
        setDepartments((prev) => [...prev, created])
        toast({ variant: 'success', title: 'Department created', description: `${name} (${code}) added to master data.` })
      } else if (addTarget === 'room') {
        const name = form.name?.trim()
        const capacity = Number(form.capacity)
        if (!name || !Number.isFinite(capacity) || capacity <= 0) return
        const created = await createRoom({ name, capacity, department_id: form.department?.trim() || null })
        setRooms((prev) => [...prev, created])
        toast({ variant: 'success', title: 'Room created', description: `${name} with capacity ${capacity} added.` })
      } else if (addTarget === 'slot') {
        const label = form.label?.trim()
        if (!label || !form.start?.trim() || !form.end?.trim() || !form.cycle?.trim()) return
        const created = await createTimeSlot({
          label,
          start_time: form.start,
          end_time: form.end,
          exam_cycle_id: form.cycle,
        })
        setSlots((prev) => [...prev, created])
        toast({ variant: 'success', title: 'Time slot created', description: `${label} (${form.start}–${form.end}) added.` })
      } else {
        const name = form.name?.trim()
        const term = form.term?.trim()
        const start = form.start
        const end = form.end
        if (!name || !term || !start || !end || start > end) return
        const created = await createExamCycle({ name, term, start_date: start, end_date: end })
        setCycles((prev) => [created, ...prev])
        toast({ variant: 'success', title: 'Exam cycle created', description: `${name} is now a draft cycle.` })
      }
      setAddTarget(null)
    } catch (err) {
      toast({
        variant: 'danger',
        title: 'Could not save',
        description: apiErrorMessage(err, 'The entry could not be created.'),
      })
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = (label: string, onConfirm: () => Promise<void>) => setDeleteTarget({ label, onConfirm })

  const runDelete = async () => {
    if (!deleteTarget) return
    setBusy(true)
    try {
      await deleteTarget.onConfirm()
      setDeleteTarget(null)
      toast({ variant: 'success', title: 'Removed', description: deleteTarget.label })
    } catch (err) {
      toast({
        variant: 'danger',
        title: 'Could not remove',
        description: apiErrorMessage(err, 'The entry could not be removed.'),
      })
    } finally {
      setBusy(false)
    }
  }

  const runCycleAction = async () => {
    const target = cycleDialog
    if (!target) return
    setBusy(true)
    try {
      if (target.action === 'delete') {
        await deleteExamCycle(target.cycle.id)
        setCycles((prev) => prev.filter((c) => c.id !== target.cycle.id))
        toast({ variant: 'success', title: 'Cycle deleted', description: `${target.cycle.name} was removed.` })
      } else if (target.action === 'publish') {
        const updated = await publishExamCycle(target.cycle.id)
        setCycles((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
        notifyScheduleChanged()
        toast({ variant: 'success', title: 'Cycle published', description: `${updated.name} is live — editing is locked.` })
      } else {
        const updated = await unlockExamCycle(target.cycle.id)
        setCycles((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
        notifyScheduleChanged()
        toast({ variant: 'success', title: 'Cycle unlocked', description: `${updated.name} is editable again (draft).` })
      }
      setCycleDialog(null)
    } catch (err) {
      toast({
        variant: 'danger',
        title: 'Action failed',
        description: apiErrorMessage(err, 'The exam cycle could not be updated.'),
      })
    } finally {
      setBusy(false)
    }
  }

  const cycleDialogMeta = (() => {
    if (!cycleDialog) return null
    const { cycle, action } = cycleDialog
    if (action === 'publish') {
      return {
        title: 'Publish this exam cycle?',
        description: `${cycle.name} goes live — timetable edits are locked until an admin unlocks it. Everyone with an entry in the cycle is notified.`,
        confirm: 'Publish cycle',
        variant: 'primary' as const,
      }
    }
    if (action === 'unlock') {
      return {
        title: 'Unlock this exam cycle?',
        description: `${cycle.name} returns to draft — the timetable can be edited again.`,
        confirm: 'Unlock cycle',
        variant: 'primary' as const,
      }
    }
    return {
      title: 'Delete this exam cycle?',
      description: `${cycle.name} will be removed from master data. Only empty draft cycles can be deleted.`,
      confirm: 'Delete cycle',
      variant: 'danger' as const,
    }
  })()

  const addDisabled = (() => {
    if (!addTarget) return true
    if (addTarget === 'room') return !form.name?.trim() || !(Number(form.capacity) > 0)
    if (addTarget === 'slot') return !form.label?.trim() || !form.start?.trim() || !form.end?.trim() || !form.cycle?.trim()
    if (addTarget === 'cycle') {
      const start = form.start ?? ''
      const end = form.end ?? ''
      return !form.name?.trim() || !form.term?.trim() || !start || !end || start > end
    }
    return !form.name?.trim() || !form.code?.trim()
  })()

  if (loading) return <LoadingState label="Loading master data…" />
  if (loadError) return <ErrorState message={loadError} onRetry={() => void load()} />

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Departments</CardTitle>
              <CardDescription className="mt-1">Academic departments used across the system.</CardDescription>
            </div>
            <Button variant="secondary" size="sm" onClick={() => openAdd('department')}>
              <Plus className="h-4 w-4" /> Add
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {departments.map((d) => (
              <div key={d.id} className="flex items-center gap-3 rounded-md border border-line bg-card px-3 py-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-navy/10 text-xs font-black text-navy">
                  {d.code}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{d.name}</p>
                  <p className="text-xs text-ink-muted">{d.rooms_count} rooms · {d.courses_count} courses</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => confirmDelete(`${d.name} department`, async () => { await deleteDepartment(d.id); setDepartments((p) => p.filter((x) => x.id !== d.id)) })} aria-label={`Delete ${d.name}`}>
                  <Trash2 className="h-4 w-4 text-ink-muted hover:text-danger" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Rooms</CardTitle>
              <CardDescription className="mt-1">Exam venues with seating capacity.</CardDescription>
            </div>
            <Button variant="secondary" size="sm" onClick={() => openAdd('room')}>
              <Plus className="h-4 w-4" /> Add
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {rooms.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-md border border-line bg-card px-3 py-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface text-navy">
                  <DoorOpen className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{r.name}</p>
                  <p className="text-xs text-ink-muted">{r.department_name ?? 'General use'}</p>
                </div>
                <Badge variant="outline">{r.capacity} seats</Badge>
                <Button variant="ghost" size="sm" onClick={() => confirmDelete(`${r.name} room`, async () => { await deleteRoom(r.id); setRooms((p) => p.filter((x) => x.id !== r.id)) })} aria-label={`Delete ${r.name}`}>
                  <Trash2 className="h-4 w-4 text-ink-muted hover:text-danger" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Time Slots</CardTitle>
              <CardDescription className="mt-1">Exam session windows per day, tied to a cycle.</CardDescription>
            </div>
            <Button variant="secondary" size="sm" onClick={() => openAdd('slot')}>
              <Plus className="h-4 w-4" /> Add
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {slots.map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded-md border border-line bg-card px-3 py-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface text-navy">
                  <Clock className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{s.label}</p>
                  <p className="text-xs text-ink-muted">{s.start_time} – {s.end_time} · {cycleName(s.exam_cycle_id)}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => confirmDelete(`${s.label} time slot`, async () => { await deleteTimeSlot(s.id); setSlots((p) => p.filter((x) => x.id !== s.id)) })} aria-label={`Delete ${s.label}`}>
                  <Trash2 className="h-4 w-4 text-ink-muted hover:text-danger" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Exam Cycles</CardTitle>
              <CardDescription className="mt-1">
                Publish a cycle to lock the timetable; unlock it later to apply corrections.
              </CardDescription>
            </div>
            <Button variant="secondary" size="sm" onClick={() => openAdd('cycle')}>
              <CalendarPlus className="h-4 w-4" /> Create
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {cycles.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-md border border-line bg-card px-3 py-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface text-navy">
                  <Database className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{c.name}</p>
                  <p className="text-xs text-ink-muted">
                    {c.term} · {c.start_date} → {c.end_date} · {c.entries_count} entries
                  </p>
                </div>
                <Badge variant={cycleStatusMeta[c.status].badge} dot>
                  {cycleStatusMeta[c.status].label}
                </Badge>
                {c.status === 'draft' && (
                  <>
                    <Button variant="secondary" size="sm" onClick={() => setCycleDialog({ cycle: c, action: 'publish' })} title="Publish this cycle">
                      <Megaphone className="h-3.5 w-3.5" /> Publish
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setCycleDialog({ cycle: c, action: 'delete' })} title="Delete this cycle" aria-label="Delete this cycle">
                      <Trash2 className="h-4 w-4 text-ink-muted hover:text-danger" />
                    </Button>
                  </>
                )}
                {c.status === 'published' && (
                  <Button variant="secondary" size="sm" onClick={() => setCycleDialog({ cycle: c, action: 'unlock' })} title="Unlock this cycle for corrections">
                    <Unlock className="h-3.5 w-3.5" /> Unlock
                  </Button>
                )}
                {c.status === 'archived' && (
                  <span className="px-2 text-xs text-ink-muted" title="Archived cycles are permanently read-only">
                    <Lock className="h-4 w-4" />
                  </span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Modal
        open={addTarget !== null}
        onClose={() => setAddTarget(null)}
        size="md"
        title={addTarget === 'department' ? 'Add department' : addTarget === 'room' ? 'Add room' : addTarget === 'slot' ? 'Add time slot' : 'Create exam cycle'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddTarget(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void submitAdd()} disabled={addDisabled || busy} loading={busy}>
              <Check className="h-4 w-4" />
              {addTarget === 'cycle' ? 'Create cycle' : 'Add'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {addTarget === 'department' && (
            <>
              <Input label="Department name" required value={form.name ?? ''} onChange={(e) => setField('name', e.target.value)} placeholder="e.g. Computer Science" />
              <Input label="Code" required value={form.code ?? ''} onChange={(e) => setField('code', e.target.value)} placeholder="e.g. CS" />
            </>
          )}
          {addTarget === 'room' && (
            <>
              <Input label="Room name" required value={form.name ?? ''} onChange={(e) => setField('name', e.target.value)} placeholder="e.g. Hall D" />
              <Input label="Capacity" type="number" min={1} required value={form.capacity ?? ''} onChange={(e) => setField('capacity', e.target.value)} placeholder="e.g. 60" />
              <Select
                label="Department (optional)"
                placeholder="General use"
                clearable
                value={form.department ?? ''}
                onChange={(v) => setField('department', v)}
                options={departments.map((d) => ({ value: d.id, label: `${d.code} · ${d.name}` }))}
              />
            </>
          )}
          {addTarget === 'slot' && (
            <>
              <Input label="Label" required value={form.label ?? ''} onChange={(e) => setField('label', e.target.value)} placeholder="e.g. Morning" />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Start time" type="time" required value={form.start ?? ''} onChange={(e) => setField('start', e.target.value)} />
                <Input label="End time" type="time" required value={form.end ?? ''} onChange={(e) => setField('end', e.target.value)} />
              </div>
              <Select
                label="Exam cycle"
                placeholder="Select a cycle…"
                value={form.cycle ?? ''}
                onChange={(v) => setField('cycle', v)}
                options={cycles.map((c) => ({ value: c.id, label: c.name }))}
              />
            </>
          )}
          {addTarget === 'cycle' && (
            <>
              <Input label="Cycle name" required value={form.name ?? ''} onChange={(e) => setField('name', e.target.value)} placeholder="e.g. Final Examinations Fall 2026" />
              <Input label="Term" required value={form.term ?? ''} onChange={(e) => setField('term', e.target.value)} placeholder="e.g. Fall 2026" />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Start date" type="date" required value={form.start ?? ''} onChange={(e) => setField('start', e.target.value)} />
                <Input label="End date" type="date" required value={form.end ?? ''} onChange={(e) => setField('end', e.target.value)} />
              </div>
              {form.start && form.end && form.start > form.end && (
                <p className="text-xs text-danger">End date must not be before the start date.</p>
              )}
            </>
          )}
        </div>
      </Modal>

      {deleteTarget && (
        <ConfirmDialog
          open
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => void runDelete()}
          title="Remove this entry?"
          description={`${deleteTarget.label} will be removed from master data. This is recorded in the audit log.`}
          confirmLabel="Remove"
          variant="danger"
          loading={busy}
        />
      )}

      {cycleDialog && cycleDialogMeta && (
        <ConfirmDialog
          open
          onClose={() => setCycleDialog(null)}
          onConfirm={() => void runCycleAction()}
          title={cycleDialogMeta.title}
          description={cycleDialogMeta.description}
          confirmLabel={cycleDialogMeta.confirm}
          cancelLabel="Cancel"
          variant={cycleDialogMeta.variant}
          loading={busy}
        />
      )}
    </div>
  )
}

// ── Audit Log ───────────────────────────────────────────────────────────────

function toAuditEntry(e: ApiAuditLogEntry): AuditLogEntry {
  return {
    id: e.id,
    action: e.action_type,
    actor: e.performed_by?.name ?? 'System',
    actorRole: e.performed_by?.role ?? 'admin',
    detail: auditDetail(e),
    minutesAgo: minutesSince(e.timestamp) ?? 0,
  }
}

function auditDetail(e: ApiAuditLogEntry): string {
  const meta = (e.meta ?? {}) as Record<string, unknown>
  const label = e.action_type.split('.').slice(1).join('.').replace(/_/g, ' ')

  if (typeof meta.name === 'string') return `${label}: ${meta.name}`

  if (e.action_type === 'user.permissions_update' && meta.permissions && typeof meta.permissions === 'object') {
    const map = meta.permissions as Record<string, boolean>
    const bits = Object.entries(map)
      .map(([key, value]) => `${key.replace(/_/g, ' ')} ${value ? 'on' : 'off'}`)
      .join(', ')
    return `permissions → ${bits}`
  }

  if (e.action_type === 'override_request.create' && typeof meta.reason === 'string') {
    return `reason: ${meta.reason}`
  }

  return label
}

function AuditLogTab() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [group, setGroup] = useState('')
  const [query, setQuery] = useState('')

  const load = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const list = await fetchAuditLog({ page_size: 200 })
      setEntries(list.entries.map(toAuditEntry))
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load the audit log')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const groups = useMemo(() => {
    const seen = new Set<string>()
    for (const entry of entries) seen.add(auditMeta(entry.action).group)
    return [...seen].map((g) => ({ value: g, label: g }))
  }, [entries])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return entries.filter((entry) => {
      if (group && auditMeta(entry.action).group !== group) return false
      if (q) {
        const hay = `${entry.actor} ${entry.detail} ${auditMeta(entry.action).label}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [entries, group, query])

  const columns: Column<AuditLogEntry>[] = [
    {
      key: 'time',
      header: 'When',
      sortable: true,
      sortValue: (e) => e.minutesAgo,
      render: (e) => (
        <span className="whitespace-nowrap text-xs font-medium text-ink-muted">{timeAgo(e.minutesAgo)}</span>
      ),
    },
    {
      key: 'actor',
      header: 'Actor',
      sortable: true,
      sortValue: (e) => e.actor,
      render: (e) => (
        <div className="min-w-0">
          <p className="font-semibold text-ink">{e.actor}</p>
          <p className="text-xs text-ink-muted">{roleLabelFor(e.actorRole)}</p>
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      sortable: true,
      sortValue: (e) => auditMeta(e.action).label,
      render: (e) => {
        const meta = auditMeta(e.action)
        return (
          <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            {meta.group}
            <span className="text-ink-muted">·</span>
            {meta.label}
          </span>
        )
      },
    },
    { key: 'detail', header: 'Detail', className: 'max-w-[340px]', render: (e) => <span className="block truncate text-ink-muted" title={e.detail}>{e.detail}</span> },
  ]

  if (loading) return <LoadingState label="Loading the audit log…" />
  if (loadError) return <ErrorState message={loadError} onRetry={() => void load()} />

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>Audit log</CardTitle>
          <CardDescription className="mt-1">
            A traceable record of authentication, scheduling, assignment and approval actions. Read-only.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{filtered.length} events</Badge>
          <Button variant="ghost" size="sm" onClick={() => void load()} title="Refresh the audit log" aria-label="Refresh the audit log">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-1">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Select
            label="Category"
            placeholder="All categories"
            clearable
            value={group}
            onChange={setGroup}
            options={groups}
          />
          <div className="sm:col-span-2">
            <Input
              label="Search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Actor, action or details…"
            />
          </div>
        </div>
        <div className="mt-4">
          <DataTable
            columns={columns}
            data={filtered}
            getRowKey={(e) => e.id}
            pageSize={8}
            emptyTitle="No matching events"
            emptyDescription="Adjust the filters or clear the search to see more of the audit trail."
          />
        </div>
      </CardContent>
    </Card>
  )
}
