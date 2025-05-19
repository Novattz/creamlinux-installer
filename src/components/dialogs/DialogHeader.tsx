import { ReactNode } from 'react'

export interface DialogHeaderProps {
  children: ReactNode
  className?: string
  onClose?: () => void
  hideCloseButton?: boolean;
}

/**
 * Header component for dialogs
 * Contains the title and optional close button
 */
const DialogHeader = ({ children, className = '', onClose, hideCloseButton = false }: DialogHeaderProps) => {
  return (
    <div className={`dialog-header ${className}`}>
      {children}
      {onClose && !hideCloseButton && (
        <button className="dialog-close-button" onClick={onClose} aria-label="Close dialog">
          ×
        </button>
      )}
    </div>
  )
}

export default DialogHeader
