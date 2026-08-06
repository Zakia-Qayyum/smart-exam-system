import { NavLink } from 'react-router-dom'
import { navByRole, roleLabels } from '@/config/roles'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  const role = useAuthStore((s) => s.user?.role)
  if (!role) return null

  const items = navByRole[role]

  return (
    <aside
      className={cn(
        'sticky top-[102px] z-30 flex h-[calc(100vh-102px)] shrink-0 flex-col border-r border-navy-light/40 bg-navy-deep transition-[width] duration-200',
        collapsed ? 'w-[72px]' : 'w-64',
      )}
    >
      <div className={cn('px-4 pt-5 pb-3', collapsed && 'px-0 text-center')}>
        <p
          className={cn(
            'text-[11px] font-black uppercase tracking-widest text-gold',
            collapsed && 'sr-only',
          )}
        >
          Menu
        </p>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.path}
              to={item.path}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                cn(
                  'group relative flex items-center gap-3 rounded-md text-sm font-semibold transition-colors',
                  isActive ? 'bg-navy-light text-white' : 'text-navy-muted hover:bg-navy-light/60 hover:text-white',
                  collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r bg-gold" />
                  )}
                  <Icon
                    className={cn('h-[18px] w-[18px] shrink-0', isActive ? 'text-gold' : 'text-navy-muted group-hover:text-white')}
                    aria-hidden="true"
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      <div className={cn('border-t border-navy-light/40 p-4', collapsed && 'flex justify-center p-2')}>
        {collapsed ? (
          <Badge variant="gold" className="max-w-full truncate" title={roleLabels[role]}>
            {roleLabels[role]
              .split(' ')
              .map((w) => w[0])
              .join('')
              .slice(0, 3)}
          </Badge>
        ) : (
          <div className="flex items-center gap-2">
            <Badge variant="gold">AU</Badge>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-white">{roleLabels[role]}</p>
              <p className="text-[11px] text-navy-muted">Smart Exam System</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
