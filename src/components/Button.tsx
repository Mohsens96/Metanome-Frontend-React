import React from 'react'

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost'
}

export default function Button({ variant = 'primary', children, ...props }: Props) {
  const base = 'inline-flex items-center gap-2 rounded-md font-medium'
  const cls = variant === 'primary' ? `${base} bg-accent text-white px-3 py-1.5` : `${base} px-2 py-1 text-sm text-muted`
  return (
    <button className={cls} {...props}>
      {children}
    </button>
  )
}
