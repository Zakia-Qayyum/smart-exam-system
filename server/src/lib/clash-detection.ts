/**
 * Pure clash-detection logic. Kept free of Prisma so it can be unit-tested in
 * isolation (see server/test/clash-detection.test.ts and clash-scan.test.ts).
 * The DB-backed wrapper (server/src/services/clash-detection.service.ts) feeds
 * this module real enrollments + schedule data.
 *
 * Clash semantics (mirroring the seed in server/prisma/seed.ts):
 *   - same_slot: a student is enrolled in another section examined on the same
 *     date AND the same time slot → blocking, severity high.
 *   - same_day:  a student is enrolled in another section examined on the same
 *     date but a different slot → warning only, severity medium.
 *   - overload:  a student sits >= `threshold` distinct papers on one date →
 *     medium warning grouped by student with the full day's paper list.
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

export interface ClashEntryRef {
  entryId: string
  sectionId: string
  courseCode: string
}

/** One student who is double-booked into >= 2 exams on the same date+slot. */
export interface SameSlotClashGroup {
  student: EnrolledStudent
  date: string
  timeSlotId: string
  entries: ClashEntryRef[]
}

/** One student who sits >= `threshold` papers on a single date. */
export interface SameDayOverload {
  student: EnrolledStudent
  date: string
  papers: Array<ClashEntryRef & { timeSlotId: string }>
}

const byCourseCode = (a: ClashEntryRef, b: ClashEntryRef) => a.courseCode.localeCompare(b.courseCode)

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

/**
 * Group every same-date + same-time-slot collision across a full cycle. Each
 * student enrolled in >= 2 sections examined in the same slot yields one group
 * listing all conflicting entries, so the DB layer can persist one record per
 * group (never per pair).
 */
export function groupSameSlotClashes(exams: StudentExam[], students: EnrolledStudent[]): SameSlotClashGroup[] {
  const studentById = new Map(students.map((s) => [s.studentId, s]))
  const byKey = new Map<string, SameSlotClashGroup>()

  for (const exam of exams) {
    const student = studentById.get(exam.studentId)
    if (!student) continue
    const key = `${exam.studentId}|${exam.date}|${exam.timeSlotId}`
    let group = byKey.get(key)
    if (!group) {
      group = { student, date: exam.date, timeSlotId: exam.timeSlotId, entries: [] }
      byKey.set(key, group)
    }
    group.entries.push({ entryId: exam.entryId, sectionId: exam.sectionId, courseCode: exam.courseCode })
  }

  return [...byKey.values()]
    .filter((g) => g.entries.length >= 2)
    .map((g) => ({ ...g, entries: g.entries.sort(byCourseCode) }))
    .sort((a, b) => (a.date === b.date ? a.timeSlotId.localeCompare(b.timeSlotId) : a.date.localeCompare(b.date)))
}

/**
 * Flag dates where a student sits `threshold` or more distinct papers. Each
 * result is grouped by student and carries the full day's paper list (slot
 * included) so the coordinator can see exactly how overloaded the day is.
 */
export function detectSameDayOverload(
  exams: StudentExam[],
  students: EnrolledStudent[],
  threshold = 2,
): SameDayOverload[] {
  const studentById = new Map(students.map((s) => [s.studentId, s]))
  const byKey = new Map<string, SameDayOverload>()

  for (const exam of exams) {
    const student = studentById.get(exam.studentId)
    if (!student) continue
    const key = `${exam.studentId}|${exam.date}`
    let day = byKey.get(key)
    if (!day) {
      day = { student, date: exam.date, papers: [] }
      byKey.set(key, day)
    }
    day.papers.push({ entryId: exam.entryId, sectionId: exam.sectionId, courseCode: exam.courseCode, timeSlotId: exam.timeSlotId })
  }

  return [...byKey.values()]
    .filter((d) => d.papers.length >= threshold)
    .map((d) => ({ ...d, papers: d.papers.sort(byCourseCode) }))
    .sort((a, b) => (a.date === b.date ? a.student.regId.localeCompare(b.student.regId) : a.date.localeCompare(b.date)))
}
