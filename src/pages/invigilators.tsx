import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertTriangle,
  Building2,
  Download,
  FileUp,
  Mail,
  Phone,
  Plus,
  Search,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Select, type SelectOption } from '@/components/ui/select'
import { StatusChip } from '@/components/ui/status-chip'
import { toast } from '@/components/ui/toast-store'
import { departments, formatDateLabel, invigilators as baseInvigilators } from '@/config/scheduling-data'
import { cn } from '@/lib/utils'
import type { MockInvigilator, MockInvigilatorAssignment } from '@/lib/types'

const ADDITIONS_KEY = 'ses.invigilators.additions'
const OVERRIDES_KEY = 'ses.invigilators.overrides'

const DESIGNATION_OPTIONS = [
  'Lecturer',
  'Assistant Professor',
  'Associate Professor',
  'Teaching Fellow',
  'Lab Instructor',
]

const AVAILABILITY_OPTIONS: Array<{ value: MockInvigilator['availability']; label: string }> = [
  { value: 'Available', label: 'Available' },
  { value: 'Busy', label: 'Busy' },
  { value: 'On leave', label: 'On leave' },
]

const ASSIGNMENT_STATUS: Record<MockInvigilatorAssignment['status'], { label: string; chip: 'no-clash' | 'pending' | 'info' }> = {
  completed: { label: 'Completed', chip: 'no-clash' },
  confirmed: { label: 'Confirmed', chip: 'info' },
  assigned: { label: 'Assigned', chip: 'pending' },
}

type AvailabilityFilter = 'all' | MockInvigilator['availability']

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function availabilityChip(availability: MockInvigilator['availability']): { label: string; chip: 'no-clash' | 'pending' | 'clash' } {
  switch (availability) {
    case 'Available':
      return { label: 'Available', chip: 'no-clash' }
    case 'Busy':
      return { label: 'Busy', chip: 'pending' }
    case 'On leave':
      return { label: 'On leave', chip: 'clash' }
  }
}

function progressWidth(assigned: number, max: number): number {
  if (max <= 0) return 0
  return Math.min(100, Math.round((assigned / max) * 100))
}

// ── CSV parsing for the two-phase bulk import ──────────────────────────────

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      cells.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  cells.push(current)
  return cells
}

interface ImportRow {
  key: string
  name: string
  email: string
  department_raw: string
  designation: string
  max_raw: string
  tags: string[]
  department_id: string
  department_name: string
  errors: string[]
  duplicate: boolean
}

function parseImportText(text: string, roster: MockInvigilator[]): ImportRow[] {
  const existingEmails = new Set(roster.map((i) => i.email.toLowerCase()))
  const existingNames = new Set(roster.map((i) => i.name.toLowerCase()))
  const fileEmails = new Set<string>()
  const fileNames = new Set<string>()

  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const cells = parseCsvLine(line).map((cell) => cell.trim())
      const [name = '', email = '', department_raw = '', designation = '', max_raw = '', tagsRaw = ''] = cells
      const errors: string[] = []

      if (!name) errors.push('Name is required')

      const emailLc = email.toLowerCase()
      if (!email) errors.push('Email is required')
      else if (!/^\S+@\S+\.\S+$/.test(emailLc)) errors.push('Email is not a valid address')
      else if (existingEmails.has(emailLc) || fileEmails.has(emailLc)) errors.push('Duplicate email')
      fileEmails.add(emailLc)

      if (existingNames.has(name.toLowerCase()) || fileNames.has(name.toLowerCase())) {
        if (errors.length === 0) errors.push('Duplicate name')
      }
      fileNames.add(name.toLowerCase())

      const dept = departments.find(
        (d) =>
          d.code.toLowerCase() === department_raw.toLowerCase() ||
          d.name.toLowerCase() === department_raw.toLowerCase() ||
          d.id.toLowerCase() === department_raw.toLowerCase(),
      )
      if (!department_raw) errors.push('Department is required')
      else if (!dept) errors.push(`Unknown department “${department_raw}”`)

      if (max_raw) {
        const parsed = Number.parseInt(max_raw, 10)
        if (Number.isNaN(parsed) || parsed < 1) errors.push('Max assignments must be a positive number')
      }

      const tags = tagsRaw
        .split(/[;|]/)
        .map((t) => t.trim())
        .filter(Boolean)

      return {
        key: `row-${index}`,
        name,
        email,
        department_raw,
        designation: designation || 'Teaching Fellow',
        max_raw,
        tags,
        department_id: dept?.id ?? '',
        department_name: dept?.name ?? '',
        errors,
        duplicate: errors.some((e) => e.startsWith('Duplicate')),
      }
    })
}

