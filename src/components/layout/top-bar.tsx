import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Lock, ShieldCheck, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { GlobalSearch } from './global-search'
import { NotificationsDropdown } from './notifications-dropdown'
import { ProfileMenu } from './profile-menu'

function SecureSessionIndicator() {
  const [show, setShow] = useState(false)

  return (
    <div
      className="relative hidden md:block"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      <button
        type="button"
        aria-label="Secure session information"
        className="flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-semibold text-white/70 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
        tabIndex={0}
      >
        <ShieldCheck className="h-4 w-4 text-success" aria-hidden="true" />
        <Lock className="h-3 w-3" aria-hidden="true" />
      </button>
      {show && (
        <div
          role="tooltip"
          className="absolute right-0 top-full z-50 mt-2 w-64 rounded-lg border border-line bg-card p-3 text-left shadow-lift"
        >
          <p className="text-xs font-bold text-ink">Secure Session</p>
          <p className="mt-1 text-[11px] leading-4 text-ink-muted">
            Your connection is encrypted. The access token is stored in memory
            and refreshed automatically. Refresh tokens use httpOnly cookies.
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-success">
            <Lock className="h-3 w-3" aria-hidden="true" />
            <span>Encrypted &middot; Auto-refresh</span>
          </div>
        </div>
      )}
    </div>
  )
}

export function TopBar({
  collapsed,
  onToggleSidebar,
}: {
  collapsed: boolean
  onToggleSidebar: () => void
}) {
  return (
    <div className="bg-navy">
      <div className="flex h-16 items-center gap-3 px-4 text-white sm:px-5">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-5 w-5" aria-hidden="true" />
          ) : (
            <PanelLeftClose className="h-5 w-5" aria-hidden="true" />
          )}
        </button>

        <Link to="/dashboard" className="flex shrink-0 items-center gap-3 focus-visible:outline-none">
          <img src="/favicon.svg" alt="" className="h-9 w-9" />
          <span className="leading-tight">
            <span className="block text-sm font-black tracking-tight">Exam Scheduling System</span>
            <span className="block text-[11px] font-semibold uppercase tracking-widest text-gold">
              Air University
            </span>
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-1">
          <SecureSessionIndicator />
          <GlobalSearch />
          <NotificationsDropdown />
          <ProfileMenu />
        </div>
      </div>
      <div className="h-[2px] bg-gold" aria-hidden="true" />
    </div>
  )
}
