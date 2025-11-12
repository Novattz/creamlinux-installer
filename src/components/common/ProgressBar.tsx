interface ProgressBarProps {
  progress: number
}

/**
 * Simple progress bar component
 */
const ProgressBar = ({ progress }: ProgressBarProps) => {
  return (
    <div className="progress-container">
      <div className="progress-bar">
        <div 
          className="progress-fill" 
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
      <span className="progress-text">{Math.round(progress)}%</span>
    </div>
  )
}

export default ProgressBar