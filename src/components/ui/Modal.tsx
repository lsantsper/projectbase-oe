import { ReactNode, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

const MAX_WIDTHS = { sm: 400, md: 560, lg: 720 }

export function Modal({ open, title, onClose, children, footer, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background: 'var(--surface-card)',
          borderRadius: 'var(--radius-lg)',
          border: '0.5px solid var(--border-default)',
          width: '100%',
          maxWidth: MAX_WIDTHS[size],
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '0.5px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <h2 style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>{title}</h2>
          <button
            onClick={onClose}
            style={{ color: 'var(--text-tertiary)', fontSize: 20, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
          >×</button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            style={{
              padding: '12px 20px',
              borderTop: '0.5px solid var(--border-default)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
              flexShrink: 0,
              background: 'var(--surface-card)',
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
