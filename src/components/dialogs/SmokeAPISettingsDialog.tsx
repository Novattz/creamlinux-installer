import { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import {
  Dialog,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogActions,
} from '@/components/dialogs'
import { Button, AnimatedCheckbox } from '@/components/buttons'
import { Dropdown, DropdownOption } from '@/components/common'
//import { Icon, settings } from '@/components/icons'

interface SmokeAPIConfig {
  $schema: string
  $version: number
  logging: boolean
  log_steam_http: boolean
  default_app_status: 'unlocked' | 'locked' | 'original'
  override_app_status: Record<string, string>
  override_dlc_status: Record<string, string>
  auto_inject_inventory: boolean
  extra_inventory_items: number[]
  extra_dlcs: Record<string, unknown>
}

interface SmokeAPISettingsDialogProps {
  visible: boolean
  onClose: () => void
  gamePath: string
  gameTitle: string
}

const DEFAULT_CONFIG: SmokeAPIConfig = {
  $schema:
    'https://raw.githubusercontent.com/acidicoala/SmokeAPI/refs/tags/v4.0.0/res/SmokeAPI.schema.json',
  $version: 4,
  logging: false,
  log_steam_http: false,
  default_app_status: 'unlocked',
  override_app_status: {},
  override_dlc_status: {},
  auto_inject_inventory: true,
  extra_inventory_items: [],
  extra_dlcs: {},
}

const APP_STATUS_OPTIONS: DropdownOption<'unlocked' | 'locked' | 'original'>[] = [
  { value: 'unlocked', label: 'Unlocked' },
  { value: 'locked', label: 'Locked' },
  { value: 'original', label: 'Original' },
]

/**
 * SmokeAPI Settings Dialog
 * Allows configuration of SmokeAPI for a specific game
 */
const SmokeAPISettingsDialog = ({
  visible,
  onClose,
  gamePath,
  gameTitle,
}: SmokeAPISettingsDialogProps) => {
  const [enabled, setEnabled] = useState(false)
  const [config, setConfig] = useState<SmokeAPIConfig>(DEFAULT_CONFIG)
  const [isLoading, setIsLoading] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Load existing config when dialog opens
  const loadConfig = useCallback(async () => {
    setIsLoading(true)
    try {
      const existingConfig = await invoke<SmokeAPIConfig | null>('read_smokeapi_config', {
        gamePath,
      })

      if (existingConfig) {
        setConfig(existingConfig)
        setEnabled(true)
      } else {
        setConfig(DEFAULT_CONFIG)
        setEnabled(false)
      }
      setHasChanges(false)
    } catch (error) {
      console.error('Failed to load SmokeAPI config:', error)
      setConfig(DEFAULT_CONFIG)
      setEnabled(false)
    } finally {
      setIsLoading(false)
    }
  }, [gamePath])

  useEffect(() => {
    if (visible && gamePath) {
      loadConfig()
    }
  }, [visible, gamePath, loadConfig])

  const handleSave = async () => {
    setIsLoading(true)
    try {
      if (enabled) {
        // Save the config
        await invoke('write_smokeapi_config', {
          gamePath,
          config,
        })
      } else {
        // Delete the config
        await invoke('delete_smokeapi_config', {
          gamePath,
        })
      }
      setHasChanges(false)
      onClose()
    } catch (error) {
      console.error('Failed to save SmokeAPI config:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    setHasChanges(false)
    onClose()
  }

  const updateConfig = <K extends keyof SmokeAPIConfig>(key: K, value: SmokeAPIConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
    setHasChanges(true)
  }

  return (
    <Dialog visible={visible} onClose={handleCancel} size="medium">
      <DialogHeader onClose={handleCancel} hideCloseButton={true}>
        <div className="settings-header">
          {/*<Icon name={settings} variant="solid" size="md" />*/}
          <h3>SmokeAPI Settings</h3>
        </div>
        <p className="dialog-subtitle">{gameTitle}</p>
      </DialogHeader>

      <DialogBody>
        <div className="smokeapi-settings-content">
          {/* Enable/Disable Section */}
          <div className="settings-section">
            <AnimatedCheckbox
              checked={enabled}
              onChange={() => {
                setEnabled(!enabled)
                setHasChanges(true)
              }}
              label="Enable SmokeAPI Configuration"
              sublabel="Enable this to customize SmokeAPI settings for this game"
            />
          </div>

          {/* Settings Options */}
          <div className={`settings-options ${!enabled ? 'disabled' : ''}`}>
            <div className="settings-section">
              <h4>General Settings</h4>

              <Dropdown
                label="Default App Status"
                description="Specifies the default DLC status"
                value={config.default_app_status}
                options={APP_STATUS_OPTIONS}
                onChange={(value) => updateConfig('default_app_status', value)}
                disabled={!enabled}
              />
            </div>

            <div className="settings-section">
              <h4>Logging</h4>

              <div className="checkbox-option">
                <AnimatedCheckbox
                  checked={config.logging}
                  onChange={() => updateConfig('logging', !config.logging)}
                  label="Enable Logging"
                  sublabel="Enables logging to SmokeAPI.log.log file"
                />
              </div>

              <div className="checkbox-option">
                <AnimatedCheckbox
                  checked={config.log_steam_http}
                  onChange={() => updateConfig('log_steam_http', !config.log_steam_http)}
                  label="Log Steam HTTP"
                  sublabel="Toggles logging of SteamHTTP traffic"
                />
              </div>
            </div>

            <div className="settings-section">
              <h4>Inventory</h4>

              <div className="checkbox-option">
                <AnimatedCheckbox
                  checked={config.auto_inject_inventory}
                  onChange={() =>
                    updateConfig('auto_inject_inventory', !config.auto_inject_inventory)
                  }
                  label="Auto Inject Inventory"
                  sublabel="Automatically inject a list of all registered inventory items when the game queries user inventory"
                />
              </div>
            </div>
          </div>
        </div>
      </DialogBody>

      <DialogFooter>
        <DialogActions>
          <Button variant="secondary" onClick={handleCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={isLoading || !hasChanges}>
            {isLoading ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </DialogFooter>
    </Dialog>
  )
}

export default SmokeAPISettingsDialog