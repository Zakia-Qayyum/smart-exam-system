/**
 * Invigilator Directory — Step 16.
 *
 * The API mirrors the Step 15 `MockInvigilator` shape exactly (field names and
 * types). Three fields do not exist in the database and are derived here:
 *   - `availability`  → derived from per-cycle load + user status
 *   - `designation`   → no source of truth; a stable placeholder
 *   - `phone`         → no source of truth; empty string
 *
 * The roster is small, so list filtering/searching/sorting happens in memory
 * after each record is mapped. Assignment counts are scoped to one exam cycle
 * (draft-first via `resolveExamCycle`), matching the scheduling screens.
 */
import { randomBytes } from 'node:crypto'
import { prisma } from '../lib/prisma.js'
import { HttpError } from '../lib/http-error.js'
import { logger } from '../lib/logger.js'
import { hashPassword } from '../lib/password.js'
import { dateKey, resolveExamCycle } from '../lib/schedule-utils.js'

export type InvigilatorAvailability = 'Available' | 'Busy' | 'On leave'
export type InvigilatorAssignmentStatus = 'assigned' | 'confirmed' | 'declined'

export interface ApiInvigilatorAssignment {
  id: string
  course_code: string
  course_title: string
  date: string
  time_slot_label: string
  room_name: string
  status: InvigilatorAssignmentStatus
}

export interface ApiInvigilator {
  id: string
  name: string
  department_id: string
  department_name: string
  availability: InvigilatorAvailability
  assigned_count: number
  max_assignments_per_cycle: number
  designation: string
  email: string
  phone: string
  specialization_tags: string[]
  assignment_history: ApiInvigilatorAssignment[]
}

export interface CreateInvigilatorInput {
  name: string
  email: string
  department_id: string
  max_assignments_per_cycle?: number
  specialization_tags?: string[]
}

export interface UpdateInvigilatorInput {
  name?: string
  email?: string
  department_id?: string
  max_assignments_per_cycle?: number
  specialization_tags?: string[]
}

export interface InvigilatorListQuery {
  cycleId?: string
  search?: string
  departmentId?: string
  availability?: InvigilatorAvailability
  tag?: string
  page?: number
  pageSize?: number
}

// ── Pure helpers (unit-tested in test/invigilators-import.test.ts) ─────────

/** RFC 4180-lite line parser: quoted fields, `""` escapes, CRLF/blank lines. */
export function parseCsvLines(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      cell += ch
      i++
      continue
    }
    if (ch === '"') {
      inQuotes = true
      i++
      continue
    }
    if (ch === ',') {
      row.push(cell.trim())
      cell = ''
      i++
      continue
    }
    if (ch === '\n' || ch === '\r') {
      row.push(cell.trim())
      cell = ''
      if (row.length > 1 || row[0] !== '') rows.push(row)
      row = []
      if (ch === '\r' && text[i + 1] === '\n') i += 2
      else i++
      continue
    }
    cell += ch
    i++
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim())
    if (row.length > 1 || row[0] !== '') rows.push(row)
  }
  return rows
}

export interface ImportRowContext {
  departments: Array<{ id: string; code: string; name: string }>
  existingEmails: ReadonlySet<string>
  existingNames: ReadonlySet<string>
}

export interface ImportPreviewRow {
  line: number
  name: string
  email: string
  department_raw: string
  department_id: string
  department_name: string
  designation: string
  max_assignments_per_cycle: number | null
  max_raw: string
  specialization_tags: string[]
  errors: string[]
  duplicate: boolean
}

/**
 * Validate parsed CSV rows against the roster and the department reference.
 * Mirrors the Step 15 frontend preview semantics (required fields, email
 * format, roster + in-file duplicates, department by code/name/id).
 */
