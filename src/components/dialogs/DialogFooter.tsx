import { ReactNode } from 'react'

export interface DialogFooterProps {
  children: ReactNode
  className?: string
}

/**
 * Footer component for dialogs
 * Contains action buttons and optional status information
 */
const DialogFooter = ({ children, className = '' }: DialogFooterProps) => {
  return <div className={`dialog-footer ${className}`}>{children}</div>
}

export default DialogFooter
