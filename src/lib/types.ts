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

export interface CoordinatorKpi {
  id: string
  label: string
  value: string
  hint: string
  icon: LucideIcon
  tone: 'navy' | 'gold' | 'success' | 'danger' | 'warning' | 'info'
  fraction?: { current: number; total: number }
}

export interface ExamDayBrief {
  id: string
  iso: string
  dayLabel: string
  dateLabel: string
  isExamDay: boolean
  sessionCount: number
  hasClash: boolean
}

export interface DashboardActivity {
  id: string
  kind: NotificationKind
  title: string
  detail: string
  minutesAgo: number
}

export interface ClashListItem {
  id: string
  code: string
  title: string
  affected: number
  dateLabel: string
  slot: 'Morning' | 'Afternoon'
  kind: 'same-slot' | 'same-day'
}

export interface CoordinatorQuickAction {
  id: string
  label: string
  description: string
  icon: LucideIcon
  path?: string
}
