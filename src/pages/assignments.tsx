import { AssignmentBoard } from '@/components/assignments/assignment-board'

export function AssignmentsPage() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-ink">Invigilator Assignment Board</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Plan invigilation duties per exam day — drag invigilators onto Slot × Room cells or click to
          assign, then auto-assign the rest with the mock matcher and review before confirming.
        </p>
      </div>
      <div className="mt-6">
        <AssignmentBoard />
      </div>
    </div>
  )
}
