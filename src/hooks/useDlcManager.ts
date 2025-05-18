import { useState, useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { Game, DlcInfo } from '@/types'

export interface DlcDialogState {
  visible: boolean;
  gameId: string;
  gameTitle: string;
  dlcs: DlcInfo[];
  enabledDlcs: string[];
  isLoading: boolean;
  isEditMode: boolean;
  progress: number;
  progressMessage: string;
  timeLeft: string;
  error: string | null;
}

/**
 * Hook for managing DLC functionality
 * Handles fetching, filtering, and updating DLCs
 */
export function useDlcManager() {
  const [isFetchingDlcs, setIsFetchingDlcs] = useState(false)
  const dlcFetchController = useRef<AbortController | null>(null)
  const activeDlcFetchId = useRef<string | null>(null)
  const [forceReload, setForceReload] = useState(false) // Add this state to force reloads

  // DLC selection dialog state
  const [dlcDialog, setDlcDialog] = useState<DlcDialogState>({
    visible: false,
    gameId: '',
    gameTitle: '',
    dlcs: [],
    enabledDlcs: [],
    isLoading: false,
    isEditMode: false,
    progress: 0,
    progressMessage: '',
    timeLeft: '',
    error: null,
  })

  // Set up event listeners for DLC streaming
  useEffect(() => {
    // Listen for individual DLC found events
    const setupDlcEventListeners = async () => {
      try {
        // This event is emitted for each DLC as it's found
        const unlistenDlcFound = await listen<string>('dlc-found', (event) => {
          const dlc = JSON.parse(event.payload) as { appid: string; name: string }

          // Add the DLC to the current list with enabled=true by default
          setDlcDialog((prev) => ({
            ...prev,
            dlcs: [...prev.dlcs, { ...dlc, enabled: true }],
          }))
        })

        // When progress is 100%, mark loading as complete and reset fetch state
        const unlistenDlcProgress = await listen<{
          message: string;
          progress: number;
          timeLeft?: string;
        }>('dlc-progress', (event) => {
          const { message, progress, timeLeft } = event.payload

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
        const unlistenDlcError = await listen<{ error: string }>('dlc-error', (event) => {
          const { error } = event.payload
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

    const cleanup = setupDlcEventListeners()
    return () => {
      cleanup.then((fn) => fn())
    }
  }, [])

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

  // MODIFIED: Handle game edit (show DLC management dialog) with proper reloading
  const handleGameEdit = async (gameId: string, games: Game[]) => {
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
        dlcs: [], // Always start with empty DLCs to force a fresh load
        enabledDlcs: [],
        isLoading: true,
        isEditMode: true, // This is an edit operation
        progress: 0,
        progressMessage: 'Reading DLC configuration...',
        timeLeft: '',
        error: null,
      })

      // MODIFIED: Always get a fresh copy from the config file
      console.log('Loading DLC configuration from disk...')
      try {
        const allDlcs = await invoke<DlcInfo[]>('get_all_dlcs_command', {
          gamePath: game.path,
        }).catch((e) => {
          console.error('Error loading DLCs:', e)
          return [] as DlcInfo[]
        })

        if (allDlcs.length > 0) {
          // Log the fresh DLC config
          console.log('Loaded existing DLC configuration:', allDlcs)
          
          // IMPORTANT: Create a completely new array to avoid reference issues
          const freshDlcs = allDlcs.map(dlc => ({...dlc}))

          setDlcDialog((prev) => ({
            ...prev,
            dlcs: freshDlcs,
            isLoading: false,
            progress: 100,
            progressMessage: 'Loaded existing DLC configuration',
          }))
          
          // Reset force reload flag
          setForceReload(false)
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

  // MODIFIED: Handle DLC selection dialog close
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

    // Close dialog and reset state
    setDlcDialog((prev) => ({ 
      ...prev, 
      visible: false,
      dlcs: [], // Clear DLCs to force a reload next time
    }))
    
    // Set flag to force reload next time
    setForceReload(true)
  }

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

  return {
    dlcDialog,
    setDlcDialog,
    isFetchingDlcs,
    streamGameDlcs,
    handleGameEdit,
    handleDlcDialogClose,
    forceReload,
  }
}