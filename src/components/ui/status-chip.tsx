import { forwardRef, type HTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

export const statusChipVariants = cva(
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold',
  {
    variants: {
      status: {
        clash: 'border-danger/25 bg-danger-light text-danger',
        'no-clash': 'border-success/25 bg-success-light text-success',
        pending: 'border-warning/40 bg-warning-light text-warning-deep',
        published: 'border-navy/20 bg-navy text-white',
        info: 'border-info/25 bg-info-light text-info',
        draft: 'border-line bg-surface text-ink-muted',
      },
    },
    defaultVariants: {
      status: 'info',
    },
  },
)

export interface StatusChipProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusChipVariants> {
  label: string
}

export const StatusChip = forwardRef<HTMLSpanElement, StatusChipProps>(
  ({ className, status, label, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(statusChipVariants({ status }), className)}
      role="status"
      {...props}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {label}
    </span>
  ),
)
StatusChip.displayName = 'StatusChip'
