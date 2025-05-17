// src/components/ImagePreloader.tsx
import React, { useEffect } from 'react';
import { findBestGameImage } from '../services/ImageService';

interface ImagePreloaderProps {
  gameIds: string[];
  onComplete?: () => void;
}

const ImagePreloader: React.FC<ImagePreloaderProps> = ({ gameIds, onComplete }) => {
  useEffect(() => {
    const preloadImages = async () => {
      try {
        // Only preload the first batch for performance (10 images max)
        const batchToPreload = gameIds.slice(0, 10);
        
        // Load images in parallel
        await Promise.allSettled(
          batchToPreload.map(id => findBestGameImage(id))
        );
        
        if (onComplete) {
          onComplete();
        }
      } catch (error) {
        console.error("Error preloading images:", error);
        // Continue even if there's an error
        if (onComplete) {
          onComplete();
        }
      }
    };
    
    if (gameIds.length > 0) {
      preloadImages();
    } else if (onComplete) {
      onComplete();
    }
  }, [gameIds, onComplete]);
  
  return (
    <div className="image-preloader">
      {/* Hidden element, just used for preloading */}
    </div>
  );
};

export default ImagePreloader;