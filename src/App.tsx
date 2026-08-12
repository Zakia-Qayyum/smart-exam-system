import type { ComponentType } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { AppLayout } from '@/components/layout/app-layout'
import { RequireAuth } from '@/components/layout/require-auth'
import { ModulePlaceholder } from '@/components/layout/module-placeholder'
import { homeByRole, PROTECTED_PATHS, routeAccess } from '@/config/roles'
import { useAuthStore } from '@/stores/auth-store'
import { LoginPage } from '@/pages/login'
import { MfaPage } from '@/pages/mfa'
import { ForcedPasswordChangePage } from '@/pages/force-password-change'
import { ForgotPasswordPage } from '@/pages/forgot-password'
import { LockedPage } from '@/pages/locked'
import { DashboardPage } from '@/pages/dashboard'
import { NotificationsPage } from '@/pages/notifications'
import { SchedulingPage } from '@/pages/scheduling'
import { CalendarPage } from '@/pages/calendar'
import { ComponentsShowcase } from '@/pages/components-showcase'

const dedicatedPages: Record<string, ComponentType> = {
  '/dashboard': DashboardPage,
  '/notifications': NotificationsPage,
  '/scheduling': SchedulingPage,
  '/calendar': CalendarPage,
}

function HomeRedirect() {
  const user = useAuthStore((s) => s.user)
  return <Navigate to={user ? homeByRole[user.role] : '/login'} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/mfa" element={<MfaPage />} />
        <Route path="/force-password-change" element={<ForcedPasswordChangePage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/locked" element={<LockedPage />} />
        <Route path="/components" element={<ComponentsShowcase />} />

        <Route element={<AppLayout />}>
          {PROTECTED_PATHS.map((path) => {
            const Page = dedicatedPages[path] ?? ModulePlaceholder
            return (
              <Route
                key={path}
                path={path}
                element={
                  <RequireAuth allowedRoles={routeAccess[path]}>
                    <Page />
                  </RequireAuth>
                }
              />
            )
          })}
        </Route>

        <Route path="/" element={<HomeRedirect />} />
        <Route path="*" element={<HomeRedirect />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  )
}
