import type {
  MockCourse,
  MockDepartment,
  MockInvigilator,
  MockProgram,
  MockRoom,
  MockScheduleEntry,
  MockSection,
  MockTimeSlot,
  ScheduleSummary,
} from '@/lib/types'

export const EXAM_CYCLE = {
  id: 'cyc-fall-2026',
  name: 'Final Examinations Fall 2026',
  term: 'Fall-2026',
  start_date: '2026-08-10',
  end_date: '2026-08-14',
}

export const EXAM_WINDOW = { start: EXAM_CYCLE.start_date, end: EXAM_CYCLE.end_date }

export const departments: MockDepartment[] = [
  { id: 'd-cs', name: 'Computer Science', code: 'CS' },
  { id: 'd-se', name: 'Software Engineering', code: 'SE' },
  { id: 'd-ai', name: 'Artificial Intelligence', code: 'AI' },
  { id: 'd-ds', name: 'Data Science', code: 'DS' },
  { id: 'd-ba', name: 'Business Administration', code: 'BA' },
  { id: 'd-ee', name: 'Electrical Engineering', code: 'EE' },
  { id: 'd-ma', name: 'Mathematics', code: 'MA' },
]

export const programs: MockProgram[] = [
  { id: 'p-bscs', department_id: 'd-cs', name: 'BS Computer Science', code: 'BSCS', duration_years: 4 },
  { id: 'p-bsse', department_id: 'd-se', name: 'BS Software Engineering', code: 'BSSE', duration_years: 4 },
  { id: 'p-bsai', department_id: 'd-ai', name: 'BS Artificial Intelligence', code: 'BSAI', duration_years: 4 },
  { id: 'p-bsds', department_id: 'd-ds', name: 'BS Data Science', code: 'BSDS', duration_years: 4 },
  { id: 'p-bba', department_id: 'd-ba', name: 'Bachelor of Business Administration', code: 'BBA', duration_years: 4 },
  { id: 'p-bsel', department_id: 'd-ee', name: 'BS Electrical Engineering', code: 'BSEL', duration_years: 4 },
  { id: 'p-bsm', department_id: 'd-ma', name: 'BS Mathematics', code: 'BSM', duration_years: 4 },
  { id: 'p-bsis', department_id: 'd-cs', name: 'BS Information Systems', code: 'BSIS', duration_years: 4 },
]

const courseDefs: Array<[string, string, number, string]> = [
  ['CS-101', 'Introduction to Programming', 3, 'BSCS'],
  ['CS-202', 'Data Structures', 3, 'BSCS'],
  ['CS-305', 'Database Systems', 3, 'BSCS'],
  ['CS-401', 'Operating Systems', 4, 'BSCS'],
  ['SE-101', 'Software Engineering I', 3, 'BSSE'],
  ['SE-202', 'Software Architecture', 3, 'BSSE'],
  ['SE-301', 'Software Testing', 3, 'BSSE'],
  ['SE-402', 'Project Management', 3, 'BSSE'],
  ['AI-101', 'AI Fundamentals', 3, 'BSAI'],
  ['AI-202', 'Machine Learning', 3, 'BSAI'],
  ['AI-301', 'Deep Learning', 3, 'BSAI'],
  ['AI-402', 'Natural Language Processing', 3, 'BSAI'],
  ['DS-101', 'Data Science I', 3, 'BSDS'],
  ['DS-202', 'Statistical Methods', 3, 'BSDS'],
  ['DS-301', 'Big Data Analytics', 3, 'BSDS'],
  ['DS-402', 'Data Visualization', 3, 'BSDS'],
  ['BA-101', 'Principles of Management', 3, 'BBA'],
  ['BA-202', 'Marketing Management', 3, 'BBA'],
  ['BA-301', 'Corporate Finance', 3, 'BBA'],
  ['BA-402', 'Human Resource Management', 3, 'BBA'],
  ['EE-101', 'Electric Circuits', 3, 'BSEL'],
  ['EE-202', 'Digital Electronics', 3, 'BSEL'],
  ['EE-301', 'Signals & Systems', 3, 'BSEL'],
  ['EE-402', 'Power Systems', 4, 'BSEL'],
  ['MA-101', 'Calculus I', 3, 'BSM'],
  ['MA-202', 'Linear Algebra', 3, 'BSM'],
  ['MA-301', 'Differential Equations', 3, 'BSM'],
  ['MA-402', 'Discrete Mathematics', 3, 'BSM'],
  ['IS-101', 'Information Systems', 3, 'BSIS'],
  ['IS-202', 'Database Design', 3, 'BSIS'],
  ['IS-301', 'Computer Networks', 3, 'BSIS'],
  ['IS-402', 'Information Security', 3, 'BSIS'],
]

