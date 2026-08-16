/**
 * Granular RBAC permissions (Step 22).
 *
 * The four toggles mirror the Step 21 admin "Permission Manager" screen. They
 * govern what a department coordinator is allowed to do; admin and
 * exam-coordinator accounts hold every permission implicitly (they are the
 * full-access operators of the system). Permissions are stored as a JSON map
 * on the `users.permissions` column and read by the requirePermission
 * middleware on every protected request — they are not decorative.
 */
export const PERMISSION_KEYS = [
  'manage_schedule_entries',
  'manage_invigilators',
  'approve_overrides',
  'view_reports',
] as const

export type PermissionKey = (typeof PERMISSION_KEYS)[number]

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  manage_schedule_entries: 'Manage schedule entries',
  manage_invigilators: 'Manage invigilators',
  approve_overrides: 'Approve override requests',
  view_reports: 'View reports',
}

export type PermissionMap = Partial<Record<PermissionKey, boolean>>

/** Roles that implicitly hold every permission. */
export const FULL_ACCESS_ROLES = ['admin', 'exam-coordinator'] as const

export const ALL_PERMISSIONS_TRUE: Required<PermissionMap> = {
  manage_schedule_entries: true,
  manage_invigilators: true,
  approve_overrides: true,
  view_reports: true,
}

/** Keep only known keys with an explicit `true` value. Unknown or false → dropped. */
export function normalizePermissions(raw: unknown): PermissionMap {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {}
  const out: PermissionMap = {}
  for (const key of PERMISSION_KEYS) {
    if ((raw as Record<string, unknown>)[key] === true) out[key] = true
  }
  return out
}

export function hasPermission(stored: unknown, key: PermissionKey): boolean {
  return normalizePermissions(stored)[key] === true
}

/** The effective permission set for a role given its stored map. */
export function effectivePermissions(role: string, stored: unknown): PermissionMap {
  if ((FULL_ACCESS_ROLES as readonly string[]).includes(role)) return { ...ALL_PERMISSIONS_TRUE }
  return normalizePermissions(stored)
}
