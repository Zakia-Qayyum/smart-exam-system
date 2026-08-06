import { useEffect, type RefObject } from 'react'

export function useDismiss<T extends HTMLElement>(ref: RefObject<T | null>, onDismiss: () => void) {
  useEffect(() => {
    const onPointer = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onDismiss()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss()
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('touchstart', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('touchstart', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [ref, onDismiss])
}
