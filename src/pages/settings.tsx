import { useMemo, useState } from 'react'
import {
  Archive,
  ArchiveRestore,
  CalendarPlus,
  Check,
  Clock,
  Database,
  DoorOpen,
  KeyRound,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
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
  auditActionMeta,
  mockAuditLog,
  mockDepartments,
  mockExamCycles,
  mockPermissionMatrix,
  mockRooms,
  mockTimeSlots,
  mockUserAccounts,
  permissionMeta,
  type AdminUserAccount,
  type AuditLogEntry,
  type CycleStatus,
  type DeptCoordinatorPermissions,
  type MasterDepartment,
  type MasterExamCycle,
  type MasterRoom,
  type MasterTimeSlot,
  type PermissionKey,
} from '@/config/admin-mock'
import { roleLabels } from '@/config/roles'
import { useAuthStore } from '@/stores/auth-store'
import { timeAgo } from '@/lib/visuals'
import { cn } from '@/lib/utils'

const cycleStatusMeta: Record<CycleStatus, { label: string; badge: 'outline' | 'published' | 'default' }> = {
  draft: { label: 'Draft', badge: 'outline' },
  published: { label: 'Published', badge: 'published' },
  archived: { label: 'Archived', badge: 'default' },
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

function UsersRolesTab() {
  const [users, setUsers] = useState<AdminUserAccount[]>(() => mockUserAccounts())
  const [permissions, setPermissions] = useState<DeptCoordinatorPermissions[]>(() => mockPermissionMatrix())
  const [dialog, setDialog] = useState<{ user: AdminUserAccount; action: UserAction } | null>(null)
  const [busy, setBusy] = useState(false)

  const runAction = (action: UserAction) => {
    const target = dialog?.user
    if (!target) return
    setBusy(true)
    window.setTimeout(() => {
      if (action === 'reset') {
        toast({
          variant: 'success',
          title: 'Reset email sent',
          description: `A password reset link was emailed to ${target.email}.`,
        })
      } else {
        const status = action === 'deactivate' ? 'disabled' : action === 'activate' ? 'active' : 'force-password-change'
        setUsers((prev) => prev.map((u) => (u.id === target.id ? { ...u, status } : u)))
        toast({
          variant: 'success',
          title: action === 'deactivate' ? 'Account deactivated' : action === 'activate' ? 'Account reactivated' : 'Password change forced',
          description:
            action === 'deactivate'
              ? `${target.name} can no longer sign in.`
              : action === 'activate'
                ? `${target.name} can sign in again.`
                : `${target.name} must set a new password on next sign-in.`,
        })
      }
      setBusy(false)
      setDialog(null)
    }, 300)
  }

  const actionMeta: Record<UserAction, { title: string; description: string; confirm: string; variant: 'primary' | 'danger' | 'success' }> = {
    reset: {
      title: 'Reset password?',
      description: `A reset link will be emailed to ${dialog?.user.email ?? 'this user'}. They keep their current session.`,
      confirm: 'Send reset email',
      variant: 'primary',
    },
    force: {
      title: 'Force password change?',
      description: `${dialog?.user.name ?? 'This user'} will be signed out and must create a new password on their next sign-in.`,
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
      render: (u) => <Badge variant="outline">{roleLabels[u.role]}</Badge>,
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
          <Button variant="secondary" size="sm" onClick={() => setDialog({ user: u, action: 'reset' })} title="Send password reset email">
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

  const togglePermission = (permId: string, key: PermissionKey) => {
    setPermissions((prev) =>
      prev.map((p) =>
        p.id === permId ? { ...p, permissions: { ...p.permissions, [key]: !p.permissions[key] } } : p,
      ),
    )
    const target = permissions.find((p) => p.id === permId)
    if (target) {
      const meta = permissionMeta[key]
      toast({
        variant: 'info',
        title: 'Permission updated',
        description: `${target.coordinator} (${target.department}) · ${meta.label} ${target.permissions[key] ? 'revoked' : 'granted'}.`,
      })
    }
  }

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
            Toggle what each department coordinator can do. Changes apply instantly across the system.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
                  const meta = permissionMeta[key]
                  const Icon = meta.icon
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
                          <p className="text-sm font-semibold text-ink">{meta.label}</p>
                          <p className="text-xs leading-4 text-ink-muted">{meta.description}</p>
                        </div>
                      </div>
                      <Toggle
                        checked={enabled}
                        label={`${meta.label} for ${row.coordinator}`}
                        onChange={() => togglePermission(row.id, key)}
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

function MasterDataTab() {
  const [departments, setDepartments] = useState<MasterDepartment[]>(() => mockDepartments())
  const [rooms, setRooms] = useState<MasterRoom[]>(() => mockRooms())
  const [slots, setSlots] = useState<MasterTimeSlot[]>(() => mockTimeSlots())
  const [cycles, setCycles] = useState<MasterExamCycle[]>(() => mockExamCycles())

  const [addTarget, setAddTarget] = useState<AddTarget | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [deleteTarget, setDeleteTarget] = useState<{ label: string; onConfirm: () => void } | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<MasterExamCycle | null>(null)
  const [busy, setBusy] = useState(false)

  const setField = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }))

  const openAdd = (target: AddTarget) => {
    setForm({})
    setAddTarget(target)
  }

  const submitAdd = () => {
    if (!addTarget) return
    if (addTarget === 'department') {
      const name = form.name?.trim()
      const code = form.code?.trim().toUpperCase()
      if (!name || !code) return
      setDepartments((prev) => [...prev, { id: `d-${Date.now()}`, code, name, coordinators: 0 }])
      toast({ variant: 'success', title: 'Department created', description: `${name} (${code}) added to master data.` })
    } else if (addTarget === 'room') {
      const name = form.name?.trim()
      const capacity = Number(form.capacity)
      if (!name || !Number.isFinite(capacity) || capacity <= 0) return
      setRooms((prev) => [...prev, { id: `r-${Date.now()}`, name, capacity, department: form.department || null }])
      toast({ variant: 'success', title: 'Room created', description: `${name} with capacity ${capacity} added.` })
    } else if (addTarget === 'slot') {
      const label = form.label?.trim()
      if (!label || !form.start?.trim() || !form.end?.trim()) return
      setSlots((prev) => [...prev, { id: `t-${Date.now()}`, label, start_time: form.start, end_time: form.end }])
      toast({ variant: 'success', title: 'Time slot created', description: `${label} (${form.start}–${form.end}) added.` })
    } else {
      const name = form.name?.trim()
      const term = form.term?.trim()
      const start = form.start
      const end = form.end
      if (!name || !term || !start || !end || start > end) return
      setCycles((prev) => [
        { id: `c-${Date.now()}`, name, term, start_date: start, end_date: end, status: 'draft' },
        ...prev,
      ])
      toast({ variant: 'success', title: 'Exam cycle created', description: `${name} is now a draft cycle.` })
    }
    setAddTarget(null)
  }

  const confirmDelete = (label: string, onConfirm: () => void) => setDeleteTarget({ label, onConfirm })
  const runDelete = () => {
    setBusy(true)
    window.setTimeout(() => {
      deleteTarget?.onConfirm()
      setBusy(false)
      setDeleteTarget(null)
      toast({ variant: 'success', title: 'Removed', description: deleteTarget?.label })
    }, 250)
  }

  const archiveCycle = () => {
    if (!archiveTarget) return
    setBusy(true)
    window.setTimeout(() => {
      setCycles((prev) => prev.map((c) => (c.id === archiveTarget.id ? { ...c, status: 'archived' } : c)))
      setBusy(false)
      setArchiveTarget(null)
      toast({ variant: 'success', title: 'Cycle archived', description: `${archiveTarget.name} is read-only now.` })
    }, 300)
  }

  const addDisabled = (() => {
    if (!addTarget) return true
    if (addTarget === 'room') return !form.name?.trim() || !(Number(form.capacity) > 0)
    if (addTarget === 'slot') return !form.label?.trim() || !form.start?.trim() || !form.end?.trim()
    if (addTarget === 'cycle') {
      const start = form.start ?? ''
      const end = form.end ?? ''
      return !form.name?.trim() || !form.term?.trim() || !start || !end || start > end
    }
    return !form.name?.trim() || !form.code?.trim()
  })()

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
                  <p className="text-xs text-ink-muted">{d.coordinators} coordinator(s)</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => confirmDelete(`${d.name} department`, () => setDepartments((p) => p.filter((x) => x.id !== d.id)))} aria-label={`Delete ${d.name}`}>
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
                  <p className="text-xs text-ink-muted">{r.department ?? 'General use'}</p>
                </div>
                <Badge variant="outline">{r.capacity} seats</Badge>
                <Button variant="ghost" size="sm" onClick={() => confirmDelete(`${r.name} room`, () => setRooms((p) => p.filter((x) => x.id !== r.id)))} aria-label={`Delete ${r.name}`}>
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
              <CardDescription className="mt-1">Exam session windows per day.</CardDescription>
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
                  <p className="text-xs text-ink-muted">{s.start_time} – {s.end_time}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => confirmDelete(`${s.label} time slot`, () => setSlots((p) => p.filter((x) => x.id !== s.id)))} aria-label={`Delete ${s.label}`}>
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
              <CardDescription className="mt-1">Create cycles, then archive them to make them read-only.</CardDescription>
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
                    {c.term} · {c.start_date} → {c.end_date}
                  </p>
                </div>
                <Badge variant={cycleStatusMeta[c.status].badge} dot>
                  {cycleStatusMeta[c.status].label}
                </Badge>
                {c.status !== 'archived' ? (
                  <Button variant="ghost" size="sm" onClick={() => setArchiveTarget(c)} aria-label={`Archive ${c.name}`}>
                    <Archive className="h-4 w-4 text-ink-muted hover:text-navy" />
                  </Button>
                ) : (
                  <span className="px-2 text-xs text-ink-muted" title="Archived cycles are read-only">
                    <ArchiveRestore className="h-4 w-4" />
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
            <Button variant="primary" onClick={submitAdd} disabled={addDisabled}>
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
                options={departments.map((d) => ({ value: d.code, label: `${d.code} · ${d.name}` }))}
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

      {archiveTarget && (
        <ConfirmDialog
          open
          onClose={() => setArchiveTarget(null)}
          onConfirm={() => void archiveCycle()}
          title="Archive this exam cycle?"
          description={`${archiveTarget.name} becomes read-only. Schedules inside stay visible but editing is locked.`}
          confirmLabel="Archive cycle"
          variant="primary"
          loading={busy}
        />
      )}
    </div>
  )
}

