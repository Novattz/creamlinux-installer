import { useState, useCallback, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { ActionType } from '@/components/buttons/ActionButton'
import { Game, DlcInfo } from '@/types'
import { InstallationInstructions } from '@/contexts/AppContext'

/**
 * Hook for managing game action operations
 * Handles installation, uninstallation, and progress tracking
 */
export function useGameActions() {
  // Progress dialog state
  const [progressDialog, setProgressDialog] = useState({
    visible: false,
    title: '',
    message: '',
    progress: 0,
    showInstructions: false,
    instructions: undefined as InstallationInstructions | undefined,
  })

  // Set up event listeners for progress updates
  useEffect(() => {
    const setupEventListeners = async () => {
      try {
        // Listen for progress updates from the backend
        const unlistenProgress = await listen<{
          title: string
          message: string
          progress: number
          complete: boolean
          show_instructions?: boolean
          instructions?: InstallationInstructions
        }>('installation-progress', (event) => {
          console.log('Received installation-progress event:', event)

          const { title, message, progress, complete, show_instructions, instructions } =
            event.payload

          if (complete && !show_instructions) {
            // Hide dialog when complete if no instructions
            setTimeout(() => {
              setProgressDialog((prev) => ({ ...prev, visible: false }))
            }, 1000)
          } else {
            // Update progress dialog
            setProgressDialog({
              visible: true,
              title,
              message,
              progress,
              showInstructions: show_instructions || false,
              instructions,
            })
          }
        })

        return unlistenProgress
      } catch (error) {
        console.error('Error setting up progress event listeners:', error)
        return () => {}
      }
    }

    let cleanup: (() => void) | null = null

    setupEventListeners().then((unlisten) => {
      cleanup = unlisten
    })

    return () => {
      if (cleanup) cleanup()
    }
  }, [])

  // Handler function to close progress dialog
  const handleCloseProgressDialog = useCallback(() => {
    setProgressDialog((prev) => ({ ...prev, visible: false }))
  }, [])

  // Unified handler for game actions (install/uninstall)
  const handleGameAction = useCallback(
    async (gameId: string, action: ActionType, games: Game[]) => {
      try {
        // For CreamLinux installation, we should NOT call process_game_action directly
        // Instead, we show the DLC selection dialog first, which is handled in AppProvider
        if (action === 'install_cream') {
          return
        }

        // For other actions (uninstall_cream, install_smoke, uninstall_smoke)
        // Find game to get title
        const game = games.find((g) => g.id === gameId)
        if (!game) return

        // Get title based on action
        const isCream = action.includes('cream')
        const isInstall = action.includes('install')
        const product = isCream ? 'CreamLinux' : 'SmokeAPI'
        const operation = isInstall ? 'Installing' : 'Uninstalling'

        // Show progress dialog
        setProgressDialog({
          visible: true,
          title: `${operation} ${product} for ${game.title}`,
          message: isInstall ? 'Downloading required files...' : 'Removing files...',
          progress: isInstall ? 0 : 30,
          showInstructions: false,
          instructions: undefined,
        })

        console.log(`Invoking process_game_action for game ${gameId} with action ${action}`)

        // Call the backend with the unified action
        await invoke('process_game_action', {
          gameAction: {
            game_id: gameId,
            action,
          },
        })
      } catch (error) {
        console.error(`Error processing action ${action} for game ${gameId}:`, error)

        // Show error in progress dialog
        setProgressDialog((prev) => ({
          ...prev,
          message: `Error: ${error}`,
          progress: 100,
        }))

        // Hide dialog after a delay
        setTimeout(() => {
          setProgressDialog((prev) => ({ ...prev, visible: false }))
        }, 3000)

        // Rethrow to allow upstream handling
        throw error
      }
    },
    []
  )

  // Handle DLC selection confirmation
  const handleDlcConfirm = useCallback(
    async (selectedDlcs: DlcInfo[], gameId: string, isEditMode: boolean, games: Game[]) => {
      // Find the game
      const game = games.find((g) => g.id === gameId)
      if (!game) return

      try {
        if (isEditMode) {
          // MODIFIED: Create a deep copy to ensure we don't have reference issues
          const dlcsCopy = selectedDlcs.map((dlc) => ({ ...dlc }))

          // Show progress dialog for editing
          setProgressDialog({
            visible: true,
            title: `Updating DLCs for ${game.title}`,
            message: 'Updating DLC configuration...',
            progress: 30,
            showInstructions: false,
            instructions: undefined,
          })

          console.log('Saving DLC configuration:', dlcsCopy)

          // Call the backend to update the DLC configuration
          await invoke('update_dlc_configuration_command', {
            gamePath: game.path,
            dlcs: dlcsCopy,
          })

          // Update progress dialog for completion
          setProgressDialog((prev) => ({
            ...prev,
            title: `Update Complete: ${game.title}`,
            message: 'DLC configuration updated successfully!',
            progress: 100,
          }))

          // Hide dialog after a delay
          setTimeout(() => {
            setProgressDialog((prev) => ({ ...prev, visible: false }))
          }, 2000)
        } else {
          // We're doing a fresh install with selected DLCs
          // Show progress dialog for installation right away
          setProgressDialog({
            visible: true,
            title: `Installing CreamLinux for ${game.title}`,
            message: 'Preparing to download CreamLinux...',
            progress: 0,
            showInstructions: false,
            instructions: undefined,
          })

          // Invoke the installation with the selected DLCs
          await invoke('install_cream_with_dlcs_command', {
            gameId,
            selectedDlcs,
          })

          // Note: The progress dialog will be updated through the installation-progress event listener
        }
      } catch (error) {
        console.error('Error processing DLC selection:', error)

        // Show error in progress dialog
        setProgressDialog((prev) => ({
          ...prev,
          message: `Error: ${error}`,
          progress: 100,
        }))

        // Hide dialog after a delay
        setTimeout(() => {
          setProgressDialog((prev) => ({ ...prev, visible: false }))
        }, 3000)

        // Rethrow to allow upstream handling
        throw error
      }
    },
    []
  )

  return {
    progressDialog,
    setProgressDialog,
    handleCloseProgressDialog,
    handleGameAction,
    handleDlcConfirm,
  }
}
