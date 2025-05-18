import { useState, useEffect, useRef, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import './styles/main.scss'
import GameList from './components/GameList'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import ProgressDialog from './components/ProgressDialog'
import DlcSelectionDialog from './components/DlcSelectionDialog'
import AnimatedBackground from './components/AnimatedBackground'
import InitialLoadingScreen from './components/InitialLoadingScreen'
import { ActionType } from './components/ActionButton'

// Game interface
interface Game {
  id: string
  title: string
  path: string
  native: boolean
  platform?: string
  api_files: string[]
  cream_installed?: boolean
  smoke_installed?: boolean
  installing?: boolean
}

// Interface for installation instructions
interface InstructionInfo {
  type: string
  command: string
  game_title: string
  dlc_count?: number
}

// Interface for DLC information
interface DlcInfo {
  appid: string
  name: string
  enabled: boolean
}

function App() {
  const [games, setGames] = useState<Game[]>([])
  const [filter, setFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [scanProgress, setScanProgress] = useState({
    message: 'Initializing...',
    progress: 0,
  })
  const [error, setError] = useState<string | null>(null)
  const refreshInProgress = useRef(false)
  const [isFetchingDlcs, setIsFetchingDlcs] = useState(false)
  const dlcFetchController = useRef<AbortController | null>(null)
  const activeDlcFetchId = useRef<string | null>(null)

  // Progress dialog state
  const [progressDialog, setProgressDialog] = useState({
    visible: false,
    title: '',
    message: '',
    progress: 0,
    showInstructions: false,
    instructions: undefined as InstructionInfo | undefined,
  })

  // DLC selection dialog state
  const [dlcDialog, setDlcDialog] = useState({
    visible: false,
    gameId: '',
    gameTitle: '',
    dlcs: [] as DlcInfo[],
    enabledDlcs: [] as string[],
    isLoading: false,
    isEditMode: false,
    progress: 0,
    progressMessage: '',
    timeLeft: '',
    error: null as string | null,
  })

  // Handle search query changes
  const handleSearchChange = (query: string) => {
    setSearchQuery(query)
  }

  // LoadGames function outside of the useEffect to make it reusable
  const loadGames = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      console.log('Invoking scan_steam_games')
      const steamGames = await invoke<Game[]>('scan_steam_games').catch((err) => {
        console.error('Error from scan_steam_games:', err)
        throw err
      })

      // Platform property to match the GameList component's expectation
      const gamesWithPlatform = steamGames.map((game) => ({
        ...game,
        platform: 'Steam',
      }))

      console.log(`Loaded ${gamesWithPlatform.length} games`)
      setGames(gamesWithPlatform)
      setIsInitialLoad(false) // Mark initial load as complete
      return true
    } catch (error) {
      console.error('Error loading games:', error)
      setError(`Failed to load games: ${error}`)
      setIsInitialLoad(false) // Mark initial load as complete even on error
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    // Set up event listeners first
    const setupEventListeners = async () => {
      try {
        console.log('Setting up event listeners')

        // Listen for progress updates from the backend
        const unlistenProgress = await listen('installation-progress', (event) => {
          console.log('Received installation-progress event:', event)
        
          const { title, message, progress, complete, show_instructions, instructions } =
            event.payload as {
              title: string
              message: string
              progress: number
              complete: boolean
              show_instructions?: boolean
              instructions?: InstructionInfo
            }
        
          // Always update progress dialog
          setProgressDialog({
            visible: true, // Always set to visible - our ProgressDialog component handles exit animation
            title,
            message,
            progress,
            showInstructions: show_instructions || false,
            instructions,
          })
          
          // If complete and no instructions, we need to schedule a game list refresh
          // The dialog will auto-close with animation, but we still need to refresh the games
          if (complete && !show_instructions) {
            // Schedule a refresh for after the dialog closes
            if (!refreshInProgress.current) {
              refreshInProgress.current = true
              // Wait for dialog animation + close delay (about 1.2s total)
              setTimeout(() => {
                loadGames().then(() => {
                  refreshInProgress.current = false
                })
              }, 1300)
            }
          }
        })

        // Listen for scan progress events
        const unlistenScanProgress = await listen('scan-progress', (event) => {
          const { message, progress } = event.payload as {
            message: string
            progress: number
          }

          console.log('Received scan-progress event:', message, progress)

          // Update scan progress state
          setScanProgress({
            message,
            progress,
          })
        })

        // Listen for individual game updates
        const unlistenGameUpdated = await listen('game-updated', (event) => {
          console.log('Received game-updated event:', event)

          const updatedGame = event.payload as Game

          // Update only the specific game in the state
          setGames((prevGames) =>
            prevGames.map((game) =>
              game.id === updatedGame.id ? { ...updatedGame, platform: 'Steam' } : game
            )
          )
        })

        return () => {
          unlistenProgress()
          unlistenScanProgress()
          unlistenGameUpdated()
        }
      } catch (error) {
        console.error('Error setting up event listeners:', error)
        return () => {}
      }
    }

    // First set up event listeners, then load games
    let unlisten: (() => void) | null = null

    setupEventListeners()
      .then((unlistenFn) => {
        unlisten = unlistenFn
        return loadGames()
      })
      .catch((error) => {
        console.error('Failed to initialize:', error)
      })

    return () => {
      if (unlisten) {
        unlisten()
      }
    }
  }, [loadGames])

  // Debugging for state changes
  useEffect(() => {
    // Debug state changes
    if (games.length > 0) {
      // Count native and installed games
      const nativeCount = games.filter((g) => g.native).length
      const creamInstalledCount = games.filter((g) => g.cream_installed).length
      const smokeInstalledCount = games.filter((g) => g.smoke_installed).length

      console.log(
        `Game state updated: ${games.length} total games, ${nativeCount} native, ${creamInstalledCount} with CreamLinux, ${smokeInstalledCount} with SmokeAPI`
      )

      // Log any games with unexpected states
      const problematicGames = games.filter((g) => {
        // Native games that have SmokeAPI installed (shouldn't happen)
        if (g.native && g.smoke_installed) return true

        // Non-native games with CreamLinux installed (shouldn't happen)
        if (!g.native && g.cream_installed) return true

        // Non-native games without API files but with SmokeAPI installed (shouldn't happen)
        if (!g.native && (!g.api_files || g.api_files.length === 0) && g.smoke_installed)
          return true

        return false
      })

      if (problematicGames.length > 0) {
        console.warn('Found games with unexpected states:', problematicGames)
      }
    }
  }, [games])

  // Set up event listeners for DLC streaming
  useEffect(() => {
    // Listen for individual DLC found events
    const setupDlcEventListeners = async () => {
      try {
        // This event is emitted for each DLC as it's found
        const unlistenDlcFound = await listen('dlc-found', (event) => {
          const dlc = JSON.parse(event.payload as string) as { appid: string; name: string }

          // Add the DLC to the current list with enabled=true
          setDlcDialog((prev) => ({
            ...prev,
            dlcs: [...prev.dlcs, { ...dlc, enabled: true }],
          }))
        })

        // When progress is 100%, mark loading as complete and reset fetch state
        const unlistenDlcProgress = await listen('dlc-progress', (event) => {
          const { message, progress, timeLeft } = event.payload as {
            message: string
            progress: number
            timeLeft?: string
          }

          // Update the progress indicator
          setDlcDialog((prev) => ({
            ...prev,
            progress,
            progressMessage: message,
            timeLeft: timeLeft || '',
          }))

          // If progress is 100%, mark loading as complete
          if (progress === 100) {
            setTimeout(() => {
              setDlcDialog((prev) => ({
                ...prev,
                isLoading: false,
              }))

              // Reset fetch state
              setIsFetchingDlcs(false)
              activeDlcFetchId.current = null
            }, 500)
          }
        })

        // This event is emitted if there's an error
        const unlistenDlcError = await listen('dlc-error', (event) => {
          const { error } = event.payload as { error: string }
          console.error('DLC streaming error:', error)

          // Show error in dialog
          setDlcDialog((prev) => ({
            ...prev,
            error,
            isLoading: false,
          }))
        })

        return () => {
          unlistenDlcFound()
          unlistenDlcProgress()
          unlistenDlcError()
        }
      } catch (error) {
        console.error('Error setting up DLC event listeners:', error)
        return () => {}
      }
    }

    const unlisten = setupDlcEventListeners()
    return () => {
      unlisten.then((fn) => fn())
    }
  }, [])

  // Listen for scan progress events
  useEffect(() => {
    const listenToScanProgress = async () => {
      try {
        const unlistenScanProgress = await listen('scan-progress', (event) => {
          const { message, progress } = event.payload as {
            message: string
            progress: number
          }

          // Update loading message
          setProgressDialog((prev) => ({
            ...prev,
            visible: true,
            title: 'Scanning for Games',
            message,
            progress,
            showInstructions: false,
            instructions: undefined,
          }))

          // Auto-close when complete
          if (progress >= 100) {
            setTimeout(() => {
              setProgressDialog((prev) => ({ ...prev, visible: false }))
            }, 1500)
          }
        })

        return unlistenScanProgress
      } catch (error) {
        console.error('Error setting up scan progress listener:', error)
        return () => {}
      }
    }

    const unlistenPromise = listenToScanProgress()
    return () => {
      unlistenPromise.then((unlisten) => unlisten())
    }
  }, [])

  const handleCloseProgressDialog = () => {
    // Set dialog to not visible - animation is handled by the component
    setProgressDialog((prev) => ({ ...prev, visible: false }))
  
    // Only refresh if we need to (instructions didn't trigger update)
    if (
      progressDialog.showInstructions === false && 
      !progressDialog.title.includes("DLC") && 
      !progressDialog.title.includes("Updating") &&
      !progressDialog.title.includes("Update") &&
      !refreshInProgress.current
    ) {
      refreshInProgress.current = true;
      setTimeout(() => {
        loadGames().then(() => {
          refreshInProgress.current = false;
        });
      }, 100);
    }
  };

  // Function to fetch DLCs for a game with streaming updates
  const streamGameDlcs = async (gameId: string): Promise<void> => {
    try {
      // Set up flag to indicate we're fetching DLCs
      setIsFetchingDlcs(true)
      activeDlcFetchId.current = gameId

      // Start streaming DLCs - this won't return DLCs directly
      // Instead, it triggers events that we'll listen for
      await invoke('stream_game_dlcs', { gameId })

      return
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.log('DLC fetching was aborted')
      } else {
        console.error('Error starting DLC stream:', error)
        throw error
      }
    } finally {
      // Reset state when done or on error
      setIsFetchingDlcs(false)
      activeDlcFetchId.current = null
    }
  }

  // Clean up if component unmounts during a fetch
  useEffect(() => {
    return () => {
      // Clean up any ongoing fetch operations
      if (dlcFetchController.current) {
        dlcFetchController.current.abort()
        dlcFetchController.current = null
      }
    }
  }, [])

  // Handle game edit (show DLC management dialog)
  const handleGameEdit = async (gameId: string) => {
    const game = games.find((g) => g.id === gameId)
    if (!game || !game.cream_installed) return

    // Check if we're already fetching DLCs for this game
    if (isFetchingDlcs && activeDlcFetchId.current === gameId) {
      console.log(`Already fetching DLCs for ${gameId}, ignoring duplicate request`)
      return
    }

    try {
      // Show dialog immediately with empty DLC list
      setDlcDialog({
        visible: true,
        gameId,
        gameTitle: game.title,
        dlcs: [],
        enabledDlcs: [] as string[],
        isLoading: true,
        isEditMode: true,
        progress: 0,
        progressMessage: 'Reading DLC configuration...',
        timeLeft: '',
        error: null,
      })

      // Try to read all DLCs from the configuration file first (including disabled ones)
      try {
        const allDlcs = await invoke<DlcInfo[]>('get_all_dlcs_command', {
          gamePath: game.path,
        }).catch(() => [] as DlcInfo[])

        if (allDlcs.length > 0) {
          // If we have DLCs from the config file, use them
          console.log('Loaded existing DLC configuration:', allDlcs)

          setDlcDialog((prev) => ({
            ...prev,
            dlcs: allDlcs,
            isLoading: false,
            progress: 100,
            progressMessage: 'Loaded existing DLC configuration',
          }))
          return
        }
      } catch (error) {
        console.warn('Could not read existing DLC configuration, falling back to API:', error)
        // Continue with API loading if config reading fails
      }

      // Mark that we're fetching DLCs for this game
      setIsFetchingDlcs(true)
      activeDlcFetchId.current = gameId

      // Create abort controller for fetch operation
      dlcFetchController.current = new AbortController()

      // Start streaming DLCs
      await streamGameDlcs(gameId).catch((error) => {
        if (error.name !== 'AbortError') {
          console.error('Error streaming DLCs:', error)
          setDlcDialog((prev) => ({
            ...prev,
            error: `Failed to load DLCs: ${error}`,
            isLoading: false,
          }))
        }
      })

      // Try to get the enabled DLCs
      const enabledDlcs = await invoke<string[]>('get_enabled_dlcs_command', {
        gamePath: game.path,
      }).catch(() => [] as string[])

      // We'll update the enabled state of DLCs as they come in
      setDlcDialog((prev) => ({
        ...prev,
        enabledDlcs,
      }))
    } catch (error) {
      console.error('Error preparing DLC edit:', error)
      setDlcDialog((prev) => ({
        ...prev,
        error: `Failed to prepare DLC editor: ${error}`,
        isLoading: false,
      }))
    }
  }

  // Unified handler for all game actions (install/uninstall cream/smoke)
  const handleGameAction = async (gameId: string, action: ActionType) => {
    try {
      // Find game to get title
      const game = games.find((g) => g.id === gameId)
      if (!game) return

      // If we're installing CreamLinux, show DLC selection first
      if (action === 'install_cream') {
        try {
          // Show dialog immediately with empty DLC list and loading state
          setDlcDialog({
            visible: true,
            gameId,
            gameTitle: game.title,
            dlcs: [], // Start with an empty array
            enabledDlcs: [] as string[],
            isLoading: true,
            isEditMode: false,
            progress: 0,
            progressMessage: 'Fetching DLC list...',
            timeLeft: '',
            error: null,
          })

          // Start streaming DLCs - only once
          await streamGameDlcs(gameId).catch((error) => {
            console.error('Error streaming DLCs:', error)
            setDlcDialog((prev) => ({
              ...prev,
              error: `Failed to load DLCs: ${error}`,
              isLoading: false,
            }))
          })
        } catch (error) {
          console.error('Error fetching DLCs:', error)

          // If DLC fetching fails, close dialog and show error
          setDlcDialog((prev) => ({
            ...prev,
            visible: false,
            isLoading: false,
          }))

          setProgressDialog({
            visible: true,
            title: `Error fetching DLCs for ${game.title}`,
            message: `Failed to fetch DLCs: ${error}`,
            progress: 100,
            showInstructions: false,
            instructions: undefined,
          })

          setTimeout(() => {
            setProgressDialog((prev) => ({ ...prev, visible: false }))
          }, 3000)
        }
        return
      }

      // For other actions, proceed directly
      // Update local state to show installation in progress
      setGames((prevGames) =>
        prevGames.map((g) => (g.id === gameId ? { ...g, installing: true } : g))
      )

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
      const updatedGame = await invoke('process_game_action', {
        gameAction: {
          game_id: gameId,
          action,
        },
      }).catch((err) => {
        console.error(`Error from process_game_action:`, err)
        throw err
      })

      console.log('Game action completed, updated game:', updatedGame)

      // Update our local state with the result from the backend
      if (updatedGame) {
        setGames((prevGames) =>
          prevGames.map((g) => (g.id === gameId ? { ...g, installing: false } : g))
        )
      }
    } catch (error) {
      console.error(`Error processing action ${action} for game ${gameId}:`, error)

      // Show error in progress dialog
      setProgressDialog((prev) => ({
        ...prev,
        message: `Error: ${error}`,
        progress: 100,
      }))

      // Reset installing state
      setGames((prevGames) =>
        prevGames.map((game) => (game.id === gameId ? { ...game, installing: false } : game))
      )

      // Hide dialog after a delay
      setTimeout(() => {
        setProgressDialog((prev) => ({ ...prev, visible: false }))
      }, 3000)
    }
  }

  // Handle DLC selection dialog close
  const handleDlcDialogClose = () => {
    // Cancel any in-progress DLC fetching
    if (isFetchingDlcs && activeDlcFetchId.current) {
      console.log(`Aborting DLC fetch for game ${activeDlcFetchId.current}`)
  
      // This will signal to the Rust backend that we want to stop the process
      invoke('abort_dlc_fetch', { gameId: activeDlcFetchId.current }).catch((err) =>
        console.error('Error aborting DLC fetch:', err)
      )
  
      // Reset state
      activeDlcFetchId.current = null
      setIsFetchingDlcs(false)
    }
  
    // Clear controller
    if (dlcFetchController.current) {
      dlcFetchController.current.abort()
      dlcFetchController.current = null
    }
  
    // Close dialog - animation is handled in DlcSelectionDialog
    setDlcDialog((prev) => ({ ...prev, visible: false }))
  }

  // Handle DLC selection confirmation
  const handleDlcConfirm = async (selectedDlcs: DlcInfo[]) => {
    // The dialog has already started its exit animation
    setDlcDialog((prev) => ({ ...prev, visible: false }));
    
    const gameId = dlcDialog.gameId;
    const game = games.find((g) => g.id === gameId);
    if (!game) return;
    
    // Update local state to show installation in progress
    setGames((prevGames) =>
      prevGames.map((g) => (g.id === gameId ? { ...g, installing: true } : g))
    );
    
    try {
      if (dlcDialog.isEditMode) {
        // If in edit mode, we're updating existing cream_api.ini
        setProgressDialog({
          visible: true,
          title: `Updating DLCs for ${game.title}`,
          message: 'Updating DLC configuration...',
          progress: 30,
          showInstructions: false,
          instructions: undefined,
        });
        
        // Call the backend to update the DLC configuration
        await invoke('update_dlc_configuration_command', {
          gamePath: game.path,
          dlcs: selectedDlcs,
        });
        
        // Update progress dialog for completion
        setProgressDialog((prev) => ({
          ...prev,
          title: `Update Complete: ${game.title}`,
          message: 'DLC configuration updated successfully!',
          progress: 100,
        }));
        
        // Most importantly: directly update the local state instead of waiting for a full scan
        // This is what prevents the need for a full scan
        setTimeout(() => {
          // Reset installing state and update the game in the local state
          setGames((prevGames) =>
            prevGames.map((g) => (g.id === gameId ? { 
              ...g, 
              installing: false,
              // No other properties should need updating for a DLC config change
            } : g))
          );
        }, 2000);
      } else {
        // We're doing a fresh install with selected DLCs - original code unchanged
        setProgressDialog({
          visible: true,
          title: `Installing CreamLinux for ${game.title}`,
          message: 'Processing...',
          progress: 0,
          showInstructions: false,
          instructions: undefined,
        });
        
        await invoke('install_cream_with_dlcs_command', {
          gameId,
          selectedDlcs,
        }).catch((err) => {
          console.error(`Error installing CreamLinux with selected DLCs:`, err);
          throw err;
        });
      }
    } catch (error) {
      console.error('Error processing DLC selection:', error);
      
      // Show error in progress dialog
      setProgressDialog((prev) => ({
        ...prev,
        message: `Error: ${error}`,
        progress: 100,
      }));
      
      // Reset installing state
      setGames((prevGames) =>
        prevGames.map((g) => (g.id === gameId ? { ...g, installing: false } : g))
      );
    }
  };

  // Update DLCs being streamed with enabled state
  useEffect(() => {
    if (dlcDialog.enabledDlcs.length > 0) {
      setDlcDialog((prev) => ({
        ...prev,
        dlcs: prev.dlcs.map((dlc) => ({
          ...dlc,
          enabled: prev.enabledDlcs.length === 0 || prev.enabledDlcs.includes(dlc.appid),
        })),
      }))
    }
  }, [dlcDialog.dlcs, dlcDialog.enabledDlcs])

  // Filter games based on sidebar filter and search query
  const filteredGames = games.filter((game) => {
    // First filter by the platform/type
    const platformMatch =
      filter === 'all' ||
      (filter === 'native' && game.native) ||
      (filter === 'proton' && !game.native)

    // Then filter by search query (if any)
    const searchMatch =
      searchQuery.trim() === '' || game.title.toLowerCase().includes(searchQuery.toLowerCase())

    // Both filters must match
    return platformMatch && searchMatch
  })

  // Check if we should show the initial loading screen
  if (isInitialLoad) {
    return <InitialLoadingScreen message={scanProgress.message} progress={scanProgress.progress} />
  }

  return (
    <div className="app-container">
      {/* Animated background */}
      <AnimatedBackground />

      <Header onRefresh={loadGames} onSearch={handleSearchChange} searchQuery={searchQuery} />
      <div className="main-content">
        <Sidebar setFilter={setFilter} currentFilter={filter} />
        {error ? (
          <div className="error-message">
            <h3>Error Loading Games</h3>
            <p>{error}</p>
            <button onClick={loadGames}>Retry</button>
          </div>
        ) : (
          <GameList
            games={filteredGames}
            isLoading={isLoading}
            onAction={handleGameAction}
            onEdit={handleGameEdit}
          />
        )}
      </div>

      {/* Progress Dialog */}
      <ProgressDialog
        visible={progressDialog.visible}
        title={progressDialog.title}
        message={progressDialog.message}
        progress={progressDialog.progress}
        showInstructions={progressDialog.showInstructions}
        instructions={progressDialog.instructions}
        onClose={handleCloseProgressDialog}
      />

      {/* DLC Selection Dialog */}
      <DlcSelectionDialog
        visible={dlcDialog.visible}
        gameTitle={dlcDialog.gameTitle}
        dlcs={dlcDialog.dlcs}
        isLoading={dlcDialog.isLoading}
        isEditMode={dlcDialog.isEditMode}
        loadingProgress={dlcDialog.progress}
        estimatedTimeLeft={dlcDialog.timeLeft}
        onClose={handleDlcDialogClose}
        onConfirm={handleDlcConfirm}
      />
    </div>
  )
}

export default App
