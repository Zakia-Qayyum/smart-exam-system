import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

export default function AuthCard({
  title,
  subtitle,
  children,
  footer,
  className = '',
}: {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => setMounted(true), 40)
    return () => window.clearTimeout(t)
  }, [])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-navy-deep via-navy to-navy-deep px-4 py-10">
      <div className="mb-6 flex flex-col items-center">
        <img src="/favicon.svg" alt="Air University" className="h-14 w-14 drop-shadow-lg" />
        <p className="mt-3 text-sm font-medium tracking-widest text-white/40 uppercase">Air University · Islamabad</p>
      </div>

      <div ref={ref} className={`w-full max-w-md transition-all duration-300 ease-out ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}>
        <div className={`rounded-2xl border border-white/10 bg-card p-8 shadow-2xl shadow-black/40 sm:p-10 ${className}`}>
          <header className="mb-7">
            <div className="mb-3 h-1 w-10 rounded-full bg-gold" />
            <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
            {subtitle ? <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{subtitle}</p> : null}
          </header>
          {children}
        </div>
        {footer ? <div className="mt-5 text-center text-sm text-white/60">{footer}</div> : null}
      </div>
    </div>
  )
}
