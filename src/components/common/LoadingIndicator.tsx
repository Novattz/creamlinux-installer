import { ReactNode } from 'react'
import Spinner from './Spinner'

export type LoadingType = 'spinner' | 'dots'
export type LoadingSize = 'small' | 'medium' | 'large'

interface LoadingIndicatorProps {
  size?: LoadingSize
  type?: LoadingType
  message?: string
  className?: string
}

/**
 * Versatile loading indicator component
 * Supports multiple visual styles and sizes.
 * For a progress bar, use ProgressBar or ProgressDialog's progress bar instead.
 */
const LoadingIndicator = ({
  size = 'medium',
  type = 'spinner',
  message,
  className = '',
}: LoadingIndicatorProps) => {
  // Size class mapping
  const sizeClass = {
    small: 'loading-small',
    medium: 'loading-medium',
    large: 'loading-large',
  }[size]

  // Render loading indicator based on type
  const renderLoadingIndicator = (): ReactNode => {
    switch (type) {
      case 'spinner':
        return <Spinner />

      case 'dots':
        return (
          <div className="loading-dots">
            <div className="dot dot-1"></div>
            <div className="dot dot-2"></div>
            <div className="dot dot-3"></div>
          </div>
        )

      default:
        return <Spinner />
    }
  }

  return (
    <div className={`loading-indicator ${sizeClass} ${className}`}>
      {renderLoadingIndicator()}
      {message && <p className="loading-message">{message}</p>}
    </div>
  )
}

export default LoadingIndicator
