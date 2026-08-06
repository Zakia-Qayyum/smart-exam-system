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
  published: 'text-navy',
  assignment: 'text-info',
  approval: 'text-success',
  info: 'text-ink-muted',
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
