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

export interface ReminderDialogProps {
  visible: boolean
  onClose: () => void
}

/**
 * Reminder Dialog component
 * Reminds users to remove Steam launch options after removing CreamLinux
 */
const ReminderDialog: React.FC<ReminderDialogProps> = ({ visible, onClose }) => {
  return (
    <Dialog visible={visible} onClose={onClose} size="small">
      <DialogHeader onClose={onClose} hideCloseButton={true}>
        <div className="reminder-dialog-header">
          <Icon name={info} variant="solid" size="lg" />
          <h3>Reminder</h3>
        </div>
      </DialogHeader>

      <DialogBody>
        <div className="reminder-dialog-body">
          <p>
            If you added a Steam launch option for CreamLinux, remember to remove it in Steam:
          </p>
          <ol className="reminder-steps">
            <li>Right-click the game in Steam</li>
            <li>Select "Properties"</li>
            <li>Go to "Launch Options"</li>
            <li>Remove the CreamLinux command</li>
          </ol>
        </div>
      </DialogBody>

      <DialogFooter>
        <DialogActions>
          <Button variant="primary" onClick={onClose}>
            Got it
          </Button>
        </DialogActions>
      </DialogFooter>
    </Dialog>
  )
}

export default ReminderDialog