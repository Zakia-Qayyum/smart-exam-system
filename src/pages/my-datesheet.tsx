import { useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  CheckCircle2,
  Download,
  GraduationCap,
  MapPin,
  Printer,
  Siren,
  User,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatusChip } from '@/components/ui/status-chip'
import { EmptyState } from '@/components/ui/empty-state'
import { toast } from '@/components/ui/toast-store'
import { mockStudentExams, mockStudentProfile } from '@/config/mock-data'
import { cn } from '@/lib/utils'
import type { MockStudentExam } from '@/lib/types'
import { useAuthStore } from '@/stores/auth-store'

const DAY_COLORS: Record<string, string> = {
  Monday: 'bg-info-light text-info',
  Tuesday: 'bg-gold/15 text-gold-dark',
  Wednesday: 'bg-success-light text-success',
  Thursday: 'bg-purple-light text-purple',
  Friday: 'bg-danger-light text-danger',
}

const TIME_TONE: Record<string, string> = {
  Morning: 'border-l-navy',
  Afternoon: 'border-l-gold-dark',
}

export function MyDatesheetPage() {
  const user = useAuthStore((s) => s.user)
  const [mounted, setMounted] = useState(false)

  const profile = useMemo(() => mockStudentProfile(), [])
  const exams = useMemo(() => mockStudentExams(), [])

  // Success animation on first load
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60)
    return () => clearTimeout(t)
  }, [])

  const hasClash = exams.some((e) => e.status === 'needs_review')
  const handlePrintRollSlip = () => {
    window.print()
  }

  const handleDownloadRollSlip = () => {
    toast({ variant: 'info', title: 'Roll No Slip', description: 'PDF roll no slip generation will be available in a future step.' })
  }

  if (!user) return null

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-ink">My Exam Schedule</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Fall-2026 Final Examinations · {exams.length} paper{exams.length === 1 ? '' : 's'} scheduled
        </p>
      </div>

      {/* ── Unresolved clash banner ───────────────────────────────────── */}
      {hasClash && (
        <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning-light px-4 py-3">
          <Siren className="mt-0.5 h-5 w-5 shrink-0 text-warning-deep" aria-hidden="true" />
          <div>
            <p className="text-sm font-bold text-warning-deep">Schedule under review</p>
            <p className="mt-0.5 text-xs text-warning-deep/80">
              One or more of your papers is being reviewed by the Exam Office for a potential scheduling conflict.
              Your final schedule will be updated once the review is complete — no action is needed from you.
            </p>
          </div>
        </div>
      )}

      {/* ── No-clash confirmed banner (shown after mount animation) ───── */}
      {!hasClash && (
        <div
          className={cn(
            'flex items-start gap-3 rounded-lg border border-success/30 bg-success-light px-4 py-3 transition-all duration-500',
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1',
          )}
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
          <div>
            <p className="text-sm font-bold text-success">No clash — confirmed ✓</p>
            <p className="mt-0.5 text-xs text-success/80">
              Your exam schedule has no conflicts. All {exams.length} papers are confirmed and ready.
            </p>
          </div>
        </div>
      )}

      {/* ── Student profile card (for roll no slip) ───────────────────── */}
      <Card className="print:border-0 print:shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-navy" aria-hidden="true" />
            Roll No Slip
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-6">
            {/* Photo placeholder */}
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-line bg-surface">
              <User className="h-8 w-8 text-ink-muted/40" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-black text-ink">{profile.name}</h3>
              <p className="text-sm text-ink-muted">{profile.regId} · {profile.program}</p>
              <p className="text-sm text-ink-muted">{profile.department}</p>
            </div>
            <div className="flex items-center gap-2 print:hidden">
              <Button variant="secondary" size="sm" onClick={handlePrintRollSlip}>
                <Printer className="h-4 w-4" aria-hidden="true" />
                Print
              </Button>
              <Button variant="secondary" size="sm" onClick={handleDownloadRollSlip}>
                <Download className="h-4 w-4" aria-hidden="true" />
                Download PDF
              </Button>
            </div>
          </div>

          {/* Roll no slip table */}
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-surface">
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-ink-muted">Date</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-ink-muted">Day</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-ink-muted">Time</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-ink-muted">Course</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-ink-muted">Room</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-ink-muted">Seat No</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-ink-muted">Roll No</th>
                </tr>
              </thead>
              <tbody>
                {exams.map((ex) => (
                  <tr key={ex.id} className="border-b border-line/50 last:border-b-0">
                    <td className="px-4 py-2.5 font-medium text-ink">{ex.date}</td>
                    <td className="px-4 py-2.5">{ex.day}</td>
                    <td className="px-4 py-2.5">{ex.startTime} – {ex.endTime}</td>
                    <td className="px-4 py-2.5 font-bold text-navy">{ex.courseCode}</td>
                    <td className="px-4 py-2.5">{ex.room}</td>
                    <td className="px-4 py-2.5 text-center font-mono text-sm">{ex.seatNo}</td>
                    <td className="px-4 py-2.5 font-mono text-sm">{ex.rollNo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Timeline / Card list ──────────────────────────────────────── */}
      <div>
        <h2 className="mb-4 text-lg font-black tracking-tight text-ink">Exam Timeline</h2>
        {exams.length === 0 ? (
          <Card>
            <CardContent className="p-4">
              <EmptyState
                icon={<CalendarDays className="h-7 w-7" aria-hidden="true" />}
                title="No exams scheduled"
                description="Your exam schedule for this cycle has not been published yet."
              />
            </CardContent>
          </Card>
        ) : (
          <div className="relative space-y-0">
            {/* Timeline connector line */}
            <div className="absolute left-[19px] top-0 bottom-0 w-0.5 bg-line" aria-hidden="true" />

            {exams.map((ex, i) => (
              <ExamCard key={ex.id} exam={ex} index={i} mounted={mounted} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ExamCard({ exam, index, mounted }: { exam: MockStudentExam; index: number; mounted: boolean }) {
  const isConfirmed = exam.status === 'confirmed'
  const dayColor = DAY_COLORS[exam.day] ?? 'bg-surface text-ink-muted'
  const borderTone = TIME_TONE[exam.timeSlot] ?? 'border-l-line'

  return (
    <div
      className={cn(
        'relative flex gap-4 py-3 transition-all duration-400',
        mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
      )}
      style={{ transitionDelay: `${80 + index * 70}ms` }}
    >
      {/* Timeline dot */}
      <div
        className={cn(
          'relative z-10 mt-4 flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border-2',
          isConfirmed
            ? 'border-success bg-success-light'
            : 'border-warning bg-warning-light',
        )}
      >
        {isConfirmed ? (
          <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
        ) : (
          <Siren className="h-4 w-4 text-warning-deep" aria-hidden="true" />
        )}
      </div>

      {/* Card */}
      <Card className={cn('min-w-0 flex-1 border-l-4', borderTone)}>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-black text-navy">{exam.courseCode}</span>
                <Badge variant="outline" className={dayColor}>{exam.day}</Badge>
                {isConfirmed ? (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border border-success/25 bg-success-light px-2 py-0.5 text-[11px] font-bold text-success transition-all duration-500',
                      mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-90',
                    )}
                    style={{ transitionDelay: `${200 + index * 70}ms` }}
                  >
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                    Confirmed
                  </span>
                ) : (
                  <StatusChip status="pending" label="Under review" />
                )}
              </div>
              <p className="mt-1 text-sm text-ink-muted">{exam.courseTitle}</p>
            </div>
            <div className="text-right text-sm">
              <p className="font-bold text-ink">{exam.date}</p>
              <p className="text-ink-muted">{exam.startTime} – {exam.endTime}</p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-line/60 pt-3 text-xs text-ink-muted">
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              {exam.room}
            </span>
            <span className="font-mono">Seat #{exam.seatNo}</span>
            <span className="font-mono">{exam.rollNo}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
