import Toast, { ToastProps } from './Toast'

export type ToastPosition =
  | 'top-right'
  | 'top-left'
  | 'bottom-right'
  | 'bottom-left'
  | 'top-center'
  | 'bottom-center'

interface ToastContainerProps {
  toasts: Omit<ToastProps, 'onDismiss'>[]
  onDismiss: (id: string) => void
  position?: ToastPosition
}

/**
 * Container for toast notifications
 * Manages positioning and rendering of all toast notifications
 */
const ToastContainer = ({ toasts, onDismiss, position = 'bottom-right' }: ToastContainerProps) => {
  if (toasts.length === 0) {
    return null
  }

  return (
    <div className={`toast-container ${position}`}>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          id={toast.id}
          type={toast.type}
          title={toast.title}
          message={toast.message}
          duration={toast.duration}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  )
}

export default ToastContainer
