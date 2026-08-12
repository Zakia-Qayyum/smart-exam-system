import { DatesheetCalendar } from '@/components/calendar/datesheet-calendar'

export function CalendarPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-ink">Datesheet Calendar</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Term view of every exam session in the cycle — filter by department, program or invigilator,
          drill into a day and publish the final datesheet.
        </p>
      </div>

      <div className="mt-6">
        <DatesheetCalendar />
      </div>
    </div>
  )
}
