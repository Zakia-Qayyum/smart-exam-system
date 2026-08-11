import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}`
}

export interface CalendarPickerProps {
  value?: string
  onChange: (iso: string) => void
  min?: string
  max?: string
  className?: string
}

export function CalendarPicker({ value, onChange, min, max, className }: CalendarPickerProps) {
  const minDate = min ? new Date(`${min}T00:00:00`) : undefined
  const maxDate = max ? new Date(`${max}T00:00:00`) : undefined
  const [view, setView] = useState(() => {
    const base = value ? new Date(`${value}T00:00:00`) : minDate ?? maxDate ?? new Date()
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })

  const cells = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1)
    const lead = first.getDay()
    const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate()
    const cellsArr: Array<string | null> = []
    for (let i = 0; i < lead; i++) cellsArr.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      cellsArr.push(toISODate(new Date(view.getFullYear(), view.getMonth(), d)))
    }
    return cellsArr
  }, [view])

  const canPrev = !minDate || monthKey(view) > monthKey(minDate)
  const canNext = !maxDate || monthKey(view) < monthKey(maxDate)

  const isSelectable = (iso: string): boolean => {
    if (minDate && iso < toISODate(minDate)) return false
    if (maxDate && iso > toISODate(maxDate)) return false
    return true
  }

  return (
    <div className={cn('rounded-lg border border-line bg-card p-3', className)}>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
          disabled={!canPrev}
          aria-label="Previous month"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line text-ink-muted transition-colors hover:bg-surface hover:text-ink disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-bold text-ink">
          {view.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </p>
        <button
          type="button"
          onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
          disabled={!canNext}
          aria-label="Next month"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line text-ink-muted transition-colors hover:bg-surface hover:text-ink disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w) => (
          <span key={w} className="py-1 text-[11px] font-bold uppercase tracking-wide text-ink-muted">
            {w}
          </span>
        ))}
        {cells.map((iso, i) => {
          if (!iso) return <span key={`blank-${i}`} />
          const selectable = isSelectable(iso)
          const selected = iso === value
          return (
            <button
              key={iso}
              type="button"
              disabled={!selectable}
              onClick={() => onChange(iso)}
              className={cn(
                'mx-auto flex h-9 w-9 items-center justify-center rounded-md text-sm font-semibold transition-colors',
                selectable
                  ? 'text-ink hover:bg-surface'
                  : 'text-ink-muted/40 line-through',
                selected && 'bg-navy text-white hover:bg-navy',
              )}
            >
              {Number(iso.slice(8))}
            </button>
          )
        })}
      </div>
    </div>
  )
}
