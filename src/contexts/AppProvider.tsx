import { ReactNode } from 'react'
import { AppContext, AppContextType } from './AppContext'
import { useGames, useDlcManager, useGameActions, useToasts } from '@/hooks'
import { DlcInfo } from '@/types'
import { ActionType } from '@/components/buttons/ActionButton'
import { ToastContainer } from '@/components/notifications'

// Context provider component
interface AppProviderProps {
  children: ReactNode;
}

/**
 * Primary application context provider
 * Manages global state and provides methods for component interaction
 */
export const AppProvider = ({ children }: AppProviderProps) => {
  // Use our custom hooks
  const {
    games,
    isLoading,
    error,
    loadGames,
    setGames,
  } = useGames()

  const {
    dlcDialog,
    setDlcDialog,
    handleDlcDialogClose: closeDlcDialog,
    streamGameDlcs,
  } = useDlcManager()

  const {
    progressDialog,
    handleCloseProgressDialog,
    handleGameAction: executeGameAction,
    handleDlcConfirm: executeDlcConfirm,
  } = useGameActions()
  
  const {
    toasts,
    removeToast,
    success,
    error: showError,
    warning,
    info
  } = useToasts()

  // Combined handler for game edit
  const handleGameEdit = async (gameId: string) => {
    const game = games.find(g => g.id === gameId)
    if (!game || !game.cream_installed) {
      showError("Cannot edit game: not found or CreamLinux not installed")
      return
    }
    
    try {
      // Open the dialog
      setDlcDialog({
        ...dlcDialog,
        visible: true,
        gameId,
        gameTitle: game.title,
        isLoading: true,
        isEditMode: true,
        dlcs: [], // start empty
        progress: 0,
      })

      // Now fetch DLCs in the background
      streamGameDlcs(gameId)
    } catch (error) {
      showError(`Failed to load DLCs: ${error}`)
    }
  }
  
  // Enhanced game action handler with proper error reporting
  const handleGameAction = async (gameId: string, action: ActionType) => {
    const game = games.find(g => g.id === gameId)
    if (!game) {
      showError("Game not found")
      return
    }
    
    // Mark game as installing
    setGames(prevGames => 
      prevGames.map(g => g.id === gameId ? {...g, installing: true} : g)
    )
    
    try {
      await executeGameAction(gameId, action, games)
      
      // Show success message
      if (action.includes('install')) {
        success(`Successfully installed ${action.includes('cream') ? 'CreamLinux' : 'SmokeAPI'} for ${game.title}`)
      } else {
        success(`Successfully uninstalled ${action.includes('cream') ? 'CreamLinux' : 'SmokeAPI'} from ${game.title}`)
      }
    } catch (error) {
      showError(`Action failed: ${error}`)
    } finally {
      // Reset installing state
      setGames(prevGames => 
        prevGames.map(g => g.id === gameId ? {...g, installing: false} : g)
      )
    }
  }
  
  // DLC confirmation wrapper
  const handleDlcConfirm = (selectedDlcs: DlcInfo[]) => {
    closeDlcDialog()
    const { gameId, isEditMode } = dlcDialog
    
    // Update game state to show it's installing
    setGames(prevGames =>
      prevGames.map(g => g.id === gameId ? { ...g, installing: true } : g)
    )
    
    executeDlcConfirm(selectedDlcs, gameId, isEditMode, games)
      .then(() => {
        success(isEditMode 
          ? "DLC configuration updated successfully" 
          : "CreamLinux installed with selected DLCs")
      })
      .catch(error => {
        showError(`DLC operation failed: ${error}`)
      })
      .finally(() => {
        // Reset installing state
        setGames(prevGames =>
          prevGames.map(g => g.id === gameId ? { ...g, installing: false } : g)
        )
      })
  }
  
  // Generic toast show function
  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info', options = {}) => {
    switch (type) {
      case 'success': success(message, options); break;
      case 'error': showError(message, options); break;
      case 'warning': warning(message, options); break;
      case 'info': info(message, options); break;
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
    handleGameEdit,
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