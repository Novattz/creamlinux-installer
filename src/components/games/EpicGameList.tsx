import { useMemo } from 'react'
import EpicGameItem from '@/components/games/EpicGameItem'
import { EpicGame } from '@/types/EpicGame'
import LoadingIndicator from '../common/LoadingIndicator'
import { Button } from '@/components/buttons'
import { Icon, refresh } from '@/components/icons'

interface EpicGameListProps {
  games: EpicGame[]
  isLoading: boolean
  installingId: string | null
  onInstall: (game: EpicGame) => void
  onUninstallScream: (game: EpicGame) => void
  onUninstallKoaloader: (game: EpicGame) => void
  onSettings: (game: EpicGame) => void
  onRefresh: () => void
}

const EpicGameList = ({
  games,
  isLoading,
  installingId,
  onInstall,
  onUninstallScream,
  onUninstallKoaloader,
  onSettings,
  onRefresh,
}: EpicGameListProps) => {
  const sortedGames = useMemo(
    () => [...games].sort((a, b) => a.title.localeCompare(b.title)),
    [games]
  )

  if (isLoading) {
    return (
      <div className="game-list">
        <LoadingIndicator type="spinner" size="large" message="Scanning for Epic games..." />
      </div>
    )
  }

  return (
    <div className="game-list">
      <div className="game-list-header">
        <h2>Epic Games ({games.length})</h2>
        <Button
          variant="secondary"
          size="medium"
          onClick={onRefresh}
          title="Refresh"
          className="refresh-button"
          leftIcon={<Icon name={refresh} variant="solid" size="md" />}
          iconOnly
        />
      </div>

      {games.length === 0 ? (
        <div className="no-games-message">
          No Epic games found. Make sure Heroic is installed and has games downloaded.
        </div>
      ) : (
        <div className="game-grid">
          {sortedGames.map((game) => (
            <EpicGameItem
              key={game.app_name}
              game={game}
              installing={installingId === game.app_name}
              onInstall={onInstall}
              onUninstallScream={onUninstallScream}
              onUninstallKoaloader={onUninstallKoaloader}
              onSettings={onSettings}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default EpicGameList