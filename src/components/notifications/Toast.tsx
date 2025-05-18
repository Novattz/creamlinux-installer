import { ReactNode, useState, useEffect, useCallback } from 'react'
import { Icon, check, info, warning, error } from '@/components/icons'

export interface ToastProps {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  duration?: number;
  onDismiss: (id: string) => void;
}

/**
 * Individual Toast component
 * Displays a notification message with automatic dismissal
 */
const Toast = ({ 
  id, 
  type, 
  title, 
  message, 
  duration = 5000, // default 5 seconds 
  onDismiss 
}: ToastProps) => {
  const [visible, setVisible] = useState(false)

  // Use useCallback to memoize the handleDismiss function
  const handleDismiss = useCallback(() => {
    setVisible(false)
    // Give time for exit animation
    setTimeout(() => onDismiss(id), 300)
  }, [id, onDismiss])

  // Handle animation on mount/unmount
  useEffect(() => {
    // Start the enter animation
    const enterTimer = setTimeout(() => {
      setVisible(true)
    }, 10)

    // Auto-dismiss after duration, if not Infinity
    let dismissTimer: NodeJS.Timeout | null = null
    if (duration !== Infinity) {
      dismissTimer = setTimeout(() => {
        handleDismiss()
      }, duration)
    }

    return () => {
      clearTimeout(enterTimer)
      if (dismissTimer) clearTimeout(dismissTimer)
    }
  }, [duration, handleDismiss])

  // Get icon based on toast type
  const getIcon = (): ReactNode => {
    switch (type) {
      case 'success':
        return <Icon name={check} size="md" variant='bold' />
      case 'error':
        return <Icon name={error} size="md" variant='bold' />
      case 'warning':
        return <Icon name={warning} size="md" variant='bold' />
      case 'info':
        return <Icon name={info} size="md" variant='bold' />
      default:
        return <Icon name={info} size="md" variant='bold' />
    }
  }

  return (
    <div className={`toast toast-${type} ${visible ? 'visible' : ''}`}>
      <div className="toast-icon">{getIcon()}</div>
      <div className="toast-content">
        {title && <h4 className="toast-title">{title}</h4>}
        <p className="toast-message">{message}</p>
      </div>
      <button className="toast-close" onClick={handleDismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  )
}

export default Toast