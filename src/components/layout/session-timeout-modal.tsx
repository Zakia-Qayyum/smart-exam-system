import { Timer } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import type { SessionTimeout } from '@/lib/use-session-timeout'

export function SessionTimeoutModal({ showWarning, remainingMs, staySignedIn, logOutNow }: SessionTimeout) {
  if (!showWarning) return null

  const mm = Math.floor(remainingMs / 60000)
  const ss = Math.floor((remainingMs % 60000) / 1000)

  return (
    <Modal
      open={showWarning}
      onClose={logOutNow}
      hideClose
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={logOutNow}>
            Log out
          </Button>
          <Button variant="primary" onClick={staySignedIn}>
            Stay signed in
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-warning-light">
          <Timer className="h-5 w-5 text-warning-deep" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-bold text-ink">Session timeout</h2>
          <p className="mt-1 text-sm leading-5 text-ink-muted">
            You&apos;ve been inactive. For your security you&apos;ll be signed out in{' '}
            <span className="font-bold text-ink">
              {mm}:{String(ss).padStart(2, '0')}
            </span>
            .
          </p>
        </div>
      </div>
    </Modal>
  )
}
