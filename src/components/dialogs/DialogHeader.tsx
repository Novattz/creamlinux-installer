import { ReactNode } from 'react'

export interface DialogHeaderProps {
  children: ReactNode;
  className?: string;
  onClose?: () => void;
}

/**
 * Header component for dialogs
 * Contains the title and optional close button
 */
const DialogHeader = ({ children, className = '', onClose }: DialogHeaderProps) => {
  return (
    <div className={`dialog-header ${className}`}>
      {children}
      {onClose && (
        <button 
          className="dialog-close-button" 
          onClick={onClose} 
          aria-label="Close dialog"
        >
          ×
        </button>
      )}
    </div>
  )
}

export default DialogHeader