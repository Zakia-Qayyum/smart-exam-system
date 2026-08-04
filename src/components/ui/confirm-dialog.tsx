import { AlertTriangle } from 'lucide-react'
import { Modal } from './modal'
import { Button } from './button'

export interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  loading?: boolean
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      hideClose
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-danger-light">
          <AlertTriangle className="h-5 w-5 text-danger" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-bold text-ink">{title}</h2>
          {description && (
            <p className="mt-1 text-sm leading-5 text-ink-muted">{description}</p>
          )}
        </div>
      </div>
    </Modal>
  )
}