const SAMPLE_IMPORT = `Adeel Rana, adeel.rana@airuni.edu.pk, CS, Lecturer, 5, Programming; Databases
Nimra Javed, nimra.javed@airuni.edu.pk, d-se, Assistant Professor, 4, Testing; Agile Delivery
Usman Tariq, usman.tariq@airuni.edu.pk, d-cs, Associate Professor, 5, Programming
TBD, bad-email, XR, , ,`

function importStatus(row: ImportRow): { label: string; variant: 'success' | 'warning' | 'danger' } {
  if (row.duplicate) return { label: 'Duplicate', variant: 'warning' }
  if (row.errors.length > 0) return { label: 'Invalid', variant: 'danger' }
  return { label: 'Valid', variant: 'success' }
}

// ── Profile drawer ─────────────────────────────────────────────────────────

function ProfileDrawer({
  invigilator,
  onClose,
  onEdit,
  onNotify,
}: {
  invigilator: MockInvigilator | null
  onClose: () => void
  onEdit: () => void
  onNotify: () => void
}) {
  useEffect(() => {
    if (!invigilator) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [invigilator, onClose])

  if (!invigilator) return null

  const chip = availabilityChip(invigilator.availability)

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-navy-deep/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`${invigilator.name} profile`}
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-line bg-card shadow-lift animate-[drawerIn_200ms_ease-out]"
      >
        <div className="relative overflow-hidden bg-navy px-6 py-6">
          <div className="absolute -right-10 -top-14 h-44 w-44 rounded-full bg-gold/15" aria-hidden="true" />
          <div className="absolute right-16 -top-8 h-28 w-28 rounded-full bg-white/10" aria-hidden="true" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close profile"
            className="absolute right-4 top-4 rounded-md p-1.5 text-white/70 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="relative flex items-center gap-4">
            <Avatar name={invigilator.name} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-lg font-black tracking-tight text-white">{invigilator.name}</p>
              <p className="truncate text-sm font-medium text-white/75">{invigilator.designation}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="gold">
                  <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                  {invigilator.department_name}
                </Badge>
                <StatusChip status={chip.chip} label={chip.label} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-1 gap-2.5">
            <a
              href={`mailto:${invigilator.email}`}
              className="flex items-center gap-3 rounded-md border border-line bg-surface/60 px-3.5 py-2.5 text-sm transition-colors hover:border-navy/40 hover:bg-surface"
            >
              <Mail className="h-4 w-4 shrink-0 text-navy-muted" aria-hidden="true" />
              <span className="min-w-0 truncate text-ink">{invigilator.email}</span>
            </a>
            <a
              href={`tel:${invigilator.phone.replace(/\s/g, '')}`}
              className="flex items-center gap-3 rounded-md border border-line bg-surface/60 px-3.5 py-2.5 text-sm transition-colors hover:border-navy/40 hover:bg-surface"
            >
              <Phone className="h-4 w-4 shrink-0 text-navy-muted" aria-hidden="true" />
              <span className="text-ink">{invigilator.phone}</span>
            </a>
          </div>

          <div className="mt-5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">Cycle load</p>
            <div className="mt-2 rounded-md border border-line bg-surface/60 p-3.5">
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-semibold text-ink">
                  {invigilator.assigned_count} of {invigilator.max_assignments_per_cycle} assignments
                </p>
                <p className="text-xs font-medium text-ink-muted">
                  {progressWidth(invigilator.assigned_count, invigilator.max_assignments_per_cycle)}% used
                </p>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-300',
                    invigilator.assigned_count >= invigilator.max_assignments_per_cycle
                      ? 'bg-danger'
                      : invigilator.assigned_count >= invigilator.max_assignments_per_cycle * 0.6
                        ? 'bg-warning-deep'
                        : 'bg-success',
                  )}
                  style={{ width: `${progressWidth(invigilator.assigned_count, invigilator.max_assignments_per_cycle)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">Specializations</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {invigilator.specialization_tags.length === 0 ? (
                <p className="text-sm text-ink-muted">No specializations recorded.</p>
              ) : (
                invigilator.specialization_tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))
              )}
            </div>
          </div>

          <div className="mt-5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">Assignment history</p>
            {invigilator.assignment_history.length === 0 ? (
              <p className="mt-2 rounded-md border border-dashed border-line bg-surface/60 px-3.5 py-4 text-center text-sm text-ink-muted">
                No duty history recorded yet.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {invigilator.assignment_history.map((entry) => {
                  const status = ASSIGNMENT_STATUS[entry.status]
                  return (
                    <li
                      key={entry.id}
                      className="flex items-start gap-3 rounded-md border border-line bg-surface/60 px-3.5 py-2.5"
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-black',
                          status.chip === 'no-clash' ? 'bg-success-light text-success' : 'bg-info-light text-info',
                        )}
                        aria-hidden="true"
                      >
                        {entry.course_code.slice(0, 2)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <p className="text-sm font-semibold text-ink">{entry.course_code}</p>
                          <span className="text-xs text-ink-muted">{formatDateLabel(entry.date)}</span>
                          <span className="text-xs text-ink-muted">·</span>
                          <span className="text-xs text-ink-muted">{entry.time_slot_label}</span>
                          <StatusChip status={status.chip} label={status.label} className="ml-auto" />
                        </div>
                        <p className="mt-0.5 truncate text-xs text-ink-muted">
                          {entry.course_title} · {entry.room_name}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line bg-surface/50 p-4">
          <Button variant="secondary" size="sm" onClick={onEdit}>
            <UserPlus className="h-3.5 w-3.5" aria-hidden="true" /> Edit details
          </Button>
          <Button variant="outline" size="sm" onClick={onNotify}>
            <Mail className="h-3.5 w-3.5" aria-hidden="true" /> Notify
          </Button>
          <Button variant="primary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </aside>
    </div>,
    document.body,
  )
}

// ── Add / Edit invigilator modal ───────────────────────────────────────────

interface FormValues {
  name: string
  email: string
  phone: string
  department_id: string
  designation: string
  availability: MockInvigilator['availability']
  max: string
  specialization_tags: string
}

interface FormErrors {
  name?: string
  email?: string
  department_id?: string
  max?: string
}

function AddInvigilatorModal({
  open,
  editing,
  roster,
  onClose,
  onSave,
}: {
  open: boolean
  editing: MockInvigilator | null
  roster: MockInvigilator[]
  onClose: () => void
  onSave: (values: FormValues, editingId: string | null) => void
}) {
  const [values, setValues] = useState<FormValues>({
    name: '',
    email: '',
    phone: '',
    department_id: '',
    designation: DESIGNATION_OPTIONS[0] ?? 'Lecturer',
    availability: 'Available',
    max: '5',
    specialization_tags: '',
  })
  const [errors, setErrors] = useState<FormErrors>({})

  useEffect(() => {
    if (!open) return
    setErrors({})
    setValues(
      editing
        ? {
            name: editing.name,
            email: editing.email,
            phone: editing.phone,
            department_id: editing.department_id,
            designation: editing.designation,
            availability: editing.availability,
            max: String(editing.max_assignments_per_cycle),
            specialization_tags: editing.specialization_tags.join('; '),
          }
        : {
            name: '',
            email: '',
            phone: '',
            department_id: '',
            designation: DESIGNATION_OPTIONS[0] ?? 'Lecturer',
            availability: 'Available',
            max: '5',
            specialization_tags: '',
          },
    )
  }, [open, editing])

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }))

  const validate = (): FormErrors => {
    const next: FormErrors = {}
    if (!values.name.trim()) next.name = 'Name is required'
    const email = values.email.trim().toLowerCase()
    if (!email) next.email = 'Email is required'
    else if (!/^\S+@\S+\.\S+$/.test(email)) next.email = 'Enter a valid email address'
    else if (
      roster.some((i) => i.email.toLowerCase() === email && i.id !== editing?.id)
    ) {
      next.email = 'An invigilator with this email already exists'
    }
    if (!values.department_id) next.department_id = 'Department is required'
    const max = Number.parseInt(values.max, 10)
    if (Number.isNaN(max) || max < 1) next.max = 'Must be a positive number'
    return next
  }

  const submit = () => {
    const next = validate()
    setErrors(next)
    if (Object.keys(next).length > 0) return
    onSave(values, editing?.id ?? null)
  }

  const departmentOptions: SelectOption[] = [
    ...departments.map((d) => ({ value: d.id, label: `${d.name} (${d.code})` })),
  ]
  const designationOptions: SelectOption[] = DESIGNATION_OPTIONS.map((d) => ({ value: d, label: d }))
  const availabilityOptions: SelectOption[] = AVAILABILITY_OPTIONS.map((a) => ({ value: a.value, label: a.label }))

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={editing ? `Edit ${editing.name}` : 'Add invigilator'}
      description={
        editing
          ? 'Update the directory record. Changes are applied to this cycle roster.'
          : 'Add a new faculty member to the invigilation directory.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            {editing ? 'Save changes' : 'Add invigilator'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Full name"
          required
          value={values.name}
          onChange={(e) => set('name', e.target.value)}
          error={errors.name}
        />
        <Input
          label="Email"
          type="email"
          required
          value={values.email}
          onChange={(e) => set('email', e.target.value)}
          error={errors.email}
        />
        <Input
          label="Phone"
          value={values.phone}
          onChange={(e) => set('phone', e.target.value)}
          hint="Optional — used for duty reminders."
        />
        <div className="sm:col-span-2">
          <Select
            label="Department"
            options={departmentOptions}
            value={values.department_id}
            onChange={(v) => set('department_id', v)}
            placeholder="Select a department"
            error={errors.department_id}
          />
        </div>
        <Select
          label="Designation"
          options={designationOptions}
          value={values.designation}
          onChange={(v) => set('designation', v)}
        />
        <Select
          label="Availability"
          options={availabilityOptions}
          value={values.availability}
          onChange={(v) => set('availability', v as MockInvigilator['availability'])}
        />
        <Input
          label="Max assignments per cycle"
          type="number"
          min={1}
          value={values.max}
          onChange={(e) => set('max', e.target.value)}
          error={errors.max}
        />
        <Input
          label="Specializations"
          value={values.specialization_tags}
          onChange={(e) => set('specialization_tags', e.target.value)}
          hint="Separate with commas or semicolons."
        />
      </div>
    </Modal>
  )
}

// ── Bulk import modal (two-phase) ──────────────────────────────────────────

function BulkImportModal({
  open,
  roster,
  onClose,
  onImport,
}: {
  open: boolean
  roster: MockInvigilator[]
  onClose: () => void
  onImport: (rows: ImportRow[]) => void
}) {
  const [stage, setStage] = useState<'upload' | 'review'>('upload')
  const [text, setText] = useState('')
  const [rows, setRows] = useState<ImportRow[]>([])
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    if (!open) return
    setStage('upload')
    setText('')
    setRows([])
    setImporting(false)
  }, [open])

  const handleFile = (file: File | null) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') setText(reader.result)
    }
    reader.readAsText(file)
  }

  const preview = () => {
    setRows(parseImportText(text, roster))
    setStage('review')
  }

  const counts = useMemo(() => {
    const valid = rows.filter((r) => r.errors.length === 0 && !r.duplicate).length
    const duplicates = rows.filter((r) => r.duplicate).length
    const invalid = rows.filter((r) => r.errors.length > 0 && !r.duplicate).length
    return { valid, duplicates, invalid }
  }, [rows])

  const commit = () => {
    const accepted = rows.filter((r) => r.errors.length === 0 && !r.duplicate)
    if (accepted.length === 0) return
    setImporting(true)
    const delay = new Promise((resolve) => setTimeout(resolve, 900))
    void delay.then(() => {
      onImport(accepted)
      setImporting(false)
    })
  }

  const columns: Column<ImportRow>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{row.name || '—'}</p>
          <p className="truncate text-xs text-ink-muted">{row.email || '—'}</p>
        </div>
      ),
    },
    {
      key: 'department',
      header: 'Department',
      render: (row) => (row.department_id ? <Badge variant="outline">{row.department_name}</Badge> : '—'),
    },
    { key: 'max', header: 'Max', align: 'center', render: (row) => row.max_raw || '5' },
    {
      key: 'tags',
      header: 'Specializations',
      className: 'max-w-56',
      render: (row) =>
        row.tags.length > 0 ? <p className="truncate text-xs text-ink-muted">{row.tags.join(', ')}</p> : <span className="text-xs text-ink-muted">—</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const status = importStatus(row)
        return (
          <Badge
            variant={status.variant}
            dot
            title={row.errors.join(' · ')}
            className={cn(row.errors.length > 1 && 'cursor-help')}
          >
            {status.label}
          </Badge>
        )
      },
    },
  ]

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Bulk import invigilators"
      description="Upload or paste a CSV roster, review the preview, then commit valid rows to the directory."
      footer={
        stage === 'upload' ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={preview} disabled={!text.trim()}>
              <FileUp className="h-4 w-4" aria-hidden="true" /> Preview import
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={() => setStage('upload')} disabled={importing}>
              Back
            </Button>
            <Button variant="primary" onClick={commit} disabled={counts.valid === 0 || importing} loading={importing}>
              {importing ? 'Importing…' : `Import ${counts.valid} invigilator${counts.valid === 1 ? '' : 's'}`}
            </Button>
          </>
        )
      }
    >
      {stage === 'upload' ? (
        <div className="space-y-4">
          <div className="rounded-md border border-info/25 bg-info-light px-4 py-3 text-sm text-ink">
            <p className="font-semibold text-info">Expected columns (one invigilator per row)</p>
            <p className="mt-1 font-mono text-xs leading-5 text-ink-muted">
              name, email, department, designation, max_assignments_per_cycle, specialization_tags
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              Department accepts a code, name or id. Specialization tags are separated with <code className="font-mono">;</code> or <code className="font-mono">|</code>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-line bg-card px-3 py-2 text-sm font-semibold text-ink transition-colors hover:border-navy/40 hover:bg-surface">
              <FileUp className="h-4 w-4 text-navy-muted" aria-hidden="true" />
              Choose CSV file
              <input
                type="file"
                accept=".csv,text/csv,text/plain"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setText(SAMPLE_IMPORT)}
              title="Fill the box with a sample roster to try the flow"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" /> Load sample
            </Button>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
            placeholder={'Ayesha Khan, ayesha.khan@airuni.edu.pk, CS, Lecturer, 5, Programming; Databases\nBilal Ahmed, bilal.ahmed@airuni.edu.pk, d-se, Teaching Fellow, 4, Testing'}
            className="w-full resize-y rounded-md border border-line bg-card px-3 py-2 font-mono text-xs leading-5 text-ink outline-none transition-all duration-150 placeholder:text-ink-muted/70 hover:border-navy-muted/60 focus:border-navy focus:ring-2 focus:ring-navy/15"
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="success" dot>{counts.valid} valid</Badge>
            <Badge variant="warning" dot>{counts.duplicates} duplicate</Badge>
            <Badge variant="danger" dot>{counts.invalid} invalid</Badge>
            <p className="ml-auto text-xs font-medium text-ink-muted">
              {rows.length} row{rows.length === 1 ? '' : 's'} parsed
            </p>
          </div>
          {counts.valid === 0 && (
            <div className="flex items-center gap-2 rounded-md border border-danger/25 bg-danger-light px-4 py-3 text-sm text-danger">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              No valid rows — nothing will be imported. Go back and fix the highlighted entries.
            </div>
          )}
          <DataTable<ImportRow>
            columns={columns}
            data={rows}
            getRowKey={(row) => row.key}
            pageSize={8}
            emptyTitle="No rows to preview"
          />
        </div>
      )}
    </Modal>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export function InvigilatorsPage() {
  const [additions, setAdditions] = useState<MockInvigilator[]>(() => readStorage<MockInvigilator[]>(ADDITIONS_KEY, []))
  const [overrides, setOverrides] = useState<Record<string, Partial<MockInvigilator>>>(() =>
    readStorage<Record<string, Partial<MockInvigilator>>>(OVERRIDES_KEY, {}),
  )

  const [query, setQuery] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [availFilter, setAvailFilter] = useState<AvailabilityFilter>('all')
  const [tagFilter, setTagFilter] = useState('')

  const [selected, setSelected] = useState<MockInvigilator | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<MockInvigilator | null>(null)
  const [importOpen, setImportOpen] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(ADDITIONS_KEY, JSON.stringify(additions))
    } catch {
      /* ignore */
    }
  }, [additions])

  useEffect(() => {
    try {
      localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides))
    } catch {
      /* ignore */
    }
  }, [overrides])

  const roster = useMemo<MockInvigilator[]>(() => {
    const merged = [...baseInvigilators, ...additions]
    return merged.map((inv) => (overrides[inv.id] ? { ...inv, ...overrides[inv.id] } : inv))
  }, [additions, overrides])

  const allTags = useMemo(
    () => Array.from(new Set(roster.flatMap((i) => i.specialization_tags))).sort(),
    [roster],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return roster.filter((inv) => {
      if (availFilter !== 'all' && inv.availability !== availFilter) return false
      if (deptFilter && inv.department_id !== deptFilter) return false
      if (tagFilter && !inv.specialization_tags.includes(tagFilter)) return false
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
  }, [roster, query, deptFilter, availFilter, tagFilter])

  const summary = useMemo(() => {
    let available = 0
    let busy = 0
    let onLeave = 0
    let assigned = 0
    let max = 0
    for (const inv of roster) {
      if (inv.availability === 'Available') available++
      else if (inv.availability === 'Busy') busy++
      else onLeave++
      assigned += inv.assigned_count
      max += inv.max_assignments_per_cycle
    }
    return { total: roster.length, available, busy, onLeave, assigned, max, loadPct: max > 0 ? Math.round((assigned / max) * 100) : 0 }
  }, [roster])

  const saveForm = (values: FormValues, editingId: string | null) => {
    const max = Number.parseInt(values.max, 10)
    const tags = values.specialization_tags
      .split(/[;,]/)
      .map((t) => t.trim())
      .filter(Boolean)
    const dept = departments.find((d) => d.id === values.department_id)
    const patch: Partial<MockInvigilator> = {
      name: values.name.trim(),
      email: values.email.trim().toLowerCase(),
      phone: values.phone.trim(),
      department_id: values.department_id,
      department_name: dept?.name ?? '',
      designation: values.designation,
      availability: values.availability,
      max_assignments_per_cycle: Number.isNaN(max) ? 5 : max,
      specialization_tags: tags,
    }

    if (editingId) {
      setOverrides((prev) => ({ ...prev, [editingId]: patch }))
      setSelected((prev) => (prev?.id === editingId ? { ...prev, ...patch } : prev))
      toast({
        variant: 'success',
        title: 'Invigilator updated',
        description: `${patch.name}'s directory record has been saved.`,
      })
    } else {
      const inv: MockInvigilator = {
        id: `inv-x-${Date.now()}`,
        name: patch.name ?? '',
        department_id: patch.department_id ?? '',
        department_name: patch.department_name ?? '',
        availability: patch.availability ?? 'Available',
        assigned_count: 0,
        max_assignments_per_cycle: patch.max_assignments_per_cycle ?? 5,
        designation: patch.designation ?? 'Lecturer',
        email: patch.email ?? '',
        phone: patch.phone ?? '',
        specialization_tags: tags,
        assignment_history: [],
      }
      setAdditions((prev) => [...prev, inv])
      toast({
        variant: 'success',
        title: 'Invigilator added',
        description: `${inv.name} joined the directory with ${tags.length} specialization${tags.length === 1 ? '' : 's'}.`,
      })
    }
    setAddOpen(false)
    setEditing(null)
  }

  const importRows = (rows: ImportRow[]) => {
    const imported: MockInvigilator[] = rows.map((row, k) => ({
      id: `inv-x-${Date.now()}-${k}`,
      name: row.name,
      department_id: row.department_id,
      department_name: row.department_name,
      availability: 'Available',
      assigned_count: 0,
      max_assignments_per_cycle: Number.parseInt(row.max_raw, 10) || 5,
      designation: row.designation,
      email: row.email.toLowerCase(),
      phone: '—',
      specialization_tags: row.tags,
      assignment_history: [],
    }))
    setAdditions((prev) => [...prev, ...imported])
    const skipped = rows.length - imported.length
    toast({
      variant: 'success',
      title: 'Import complete',
      description:
        `${imported.length} invigilator${imported.length === 1 ? '' : 's'} added${skipped > 0 ? ` · ${skipped} skipped` : ''}.`,
    })
    setImportOpen(false)
  }

  const statTiles: Array<{ label: string; value: string; tone: string; sub: string }> = [
    { label: 'Total roster', value: String(summary.total), tone: 'text-ink', sub: 'directory entries' },
    { label: 'Available', value: String(summary.available), tone: 'text-success', sub: 'ready for duty' },
    { label: 'Busy', value: String(summary.busy), tone: 'text-warning-deep', sub: 'already booked' },
    { label: 'On leave', value: String(summary.onLeave), tone: 'text-danger', sub: 'unavailable this cycle' },
    { label: 'Cycle load', value: `${summary.loadPct}%`, tone: 'text-navy', sub: `${summary.assigned} / ${summary.max} duties filled` },
  ]

  const columns: Column<MockInvigilator>[] = [
    {
      key: 'name',
      header: 'Invigilator',
      sortable: true,
      sortValue: (row) => row.name,
      render: (row) => (
        <button
          type="button"
          onClick={() => setSelected(row)}
          className="group flex items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 rounded-md"
        >
          <Avatar name={row.name} size="sm" />
          <span className="min-w-0">
            <span className="block truncate font-semibold text-ink group-hover:text-navy transition-colors">
              {row.name}
            </span>
            <span className="block truncate text-xs text-ink-muted">
              {row.designation} · {row.email}
            </span>
          </span>
        </button>
      ),
    },
    {
      key: 'department',
      header: 'Department',
      sortable: true,
      sortValue: (row) => row.department_name,
      render: (row) => (
        <Badge variant="outline">
          <Building2 className="h-3.5 w-3.5 text-navy-muted" aria-hidden="true" />
          {row.department_name}
        </Badge>
      ),
    },
    {
      key: 'availability',
      header: 'Availability',
      sortable: true,
      sortValue: (row) => row.availability,
      render: (row) => {
        const chip = availabilityChip(row.availability)
        return <StatusChip status={chip.chip} label={chip.label} />
      },
    },
    {
      key: 'assigned_count',
      header: 'Assignments',
      sortable: true,
      sortValue: (row) => row.assigned_count,
      render: (row) => {
        const pct = progressWidth(row.assigned_count, row.max_assignments_per_cycle)
        return (
          <div className="min-w-32">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-ink">
                {row.assigned_count}
                <span className="font-normal text-ink-muted"> / {row.max_assignments_per_cycle}</span>
              </p>
              <p className="text-xs font-medium text-ink-muted">{pct}%</p>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-line">
              <div
                className={cn(
                  'h-full rounded-full',
                  row.assigned_count >= row.max_assignments_per_cycle
                    ? 'bg-danger'
                    : row.assigned_count >= row.max_assignments_per_cycle * 0.6
                      ? 'bg-warning-deep'
                      : 'bg-success',
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )
      },
    },
    {
      key: 'specialization_tags',
      header: 'Specializations',
      render: (row) => {
        const shown = row.specialization_tags.slice(0, 2)
        const rest = row.specialization_tags.length - shown.length
        return (
          <div className="flex flex-wrap items-center gap-1">
            {shown.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setTagFilter(tagFilter === tag ? '' : tag)}
                title={`Filter by ${tag}`}
                className={cn(
                  'rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-colors',
                  tagFilter === tag
                    ? 'border-navy bg-navy text-white'
                    : 'border-line bg-surface text-ink-muted hover:border-navy/40 hover:text-navy',
                )}
              >
                {tag}
              </button>
            ))}
            {rest > 0 && <span className="text-xs text-ink-muted">+{rest}</span>}
          </div>
        )
      },
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <Button variant="secondary" size="sm" onClick={() => setSelected(row)}>
          View profile
        </Button>
      ),
    },
  ]

  const departmentOptions: SelectOption[] = [
    { value: '', label: 'All departments' },
    ...departments.map((d) => ({ value: d.id, label: `${d.name} (${d.code})` })),
  ]
  const tagOptions: SelectOption[] = [
    { value: '', label: 'All specializations' },
    ...allTags.map((t) => ({ value: t, label: t })),
  ]

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-ink">Invigilator Directory</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Browse the faculty duty roster for the current cycle, add members or bulk-import from a CSV.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <FileUp className="h-4 w-4" aria-hidden="true" /> Bulk import
          </Button>
          <Button variant="primary" size="sm" onClick={() => { setEditing(null); setAddOpen(true) }}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Add invigilator
          </Button>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-line bg-card px-5 py-4 shadow-soft">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {statTiles.map((tile) => (
            <div key={tile.label}>
              <p className={cn('text-2xl font-black tracking-tight', tile.tone)}>{tile.value}</p>
              <p className="text-xs font-semibold text-ink">{tile.label}</p>
              <p className="text-[11px] font-medium text-ink-muted">{tile.sub}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-72">
          <Input
            label="Search"
            leading={<Search className="h-4 w-4" aria-hidden="true" />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-64">
          <Select
            options={departmentOptions}
            value={deptFilter}
            onChange={setDeptFilter}
            placeholder="All departments"
            searchable={false}
            clearable
          />
        </div>
        <div className="w-full sm:w-64">
          <Select
            options={tagOptions}
            value={tagFilter}
            onChange={setTagFilter}
            placeholder="All specializations"
            clearable
          />
        </div>

        <div className="flex items-center gap-1 rounded-md border border-line bg-card p-1">
          {(['all', 'Available', 'Busy', 'On leave'] as AvailabilityFilter[]).map((filter) => {
            const active = filter === availFilter
            return (
              <button
                key={filter}
                type="button"
                onClick={() => setAvailFilter(filter)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                  active ? 'bg-navy text-white shadow-soft' : 'text-ink-muted hover:bg-surface hover:text-ink',
                )}
              >
                {filter === 'all' ? 'All' : filter}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-4">
        <DataTable<MockInvigilator>
          columns={columns}
          data={filtered}
          getRowKey={(row) => row.id}
          pageSize={8}
          emptyTitle="No invigilators match"
          emptyDescription="Adjust the search or filters, or add a new invigilator to the directory."
        />
      </div>

      <p className="mt-6 flex items-center gap-1.5 text-xs text-ink-muted">
        <Users className="h-3.5 w-3.5" aria-hidden="true" />
        Directory is mock data for this step, shaped exactly like the Step 2 invigilator schema — the same
        record the Scheduling Engine will query when it assigns duty.
      </p>

      <ProfileDrawer
        invigilator={selected}
        onClose={() => setSelected(null)}
        onEdit={() => {
          setEditing(selected)
          setSelected(null)
          setAddOpen(true)
        }}
        onNotify={() => {
          if (!selected) return
          toast({
            variant: 'info',
            title: 'Notification sent',
            description: `A duty reminder notice was queued for ${selected.name}.`,
          })
        }}
      />

      <AddInvigilatorModal
        open={addOpen}
        editing={editing}
        roster={roster}
        onClose={() => { setAddOpen(false); setEditing(null) }}
        onSave={saveForm}
      />

      <BulkImportModal open={importOpen} roster={roster} onClose={() => setImportOpen(false)} onImport={importRows} />
    </div>
  )
}
