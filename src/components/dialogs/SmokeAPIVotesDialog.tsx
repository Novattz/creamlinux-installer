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
import VotesDisplay, { GameVotes } from '@/components/common/VotesDisplay'

export interface SmokeAPIVotesDialogProps {
  visible: boolean
  gameId: string | null
  gameTitle: string | null
  onConfirm: () => void
  onClose: () => void
}

/**
 * Shown before installing SmokeAPI on a Proton game.
 * Fetches and displays community votes for SmokeAPI specifically,
 * then lets the user confirm or cancel the installation.
 */
const SmokeAPIVotesDialog: React.FC<SmokeAPIVotesDialogProps> = ({
  visible,
  gameId,
  gameTitle,
  onConfirm,
  onClose,
}) => {
  const [votes, setVotes] = useState<GameVotes | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!visible || !gameId) {
      setVotes(null)
      return
    }

    setLoading(true)
    invoke<GameVotes[]>('get_game_votes', { gameId })
      .then((results) => {
        setVotes(results.find((v) => v.unlocker === 'smokeapi') ?? null)
      })
      .catch(() => setVotes(null))
      .finally(() => setLoading(false))
  }, [visible, gameId])

  const hasVotes = votes && (votes.success > 0 || votes.fail > 0)

  return (
    <Dialog visible={visible} onClose={onClose} size="small">
      <DialogHeader onClose={onClose} hideCloseButton={true}>
        <h3>Install SmokeAPI</h3>
      </DialogHeader>

      <DialogBody>
        <div className="smokeapi-votes-content">
          <p className="smokeapi-votes-game">
            <strong>{gameTitle}</strong>
          </p>

          <div className="smokeapi-votes-section">
            <p className="smokeapi-votes-label">Community compatibility</p>
            {loading ? (
              <p className="smokeapi-votes-loading">Fetching votes...</p>
            ) : (
              <VotesDisplay votes={votes} />
            )}
          </div>

          {!loading && !hasVotes && (
            <div className="smokeapi-votes-notice">
              <Icon name={info} variant="solid" size="md" />
              <span>
                No one has rated this game yet. You'll be able to submit a rating after
                installing.
              </span>
            </div>
          )}

          {!loading && hasVotes && (
            <div className="smokeapi-votes-notice">
              <Icon name={info} variant="solid" size="sm" />
              <span>
                These ratings are from other CreamLinux users. Results may vary.
              </span>
            </div>
          )}
        </div>
      </DialogBody>

      <DialogFooter>
        <DialogActions>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onConfirm}>
            Install anyway
          </Button>
        </DialogActions>
      </DialogFooter>
    </Dialog>
  )
}

export default SmokeAPIVotesDialog