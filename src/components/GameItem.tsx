// src/components/GameItem.tsx
import React, { useState, useEffect } from 'react';
import { findBestGameImage } from '../services/ImageService';
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

interface GameItemProps {
  game: Game;
  onAction: (gameId: string, action: ActionType) => Promise<void>;
  onEdit?: (gameId: string) => void;
}

const GameItem: React.FC<GameItemProps> = ({ game, onAction, onEdit }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    // Function to fetch the game cover/image
    const fetchGameImage = async () => {
      // First check if we already have it (to prevent flickering on re-renders)
      if (imageUrl) return;
      
      setIsLoading(true);
      try {
        // Try to find the best available image for this game
        const bestImageUrl = await findBestGameImage(game.id);
        
        if (bestImageUrl) {
          setImageUrl(bestImageUrl);
          setHasError(false);
        } else {
          setHasError(true);
        }
      } catch (error) {
        console.error('Error fetching game image:', error);
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    };

    if (game.id) {
      fetchGameImage();
    }
  }, [game.id, imageUrl]);

  // Determine if we should show CreamLinux buttons (only for native games)
  const shouldShowCream = game.native === true;
  
  // Determine if we should show SmokeAPI buttons (only for non-native games with API files)
  const shouldShowSmoke = !game.native && game.api_files && game.api_files.length > 0;
  
  // Check if this is a Proton game without API files
  const isProtonNoApi = !game.native && (!game.api_files || game.api_files.length === 0);

  const handleCreamAction = () => {
    if (game.installing) return;
    const action: ActionType = game.cream_installed ? 'uninstall_cream' : 'install_cream';
    onAction(game.id, action);
  };

  const handleSmokeAction = () => {
    if (game.installing) return;
    const action: ActionType = game.smoke_installed ? 'uninstall_smoke' : 'install_smoke';
    onAction(game.id, action);
  };
  
  // Handle edit button click
  const handleEdit = () => {
    if (onEdit && game.cream_installed) {
      onEdit(game.id);
    }
  };

  // Determine background image
  const backgroundImage = !isLoading && imageUrl ? 
    `url(${imageUrl})` : 
    hasError ? 'linear-gradient(135deg, #232323, #1A1A1A)' : 'linear-gradient(135deg, #232323, #1A1A1A)';

  return (
    <div 
      className="game-item-card" 
      style={{ 
        backgroundImage,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="game-item-overlay">
        <div className="game-badges">
          <span className={`status-badge ${game.native ? 'native' : 'proton'}`}>
            {game.native ? 'Native' : 'Proton'}
          </span>
          {game.cream_installed && (
            <span className="status-badge cream">CreamLinux</span>
          )}
          {game.smoke_installed && (
            <span className="status-badge smoke">SmokeAPI</span>
          )}
        </div>
        
        <div className="game-title">
          <h3>{game.title}</h3>
        </div>

        <div className="game-actions">
          {/* Show CreamLinux button only for native games */}
          {shouldShowCream && (
            <button 
              className={`action-button ${game.cream_installed ? 'uninstall' : 'install'}`}
              onClick={handleCreamAction}
              disabled={!!game.installing}
            >
              {game.installing ? "Working..." : (game.cream_installed ? "Uninstall CreamLinux" : "Install CreamLinux")}
            </button>
          )}

          {/* Show SmokeAPI button only for Proton/Windows games with API files */}
          {shouldShowSmoke && (
            <button 
              className={`action-button ${game.smoke_installed ? 'uninstall' : 'install'}`}
              onClick={handleSmokeAction}
              disabled={!!game.installing}
            >
              {game.installing ? "Working..." : (game.smoke_installed ? "Uninstall SmokeAPI" : "Install SmokeAPI")}
            </button>
          )}
          
          {/* Show message for Proton games without API files */}
          {isProtonNoApi && (
            <div className="api-not-found-message">
              <span>Steam API DLL not found</span>
              <button 
                className="rescan-button"
                onClick={() => onAction(game.id, 'install_smoke')}
                title="Attempt to scan again"
              >
                Rescan
              </button>
            </div>
          )}
          
          {/* Edit button - only enabled if CreamLinux is installed */}
          {game.cream_installed && (
            <button 
              className="edit-button"
              onClick={handleEdit}
              disabled={!game.cream_installed || !!game.installing}
              title="Manage DLCs"
            >
              Manage DLCs
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default GameItem;