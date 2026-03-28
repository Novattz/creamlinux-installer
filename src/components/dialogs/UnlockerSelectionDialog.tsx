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

export interface UnlockerSelectionDialogProps {
  visible: boolean
  gameId: string | null
  gameTitle: string | null
  onClose: () => void
  onSelectCreamLinux: () => void
  onSelectSmokeAPI: () => void
}

/**
 * Unlocker Selection Dialog component
 * Allows users to choose between CreamLinux and SmokeAPI for native Linux games.
 * Fetches and displays community vote data per unlocker.
 */
const UnlockerSelectionDialog: React.FC<UnlockerSelectionDialogProps> = ({
  visible,
  gameId,
  gameTitle,
  onClose,
  onSelectCreamLinux,
  onSelectSmokeAPI,
}) => {
  const [creamVotes, setCreamVotes] = useState<GameVotes | null>(null)
  const [smokeVotes, setSmokeVotes] = useState<GameVotes | null>(null)

  useEffect(() => {
    if (!visible || !gameId) {
      setCreamVotes(null)
      setSmokeVotes(null)
      return
    }

    invoke<GameVotes[]>('get_game_votes', { gameId })
      .then((results) => {
        setCreamVotes(results.find((v) => v.unlocker === 'creamlinux') ?? null)
        setSmokeVotes(results.find((v) => v.unlocker === 'smokeapi') ?? null)
      })
      .catch(() => {
        // Votes are non-critical — silently fall back to "No votes yet"
        setCreamVotes(null)
        setSmokeVotes(null)
      })
  }, [visible, gameId])

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
              <VotesDisplay votes={creamVotes} />
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
              <VotesDisplay votes={smokeVotes} />
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