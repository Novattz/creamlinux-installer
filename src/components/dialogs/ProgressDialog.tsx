import { useState } from 'react'
import Dialog from './Dialog'
import DialogHeader from './DialogHeader'
import DialogBody from './DialogBody'
import DialogFooter from './DialogFooter'
import DialogActions from './DialogActions'
import { Button } from '@/components/buttons'

export interface InstallationInstructions {
  type: string
  command: string
  game_title: string
  dlc_count?: number
}

export interface ProgressDialogProps {
  visible: boolean
  title: string
  message: string
  progress: number
  showInstructions?: boolean
  instructions?: InstallationInstructions
  onClose?: () => void
}

/**
 * ProgressDialog component
 * Shows installation progress with a progress bar and optional instructions
 */
const ProgressDialog = ({
  visible,
  title,
  message,
  progress,
  showInstructions = false,
  instructions,
  onClose,
}: ProgressDialogProps) => {
  const [copySuccess, setCopySuccess] = useState(false)

  const handleCopyCommand = () => {
    if (instructions?.command) {
      navigator.clipboard.writeText(instructions.command)
      setCopySuccess(true)

      // Reset the success message after 2 seconds
      setTimeout(() => {
        setCopySuccess(false)
      }, 2000)
    }
  }

  // Determine if we should show the copy button (for CreamLinux but not SmokeAPI)
  const showCopyButton =
    instructions?.type === 'cream_install' || instructions?.type === 'cream_uninstall'

  // Format instruction message based on type
  const getInstructionText = () => {
    if (!instructions) return null

    switch (instructions.type) {
      case 'cream_install':
        return (
          <>
            <p className="instruction-text">
              In Steam, set the following launch options for{' '}
              <strong>{instructions.game_title}</strong>:
            </p>
            {instructions.dlc_count !== undefined && (
              <div className="dlc-count">
                <strong>{instructions.dlc_count}</strong> DLCs have been enabled!
              </div>
            )}
          </>
        )
      case 'cream_uninstall':
        return (
          <p className="instruction-text">
            For <strong>{instructions.game_title}</strong>, open Steam properties and remove the
            following launch option:
          </p>
        )
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
        )
      case 'smoke_uninstall':
        return (
          <p className="instruction-text">
            SmokeAPI has been uninstalled from <strong>{instructions.game_title}</strong>
          </p>
        )
      default:
        return (
          <p className="instruction-text">
            Done processing <strong>{instructions.game_title}</strong>
          </p>
        )
    }
  }

  // Determine the CSS class for the command box based on instruction type
  const getCommandBoxClass = () => {
    return instructions?.type.includes('smoke') ? 'command-box command-box-smoke' : 'command-box'
  }

  // Determine if close button should be enabled
  const isCloseButtonEnabled = showInstructions || progress >= 100

  return (
    <Dialog
      visible={visible}
      onClose={isCloseButtonEnabled ? onClose : undefined}
      size="medium"
      preventBackdropClose={!isCloseButtonEnabled}
    >
      <DialogHeader>
        <h3>{title}</h3>
      </DialogHeader>

      <DialogBody>
        <p>{message}</p>

        <div className="progress-bar-container">
          <div className="progress-bar" style={{ width: `${progress}%` }} />
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
          </div>
        )}
      </DialogBody>

      <DialogFooter>
        <DialogActions>
          {showInstructions && showCopyButton && (
            <Button variant="primary" onClick={handleCopyCommand}>
              {copySuccess ? 'Copied!' : 'Copy to Clipboard'}
            </Button>
          )}

          {isCloseButtonEnabled && (
            <Button variant="secondary" onClick={onClose} disabled={!isCloseButtonEnabled}>
              Close
            </Button>
          )}
        </DialogActions>
      </DialogFooter>
    </Dialog>
  )
}

export default ProgressDialog
