import { useState, type ReactNode } from 'react'
import {
  ArrowRight,
  Bell,
  CalendarDays,
  CheckCircle2,
  FileCheck2,
  GraduationCap,
  LogOut,
  UserPlus,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/components/ui/toast-store'
import { Toaster } from '@/components/ui/toaster'
import { DataTable, type Column } from '@/components/ui/data-table'
import { StatusChip } from '@/components/ui/status-chip'
import { Tabs } from '@/components/ui/tabs'
import { Avatar } from '@/components/ui/avatar'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton, SkeletonText } from '@/components/ui/skeleton'

interface ExamRow {
  id: string
  course: string
  date: string
  room: string
  invigilators: number
  status: 'clash' | 'no-clash' | 'pending' | 'published'
}

const examData: ExamRow[] = [
  { id: 'EX-101', course: 'Data Structures', date: '2026-08-10', room: 'CS-201', invigilators: 3, status: 'no-clash' },
  { id: 'EX-102', course: 'Database Systems', date: '2026-08-10', room: 'CS-203', invigilators: 2, status: 'pending' },
  { id: 'EX-103', course: 'Operating Systems', date: '2026-08-11', room: 'EE-105', invigilators: 4, status: 'published' },
  { id: 'EX-104', course: 'Linear Algebra', date: '2026-08-11', room: 'MA-104', invigilators: 2, status: 'clash' },
  { id: 'EX-105', course: 'Computer Networks', date: '2026-08-12', room: 'CS-302', invigilators: 3, status: 'no-clash' },
  { id: 'EX-106', course: 'Software Engineering', date: '2026-08-12', room: 'CS-208', invigilators: 2, status: 'published' },
  { id: 'EX-107', course: 'Theory of Computation', date: '2026-08-13', room: 'MA-201', invigilators: 3, status: 'pending' },
  { id: 'EX-108', course: 'Artificial Intelligence', date: '2026-08-13', room: 'CS-301', invigilators: 4, status: 'no-clash' },
  { id: 'EX-109', course: 'Compilers', date: '2026-08-14', room: 'CS-205', invigilators: 2, status: 'clash' },
  { id: 'EX-110', course: 'Distributed Systems', date: '2026-08-14', room: 'CS-307', invigilators: 3, status: 'published' },
]

const examColumns: Column<ExamRow>[] = [
  { key: 'id', header: 'Exam ID', sortable: true },
  { key: 'course', header: 'Course', sortable: true },
  { key: 'date', header: 'Date', sortable: true, sortValue: (r) => r.date },
  { key: 'room', header: 'Room', sortable: true },
  { key: 'invigilators', header: 'Invigilators', sortable: true, align: 'right' },
  {
    key: 'status',
    header: 'Status',
    sortable: true,
    align: 'center',
    render: (r) => <StatusChip status={r.status} label={r.status} />,
  },
]

const departments = [
  { value: 'cs', label: 'Computer Science' },
  { value: 'ee', label: 'Electrical Engineering' },
  { value: 'ma', label: 'Mathematics' },
  { value: 'ba', label: 'Business Administration' },
]

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="flex items-center gap-3 border-b border-line pb-3 text-xl font-black uppercase tracking-wide text-navy">
      {children}
    </h2>
  )
}

