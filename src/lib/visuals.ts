import {
  CheckCircle2,
  ClipboardCheck,
  Info,
  Megaphone,
  Siren,
  type LucideIcon,
} from 'lucide-react'
import type { NotificationKind, TickerKind } from './types'

export type Kind = NotificationKind | TickerKind

export const kindIcon: Record<Kind, LucideIcon> = {
  clash: Siren,
  published: Megaphone,
  assignment: ClipboardCheck,
  approval: CheckCircle2,
  info: Info,
}

export const kindTone: Record<Kind, string> = {
  clash: 'text-danger',
  published: 'text-gold-dark',
  assignment: 'text-info',
  approval: 'text-purple',
  info: 'text-ink-muted',
}

/** Icon bubble tints per kind — clash-red, assignment-blue, published-gold, approval-purple. */
export const kindTint: Record<Kind, string> = {
  clash: 'bg-danger-light text-danger',
  published: 'bg-gold/15 text-gold-dark',
  assignment: 'bg-info-light text-info',
  approval: 'bg-purple-light text-purple',
  info: 'bg-surface text-ink-muted',
}

export function timeAgo(minutes: number): string {
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`
  return `${Math.floor(minutes / 1440)}d ago`
}

export function firstName(name: string): string {
  return name.split(/\s+/)[0] ?? name
}
