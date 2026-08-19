import { useMemo, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { staggerDelay } from '@/lib/motion'
import { EmptyState } from './empty-state'

export interface Column<T> {
  key: string
  header: string
  sortable?: boolean
  sortValue?: (row: T) => string | number
  render?: (row: T) => ReactNode
  className?: string
  align?: 'left' | 'right' | 'center'
}

export interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  getRowKey: (row: T) => string
  pageSize?: number
  className?: string
  emptyTitle?: string
  emptyDescription?: string
}

interface SortState {
  key: string
  dir: 'asc' | 'desc'
}

export function DataTable<T>({
  columns,
  data,
  getRowKey,
  pageSize = 8,
  className,
  emptyTitle = 'No records found',
  emptyDescription,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState | null>(null)
  const [page, setPage] = useState(1)

  const sorted = useMemo(() => {
    if (!sort) return data
    const col = columns.find((c) => c.key === sort.key)
    if (!col) return data
    const accessor = col.sortValue ?? ((row: T) => (row as Record<string, unknown>)[sort.key] as string | number)
    return [...data].sort((a, b) => {
      const av = accessor(a)
      const bv = accessor(b)
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv))
      return sort.dir === 'asc' ? cmp : -cmp
    })
  }, [data, sort, columns])

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const rows = pageSize >= sorted.length
    ? sorted
    : sorted.slice((safePage - 1) * pageSize, safePage * pageSize)

  const toggleSort = (key: string) => {
    setPage(1)
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' }
      if (prev.dir === 'asc') return { key, dir: 'desc' }
      return null
    })
  }

  const alignClass = (align?: Column<T>['align']) =>
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'

  return (
    <div className={cn('overflow-hidden rounded-lg border border-line bg-card shadow-soft', className)}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-surface">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    'sticky top-0 z-10 whitespace-nowrap border-b border-line bg-surface px-4 py-3 text-xs font-bold uppercase tracking-wide text-ink-muted',
                    alignClass(col.align),
                  )}
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className={cn(
                        'inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60',
                        sort?.key === col.key && 'text-navy',
                      )}
                    >
                      {col.header}
                      {sort?.key === col.key ? (
                        sort.dir === 'asc' ? (
                          <ArrowUp className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5" />
                        )
                      ) : (
                        <ChevronsUpDown className="h-3.5 w-3.5 text-ink-muted/60" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={getRowKey(row)}
                className={cn(
                  'border-b border-line transition-colors last:border-b-0 hover:bg-surface/60',
                  i % 2 === 1 && 'bg-surface/30',
                  i < 8 && 'animate-stagger-item',
                )}
                style={i < 8 ? staggerDelay(i, 40) : undefined}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn('px-4 py-3 text-ink', alignClass(col.align), col.className)}
                  >
                    {col.render ? col.render(row) : (row as Record<string, unknown>)[col.key] as ReactNode}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {rows.length === 0 && (
          <EmptyState title={emptyTitle} description={emptyDescription} className="rounded-none border-0" />
        )}
      </div>

      {sorted.length > pageSize && (
        <div className="flex items-center justify-between gap-4 border-t border-line px-4 py-3">
          <p className="text-xs text-ink-muted">
            Showing{' '}
            <span className="font-semibold text-ink">
              {sorted.length === 0 ? 0 : (safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, sorted.length)}
            </span>{' '}
            of <span className="font-semibold text-ink">{sorted.length}</span>
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              aria-label="Previous page"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line text-ink-muted transition-colors hover:bg-surface hover:text-ink disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-10 px-2 text-center text-xs font-semibold text-ink">
              {safePage} / {pageCount}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={safePage >= pageCount}
              aria-label="Next page"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line text-ink-muted transition-colors hover:bg-surface hover:text-ink disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
