import Dialog from './Dialog'
import DialogHeader from './DialogHeader'
import DialogBody from './DialogBody'
import DialogFooter from './DialogFooter'
import DialogActions from './DialogActions'
import { Button, ButtonVariant } from '@/components/buttons'
import { Icon, info } from '@/components/icons'
import VotesDisplay, { GameVotes } from '@/components/common/VotesDisplay'

export interface UnlockerChoiceOption {
  key: string
  title: string
  badge: 'recommended' | 'alternative'
  description: string
  buttonLabel: string
  buttonVariant: ButtonVariant
  onSelect: () => void
  /** Omit entirely for unlockers that don't have community vote data (e.g. Epic's) */
  votes?: GameVotes | null
}

export interface UnlockerChoiceDialogProps {
  visible: boolean
  gameTitle: string | null
  onClose: () => void
  options: UnlockerChoiceOption[]
}

/**
 * Generic "choose which unlocker to install" dialog. Used for both the
 * Steam choice (CreamLinux vs SmokeAPI, with vote data) and the Epic choice
 * (ScreamAPI vs Koaloader, no votes) - they only differ in copy and options,
 * not in structure.
 */
const UnlockerChoiceDialog = ({ visible, gameTitle, onClose, options }: UnlockerChoiceDialogProps) => {
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
            {options.map((option) => (
              <div
                key={option.key}
                className={`unlocker-option ${option.badge === 'recommended' ? 'recommended' : ''}`}
              >
                <div className="option-header">
                  <h4>{option.title}</h4>
                  <span
                    className={
                      option.badge === 'recommended' ? 'recommended-badge' : 'alternative-badge'
                    }
                  >
                    {option.badge === 'recommended' ? 'Recommended' : 'Alternative'}
                  </span>
                </div>
                <p className="option-description">{option.description}</p>
                {option.votes !== undefined && <VotesDisplay votes={option.votes} />}
                <Button variant={option.buttonVariant} onClick={option.onSelect} fullWidth>
                  {option.buttonLabel}
                </Button>
              </div>
            ))}
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

export default UnlockerChoiceDialog
