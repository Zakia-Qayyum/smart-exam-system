/**
 * Pure clash-detection logic. Kept free of Prisma so it can be unit-tested in
 * isolation (see server/test/clash-detection.test.ts). The DB-backed wrapper
 * in scheduling.service.ts feeds this module real enrollments + schedule data.
 *
 * Clash semantics (mirroring the seed in server/prisma/seed.ts):
 *   - same_slot: a student is enrolled in another section examined on the same
 *     date AND the same time slot → blocking, severity high.
 *   - same_day:  a student is enrolled in another section examined on the same
 *     date but a different slot → warning only, severity medium.
 */

export interface StudentExam {
  studentId: string
  entryId: string
  sectionId: string
  /** ISO date key, e.g. '2026-08-10' */
  date: string
  timeSlotId: string
  courseCode: string
}

export interface EnrolledStudent {
  studentId: string
  regId: string
  name: string
}

export interface ClashHit {
  type: 'same_slot' | 'same_day'
  severity: 'high' | 'medium'
  student: { id: string; regId: string; name: string }
  conflictEntryId: string
  conflictSectionId: string
  conflictCourseCode: string
  conflictDate: string
  conflictTimeSlotId: string
}

export interface ClashResult {
  /** Blocking same-slot collisions (severity high). */
  clashes: ClashHit[]
  /** Non-blocking same-day warnings (severity medium). */
  dayLoadWarnings: ClashHit[]
}

export interface ClashCandidate {
  sectionId: string
  /** ISO date key, e.g. '2026-08-10' */
  date: string
  timeSlotId: string
}

export function findClashesForCandidate(
  candidate: ClashCandidate,
  enrolled: EnrolledStudent[],
  studentExams: StudentExam[],
): ClashResult {
  const clashes: ClashHit[] = []
  const dayLoadWarnings: ClashHit[] = []

  for (const student of enrolled) {
    for (const exam of studentExams) {
      if (exam.studentId !== student.studentId) continue
      if (exam.sectionId === candidate.sectionId) continue
      if (exam.date !== candidate.date) continue

      const hit: ClashHit = {
        type: exam.timeSlotId === candidate.timeSlotId ? 'same_slot' : 'same_day',
        severity: exam.timeSlotId === candidate.timeSlotId ? 'high' : 'medium',
        student: { id: student.studentId, regId: student.regId, name: student.name },
        conflictEntryId: exam.entryId,
        conflictSectionId: exam.sectionId,
        conflictCourseCode: exam.courseCode,
        conflictDate: exam.date,
        conflictTimeSlotId: exam.timeSlotId,
      }

      if (exam.timeSlotId === candidate.timeSlotId) clashes.push(hit)
      else dayLoadWarnings.push(hit)
    }
  }

  return { clashes, dayLoadWarnings }
}

export function hasBlockingClash(result: ClashResult): boolean {
  return result.clashes.length > 0
}
