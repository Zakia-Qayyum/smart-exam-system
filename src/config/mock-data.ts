import {
  CalendarClock,
  CalendarPlus,
  FileDown,
  FileText,
  Send,
  Siren,
  Upload,
  Users,
} from 'lucide-react'
import type {
  ClashListItem,
  CoordinatorKpi,
  CoordinatorQuickAction,
  DashboardActivity,
  DashboardStat,
  ExamDayBrief,
  MockNotification,
  Role,
  TickerItem,
} from '@/lib/types'

export interface DemoAccount {
  email: string
  password: string
  role: Role
  requiresMfa: boolean
  mustChangePassword: boolean
  isLocked: boolean
  label: string
}

export const demoAccounts: DemoAccount[] = [
  { email: 'admin@airuni.edu.pk', password: 'Password@123', role: 'admin', requiresMfa: true, mustChangePassword: false, isLocked: false, label: 'Admin' },
  { email: 'coordinator@airuni.edu.pk', password: 'Password@123', role: 'exam-coordinator', requiresMfa: true, mustChangePassword: false, isLocked: false, label: 'Exam Coordinator' },
  { email: 'usman.tariq@airuni.edu.pk', password: 'Password@123', role: 'invigilator', requiresMfa: true, mustChangePassword: true, isLocked: false, label: 'Invigilator (force password change)' },
  { email: 'au2024cs042@airuni.edu.pk', password: 'Password@123', role: 'student', requiresMfa: false, mustChangePassword: false, isLocked: false, label: 'Student (no MFA)' },
]

const unread = (n: number): Pick<MockNotification, 'read' | 'minutesAgo'> => ({ read: false, minutesAgo: n })
const read = (n: number): Pick<MockNotification, 'read' | 'minutesAgo'> => ({ read: true, minutesAgo: n })

