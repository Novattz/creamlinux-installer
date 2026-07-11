import { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { EntryList } from '@/components/common'
import { AnimatedCheckbox, Button } from '@/components/buttons'
import { useAppContext } from '@/contexts/useAppContext'
import { Config } from '@/types/Config'

/**
 * Settings page - Steam library paths, the compatibility reporting toggle, and a danger
 * zone for resetting app data on disk.
 */
const SettingsPage = () => {
  const [libraryPaths, setLibraryPaths] = useState<string[]>([])
  const [reportingOptedIn, setReportingOptedIn] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [pathError, setPathError] = useState<string | null>(null)
  const [isResetting, setIsResetting] = useState(false)
  const [isClearingCache, setIsClearingCache] = useState(false)

  const { loadGames, showToast } = useAppContext()

  const loadSettingsConfig = useCallback(async () => {
    try {
      const config = await invoke<Config>('load_config')
      setLibraryPaths(config.custom_steam_paths)
      setReportingOptedIn(config.reporting_opted_in)
    } catch (error) {
      console.error('Failed to load config:', error)
    }
  }, [])

  useEffect(() => {
    loadSettingsConfig()
  }, [loadSettingsConfig])

  const addPath = async (path: string) => {
    setPathError(null)
    setIsBusy(true)
    try {
      const config = await invoke<Config>('add_custom_steam_path', { path })
      setLibraryPaths(config.custom_steam_paths)
      loadGames()
      showToast('Library path added - rescanning for games...', 'info')
    } catch (error) {
      setPathError(`${error}`)
    } finally {
      setIsBusy(false)
    }
  }

  const handleBrowse = async () => {
    setPathError(null)

    let selected: string | null
    try {
      selected = await open({ directory: true, multiple: false, title: 'Select Steam Library Folder' })
    } catch (error) {
      console.error('Failed to open folder picker:', error)
      return
    }
    if (!selected) return

    addPath(selected)
  }

  const handleRemovePath = async (path: string) => {
    setIsBusy(true)
    setPathError(null)
    try {
      const config = await invoke<Config>('remove_custom_steam_path', { path })
      setLibraryPaths(config.custom_steam_paths)
      loadGames()
      showToast('Library path removed - rescanning for games...', 'info')
    } catch (error) {
      setPathError(`${error}`)
    } finally {
      setIsBusy(false)
    }
  }

  const handleToggleReporting = async () => {
    const next = !reportingOptedIn
    setReportingOptedIn(next)
    try {
      await invoke('set_reporting_opt_in', { optedIn: next })
      showToast(
        next ? 'Compatibility reporting enabled' : 'Compatibility reporting disabled',
        'info'
      )
    } catch (error) {
      setReportingOptedIn(!next)
      showToast(`Failed to update reporting preference: ${error}`, 'error')
    }
  }

  const handleResetConfig = async () => {
    if (
      !window.confirm(
        'Reset all settings to their defaults? This clears your custom Steam library paths and reporting preference, and brings back the startup disclaimer.'
      )
    ) {
      return
    }

    setIsResetting(true)
    try {
      const config = await invoke<Config>('reset_config')
      setLibraryPaths(config.custom_steam_paths)
      setReportingOptedIn(config.reporting_opted_in)
      loadGames()
      showToast('Settings reset to defaults', 'success')
    } catch (error) {
      showToast(`Failed to reset settings: ${error}`, 'error')
    } finally {
      setIsResetting(false)
    }
  }

  const handleClearCache = async () => {
    if (
      !window.confirm(
        "Clear cached unlocker downloads? They'll be re-downloaded automatically the next time they're needed."
      )
    ) {
      return
    }

    setIsClearingCache(true)
    try {
      await invoke('clear_caches')
      showToast('Unlocker cache cleared', 'success')
    } catch (error) {
      showToast(`Failed to clear cache: ${error}`, 'error')
    } finally {
      setIsClearingCache(false)
    }
  }

  const handleOpenConfigFolder = async () => {
    try {
      await invoke('open_config_folder')
    } catch (error) {
      showToast(`Failed to open config folder: ${error}`, 'error')
    }
  }

  return (
    <div className="settings-page">
      <h2>Settings</h2>

      <div className="page-section">
        <h4>Steam Library Paths</h4>
        <p className="page-section-description">
          Add extra folders to scan for Steam games - useful if a library isn't auto-detected.
        </p>

        {pathError && <p className="entry-list-error">{pathError}</p>}

        <EntryList
          items={libraryPaths}
          onAddManual={addPath}
          onBrowse={handleBrowse}
          onRemove={handleRemovePath}
          placeholder="Type an absolute path and press Enter, or browse..."
          emptyLabel="No custom library paths added yet."
          disabled={isBusy}
        />
      </div>

      <div className="page-section">
        <h4>Compatibility Reporting</h4>
        <p className="page-section-description">
          Anonymously report whether an unlocker worked for a game, and see how it's worked for
          others before you install.
        </p>

        <AnimatedCheckbox
          checked={reportingOptedIn}
          onChange={handleToggleReporting}
          label="Enable compatibility reporting"
          sublabel="You can change this at any time"
        />
      </div>

      <div className="page-section danger-zone">
        <h4>Danger Zone</h4>
        <p className="page-section-description">
          These affect app data on disk - not your games or any unlockers already installed on
          them.
        </p>

        <div className="danger-zone-row">
          <div className="danger-zone-row-text">
            <span className="danger-zone-row-label">Reset all settings</span>
            <span className="danger-zone-row-description">
              Restores defaults, including custom library paths and the startup disclaimer.
            </span>
          </div>
          <Button variant="danger" size="small" onClick={handleResetConfig} disabled={isResetting}>
            {isResetting ? 'Resetting...' : 'Reset'}
          </Button>
        </div>

        <div className="danger-zone-row">
          <div className="danger-zone-row-text">
            <span className="danger-zone-row-label">Clear unlocker cache</span>
            <span className="danger-zone-row-description">
              Deletes downloaded CreamLinux/SmokeAPI/ScreamAPI/Koaloader files.
            </span>
          </div>
          <Button
            variant="secondary"
            size="small"
            onClick={handleClearCache}
            disabled={isClearingCache}
          >
            {isClearingCache ? 'Clearing...' : 'Clear'}
          </Button>
        </div>

        <div className="danger-zone-row">
          <div className="danger-zone-row-text">
            <span className="danger-zone-row-label">Open config folder</span>
            <span className="danger-zone-row-description">~/.config/creamlinux</span>
          </div>
          <Button variant="secondary" size="small" onClick={handleOpenConfigFolder}>
            Open
          </Button>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage
