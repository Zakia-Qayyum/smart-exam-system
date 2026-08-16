/**
 * User Account Administration — Step 23.
 *
 * Admin-only account management for the Settings → Users & Roles screen:
 * listing accounts, toggling status (active / disabled), forcing a password
 * change on next sign-in, and resetting a password. A password reset issues a
 * temporary password that is printed to the server console (mirroring the MFA
 * OTP pattern) and flags the account for a forced change on first sign-in.
 *
 * Every mutation writes an audit-log row and refuses to deactivate the admin
 * performing the action to avoid locking the system out.
 */
import { randomBytes } from 'node:crypto'
import { prisma } from '../lib/prisma.js'
import { HttpError } from '../lib/http-error.js'
import { hashPassword } from '../lib/password.js'
import { toFrontendRole, type FrontendRole } from '../lib/roles.js'

export type AdminUserStatus = 'active' | 'disabled'

export interface ApiAdminUser {
  id: string
  name: string
  email: string
  role: FrontendRole
  department_code: string | null
  department_name: string | null
  status: AdminUserStatus
  mfa_enabled: boolean
  must_change_password: boolean
  last_login_at: string | null
}

interface UserRow {
  id: string
  name: string
  email: string
  role: string
  status: string
  mfa_enabled: boolean
  must_change_password: boolean
  last_login_at: Date | null
  department: { code: string; name: string } | null
}

function toApiUser(u: UserRow): ApiAdminUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: toFrontendRole(u.role) ?? 'student',
    department_code: u.department?.code ?? null,
    department_name: u.department?.name ?? null,
    status: u.status === 'disabled' ? 'disabled' : 'active',
    mfa_enabled: u.mfa_enabled,
    must_change_password: u.must_change_password,
    last_login_at: u.last_login_at ? u.last_login_at.toISOString() : null,
  }
}

export async function listUsers(): Promise<ApiAdminUser[]> {
  const rows = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      mfa_enabled: true,
      must_change_password: true,
      last_login_at: true,
      department: { select: { code: true, name: true } },
    },
    orderBy: { name: 'asc' },
  })
  return rows.map(toApiUser)
}

export interface UpdateUserAccountInput {
  status?: 'active' | 'disabled'
  must_change_password?: boolean
}

export async function updateUserAccount(id: string, input: UpdateUserAccountInput, performedBy: string): Promise<ApiAdminUser> {
  const existing = await prisma.user.findUnique({ where: { id } })
  if (!existing) throw new HttpError(404, 'user_not_found', 'User not found')

  const data: { status?: string; must_change_password?: boolean } = {}
  const meta: Record<string, unknown> = {}

  if (input.status !== undefined) {
    if (input.status !== 'active' && input.status !== 'disabled') {
      throw new HttpError(422, 'invalid_status', 'status must be active or disabled')
    }
    if (id === performedBy && input.status === 'disabled') {
      throw new HttpError(409, 'cannot_deactivate_self', 'You cannot deactivate your own account')
    }
    data.status = input.status
    meta.status = input.status
  }

  if (input.must_change_password !== undefined) {
    data.must_change_password = input.must_change_password
    meta.must_change_password = input.must_change_password
  }

  if (Object.keys(data).length === 0) {
    throw new HttpError(422, 'nothing_to_update', 'No fields to update')
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data })
    await tx.auditLog.create({
      data: {
        action_type: 'user.status_update',
        target_type: 'user',
        target_id: id,
        performed_by: performedBy,
        meta: { ...meta, updated_by: performedBy },
      },
    })
  })

  return toApiUser({
    id,
    name: existing.name,
    email: existing.email,
    role: existing.role,
    status: data.status ?? existing.status,
    mfa_enabled: existing.mfa_enabled,
    must_change_password: data.must_change_password ?? existing.must_change_password,
    last_login_at: existing.last_login_at,
    department: await prisma.department.findUnique({
      where: { id: existing.department_id ?? '' },
      select: { code: true, name: true },
    }),
  })
}

export interface ResetPasswordResult {
  email: string
  temporary_password_issued: boolean
}

export async function resetUserPassword(id: string, performedBy: string): Promise<ResetPasswordResult> {
  const existing = await prisma.user.findUnique({ where: { id } })
  if (!existing) throw new HttpError(404, 'user_not_found', 'User not found')

  // 12-char base64url token is comfortable to type and well within policy.
  const temporary = randomBytes(9).toString('base64url')

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: { password_hash: await hashPassword(temporary), must_change_password: true },
    })
    await tx.auditLog.create({
      data: {
        action_type: 'user.password_reset',
        target_type: 'user',
        target_id: id,
        performed_by: performedBy,
        meta: { reset_by: performedBy },
      },
    })
  })

  // Printed to the console exactly like the MFA OTPs — a real deployment would
  // email this instead, but the pattern keeps the demo usable end-to-end.
  console.log(`[reset:console] Temporary password for ${existing.email}: ${temporary}`)

  return { email: existing.email, temporary_password_issued: true }
}

export const adminUsersService = {
  listUsers,
  updateUserAccount,
  resetUserPassword,
}
