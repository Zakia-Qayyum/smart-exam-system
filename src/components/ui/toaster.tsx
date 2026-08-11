import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { useToastStore, type ToastItem } from './toast-store'
import { cn } from '@/lib/utils'

const icons = {
  success: <CheckCircle2 className="h-5 w-5 text-success" />,
  danger: <AlertCircle className="h-5 w-5 text-danger" />,
  warning: <AlertTriangle className="h-5 w-5 text-warning-deep" />,
  info: <Info className="h-5 w-5 text-info" />,
}

function ToastCard({ toast }: { toast: ToastItem }) {
  const remove = useToastStore((s) => s.remove)

  useEffect(() => {
    const timer = setTimeout(() => remove(toast.id), toast.duration ?? 4000)
    return () => clearTimeout(timer)
  }, [toast.id, toast.duration, remove])

  return (
    <div
      role="status"
      className={cn(
        'pointer-events-auto flex w-80 items-start gap-3 rounded-md border border-line bg-card p-3.5 shadow-lift',
        'animate-[toastIn_180ms_ease-out]',
      )}
    >
      <span className="mt-0.5 shrink-0">{icons[toast.variant]}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{toast.title}</p>
        {toast.description && (
          <p className="mt-0.5 text-sm text-ink-muted">{toast.description}</p>
        )}
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              remove(toast.id)
              toast.action?.onClick()
            }}
            className="mt-2 inline-flex h-8 items-center gap-1 rounded-md border border-navy/30 px-3 text-xs font-semibold text-navy transition-colors hover:bg-navy hover:text-white"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => remove(toast.id)}
        aria-label="Dismiss notification"
        className="shrink-0 rounded p-0.5 text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)

  return createPortal(
    <div className="pointer-events-none fixed right-4 top-4 z-[60] flex flex-col gap-2">
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} />
      ))}
    </div>,
    document.body,
  )
}
