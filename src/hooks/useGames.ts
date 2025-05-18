import { useState, useCallback, useEffect } from 'react'
import { Game } from '@/types'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

/**
 * Hook for managing games state and operations
 * Handles game loading, scanning, and updates
 */
export function useGames() {
  const [games, setGames] = useState<Game[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [scanProgress, setScanProgress] = useState({
    message: 'Initializing...',
    progress: 0,
  })
  const [error, setError] = useState<string | null>(null)

  // LoadGames function outside of the useEffect to make it reusable
  const loadGames = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      console.log('Invoking scan_steam_games')
      const steamGames = await invoke<Game[]>('scan_steam_games')

      // Add platform property to match GameList component's expectation
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

  // Setup event listeners for game updates
  useEffect(() => {
    let unlisteners: (() => void)[] = []

    // Set up event listeners
    const setupEventListeners = async () => {
      try {
        console.log('Setting up game event listeners')

        // Listen for individual game updates
        const unlistenGameUpdated = await listen<Game>('game-updated', (event) => {
          console.log('Received game-updated event:', event)

          const updatedGame = event.payload

          // Update only the specific game in the state
          setGames((prevGames) =>
            prevGames.map((game) =>
              game.id === updatedGame.id 
                ? { ...updatedGame, platform: 'Steam' } 
                : game
            )
          )
        })

        // Listen for scan progress events
        const unlistenScanProgress = await listen<{
          message: string;
          progress: number;
        }>('scan-progress', (event) => {
          const { message, progress } = event.payload

          console.log('Received scan-progress event:', message, progress)

          // Update scan progress state
          setScanProgress({
            message,
            progress,
          })
        })

        unlisteners = [unlistenGameUpdated, unlistenScanProgress]
      } catch (error) {
        console.error('Error setting up event listeners:', error)
      }
    }

    // Initialize event listeners and then load games
    setupEventListeners().then(() => {
      if (isInitialLoad) {
        loadGames().catch(console.error)
      }
    })

    // Cleanup function
    return () => {
      unlisteners.forEach(fn => fn())
    }
  }, [loadGames, isInitialLoad])

  // Helper function to update a specific game in state
  const updateGame = useCallback((updatedGame: Game) => {
    setGames((prevGames) =>
      prevGames.map((game) => (game.id === updatedGame.id ? updatedGame : game))
    )
  }, [])

  return {
    games,
    isLoading,
    isInitialLoad,
    scanProgress,
    error,
    loadGames,
    updateGame,
    setGames,
  }
}