// ── Audit Log ───────────────────────────────────────────────────────────────

function AuditLogTab() {
  const [entries] = useState<AuditLogEntry[]>(() => mockAuditLog())
  const [group, setGroup] = useState('')
  const [query, setQuery] = useState('')

  const groups = useMemo(() => {
    const seen = new Set<string>()
    for (const entry of entries) seen.add(auditActionMeta[entry.action].group)
    return [...seen].map((g) => ({ value: g, label: g }))
  }, [entries])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return entries.filter((entry) => {
      if (group && auditActionMeta[entry.action].group !== group) return false
      if (q) {
        const hay = `${entry.actor} ${entry.detail} ${auditActionMeta[entry.action].label}`.toLowerCase()
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
          <p className="text-xs text-ink-muted">{roleLabels[e.actorRole]}</p>
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      sortable: true,
      sortValue: (e) => auditActionMeta[e.action].label,
      render: (e) => (
        <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          {auditActionMeta[e.action].group}
          <span className="text-ink-muted">·</span>
          {auditActionMeta[e.action].label}
        </span>
      ),
    },
    { key: 'detail', header: 'Detail', className: 'max-w-[340px]', render: (e) => <span className="block truncate text-ink-muted" title={e.detail}>{e.detail}</span> },
  ]

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>Audit log</CardTitle>
          <CardDescription className="mt-1">
            A traceable record of authentication, scheduling, assignment and approval actions. Read-only.
          </CardDescription>
        </div>
        <Badge variant="outline">{filtered.length} events</Badge>
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
