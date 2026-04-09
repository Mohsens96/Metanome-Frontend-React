/* eslint-disable no-unused-vars -- TypeScript overload-style declarations confuse the base rule here */
import React from 'react'

type ToastType = 'info' | 'success' | 'error'

type ToastOptions = {
  title?: string
  type?: ToastType
  duration?: number
}

type ToastRecord = {
  id: number
  message: string
  title?: string
  type: ToastType
  duration: number
}

type ToastListener = (toast: ToastRecord) => void

const listeners = new Set<ToastListener>()
let counter = 0

function emitToast(message: string, opts: ToastOptions = {}, fallback: ToastType): number {
  const toast: ToastRecord = {
    id: ++counter,
    message,
    title: opts.title,
    type: opts.type ?? fallback,
    duration: opts.duration ?? 4000,
  }
  listeners.forEach((listener) => listener(toast))
  return toast.id
}

type ToastAPI = {
  (message: string, opts?: ToastOptions): number
  success(message: string, opts?: ToastOptions): number
  error(message: string, opts?: ToastOptions): number
  info(message: string, opts?: ToastOptions): number
}

const baseToast = (message: string, opts?: ToastOptions) => emitToast(message, opts, opts?.type ?? 'info')

export const toast: ToastAPI = Object.assign(baseToast, {
  success(message: string, opts?: ToastOptions) {
    return emitToast(message, { ...opts, type: 'success' }, 'success')
  },
  error(message: string, opts?: ToastOptions) {
    return emitToast(message, { ...opts, type: 'error' }, 'error')
  },
  info(message: string, opts?: ToastOptions) {
    return emitToast(message, { ...opts, type: 'info' }, 'info')
  },
})

export default function ToastHost() {
  const [toasts, setToasts] = React.useState<ToastRecord[]>([])

  const remove = React.useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  React.useEffect(() => {
    const listener: ToastListener = (toast) => {
      setToasts((prev) => [...prev, toast])
      if (toast.duration !== 0) {
        window.setTimeout(() => remove(toast.id), toast.duration)
      }
    }
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [remove])

  const typeStyles: Record<ToastType, string> = {
    info: 'border-blue-300 bg-blue-50 text-blue-900',
    success: 'border-green-300 bg-green-50 text-green-900',
    error: 'border-red-300 bg-red-50 text-red-900',
  }

  const typeLabels: Record<ToastType, string> = {
    info: 'Notice',
    success: 'Success',
    error: 'Error',
  }

  return (
    <div className="fixed right-4 bottom-4 z-50 flex flex-col gap-2 w-80 max-w-[90vw]">
      {toasts.map((t) => (
        <div key={t.id} className={`shadow-md rounded-md border px-4 py-3 text-sm ${typeStyles[t.type]} animate-fade-in`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold text-xs uppercase tracking-wide opacity-80">{t.title || typeLabels[t.type]}</div>
              <div className="mt-1 text-sm leading-snug break-words">{t.message}</div>
            </div>
            <button
              className="text-xs opacity-70 hover:opacity-100"
              onClick={() => remove(t.id)}
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
