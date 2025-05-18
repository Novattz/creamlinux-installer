import { useEffect } from 'react'

interface InitialLoadingScreenProps {
  message: string;
  progress: number;
  onComplete?: () => void;
}

/**
 * Initial loading screen displayed when the app first loads
 */
const InitialLoadingScreen = ({ 
  message, 
  progress,
  onComplete
}: InitialLoadingScreenProps) => {
  // Call onComplete when progress reaches 100%
  useEffect(() => {
    if (progress >= 100 && onComplete) {
      const timer = setTimeout(() => {
        onComplete();
      }, 500); // Small delay to show completion
      
      return () => clearTimeout(timer);
    }
  }, [progress, onComplete]);
  
  return (
    <div className="initial-loading-screen">
      <div className="loading-content">
        <h1>CreamLinux</h1>
        
        <div className="loading-animation">
          <div className="loading-circles">
            <div className="circle circle-1"></div>
            <div className="circle circle-2"></div>
            <div className="circle circle-3"></div>
          </div>
        </div>
        
        <p className="loading-message">{message}</p>
        
        <div className="progress-bar-container">
          <div className="progress-bar" style={{ width: `${progress}%` }} />
        </div>
        
        <div className="progress-percentage">{Math.round(progress)}%</div>
      </div>
    </div>
  )
}

export default InitialLoadingScreen