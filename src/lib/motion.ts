import { useEffect, useRef, useState } from 'react'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Animate a number counting up from 0 → `target` on mount.
 * Returns the current displayed value as a string (e.g. "12").
 * Falls back to showing `target` immediately when reduced motion is preferred.
 */
export function useCountUp(target: number, durationMs = 600): string {
  const [display, setDisplay] = useState(
    prefersReducedMotion() ? String(target) : '0',
  )
  const ref = useRef<number | null>(null)

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(String(target))
      return
    }
    const start = performance.now()
    const from = 0

    const tick = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / durationMs, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
      const current = Math.round(from + (target - from) * eased)
      setDisplay(String(current))
      if (progress < 1) {
        ref.current = requestAnimationFrame(tick)
      }
    }

    ref.current = requestAnimationFrame(tick)
    return () => {
      if (ref.current !== null) cancelAnimationFrame(ref.current)
    }
  }, [target, durationMs])

  return display
}

/**
 * Returns a style object with the correct `animationDelay` for staggered
 * fade-in animations. The delay is calculated as `index * baseMs` milliseconds.
 * When reduced motion is preferred, returns no delay.
 */
export function staggerDelay(
  index: number,
  baseMs = 60,
): React.CSSProperties {
  if (prefersReducedMotion()) return {}
  return { animationDelay: `${index * baseMs}ms` }
}
