import { useState, useEffect, useCallback } from 'react'
import { Game } from '@/types'

export interface Conflict {
  gameId: string
  gameTitle: string
  type: 'cream-to-proton' | 'smoke-to-native'
}

export interface ConflictResolution {
  gameId: string
  removeFiles: boolean
  conflictType: 'cream-to-proton' | 'smoke-to-native'
}

/**
 * Hook for detecting platform conflicts
 * Identifies when unlocker files exist for the wrong platform
 */
export function useConflictDetection(games: Game[]) {
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [currentConflict, setCurrentConflict] = useState<Conflict | null>(null)
  const [showReminder, setShowReminder] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [resolvedConflicts, setResolvedConflicts] = useState<Set<string>>(new Set())

  // Detect conflicts whenever games change
  useEffect(() => {
    const detectedConflicts: Conflict[] = []

    games.forEach((game) => {
      // Skip if we've already resolved a conflict for this game
      if (resolvedConflicts.has(game.id)) {
        return
      }

      // Conflict 1: CreamLinux installed but game is now Proton
      if (!game.native && game.cream_installed) {
        detectedConflicts.push({
          gameId: game.id,
          gameTitle: game.title,
          type: 'cream-to-proton',
        })
      }

      // Conflict 2: SmokeAPI installed but game is now Native
      if (game.native && game.smoke_installed) {
        detectedConflicts.push({
          gameId: game.id,
          gameTitle: game.title,
          type: 'smoke-to-native',
        })
      }
    })

    setConflicts(detectedConflicts)

    // Show the first conflict if we have any and not currently processing
    if (detectedConflicts.length > 0 && !currentConflict && !isProcessing) {
      setCurrentConflict(detectedConflicts[0])
    }
  }, [games, currentConflict, isProcessing, resolvedConflicts])

  // Handle conflict resolution
  const resolveConflict = useCallback((): ConflictResolution | null => {
    if (!currentConflict || isProcessing) return null

    setIsProcessing(true)

    const resolution: ConflictResolution = {
      gameId: currentConflict.gameId,
      removeFiles: true, // Always remove files
      conflictType: currentConflict.type,
    }

    // Mark this game as resolved so we don't re-detect the conflict
    setResolvedConflicts((prev) => new Set(prev).add(currentConflict.gameId))

    // Remove this conflict from the list
    const remainingConflicts = conflicts.filter((c) => c.gameId !== currentConflict.gameId)
    setConflicts(remainingConflicts)

    // Close current conflict dialog immediately
    setCurrentConflict(null)

    // Determine what to show next based on conflict type
    if (resolution.conflictType === 'cream-to-proton') {
      // CreamLinux removal - show reminder after delay
      setTimeout(() => {
        setShowReminder(true)
        setIsProcessing(false)
      }, 100)
    } else {
      // SmokeAPI removal - no reminder, just show next conflict or finish
      setTimeout(() => {
        if (remainingConflicts.length > 0) {
          setCurrentConflict(remainingConflicts[0])
        }
        setIsProcessing(false)
      }, 100)
    }

    return resolution
  }, [currentConflict, conflicts, isProcessing])

  // Close reminder dialog
  const closeReminder = useCallback(() => {
    setShowReminder(false)
    
    // After closing reminder, check if there are more conflicts
    if (conflicts.length > 0) {
      setCurrentConflict(conflicts[0])
    }
  }, [conflicts])

  return {
    currentConflict,
    showReminder,
    resolveConflict,
    closeReminder,
    hasConflicts: conflicts.length > 0,
  }
}