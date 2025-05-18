import { Component, ErrorInfo, ReactNode } from 'react'
import { Button } from '@/components/buttons'

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary component to catch and display runtime errors
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
    }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    
    // Call the onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }
      
      // Default error UI
      return (
        <div className="error-container">
          <h2>Something went wrong</h2>
          
          <details>
            <summary>Error details</summary>
            <p>{this.state.error?.toString()}</p>
          </details>
          
          <Button 
            variant="primary"
            onClick={this.handleReset}
            className="error-retry-button"
          >
            Try again
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary