import React from 'react'
import {
  Dialog,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogActions,
} from '@/components/dialogs'
import { Button } from '@/components/buttons'
import { Icon, warning } from '@/components/icons'

export interface ConflictDialogProps {
  visible: boolean
  gameTitle: string
  conflictType: 'cream-to-proton' | 'smoke-to-native'
  onConfirm: () => void
}

/**
 * Conflict Dialog component
 * Shows when incompatible unlocker files are detected after platform switch
 */
const ConflictDialog: React.FC<ConflictDialogProps> = ({
  visible,
  gameTitle,
  conflictType,
  onConfirm,
}) => {
  const getConflictMessage = () => {
    if (conflictType === 'cream-to-proton') {
      return {
        title: 'CreamLinux unlocker detected, but game is set to Proton',
        bodyPrefix: 'It looks like you previously installed CreamLinux while ',
        bodySuffix: ' was running natively. Steam is now configured to run it with Proton, so CreamLinux files will be removed automatically.',
      }
    } else {
      return {
        title: 'SmokeAPI unlocker detected, but game is set to Native',
        bodyPrefix: 'It looks like you previously installed SmokeAPI while ',
        bodySuffix: ' was running with Proton. Steam is now configured to run it natively, so SmokeAPI files will be removed automatically.',
      }
    }
  }

  const message = getConflictMessage()

  return (
    <Dialog visible={visible} size="large" preventBackdropClose={true}>
      <DialogHeader hideCloseButton={true}>
        <div className="conflict-dialog-header">
          <Icon name={warning} variant="solid" size="lg" />
          <h3>{message.title}</h3>
        </div>
      </DialogHeader>

      <DialogBody>
        <div className="conflict-dialog-body">
          <p>
            {message.bodyPrefix}
            <strong>{gameTitle}</strong>
            {message.bodySuffix}
          </p>
        </div>
      </DialogBody>

      <DialogFooter>
        <DialogActions>
          <Button variant="primary" onClick={onConfirm}>
            OK
          </Button>
        </DialogActions>
      </DialogFooter>
    </Dialog>
  )
}

export default ConflictDialog