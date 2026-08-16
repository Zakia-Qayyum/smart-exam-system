import { forwardRef, type HTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

export const badgeVariants = cva(
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-5',
  {
    variants: {
      variant: {
        default: 'border-line bg-surface text-ink-muted',
        success: 'border-success/25 bg-success-light text-success',
        danger: 'border-danger/25 bg-danger-light text-danger',
        warning: 'border-warning/40 bg-warning-light text-warning-deep',
        info: 'border-info/25 bg-info-light text-info',
        purple: 'border-purple/25 bg-purple-light text-purple',
        published: 'border-navy/20 bg-navy text-white',
        gold: 'border-gold/40 bg-gold/15 text-gold-dark',
        outline: 'border-line bg-card text-ink',
      },
      dot: {
        true: 'before:inline-block before:h-1.5 before:w-1.5 before:rounded-full before:bg-current',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      dot: false,
    },
  },
)

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, dot, ...props }, ref) => (
    <span ref={ref} className={cn(badgeVariants({ variant, dot }), className)} {...props} />
  ),
)
Badge.displayName = 'Badge'
