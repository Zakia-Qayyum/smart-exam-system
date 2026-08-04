import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string
  error?: string
  hint?: string
  leading?: ReactNode
  trailing?: ReactNode
  required?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    { className, label, error, hint, leading, trailing, required, id, ...props },
    ref,
  ) => {
    const autoId = useId()
    const inputId = id ?? autoId
    const [focused, setFocused] = useState(false)
    const filled = Boolean(props.value) || Boolean(props.defaultValue)

    return (
      <div className="w-full">
        <div className={cn('relative', className)}>
          {leading && (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted">
              {leading}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${inputId}-error` : undefined}
            placeholder=" "
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className={cn(
              'peer h-12 w-full rounded-md border bg-card px-3 text-sm text-ink outline-none transition-all duration-150',
              'placeholder-transparent',
              leading ? 'pl-9' : 'pl-3',
              trailing ? 'pr-9' : 'pr-3',
              'hover:border-navy-muted/60',
              'focus:border-navy focus:ring-2 focus:ring-navy/15',
              error && 'border-danger focus:border-danger focus:ring-danger/15',
            )}
            {...props}
          />

          {trailing && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted">
              {trailing}
            </span>
          )}

          <label
            htmlFor={inputId}
            className={cn(
              'pointer-events-none absolute left-3 top-1/2 origin-left -translate-y-1/2 select-none text-sm text-ink-muted transition-all duration-150',
              leading && 'left-9',
              (focused || filled) && 'top-1.5 translate-y-0 text-xs font-medium',
              'peer-focus:top-1.5 peer-focus:translate-y-0 peer-focus:text-xs peer-focus:font-medium',
              'peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:translate-y-0 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:font-medium',
              focused || filled ? (error ? 'text-danger' : 'text-navy') : error && 'text-danger',
              !error && 'peer-focus:text-navy',
            )}
          >
            {label}
            {required && <span className="ml-0.5 text-danger">*</span>}
          </label>
        </div>

        {error ? (
          <p id={`${inputId}-error`} role="alert" className="mt-1.5 flex items-center gap-1 text-xs text-danger">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </p>
        ) : hint ? (
          <p className="mt-1.5 text-xs text-ink-muted">{hint}</p>
        ) : null}
      </div>
    )
  },
)
Input.displayName = 'Input'
