import { useEffect } from 'react'
import { check } from '@tauri-apps/plugin-updater'
import { useToasts } from '@/hooks'

/**
 * Hook that silently checks for updates and shows a toast notification if an update is available
 */
export function useUpdateChecker() {
  const { success, error } = useToasts()

  useEffect(() => {
    // Check for updates on component mount
    const checkForUpdates = async () => {
      try {
        // Check for updates
        const update = await check()
        
        // If update is available, show a toast notification
        if (update) {
          console.log(`Update available: ${update.version}`)
          success(`Update v${update.version} available! Check GitHub for details.`, {
            duration: 8000 // Show for 8 seconds
          })
        }
      } catch (err) {
        // Log error but don't show to user
        console.error('Update check failed:', err)
      }
    }

    // Small delay to avoid interfering with app startup
    const timer = setTimeout(() => {
      checkForUpdates()
    }, 3000)

    return () => clearTimeout(timer)
  }, [success, error])

  // This hook doesn't return anything
  return null
}

export default useUpdateChecker