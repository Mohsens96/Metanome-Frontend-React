import React from 'react'

type Props = {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
}

export default function Modal({ open, onClose, title, children }: Props) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-md shadow-lg w-full max-w-lg p-4">
        {title && <h2 className="text-lg font-semibold mb-2">{title}</h2>}
        {children}
        <div className="mt-4 flex justify-end">
          <button className="px-3 py-1 text-sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