export function validateImportRows(csvRows: string[][], ctx: ImportRowContext): ImportPreviewRow[] {
  const seenEmails = new Set<string>()
  const seenNames = new Set<string>()
  return csvRows.map((cells, index) => {
    const [name = '', email = '', department_raw = '', designation = '', max_raw = '', tagsRaw = ''] = cells
    const errors: string[] = []
    const emailLc = email.trim().toLowerCase()
    const nameLc = name.trim().toLowerCase()
    const deptRaw = department_raw.trim()

    if (!nameLc) errors.push('Name is required')

    if (!emailLc) errors.push('Email is required')
    else if (!/^\S+@\S+\.\S+$/.test(emailLc)) errors.push('Email is not a valid address')
    else if (ctx.existingEmails.has(emailLc) || seenEmails.has(emailLc)) errors.push('Duplicate email')
    seenEmails.add(emailLc)

    if (ctx.existingNames.has(nameLc) || seenNames.has(nameLc)) {
      if (errors.length === 0) errors.push('Duplicate name')
    }
    seenNames.add(nameLc)

    const dept = ctx.departments.find(
      (d) =>
        d.code.toLowerCase() === deptRaw.toLowerCase() ||
        d.name.toLowerCase() === deptRaw.toLowerCase() ||
        d.id.toLowerCase() === deptRaw.toLowerCase(),
    )
    if (!deptRaw) errors.push('Department is required')
    else if (!dept) errors.push(`Unknown department “${deptRaw}”`)

    let max: number | null = null
    if (max_raw.trim()) {
      const parsed = Number.parseInt(max_raw.trim(), 10)
      if (Number.isNaN(parsed) || parsed < 1) errors.push('Max assignments must be a positive number')
      else max = parsed
    }

    return {
      line: index + 1,
      name: name.trim(),
      email: emailLc,
      department_raw: deptRaw,
      department_id: dept?.id ?? '',
      department_name: dept?.name ?? '',
      designation: designation.trim() || 'Teaching Fellow',
      max_assignments_per_cycle: max,
      max_raw: max_raw.trim(),
      specialization_tags: tagsRaw
        .split(/[;|]/)
        .map((t) => t.trim())
        .filter(Boolean),
      errors,
      duplicate: errors.some((e) => e.startsWith('Duplicate')),
    }
  })
}

export function deriveAvailability(
  assignedCount: number,
  maxAssignments: number,
  userStatus: string,
): InvigilatorAvailability {
  if (userStatus === 'disabled') return 'On leave'
  if (assignedCount >= maxAssignments) return 'Busy'
  return 'Available'
}

export function deriveDesignation(): string {
  return 'Faculty'
}

/** Structural shape of a prisma `invigilator` row with `rosterInclude`. */
export interface RosterRow {
  id: string
  department_id: string
  max_assignments_per_cycle: number
  specialization_tags: string[]
  user: { name: string; email: string; status: string }
  department: { name: string }
  assignments: Array<{
    id: string
    status: string
    schedule_entry: {
      date: Date
      section: { course: { course_code: string; title: string } }
      time_slot: { label: string }
      room: { name: string }
    }
  }>
}

export function toInvigilatorDto(row: RosterRow): ApiInvigilator {
  const assignedCount = row.assignments.filter(
    (a) => a.status === 'assigned' || a.status === 'confirmed',
  ).length
  return {
    id: row.id,
    name: row.user.name,
    department_id: row.department_id,
    department_name: row.department.name,
    availability: deriveAvailability(assignedCount, row.max_assignments_per_cycle, row.user.status),
    assigned_count: assignedCount,
    max_assignments_per_cycle: row.max_assignments_per_cycle,
    designation: deriveDesignation(),
    email: row.user.email,
    phone: '',
    specialization_tags: row.specialization_tags,
    assignment_history: row.assignments.map((a) => ({
      id: a.id,
      course_code: a.schedule_entry.section.course.course_code,
      course_title: a.schedule_entry.section.course.title,
      date: dateKey(a.schedule_entry.date),
      time_slot_label: a.schedule_entry.time_slot.label,
      room_name: a.schedule_entry.room.name,
      status: a.status as InvigilatorAssignmentStatus,
    })),
  }
}

// ── DB-backed service ──────────────────────────────────────────────────────

function rosterIncludeFor(cycleId: string) {
  return {
    user: { select: { name: true, email: true, status: true } },
    department: { select: { name: true } },
    assignments: {
      where: { schedule_entry: { exam_cycle_id: cycleId } },
      select: {
        id: true,
        status: true,
        schedule_entry: {
          select: {
            date: true,
            section: { select: { course: { select: { course_code: true, title: true } } } },
            time_slot: { select: { label: true } },
            room: { select: { name: true } },
          },
        },
      },
      orderBy: { schedule_entry: { date: 'desc' } },
    },
  } as const
}

function cycleDto(cycle: { id: string; name: string; term: string; start_date: Date; end_date: Date; status: string }) {
  return {
    id: cycle.id,
    name: cycle.name,
    term: cycle.term,
    start_date: dateKey(cycle.start_date),
    end_date: dateKey(cycle.end_date),
    status: cycle.status,
  }
}

