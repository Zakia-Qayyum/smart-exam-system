import {
  ClipboardList,
  FileText,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { Role } from '@/lib/types'

// ── Users & Roles ───────────────────────────────────────────────────────────

export type AdminUserStatus = 'active' | 'disabled' | 'force-password-change'

export interface AdminUserAccount {
  id: string
  name: string
  email: string
  role: Role
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

export function mockUserAccounts(): AdminUserAccount[] {
  return [
    { id: 'u-1', name: 'System Administrator', email: 'admin@airuni.edu.pk', role: 'admin', department: null, status: 'active', mfaEnabled: true, lastActiveMinutesAgo: 4 },
    { id: 'u-2', name: 'Exam Coordinator', email: 'coordinator@airuni.edu.pk', role: 'exam-coordinator', department: 'CS', status: 'active', mfaEnabled: true, lastActiveMinutesAgo: 22 },
    { id: 'u-3', name: 'Hira Khan', email: 'hira.khan@airuni.edu.pk', role: 'dept-coordinator', department: 'SE', status: 'active', mfaEnabled: true, lastActiveMinutesAgo: 60 },
    { id: 'u-4', name: 'Usman Tariq', email: 'usman.tariq@airuni.edu.pk', role: 'invigilator', department: 'CS', status: 'force-password-change', mfaEnabled: true, lastActiveMinutesAgo: null },
    { id: 'u-5', name: 'Sana Malik', email: 'sana.malik@airuni.edu.pk', role: 'dept-coordinator', department: 'EE', status: 'active', mfaEnabled: false, lastActiveMinutesAgo: 140 },
    { id: 'u-6', name: 'Prof. Naveed Akram', email: 'naveed.akram@airuni.edu.pk', role: 'hod', department: 'CS', status: 'active', mfaEnabled: true, lastActiveMinutesAgo: 190 },
    { id: 'u-7', name: 'Ali Raza', email: 'ali.raza@airuni.edu.pk', role: 'invigilator', department: 'MA', status: 'disabled', mfaEnabled: false, lastActiveMinutesAgo: 5200 },
    { id: 'u-8', name: 'Fatima Noor', email: 'au2024cs042@airuni.edu.pk', role: 'student', department: 'CS', status: 'active', mfaEnabled: false, lastActiveMinutesAgo: 300 },
  ]
}

export function mockPermissionMatrix(): DeptCoordinatorPermissions[] {
  return [
    {
      id: 'p-1',
      coordinator: 'Hira Khan',
      department: 'SE',
      permissions: {
        manage_schedule_entries: true,
        manage_invigilators: true,
        approve_overrides: false,
        view_reports: true,
      },
    },
    {
      id: 'p-2',
      coordinator: 'Sana Malik',
      department: 'EE',
      permissions: {
        manage_schedule_entries: true,
        manage_invigilators: false,
        approve_overrides: false,
        view_reports: false,
      },
    },
    {
      id: 'p-3',
      coordinator: 'Bilal Ahmed',
      department: 'MA',
      permissions: {
        manage_schedule_entries: false,
        manage_invigilators: false,
        approve_overrides: false,
        view_reports: true,
      },
    },
  ]
}

// ── Master Data ─────────────────────────────────────────────────────────────

export interface MasterDepartment {
  id: string
  code: string
  name: string
  coordinators: number
}

export interface MasterRoom {
  id: string
  name: string
  capacity: number
  department: string | null
}

export interface MasterTimeSlot {
  id: string
  label: string
  start_time: string
  end_time: string
}

export type CycleStatus = 'draft' | 'published' | 'archived'

export interface MasterExamCycle {
  id: string
  name: string
  term: string
  start_date: string
  end_date: string
  status: CycleStatus
}

export function mockDepartments(): MasterDepartment[] {
  return [
    { id: 'd-1', code: 'CS', name: 'Computer Science', coordinators: 1 },
    { id: 'd-2', code: 'SE', name: 'Software Engineering', coordinators: 1 },
    { id: 'd-3', code: 'EE', name: 'Electrical Engineering', coordinators: 1 },
    { id: 'd-4', code: 'MA', name: 'Mathematics', coordinators: 1 },
    { id: 'd-5', code: 'BA', name: 'Business Administration', coordinators: 0 },
  ]
}

export function mockRooms(): MasterRoom[] {
  return [
    { id: 'r-1', name: 'Hall A', capacity: 80, department: null },
    { id: 'r-2', name: 'Hall B', capacity: 60, department: null },
    { id: 'r-3', name: 'Hall C', capacity: 56, department: null },
    { id: 'r-4', name: 'CS Lab 1', capacity: 40, department: 'CS' },
    { id: 'r-5', name: 'CS Lab 2', capacity: 36, department: 'CS' },
    { id: 'r-6', name: 'Seminar Room', capacity: 24, department: 'SE' },
    { id: 'r-7', name: 'Tutorial Room', capacity: 12, department: null },
  ]
}

export function mockTimeSlots(): MasterTimeSlot[] {
  return [
    { id: 't-1', label: 'Morning', start_time: '09:00', end_time: '12:00' },
    { id: 't-2', label: 'Afternoon', start_time: '14:00', end_time: '17:00' },
    { id: 't-3', label: 'Evening', start_time: '17:30', end_time: '20:30' },
  ]
}

export function mockExamCycles(): MasterExamCycle[] {
  return [
    { id: 'c-1', name: 'Final Examinations Fall 2026', term: 'Fall 2026', start_date: '2026-08-10', end_date: '2026-08-14', status: 'published' },
    { id: 'c-2', name: 'Midterm Examinations Fall 2026', term: 'Fall 2026', start_date: '2026-10-05', end_date: '2026-10-09', status: 'draft' },
    { id: 'c-3', name: 'Final Examinations Spring 2026', term: 'Spring 2026', start_date: '2026-01-05', end_date: '2026-01-16', status: 'archived' },
    { id: 'c-4', name: 'Midterm Examinations Spring 2026', term: 'Spring 2026', start_date: '2026-04-06', end_date: '2026-04-10', status: 'archived' },
  ]
}

// ── Audit Log ───────────────────────────────────────────────────────────────

export type AuditAction =
  | 'auth.login'
  | 'auth.otp_verified'
  | 'auth.logout'
  | 'user.create'
  | 'user.deactivate'
  | 'user.reactivate'
  | 'user.role_change'
  | 'user.force_password_change'
  | 'user.reset_password'
  | 'permission.update'
  | 'schedule.entry_create'
  | 'schedule.entry_delete'
  | 'schedule.publish'
  | 'assignment.create'
  | 'assignment.delete'
  | 'approval.approve'
  | 'approval.reject'
  | 'cycle.create'
  | 'cycle.archive'
  | 'invigilator.import'
  | 'export.run'
  | 'settings.update'

export interface AuditLogEntry {
  id: string
  action: AuditAction
  actor: string
  actorRole: Role
  detail: string
  minutesAgo: number
}

export const auditActionMeta: Record<AuditAction, { label: string; group: string }> = {
  'auth.login': { label: 'Login', group: 'Authentication' },
  'auth.otp_verified': { label: 'MFA verified', group: 'Authentication' },
  'auth.logout': { label: 'Logout', group: 'Authentication' },
  'user.create': { label: 'User created', group: 'Users' },
  'user.deactivate': { label: 'User deactivated', group: 'Users' },
  'user.reactivate': { label: 'User reactivated', group: 'Users' },
  'user.role_change': { label: 'Role changed', group: 'Users' },
  'user.force_password_change': { label: 'Password change forced', group: 'Users' },
  'user.reset_password': { label: 'Password reset', group: 'Users' },
  'permission.update': { label: 'Permissions updated', group: 'Users' },
  'schedule.entry_create': { label: 'Schedule entry created', group: 'Scheduling' },
  'schedule.entry_delete': { label: 'Schedule entry deleted', group: 'Scheduling' },
  'schedule.publish': { label: 'Datesheet published', group: 'Scheduling' },
  'assignment.create': { label: 'Invigilator assigned', group: 'Assignments' },
  'assignment.delete': { label: 'Assignment removed', group: 'Assignments' },
  'approval.approve': { label: 'Request approved', group: 'Approvals' },
  'approval.reject': { label: 'Request rejected', group: 'Approvals' },
  'cycle.create': { label: 'Exam cycle created', group: 'Cycles' },
  'cycle.archive': { label: 'Exam cycle archived', group: 'Cycles' },
  'invigilator.import': { label: 'Invigilators imported', group: 'Assignments' },
  'export.run': { label: 'Report exported', group: 'Reports' },
  'settings.update': { label: 'Settings updated', group: 'Settings' },
}

export function mockAuditLog(): AuditLogEntry[] {
  return [
    { id: 'au-1', action: 'schedule.entry_create', actor: 'Exam Coordinator', actorRole: 'exam-coordinator', detail: 'Created entry CS-202 · 11 Aug · Morning · Hall A', minutesAgo: 18 },
    { id: 'au-2', action: 'assignment.create', actor: 'Exam Coordinator', actorRole: 'exam-coordinator', detail: 'Assigned Usman Tariq to CS-202 on 11 Aug', minutesAgo: 24 },
    { id: 'au-3', action: 'approval.approve', actor: 'Prof. Naveed Akram', actorRole: 'hod', detail: 'Approved capacity exception SE-402', minutesAgo: 55 },
    { id: 'au-4', action: 'user.force_password_change', actor: 'System Administrator', actorRole: 'admin', detail: 'Forced password change for usman.tariq@airuni.edu.pk', minutesAgo: 70 },
    { id: 'au-5', action: 'auth.otp_verified', actor: 'Hira Khan', actorRole: 'dept-coordinator', detail: 'MFA verified from 192.168.1.14', minutesAgo: 96 },
    { id: 'au-6', action: 'schedule.publish', actor: 'Exam Coordinator', actorRole: 'exam-coordinator', detail: 'Published Final Examinations Fall 2026', minutesAgo: 320 },
    { id: 'au-7', action: 'permission.update', actor: 'System Administrator', actorRole: 'admin', detail: 'Granted manage_invigilators to Sana Malik (EE)', minutesAgo: 410 },
    { id: 'au-8', action: 'assignment.delete', actor: 'Exam Coordinator', actorRole: 'exam-coordinator', detail: 'Removed Ali Raza from MA-201 on 12 Aug', minutesAgo: 520 },
    { id: 'au-9', action: 'invigilator.import', actor: 'Exam Coordinator', actorRole: 'exam-coordinator', detail: 'Imported 20 invigilators (18 valid, 2 duplicates)', minutesAgo: 760 },
    { id: 'au-10', action: 'approval.reject', actor: 'Prof. Naveed Akram', actorRole: 'hod', detail: 'Rejected clash override CS-310 / EE-101', minutesAgo: 900 },
    { id: 'au-11', action: 'auth.login', actor: 'Sana Malik', actorRole: 'dept-coordinator', detail: 'Signed in from 192.168.1.40', minutesAgo: 1120 },
    { id: 'au-12', action: 'cycle.create', actor: 'System Administrator', actorRole: 'admin', detail: 'Created Midterm Examinations Fall 2026', minutesAgo: 1560 },
    { id: 'au-13', action: 'user.deactivate', actor: 'System Administrator', actorRole: 'admin', detail: 'Deactivated ali.raza@airuni.edu.pk', minutesAgo: 1840 },
    { id: 'au-14', action: 'export.run', actor: 'Hira Khan', actorRole: 'dept-coordinator', detail: 'Exported SE department datesheet (CSV)', minutesAgo: 2210 },
    { id: 'au-15', action: 'cycle.archive', actor: 'System Administrator', actorRole: 'admin', detail: 'Archived Final Examinations Spring 2026', minutesAgo: 4320 },
    { id: 'au-16', action: 'auth.logout', actor: 'Fatima Noor', actorRole: 'student', detail: 'Signed out from 192.168.1.7', minutesAgo: 5760 },
  ]
}
