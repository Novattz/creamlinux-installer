import { useState, useCallback } from 'react'
import { Game } from '@/types'
import { ActionType } from '@/components/buttons'

export interface UnlockerSelectionState {
  visible: boolean
  gameId: string | null
  gameTitle: string | null
}

/**
 * Hook for managing unlocker selection on native games
 */
export function useUnlockerSelection() {
  const [selectionState, setSelectionState] = useState<UnlockerSelectionState>({
    visible: false,
    gameId: null,
    gameTitle: null,
  })

  // Store the callback to call when user makes a selection
  const [selectionCallback, setSelectionCallback] = useState<((action: ActionType) => void) | null>(
    null
  )

  // Show the dialog and store the callback
  const showUnlockerSelection = useCallback(
    (game: Game, callback: (action: ActionType) => void) => {
      setSelectionState({
        visible: true,
        gameId: game.id,
        gameTitle: game.title,
      })
      // Wrap in function to avoid stale closure
      setSelectionCallback(() => callback)
    },
    []
  )

  // User selected CreamLinux
  const handleSelectCreamLinux = useCallback(() => {
    setSelectionState({ visible: false, gameId: null, gameTitle: null })
    if (selectionCallback) {
      selectionCallback('install_cream')
    }
    setSelectionCallback(null)
  }, [selectionCallback])

  // User selected SmokeAPI
  const handleSelectSmokeAPI = useCallback(() => {
    setSelectionState({ visible: false, gameId: null, gameTitle: null })
    if (selectionCallback) {
      selectionCallback('install_smoke')
    }
    setSelectionCallback(null)
  }, [selectionCallback])

  // Close dialog without selection
  const closeDialog = useCallback(() => {
    setSelectionState({ visible: false, gameId: null, gameTitle: null })
    setSelectionCallback(null)
  }, [])

  return {
    selectionState,
    showUnlockerSelection,
    handleSelectCreamLinux,
    handleSelectSmokeAPI,
    closeDialog,
  }
}