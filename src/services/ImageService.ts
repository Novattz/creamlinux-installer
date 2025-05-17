/**
 * Game image sources from Steam's CDN
 */
export const SteamImageType = {
  HEADER: 'header', // 460x215
  CAPSULE: 'capsule_616x353', // 616x353
  LOGO: 'logo', // Game logo with transparency
  LIBRARY_HERO: 'library_hero', // 1920x620
  LIBRARY_CAPSULE: 'library_600x900', // 600x900
} as const

export type SteamImageTypeKey = keyof typeof SteamImageType

// Cache for images to prevent flickering
const imageCache: Map<string, string> = new Map()

/**
 * Builds a Steam CDN URL for game images
 * @param appId Steam application ID
 * @param type Image type from SteamImageType enum
 * @returns URL string for the image
 */
export const getSteamImageUrl = (
  appId: string,
  type: (typeof SteamImageType)[SteamImageTypeKey]
) => {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/${type}.jpg`
}

/**
 * Checks if an image exists by performing a HEAD request
 * @param url Image URL to check
 * @returns Promise resolving to a boolean indicating if the image exists
 */
export const checkImageExists = async (url: string): Promise<boolean> => {
  try {
    const response = await fetch(url, { method: 'HEAD' })
    return response.ok
  } catch (error) {
    console.error('Error checking image existence:', error)
    return false
  }
}

/**
 * Preloads an image for faster rendering
 * @param url URL of image to preload
 * @returns Promise that resolves when image is loaded
 */
const preloadImage = (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(url)
    img.onerror = reject
    img.src = url
  })
}

/**
 * Attempts to find a valid image for a Steam game, trying different image types
 * @param appId Steam application ID
 * @returns Promise resolving to a valid image URL or null if none found
 */
export const findBestGameImage = async (appId: string): Promise<string | null> => {
  // Check cache first
  if (imageCache.has(appId)) {
    return imageCache.get(appId) || null
  }

  // Try these image types in order of preference
  const typesToTry = [SteamImageType.HEADER, SteamImageType.CAPSULE, SteamImageType.LIBRARY_CAPSULE]

  for (const type of typesToTry) {
    const url = getSteamImageUrl(appId, type)
    const exists = await checkImageExists(url)
    if (exists) {
      try {
        // Preload the image to prevent flickering
        const preloadedUrl = await preloadImage(url)
        // Store in cache
        imageCache.set(appId, preloadedUrl)
        return preloadedUrl
      } catch {
        // If preloading fails, just return the URL
        imageCache.set(appId, url)
        return url
      }
    }
  }

  // If we've reached here, no valid image was found
  return null
}
