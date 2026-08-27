import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client.js'

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

// ── Deterministic pseudo-random helpers ───────────────────────────────────
function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(20260806)
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]

function sampleDistinct<T>(pool: readonly T[], n: number): T[] {
  const copy = [...pool]
  const out: T[] = []
  while (out.length < n && copy.length > 0) {
    out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0])
  }
  return out
}

const at = (dateStr: string, hour: number, minute = 0) =>
  new Date(`${dateStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`)

const CYCLE_START = '2026-08-10'
const CYCLE_END = '2026-08-14'
const PASSWORD = bcrypt.hashSync('Password@123', 10)

// ── Reference data ────────────────────────────────────────────────────────
const departments = [
  { name: 'Computer Science', code: 'CS' },
  { name: 'Software Engineering', code: 'SE' },
  { name: 'Electrical Engineering', code: 'EE' },
  { name: 'Mathematics', code: 'MA' },
  { name: 'Business Administration', code: 'BA' },
]

const programs = [
  { code: 'BSCS', name: 'BS Computer Science', dept: 'CS', years: 4 },
  { code: 'BSSE', name: 'BS Software Engineering', dept: 'SE', years: 4 },
  { code: 'BSEE', name: 'BS Electrical Engineering', dept: 'EE', years: 4 },
  { code: 'BSMATH', name: 'BS Mathematics', dept: 'MA', years: 4 },
  { code: 'BBA', name: 'BBA Business Administration', dept: 'BA', years: 4 },
  { code: 'MSCS', name: 'MS Computer Science', dept: 'CS', years: 2 },
  { code: 'MSDS', name: 'MS Data Science', dept: 'CS', years: 2 },
  { code: 'PHDCS', name: 'PhD Computer Science', dept: 'CS', years: 5 },
]

const courses: Array<{ course_code: string; title: string; dept: string; credit_hours: number }> = [
  { course_code: 'CS-101', title: 'Programming Fundamentals', dept: 'CS', credit_hours: 3 },
  { course_code: 'CS-102', title: 'Object Oriented Programming', dept: 'CS', credit_hours: 3 },
  { course_code: 'CS-201', title: 'Data Structures', dept: 'CS', credit_hours: 3 },
  { course_code: 'CS-202', title: 'Database Systems', dept: 'CS', credit_hours: 3 },
  { course_code: 'CS-203', title: 'Operating Systems', dept: 'CS', credit_hours: 3 },
  { course_code: 'CS-204', title: 'Computer Networks', dept: 'CS', credit_hours: 3 },
  { course_code: 'CS-301', title: 'Artificial Intelligence', dept: 'CS', credit_hours: 3 },
  { course_code: 'CS-302', title: 'Compilers', dept: 'CS', credit_hours: 3 },
  { course_code: 'CS-303', title: 'Software Engineering', dept: 'CS', credit_hours: 3 },
  { course_code: 'CS-304', title: 'Theory of Computation', dept: 'CS', credit_hours: 3 },
  { course_code: 'SE-101', title: 'Intro to Software Engineering', dept: 'SE', credit_hours: 3 },
  { course_code: 'SE-201', title: 'Requirements Engineering', dept: 'SE', credit_hours: 3 },
  { course_code: 'SE-202', title: 'Software Design & Architecture', dept: 'SE', credit_hours: 3 },
  { course_code: 'SE-301', title: 'Software Quality Assurance', dept: 'SE', credit_hours: 3 },
  { course_code: 'SE-302', title: 'Software Project Management', dept: 'SE', credit_hours: 3 },
  { course_code: 'EE-101', title: 'Circuit Analysis', dept: 'EE', credit_hours: 3 },
  { course_code: 'EE-102', title: 'Digital Logic Design', dept: 'EE', credit_hours: 3 },
  { course_code: 'EE-201', title: 'Signals & Systems', dept: 'EE', credit_hours: 3 },
  { course_code: 'EE-202', title: 'Microprocessors', dept: 'EE', credit_hours: 3 },
  { course_code: 'EE-301', title: 'Control Systems', dept: 'EE', credit_hours: 3 },
  { course_code: 'EE-302', title: 'Power Systems', dept: 'EE', credit_hours: 3 },
  { course_code: 'MA-101', title: 'Calculus I', dept: 'MA', credit_hours: 3 },
  { course_code: 'MA-102', title: 'Calculus II', dept: 'MA', credit_hours: 3 },
  { course_code: 'MA-201', title: 'Linear Algebra', dept: 'MA', credit_hours: 3 },
  { course_code: 'MA-202', title: 'Differential Equations', dept: 'MA', credit_hours: 3 },
  { course_code: 'MA-301', title: 'Probability & Statistics', dept: 'MA', credit_hours: 3 },
  { course_code: 'MA-302', title: 'Numerical Methods', dept: 'MA', credit_hours: 3 },
  { course_code: 'BA-101', title: 'Principles of Management', dept: 'BA', credit_hours: 3 },
  { course_code: 'BA-102', title: 'Business Communication', dept: 'BA', credit_hours: 3 },
  { course_code: 'BA-201', title: 'Marketing Fundamentals', dept: 'BA', credit_hours: 3 },
  { course_code: 'BA-202', title: 'Financial Accounting', dept: 'BA', credit_hours: 3 },
  { course_code: 'BA-301', title: 'Organizational Behavior', dept: 'BA', credit_hours: 3 },
]

