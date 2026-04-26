import { ReactNode } from 'react'

type Variant = 'blue' | 'green' | 'red' | 'yellow' | 'gray' | 'orange' | 'purple' | 'primary'

const variants: Record<Variant, string> = {
  blue:    'bg-[var(--color-info-bg)] text-[var(--color-info-text)]',
  green:   'bg-[var(--color-success-bg)] text-[var(--color-success-text)]',
  red:     'bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]',
  yellow:  'bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]',
  gray:    'bg-[var(--surface-subtle)] text-[var(--text-tertiary)]',
  orange:  'bg-[var(--surface-subtle)] text-[var(--text-secondary)] border border-[var(--border-default)]',
  purple:  'bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]',
  primary: 'bg-[var(--oe-primary-light)] text-[var(--oe-primary)]',
}

interface BadgeProps {
  variant?: Variant
  children: ReactNode
  className?: string
}

export function Badge({ variant = 'gray', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[10px] font-[500] ${variants[variant]} ${className}`}
      style={{ borderRadius: 'var(--radius-sm)' }}
    >
      {children}
    </span>
  )
}
