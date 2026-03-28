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

interface OptInDialogProps {
  visible: boolean
  onAccept: () => void
  onDecline: () => void
}

/**
 * First-launch opt-in dialog for the compatibility reporting system.
 * Shown once when the app fully starts. Does not close until the user makes
 * an explicit choice.
 */
const OptInDialog: React.FC<OptInDialogProps> = ({ visible, onAccept, onDecline }) => {
  return (
    <Dialog visible={visible} onClose={() => {}} size="medium">
      <DialogHeader onClose={() => {}} hideCloseButton={true}>
        <h3>Help improve CreamLinux</h3>
      </DialogHeader>

      <DialogBody>
        <div className="optin-content">

          <p className="optin-intro">
            CreamLinux can collect anonymous compatibility reports to help users know which
            games work with CreamLinux and SmokeAPI before they install them.
          </p>

          <div className="optin-details">
            <h4>What we collect</h4>
            <ul>
              <li>
                <strong>A one-way anonymous hash</strong> derived from your machine ID, Steam
                install path, and a locally-stored random salt. <em>This cannot be reversed
                to identify you</em>, and even we cannot link it to your machine.
              </li>
              <li>The Steam App ID of the game you rated.</li>
              <li>Which unlocker you used (CreamLinux or SmokeAPI).</li>
              <li>Whether it worked or not.</li>
            </ul>

            <h4>What we do not collect</h4>
            <ul>
              <li>Your username, IP address, or any personally identifiable information.</li>
            </ul>
          </div>

          <div className="optin-notice">
            <Icon name={info} variant="solid" size="md" />
            <span>
              If you opt out, the local salt will be deleted and no data will ever be sent.
              You will not be able to submit compatibility votes, but the app works fully
              without this feature.
            </span>
          </div>
        </div>
      </DialogBody>

      <DialogFooter>
        <DialogActions>
          <Button variant="secondary" onClick={onDecline}>
            No thanks
          </Button>
          <Button variant="primary" onClick={onAccept}>
            Enable reporting
          </Button>
        </DialogActions>
      </DialogFooter>
    </Dialog>
  )
}

export default OptInDialog