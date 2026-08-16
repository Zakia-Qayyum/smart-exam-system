import { DoorOpen, Siren, Users, type LucideIcon } from 'lucide-react'

export type ApprovalKind = 'invigilator-override' | 'room-capacity' | 'clash-override'

export interface ApprovalRequest {
  id: string
  kind: ApprovalKind
  title: string
  requester: string
  requesterRole: string
  department: string
  reason: string
  courses: string[]
  affectedStudents: number
  detail: string
  minutesAgo: number
  status: 'pending' | 'approved' | 'rejected'
  decidedBy?: string
  decisionNote?: string
  decidedMinutesAgo?: number
}

export interface ApprovalKindMeta {
  label: string
  shortLabel: string
  badge: 'warning' | 'info' | 'danger'
  icon: LucideIcon
}

export const approvalKindMeta: Record<ApprovalKind, ApprovalKindMeta> = {
  'invigilator-override': {
    label: 'Invigilator Override',
    shortLabel: 'Invigilator',
    badge: 'warning',
    icon: Users,
  },
  'room-capacity': {
    label: 'Room Capacity Exception',
    shortLabel: 'Capacity',
    badge: 'info',
    icon: DoorOpen,
  },
  'clash-override': {
    label: 'Clash Override Justification',
    shortLabel: 'Clash',
    badge: 'danger',
    icon: Siren,
  },
}

export function mockApprovalQueue(): ApprovalRequest[] {
  return [
    {
      id: 'apr-1',
      kind: 'invigilator-override',
      title: 'Assign invigilator outside specialization',
      requester: 'M. Imran Qureshi',
      requesterRole: 'Exam Coordinator',
      department: 'CS',
      reason:
        'Dr. Asma Riaz has refused the drafted duty due to a conference. Usman Tariq (web/testing) is the only free faculty with prior invigilation experience on the day; he has not served in this cycle yet.',
      courses: ['CS-202', 'SE-301'],
      affectedStudents: 96,
      detail: '2 sessions on 11 Aug · Morning slot need 1 extra invigilator each.',
      minutesAgo: 28,
      status: 'pending',
    },
    {
      id: 'apr-2',
      kind: 'room-capacity',
      title: 'Seat overflow beyond room capacity',
      requester: 'Hira Khan',
      requesterRole: 'Department Coordinator',
      department: 'SE',
      reason:
        'SE-402 has 62 enrolled but the only free room seats 56. The department requests a 6-seat overflow using the breakout area attached to Hall C, invigilated separately.',
      courses: ['SE-402'],
      affectedStudents: 62,
      detail: '62 enrolled vs 56 capacity · 6 students seated in breakout area.',
      minutesAgo: 74,
      status: 'pending',
    },
    {
      id: 'apr-3',
      kind: 'clash-override',
      title: 'Override same-day clash for retake student',
      requester: 'M. Imran Qureshi',
      requesterRole: 'Exam Coordinator',
      department: 'CS',
      reason:
        'Student AU-2024-CS-011 has a makeup retake for MA-201 on 12 Aug alongside a regular CS-305 paper. The retake was arranged after the timetable draft; morning and afternoon sessions are separated by 4 hours.',
      courses: ['MA-201', 'CS-305'],
      affectedStudents: 1,
      detail: '1 student · 12 Aug · Morning + Afternoon, 4h gap.',
      minutesAgo: 190,
      status: 'pending',
    },
    {
      id: 'apr-4',
      kind: 'invigilator-override',
      title: 'Reassign invigilator to sibling paper',
      requester: 'Hira Khan',
      requesterRole: 'Department Coordinator',
      department: 'SE',
      reason:
        'Swap invigilation between SE-101 and SE-102 so that the same faculty invigilates both sections of the same course on 13 Aug, reducing briefing overhead.',
      courses: ['SE-101', 'SE-102'],
      affectedStudents: 118,
      detail: '2 sessions on 13 Aug · same faculty pair across both sections.',
      minutesAgo: 320,
      status: 'pending',
    },
    {
      id: 'apr-5',
      kind: 'room-capacity',
      title: 'Use smaller room for makeup exam',
      requester: 'M. Imran Qureshi',
      requesterRole: 'Exam Coordinator',
      department: 'MA',
      reason:
        'The 14 Aug makeup session for MA-302 has only 9 students. Request permission to run it in a 12-capacity tutorial room instead of the booked 60-capacity hall.',
      courses: ['MA-302'],
      affectedStudents: 9,
      detail: '9 students · 14 Aug · frees Hall B for another department.',
      minutesAgo: 980,
      status: 'pending',
    },
    {
      id: 'apr-6',
      kind: 'clash-override',
      title: 'Override duplicate clash record',
      requester: 'Hira Khan',
      requesterRole: 'Department Coordinator',
      department: 'CS',
      reason:
        'The clash scan flagged CS-401 twice for the same student on 10 Aug because of a re-enrollment. Both records refer to one underlying conflict; the second record should be marked overridden.',
      courses: ['CS-401'],
      affectedStudents: 3,
      detail: 'Duplicate record · 3 students · 10 Aug Morning.',
      minutesAgo: 120,
      status: 'pending',
    },
    {
      id: 'apd-1',
      kind: 'room-capacity',
      title: 'Combine two sections into one hall',
      requester: 'M. Imran Qureshi',
      requesterRole: 'Exam Coordinator',
      department: 'SE',
      reason:
        'Merged SE-201A/B invigilation into Hall A to save a duty slot. Combined count fits within Hall A capacity.',
      courses: ['SE-201', 'SE-201'],
      affectedStudents: 84,
      detail: '2 sections · 10 Aug · Morning.',
      minutesAgo: 1440,
      status: 'approved',
      decidedBy: 'Prof. Naveed Akram',
      decisionNote: 'Approved — combined count verified against Hall A capacity.',
      decidedMinutesAgo: 1330,
    },
    {
      id: 'apd-2',
      kind: 'clash-override',
      title: 'Override same-day clash for graduation checkout',
      requester: 'Hira Khan',
      requesterRole: 'Department Coordinator',
      department: 'CS',
      reason:
        'Student has a Friday cluster exam and an afternoon paper; commute makes the gap too tight.',
      courses: ['CS-310', 'EE-101'],
      affectedStudents: 1,
      detail: '1 student · 12 Aug.',
      minutesAgo: 2880,
      status: 'rejected',
      decidedBy: 'Prof. Naveed Akram',
      decisionNote:
        'Rejected — the gap is 3h which meets the published policy. Student advised to file a hardship case with the Exam Cell.',
      decidedMinutesAgo: 2760,
    },
    {
      id: 'apd-3',
      kind: 'invigilator-override',
      title: 'Allow invigilator beyond specialization',
      requester: 'M. Imran Qureshi',
      requesterRole: 'Exam Coordinator',
      department: 'EE',
      reason:
        'EE faculty shortage on 13 Aug; requested approval to use a CS faculty member trained at the invigilator briefing.',
      courses: ['EE-203'],
      affectedStudents: 58,
      detail: '1 session · 13 Aug · Afternoon.',
      minutesAgo: 4320,
      status: 'approved',
      decidedBy: 'Prof. Naveed Akram',
      decisionNote: 'Approved — faculty completed the 2026 briefing and has no conflict.',
      decidedMinutesAgo: 4180,
    },
  ]
}
