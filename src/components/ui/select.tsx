import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { Check, ChevronsUpDown, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps {
  options: SelectOption[]
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  label?: string
  searchable?: boolean
  clearable?: boolean
  disabled?: boolean
  error?: string
  className?: string
}

export function Select({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  label,
  searchable = true,
  clearable = false,
  disabled = false,
  error,
  className,
}: SelectProps) {
  const autoId = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlighted, setHighlighted] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const selected = options.find((o) => o.value === value)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, query])

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    if (open) {
      setHighlighted(filtered.findIndex((o) => o.value === value))
    }
  }, [open, filtered, value])

  useEffect(() => {
    if (open && listRef.current && highlighted >= 0) {
      listRef.current.children[highlighted]?.scrollIntoView({ block: 'nearest' })
    }
  }, [highlighted, open])

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) setOpen(true)
      else setHighlighted((h) => (h + 1) % Math.max(filtered.length, 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted((h) => (h - 1 + filtered.length) % Math.max(filtered.length, 1))
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (open && filtered[highlighted]) {
        onChange?.(filtered[highlighted].value)
        setOpen(false)
        setQuery('')
      } else {
        setOpen(true)
      }
    }
  }

  return (
    <div className={cn('w-full', className)}>
      {label && (
        <label
          id={`${autoId}-label`}
          className="mb-1.5 block text-sm font-medium text-ink"
        >
          {label}
        </label>
      )}

      <div ref={rootRef} className="relative" onKeyDown={handleKeyDown}>
        <button
          type="button"
          id={`${autoId}-button`}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-labelledby={label ? `${autoId}-label` : undefined}
          disabled={disabled}
          onClick={() => {
            setOpen((o) => !o)
            setQuery('')
          }}
          className={cn(
            'flex h-12 w-full items-center justify-between gap-2 rounded-md border bg-card px-3 text-left text-sm transition-all duration-150',
            'hover:border-navy-muted/60',
            'focus:outline-none focus:ring-2 focus:ring-navy/15',
            open ? 'border-navy ring-2 ring-navy/15' : 'border-line',
            error && 'border-danger',
            disabled && 'pointer-events-none opacity-50',
          )}
        >
          <span className={cn('truncate', !selected && 'text-ink-muted')}>
            {selected ? selected.label : placeholder}
          </span>

          {clearable && selected ? (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Clear selection"
              onClick={(e) => {
                e.stopPropagation()
                onChange?.('')
              }}
              className="text-ink-muted transition-colors hover:text-danger"
            >
              <X className="h-4 w-4" />
            </span>
          ) : (
            <ChevronsUpDown
              className={cn('h-4 w-4 shrink-0 text-ink-muted transition-transform', open && 'rotate-180')}
            />
          )}
        </button>

        {open && (
          <div className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-md border border-line bg-card shadow-lift">
            {searchable && (
              <div className="flex items-center gap-2 border-b border-line px-3">
                <Search className="h-4 w-4 shrink-0 text-ink-muted" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setHighlighted(0)
                  }}
                  placeholder="Search…"
                  className="h-10 w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
                />
              </div>
            )}

            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-ink-muted">
                No matching options
              </p>
            ) : (
              <ul
                role="listbox"
                ref={listRef}
                className="max-h-56 overflow-auto p-1"
              >
                {filtered.map((option, index) => {
                  const isSelected = option.value === value
                  const isHighlighted = index === highlighted
                  return (
                    <li
                      key={option.value}
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setHighlighted(index)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        onChange?.(option.value)
                        setOpen(false)
                        setQuery('')
                      }}
                      className={cn(
                        'flex cursor-pointer items-center justify-between rounded-sm px-3 py-2 text-sm transition-colors',
                        isHighlighted && 'bg-surface',
                        isSelected && 'font-semibold text-navy',
                      )}
                    >
                      {option.label}
                      {isSelected && <Check className="h-4 w-4 text-navy" />}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
    </div>
  )
}
