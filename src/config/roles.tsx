import {
  CalendarDays,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  Clock,
  FileText,
  GraduationCap,
  History,
  LayoutDashboard,
  Megaphone,
  Settings,
  ShieldCheck,
  Siren,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { NavItem, Role } from '@/lib/types'

export const ROLES: Role[] = [
  'admin',
  'exam-coordinator',
  'dept-coordinator',
  'hod',
  'invigilator',
  'student',
]

export const roleLabels: Record<Role, string> = {
  admin: 'Admin',
  'exam-coordinator': 'Exam Coordinator',
  'dept-coordinator': 'Department Coordinator',
  hod: 'Head of Department',
  invigilator: 'Invigilator',
  student: 'Student',
}

export const roleDescriptions: Record<Role, string> = {
  admin: 'Full access to every module, user management and the audit log.',
  'exam-coordinator': 'Build timetables, detect clashes and run the whole exam cycle.',
  'dept-coordinator': 'Schedule your department\u2019s exams and view invigilators.',
  hod: 'Approve timetable changes and review reports for your department.',
  invigilator: 'See your assigned duties, set availability and get notified.',
  student: 'View your datesheet and download your roll no slip.',
}

const dashboard = { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard }
const scheduling = { label: 'Scheduling Engine', path: '/scheduling', icon: CalendarClock }
const calendar = { label: 'Datesheet Calendar', path: '/calendar', icon: CalendarDays }
const clashes = { label: 'Clash Detection Center', path: '/clashes', icon: Siren }
const invigilators = { label: 'Invigilator Directory', path: '/invigilators', icon: Users }
const assignments = { label: 'Assignment Board', path: '/assignments', icon: ClipboardList }
const reports = { label: 'Export & Reports', path: '/reports', icon: FileText }
const settings = { label: 'Settings', path: '/settings', icon: Settings }
const approvals = { label: 'Approval Queue', path: '/approvals', icon: Megaphone }
const myAssignments = { label: 'My Assignments', path: '/my-assignments', icon: ClipboardCheck }
const myAvailability = { label: 'My Availability', path: '/my-availability', icon: Clock }
const notifications = { label: 'Notifications', path: '/notifications', icon: Megaphone }
const myDatesheet = { label: 'My Datesheet / Roll No Slip', path: '/my-datesheet', icon: GraduationCap }
const users = { label: 'User & Role Management', path: '/users', icon: ShieldCheck }
const audit = { label: 'Audit Log', path: '/audit-log', icon: History }

const navByRole: Record<Role, NavItem[]> = {
  admin: [dashboard, scheduling, calendar, clashes, invigilators, assignments, reports, users, audit, settings],
  'exam-coordinator': [dashboard, scheduling, calendar, clashes, invigilators, assignments, reports, settings],
  'dept-coordinator': [dashboard, scheduling, calendar, invigilators],
  hod: [dashboard, approvals, calendar, reports],
  invigilator: [myAssignments, myAvailability, notifications],
  student: [myDatesheet, notifications],
}

export { navByRole }

export const allNavItems: NavItem[] = Array.from(
  new Map(Object.values(navByRole).flat().map((item) => [item.path, item])).values(),
)

export const routeAccess: Record<string, Role[]> = {
  '/dashboard': ['admin', 'exam-coordinator', 'dept-coordinator', 'hod'],
  '/scheduling': ['admin', 'exam-coordinator', 'dept-coordinator'],
  '/calendar': ['admin', 'exam-coordinator', 'dept-coordinator', 'hod'],
  '/clashes': ['admin', 'exam-coordinator'],
  '/invigilators': ['admin', 'exam-coordinator', 'dept-coordinator'],
  '/assignments': ['admin', 'exam-coordinator'],
  '/reports': ['admin', 'exam-coordinator', 'hod'],
  '/settings': ['admin', 'exam-coordinator'],
  '/approvals': ['admin', 'hod'],
  '/my-assignments': ['admin', 'invigilator'],
  '/my-availability': ['admin', 'invigilator'],
  '/notifications': ROLES,
  '/my-datesheet': ['admin', 'student'],
  '/users': ['admin'],
  '/audit-log': ['admin'],
}

export const PROTECTED_PATHS = Object.keys(routeAccess)

export const routeMeta: Record<string, { title: string; description: string }> = {
  '/dashboard': {
    title: 'Dashboard',
    description: 'Overview of schedules, clashes and your current exam cycle.',
  },
  '/scheduling': {
    title: 'Scheduling Engine',
    description: 'Generate and fine-tune the exam timetable for a cycle.',
  },
  '/calendar': {
    title: 'Datesheet Calendar',
    description: 'Term-view calendar of every exam session in the cycle.',
  },
  '/clashes': {
    title: 'Clash Detection Center',
    description: 'Review and resolve detected timing and room conflicts.',
  },
  '/invigilators': {
    title: 'Invigilator Directory',
    description: 'Browse invigilators, departments and their specializations.',
  },
  '/assignments': {
    title: 'Assignment Board',
    description: 'Assign invigilators to exam sessions and track confirmations.',
  },
  '/reports': {
    title: 'Export & Reports',
    description: 'Export datesheets, roll-no slips and operational reports.',
  },
  '/settings': {
    title: 'Settings',
    description: 'Exam cycle defaults, room and time-slot configuration.',
  },
  '/approvals': {
    title: 'Approval Queue',
    description: 'Approve or reject timetable change and override requests.',
  },
  '/my-assignments': {
    title: 'My Assignments',
    description: 'Your upcoming invigilation duties and details.',
  },
  '/my-availability': {
    title: 'My Availability',
    description: 'Set the days and times you are available to invigilate.',
  },
  '/notifications': {
    title: 'Notifications',
    description: 'Clash alerts, schedule notices and account updates.',
  },
  '/my-datesheet': {
    title: 'My Datesheet & Roll No Slip',
    description: 'Your exam schedule and roll no slip for the current cycle.',
  },
  '/users': {
    title: 'User & Role Management',
    description: 'Manage users, roles and permissions across the system.',
  },
  '/audit-log': {
    title: 'Audit Log',
    description: 'Traceable record of actions across the system.',
  },
}

export const homeByRole: Record<Role, string> = {
  admin: '/dashboard',
  'exam-coordinator': '/dashboard',
  'dept-coordinator': '/dashboard',
  hod: '/dashboard',
  invigilator: '/my-assignments',
  student: '/my-datesheet',
}

export const roleTileIcon: Record<Role, LucideIcon> = {
  admin: ShieldCheck,
  'exam-coordinator': ClipboardList,
  'dept-coordinator': Users,
  hod: Megaphone,
  invigilator: Clock,
  student: GraduationCap,
}
