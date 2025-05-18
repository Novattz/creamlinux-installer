import { useState, useCallback, useEffect, useRef } from 'react'
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
  const isInitializedRef = useRef(false)
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
    if (!autoLoad || !isInitialLoad || isInitializedRef.current) return
  
    isInitializedRef.current = true
    console.log("[APP LOGIC #2] Starting initialization")
  
    const initialLoad = async () => {
      try {
        setScanProgress({ message: 'Scanning for games...', progress: 20 })
        await new Promise(resolve => setTimeout(resolve, 800))
  
        setScanProgress({ message: 'Loading game information...', progress: 50 })
        await loadGames()
  
        setScanProgress({ message: 'Finishing up...', progress: 90 })
        await new Promise(resolve => setTimeout(resolve, 500))
  
        setScanProgress({ message: 'Ready!', progress: 100 })
        setTimeout(() => setIsInitialLoad(false), 500)
      } catch (error) {
        setScanProgress({ message: `Error: ${error}`, progress: 100 })
        showToast(`Failed to load: ${error}`, 'error')
        setTimeout(() => setIsInitialLoad(false), 2000)
      }
    }
  
    initialLoad()
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