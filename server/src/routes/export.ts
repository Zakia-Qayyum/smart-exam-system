/**
 * Export & Reporting API — Step 28.  Mounted at /api/export.
 *
 * GET /csv            — streamed CSV download (query: examCycleId, departmentId, from, to)
 * GET /datesheet-pdf  — server-rendered PDF datesheet with watermark
 * GET /roll-no-slip/:studentId — per-student roll no slip (ownership enforced)
 * GET /history        — past export audit trail
 *
 * Every export writes an audit_log entry.
 */
import { Router } from 'express'
import PDFDocument from 'pdfkit'
import { requireAuth, requireRole, requireOwnership, type AuthenticatedUser } from '../middleware/require-auth.js'
import { prisma } from '../lib/prisma.js'
import { exportService } from '../services/export.service.js'

export const exportRouter = Router()

exportRouter.use(requireAuth)

const EXPORT_ROLES = ['admin', 'exam-coordinator', 'hod'] as const

// ── Helpers ───────────────────────────────────────────────────────────────

async function resolveStudentIdForUser(user: AuthenticatedUser): Promise<string | null> {
  if (user.role !== 'student') return null
  let student = await prisma.student.findFirst({
    where: { name: user.name, department_id: user.departmentId ?? undefined },
    select: { id: true },
  })
  if (!student && user.departmentId) {
    student = await prisma.student.findFirst({
      where: { department_id: user.departmentId },
      select: { id: true },
      orderBy: { reg_id: 'asc' },
    })
  }
  return student?.id ?? null
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

async function writeAuditExport(
  userId: string,
  exportType: string,
  label: string,
  filters: string,
  rowCount: number,
  filename: string,
) {
  await prisma.auditLog.create({
    data: {
      action_type: 'export.generate',
      target_type: 'export',
      target_id: `${exportType}:${Date.now()}`,
      performed_by: userId,
      meta: {
        export_type: exportType,
        label,
        filters,
        row_count: rowCount,
        filename,
      },
    },
  })
}

// ── GET /export/csv ───────────────────────────────────────────────────────

exportRouter.get('/csv', requireRole(...EXPORT_ROLES), async (req, res, next) => {
  try {
    const q = req.query as Record<string, string | undefined>
    const filter = {
      examCycleId: q.examCycleId || undefined,
      departmentId: q.departmentId || undefined,
      from: q.from || q.dateRange?.split(',')[0] || undefined,
      to: q.to || q.dateRange?.split(',')[1] || undefined,
    }

    const { cycle, rows } = await exportService.queryDatesheetRows(filter)

    const filename = `datesheet-${cycle.name.replace(/\s+/g, '-').toLowerCase()}.csv`
    const filterLabel = [
      filter.departmentId ? `dept:${filter.departmentId}` : '',
      filter.from || filter.to ? `range:${filter.from ?? ''}-${filter.to ?? ''}` : '',
    ]
      .filter(Boolean)
      .join(', ')

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

    const headers = [
      'Date',
      'Day',
      'Time Slot',
      'Start',
      'End',
      'Course Code',
      'Course Title',
      'Section',
      'Semester',
      'Department',
      'Room',
      'Capacity',
      'Enrolled',
      'Status',
      'Invigilators',
    ]
    res.write(headers.map(csvEscape).join(',') + '\n')

    for (const row of rows) {
      const line = [
        row.date,
        row.day,
        row.timeSlotLabel,
        row.timeSlotStart,
        row.timeSlotEnd,
        row.courseCode,
        row.courseTitle,
        row.sectionBatch,
        row.semester,
        row.departmentName,
        row.roomName,
        String(row.roomCapacity),
        String(row.enrolledCount),
        row.status,
        row.invigilators,
      ]
        .map(csvEscape)
        .join(',')
      res.write(line + '\n')
    }

    res.end()

    await writeAuditExport(
      res.locals.user.id,
      'csv',
      `${cycle.name} datesheet CSV`,
      filterLabel || 'all',
      rows.length,
      filename,
    )
  } catch (err) {
    next(err)
  }
})

// ── GET /export/datesheet-pdf ─────────────────────────────────────────────

exportRouter.get('/datesheet-pdf', requireRole(...EXPORT_ROLES), async (req, res, next) => {
  try {
    const q = req.query as Record<string, string | undefined>
    const filter = {
      examCycleId: q.examCycleId || undefined,
      departmentId: q.departmentId || undefined,
      from: q.from || undefined,
      to: q.to || undefined,
    }

    const { cycle, rows } = await exportService.queryDatesheetRows(filter)

    const filename = `datesheet-${cycle.name.replace(/\s+/g, '-').toLowerCase()}.pdf`

    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 40,
      info: {
        Title: `${cycle.name} — Exam Datesheet`,
        Author: 'Smart Exam System',
        Subject: `${cycle.term} examination schedule`,
      },
    })

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    doc.pipe(res)

    // ── Watermark based on publish status ──────────────────────────────
    if (cycle.status !== 'published') {
      doc.save()
      doc.rotate(45, { origin: [doc.page.width / 2, doc.page.height / 2] })
      doc.fontSize(60).fillColor('#e5e7eb').opacity(0.35)
        .text(cycle.status === 'draft' ? 'DRAFT' : cycle.status.toUpperCase(), 0, doc.page.height / 2 - 30, {
          align: 'center',
          width: doc.page.width,
        })
      doc.restore()
      doc.opacity(1)
    }

    // ── Header ─────────────────────────────────────────────────────────
    doc.fontSize(18).fillColor('#0f172a').font('Helvetica-Bold')
      .text(cycle.name, { align: 'center' })
    doc.fontSize(11).fillColor('#64748b').font('Helvetica')
      .text(`${cycle.term} · ${cycle.start_date} to ${cycle.end_date}`, { align: 'center' })
    doc.moveDown(0.5)

    // ── Table ──────────────────────────────────────────────────────────
    const colWidths = [70, 65, 100, 45, 45, 80, 130, 55, 160, 50, 50, 70]
    const headers = ['Date', 'Day', 'Time', 'Start', 'End', 'Course', 'Title', 'Room', 'Department', 'Cap', 'Enrl', 'Status']
    const startX = doc.x
    let y = doc.y

    const drawRow = (cells: string[], isHeader: boolean) => {
      const rowHeight = 18
      let x = startX

      for (let i = 0; i < cells.length; i++) {
        const w = colWidths[i] ?? 60
        if (isHeader) {
          doc.rect(x, y, w, rowHeight).fill('#0f172a')
          doc.fontSize(7).fillColor('#ffffff').font('Helvetica-Bold')
            .text(cells[i], x + 4, y + 4, { width: w - 8, height: rowHeight - 6, lineBreak: false })
        } else {
          doc.rect(x, y, w, rowHeight).fillAndStroke('#ffffff', '#e2e8f0')
          doc.fontSize(7).fillColor('#1e293b').font('Helvetica')
            .text(cells[i], x + 4, y + 4, { width: w - 8, height: rowHeight - 6, lineBreak: false })
        }
        x += w
      }

      y += rowHeight

      if (y > doc.page.height - 60) {
        doc.addPage()
        y = 40
      }
    }

    drawRow(headers, true)

    for (const row of rows) {
      drawRow([
        row.date,
        row.day,
        row.timeSlotLabel,
        row.timeSlotStart,
        row.timeSlotEnd,
        row.courseCode,
        row.courseTitle,
        row.roomName,
        row.departmentName,
        String(row.roomCapacity),
        String(row.enrolledCount),
        row.status === 'needs_review' ? '⚠ Review' : '✓ OK',
      ], false)
    }

    // ── Footer ─────────────────────────────────────────────────────────
    y += 20
    if (y > doc.page.height - 80) {
      doc.addPage()
      y = 40
    }
    doc.fontSize(8).fillColor('#94a3b8').font('Helvetica')
      .text(`Generated: ${new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC`, startX, y)
    doc.text(`${rows.length} sessions · ${cycle.name}`, startX, y + 12)

    doc.end()

    await writeAuditExport(
      res.locals.user.id,
      'datesheet-pdf',
      `${cycle.name} datesheet PDF`,
      filter.departmentId ? `dept:${filter.departmentId}` : 'all',
      rows.length,
      filename,
    )
  } catch (err) {
    next(err)
  }
})

