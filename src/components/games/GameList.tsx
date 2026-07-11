import { useState, useEffect, useMemo } from 'react'
import { GameItem, ImagePreloader } from '@/components/games'
import { ActionType, Button } from '@/components/buttons'
import { Icon, refresh } from '@/components/icons'
import { Game } from '@/types'
import LoadingIndicator from '../common/LoadingIndicator'

interface GameListProps {
  games: Game[]
  isLoading: boolean
  onAction: (gameId: string, action: ActionType) => Promise<void>
  onEdit?: (gameId: string) => void
  onSmokeAPISettings?: (gameId: string) => void
  onRate?: (gameId: string) => void
  onRefresh: () => void
  reportingEnabled?: boolean
}

/**
 * Main game list component
 * Displays games in a grid with search and filtering applied
 */
const GameList = ({ games, isLoading, onAction, onEdit, onSmokeAPISettings, onRate, onRefresh, reportingEnabled }: GameListProps) => {
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
        <LoadingIndicator type="spinner" size="large" message="Scanning for games..." />
      </div>
    )
  }

  return (
    <div className="game-list">
      <div className="game-list-header">
        <h2>Games ({games.length})</h2>
        <Button
          variant="secondary"
          size="medium"
          onClick={onRefresh}
          title="Refresh"
          className="refresh-button"
          leftIcon={<Icon name={refresh} className="icon-secondary" variant="solid" size="md" />}
          iconOnly
        />
      </div>

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
            <GameItem key={game.id} game={game} onAction={onAction} onEdit={onEdit} onSmokeAPISettings={onSmokeAPISettings} onRate={onRate} reportingEnabled={reportingEnabled} />
          ))}
        </div>
      )}
    </div>
  )
}

export default GameList
