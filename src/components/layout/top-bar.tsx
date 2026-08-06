import { Link } from 'react-router-dom'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { GlobalSearch } from './global-search'
import { NotificationsDropdown } from './notifications-dropdown'
import { ProfileMenu } from './profile-menu'

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
          <GlobalSearch />
          <NotificationsDropdown />
          <ProfileMenu />
        </div>
      </div>
      <div className="h-[2px] bg-gold" aria-hidden="true" />
    </div>
  )
}
