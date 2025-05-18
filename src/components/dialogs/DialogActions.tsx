import { ReactNode } from 'react'

export interface DialogActionsProps {
  children: ReactNode;
  className?: string;
  align?: 'start' | 'center' | 'end';
}

/**
 * Actions container for dialog footers
 * Provides consistent spacing and alignment for action buttons
 */
const DialogActions = ({ 
  children, 
  className = '',
  align = 'end' 
}: DialogActionsProps) => {
  const alignClass = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end'
  }[align];

  return (
    <div className={`dialog-actions ${alignClass} ${className}`}>
      {children}
    </div>
  )
}

export default DialogActions