export const courses: MockCourse[] = courseDefs.map(([code, title, credit_hours, program_code]) => {
  const program = programs.find((p) => p.code === program_code)!
  return { course_code: code, title, department_id: program.department_id, credit_hours, program_code }
})

export const timeSlots: MockTimeSlot[] = [
  { id: 'ts-1', label: 'Morning', start_time: '08:30', end_time: '11:00' },
  { id: 'ts-2', label: 'Midday', start_time: '11:30', end_time: '13:30' },
  { id: 'ts-3', label: 'Afternoon', start_time: '14:30', end_time: '17:00' },
  { id: 'ts-4', label: 'Evening', start_time: '17:30', end_time: '20:00' },
]

export const rooms: MockRoom[] = [
  { id: 'r-1', name: 'Hall A', department_id: null, capacity: 90 },
  { id: 'r-2', name: 'Hall B', department_id: null, capacity: 90 },
  { id: 'r-3', name: 'Hall C', department_id: null, capacity: 60 },
  { id: 'r-4', name: 'Hall D', department_id: null, capacity: 60 },
  { id: 'r-5', name: 'Room E', department_id: null, capacity: 45 },
  { id: 'r-6', name: 'Room F', department_id: null, capacity: 40 },
  { id: 'r-7', name: 'Room G', department_id: null, capacity: 55 },
  { id: 'r-8', name: 'Room H', department_id: null, capacity: 50 },
  { id: 'r-9', name: 'CS Lab 1', department_id: 'd-cs', capacity: 45 },
  { id: 'r-10', name: 'CS Lab 2', department_id: 'd-cs', capacity: 45 },
  { id: 'r-11', name: 'Auditorium', department_id: null, capacity: 120 },
  { id: 'r-12', name: 'Seminar Hall', department_id: null, capacity: 75 },
]

const invigilatorNames = [
  'Usman Tariq',
  'Ayesha Khan',
  'Bilal Ahmed',
  'Fatima Noor',
  'Hamza Ali',
  'Sana Malik',
  'Omar Farooq',
  'Zainab Bibi',
  'Ahmed Raza',
  'Mariam Siddiqui',
  'Hassan Shah',
  'Nadia Aslam',
  'Imran Qureshi',
  'Rabia Anjum',
  'Fahad Mehmood',
  'Hira Khan',
  'Kashif Iqbal',
  'Mahnoor Fatima',
  'Saad Baig',
  'Iqra Yousaf',
]

const availabilityCycle: MockInvigilator['availability'][] = [
  'Available',
  'Available',
  'Busy',
  'Available',
  'Available',
  'On leave',
]

const designations = [
  'Lecturer',
  'Assistant Professor',
  'Associate Professor',
  'Teaching Fellow',
  'Lab Instructor',
]

const specializationByDepartment: Record<string, string[]> = {
  'd-cs': ['Programming', 'Data Structures', 'Databases', 'Operating Systems'],
  'd-se': ['Software Architecture', 'Testing', 'Agile Delivery', 'Project Management'],
  'd-ai': ['Machine Learning', 'Deep Learning', 'Natural Language Processing'],
  'd-ds': ['Statistics', 'Big Data', 'Data Visualization'],
  'd-ba': ['Finance', 'Marketing', 'Human Resources'],
  'd-ee': ['Circuits', 'Digital Electronics', 'Power Systems'],
  'd-ma': ['Calculus', 'Linear Algebra', 'Discrete Mathematics'],
}

export function invigilatorEmailFor(name: string): string {
  return `${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')}@airuni.edu.pk`
}

function invigilatorPhoneFor(index: number): string {
  const a = 200 + ((index * 173) % 700)
  const b = 1000 + ((index * 397) % 9000)
  return `+92 3${(index % 10) + 1}${String(a).padStart(3, '0')}-${String(b).padStart(4, '0')}`
}

const assignmentDays = ['2026-08-10', '2026-08-11', '2026-08-12']

