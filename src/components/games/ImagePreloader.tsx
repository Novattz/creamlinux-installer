import { useEffect } from 'react'
import { findBestGameImage } from '@/services/ImageService'

interface ImagePreloaderProps {
  gameIds: string[]
  onComplete?: () => void
}

/**
 * Preloads game images to prevent flickering
 * Only used internally by GameList component
 */
const ImagePreloader = ({ gameIds, onComplete }: ImagePreloaderProps) => {
  useEffect(() => {
    const preloadImages = async () => {
      try {
        // Only preload the first batch for performance (10 images max)
        const batchToPreload = gameIds.slice(0, 10)

        // Track loading progress
        let loadedCount = 0
        const totalImages = batchToPreload.length

        // Load images in parallel
        await Promise.allSettled(
          batchToPreload.map(async (id) => {
            await findBestGameImage(id)
            loadedCount++

            // If all images are loaded, call onComplete
            if (loadedCount === totalImages && onComplete) {
              onComplete()
            }
          })
        )

        // Fallback if Promise.allSettled doesn't trigger onComplete
        if (onComplete) {
          onComplete()
        }
      } catch (error) {
        console.error('Error preloading images:', error)
        // Continue even if there's an error
        if (onComplete) {
          onComplete()
        }
      }
    }

    if (gameIds.length > 0) {
      preloadImages()
    } else if (onComplete) {
      onComplete()
    }
  }, [gameIds, onComplete])

  // Invisible component that just handles preloading
  return null
}

export default ImagePreloader
