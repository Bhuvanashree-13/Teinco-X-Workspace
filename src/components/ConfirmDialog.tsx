import { useEffect } from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'

type ConfirmDialogProps = {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'default'
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, loading, onCancel])

  if (!open) return null

  const isDanger = tone === 'danger'

  return (
    <div className="mobile-dialog-overlay" onMouseDown={() => !loading && onCancel()}>
      <div
        className="mobile-dialog-panel sm:max-w-md"
        onMouseDown={event => event.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${
                isDanger ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-blue-50 text-[#1E3A8A] dark:bg-blue-900/30 dark:text-blue-300'
              }`}
            >
              {isDanger ? <Trash2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
              {description && (
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{description}</p>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="brand-secondary-button flex w-full items-center justify-center sm:w-auto"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors disabled:opacity-50 sm:w-auto ${
                isDanger ? 'bg-red-600 hover:bg-red-700' : 'bg-[#1E3A8A] hover:bg-[#1B3378]'
              }`}
            >
              {loading ? 'Please wait…' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}