function assignmentHistoryFor(index: number, department_id: string): MockInvigilator['assignment_history'] {
  const deptCourses = courses.filter((c) => c.department_id === department_id)
  return assignmentDays.map((date, k) => {
    const course = deptCourses[(index + k * 2) % Math.max(deptCourses.length, 1)]
    const slot = timeSlots[(index + k) % timeSlots.length]
    const room = rooms[(index + k * 3) % rooms.length]
    return {
      id: `asg-${index + 1}-${k + 1}`,
      course_code: course?.course_code ?? '—',
      course_title: course?.title ?? '—',
      date,
      time_slot_label: slot.label,
      room_name: room.name,
      status: k === 2 ? 'confirmed' : 'completed',
    }
  })
}

export const invigilators: MockInvigilator[] = invigilatorNames.map((name, i) => {
  const dept = departments[i % departments.length]
  const tags = specializationByDepartment[dept.id] ?? ['General']
  return {
    id: `inv-${i + 1}`,
    name,
    department_id: dept.id,
    department_name: dept.name,
    availability: availabilityCycle[i % availabilityCycle.length],
    assigned_count: i % 4,
    max_assignments_per_cycle: 5,
    designation: designations[i % designations.length],
    email: invigilatorEmailFor(name),
    phone: invigilatorPhoneFor(i),
    specialization_tags: tags.slice(0, 1 + (i % 3)),
    assignment_history: assignmentHistoryFor(i, dept.id),
  }
})

export const BATCHES = ['2021', '2022', '2023', '2024', '2025']

export function sectionsFor(courseIndex: number, course: MockCourse): MockSection[] {
  return BATCHES.map((batch, batchIndex) => ({
    id: `sec-${course.course_code.toLowerCase()}-${batch}`,
    course_code: course.course_code,
    course_title: course.title,
    department_id: course.department_id,
    program: course.program_code,
    batch,
    enrolled_count: 18 + ((courseIndex * 7 + batchIndex * 11) % 42),
  }))
}

export function formatDateLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export function roomFor(enrolled: number): MockRoom {
  const sorted = [...rooms].sort((a, b) => a.capacity - b.capacity)
  return sorted.find((r) => r.capacity >= enrolled) ?? rooms[0]
}

const forcedClashes: Array<{ program: string; batch: string; courseA: string; courseB: string }> = [
  { program: 'BSCS', batch: '2023', courseA: 'CS-202', courseB: 'CS-305' },
  { program: 'BSSE', batch: '2022', courseA: 'SE-101', courseB: 'SE-202' },
]

export function buildScheduleEntries(): { entries: MockScheduleEntry[]; summary: ScheduleSummary } {
  const entries: MockScheduleEntry[] = []
  const days = ['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14']

  courses.forEach((course, courseIndex) => {
    sectionsFor(courseIndex, course).forEach((section, batchIndex) => {
      const date = days[(courseIndex + batchIndex) % days.length]
      const slot = timeSlots[(courseIndex + batchIndex) % timeSlots.length]
      const room = roomFor(section.enrolled_count)
      entries.push({
        id: `se-${section.id}`,
        exam_cycle_id: EXAM_CYCLE.id,
        section_id: section.id,
        course_code: course.course_code,
        course_title: course.title,
        department_id: course.department_id,
        program: section.program,
        batch: section.batch,
        date,
        time_slot_id: slot.id,
        time_slot_label: slot.label,
        room_id: room.id,
        room_name: room.name,
        room_capacity: room.capacity,
        enrolled_count: section.enrolled_count,
        status: 'scheduled',
      })
    })
  })

  forcedClashes.forEach(({ program, batch, courseA, courseB }) => {
    const a = entries.find((e) => e.program === program && e.batch === batch && e.course_code === courseA)
    const b = entries.find((e) => e.program === program && e.batch === batch && e.course_code === courseB)
    if (!a || !b) return
    b.date = a.date
    b.time_slot_id = a.time_slot_id
    b.time_slot_label = a.time_slot_label
    const label = `${program} ${batch}`
    const when = `${formatDateLabel(a.date)} · ${a.time_slot_label}`
    a.status = 'needs_review'
    b.status = 'needs_review'
    a.clash_detail = `${label} · ${a.course_code} collides with ${b.course_code} — ${a.enrolled_count} student(s) have both exams on ${when}.`
    b.clash_detail = `${label} · ${b.course_code} collides with ${a.course_code} — ${b.enrolled_count} student(s) have both exams on ${when}.`
  })

  const needsReview = entries.filter((e) => e.status === 'needs_review')
  const summary: ScheduleSummary = {
    total: entries.length,
    scheduled: entries.length - needsReview.length,
    needs_review: needsReview.length,
    same_slot: needsReview.length,
    same_day: 0,
  }
  return { entries, summary }
}