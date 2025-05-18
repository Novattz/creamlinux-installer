import { useState, useCallback, useEffect } from 'react'
import { useAppContext } from '@/contexts/useAppContext'

interface UseAppLogicOptions {
  autoLoad?: boolean;
}

/**
 * Main application logic hook
 * Combines various aspects of the app's behavior
 */
export function useAppLogic(options: UseAppLogicOptions = {}) {
  const { autoLoad = true } = options
  
  // Get values from app context
  const { 
    games, 
    loadGames, 
    isLoading,
    error,
    showToast
  } = useAppContext()
  
  // Local state for filtering and UI
  const [filter, setFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [scanProgress, setScanProgress] = useState({ 
    message: 'Initializing...', 
    progress: 0 
  })

  // Filter games based on current filter and search
  const filteredGames = useCallback(() => {
    return games.filter((game) => {
      // First filter by platform type
      const platformMatch =
        filter === 'all' ||
        (filter === 'native' && game.native) ||
        (filter === 'proton' && !game.native)

      // Then filter by search query
      const searchMatch = !searchQuery.trim() || 
        game.title.toLowerCase().includes(searchQuery.toLowerCase())

      return platformMatch && searchMatch
    })
  }, [games, filter, searchQuery])

  // Handle search changes
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query)
  }, [])
  
  // Handle initial loading with simulated progress
  useEffect(() => {
    if (autoLoad && isInitialLoad) {
      const initialLoad = async () => {
        try {
          // Show scanning message
          setScanProgress({ message: 'Scanning for games...', progress: 20 })
          
          // Small delay to show loading screen
          await new Promise(resolve => setTimeout(resolve, 800))
          
          // Update progress
          setScanProgress({ message: 'Loading game information...', progress: 50 })
          
          // Load games data
          await loadGames()
          
          // Update progress
          setScanProgress({ message: 'Finishing up...', progress: 90 })
          
          // Small delay for animation
          await new Promise(resolve => setTimeout(resolve, 500))
          
          // Complete
          setScanProgress({ message: 'Ready!', progress: 100 })
          
          // Exit loading screen after a moment
          setTimeout(() => setIsInitialLoad(false), 500)
        } catch (error) {
          setScanProgress({ message: `Error: ${error}`, progress: 100 })
          showToast(`Failed to load: ${error}`, 'error')
          
          // Allow exit even on error
          setTimeout(() => setIsInitialLoad(false), 2000)
        }
      }
      
      initialLoad()
    }
  }, [autoLoad, isInitialLoad, loadGames, showToast])
  
  // Force a refresh
  const handleRefresh = useCallback(async () => {
    try {
      await loadGames()
      showToast('Game list refreshed', 'success')
    } catch (error) {
      showToast(`Failed to refresh: ${error}`, 'error')
    }
  }, [loadGames, showToast])

  return {
    filter,
    setFilter,
    searchQuery,
    handleSearchChange,
    isInitialLoad,
    setIsInitialLoad,
    scanProgress,
    filteredGames: filteredGames(),
    handleRefresh,
    isLoading,
    error
  }
}