// ── GET /export/roll-no-slip/:studentId ───────────────────────────────────
// Ownership enforcement: a student can only request their own slip.
// Admin/coordinator/hod may request any student's slip.

exportRouter.get(
  '/roll-no-slip/:studentId',
  requireOwnership(async (req, user) => {
    const studentId = String(req.params.studentId)
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, name: true, department_id: true },
    })
    if (!student) return undefined
    if (user.role === 'admin' || user.role === 'exam-coordinator' || user.role === 'dept-coordinator' || user.role === 'hod') return user.id
    if (user.role === 'student') {
      const ownedId = await resolveStudentIdForUser(user)
      return ownedId === studentId ? user.id : user.id + '__no_match'
    }
    return undefined
  }),
  async (req, res, next) => {
    try {
      const studentId = String(req.params.studentId)
      const q = req.query as Record<string, string | undefined>
      const { student, cycle, rows } = await exportService.queryRollSlipRows(studentId, q.examCycleId)

      const filename = `roll-no-slip-${student.regId.replace(/\s+/g, '-').toLowerCase()}.pdf`

      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `Roll No Slip — ${student.name}`,
          Author: 'Smart Exam System',
          Subject: `${cycle.name} roll number slip`,
        },
      })

      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      doc.pipe(res)

      // ── Watermark ────────────────────────────────────────────────────
      if (cycle.status !== 'published') {
        doc.save()
        doc.rotate(45, { origin: [doc.page.width / 2, doc.page.height / 2] })
        doc.fontSize(50).fillColor('#e5e7eb').opacity(0.35)
          .text(cycle.status === 'draft' ? 'DRAFT' : cycle.status.toUpperCase(), 0, doc.page.height / 2 - 25, {
            align: 'center',
            width: doc.page.width,
          })
        doc.restore()
        doc.opacity(1)
      }

      // ── Header ───────────────────────────────────────────────────────
      doc.fontSize(16).fillColor('#0f172a').font('Helvetica-Bold')
        .text('ROLL NUMBER SLIP', { align: 'center' })
      doc.moveDown(0.3)
      doc.fontSize(12).fillColor('#334155').font('Helvetica')
        .text(cycle.name, { align: 'center' })
      doc.fontSize(10).fillColor('#64748b')
        .text(cycle.term, { align: 'center' })
      doc.moveDown(0.8)

      // ── Student info ─────────────────────────────────────────────────
      const infoStart = 60
      doc.fontSize(10).fillColor('#0f172a').font('Helvetica-Bold')
      doc.text('Name:', infoStart, doc.y, { continued: true }).font('Helvetica').text(`  ${student.name}`)
      doc.font('Helvetica-Bold').text('Reg ID:', infoStart, doc.y, { continued: true }).font('Helvetica').text(`  ${student.regId}`)
      doc.font('Helvetica-Bold').text('Program:', infoStart, doc.y, { continued: true }).font('Helvetica').text(`  ${student.program}`)
      doc.font('Helvetica-Bold').text('Department:', infoStart, doc.y, { continued: true }).font('Helvetica').text(`  ${student.department}`)
      doc.moveDown(0.8)

      // ── Table ────────────────────────────────────────────────────────
      const colWidths = [75, 70, 120, 55, 55, 110, 55]
      const headers = ['Date', 'Day', 'Time', 'Start', 'End', 'Course', 'Seat #']
      let y = doc.y
      const startX = 60

      const drawRow = (cells: string[], isHeader: boolean) => {
        const rowHeight = 18
        let x = startX
        for (let i = 0; i < cells.length; i++) {
          const w = colWidths[i] ?? 80
          if (isHeader) {
            doc.rect(x, y, w, rowHeight).fill('#0f172a')
            doc.fontSize(7).fillColor('#ffffff').font('Helvetica-Bold')
              .text(cells[i], x + 4, y + 4, { width: w - 8, height: rowHeight - 6, lineBreak: false })
          } else {
            doc.rect(x, y, w, rowHeight).fillAndStroke('#ffffff', '#e2e8f0')
            doc.fontSize(7).fillColor('#1e293b').font('Helvetica')
              .text(cells[i], x + 4, y + 4, { width: w - 8, height: rowHeight - 6, lineBreak: false })
          }
          x += w
        }
        y += rowHeight
        if (y > doc.page.height - 80) {
          doc.addPage()
          y = 50
        }
      }

      drawRow(headers, true)
      for (const row of rows) {
        drawRow([row.date, row.day, row.timeSlotLabel, row.timeSlotStart, row.timeSlotEnd, row.courseCode, row.seatNo], false)
      }

      // ── Footer ───────────────────────────────────────────────────────
      y += 30
      if (y > doc.page.height - 100) {
        doc.addPage()
        y = 50
      }
      doc.fontSize(8).fillColor('#94a3b8').font('Helvetica')
        .text(`Generated: ${new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC`, startX, y)
      doc.text('This document is system-generated and does not require a signature.', startX, y + 12)

      doc.end()

      const user = res.locals.user as AuthenticatedUser
      await writeAuditExport(
        user.id,
        'roll-no-slip',
        `Roll no slip for ${student.name}`,
        `student:${student.regId}, cycle:${cycle.id}`,
        rows.length,
        filename,
      )
    } catch (err) {
      next(err)
    }
  },
)

// ── GET /export/history ───────────────────────────────────────────────────

exportRouter.get('/history', requireRole(...EXPORT_ROLES), async (_req, res, next) => {
  try {
    const entries = await exportService.listExportHistory()
    res.json({ entries })
  } catch (err) {
    next(err)
  }
})
