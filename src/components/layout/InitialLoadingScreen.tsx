import { useEffect, useState } from 'react'

interface InitialLoadingScreenProps {
  message: string;
  progress: number;
  onComplete?: () => void;
}

/**
 * Initial loading screen displayed when the app first loads
 */
const InitialLoadingScreen = ({ message, progress, onComplete }: InitialLoadingScreenProps) => {
  const [detailedStatus, setDetailedStatus] = useState<string[]>([
    "Initializing application...",
    "Setting up Steam integration...",
    "Preparing DLC management..."
  ]);
  
  // Use a sequence of messages based on progress
  useEffect(() => {
    const messages = [
      { threshold: 10, message: "Checking system requirements..." },
      { threshold: 30, message: "Scanning Steam libraries..." },
      { threshold: 50, message: "Discovering games..." },
      { threshold: 70, message: "Analyzing game configurations..." },
      { threshold: 90, message: "Preparing user interface..." },
      { threshold: 100, message: "Ready to launch!" }
    ];
    
    // Find current status message based on progress
    const currentMessage = messages.find(m => progress <= m.threshold)?.message || "Loading...";
    
    // Add new messages to the log as progress increases
    if (currentMessage && !detailedStatus.includes(currentMessage)) {
      setDetailedStatus(prev => [...prev, currentMessage]);
    }
  }, [progress, detailedStatus]);

  return (
    <div className="initial-loading-screen">
      <div className="loading-content">
        <h1>CreamLinux</h1>
        
        <div className="loading-animation">
          {/* Enhanced animation with SVG or more elaborate CSS animation */}
          <div className="loading-circles">
            <div className="circle circle-1"></div>
            <div className="circle circle-2"></div>
            <div className="circle circle-3"></div>
          </div>
        </div>
        
        <p className="loading-message">{message}</p>
        
        {/* Add a detailed status log that shows progress steps */}
        <div className="loading-status-log">
          {detailedStatus.slice(-4).map((status, index) => (
            <div key={index} className="status-line">
              <span className="status-indicator">○</span>
              <span className="status-text">{status}</span>
            </div>
          ))}
        </div>
        
        <div className="progress-bar-container">
          <div className="progress-bar" style={{ width: `${progress}%` }} />
        </div>
        
        <div className="progress-percentage">{Math.round(progress)}%</div>
      </div>
    </div>
  );
};

export default InitialLoadingScreen