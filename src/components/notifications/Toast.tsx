import { ReactNode, useState, useEffect, useCallback } from 'react'
import { Icon, check, info, warning, error, close } from '@/components/icons'

export interface ToastProps {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title?: string
  message: string
  duration?: number
  onDismiss: (id: string) => void
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
  onDismiss,
}: ToastProps) => {
  const [visible, setVisible] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

  // Use useCallback to memoize the handleDismiss function
  const handleDismiss = useCallback(() => {
    setIsClosing(true)
    // Give time for exit animation
    setTimeout(() => {
      setVisible(false)
      setTimeout(() => onDismiss(id), 50)
    }, 400)
  }, [id, onDismiss])

  // Handle animation on mount/unmount
  useEffect(() => {
    // Start the enter animation
    const enterTimer = setTimeout(() => {
      setVisible(true)
    }, 50)

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
        return <Icon name={check} size="md" variant="solid" className="toast-type-icon toast-success-icon"/>
      case 'error':
        return <Icon name={error} size="md" variant="solid" className="toast-type-icon toast-error-icon"/>
      case 'warning':
        return <Icon name={warning} size="md" variant="solid" className="toast-type-icon toast-warning-icon"/>
      case 'info':
        return <Icon name={info} size="md" variant="solid" className="toast-type-icon toast-info-icon"/>
      default:
        return <Icon name={info} size="md" variant="solid" className="toast-type-icon toast-info-icon"/>
    }
  }

  // Get default title if none provided
  const getTitle = (): string => {
    if (title) return title

    switch (type) {
      case 'success':
        return 'Success'
      case 'error':
        return 'Error'
      case 'warning':
        return 'Warning'
      case 'info':
        return 'Information'
      default:
        return 'Notification'
    }
  }

  return (
    <div
      className={`toast toast-${type} ${visible ? 'visible' : ''} ${isClosing ? 'closing' : ''}`}
    >
      <div className="toast-icon">{getIcon()}</div>
      <div className="toast-content">
        <h4 className="toast-title">{getTitle()}</h4>
        <p className="toast-message">{message}</p>
      </div>
      <button className="toast-close" onClick={handleDismiss} aria-label="Dismiss">
        <Icon name={close} size="sm" variant="solid" className="toast-close-icon" />
      </button>
    </div>
  )
}

export default Toast
