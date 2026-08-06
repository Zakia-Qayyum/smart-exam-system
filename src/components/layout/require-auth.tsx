import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { AccessDenied } from './access-denied'
import { useAuthStore } from '@/stores/auth-store'
import type { Role } from '@/lib/types'

export function RequireAuth({
  allowedRoles,
  children,
}: {
  allowedRoles: Role[]
  children: ReactNode
}) {
  const user = useAuthStore((s) => s.user)
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }
  if (!allowedRoles.includes(user.role)) {
    return <AccessDenied />
  }
  return <>{children}</>
}
