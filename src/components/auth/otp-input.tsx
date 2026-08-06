import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export default function OtpInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [length, setLength] = useState(6)
  const inputs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    inputs.current[0]?.focus()
  }, [])

  useEffect(() => {
    if (value.length > length) setLength(value.length)
  }, [value, length])

  const update = (index: number, char: string) => {
    const digits = char.replace(/\D/g, '')
    if (!digits) return
    const next = value.slice(0, index) + digits + value.slice(index + 1)
    onChange(next.slice(0, 6))
    inputs.current[Math.min(index + digits.length, 5)]?.focus()
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !value[index] && index > 0) {
      inputs.current[index - 1]?.focus()
    }
    if (e.key === 'ArrowLeft' && index > 0) inputs.current[index - 1]?.focus()
    if (e.key === 'ArrowRight' && index < 5) inputs.current[index + 1]?.focus()
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (digits) {
      onChange(digits)
      inputs.current[Math.min(digits.length - 1, 5)]?.focus()
    }
  }

  return (
    <div className="flex justify-between gap-2.5" onPaste={handlePaste}>
      {Array.from({ length: 6 }).map((_, index) => (
        <input
          key={index}
          ref={(el) => {
            inputs.current[index] = el
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={6}
          value={value[index] ?? ''}
          onChange={(e) => update(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          className={cn(
            'h-13 w-11 rounded-lg border bg-white text-center text-xl font-semibold text-ink outline-none transition-colors sm:h-14 sm:w-12',
            'focus:border-gold focus:ring-2 focus:ring-gold/30',
            value[index] ? 'border-gold/60' : 'border-line',
          )}
        />
      ))}
    </div>
  )
}
