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
  createdAt: string
  read: boolean
  link: string
}

export type TickerKind = NotificationKind

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

export interface MockInvigilatorAssignment {
  id: string
  course_code: string
  course_title: string
  date: string
  time_slot_label: string
  room_name: string
  status: 'confirmed' | 'assigned' | 'completed'
}

export interface MockInvigilator {
  id: string
  name: string
  department_id: string
  department_name: string
  availability: 'Available' | 'Busy' | 'On leave'
  assigned_count: number
  max_assignments_per_cycle: number
  designation: string
  email: string
  phone: string
  specialization_tags: string[]
  assignment_history: MockInvigilatorAssignment[]
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

// ── Real API (Steps 9–11) ──────────────────────────────────────────────────

export interface ApiCycle {
  id: string
  name: string
  term: string
  start_date: string
  end_date: string
  status: string
}

export interface ApiDepartment {
  id: string
  code: string
  name: string
}

export interface ApiCourse {
  id: string
  course_code: string
  title: string
  department_id: string
  credit_hours: number
}

export interface ApiSection {
  id: string
  course_id: string
  course_code: string
  title: string
  department_id: string
  batch: string
  semester: string
  enrolled_count: number
}

export interface ApiRoom {
  id: string
  name: string
  department_id: string | null
  capacity: number
}

export interface ApiTimeSlot {
  id: string
  label: string
  start_time: string
  end_time: string
}

export interface ApiInvigilator {
  id: string
  name: string
  department_id: string
}

// ── Invigilator Directory (Step 16 API) ────────────────────────────────────

export interface DirectoryInvigilatorAssignment {
  id: string
  course_code: string
  course_title: string
  date: string
  time_slot_label: string
  room_name: string
  status: 'assigned' | 'confirmed' | 'declined'
}

export interface DirectoryInvigilator {
  id: string
  name: string
  department_id: string
  department_name: string
  availability: 'Available' | 'Busy' | 'On leave'
  assigned_count: number
  max_assignments_per_cycle: number
  designation: string
  email: string
  phone: string
  specialization_tags: string[]
  assignment_history: DirectoryInvigilatorAssignment[]
}

export interface InvigilatorListSummary {
  total: number
  available: number
  busy: number
  on_leave: number
  assigned: number
  max: number
}

export interface InvigilatorList {
  cycle: ApiCycle | null
  invigilators: DirectoryInvigilator[]
  total: number
  page: number
  page_size: number
  summary: InvigilatorListSummary
}

export interface ImportPreviewRow {
  line: number
  name: string
  email: string
  department_raw: string
  department_id: string
  department_name: string
  designation: string
  max_assignments_per_cycle: number | null
  max_raw: string
  specialization_tags: string[]
  errors: string[]
  duplicate: boolean
}

export interface ImportPreviewSummary {
  total: number
  valid: number
  duplicates: number
  invalid: number
}

export interface ImportPreview {
  rows: ImportPreviewRow[]
  summary: ImportPreviewSummary
}

export interface BulkImportResult {
  imported: number
  skippedDuplicates: number
  failed: number
}

export interface InvigilatorCreateInput {
  name: string
  email: string
  department_id: string
  max_assignments_per_cycle?: number
  specialization_tags?: string[]
}

export type InvigilatorUpdateInput = Partial<InvigilatorCreateInput>

export interface SchedulingCatalog {
  cycle: ApiCycle | null
  departments: ApiDepartment[]
  courses: ApiCourse[]
  sections: ApiSection[]
  rooms: ApiRoom[]
  time_slots: ApiTimeSlot[]
  batches: string[]
  invigilators: ApiInvigilator[]
}

export type ApiScheduleStatus = 'scheduled' | 'needs_review'

export interface ApiScheduleEntry {
  id: string
  exam_cycle_id: string
  section_id: string
  course_code: string
  course_title: string
  department_id: string
  department_code: string
  department_name: string
  batch: string
  semester: string
  date: string
  time_slot_id: string
  time_slot_label: string
  room_id: string
  room_name: string
  room_capacity: number
  enrolled_count: number
  status: ApiScheduleStatus
  invigilators: Array<{ id: string; name: string; assignment_id: string; status: 'assigned' | 'confirmed' | 'declined' }>
  created_by: string
  created_at: string
}

export interface ApiCalendarDay {
  date: string
  exams: number
  rooms_used: number
  needs_review: number
  same_slot: number
  same_day: number
  has_clashes: boolean
}

export interface ApiCalendarSummary {
  cycle: ApiCycle
  days: ApiCalendarDay[]
  summary: {
    total_exams: number
    scheduled: number
    needs_review: number
    same_slot: number
    same_day: number
    rooms_used: number
  }
}

export interface ApiCyclePublish {
  cycle: ApiCycle
}

export interface ApiScheduleList {
  entries: ApiScheduleEntry[]
  total: number
  page: number
  page_size: number
  summary: {
    total: number
    scheduled: number
    needs_review: number
    same_slot: number
    same_day: number
  }
}

export interface ApiClashHit {
  type: 'same_slot' | 'same_day'
  severity: 'high' | 'medium'
  student: { id: string; regId: string; name: string }
  conflictEntryId: string
  conflictSectionId: string
  conflictCourseCode: string
  conflictDate: string
  conflictTimeSlotId: string
}

export interface ApiClashCheckResult {
  clashes: ApiClashHit[]
  dayLoadWarnings: ApiClashHit[]
}

export interface ApiSaveResult {
  entry: ApiScheduleEntry
  clashes: ApiClashHit[]
  dayLoadWarnings: ApiClashHit[]
  overridden: boolean
}

export interface ApiClashEntryRef {
  id: string
  date: string
  time_slot_id: string
  time_slot_label: string
  course_code: string
}

export interface ApiClashRecord {
  id: string
  type: 'same_slot' | 'same_day'
  exam_cycle_id: string
  student: { id: string; reg_id: string; name: string }
  schedule_entry_ids: string[]
  entries: ApiClashEntryRef[]
  severity: 'high' | 'medium'
  status: 'open' | 'overridden' | 'resolved'
  override_reason: string | null
  created_at: string
}

export interface ApiClashList {
  clashes: ApiClashRecord[]
  total: number
  page: number
  page_size: number
  summary: {
    open: number
    overridden: number
    resolved: number
    same_slot: number
    same_day: number
  }
}

export interface ApiClashScanResult {
  exam_cycle_id: string
  created: number
  resolved: number
  unchanged: number
  same_slot: number
  same_day: number
  scanned_at: string
}

export interface ApiGenerateResult {
  cycle_id: string
  scheduled: number
  needs_review: number
  same_slot: number
  same_day: number
  entries: ApiScheduleEntry[]
}

export interface ApiGenerateJob {
  id: string
  status: 'running' | 'completed' | 'failed'
  createdAt: string
  completedAt?: string
  result?: ApiGenerateResult
  error?: string
}

export type AssignmentStatus = 'assigned' | 'confirmed' | 'declined'

export interface ApiInvigilatorAssignment {
  id: string
  schedule_entry_id: string
  invigilator_id: string
  invigilator_name: string
  course_code: string
  course_title: string
  department_id: string
  date: string
  time_slot_id: string
  time_slot_label: string
  room_id: string
  room_name: string
  status: AssignmentStatus
}

export interface UnassignedMatrixCell {
  date: string
  time_slot_id: string
  time_slot_label: string
  start_time: string
  end_time: string
  room_id: string
  room_name: string
  room_capacity: number
  schedule_entry_id: string | null
  course_code: string | null
  course_title: string | null
  department_id: string | null
  batch: string | null
  semester: string | null
  enrolled_count: number | null
  invigilators_needed: number
  assigned_invigilators: Array<{ id: string; assignment_id: string; name: string; status: AssignmentStatus }>
  needs_assignment: boolean
}

export interface UnassignedMatrix {
  cycle: ApiCycle
  days: string[]
  time_slots: Array<{ id: string; label: string; start_time: string; end_time: string }>
  rooms: Array<{ id: string; name: string; capacity: number }>
  cells: UnassignedMatrixCell[]
  summary: {
    sessions: number
    with_entries: number
    open_sessions: number
    unassigned_sessions: number
    assigned: number
    seats_remaining: number
  }
}

export interface AutoAssignProposal {
  id: string
  schedule_entry_id: string
  invigilator_id: string
  invigilator_name: string
  course_code: string
  course_title: string
  department_id: string
  date: string
  time_slot_id: string
  time_slot_label: string
  room_id: string
  room_name: string
  reason: string
}

export interface AutoAssignPlan {
  exam_cycle_id: string
  proposals: AutoAssignProposal[]
  summary: { proposed: number; sessions_filled: number; seats_remaining: number; skipped: number }
}

export interface AutoAssignCommitResult {
  committed: number
  skipped: number
  assignments: ApiInvigilatorAssignment[]
  skipped_reasons: Array<{ schedule_entry_id: string; invigilator_id: string; reason: string }>
}

// ── Admin / Approvals (Step 22–23 APIs) ────────────────────────────────────

export type ApiOverrideTargetType = 'schedule_entry' | 'clash_record'
export type ApiOverrideStatus = 'pending' | 'approved' | 'rejected'

export interface ApiOverrideRequest {
  id: string
  target_type: ApiOverrideTargetType
  target_id: string
  reason: string
  status: ApiOverrideStatus
  remarks: string | null
  created_at: string
  decided_at: string | null
  raised_by: { id: string; name: string; email: string; role: string }
  decided_by: { id: string; name: string } | null
  target: {
    schedule_entry?: {
      id: string
      course_code: string
      course_title: string
      date: string
      time_slot_label: string
      room_name: string
      status: string
    }
    clash_record?: {
      id: string
      type: string
      severity: string
      status: string
      student: { reg_id: string; name: string }
      schedule_entry_ids: string[]
    }
  }
}

export interface ApiOverrideRequestList {
  requests: ApiOverrideRequest[]
  total: number
  page: number
  page_size: number
  summary: { pending: number; approved: number; rejected: number }
}

export type PermissionKey =
  | 'manage_schedule_entries'
  | 'manage_invigilators'
  | 'approve_overrides'
  | 'view_reports'

export type PermissionMap = Record<PermissionKey, boolean>

export interface ApiPermissionMatrixAccount {
  id: string
  name: string
  email: string
  role: string
  department_code: string | null
  department_name: string | null
  permissions: PermissionMap
}

export interface ApiDepartmentAdmin {
  id: string
  name: string
  code: string
  rooms_count: number
  invigilators_count: number
  courses_count: number
}

export interface ApiRoomAdmin {
  id: string
  name: string
  capacity: number
  department_id: string | null
  department_code: string | null
  department_name: string | null
}

export interface ApiTimeSlotAdmin {
  id: string
  label: string
  start_time: string
  end_time: string
  exam_cycle_id: string
}

export type CycleStatus = 'draft' | 'published' | 'archived'

export interface ApiExamCycleAdmin {
  id: string
  name: string
  term: string
  start_date: string
  end_date: string
  status: CycleStatus
  created_at: string
  entries_count: number
  time_slots_count: number
}

export interface ApiAuditLogEntry {
  id: string
  action_type: string
  target_type: string
  target_id: string
  performed_by: { id: string; name: string; email: string; role: string } | null
  timestamp: string
  meta: Record<string, unknown> | null
}

export interface ApiAuditLogList {
  entries: ApiAuditLogEntry[]
  total: number
  page: number
  page_size: number
  summary: { actions: Array<{ action_type: string; count: number }> }
}

export type AdminUserStatus = 'active' | 'disabled' | 'force-password-change'

export interface ApiAdminUser {
  id: string
  name: string
  email: string
  role: Role
  department_code: string | null
  department_name: string | null
  status: 'active' | 'disabled'
  mfa_enabled: boolean
  must_change_password: boolean
  last_login_at: string | null
}

// ── Notifications (Step 25 API) ────────────────────────────────────────────

export interface ApiNotification {
  id: string
  type: NotificationKind
  title: string
  body: string | null
  link: string | null
  read: boolean
  read_at: string | null
  created_at: string
}

export interface ApiNotificationList {
  notifications: ApiNotification[]
  total: number
  unread_count: number
  page: number
  page_size: number
}
