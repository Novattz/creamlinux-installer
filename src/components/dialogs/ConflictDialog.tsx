import React from 'react'
import {
  Dialog,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogActions,
} from '@/components/dialogs'
import { Button } from '@/components/buttons'
import { Icon, warning, info } from '@/components/icons'

export interface Conflict {
  gameId: string
  gameTitle: string
  type: 'cream-to-proton' | 'smoke-to-native'
}

export interface ConflictDialogProps {
  visible: boolean
  conflicts: Conflict[]
  onResolve: (gameId: string, conflictType: 'cream-to-proton' | 'smoke-to-native') => void
  onClose: () => void
}

/**
 * Conflict Dialog component
 * Shows all conflicts at once with individual resolve buttons
 */
const ConflictDialog: React.FC<ConflictDialogProps> = ({
  visible,
  conflicts,
  onResolve,
  onClose,
}) => {
  // Check if any CreamLinux conflicts exist
  const hasCreamConflicts = conflicts.some((c) => c.type === 'cream-to-proton')

  const getConflictDescription = (type: 'cream-to-proton' | 'smoke-to-native') => {
    if (type === 'cream-to-proton') {
      return 'Will remove existing unlocker files and restore the game to a clean state.'
    } else {
      return 'Will remove existing unlocker files and restore the game to a clean state.'
    }
  }

  return (
    <Dialog visible={visible} size="large" preventBackdropClose={true}>
      <DialogHeader hideCloseButton={true}>
        <div className="conflict-dialog-header">
          <Icon name={warning} variant="solid" size="lg" />
          <h3>Unlocker conflicts detected</h3>
        </div>
      </DialogHeader>

      <DialogBody>
        <div className="conflict-dialog-body">
          <p className="conflict-intro">
            Some games have conflicting unlocker states that need attention.
          </p>

          <div className="conflict-list">
            {conflicts.map((conflict) => (
              <div key={conflict.gameId} className="conflict-item">
                <div className="conflict-info">
                  <div className="conflict-icon">
                    <Icon name={warning} variant="solid" size="md" />
                  </div>
                  <div className="conflict-details">
                    <h4>{conflict.gameTitle}</h4>
                    <p>{getConflictDescription(conflict.type)}</p>
                  </div>
                </div>
                <Button
                  variant="primary"
                  onClick={() => onResolve(conflict.gameId, conflict.type)}
                  className="conflict-resolve-btn"
                >
                  Resolve
                </Button>
              </div>
            ))}
          </div>
        </div>
      </DialogBody>

      <DialogFooter>
        {hasCreamConflicts && (
          <div className="conflict-reminder">
            <Icon name={info} variant="solid" size="md" />
            <span>
              Remember to remove <code>sh ./cream.sh %command%</code> from Steam launch options
              after resolving CreamLinux conflicts.
            </span>
          </div>
        )}
        <DialogActions>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </DialogActions>
      </DialogFooter>
    </Dialog>
  )
}

export default ConflictDialog