export async function listInvigilators(query: InvigilatorListQuery) {
  const cycle = await resolveExamCycle(query.cycleId)
  const rows = await prisma.invigilator.findMany({ include: rosterIncludeFor(cycle.id) })
  const roster = rows.map((r) => toInvigilatorDto(r))

  const q = query.search?.trim().toLowerCase() ?? ''
  const filtered = roster
    .filter((inv) => {
      if (query.departmentId && inv.department_id !== query.departmentId) return false
      if (query.availability && inv.availability !== query.availability) return false
      if (query.tag && !inv.specialization_tags.includes(query.tag)) return false
      if (!q) return true
      const haystack = [
        inv.name,
        inv.email,
        inv.designation,
        inv.department_name,
        ...inv.specialization_tags,
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  const page = Math.max(1, query.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 10))
  const start = (page - 1) * pageSize

  return {
    cycle: cycleDto(cycle),
    invigilators: filtered.slice(start, start + pageSize),
    total: filtered.length,
    page,
    page_size: pageSize,
    summary: {
      total: roster.length,
      available: roster.filter((i) => i.availability === 'Available').length,
      busy: roster.filter((i) => i.availability === 'Busy').length,
      on_leave: roster.filter((i) => i.availability === 'On leave').length,
      assigned: roster.reduce((sum, i) => sum + i.assigned_count, 0),
      max: roster.reduce((sum, i) => sum + i.max_assignments_per_cycle, 0),
    },
  }
}

export async function getInvigilator(id: string, cycleId?: string): Promise<ApiInvigilator> {
  const cycle = await resolveExamCycle(cycleId)
  const row = await prisma.invigilator.findUnique({
    where: { id },
    include: rosterIncludeFor(cycle.id),
  })
  if (!row) throw new HttpError(404, 'invigilator_not_found', 'Invigilator not found')
  return toInvigilatorDto(row)
}

export async function createInvigilator(body: CreateInvigilatorInput, performedBy: string): Promise<ApiInvigilator> {
  const email = body.email.trim().toLowerCase()
  const existing = await prisma.user.findUnique({ where: { email }, include: { invigilator: true } })
  if (existing?.invigilator) {
    throw new HttpError(409, 'invigilator_exists', `An invigilator with email ${email} already exists`)
  }
  const department = await prisma.department.findUnique({ where: { id: body.department_id } })
  if (!department) throw new HttpError(404, 'department_not_found', 'Department not found')

  const data = {
    department_id: body.department_id,
    max_assignments_per_cycle: body.max_assignments_per_cycle ?? 5,
    specialization_tags: body.specialization_tags ?? [],
  }

  const invigilatorId = await prisma.$transaction(async (tx) => {
    if (existing) {
      const invigilator = await tx.invigilator.create({ data: { user_id: existing.id, ...data } })
      await tx.user.update({ where: { id: existing.id }, data: { role: 'faculty' } })
      await tx.auditLog.create({
        data: {
          action_type: 'invigilator.create',
          target_type: 'invigilator',
          target_id: invigilator.id,
          performed_by: performedBy,
          meta: { email },
        },
      })
      return invigilator.id
    }
    const user = await tx.user.create({
      data: {
        name: body.name.trim(),
        email,
        password_hash: await hashPassword(randomBytes(18).toString('hex')),
        role: 'faculty',
        department_id: body.department_id,
        status: 'active',
        must_change_password: true,
        mfa_enabled: true,
      },
    })
    const invigilator = await tx.invigilator.create({ data: { user_id: user.id, ...data } })
    await tx.auditLog.create({
      data: {
        action_type: 'invigilator.create',
        target_type: 'invigilator',
        target_id: invigilator.id,
        performed_by: performedBy,
        meta: { email },
      },
    })
    return invigilator.id
  })

  const cycle = await resolveExamCycle()
  const created = await prisma.invigilator.findUnique({
    where: { id: invigilatorId },
    include: rosterIncludeFor(cycle.id),
  })
  if (!created) throw new HttpError(500, 'create_failed', 'Invigilator record could not be loaded')
  return toInvigilatorDto(created)
}

export async function updateInvigilator(
  id: string,
  body: UpdateInvigilatorInput,
  performedBy: string,
): Promise<ApiInvigilator> {
  const row = await prisma.invigilator.findUnique({ where: { id }, include: { user: true } })
  if (!row) throw new HttpError(404, 'invigilator_not_found', 'Invigilator not found')

  let email = row.user.email
  if (body.email && body.email.trim().toLowerCase() !== row.user.email.toLowerCase()) {
    const emailLc = body.email.trim().toLowerCase()
    const clash = await prisma.user.findUnique({ where: { email: emailLc } })
    if (clash) throw new HttpError(409, 'email_taken', 'Another account already uses this email')
    email = emailLc
  }

  const department = await prisma.department.findUnique({ where: { id: body.department_id ?? row.department_id } })
  if (!department) throw new HttpError(404, 'department_not_found', 'Department not found')

  const data = {
    department_id: body.department_id ?? row.department_id,
    max_assignments_per_cycle: body.max_assignments_per_cycle ?? row.max_assignments_per_cycle,
    specialization_tags: body.specialization_tags ?? row.specialization_tags,
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: row.user_id },
      data: { name: body.name?.trim() ?? row.user.name, email },
    })
    await tx.invigilator.update({ where: { id }, data })
    await tx.auditLog.create({
      data: {
        action_type: 'invigilator.update',
        target_type: 'invigilator',
        target_id: id,
        performed_by: performedBy,
        meta: { email },
      },
    })
  })

  const cycle = await resolveExamCycle()
  const updated = await prisma.invigilator.findUnique({ where: { id }, include: rosterIncludeFor(cycle.id) })
  if (!updated) throw new HttpError(404, 'invigilator_not_found', 'Invigilator not found')
  return toInvigilatorDto(updated)
}

