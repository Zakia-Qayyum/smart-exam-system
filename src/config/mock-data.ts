import type { DashboardStat, MockNotification, MockUser, Role, TickerItem } from '@/lib/types'

export const mockUsers: Record<Role, MockUser> = {
  admin: {
    id: 'u-admin',
    name: 'Zakia Qayyum',
    email: 'admin@airuni.edu.pk',
    role: 'admin',
    department: null,
  },
  'exam-coordinator': {
    id: 'u-ec',
    name: 'Bilal Ahmed',
    email: 'exam.coordinator@airuni.edu.pk',
    role: 'exam-coordinator',
    department: 'Examination Cell',
  },
  'dept-coordinator': {
    id: 'u-dc',
    name: 'Hira Khan',
    email: 'dc.cs@airuni.edu.pk',
    role: 'dept-coordinator',
    department: 'Computer Science',
  },
  hod: {
    id: 'u-hod',
    name: 'Dr. Sana Malik',
    email: 'hod.cs@airuni.edu.pk',
    role: 'hod',
    department: 'Computer Science',
  },
  invigilator: {
    id: 'u-inv',
    name: 'Usman Tariq',
    email: 'usman.tariq@airuni.edu.pk',
    role: 'invigilator',
    department: 'Software Engineering',
  },
  student: {
    id: 'u-stu',
    name: 'Fatima Noor',
    email: 'au2024cs042@airuni.edu.pk',
    role: 'student',
    department: 'Computer Science',
  },
}

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
