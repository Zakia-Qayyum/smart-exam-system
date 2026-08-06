/**
 * Maps the backend's DB role strings onto the frontend Role union that
 * Step 4's mock auth service returns. Faculty members are the invigilators
 * in this system, so `faculty` maps to the `invigilator` frontend role.
 */
export const FRONTEND_ROLES = [
  'admin',
  'exam-coordinator',
  'dept-coordinator',
  'hod',
  'invigilator',
  'student',
] as const

export type FrontendRole = (typeof FRONTEND_ROLES)[number]

const DB_ROLE_TO_FRONTEND: Record<string, FrontendRole> = {
  admin: 'admin',
  coordinator: 'exam-coordinator',
  'dept-coordinator': 'dept-coordinator',
  hod: 'hod',
  faculty: 'invigilator',
  invigilator: 'invigilator',
  student: 'student',
}

export function toFrontendRole(dbRole: string): FrontendRole | null {
  return DB_ROLE_TO_FRONTEND[dbRole] ?? null
}
