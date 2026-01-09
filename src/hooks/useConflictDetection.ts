import { useState, useEffect, useCallback } from 'react'
import { Game } from '@/types'

export interface Conflict {
  gameId: string
  gameTitle: string
  type: 'cream-to-proton' | 'smoke-to-native'
}

export interface ConflictResolution {
  gameId: string
  conflictType: 'cream-to-proton' | 'smoke-to-native'
}

/**
 * Hook for detecting platform conflicts
 * Identifies when unlocker files exist for the wrong platform
 */
export function useConflictDetection(games: Game[]) {
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [showDialog, setShowDialog] = useState(false)
  const [resolvedConflicts, setResolvedConflicts] = useState<Set<string>>(new Set())
  const [hasShownThisSession, setHasShownThisSession] = useState(false)

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

    // Show dialog only if:
    // 1. We have conflicts
    // 2. Dialog isn't already visible
    // 3. We haven't shown it this session
    if (detectedConflicts.length > 0 && !showDialog && !hasShownThisSession) {
      setShowDialog(true)
      setHasShownThisSession(true)
    }
  }, [games, resolvedConflicts, showDialog, hasShownThisSession])

  // Handle resolving a single conflict
  const resolveConflict = useCallback(
    (gameId: string, conflictType: 'cream-to-proton' | 'smoke-to-native'): ConflictResolution => {
      // Mark this game as resolved
      setResolvedConflicts((prev) => new Set(prev).add(gameId))

      // Remove from conflicts list
      setConflicts((prev) => prev.filter((c) => c.gameId !== gameId))

      return {
        gameId,
        conflictType,
      }
    },
    []
  )

  // Auto-close dialog when all conflicts are resolved
  useEffect(() => {
    if (conflicts.length === 0 && showDialog) {
      setShowDialog(false)
    }
  }, [conflicts.length, showDialog])

  // Handle dialog close
  const closeDialog = useCallback(() => {
    setShowDialog(false)
  }, [])

  return {
    conflicts,
    showDialog,
    resolveConflict,
    closeDialog,
    hasConflicts: conflicts.length > 0,
  }
}