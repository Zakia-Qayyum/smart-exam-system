import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface TabItem {
  value: string
  label: string
  content: ReactNode
}

export interface TabsProps {
  tabs: TabItem[]
  defaultValue?: string
  value?: string
  onChange?: (value: string) => void
  className?: string
}

export function Tabs({ tabs, defaultValue, value, onChange, className }: TabsProps) {
  const [internal, setInternal] = useState(defaultValue ?? tabs[0]?.value ?? '')
  const active = value ?? internal
  const setActive = (v: string) => {
    setInternal(v)
    onChange?.(v)
  }
  const activeTab = tabs.find((t) => t.value === active) ?? tabs[0]

  return (
    <div className={cn('w-full', className)}>
      <div
        role="tablist"
        className="flex gap-1 overflow-x-auto border-b border-line"
      >
        {tabs.map((tab) => {
          const selected = tab.value === activeTab?.value
          return (
            <button
              key={tab.value}
              role="tab"
              type="button"
              aria-selected={selected}
              onClick={() => setActive(tab.value)}
              className={cn(
                '-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors duration-150',
                selected
                  ? 'border-gold text-navy'
                  : 'border-transparent text-ink-muted hover:border-line hover:text-ink',
              )}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
      <div role="tabpanel" className="pt-4">
        {activeTab?.content}
      </div>
    </div>
  )
}
