import { ReactNode } from 'react'
import { AppContext, AppContextType } from './AppContext'
import { useGames, useDlcManager, useGameActions, useToasts } from '@/hooks'
import { DlcInfo } from '@/types'
import { ActionType } from '@/components/buttons/ActionButton'
import { ToastContainer } from '@/components/notifications'

// Context provider component
interface AppProviderProps {
  children: ReactNode
}

/**
 * Primary application context provider
 * Manages global state and provides methods for component interaction
 */
export const AppProvider = ({ children }: AppProviderProps) => {
  // Use our custom hooks
  const { games, isLoading, error, loadGames, setGames } = useGames()

  const {
    dlcDialog,
    setDlcDialog,
    handleDlcDialogClose: closeDlcDialog,
    streamGameDlcs,
    handleGameEdit,
  } = useDlcManager()

  const {
    progressDialog,
    handleCloseProgressDialog,
    handleGameAction: executeGameAction,
    handleDlcConfirm: executeDlcConfirm,
  } = useGameActions()

  const { toasts, removeToast, success, error: showError, warning, info } = useToasts()

  // Game action handler with proper error reporting
  const handleGameAction = async (gameId: string, action: ActionType) => {
    const game = games.find((g) => g.id === gameId)
    if (!game) {
      showError('Game not found')
      return
    }

    // For DLC installation, we want to show the DLC selection dialog first
    if (action === 'install_cream') {
      try {
        // Show DLC selection dialog
        setDlcDialog({
          ...dlcDialog,
          visible: true,
          gameId,
          gameTitle: game.title,
          dlcs: [], // Start with empty list
          isLoading: true,
          isEditMode: false, // This is a new installation
          progress: 0,
        })

        // Start streaming DLCs
        streamGameDlcs(gameId)
        return
      } catch (error) {
        showError(`Failed to prepare DLC installation: ${error}`)
        return
      }
    }

    // For other actions (uninstall cream, install/uninstall smoke)
    // Mark game as installing
    setGames((prevGames) =>
      prevGames.map((g) => (g.id === gameId ? { ...g, installing: true } : g))
    )

    try {
      await executeGameAction(gameId, action, games)

      // Show success message
      if (action.includes('install')) {
        success(
          `Successfully installed ${action.includes('cream') ? 'CreamLinux' : 'SmokeAPI'} for ${game.title}`
        )
      } else {
        success(
          `Successfully uninstalled ${action.includes('cream') ? 'CreamLinux' : 'SmokeAPI'} from ${game.title}`
        )
      }
    } catch (error) {
      showError(`Action failed: ${error}`)
    } finally {
      // Reset installing state
      setGames((prevGames) =>
        prevGames.map((g) => (g.id === gameId ? { ...g, installing: false } : g))
      )
    }
  }

  // DLC confirmation wrapper
  const handleDlcConfirm = (selectedDlcs: DlcInfo[]) => {
    const { gameId, isEditMode } = dlcDialog

    // MODIFIED: Create a deep copy to ensure we don't have reference issues
    const dlcsCopy = selectedDlcs.map((dlc) => ({ ...dlc }))

    // Log detailed info before closing dialog
    console.log(
      `Saving ${dlcsCopy.filter((d) => d.enabled).length} enabled and ${
        dlcsCopy.length - dlcsCopy.filter((d) => d.enabled).length
      } disabled DLCs`
    )

    // Close dialog FIRST to avoid UI state issues
    closeDlcDialog()

    // Update game state to show it's installing
    setGames((prevGames) =>
      prevGames.map((g) => (g.id === gameId ? { ...g, installing: true } : g))
    )

    executeDlcConfirm(dlcsCopy, gameId, isEditMode, games)
      .then(() => {
        success(
          isEditMode
            ? 'DLC configuration updated successfully'
            : 'CreamLinux installed with selected DLCs'
        )
      })
      .catch((error) => {
        showError(`DLC operation failed: ${error}`)
      })
      .finally(() => {
        // Reset installing state
        setGames((prevGames) =>
          prevGames.map((g) => (g.id === gameId ? { ...g, installing: false } : g))
        )
      })
  }

  // Generic toast show function
  const showToast = (
    message: string,
    type: 'success' | 'error' | 'warning' | 'info',
    options = {}
  ) => {
    switch (type) {
      case 'success':
        success(message, options)
        break
      case 'error':
        showError(message, options)
        break
      case 'warning':
        warning(message, options)
        break
      case 'info':
        info(message, options)
        break
    }
  }

  // Provide all the values to the context
  const contextValue: AppContextType = {
    // Game state
    games,
    isLoading,
    error,
    loadGames,

    // DLC management
    dlcDialog,
    handleGameEdit: (gameId: string) => {
      handleGameEdit(gameId, games)
    },
    handleDlcDialogClose: closeDlcDialog,

    // Game actions
    progressDialog,
    handleGameAction,
    handleDlcConfirm,
    handleProgressDialogClose: handleCloseProgressDialog,

    // Toast notifications
    showToast,
  }

  return (
    <AppContext.Provider value={contextValue}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </AppContext.Provider>
  )
}