export function mockNotifications(role: Role): MockNotification[] {
  switch (role) {
    case 'student':
      return [
        { id: 's1', kind: 'published', title: 'Datesheet published', body: 'Fall-2026 final exams start 10 Aug 2026.', ...read(180), link: '/my-datesheet' },
        { id: 's2', kind: 'info', title: 'Roll no slip ready', body: 'Your roll no slip is available to download.', ...unread(45), link: '/my-datesheet' },
        { id: 's3', kind: 'info', title: 'Exam venue changed', body: 'CS-202 moves to Hall B for the 11 Aug session.', ...unread(20), link: '/my-datesheet' },
        { id: 's4', kind: 'info', title: 'Invigilator request', body: 'Room CS Lab 1 will now be supervised by faculty.', ...read(600), link: '/notifications' },
        { id: 's5', kind: 'info', title: 'Welcome', body: 'Your student account is active for Fall-2026.', ...read(4320), link: '/notifications' },
      ]
    case 'invigilator':
      return [
        { id: 'i1', kind: 'assignment', title: 'New assignment', body: 'CS-201 (Data Structures) on 11 Aug, Morning slot, Hall A.', ...unread(12), link: '/my-assignments' },
        { id: 'i2', kind: 'assignment', title: 'Assignment confirmed', body: 'SE-101 on 10 Aug, Afternoon, Hall C.', ...unread(60), link: '/my-assignments' },
        { id: 'i3', kind: 'info', title: 'Availability window opens', body: 'Set your availability for the Aug 10\u201314 cycle.', ...unread(90), link: '/my-availability' },
        { id: 'i4', kind: 'published', title: 'Briefing session', body: 'Invigilator briefing on 8 Aug at 14:00 in the Auditorium.', ...read(240), link: '/notifications' },
        { id: 'i5', kind: 'info', title: 'Handbook updated', body: 'The 2026 invigilation handbook has been revised.', ...read(1440), link: '/notifications' },
      ]
    case 'hod':
      return [
        { id: 'h1', kind: 'approval', title: 'Approval requested', body: 'Room change for CS-202 — awaiting your decision.', ...unread(8), link: '/approvals' },
        { id: 'h2', kind: 'clash', title: 'New clash flagged', body: 'One student has two exams on 11 Aug.', ...unread(35), link: '/approvals' },
        { id: 'h3', kind: 'published', title: 'Datesheet draft ready', body: 'The Fall-2026 datesheet draft is ready for review.', ...read(200), link: '/calendar' },
        { id: 'h4', kind: 'info', title: 'Report generated', body: 'Department load report for Fall-2026 is ready.', ...read(700), link: '/reports' },
        { id: 'h5', kind: 'info', title: 'Semester reminders', body: 'Grade submissions open after the exam cycle.', ...read(2880), link: '/notifications' },
      ]
    case 'dept-coordinator':
      return [
        { id: 'd1', kind: 'clash', title: 'Department clash', body: '2 sections in CS overlap in the Afternoon slot on 12 Aug.', ...unread(15), link: '/scheduling' },
        { id: 'd2', kind: 'published', title: 'Schedules generated', body: 'CS department timetable draft generated.', ...unread(70), link: '/calendar' },
        { id: 'd3', kind: 'assignment', title: 'Invigilators needed', body: '3 CS exams still need an invigilator.', ...read(300), link: '/invigilators' },
        { id: 'd4', kind: 'info', title: 'Room confirmed', body: 'CS Lab 1 confirmed for the 11 Aug session.', ...read(500), link: '/scheduling' },
        { id: 'd5', kind: 'info', title: 'Cycle opens', body: 'The Fall-2026 cycle is now in draft.', ...read(1440), link: '/calendar' },
      ]
    case 'exam-coordinator':
      return [
        { id: 'e1', kind: 'clash', title: '241 clashes detected', body: 'Same-slot and same-day conflicts found in the draft timetable.', ...unread(5), link: '/clashes' },
        { id: 'e2', kind: 'published', title: 'Timetable draft ready', body: 'Fall-2026 timetable generated with 32 sessions.', ...unread(25), link: '/calendar' },
        { id: 'e3', kind: 'assignment', title: '64 invigilator slots', body: 'Assignments drafted — 8 still pending confirmation.', ...unread(40), link: '/assignments' },
        { id: 'e4', kind: 'info', title: 'Room utilization', body: '11 rooms booked; Auditorium free on 14 Aug.', ...read(120), link: '/scheduling' },
        { id: 'e5', kind: 'info', title: 'Override request', body: 'Coordinator requested a room change for CS-202.', ...read(90), link: '/clashes' },
        { id: 'e6', kind: 'info', title: 'Backup scheduled', body: 'Backup invigilators configured for the cycle.', ...read(300), link: '/assignments' },
      ]
    case 'admin':
      return [
        { id: 'a1', kind: 'clash', title: 'Clash spike', body: 'Same-slot conflicts increased in the latest draft.', ...unread(6), link: '/clashes' },
        { id: 'a2', kind: 'approval', title: 'User role change', body: 'Hira Khan granted dept-coordinator for CS.', ...unread(30), link: '/users' },
        { id: 'a3', kind: 'info', title: 'Audit exported', body: 'A user exported the audit log to CSV.', ...read(200), link: '/audit-log' },
        { id: 'a4', kind: 'published', title: 'Cycle published', body: 'Fall-2026 cycle status moved to draft by Exam Cell.', ...read(400), link: '/scheduling' },
        { id: 'a5', kind: 'info', title: 'System health ok', body: 'API and database reported healthy.', ...read(1440), link: '/dashboard' },
      ]
  }
}

export function mockTicker(role: Role): TickerItem[] {
  switch (role) {
    case 'student':
      return [
        { id: 't-s1', kind: 'published', text: 'Datesheet published — final exams run 10\u201314 Aug 2026.', isNew: true },
        { id: 't-s2', kind: 'info', text: 'CS-202 moves to Hall B on 11 Aug.', isNew: true },
        { id: 't-s3', kind: 'info', text: 'Roll no slips available under My Datesheet.', isNew: false },
      ]
    case 'invigilator':
      return [
        { id: 't-i1', kind: 'assignment', text: 'You have 1 unconfirmed assignment for 11 Aug.', isNew: true },
        { id: 't-i2', kind: 'info', text: 'Briefing session 8 Aug, 14:00, Auditorium.', isNew: false },
        { id: 't-i3', kind: 'info', text: 'Availability window closes 9 Aug 23:59.', isNew: false },
      ]
    case 'hod':
      return [
        { id: 't-h1', kind: 'clash', text: '1 override request awaiting your approval.', isNew: true },
        { id: 't-h2', kind: 'info', text: 'Department load report is ready to review.', isNew: false },
      ]
    case 'dept-coordinator':
      return [
        { id: 't-d1', kind: 'clash', text: '2 CS sections overlap in the Afternoon slot on 12 Aug.', isNew: true },
        { id: 't-d2', kind: 'published', text: 'CS timetable draft generated.', isNew: true },
        { id: 't-d3', kind: 'info', text: '3 CS exams still need invigilators.', isNew: false },
      ]
    case 'exam-coordinator':
      return [
        { id: 't-e1', kind: 'clash', text: '241 clashes detected in the draft timetable — 12 same-slot.', isNew: true },
        { id: 't-e2', kind: 'published', text: 'Timetable draft ready with 32 sessions across 5 days.', isNew: true },
        { id: 't-e3', kind: 'info', text: '8 invigilator assignments still pending confirmation.', isNew: false },
      ]
    case 'admin':
      return [
        { id: 't-a1', kind: 'clash', text: 'Same-slot conflicts increased in the latest draft.', isNew: true },
        { id: 't-a2', kind: 'info', text: 'New dept-coordinator role granted for CS.', isNew: true },
        { id: 't-a3', kind: 'info', text: 'All services healthy.', isNew: false },
      ]
  }
}

