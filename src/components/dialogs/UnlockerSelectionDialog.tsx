import React from 'react'
import {
  Dialog,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogActions,
} from '@/components/dialogs'
import { Button } from '@/components/buttons'
import { Icon, info } from '@/components/icons'

export interface UnlockerSelectionDialogProps {
  visible: boolean
  gameTitle: string
  onClose: () => void
  onSelectCreamLinux: () => void
  onSelectSmokeAPI: () => void
}

/**
 * Unlocker Selection Dialog component
 * Allows users to choose between CreamLinux and SmokeAPI for native Linux games
 */
const UnlockerSelectionDialog: React.FC<UnlockerSelectionDialogProps> = ({
  visible,
  gameTitle,
  onClose,
  onSelectCreamLinux,
  onSelectSmokeAPI,
}) => {
  return (
    <Dialog visible={visible} onClose={onClose} size="medium">
      <DialogHeader onClose={onClose} hideCloseButton={true}>
        <div className="unlocker-selection-header">
          <h3>Choose Unlocker</h3>
        </div>
      </DialogHeader>

      <DialogBody>
        <div className="unlocker-selection-content">
          <p className="game-title-info">
            Select which unlocker to install for <strong>{gameTitle}</strong>:
          </p>

          <div className="unlocker-options">
            <div className="unlocker-option recommended">
              <div className="option-header">
                <h4>CreamLinux</h4>
                <span className="recommended-badge">Recommended</span>
              </div>
              <p className="option-description">
                Native Linux DLC unlocker. Works best with most native Linux games and provides
                better compatibility.
              </p>
              <Button variant="primary" onClick={onSelectCreamLinux} fullWidth>
                Install CreamLinux
              </Button>
            </div>

            <div className="unlocker-option">
              <div className="option-header">
                <h4>SmokeAPI</h4>
                <span className="alternative-badge">Alternative</span>
              </div>
              <p className="option-description">
                Cross-platform DLC unlocker. Try this if CreamLinux doesn't work for your game.
                Automatically fetches DLC information.
              </p>
              <Button variant="secondary" onClick={onSelectSmokeAPI} fullWidth>
                Install SmokeAPI
              </Button>
            </div>
          </div>

          <div className="selection-info">
            <Icon name={info} variant="solid" size="md" />
            <span>
              You can always uninstall and try the other option if one doesn't work properly.
            </span>
          </div>
        </div>
      </DialogBody>

      <DialogFooter>
        <DialogActions>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </DialogActions>
      </DialogFooter>
    </Dialog>
  )
}

export default UnlockerSelectionDialog