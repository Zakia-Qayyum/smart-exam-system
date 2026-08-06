import { useEffect, useRef, useState } from 'react'

const DEFAULT_IDLE_MS = 10 * 60 * 1000
const DEFAULT_WARN_MS = 2 * 60 * 1000

interface SessionConfig {
  idleMs: number
  warnMs: number
}

function readConfig(): SessionConfig {
  const idle = Number(localStorage.getItem('ses.idleMs'))
  const warn = Number(localStorage.getItem('ses.warnMs'))
  return {
    idleMs: Number.isFinite(idle) && idle > 0 ? idle : DEFAULT_IDLE_MS,
    warnMs: Number.isFinite(warn) && warn > 0 ? warn : DEFAULT_WARN_MS,
  }
}

export interface SessionTimeout {
  showWarning: boolean
  remainingMs: number
  staySignedIn: () => void
  logOutNow: () => void
}

export function useSessionTimeout(onLogout: () => void): SessionTimeout {
  const [{ idleMs, warnMs }] = useState<SessionConfig>(readConfig)
  const lastActivity = useRef(Date.now())
  const onLogoutRef = useRef(onLogout)
  onLogoutRef.current = onLogout

  const [showWarning, setShowWarning] = useState(false)
  const [remainingMs, setRemainingMs] = useState(idleMs)

  useEffect(() => {
    const bump = () => {
      lastActivity.current = Date.now()
      setShowWarning(false)
    }
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'] as const
    events.forEach((ev) => window.addEventListener(ev, bump, { passive: true }))
    return () => events.forEach((ev) => window.removeEventListener(ev, bump))
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - lastActivity.current
      if (elapsed >= idleMs) {
        setShowWarning(false)
        onLogoutRef.current()
      } else if (elapsed >= idleMs - warnMs) {
        setShowWarning(true)
        setRemainingMs(idleMs - elapsed)
      }
    }, 1000)
    return () => window.clearInterval(timer)
  }, [idleMs, warnMs])

  const staySignedIn = () => {
    lastActivity.current = Date.now()
    setShowWarning(false)
  }

  const logOutNow = () => {
    setShowWarning(false)
    onLogoutRef.current()
  }

  return { showWarning, remainingMs, staySignedIn, logOutNow }
}
