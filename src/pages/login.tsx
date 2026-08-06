import { Navigate, useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { homeByRole, ROLES, roleDescriptions, roleLabels, roleTileIcon } from '@/config/roles'
import { useAuthStore } from '@/stores/auth-store'
import { Badge } from '@/components/ui/badge'

export function LoginPage() {
  const user = useAuthStore((s) => s.user)
  const login = useAuthStore((s) => s.login)
  const navigate = useNavigate()

  if (user) return <Navigate to={homeByRole[user.role]} replace />

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-navy-deep px-6 py-12">
      <div className="flex items-center gap-3">
        <img src="/favicon.svg" alt="" className="h-11 w-11" />
        <div className="leading-tight">
          <div className="text-lg font-black tracking-tight text-white">
            Exam Scheduling System
          </div>
          <div className="text-[11px] font-semibold uppercase tracking-widest text-gold">
            Air University
          </div>
        </div>
      </div>

      <div className="mt-8 w-full max-w-4xl rounded-lg border border-navy-light/50 bg-card p-6 shadow-lift sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-black tracking-tight text-ink">Select your role</h1>
            <p className="mt-1 text-sm text-ink-muted">
              Demo mock authentication — pick a role to preview its app shell. No backend call is
              made.
            </p>
          </div>
          <Badge variant="gold">Demo</Badge>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ROLES.map((role) => {
            const Icon = roleTileIcon[role]
            return (
              <button
                key={role}
                type="button"
                onClick={() => {
                  login(role)
                  navigate(homeByRole[role])
                }}
                className="group flex flex-col items-start gap-3 rounded-md border border-line bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-gold/60 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-navy">
                  <Icon className="h-5 w-5 text-gold" aria-hidden="true" />
                </span>
                <span className="w-full">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-ink">{roleLabels[role]}</span>
                    <ChevronRight
                      className="h-4 w-4 text-ink-muted transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </span>
                  <span className="mt-1 block text-xs leading-4 text-ink-muted">
                    {roleDescriptions[role]}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <p className="mt-6 text-xs text-white/40">
        Smart Exam Scheduling & Invigilation Management System · Step 3 — app shell
      </p>
    </div>
  )
}
