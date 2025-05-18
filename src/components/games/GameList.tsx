import { useState, useEffect, useMemo } from 'react'
import {GameItem, ImagePreloader} from '@/components/games'
import { ActionType } from '@/components/buttons'
import { Game } from '@/types'
import LoadingIndicator from '../common/LoadingIndicator'

interface GameListProps {
  games: Game[]
  isLoading: boolean
  onAction: (gameId: string, action: ActionType) => Promise<void>
  onEdit?: (gameId: string) => void
}

/**
 * Main game list component
 * Displays games in a grid with search and filtering applied
 */
const GameList = ({ games, isLoading, onAction, onEdit }: GameListProps) => {
  const [imagesPreloaded, setImagesPreloaded] = useState(false)

  // Sort games alphabetically by title 
  const sortedGames = useMemo(() => {
    return [...games].sort((a, b) => a.title.localeCompare(b.title))
  }, [games])

  // Reset preloaded state when games change
  useEffect(() => {
    setImagesPreloaded(false)
  }, [games])

  const handlePreloadComplete = () => {
    setImagesPreloaded(true)
  }

  if (isLoading) {
    return (
      <div className="game-list">
        <LoadingIndicator
          type="spinner"
          size="large"
          message="Scanning for games..."
        />
      </div>
    )
  }

  return (
    <div className="game-list">
      <h2>Games ({games.length})</h2>

      {!imagesPreloaded && games.length > 0 && (
        <ImagePreloader
          gameIds={sortedGames.map((game) => game.id)}
          onComplete={handlePreloadComplete}
        />
      )}

      {games.length === 0 ? (
        <div className="no-games-message">No games found</div>
      ) : (
        <div className="game-grid">
          {sortedGames.map((game) => (
            <GameItem key={game.id} game={game} onAction={onAction} onEdit={onEdit} />
          ))}
        </div>
      )}
    </div>
  )
}

export default GameList