export function mockStats(role: Role): DashboardStat[] {
  switch (role) {
    case 'student':
      return [
        { label: 'Exams in cycle', value: '6', hint: 'Aug 10\u201314', tone: 'navy' },
        { label: 'Exam days', value: '4', hint: '1 morning, 3 afternoon', tone: 'gold' },
        { label: 'Clashes', value: '0', hint: 'No conflicts found', tone: 'success' },
      ]
    case 'invigilator':
      return [
        { label: 'Assigned sessions', value: '4', hint: '2 confirmed', tone: 'navy' },
        { label: 'Pending confirm', value: '2', hint: 'Due 9 Aug', tone: 'warning' },
        { label: 'Availability', value: '5 days', hint: 'Set for the cycle', tone: 'success' },
      ]
    case 'hod':
      return [
        { label: 'Dept sessions', value: '14', hint: 'CS / SE / MA', tone: 'navy' },
        { label: 'Pending approvals', value: '2', hint: '1 clash, 1 room', tone: 'warning' },
        { label: 'Dept clashes', value: '3', hint: '2 same-slot', tone: 'danger' },
      ]
    case 'dept-coordinator':
      return [
        { label: 'Dept sessions', value: '14', hint: 'CS Fall-2026', tone: 'navy' },
        { label: 'Dept clashes', value: '3', hint: '1 needs review', tone: 'danger' },
        { label: 'Rooms booked', value: '5', hint: 'of 6 available', tone: 'info' },
      ]
    case 'exam-coordinator':
      return [
        { label: 'Sessions scheduled', value: '32', hint: '5-day cycle', tone: 'navy' },
        { label: 'Open clashes', value: '241', hint: '12 same-slot', tone: 'danger' },
        { label: 'Invigilator slots', value: '64', hint: '56 confirmed', tone: 'info' },
        { label: 'Rooms in use', value: '11', hint: '1 free', tone: 'gold' },
      ]
    case 'admin':
      return [
        { label: 'Users', value: '212', hint: '6 roles', tone: 'navy' },
        { label: 'Open clashes', value: '241', hint: 'across the cycle', tone: 'danger' },
        { label: 'Audit events', value: '1.2k', hint: 'this cycle', tone: 'info' },
        { label: 'Services', value: 'All up', hint: 'API + database', tone: 'success' },
      ]
  }
}

const CYCLE_LABEL = 'Fall-2026'
const FIRST_EXAM_ISO = '2026-08-10'

const CYCLE_EXAM_DAYS: Record<string, { sessionCount: number; hasClash: boolean }> = {
  '2026-08-10': { sessionCount: 6, hasClash: true },
  '2026-08-11': { sessionCount: 7, hasClash: true },
  '2026-08-12': { sessionCount: 6, hasClash: true },
  '2026-08-13': { sessionCount: 7, hasClash: false },
  '2026-08-14': { sessionCount: 6, hasClash: false },
}

function localIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

export function mockExamDays(): ExamDayBrief[] {
  const days: ExamDayBrief[] = []
  const now = new Date()
  for (let i = 0; i < 7; i++) {
    const d = new Date(now)
    d.setDate(now.getDate() + i)
    const iso = localIso(d)
    const exam = CYCLE_EXAM_DAYS[iso]
    days.push({
      id: `day-${i}`,
      iso,
      dayLabel: d.toLocaleDateString('en-US', { weekday: 'short' }),
      dateLabel: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      isExamDay: Boolean(exam),
      sessionCount: exam?.sessionCount ?? 0,
      hasClash: exam?.hasClash ?? false,
    })
  }
  return days
}

export function mockCoordinatorDashboard(): {
  hasActiveCycle: boolean
  cycleLabel: string
  kpis: CoordinatorKpi[]
  examDays: ExamDayBrief[]
  activity: DashboardActivity[]
  clashes: ClashListItem[]
  quickActions: CoordinatorQuickAction[]
} {
  const firstExam = new Date(`${FIRST_EXAM_ISO}T00:00:00`)
  const now = new Date()
  const daysToFirst = Math.max(0, Math.ceil((firstExam.getTime() - now.getTime()) / 86_400_000))
  const firstExamLabel = new Date(FIRST_EXAM_ISO).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })

  const kpis: CoordinatorKpi[] = [
    {
      id: 'kpi-papers',
      label: 'Papers Scheduled',
      value: '142/160',
      hint: 'of 160 papers in cycle',
      icon: FileText,
      tone: 'navy',
      fraction: { current: 142, total: 160 },
    },
    {
      id: 'kpi-clashes',
      label: 'Pending Clashes',
      value: '12',
      hint: 'need review before publish',
      icon: Siren,
      tone: 'danger',
    },
    {
      id: 'kpi-invigilators',
      label: 'Invigilators Assigned',
      value: '38/45',
      hint: 'duty slots filled',
      icon: Users,
      tone: 'info',
      fraction: { current: 38, total: 45 },
    },
    {
      id: 'kpi-countdown',
      label: 'Days to First Exam',
      value: daysToFirst === 0 ? 'Today' : String(daysToFirst),
      hint: daysToFirst === 0 ? `${CYCLE_LABEL} exams start` : `until ${firstExamLabel}`,
      icon: CalendarClock,
      tone: 'gold',
    },
  ]

  const activity: DashboardActivity[] = [
    {
      id: 'act-1',
      kind: 'clash',
      title: 'Clash spike in draft timetable',
      detail: '241 same-day conflicts flagged across 32 sessions.',
      minutesAgo: 8,
    },
    {
      id: 'act-2',
      kind: 'published',
      title: 'Timetable draft ready',
      detail: `${CYCLE_LABEL} timetable generated with 32 sessions across 5 days.`,
      minutesAgo: 26,
    },
    {
      id: 'act-3',
      kind: 'assignment',
      title: 'Invigilator assignments drafted',
      detail: '8 of 45 duty slots still awaiting confirmation.',
      minutesAgo: 40,
    },
    {
      id: 'act-4',
      kind: 'approval',
      title: 'Room change approved',
      detail: 'CS-202 moved from Hall A to Hall B for the 11 Aug session.',
      minutesAgo: 75,
    },
    {
      id: 'act-5',
      kind: 'info',
      title: 'Backup pool configured',
      detail: 'Backup invigilators added to the cycle roster.',
      minutesAgo: 150,
    },
  ]

  const clashes: ClashListItem[] = [
    { id: 'cl-1', code: 'CS-202', title: 'Data Structures', affected: 3, dateLabel: '11 Aug', slot: 'Morning', kind: 'same-slot' },
    { id: 'cl-2', code: 'SE-101', title: 'Software Engineering I', affected: 1, dateLabel: '11 Aug', slot: 'Morning', kind: 'same-day' },
    { id: 'cl-3', code: 'MA-201', title: 'Linear Algebra', affected: 4, dateLabel: '12 Aug', slot: 'Afternoon', kind: 'same-slot' },
    { id: 'cl-4', code: 'CS-305', title: 'Database Systems', affected: 2, dateLabel: '13 Aug', slot: 'Morning', kind: 'same-day' },
    { id: 'cl-5', code: 'PH-102', title: 'Applied Physics', affected: 5, dateLabel: '14 Aug', slot: 'Afternoon', kind: 'same-slot' },
  ]

  const quickActions: CoordinatorQuickAction[] = [
    { id: 'qa-1', label: 'New Schedule Entry', description: 'Add a session to the timetable', icon: CalendarPlus, path: '/scheduling' },
    { id: 'qa-2', label: 'Import Invigilators', description: 'Bulk-upload duty availability', icon: Upload, path: '/invigilators' },
    { id: 'qa-3', label: 'Generate Datesheet PDF', description: 'Export the full datesheet', icon: FileDown, path: '/reports' },
    { id: 'qa-4', label: 'Publish Datesheet', description: 'Push the datesheet live to students', icon: Send },
  ]

  return {
    hasActiveCycle: true,
    cycleLabel: CYCLE_LABEL,
    kpis,
    examDays: mockExamDays(),
    activity,
    clashes,
    quickActions,
  }
}
