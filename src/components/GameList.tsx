// src/components/GameList.tsx
import React, { useState, useEffect, useMemo } from 'react';
import GameItem from './GameItem';
import ImagePreloader from './ImagePreloader';
import { ActionType } from './ActionButton';

interface Game {
  id: string;
  title: string;
  path: string;
  platform?: string;
  native: boolean;
  api_files: string[];
  cream_installed?: boolean;
  smoke_installed?: boolean;
  installing?: boolean;
}

interface GameListProps {
  games: Game[];
  isLoading: boolean;
  onAction: (gameId: string, action: ActionType) => Promise<void>;
  onEdit?: (gameId: string) => void;
}

const GameList: React.FC<GameListProps> = ({ 
  games, 
  isLoading, 
  onAction,
  onEdit 
}) => {
  const [imagesPreloaded, setImagesPreloaded] = useState(false);
  
  // Sort games alphabetically by title - using useMemo to avoid re-sorting on each render
  const sortedGames = useMemo(() => {
    return [...games].sort((a, b) => a.title.localeCompare(b.title));
  }, [games]);
  
  // Reset preloaded state when games change
  useEffect(() => {
    setImagesPreloaded(false);
  }, [games]);

  // Debug log to help diagnose game states
  useEffect(() => {
    if (games.length > 0) {
      console.log("Games state in GameList:", games.length, "games");
    }
  }, [games]);
  
  if (isLoading) {
    return (
      <div className="game-list">
        <div className="loading-indicator">Scanning for games...</div>
      </div>
    );
  }

  const handlePreloadComplete = () => {
    setImagesPreloaded(true);
  };

  return (
    <div className="game-list">
      <h2>Games ({games.length})</h2>
      
      {!imagesPreloaded && games.length > 0 && (
        <ImagePreloader 
          gameIds={sortedGames.map(game => game.id)} 
          onComplete={handlePreloadComplete}
        />
      )}
      
      {games.length === 0 ? (
        <div className="no-games-message">No games found</div>
      ) : (
        <div className="game-grid">
          {sortedGames.map(game => (
            <GameItem 
              key={game.id} 
              game={game}
              onAction={onAction}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default GameList;