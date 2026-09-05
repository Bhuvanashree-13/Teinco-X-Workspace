import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'

export type ToastVariant = 'success' | 'error' | 'info'

type Toast = {
  id: number
  title: string
  description?: string
  variant: ToastVariant
}

type ToastInput = {
  title: string
  description?: string
  variant?: ToastVariant
}

const ToastContext = createContext<{ push: (input: ToastInput) => void } | null>(null)

const TOAST_DURATION = 4500
let nextToastId = 1

const variantStyles: Record<ToastVariant, { icon: typeof Info; iconClass: string; barClass: string }> = {
  success: { icon: CheckCircle2, iconClass: 'text-emerald-500', barClass: 'bg-emerald-500' },
  error: { icon: AlertTriangle, iconClass: 'text-red-500', barClass: 'bg-red-500' },
  info: { icon: Info, iconClass: 'text-blue-500', barClass: 'bg-blue-500' },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef(new Map<number, number>())

  const dismiss = useCallback((id: number) => {
    setToasts(current => current.filter(toast => toast.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      window.clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const push = useCallback((input: ToastInput) => {
    const id = nextToastId++
    setToasts(current => [...current, { id, variant: 'success', ...input }])
    const timer = window.setTimeout(() => dismiss(id), TOAST_DURATION)
    timers.current.set(id, timer)
  }, [dismiss])

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map(toast => {
          const { icon: Icon, iconClass, barClass } = variantStyles[toast.variant]
          return (
            <div
              key={toast.id}
              role="status"
              className="relative pointer-events-auto flex w-full max-w-sm items-start gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-900/10 animate-in slide-in-from-top-2 fade-in dark:border-gray-700 dark:bg-gray-800"
            >
              <span className={`absolute left-0 top-0 h-full w-1 ${barClass}`} />
              <Icon className={`h-5 w-5 shrink-0 ${iconClass}`} />
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{toast.title}</p>
                {toast.description && (
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{toast.description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss notification"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-gray-700 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside ToastProvider')
  return {
    success: (title: string, description?: string) => context.push({ title, description, variant: 'success' }),
    error: (title: string, description?: string) => context.push({ title, description, variant: 'error' }),
    info: (title: string, description?: string) => context.push({ title, description, variant: 'info' }),
  }
}