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
  affectedStudents: number | null
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
