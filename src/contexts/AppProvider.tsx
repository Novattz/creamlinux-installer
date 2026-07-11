import { ReactNode, useState, useEffect, useRef } from 'react'
import { AppContext, AppContextType, ActivityItem } from './AppContext'
import { useGames, useDlcManager, useGameActions, useToasts } from '@/hooks'
import { DlcInfo, Config, EpicGame, Game } from '@/types'
import { ActionType } from '@/components/buttons/ActionButton'
import { ToastContainer } from '@/components/notifications'
import { ApiSettingsDialog, smokeApiSettingsSpec, screamApiSettingsSpec, OptInDialog, RatingDialog, SmokeAPIVotesDialog, UnlockerChoiceDialog } from '@/components/dialogs'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

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
  const { games, isLoading, isInitialLoad, scanProgress, error, loadGames, setGames } = useGames()

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

  const [epicGames, setEpicGames] = useState<EpicGame[]>([])
  const [epicLoading, setEpicLoading] = useState(false)
  const [epicInstallingId, setEpicInstallingId] = useState<string | null>(null)
  const epicGamesRef = useRef<EpicGame[]>(epicGames)
  epicGamesRef.current = epicGames

  const [epicUnlockerDialog, setEpicUnlockerDialog] = useState<{
    visible: boolean
    game: EpicGame | null
  }>({ visible: false, game: null })

  const [screamSettingsDialog, setScreamSettingsDialog] = useState<{
    visible: boolean
    game: EpicGame | null
  }>({ visible: false, game: null })

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

  // SmokeAPI votes dialog state
  const [smokeAPIVotesDialog, setSmokeAPIVotesDialog] = useState<{
    visible: boolean
    gameId: string | null
    gameTitle: string | null
  }>({
    visible: false,
    gameId: null,
    gameTitle: null,
  })

  // Opt-in dialog state
  const [optInDialog, setOptInDialog] = useState(false)
  const [reportingEnabled, setReportingEnabled] = useState(false)

  // Recent activity feed (session-only) shown on the Overview page
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([])
  const pushActivity = (message: string, type: ActivityItem['type']) => {
    setActivityFeed((prev) =>
      [{ id: `${Date.now()}-${Math.random()}`, message, type, timestamp: Date.now() }, ...prev].slice(
        0,
        20
      )
    )
  }

  // Rating dialog state
  const [ratingDialog, setRatingDialog] = useState<{
    visible: boolean
    gameId: string
    gameTitle: string
    unlocker: 'creamlinux' | 'smokeapi'
    steamPath: string
  }>({
    visible: false,
    gameId: '',
    gameTitle: '',
    unlocker: 'creamlinux',
    steamPath: '',
  })

  useEffect(() => {
    invoke<Config>('load_config')
      .then((cfg) => {
        setReportingEnabled(cfg.reporting_opted_in)
        if (!cfg.reporting_has_seen_prompt) {
          setOptInDialog(true)
        }
      })
      .catch((err) => console.error('Failed to load config for reporting check:', err))
  }, [])

  useEffect(() => {
    let unlisten: (() => void) | undefined
    listen<EpicGame>('epic-game-updated', (event) => {
      const updated = event.payload
      // Read from the ref (not the epicGames closure) so this effect doesn't
      // need epicGames as a dependency. That would tear down and re-create
      // the Tauri listener on every single update instead of registering once.
      const prev = epicGamesRef.current.find((g) => g.app_name === updated.app_name)

      setEpicGames((games) =>
        games.map((g) => (g.app_name === updated.app_name ? updated : g))
      )
      setEpicInstallingId(null)

      // Determine what changed and show appropriate toast
      if (prev) {
        const installedScream = !prev.scream_installed && updated.scream_installed
        const uninstalledScream = prev.scream_installed && !updated.scream_installed
        const installedKoa = !prev.koaloader_installed && updated.koaloader_installed
        const uninstalledKoa = prev.koaloader_installed && !updated.koaloader_installed
      
        if (installedScream) {
          success(`ScreamAPI installed for ${updated.title}`)
          pushActivity(`Installed ScreamAPI for ${updated.title}`, 'install')
        } else if (uninstalledScream) {
          info(`ScreamAPI removed from ${updated.title}`)
          pushActivity(`Removed ScreamAPI from ${updated.title}`, 'uninstall')
        } else if (installedKoa) {
          success(`Koaloader installed for ${updated.title}`)
          pushActivity(`Installed Koaloader for ${updated.title}`, 'install')
        } else if (uninstalledKoa) {
          info(`Koaloader removed from ${updated.title}`)
          pushActivity(`Removed Koaloader from ${updated.title}`, 'uninstall')
        }
      
        if (updated.proxy_fallback_used) {
          warning(
            'No compatible proxy import found - installed using version.dll as a fallback. ' +
            'If the game has issues, try the direct ScreamAPI method instead.'
          )
        }
      }
    }).then((fn) => { unlisten = fn })
    return () => { unlisten?.() }
  }, [success, info, warning])

  const loadEpicGames = async () => {
    setEpicLoading(true)
    try {
      const games = await invoke<EpicGame[]>('scan_epic_games')
      setEpicGames(games)
    } catch (e) {
      showError(`Failed to scan Epic games: ${e}`)
    } finally {
      setEpicLoading(false)
    }
  }

  const runEpicAction = async (game: EpicGame, action: string) => {
    setEpicInstallingId(game.app_name)
    try {
      await invoke('process_epic_action', { epicAction: { game, action } })
      // state updated via epic-game-updated event listener
    } catch (e) {
      showError(`Action failed: ${e}`)
      setEpicInstallingId(null)
    }
  }

  const handleEpicInstall = (game: EpicGame) => {
    setEpicUnlockerDialog({ visible: true, game })
  }

  const handleEpicUninstallScream = (game: EpicGame) => runEpicAction(game, 'uninstall_scream')
  const handleEpicUninstallKoaloader = (game: EpicGame) => runEpicAction(game, 'uninstall_koaloader')

  const handleEpicSettings = (game: EpicGame) => {
    setScreamSettingsDialog({ visible: true, game })
  }

  const handleSelectScreamAPI = () => {
    const game = epicUnlockerDialog.game
    setEpicUnlockerDialog({ visible: false, game: null })
    if (game) runEpicAction(game, 'install_scream')
  }

  const handleSelectKoaloader = () => {
    const game = epicUnlockerDialog.game
    setEpicUnlockerDialog({ visible: false, game: null })
    if (game) runEpicAction(game, 'install_koaloader')
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

  const handleSmokeAPIVotesClose = () => {
    setSmokeAPIVotesDialog({ visible: false, gameId: null, gameTitle: null })
  }

  const handleSmokeAPIVotesConfirm = () => {
    const gameId = smokeAPIVotesDialog.gameId
    setSmokeAPIVotesDialog({ visible: false, gameId: null, gameTitle: null })
    const game = gameId ? games.find((g) => g.id === gameId) : undefined
    if (gameId && game) {
      // Now actually run the install this is what was silently skipping
      // the success toast and activity feed entry before, since it called
      // the raw action executor instead of the notifying wrapper.
      runGameAction(gameId, 'install_smoke', game)
    }
  }

  const handleOptInAccept = async () => {
    try {
      await invoke('set_reporting_opt_in', { optedIn: true })
      setReportingEnabled(true)
    } catch (err) {
      console.error('Failed to save reporting opt-in:', err)
    }
    setOptInDialog(false)
  }

  const handleOptInDecline = async () => {
    try {
      await invoke('set_reporting_opt_in', { optedIn: false })
      setReportingEnabled(false)
    } catch (err) {
      console.error('Failed to save reporting opt-out:', err)
    }
    setOptInDialog(false)
  }

  const handleOpenRating = (gameId: string) => {
    const game = games.find((g) => g.id === gameId)
    if (!game) return

    setRatingDialog({
      visible: true,
      gameId,
      gameTitle: game.title,
      unlocker: game.cream_installed ? 'creamlinux' : 'smokeapi',
      steamPath: game.path,
    })
  }

  const handleCloseRating = () => {
    setRatingDialog((prev) => ({ ...prev, visible: false }))
  }

  const handleSubmitRating = async (worked: boolean) => {
    try {
      await invoke('submit_report', {
        gameId: ratingDialog.gameId,
        unlocker: ratingDialog.unlocker,
        worked,
        steamPath: ratingDialog.steamPath,
      })
    } catch (err) {
      console.error('Failed to submit rating:', err)
    }
  }

  // Runs a game action and reports the result via toast + activity feed.
  // Used both by handleGameAction's own fallthrough case and by
  // handleSmokeAPIVotesConfirm, which needs to run the action *after* the
  // votes dialog closes without re-triggering handleGameAction's own
  // interception checks (which would just show that dialog again).
  const runGameAction = async (gameId: string, action: ActionType, game: Game) => {
    setGames((prevGames) =>
      prevGames.map((g) => (g.id === gameId ? { ...g, installing: true } : g))
    )

    try {
      await executeGameAction(gameId, action, games)

      const product = action.includes('cream') ? 'CreamLinux' : 'SmokeAPI'
      const isUninstall = action.includes('uninstall')
      const isInstall = action.includes('install') && !isUninstall

      if (isInstall) {
        success(`Successfully installed ${product} for ${game.title}`)
        pushActivity(`Installed ${product} for ${game.title}`, 'install')
      } else if (isUninstall) {
        info(`${product} uninstalled from ${game.title}`)
        pushActivity(`Uninstalled ${product} from ${game.title}`, 'uninstall')
      }
    } catch (error) {
      showError(`Action failed: ${error}`)
    } finally {
      setGames((prevGames) =>
        prevGames.map((g) => (g.id === gameId ? { ...g, installing: false } : g))
      )
    }
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

    // intercept install_smoke for votes dialog
    if (action === 'install_smoke' && !game.native) {
      setSmokeAPIVotesDialog({
        visible: true,
        gameId: game.id,
        gameTitle: game.title,
      })
      return
    }

    // For install_unlocker action, executeGameAction will handle showing the dialog
    // We should NOT show any notifications here - they'll be shown after actual installation
    if (action === 'install_unlocker') {
      // Mark game as installing while the user makes a selection
      setGames((prevGames) =>
        prevGames.map((g) => (g.id === gameId ? { ...g, installing: true } : g))
      )

      try {
        // This will show the UnlockerChoiceDialog and handle the callback
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
    await runGameAction(gameId, action, game)
  }

  // DLC confirmation wrapper
  const handleDlcConfirm = (selectedDlcs: DlcInfo[]) => {
    const { gameId, gameTitle, isEditMode } = dlcDialog

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
        pushActivity(
          isEditMode
            ? `Updated DLC configuration for ${gameTitle}`
            : `Installed CreamLinux for ${gameTitle}`,
          isEditMode ? 'update' : 'install'
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
    isInitialLoad,
    scanProgress,
    error,
    loadGames,

    // DLC management
    dlcDialog,
    handleGameEdit: (gameId: string) => {
      handleGameEdit(gameId, games)
    },
    handleDlcDialogClose: closeDlcDialog,
    handleUpdateDlcs: (gameId: string) => handleUpdateDlcs(gameId),

    // Epic games
    epicGames,
    epicLoading,
    epicInstallingId,
    loadEpicGames,
    handleEpicInstall,
    handleEpicUninstallScream,
    handleEpicUninstallKoaloader,
    handleEpicSettings,

    // Game actions
    progressDialog,
    handleGameAction,
    handleDlcConfirm,
    handleProgressDialogClose: handleCloseProgressDialog,

    // SmokeAPI Settings
    smokeAPISettingsDialog,
    handleSmokeAPISettingsOpen,
    handleSmokeAPISettingsClose,

    // SmokeAPI Votes
    smokeAPIVotesDialog,
    handleSmokeAPIVotesClose,
    handleSmokeAPIVotesConfirm,

    // Rating
    ratingDialog,
    handleOpenRating,
    handleCloseRating,
    handleSubmitRating,
    reportingEnabled,

    // Recent activity feed
    activityFeed,

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
      <ApiSettingsDialog
        visible={smokeAPISettingsDialog.visible}
        onClose={handleSmokeAPISettingsClose}
        gamePath={smokeAPISettingsDialog.gamePath}
        gameTitle={smokeAPISettingsDialog.gameTitle}
        spec={smokeApiSettingsSpec}
      />

      {/* Epic Unlocker Selection Dialog */}
      <UnlockerChoiceDialog
        visible={epicUnlockerDialog.visible}
        gameTitle={epicUnlockerDialog.game?.title ?? ''}
        onClose={() => setEpicUnlockerDialog({ visible: false, game: null })}
        options={[
          {
            key: 'scream',
            title: 'ScreamAPI',
            badge: 'recommended',
            description:
              'Replaces the EOS SDK DLL directly with ScreamAPI. Works for most Epic games and requires no additional files. DLC unlocking is automatic.',
            buttonLabel: 'Install ScreamAPI',
            buttonVariant: 'primary',
            onSelect: handleSelectScreamAPI,
          },
          {
            key: 'koaloader',
            title: 'Koaloader + ScreamAPI',
            badge: 'alternative',
            description:
              "Uses a proxy DLL to inject ScreamAPI without modifying the EOS SDK. Try this if the recommended method doesn't work for your game.",
            buttonLabel: 'Install Koaloader',
            buttonVariant: 'secondary',
            onSelect: handleSelectKoaloader,
          },
        ]}
      />

      {/* ScreamAPI Settings Dialog */}
      <ApiSettingsDialog
        visible={screamSettingsDialog.visible}
        onClose={() => setScreamSettingsDialog({ visible: false, game: null })}
        gamePath={screamSettingsDialog.game?.install_path ?? ''}
        gameTitle={screamSettingsDialog.game?.title ?? ''}
        spec={screamApiSettingsSpec}
      />

      {/* SmokeAPI Votes Dialog */}
      <SmokeAPIVotesDialog
        visible={smokeAPIVotesDialog.visible}
        gameId={smokeAPIVotesDialog.gameId}
        gameTitle={smokeAPIVotesDialog.gameTitle}
        onClose={handleSmokeAPIVotesClose}
        onConfirm={handleSmokeAPIVotesConfirm}
      />

      {/* Opt-in Dialog */}
      <OptInDialog
        visible={optInDialog}
        onAccept={handleOptInAccept}
        onDecline={handleOptInDecline}
      />

      {/* Rating Dialog */}
      <RatingDialog
        visible={ratingDialog.visible}
        gameId={ratingDialog.gameId}
        gameTitle={ratingDialog.gameTitle}
        unlocker={ratingDialog.unlocker}
        onClose={handleCloseRating}
        onSubmit={handleSubmitRating}
      />
    </AppContext.Provider>
  )
}