import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const avatarVariants = cva(
  'relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-navy font-bold text-white ring-2 ring-card',
  {
    variants: {
      size: {
        sm: 'h-8 w-8 text-xs',
        md: 'h-10 w-10 text-sm',
        lg: 'h-14 w-14 text-lg',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  },
)

export interface AvatarProps extends VariantProps<typeof avatarVariants> {
  name: string
  src?: string
  className?: string
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

const avatarPalette = [
  'bg-navy',
  'bg-navy-light',
  'bg-success',
  'bg-info',
  'bg-danger',
  'bg-warning-deep',
]

export function Avatar({ name, src, size, className }: AvatarProps) {
  const initials = getInitials(name)
  const hue = avatarPalette[
    Array.from(name).reduce((acc, ch) => acc + (ch.codePointAt(0) ?? 0), 0) %
      avatarPalette.length
  ]

  return (
    <span className={cn(avatarVariants({ size }), hue, className)} aria-label={name}>
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        initials
      )}
    </span>
  )
}