const rooms = [
  { name: 'Hall A', capacity: 80, dept: null as string | null },
  { name: 'Hall B', capacity: 80, dept: null as string | null },
  { name: 'Hall C', capacity: 120, dept: null as string | null },
  { name: 'Hall D', capacity: 120, dept: null as string | null },
  { name: 'CS Lab 1', capacity: 40, dept: 'CS' },
  { name: 'CS Lab 2', capacity: 40, dept: 'CS' },
  { name: 'EE Lab 1', capacity: 40, dept: 'EE' },
  { name: 'EE Lab 2', capacity: 40, dept: 'EE' },
  { name: 'MA Hall', capacity: 60, dept: 'MA' },
  { name: 'Seminar Room', capacity: 50, dept: null as string | null },
  { name: 'Auditorium', capacity: 200, dept: null as string | null },
  { name: 'Library Annex', capacity: 100, dept: null as string | null },
]

const timeSlots = [
  { label: 'Morning', start: at('2000-01-01', 9, 0), end: at('2000-01-01', 11, 0) },
  { label: 'Late Morning', start: at('2000-01-01', 11, 30), end: at('2000-01-01', 13, 30) },
  { label: 'Afternoon', start: at('2000-01-01', 14, 0), end: at('2000-01-01', 16, 0) },
  { label: 'Late Afternoon', start: at('2000-01-01', 16, 30), end: at('2000-01-01', 18, 30) },
]

const firstNames = [
  'Ayesha', 'Fatima', 'Muhammad', 'Ali', 'Hassan', 'Ahmed', 'Usman', 'Bilal', 'Hamza', 'Omar',
  'Zain', 'Saad', 'Abdullah', 'Talha', 'Ibrahim', 'Daniyal', 'Hassaan', 'Ammar', 'Areeba', 'Mahnoor',
  'Zara', 'Hira', 'Sana', 'Aiman', 'Rida', 'Noor', 'Laiba', 'Eman', 'Khadija', 'Maryam',
  'Sara', 'Amna', 'Iqra', 'Rabia', 'Hafsa', 'Mariam', 'Fahad', 'Waqar', 'Rizwan', 'Shahbaz',
]

const lastNames = [
  'Khan', 'Ahmed', 'Malik', 'Qureshi', 'Siddiqui', 'Butt', 'Chaudhry', 'Sheikh', 'Raza', 'Javed',
  'Iqbal', 'Hussain', 'Rashid', 'Anwar', 'Farooq', 'Tariq', 'Nawaz', 'Sohail', 'Akram', 'Yousaf',
  'Aslam', 'Kamran', 'Saleem', 'Munir', 'Abbasi', 'Zaidi', 'Baig', 'Mirza', 'Gillani', 'Hashmi',
]

const specializationTags = [
  'algorithms', 'databases', 'networks', 'operating-systems', 'ai', 'web', 'security',
  'embedded', 'control-systems', 'power', 'signals', 'mathematics', 'statistics',
  'management', 'finance', 'marketing', 'software-architecture', 'testing',
]

