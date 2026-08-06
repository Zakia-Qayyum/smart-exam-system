import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CornerDownLeft, Search } from 'lucide-react'
import { allNavItems, routeAccess, roleLabels } from '@/config/roles'
import { useAuthStore } from '@/stores/auth-store'
import { useDismiss } from '@/lib/use-dismiss'
import { cn } from '@/lib/utils'
import type { NavItem } from '@/lib/types'

export function GlobalSearch() {
  const role = useAuthStore((s) => s.user?.role)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useDismiss(wrapRef, () => setOpen(false))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (e.key === '/' && target?.tagName !== 'INPUT' && target?.tagName !== 'TEXTAREA') {
        e.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const results = useMemo<NavItem[]>(() => {
    if (!role) return []
    const q = query.trim().toLowerCase()
    if (!q) return []
    return allNavItems
      .filter((item) => routeAccess[item.path].includes(role))
      .filter((item) => item.label.toLowerCase().includes(q))
      .slice(0, 8)
  }, [query, role])

  const close = () => {
    setQuery('')
    setOpen(false)
  }

  return (
    <div ref={wrapRef} className="relative hidden md:block">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          setActive(0)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((a) => Math.min(a + 1, results.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((a) => Math.max(a - 1, 0))
          } else if (e.key === 'Enter' && results[active]) {
            close()
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
        placeholder="Search…"
        className="h-9 w-56 rounded-md border border-white/15 bg-white/10 pl-9 pr-9 text-sm text-white placeholder:text-white/45 focus:border-gold/60 focus:bg-white/15 focus:outline-none focus:ring-2 focus:ring-gold/40"
      />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-white/20 px-1.5 py-0.5 text-[10px] font-bold text-white/50">
        /
      </kbd>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 overflow-hidden rounded-lg border border-line bg-card shadow-lift">
          {query.trim() === '' ? (
            <div className="px-4 py-6 text-center text-sm text-ink-muted">
              Type to search across the app.
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-ink-muted">
              No matching pages for “{query}”.
            </div>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {results.map((item, i) => {
                const Icon = item.icon
                const roles = routeAccess[item.path]
                  .filter((r) => r !== 'admin')
                  .map((r) => roleLabels[r])
                  .slice(0, 3)
                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      onMouseDown={close}
                      onMouseEnter={() => setActive(i)}
                      className={cn(
                        'flex items-center gap-3 px-4 py-2.5 transition-colors',
                        i === active ? 'bg-surface' : 'bg-card',
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-navy" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink">
                          {item.label}
                        </span>
                        <span className="block text-xs text-ink-muted">{roles.join(', ')}</span>
                      </span>
                      <CornerDownLeft
                        className="h-3.5 w-3.5 shrink-0 text-ink-muted/50"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
