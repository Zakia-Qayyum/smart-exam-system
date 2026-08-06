import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { passwordRules } from '@/lib/validators'

export default function PasswordChecklist({ password }: { password: string }) {
  const rules = passwordRules(password)
  return (
    <div className="mt-2 grid gap-1.5">
      {rules.map((rule) => (
        <div key={rule.label} className="flex items-center gap-2 text-xs">
          {rule.met ? (
            <Check className="h-3.5 w-3.5 shrink-0 text-success" />
          ) : (
            <X className="h-3.5 w-3.5 shrink-0 text-danger" />
          )}
          <span className={cn(rule.met ? 'text-ink' : 'text-ink-muted')}>{rule.label}</span>
        </div>
      ))}
    </div>
  )
}
