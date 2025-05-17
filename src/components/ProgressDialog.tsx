// src/components/ProgressDialog.tsx
import React, { useState, useEffect } from 'react';

interface InstructionInfo {
  type: string;
  command: string;
  game_title: string;
  dlc_count?: number;
}

interface ProgressDialogProps {
  title: string;
  message: string;
  progress: number; // 0-100
  visible: boolean;
  showInstructions?: boolean;
  instructions?: InstructionInfo;
  onClose?: () => void;
}

const ProgressDialog: React.FC<ProgressDialogProps> = ({ 
  title, 
  message, 
  progress, 
  visible,
  showInstructions = false,
  instructions,
  onClose
}) => {
  const [copySuccess, setCopySuccess] = useState(false);
  const [showContent, setShowContent] = useState(false);

  // Reset copy state when dialog visibility changes
  useEffect(() => {
    if (!visible) {
      setCopySuccess(false);
      setShowContent(false);
    } else {
      // Add a small delay to trigger the entrance animation
      const timer = setTimeout(() => {
        setShowContent(true);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!visible) return null;

  const handleCopyCommand = () => {
    if (instructions?.command) {
      navigator.clipboard.writeText(instructions.command);
      setCopySuccess(true);
      
      // Reset the success message after 2 seconds
      setTimeout(() => {
        setCopySuccess(false);
      }, 2000);
    }
  };

  const handleClose = () => {
    setShowContent(false);
    // Delay closing to allow exit animation
    setTimeout(() => {
      if (onClose) {
        onClose();
      }
    }, 300);
  };

  // Modified to prevent closing when in progress
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Always prevent propagation
    e.stopPropagation();
    
    // Only allow clicking outside to close if we're done processing (100%) 
    // and showing instructions or if explicitly allowed via a prop
    if (e.target === e.currentTarget && progress >= 100 && showInstructions) {
      handleClose();
    }
    // Otherwise, do nothing - require using the close button
  };

  // Determine if we should show the copy button (for CreamLinux but not SmokeAPI)
  const showCopyButton = instructions?.type === 'cream_install' || 
                        instructions?.type === 'cream_uninstall';

  // Format instruction message based on type
  const getInstructionText = () => {
    if (!instructions) return null;
    
    switch (instructions.type) {
      case 'cream_install':
        return (
          <>
            <p className="instruction-text">
              In Steam, set the following launch options for <strong>{instructions.game_title}</strong>:
            </p>
            {instructions.dlc_count !== undefined && (
              <div className="dlc-count">
                <strong>{instructions.dlc_count}</strong> DLCs have been enabled!
              </div>
            )}
          </>
        );
      case 'cream_uninstall':
        return (
          <p className="instruction-text">
            For <strong>{instructions.game_title}</strong>, open Steam properties and remove the following launch option:
          </p>
        );
      case 'smoke_install':
        return (
          <>
            <p className="instruction-text">
              SmokeAPI has been installed for <strong>{instructions.game_title}</strong>
            </p>
            {instructions.dlc_count !== undefined && (
              <div className="dlc-count">
                <strong>{instructions.dlc_count}</strong> Steam API files have been patched.
              </div>
            )}
          </>
        );
      case 'smoke_uninstall':
        return (
          <p className="instruction-text">
            SmokeAPI has been uninstalled from <strong>{instructions.game_title}</strong>
          </p>
        );
      default:
        return (
          <p className="instruction-text">
            Done processing <strong>{instructions.game_title}</strong>
          </p>
        );
    }
  };

  // Determine the CSS class for the command box based on instruction type
  const getCommandBoxClass = () => {
    return instructions?.type.includes('smoke') ? 'command-box command-box-smoke' : 'command-box';
  };

  // Determine if close button should be enabled
  const isCloseButtonEnabled = showInstructions || progress >= 100;

  return (
    <div 
      className={`progress-dialog-overlay ${showContent ? 'visible' : ''}`} 
      onClick={handleOverlayClick}
    >
      <div className={`progress-dialog ${showInstructions ? 'with-instructions' : ''} ${showContent ? 'dialog-visible' : ''}`}>
        <h3>{title}</h3>
        <p>{message}</p>
        
        <div className="progress-bar-container">
          <div 
            className="progress-bar" 
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="progress-percentage">{Math.round(progress)}%</div>
        
        {showInstructions && instructions && (
          <div className="instruction-container">
            <h4>
              {instructions.type.includes('uninstall') 
                ? 'Uninstallation Instructions' 
                : 'Installation Instructions'}
            </h4>
            {getInstructionText()}
            
            <div className={getCommandBoxClass()}>
              <pre className="selectable-text">{instructions.command}</pre>
            </div>
            
            <div className="action-buttons">
              {showCopyButton && (
                <button 
                  className="copy-button" 
                  onClick={handleCopyCommand}
                >
                  {copySuccess ? 'Copied!' : 'Copy to Clipboard'}
                </button>
              )}
              
              <button 
                className="close-button"
                onClick={handleClose}
                disabled={!isCloseButtonEnabled}
              >
                Close
              </button>
            </div>
          </div>
        )}
        
        {/* Show close button even if no instructions */}
        {!showInstructions && progress >= 100 && (
          <div className="action-buttons" style={{ marginTop: '1rem' }}>
            <button 
              className="close-button"
              onClick={handleClose}
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProgressDialog;