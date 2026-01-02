import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Config } from '@/types/Config'

/**
 * Hook to manage disclaimer dialog state
 * Loads config on mount and provides methods to update it
 */
export function useDisclaimer() {
  const [showDisclaimer, setShowDisclaimer] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Load config on mount
  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      const config = await invoke<Config>('load_config')
      setShowDisclaimer(config.show_disclaimer)
    } catch (error) {
      console.error('Failed to load config:', error)
      // Default to showing disclaimer if config load fails
      setShowDisclaimer(true)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDisclaimerClose = async (dontShowAgain: boolean) => {
    setShowDisclaimer(false)

    if (dontShowAgain) {
      try {
        // Load the current config first
        const currentConfig = await invoke<Config>('load_config')

        // Update the show_disclaimer field
        const updatedConfig: Config = {
          ...currentConfig,
          show_disclaimer: false,
        }

        // Save the updated config
        await invoke('update_config', { configData: updatedConfig })
      } catch (error) {
        console.error('Failed to update config:', error)
      }
    }
  }

  return {
    showDisclaimer,
    isLoading,
    handleDisclaimerClose,
  }
}