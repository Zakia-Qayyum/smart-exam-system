import {
  ClipboardList,
  FileText,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react'

// ── Users & Roles ───────────────────────────────────────────────────────────

export type AdminUserStatus = 'active' | 'disabled' | 'force-password-change'

export interface AdminUserAccount {
  id: string
  name: string
  email: string
  role: string
  department: string | null
  status: AdminUserStatus
  mfaEnabled: boolean
  lastActiveMinutesAgo: number | null
}

export const adminUserStatusMeta: Record<AdminUserStatus, { label: string; badge: 'success' | 'danger' | 'warning' }> = {
  active: { label: 'Active', badge: 'success' },
  disabled: { label: 'Disabled', badge: 'danger' },
  'force-password-change': { label: 'Must change password', badge: 'warning' },
}

export type PermissionKey =
  | 'manage_schedule_entries'
  | 'manage_invigilators'
  | 'approve_overrides'
  | 'view_reports'

export interface DeptCoordinatorPermissions {
  id: string
  coordinator: string
  department: string
  permissions: Record<PermissionKey, boolean>
}

export interface PermissionMeta {
  label: string
  description: string
  icon: LucideIcon
}

export const permissionMeta: Record<PermissionKey, PermissionMeta> = {
  manage_schedule_entries: {
    label: 'Manage schedule entries',
    description: 'Create, edit and remove timetable entries for their department.',
    icon: ClipboardList,
  },
  manage_invigilators: {
    label: 'Manage invigilators',
    description: 'Assign and reassign invigilation duties for department sessions.',
    icon: Users,
  },
  approve_overrides: {
    label: 'Approve overrides',
    description: 'Sign off override requests raised against published schedules.',
    icon: ShieldCheck,
  },
  view_reports: {
    label: 'View reports',
    description: 'Read departmental reports and export duties.',
    icon: FileText,
  },
}

// ── Audit Log ───────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string
  action: string
  actor: string
  actorRole: string
  detail: string
  minutesAgo: number
}

const AUDIT_GROUPS: Array<{ prefix: string; group: string }> = [
  { prefix: 'auth.', group: 'Authentication' },
  { prefix: 'override_request.', group: 'Approvals' },
  { prefix: 'user.', group: 'Users' },
  { prefix: 'permission.', group: 'Users' },
  { prefix: 'schedule.', group: 'Scheduling' },
  { prefix: 'clash.', group: 'Clashes' },
  { prefix: 'assignment.', group: 'Assignments' },
  { prefix: 'invigilator.', group: 'Assignments' },
  { prefix: 'cycle.', group: 'Cycles' },
  { prefix: 'exam_cycle.', group: 'Cycles' },
  { prefix: 'department.', group: 'Master data' },
  { prefix: 'room.', group: 'Master data' },
  { prefix: 'time_slot.', group: 'Master data' },
]

/**
 * Label + category for a real backend audit action_type (e.g.
 * `override_request.approve` → "Approve" under "Approvals"). Unknown action
 * types degrade to a humanised fallback instead of crashing.
 */
export function auditMeta(action: string): { label: string; group: string } {
  const group = AUDIT_GROUPS.find((g) => action.startsWith(g.prefix))?.group ?? 'Other'
  const verb = action.slice(action.indexOf('.') + 1)
  const label = verb
    ? verb.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
    : action
  return { label, group }
}
