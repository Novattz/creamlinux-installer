import { ReactNode } from 'react'

export interface DialogBodyProps {
  children: ReactNode;
  className?: string;
}

/**
 * Body component for dialogs
 * Contains the main content with scrolling capability
 */
const DialogBody = ({ children, className = '' }: DialogBodyProps) => {
  return (
    <div className={`dialog-body ${className}`}>
      {children}
    </div>
  )
}

export default DialogBody