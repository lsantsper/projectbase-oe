import { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

const base = 'block w-full border border-[var(--border-default)] px-3 py-2 text-[13px] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:border-[var(--oe-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--oe-primary)] disabled:bg-[var(--surface-subtle)] transition-colors'

const radius = { borderRadius: 'var(--radius-md)' }

export function Input({ className = '', style, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${base} ${className}`} style={{ ...radius, ...style }} {...rest} />
}

export function Select({ className = '', style, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${base} ${className}`} style={{ ...radius, ...style }} {...rest}>
      {children}
    </select>
  )
}

export function Textarea({ className = '', style, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${base} ${className}`} style={{ ...radius, ...style }} rows={3} {...rest} />
}

interface FieldProps { label: string; children: React.ReactNode; required?: boolean; className?: string }
export function Field({ label, children, required, className = '' }: FieldProps) {
  return (
    <div className={`space-y-1 ${className}`}>
      <label className="block text-[12px] font-[500] text-[var(--text-secondary)]">
        {label}{required && <span className="text-[var(--color-danger-text)] ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}
