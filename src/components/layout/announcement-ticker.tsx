import { useAuthStore } from '@/stores/auth-store'
import { mockTicker } from '@/config/mock-data'
import { kindIcon, kindTone } from '@/lib/visuals'
import type { TickerItem } from '@/lib/types'

function TickerItemView({ item }: { item: TickerItem }) {
  const Icon = kindIcon[item.kind]
  return (
    <span className="flex shrink-0 items-center gap-2 px-8 text-[13px] font-medium text-white/90">
      {item.isNew && (
        <span className="rounded-[4px] bg-gold px-1.5 py-px text-[10px] font-black uppercase leading-4 tracking-wide text-navy-deep">
          New
        </span>
      )}
      <Icon className={kindTone[item.kind]} aria-hidden="true" />
      <span>{item.text}</span>
    </span>
  )
}

export function AnnouncementTicker() {
  const role = useAuthStore((s) => s.user?.role)
  if (!role) return null

  const items = mockTicker(role)
  const loop = [...items, ...items]

  return (
    <div className="flex h-9 items-stretch overflow-hidden border-t border-navy-light/40 bg-navy-deep text-white">
      <div className="flex shrink-0 items-center gap-2 border-r border-navy-light/40 px-4">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-70" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
        </span>
        <span className="text-[11px] font-black uppercase tracking-widest text-gold">
          Announcements
        </span>
      </div>
      <div className="group relative flex min-w-0 flex-1 items-center overflow-hidden">
        <div className="flex w-max animate-[tickerScroll_48s_linear_infinite] items-center group-hover:[animation-play-state:paused]">
          {loop.map((item, i) => (
            <TickerItemView key={`${item.id}-${i}`} item={item} />
          ))}
        </div>
        <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-navy-deep to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-navy-deep to-transparent" />
      </div>
    </div>
  )
}
