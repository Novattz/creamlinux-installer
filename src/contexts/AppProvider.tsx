import { ReactNode, useState } from 'react'
import { AppContext, AppContextType } from './AppContext'
import { useGames, useDlcManager, useGameActions, useToasts } from '@/hooks'
import { DlcInfo } from '@/types'
import { ActionType } from '@/components/buttons/ActionButton'
import { ToastContainer } from '@/components/notifications'
import { SmokeAPISettingsDialog } from '@/components/dialogs'

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
    handleUpdateDlcs,
  } = useDlcManager()

  const {
    progressDialog,
    handleCloseProgressDialog,
    handleGameAction: executeGameAction,
    handleDlcConfirm: executeDlcConfirm,
    unlockerSelectionDialog,
    closeUnlockerDialog,
  } = useGameActions()

  const { toasts, removeToast, success, error: showError, warning, info } = useToasts()

  // Settings dialog state
  const [settingsDialog, setSettingsDialog] = useState({ visible: false })

  // SmokeAPI settings dialog state
  const [smokeAPISettingsDialog, setSmokeAPISettingsDialog] = useState<{
    visible: boolean
    gamePath: string
    gameTitle: string
  }>({
    visible: false,
    gamePath: '',
    gameTitle: '',
  })

  // Settings handlers
  const handleSettingsOpen = () => {
    setSettingsDialog({ visible: true })
  }

  const handleSettingsClose = () => {
    setSettingsDialog({ visible: false })
  }

  // SmokeAPI settings handlers
  const handleSmokeAPISettingsOpen = (gameId: string) => {
    const game = games.find((g) => g.id === gameId)
    if (!game) {
      showError('Game not found')
      return
    }

    setSmokeAPISettingsDialog({
      visible: true,
      gamePath: game.path,
      gameTitle: game.title,
    })
  }

  const handleSmokeAPISettingsClose = () => {
    setSmokeAPISettingsDialog({
      visible: false,
      gamePath: '',
      gameTitle: '',
    })
  }

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

    // For install_unlocker action, executeGameAction will handle showing the dialog
    // We should NOT show any notifications here - they'll be shown after actual installation
    if (action === 'install_unlocker') {
      // Mark game as installing while the user makes a selection
      setGames((prevGames) =>
        prevGames.map((g) => (g.id === gameId ? { ...g, installing: true } : g))
      )

      try {
        // This will show the UnlockerSelectionDialog and handle the callback
        await executeGameAction(gameId, action, games)
      } catch (error) {
        showError(`Action failed: ${error}`)
      } finally {
        // Reset installing state
        setGames((prevGames) =>
          prevGames.map((g) => (g.id === gameId ? { ...g, installing: false } : g))
        )
      }
      return // Don't show any notifications for install_unlocker
    }

    // For other actions (uninstall cream, install/uninstall smoke)
    // Mark game as installing
    setGames((prevGames) =>
      prevGames.map((g) => (g.id === gameId ? { ...g, installing: true } : g))
    )

    try {
      await executeGameAction(gameId, action, games)

      // Show appropriate success message based on action type
      const product = action.includes('cream') ? 'CreamLinux' : 'SmokeAPI'
      const isUninstall = action.includes('uninstall')
      const isInstall = action.includes('install') && !isUninstall

      console.log('DEBUG: Action processed. Product:', product, 'isInstall:', isInstall, 'isUninstall:', isUninstall, 'action:', action)

      if (isInstall) {
        success(`Successfully installed ${product} for ${game.title}`)
      } else if (isUninstall) {
        info(`${product} uninstalled from ${game.title}`)
      } else {
        console.log('Unknown action type:', action)
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

    // Create a deep copy to ensure we don't have reference issues
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
    handleUpdateDlcs: (gameId: string) => handleUpdateDlcs(gameId),

    // Game actions
    progressDialog,
    handleGameAction,
    handleDlcConfirm,
    handleProgressDialogClose: handleCloseProgressDialog,

    // Settings
    settingsDialog,
    handleSettingsOpen,
    handleSettingsClose,

    // SmokeAPI Settings
    smokeAPISettingsDialog,
    handleSmokeAPISettingsOpen,
    handleSmokeAPISettingsClose,

    // Toast notifications
    showToast,

    // Unlocker selection - Pass wrapped handlers that also handle the installing state
    unlockerSelectionDialog,
    handleSelectCreamLinux: () => {
      // When CreamLinux is selected, trigger the DLC dialog flow
      const gameId = unlockerSelectionDialog.gameId
      if (gameId) {
        const game = games.find((g) => g.id === gameId)
        if (game) {

          closeUnlockerDialog()

          // Reset installing state before showing DLC dialog
          setGames((prevGames) =>
            prevGames.map((g) => (g.id === gameId ? { ...g, installing: false } : g))
          )
          // Show DLC selection dialog directly
          setDlcDialog({
            ...dlcDialog,
            visible: true,
            gameId,
            gameTitle: game.title,
            dlcs: [],
            isLoading: true,
            isEditMode: false,
            progress: 0,
          })

          streamGameDlcs(gameId)
        }
      }
    },
    handleSelectSmokeAPI: () => {
      // When SmokeAPI is selected, trigger the actual installation
      const gameId = unlockerSelectionDialog.gameId
      if (gameId) {
        const game = games.find((g) => g.id === gameId)
        if (game) {
          closeUnlockerDialog()

          setTimeout(() => {
            handleGameAction(gameId, 'install_smoke')
          }, 0)
        }
      }
    },
    closeUnlockerDialog,
  }

  return (
    <AppContext.Provider value={contextValue}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
      
      {/* SmokeAPI Settings Dialog */}
      <SmokeAPISettingsDialog
        visible={smokeAPISettingsDialog.visible}
        onClose={handleSmokeAPISettingsClose}
        gamePath={smokeAPISettingsDialog.gamePath}
        gameTitle={smokeAPISettingsDialog.gameTitle}
      />
    </AppContext.Provider>
  )
}