import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { TopBar } from './top-bar'
import { Sidebar } from './sidebar'
import { AnnouncementTicker } from './announcement-ticker'
import { SessionTimeoutModal } from './session-timeout-modal'
import { useAuthStore } from '@/stores/auth-store'
import { useNotificationsStore } from '@/stores/notifications-store'
import { useSessionTimeout } from '@/lib/use-session-timeout'
import { toast } from '@/components/ui/toast-store'

const SIDEBAR_KEY = 'ses.sidebarCollapsed'

/**
 * Keep the bell badge, ticker and Notifications Center live while signed in:
 * refresh the feed on mount, every 30s, and whenever the tab regains focus so
 * events raised in other sessions show up in this one.
 */
function useNotificationsPolling(intervalMs = 30_000) {
  const userId = useAuthStore((s) => s.user?.id)
  const refresh = useNotificationsStore((s) => s.refresh)

  useEffect(() => {
    if (!userId) return
    void refresh()
    const id = window.setInterval(() => void refresh(), intervalMs)
    const onFocus = () => void refresh()
    window.addEventListener('focus', onFocus)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('focus', onFocus)
    }
  }, [userId, refresh, intervalMs])
}

export function AppLayout() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [collapsed])

  useNotificationsPolling()

  const session = useSessionTimeout(() => {
    toast({
      title: 'Signed out',
      description: 'Your session expired due to inactivity.',
      variant: 'info',
    })
    logout()
  })

  if (!user) return <Navigate to="/login" replace />

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-40">
        <TopBar collapsed={collapsed} onToggleSidebar={() => setCollapsed((c) => !c)} />
        <AnnouncementTicker />
      </header>

      <div className="flex">
        <Sidebar collapsed={collapsed} />
        <main className="min-w-0 flex-1 px-5 py-6 sm:px-8">
          <Outlet />
        </main>
      </div>

      <SessionTimeoutModal
        showWarning={session.showWarning}
        remainingMs={session.remainingMs}
        staySignedIn={session.staySignedIn}
        logOutNow={session.logOutNow}
      />
    </div>
  )
}