// ── Demo account repair (idempotent) ──────────────────────────────────────
// Ensures the 4 demo accounts exist with correct password_hash and
// mfa_enabled on every deploy, even when the full seed is skipped.
async function repairDemoAccounts() {
  const csDept = await prisma.department.findUnique({ where: { code: 'CS' }, select: { id: true } })
  if (!csDept) {
    console.log('⏭️  No partial seed detected, deferring demo-account repair to full seed.')
    return
  }

  console.log('🔧 Repairing demo accounts…')

  await prisma.user.upsert({
    where:  { email: 'admin@airuni.edu.pk' },
    update: { password_hash: PASSWORD, mfa_enabled: false },
    create: {
      name: 'System Administrator',
      email: 'admin@airuni.edu.pk',
      password_hash: PASSWORD,
      role: 'admin',
      status: 'active',
      must_change_password: false,
      mfa_enabled: false,
    },
  })

  await prisma.user.upsert({
    where:  { email: 'coordinator@airuni.edu.pk' },
    update: { password_hash: PASSWORD, mfa_enabled: false },
    create: {
      name: 'Exam Coordinator',
      email: 'coordinator@airuni.edu.pk',
      password_hash: PASSWORD,
      role: 'coordinator',
      department_id: csDept.id,
      status: 'active',
      must_change_password: false,
      mfa_enabled: false,
    },
  })

  await prisma.user.upsert({
    where:  { email: 'usman.tariq@airuni.edu.pk' },
    update: { password_hash: PASSWORD, mfa_enabled: false },
    create: {
      name: 'Usman Tariq',
      email: 'usman.tariq@airuni.edu.pk',
      password_hash: PASSWORD,
      role: 'faculty',
      department_id: csDept.id,
      status: 'active',
      must_change_password: true,
      mfa_enabled: false,
    },
  })

  await prisma.user.upsert({
    where:  { email: 'au2024cs042@airuni.edu.pk' },
    update: { password_hash: PASSWORD, mfa_enabled: false },
    create: {
      name: 'Fatima Noor',
      email: 'au2024cs042@airuni.edu.pk',
      password_hash: PASSWORD,
      role: 'student',
      department_id: csDept.id,
      status: 'active',
      must_change_password: false,
      mfa_enabled: false,
    },
  })

  console.log('✅ Demo accounts repaired.')
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  await repairDemoAccounts()

  const existingDepts = await prisma.department.count()
  if (existingDepts > 0) {
    console.log('⏭️  Database already seeded, skipping.')
    return
  }

  console.log('⏳ Seeding smart_exam database…')

  // 1. Departments & programs
  await prisma.department.createMany({
    data: departments.map((d) => ({ name: d.name, code: d.code })),
  })
  const deptMap = new Map<string, string>()
  for (const d of await prisma.department.findMany()) deptMap.set(d.code, d.id)

  await prisma.program.createMany({
    data: programs.map((p) => ({
      code: p.code,
      name: p.name,
      department_id: deptMap.get(p.dept)!,
      duration_years: p.years,
    })),
  })

  // 2. Courses & sections
  await prisma.course.createMany({
    data: courses.map((c) => ({
      course_code: c.course_code,
      title: c.title,
      department_id: deptMap.get(c.dept)!,
      credit_hours: c.credit_hours,
    })),
  })
  const courseList = await prisma.course.findMany()
  const deptIdByCourse = new Map(courses.map((c) => [c.course_code, deptMap.get(c.dept)!]))
  const sectionsByDept = new Map<string, Array<{ id: string; course_id: string }>>()
  for (const course of courseList) {
    const section = await prisma.section.create({
      data: { course_id: course.id, batch: '2024', semester: 'Fall-2026' },
    })
    const deptId = deptIdByCourse.get(course.course_code) ?? deptMap.get('CS')!
    const list = sectionsByDept.get(deptId) ?? []
    list.push(section)
    sectionsByDept.set(deptId, list)
  }
  const allSections = await prisma.section.findMany()

  // 3. Users
  const admin = await prisma.user.create({
    data: {
      name: 'System Administrator',
      email: 'admin@airuni.edu.pk',
      password_hash: PASSWORD,
      role: 'admin',
      status: 'active',
      must_change_password: false,
      mfa_enabled: false,
    },
  })

  const coordinator = await prisma.user.create({
    data: {
      name: 'Exam Coordinator',
      email: 'coordinator@airuni.edu.pk',
      password_hash: PASSWORD,
      role: 'coordinator',
      department_id: deptMap.get('CS'),
      status: 'active',
      must_change_password: false,
      mfa_enabled: false,
    },
  })

  // Demo invigilator with a forced password change on first login.
  const demoInvigilator = await prisma.user.create({
    data: {
      name: 'Usman Tariq',
      email: 'usman.tariq@airuni.edu.pk',
      password_hash: PASSWORD,
      role: 'faculty',
      department_id: deptMap.get('CS'),
      status: 'active',
      must_change_password: true,
      mfa_enabled: false,
    },
  })
  await prisma.invigilator.create({
    data: {
      user_id: demoInvigilator.id,
      department_id: deptMap.get('CS')!,
      max_assignments_per_cycle: 5,
      specialization_tags: ['databases', 'web', 'testing'],
    },
  })

  const facultyUsers: Array<{ id: string; department_id: string | null; name: string }> = []
  for (let i = 0; i < 20; i++) {
    const dept = departments[i % departments.length]
    const name = `${pick(firstNames)} ${pick(lastNames)}`
    const slug = name.toLowerCase().replace(/[^a-z]+/g, '.')
    const user = await prisma.user.create({
      data: {
        name,
        email: `${slug}@airuni.edu.pk`,
        password_hash: PASSWORD,
        role: 'faculty',
        department_id: deptMap.get(dept.code)!,
        status: 'active',
      },
    })
    facultyUsers.push({ id: user.id, department_id: user.department_id, name: user.name })
  }

  // 4. Invigilators
  const invigilators: Array<{ id: string; department_id: string | null }> = []
  for (const fu of facultyUsers) {
    const invigilator = await prisma.invigilator.create({
      data: {
        user_id: fu.id,
        department_id: fu.department_id ?? deptMap.get('CS')!,
        max_assignments_per_cycle: 4 + Math.floor(rand() * 4),
        specialization_tags: sampleDistinct(specializationTags, 3),
      },
    })
    invigilators.push({ id: invigilator.id, department_id: invigilator.department_id })
  }

  // 5. Students (200)
  const studentCounts: Array<[string, number]> = [
    ['CS', 60],
    ['SE', 40],
    ['EE', 40],
    ['MA', 30],
    ['BA', 30],
  ]
  const programByDept = new Map(programs.filter((p) => p.years === 4).map((p) => [p.dept, p.name]))
  const studentRows: Array<{
    reg_id: string
    name: string
    program: string
    batch: string
    department_id: string
  }> = []
  const regCounter: Record<string, number> = {}
  for (const [dept, count] of studentCounts) {
    for (let i = 0; i < count; i++) {
      regCounter[dept] = (regCounter[dept] ?? 0) + 1
      studentRows.push({
        reg_id: `AU-2024-${dept}-${String(regCounter[dept]).padStart(3, '0')}`,
        name: `${pick(firstNames)} ${pick(lastNames)}`,
        program: programByDept.get(dept) ?? '',
        batch: '2024',
        department_id: deptMap.get(dept)!,
      })
    }
  }
  await prisma.student.createMany({ data: studentRows })
  const students = await prisma.student.findMany()

  // Demo student login account (no MFA, to exercise the direct-token path).
  await prisma.user.create({
    data: {
      name: 'Fatima Noor',
      email: 'au2024cs042@airuni.edu.pk',
      password_hash: PASSWORD,
      role: 'student',
      department_id: deptMap.get('CS'),
      status: 'active',
      must_change_password: false,
      mfa_enabled: false,
    },
  })

  // 6. Enrollments — 5 courses each, biased toward own department → overlaps
  const enrollmentRows: Array<{ student_id: string; section_id: string }> = []
  for (const student of students) {
    const ownDeptSections = sectionsByDept.get(student.department_id) ?? []
    const ownCount = 3
    const otherSections = allSections.filter((s) => !ownDeptSections.includes(s))
    const chosen = [...sampleDistinct(ownDeptSections, ownCount), ...sampleDistinct(otherSections, 2)]
    const seen = new Set<string>()
    for (const section of chosen) {
      if (seen.has(section.id)) continue
      seen.add(section.id)
      enrollmentRows.push({ student_id: student.id, section_id: section.id })
    }
  }
  await prisma.enrollment.createMany({ data: enrollmentRows })

  // 7. Rooms
  await prisma.room.createMany({
    data: rooms.map((r) => ({
      name: r.name,
      capacity: r.capacity,
      department_id: r.dept ? deptMap.get(r.dept)! : null,
    })),
  })
  const roomList = await prisma.room.findMany()

  // 8. Exam cycle + time slots
  const examCycle = await prisma.examCycle.create({
    data: {
      name: 'Final Examinations Fall 2026',
      term: 'Fall-2026',
      start_date: new Date(CYCLE_START),
      end_date: new Date(CYCLE_END),
      status: 'draft',
    },
  })

  await prisma.timeSlot.createMany({
    data: timeSlots.map((s) => ({
      label: s.label,
      start_time: s.start,
      end_time: s.end,
      exam_cycle_id: examCycle.id,
    })),
  })
  const slotList = await prisma.timeSlot.findMany({ orderBy: { label: 'asc' } })

  // 9. Schedule entries — spread over 5 days × 4 slots so overlaps exist
  const scheduledAt = new Date(CYCLE_START)
  const entries: Array<{
    exam_cycle_id: string
    section_id: string
    date: Date
    time_slot_id: string
    room_id: string
    status: 'scheduled' | 'needs_review'
    created_by: string
  }> = []

  allSections.forEach((section, i) => {
    const slotIndex = (i * 7) % (slotList.length * 5)
    const day = Math.floor(slotIndex / slotList.length)
    const slotId = slotList[slotIndex % slotList.length].id
    const date = new Date(scheduledAt)
    date.setDate(scheduledAt.getDate() + day)
    entries.push({
      exam_cycle_id: examCycle.id,
      section_id: section.id,
      date,
      time_slot_id: slotId,
      room_id: roomList[i % roomList.length].id,
      status: 'scheduled',
      created_by: admin.id,
    })
  })
  await prisma.scheduleEntry.createMany({ data: entries })

  // 10. Clash detection — compute from enrollments + schedule entries
  const entryBySection = new Map<string, { id: string; date: Date; time_slot_id: string }>()
  for (const e of await prisma.scheduleEntry.findMany({
    where: { exam_cycle_id: examCycle.id },
    select: { id: true, section_id: true, date: true, time_slot_id: true },
  })) {
    entryBySection.set(e.section_id, e)
  }

  const dayKey = (d: Date) => d.toISOString().slice(0, 10)
  const clashRows: Array<{
    type: string
    exam_cycle_id: string
    student_id: string
    schedule_entry_ids: string[]
    severity: string
    status: string
  }> = []
  const needsReview = new Set<string>()
  const enrollments = await prisma.enrollment.findMany({
    select: { student_id: true, section_id: true },
  })

  const byStudent = new Map<string, Array<{ id: string; date: Date; time_slot_id: string }>>()
  for (const en of enrollments) {
    const entry = entryBySection.get(en.section_id)
    if (!entry) continue
    const list = byStudent.get(en.student_id) ?? []
    list.push(entry)
    byStudent.set(en.student_id, list)
  }

  for (const [studentId, entriesForStudent] of byStudent) {
    const bySlot = new Map<string, Array<{ id: string; date: Date }>>()
    const byDay = new Map<string, Array<{ id: string; time_slot_id: string }>>()
    for (const e of entriesForStudent) {
      const key = `${dayKey(e.date)}|${e.time_slot_id}`
      bySlot.set(key, [...(bySlot.get(key) ?? []), { id: e.id, date: e.date }])
      const dk = dayKey(e.date)
      byDay.set(dk, [...(byDay.get(dk) ?? []), { id: e.id, time_slot_id: e.time_slot_id }])
    }

    for (const group of bySlot.values()) {
      if (group.length < 2) continue
      group.forEach((e) => needsReview.add(e.id))
      clashRows.push({
        type: 'same_slot',
        exam_cycle_id: examCycle.id,
        student_id: studentId,
        schedule_entry_ids: group.map((e) => e.id),
        severity: 'high',
        status: 'open',
      })
    }

    for (const [dk, group] of byDay) {
      if (group.length < 2) continue
      const slotGroup = bySlot.get(`${dk}|${group[0].time_slot_id}`)
      if (slotGroup && slotGroup.length >= 2) continue // already flagged same_slot
      clashRows.push({
        type: 'same_day',
        exam_cycle_id: examCycle.id,
        student_id: studentId,
        schedule_entry_ids: group.map((e) => e.id),
        severity: 'medium',
        status: 'open',
      })
    }
  }

  await prisma.clashRecord.createMany({ data: clashRows })

  await prisma.scheduleEntry.updateMany({
    where: { id: { in: [...needsReview] } },
    data: { status: 'needs_review' },
  })

  // 11. Invigilator assignments — 2 per exam, prefer same department
  const scheduleEntries = await prisma.scheduleEntry.findMany({
    where: { exam_cycle_id: examCycle.id },
  })
  const assignmentRows: Array<{
    schedule_entry_id: string
    invigilator_id: string
    status: string
  }> = []
  for (const entry of scheduleEntries) {
    const pickPool = [...invigilators].sort(() => rand() - 0.5)
    const chosen = pickPool.slice(0, 2)
    for (const inv of chosen) {
      assignmentRows.push({
        schedule_entry_id: entry.id,
        invigilator_id: inv.id,
        status: rand() > 0.4 ? 'assigned' : 'confirmed',
      })
    }
  }
  await prisma.invigilatorAssignment.createMany({ data: assignmentRows })

  // 12. Override requests
  const clash = await prisma.clashRecord.findFirst({ where: { status: 'open' } })
  if (clash) {
    await prisma.overrideRequest.create({
      data: {
        raised_by: coordinator.id,
        target_type: 'clash_record',
        target_id: clash.id,
        reason: 'Student has a valid medical request for the morning slot.',
        status: 'pending',
      },
    })
    await prisma.overrideRequest.create({
      data: {
        raised_by: coordinator.id,
        target_type: 'clash_record',
        target_id: clash.id,
        reason: 'Room change requested due to capacity.',
        status: 'approved',
        approved_by: admin.id,
        remarks: 'Approved. Auditorium reassigned.',
        decided_at: new Date(),
      },
    })
    await prisma.overrideRequest.create({
      data: {
        raised_by: coordinator.id,
        target_type: 'schedule_entry',
        target_id: scheduleEntries[0]?.id ?? clash.id,
        reason: 'Move exam to a different day.',
        status: 'rejected',
        approved_by: admin.id,
        remarks: 'No availability on requested day.',
        decided_at: new Date(),
      },
    })
  }

  // 13. Notifications
  await prisma.notification.createMany({
    data: [
      {
        user_id: admin.id,
        type: 'clash',
        title: 'Clashes detected',
        body: `${clashRows.length} timing conflicts were found in the draft timetable.`,
        link: '/clashes',
      },
      {
        user_id: admin.id,
        type: 'info',
        title: 'Timetable draft ready',
        body: 'The Fall 2026 exam timetable draft is ready for review.',
        link: '/timetable',
      },
      {
        user_id: coordinator.id,
        type: 'info',
        title: 'Invigilator shortfall',
        body: '3 exams still need invigilators.',
        link: '/invigilators',
      },
    ],
  })

  // 14. Audit log
  await prisma.auditLog.createMany({
    data: [
      {
        action_type: 'seed.run',
        target_type: 'database',
        target_id: 'smart_exam',
        performed_by: admin.id,
        meta: { seed: '2026-08-06', students: students.length, courses: courses.length },
      },
      {
        action_type: 'exam_cycle.create',
        target_type: 'exam_cycle',
        target_id: examCycle.id,
        performed_by: admin.id,
        meta: { name: examCycle.name, term: examCycle.term },
      },
      {
        action_type: 'schedule_entry.bulk_create',
        target_type: 'exam_cycle',
        target_id: examCycle.id,
        performed_by: admin.id,
        meta: { count: scheduleEntries.length },
      },
      {
        action_type: 'clash.detect',
        target_type: 'exam_cycle',
        target_id: examCycle.id,
        performed_by: admin.id,
        meta: { clashes: clashRows.length },
      },
    ],
  })

  console.log('✅ Seed complete:')
  console.log(`   Departments: ${departments.length}`)
  console.log(`   Courses: ${courses.length}`)
  console.log(`   Sections: ${allSections.length}`)
  console.log(`   Students: ${students.length}`)
  console.log(`   Enrollments: ${enrollmentRows.length}`)
  console.log(`   Rooms: ${roomList.length}`)
  console.log(`   Schedule entries: ${scheduleEntries.length}`)
  console.log(`   Clash records: ${clashRows.length}`)
  console.log(`   Invigilators: ${invigilators.length}`)
  console.log(`   Invigilator assignments: ${assignmentRows.length}`)
  console.log('   Admin login: admin@airuni.edu.pk / Password@123')
  console.log('   Coordinator login: coordinator@airuni.edu.pk / Password@123')
  console.log('   Invigilator (forced password change): usman.tariq@airuni.edu.pk / Password@123')
  console.log('   Student (no MFA): au2024cs042@airuni.edu.pk / Password@123')
}

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
