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

export type ScheduleStatus = 'scheduled' | 'needs_review'

export interface MockDepartment {
  id: string
  name: string
  code: string
}

export interface MockProgram {
  id: string
  department_id: string
  name: string
  code: string
  duration_years: number
}

export interface MockCourse {
  course_code: string
  title: string
  department_id: string
  credit_hours: number
  program_code: string
}

export interface MockTimeSlot {
  id: string
  label: string
  start_time: string
  end_time: string
}

export interface MockRoom {
  id: string
  name: string
  department_id: string | null
  capacity: number
}

export interface MockInvigilator {
  id: string
  name: string
  department_id: string
  department_name: string
  availability: 'Available' | 'Busy' | 'On leave'
  assigned_count: number
  max_assignments_per_cycle: number
}

export interface MockSection {
  id: string
  course_code: string
  course_title: string
  department_id: string
  program: string
  batch: string
  enrolled_count: number
}

export interface MockScheduleEntry {
  id: string
  exam_cycle_id: string
  section_id: string
  course_code: string
  course_title: string
  department_id: string
  program: string
  batch: string
  date: string
  time_slot_id: string
  time_slot_label: string
  room_id: string
  room_name: string
  room_capacity: number
  enrolled_count: number
  status: ScheduleStatus
  clash_detail?: string
}

export interface ScheduleSummary {
  total: number
  scheduled: number
  needs_review: number
  same_slot: number
  same_day: number
}

export interface ClashHit {
  entry: MockScheduleEntry
  type: 'same_slot' | 'same_day'
  severity: 'high' | 'medium'
}

export interface ClashCandidate {
  program: string
  date: string
  time_slot_id: string
}
