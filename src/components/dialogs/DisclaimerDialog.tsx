import {
  Dialog,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogActions,
} from '@/components/dialogs'
import { Button, AnimatedCheckbox } from '@/components/buttons'
import { useState } from 'react'

export interface DisclaimerDialogProps {
  visible: boolean
  onClose: (dontShowAgain: boolean) => void
}

/**
 * Disclaimer dialog that appears on app startup
 * Informs users that CreamLinux manages DLC IDs, not actual DLC files
 */
const DisclaimerDialog = ({ visible, onClose }: DisclaimerDialogProps) => {
  const [dontShowAgain, setDontShowAgain] = useState(false)

  const handleOkClick = () => {
    onClose(dontShowAgain)
  }

  return (
    <Dialog visible={visible} onClose={() => onClose(false)} size="medium" preventBackdropClose>
        <DialogHeader hideCloseButton={true}>
          <div className="disclaimer-header">
            <h3>Important Notice</h3>
          </div>
      </DialogHeader>

      <DialogBody>
        <div className="disclaimer-content">
          <p>
            <strong>CreamLinux Installer</strong> does not install any DLC content files.
          </p>
          <p>
            This application manages the <strong>DLC IDs</strong> associated with DLCs you want to
            use. You must obtain the actual DLC files separately.
          </p>
          <p>
            This tool only configures which DLC IDs are recognized by the game unlockers
            (CreamLinux and SmokeAPI).
          </p>
        </div>
      </DialogBody>

      <DialogFooter>
        <DialogActions>
          <div className="disclaimer-footer">
            <AnimatedCheckbox
              checked={dontShowAgain}
              onChange={() => setDontShowAgain(!dontShowAgain)}
              label="Don't show this disclaimer again"
            />
            <Button variant="primary" onClick={handleOkClick}>
              OK
            </Button>
          </div>
        </DialogActions>
      </DialogFooter>
    </Dialog>
  )
}

export default DisclaimerDialog