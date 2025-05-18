import { ReactNode, useEffect, useState } from 'react'

export interface DialogProps {
  visible: boolean
  onClose?: () => void
  className?: string
  preventBackdropClose?: boolean
  children: ReactNode
  size?: 'small' | 'medium' | 'large'
  showAnimationOnUnmount?: boolean
}

/**
 * Base Dialog component that serves as a container for dialog content
 * Used with DialogHeader, DialogBody, and DialogFooter components
 */
const Dialog = ({
  visible,
  onClose,
  className = '',
  preventBackdropClose = false,
  children,
  size = 'medium',
  showAnimationOnUnmount = true,
}: DialogProps) => {
  const [showContent, setShowContent] = useState(false)
  const [shouldRender, setShouldRender] = useState(visible)

  // Handle visibility changes with animations
  useEffect(() => {
    if (visible) {
      setShouldRender(true)
      // Small delay to trigger entrance animation after component is mounted
      const timer = setTimeout(() => {
        setShowContent(true)
      }, 50)
      return () => clearTimeout(timer)
    } else if (showAnimationOnUnmount) {
      // First hide content with animation
      setShowContent(false)
      // Then unmount after animation completes
      const timer = setTimeout(() => {
        setShouldRender(false)
      }, 300) // Match this with your CSS transition duration
      return () => clearTimeout(timer)
    } else {
      // Immediately unmount without animation
      setShowContent(false)
      setShouldRender(false)
    }
  }, [visible, showAnimationOnUnmount])

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !preventBackdropClose && onClose) {
      onClose()
    }
  }

  // Don't render anything if dialog shouldn't be shown
  if (!shouldRender) return null

  const sizeClass = {
    small: 'dialog-small',
    medium: 'dialog-medium',
    large: 'dialog-large',
  }[size]

  return (
    <div className={`dialog-overlay ${showContent ? 'visible' : ''}`} onClick={handleBackdropClick}>
      <div className={`dialog ${sizeClass} ${className} ${showContent ? 'dialog-visible' : ''}`}>
        {children}
      </div>
    </div>
  )
}

export default Dialog