export interface ImportSummary {
  total: number
  valid: number
  duplicates: number
  invalid: number
}

export interface ImportPreview {
  rows: ImportPreviewRow[]
  summary: ImportSummary
}

async function importContext() {
  const [departments, invigilators] = await Promise.all([
    prisma.department.findMany({ select: { id: true, code: true, name: true } }),
    prisma.invigilator.findMany({ select: { user: { select: { email: true, name: true } } } }),
  ])
  return {
    departments,
    existingEmails: new Set(invigilators.map((i) => i.user.email.toLowerCase())),
    existingNames: new Set(invigilators.map((i) => i.user.name.toLowerCase())),
  } satisfies ImportRowContext
}

export async function previewBulkImport(text: string): Promise<ImportPreview> {
  const ctx = await importContext()
  const rows = validateImportRows(parseCsvLines(text), ctx)
  const summary: ImportSummary = {
    total: rows.length,
    valid: rows.filter((r) => r.errors.length === 0 && !r.duplicate).length,
    duplicates: rows.filter((r) => r.duplicate).length,
    invalid: rows.filter((r) => r.errors.length > 0 && !r.duplicate).length,
  }
  return { rows, summary }
}

export interface BulkImportResult {
  imported: number
  skippedDuplicates: number
  failed: number
}

type ImportOutcome = 'imported' | 'skipped' | 'failed'

async function importRow(row: ImportPreviewRow): Promise<ImportOutcome> {
  const data = {
    department_id: row.department_id,
    max_assignments_per_cycle: row.max_assignments_per_cycle ?? 5,
    specialization_tags: row.specialization_tags,
  }
  try {
    const existing = await prisma.user.findUnique({ where: { email: row.email }, include: { invigilator: true } })
    if (existing?.invigilator) return 'skipped'
    if (existing) {
      await prisma.$transaction([
        prisma.user.update({ where: { id: existing.id }, data: { role: 'faculty' } }),
        prisma.invigilator.create({ data: { user_id: existing.id, ...data } }),
      ])
    } else {
      await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name: row.name,
            email: row.email,
            password_hash: await hashPassword(randomBytes(18).toString('hex')),
            role: 'faculty',
            department_id: row.department_id,
            status: 'active',
            must_change_password: true,
            mfa_enabled: true,
          },
        })
        await tx.invigilator.create({ data: { user_id: user.id, ...data } })
      })
    }
    return 'imported'
  } catch (err) {
    logger.error({ err, email: row.email }, 'bulk import row failed')
    return 'failed'
  }
}

export async function commitBulkImport(text: string, performedBy: string): Promise<BulkImportResult> {
  const ctx = await importContext()
  const rows = validateImportRows(parseCsvLines(text), ctx)

  let imported = 0
  let skippedDuplicates = 0
  let failed = 0
  for (const row of rows) {
    if (row.duplicate) {
      skippedDuplicates++
      continue
    }
    if (row.errors.length > 0) {
      failed++
      continue
    }
    const outcome = await importRow(row)
    if (outcome === 'imported') imported++
    else if (outcome === 'skipped') skippedDuplicates++
    else failed++
  }

  await prisma.auditLog.create({
    data: {
      action_type: 'invigilator.bulk_import',
      target_type: 'invigilator_directory',
      target_id: 'bulk',
      performed_by: performedBy,
      meta: { imported, skippedDuplicates, failed },
    },
  })

  return { imported, skippedDuplicates, failed }
}