export function ComponentsShowcase() {
  const [modalOpen, setModalOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [department, setDepartment] = useState('cs')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const demoToast = (variant: 'success' | 'danger' | 'warning' | 'info') => {
    const messages: Record<string, { title: string; description?: string }> = {
      success: { title: 'Exam schedule published', description: 'All invigilators have been notified.' },
      danger: { title: 'Timing clash detected', description: 'EX-104 overlaps with EX-105 in MA-104.' },
      warning: { title: 'Invigilator unavailable', description: 'Dr. Ahmed is on leave for the selected date.' },
      info: { title: 'New revision available', description: 'The timetable was updated just now.' },
    }
    toast({ variant, ...messages[variant] })
  }

  const handleSave = () => {
    setSaveLoading(true)
    setTimeout(() => {
      setSaveLoading(false)
      setModalOpen(false)
      toast({ variant: 'success', title: 'Exam saved', description: 'The new exam entry was added to the schedule.' })
    }, 1400)
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <Toaster />

      <header className="mb-10 border-b border-line pb-6">
        <p className="text-sm font-semibold uppercase tracking-widest text-gold-dark">Air University</p>
        <h1 className="mt-1 text-4xl font-black text-navy">
          Component Library
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">
          Design system primitives for the Smart Exam Scheduling &amp; Invigilation Management System.
          Navy <code className="rounded bg-navy px-1.5 py-0.5 font-mono text-[11px] text-gold">#0B2447</code>, gold{' '}
          <code className="rounded bg-navy px-1.5 py-0.5 font-mono text-[11px] text-gold">#C9A227</code>, radius scale
          6 / 10 / 16px, Inter typography.
        </p>
      </header>

      {/* ── Buttons ─────────────────────────────────────────────── */}
      <section className="mb-12 space-y-4">
        <SectionTitle>Button</SectionTitle>
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="gold">Gold</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
          <Button loading>Loading…</Button>
          <Button variant="danger" size="icon" aria-label="Delete">
            <LogOut className="h-4 w-4" />
          </Button>
          <Button disabled>Disabled</Button>
        </div>
      </section>

      {/* ── Badges / Status chips ───────────────────────────────── */}
      <section className="mb-12 space-y-4">
        <SectionTitle>Badge &amp; Status Chip</SectionTitle>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="default">Neutral</Badge>
          <Badge variant="success">No clash</Badge>
          <Badge variant="danger">Clash</Badge>
          <Badge variant="warning">Pending</Badge>
          <Badge variant="info">Info</Badge>
          <Badge variant="published">Published</Badge>
          <Badge variant="gold">Gold</Badge>
          <Badge variant="outline" dot>
            Draft
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <StatusChip status="no-clash" label="No clash" />
          <StatusChip status="clash" label="Clash" />
          <StatusChip status="pending" label="Pending" />
          <StatusChip status="published" label="Published" />
          <StatusChip status="info" label="Info" />
          <StatusChip status="draft" label="Draft" />
        </div>
      </section>

      {/* ── Inputs ──────────────────────────────────────────────── */}
      <section className="mb-12 space-y-4">
        <SectionTitle>Input (floating label)</SectionTitle>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-6">
            <Input
              label="Email address"
              type="email"
              leading={<Users className="h-4 w-4" />}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder=" "
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error="Password must be at least 8 characters."
            />
          </div>
          <div className="space-y-6">
            <Input label="Full name" hint="As it appears on your university ID." required />
            <Select
              label="Department"
              options={departments}
              value={department}
              onChange={setDepartment}
              placeholder="Choose a department"
            />
          </div>
        </div>
      </section>

      {/* ── Cards ───────────────────────────────────────────────── */}
      <section className="mb-12 space-y-4">
        <SectionTitle>Card</SectionTitle>
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Total Exams</CardTitle>
              <CardDescription>Scheduled this semester</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-black text-navy">45</p>
            </CardContent>
          </Card>

          <Card interactive className="cursor-pointer">
            <CardHeader>
              <CardTitle>Invigilators</CardTitle>
              <CardDescription>Available faculty</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <p className="text-4xl font-black text-navy">120</p>
              <Avatar name="Air University" size="lg" />
            </CardContent>
          </Card>

          <Card className="border-gold/40">
            <CardHeader>
              <CardTitle>Today&apos;s Exams</CardTitle>
              <CardDescription>In progress now</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-black text-gold-dark">12</p>
            </CardContent>
            <CardFooter>
              <Button variant="secondary" size="sm">
                View timetable <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </CardFooter>
          </Card>
        </div>
      </section>

      {/* ── Modal + Confirm ─────────────────────────────────────── */}
      <section className="mb-12 space-y-4">
        <SectionTitle>Modal &amp; Confirm Dialog</SectionTitle>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => setModalOpen(true)}>
            Open modal <Bell className="h-4 w-4" />
          </Button>
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>
            <UserPlus className="h-4 w-4" /> Confirm destructive
          </Button>
        </div>

        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Create exam entry"
          description="Fill in the details to add a new exam to the schedule."
          size="md"
          footer={
            <>
              <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saveLoading}>
                Cancel
              </Button>
              <Button onClick={handleSave} loading={saveLoading}>
                Save exam
              </Button>
            </>
          }
        >
          <div className="space-y-5">
            <Input label="Course code" placeholder=" " required />
            <Input label="Room / Hall" placeholder=" " />
            <Select
              label="Exam type"
              options={[
                { value: 'mid', label: 'Midterm' },
                { value: 'final', label: 'Final' },
                { value: 'quiz', label: 'Quiz' },
              ]}
              placeholder="Select exam type"
            />
          </div>
        </Modal>

        <ConfirmDialog
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onConfirm={() => {
            setConfirmOpen(false)
            toast({ variant: 'danger', title: 'Schedule deleted', description: 'The exam entry was permanently removed.' })
          }}
          title="Delete exam schedule?"
          description="This will permanently remove EX-104 and its assigned invigilators. This action cannot be undone."
          confirmLabel="Delete schedule"
        />
      </section>

      {/* ── Toast ───────────────────────────────────────────────── */}
      <section className="mb-12 space-y-4">
        <SectionTitle>Toast</SectionTitle>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={() => demoToast('success')}>
            <CheckCircle2 className="h-4 w-4 text-success" /> Success
          </Button>
          <Button variant="secondary" onClick={() => demoToast('danger')}>
            <Bell className="h-4 w-4 text-danger" /> Danger
          </Button>
          <Button variant="secondary" onClick={() => demoToast('warning')}>
            <Bell className="h-4 w-4 text-warning-deep" /> Warning
          </Button>
          <Button variant="secondary" onClick={() => demoToast('info')}>
            <Bell className="h-4 w-4 text-info" /> Info
          </Button>
        </div>
      </section>

      {/* ── DataTable ───────────────────────────────────────────── */}
      <section className="mb-12 space-y-4">
        <SectionTitle>DataTable</SectionTitle>
        <DataTable
          columns={examColumns}
          data={examData}
          getRowKey={(r) => r.id}
          pageSize={5}
        />
      </section>

      {/* ── Tabs ────────────────────────────────────────────────── */}
      <section className="mb-12 space-y-4">
        <SectionTitle>Tabs</SectionTitle>
        <Tabs
          defaultValue="scheduled"
          tabs={[
            {
              value: 'scheduled',
              label: 'Scheduled',
              content: (
                <div className="flex items-center gap-3 text-sm text-ink-muted">
                  <CalendarDays className="h-5 w-5 text-navy" />
                  45 exams are scheduled for the current semester.
                </div>
              ),
            },
            {
              value: 'invigilators',
              label: 'Invigilators',
              content: (
                <div className="flex items-center gap-3 text-sm text-ink-muted">
                  <Users className="h-5 w-5 text-navy" />
                  120 faculty members are available for invigilation duty.
                </div>
              ),
            },
            {
              value: 'reports',
              label: 'Reports',
              content: (
                <div className="flex items-center gap-3 text-sm text-ink-muted">
                  <FileCheck2 className="h-5 w-5 text-navy" />
                  Generate and export exam reports for the registrar.
                </div>
              ),
            },
          ]}
        />
      </section>

      {/* ── Avatar / EmptyState / Skeleton ──────────────────────── */}
      <section className="mb-12 space-y-4">
        <SectionTitle>Avatar, Empty State &amp; Skeleton</SectionTitle>
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name="Zakia Qayyum" size="lg" />
          <Avatar name="Ahmed Raza" />
          <Avatar name="Sana Malik" size="sm" />
          <Avatar name="Faculty Member" size="lg" />
          <div className="flex items-center gap-3 rounded-md border border-line bg-card px-4 py-2 text-sm text-ink-muted">
            <GraduationCap className="h-4 w-4 text-gold-dark" />
            Department of Computer Science
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <EmptyState
            icon={<GraduationCap className="h-7 w-7" />}
            title="No invigilators assigned"
            description="Assign faculty members to this exam before publishing the timetable."
            action={<Button size="sm">Assign invigilators</Button>}
          />
          <Card>
            <CardHeader>
              <CardTitle>Loading timetable…</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <SkeletonText lines={3} />
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-1/2" />
                  <Skeleton className="h-3.5 w-1/3" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <footer className="border-t border-line pt-6 text-xs text-ink-muted">
        Smart Exam Scheduling &amp; Invigilation Management System · Air University · NCSA Internship Project
      </footer>
    </div>
  )
}
