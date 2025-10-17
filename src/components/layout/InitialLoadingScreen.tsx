import { useEffect, useState } from 'react'

interface InitialLoadingScreenProps {
  message: string
  progress: number
  onComplete?: () => void
}

/**
 * Initial loading screen displayed when the app first loads
 */
const InitialLoadingScreen = ({ message, progress }: InitialLoadingScreenProps) => {
  const [currentStep, setCurrentStep] = useState(0)

  // Define the loading steps
  const steps = [
    'Checking system requirements...',
    'Scanning Steam libraries...',
    'Discovering games...',
    'Preparing user interface...',
  ]

  // Update current step based on progress
  useEffect(() => {
    const stepThresholds = [25, 50, 75, 100]
    const newStep = stepThresholds.findIndex(threshold => progress < threshold)
    
    if (newStep !== -1 && newStep !== currentStep) {
      setCurrentStep(newStep)
    } else if (newStep === -1 && currentStep !== steps.length - 1) {
      setCurrentStep(steps.length - 1)
    }
  }, [progress, currentStep, steps.length])

  return (
    <div className="initial-loading-screen">
      <div className="loading-content">
        <h1>CreamLinux</h1>

        <div className="loading-animation">
          {/* Spinner animation */}
          <div className="loading-spinner"></div>
        </div>

        <p className="loading-message">{message}</p>

        {/* Single step display that changes */}
        <div className="loading-status-log">
          <div className="status-line active">
            <span className="status-step">[{currentStep + 1}/{steps.length}]</span>
            <span className="status-text">{steps[currentStep]}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default InitialLoadingScreen