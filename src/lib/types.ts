import type { LucideIcon } from 'lucide-react'

export type Role =
  | 'admin'
  | 'exam-coordinator'
  | 'dept-coordinator'
  | 'hod'
  | 'invigilator'
  | 'student'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: Role
  department: string | null
  mustChangePassword: boolean
  mfaEnabled: boolean
}

export type NotificationKind = 'clash' | 'published' | 'assignment' | 'approval' | 'info'

export interface MockNotification {
  id: string
  kind: NotificationKind
  title: string
  body: string
  minutesAgo: number
  read: boolean
  link: string
}

export type TickerKind = 'clash' | 'published' | 'assignment' | 'info'

export interface TickerItem {
  id: string
  kind: TickerKind
  text: string
  isNew: boolean
}

export interface NavItem {
  label: string
  path: string
  icon: LucideIcon
}

export interface DashboardStat {
  label: string
  value: string
  hint: string
  tone: 'navy' | 'gold' | 'success' | 'danger' | 'warning' | 'info'
}
