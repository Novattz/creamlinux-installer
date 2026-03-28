import React, { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import {
  Dialog,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogActions,
} from '@/components/dialogs'
import { Button } from '@/components/buttons'
import { Icon, info } from '@/components/icons'

interface LocalReport {
  game_id: string
  unlocker: string
  worked: boolean
}

export interface RatingDialogProps {
  visible: boolean
  gameTitle: string
  gameId: string
  /** 'creamlinux' | 'smokeapi' – whichever is currently installed */
  unlocker: 'creamlinux' | 'smokeapi'
  onClose: () => void
  onSubmit: (worked: boolean) => Promise<void>
}

const UNLOCKER_LABELS: Record<string, string> = {
  creamlinux: 'CreamLinux',
  smokeapi: 'SmokeAPI',
}

/**
 * Per-game rating dialog. Submits exactly one report for the installed unlocker.
 */
const RatingDialog: React.FC<RatingDialogProps> = ({
  visible,
  gameTitle,
  gameId,
  unlocker,
  onClose,
  onSubmit,
}) => {
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  // Which vote the user has already cast for this game+unlocker, if any
  const [previousVote, setPreviousVote] = useState<boolean | null>(null)

  useEffect(() => {
    if (!visible) return

    // Reset submit state each time the dialog opens
    setSubmitted(false)

    // Load the local reports to see if this game+unlocker has already been started
    invoke<LocalReport[]>('get_local_reports')
      .then((reports) => {
        const existing = reports.find(
          (r) => r.game_id === gameId && r.unlocker === unlocker
        )
        setPreviousVote(existing ? existing.worked : null)
      })
      .catch(() => setPreviousVote(null))
  }, [visible, gameId, unlocker])

  const handleSubmit = async (worked: boolean) => {
    if (submitting || submitted) return
    setSubmitting(true)
    try {
      await onSubmit(worked)
      setSubmitted(true)
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setSubmitted(false)
    onClose()
  }

  const label = UNLOCKER_LABELS[unlocker] ?? unlocker

  // A button is "already chosen" if it matches the previous vote
  const workedAlreadyChosen = previousVote === true
  const brokenAlreadyChosen = previousVote === false

  return (
    <Dialog visible={visible} onClose={handleClose} size="small">
      <DialogHeader onClose={handleClose} hideCloseButton={true}>
        <h3>Submit rating</h3>
      </DialogHeader>

      <DialogBody>
        {submitted ? (
          <div className="rating-submitted">
            <p>Thanks for your report! Your vote helps other users.</p>
          </div>
        ) : (
          <div className="rating-content">
            <p>
              You have <strong>{label}</strong> installed for{' '}
              <strong>{gameTitle}</strong>. Did it work?
            </p>

            {previousVote !== null && (
              <p className="rating-subtext">
                You previously voted <strong>{previousVote ? 'worked' : "didn't work"}</strong>.
                You can change your vote below.
              </p>
            )}

            {previousVote === null && (
              <p className="rating-subtext">
                Your rating is anonymous and helps other users know if{' '}
                {label} works with this game.
              </p>
            )}

            <div className="rating-buttons">
              <Button
                variant="success"
                className={`rating-btn rating-btn--worked${workedAlreadyChosen ? ' rating-btn--active' : ''}`}
                onClick={() => handleSubmit(true)}
                disabled={submitting || workedAlreadyChosen}
                title={workedAlreadyChosen ? 'Already voted' : undefined}
                leftIcon={<Icon name="Check" variant="solid" size="sm" />}
              >
                It worked
              </Button>

              <Button
                variant="danger"
                className={`rating-btn rating-btn--broken${brokenAlreadyChosen ? ' rating-btn--active' : ''}`}
                onClick={() => handleSubmit(false)}
                disabled={submitting || brokenAlreadyChosen}
                title={brokenAlreadyChosen ? 'Already voted' : undefined}
                leftIcon={<Icon name="Close" variant="solid" size="sm" />}
              >
                Didn't work
              </Button>
            </div>

            <div className="rating-notice">
              <Icon name={info} variant="solid" size="md" />
              <span>Only the result for {label} will be submitted.</span>
            </div>
          </div>
        )}
      </DialogBody>

      <DialogFooter>
        <DialogActions>
          <Button variant="secondary" onClick={handleClose}>
            {submitted ? 'Close' : 'Cancel'}
          </Button>
        </DialogActions>
      </DialogFooter>
    </Dialog>
  )
}

export default RatingDialog