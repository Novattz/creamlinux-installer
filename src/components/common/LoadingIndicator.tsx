import { ReactNode } from 'react'

export type LoadingType = 'spinner' | 'dots' | 'progress'
export type LoadingSize = 'small' | 'medium' | 'large'

interface LoadingIndicatorProps {
  size?: LoadingSize;
  type?: LoadingType;
  message?: string;
  progress?: number;
  className?: string;
}

/**
 * Versatile loading indicator component
 * Supports multiple visual styles and sizes
 */
const LoadingIndicator = ({
  size = 'medium',
  type = 'spinner',
  message,
  progress = 0,
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
        return <div className="loading-spinner"></div>
        
      case 'dots':
        return (
          <div className="loading-dots">
            <div className="dot dot-1"></div>
            <div className="dot dot-2"></div>
            <div className="dot dot-3"></div>
          </div>
        )
        
      case 'progress':
        return (
          <div className="loading-progress">
            <div className="progress-bar-container">
              <div
                className="progress-bar"
                style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
              ></div>
            </div>
            {progress > 0 && (
              <div className="progress-percentage">{Math.round(progress)}%</div>
            )}
          </div>
        )
        
      default:
        return <div className="loading-spinner"></div>
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