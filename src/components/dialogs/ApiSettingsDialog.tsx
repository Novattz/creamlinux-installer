import { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import Dialog from './Dialog'
import DialogHeader from './DialogHeader'
import DialogBody from './DialogBody'
import DialogFooter from './DialogFooter'
import DialogActions from './DialogActions'
import { Button, AnimatedCheckbox } from '@/components/buttons'
import { Dropdown, DropdownOption } from '@/components/common'

export type ApiSettingsField =
  | {
      kind: 'dropdown'
      key: string
      label: string
      description: string
      options: DropdownOption<string>[]
    }
  | {
      kind: 'checkbox'
      key: string
      label: string
      sublabel: string
    }

export interface ApiSettingsSection {
  title: string
  fields: ApiSettingsField[]
}

/**
 * Describes an unlocker's config dialog: what sections/fields to render and
 * which Tauri commands read/write/delete its config file. One dialog
 * component renders any config that fits this shape, instead of a
 * near-identical component per unlocker.
 */
export interface ApiSettingsSpec {
  dialogTitle: string
  enableLabel: string
  enableSublabel: string
  defaultConfig: Record<string, unknown>
  sections: ApiSettingsSection[]
  readCommand: string
  writeCommand: string
  deleteCommand: string
}

export interface ApiSettingsDialogProps {
  visible: boolean
  onClose: () => void
  gamePath: string
  gameTitle: string
  spec: ApiSettingsSpec
}

/**
 * Generic settings dialog for an unlocker's config file (SmokeAPI,
 * ScreamAPI, ...). Renders whatever sections/fields the spec describes and
 * reads/writes/deletes the config through the spec's Tauri commands.
 */
const ApiSettingsDialog = ({ visible, onClose, gamePath, gameTitle, spec }: ApiSettingsDialogProps) => {
  const [enabled, setEnabled] = useState(false)
  const [config, setConfig] = useState<Record<string, unknown>>(spec.defaultConfig)
  const [isLoading, setIsLoading] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  const loadConfig = useCallback(async () => {
    setIsLoading(true)
    try {
      const existingConfig = await invoke<Record<string, unknown> | null>(spec.readCommand, {
        gamePath,
      })

      if (existingConfig) {
        setConfig(existingConfig)
        setEnabled(true)
      } else {
        setConfig(spec.defaultConfig)
        setEnabled(false)
      }
      setHasChanges(false)
    } catch (error) {
      console.error(`Failed to load ${spec.dialogTitle}:`, error)
      setConfig(spec.defaultConfig)
      setEnabled(false)
    } finally {
      setIsLoading(false)
    }
  }, [gamePath, spec])

  useEffect(() => {
    if (visible && gamePath) {
      loadConfig()
    }
  }, [visible, gamePath, loadConfig])

  const handleSave = async () => {
    setIsLoading(true)
    try {
      if (enabled) {
        await invoke(spec.writeCommand, { gamePath, config })
      } else {
        await invoke(spec.deleteCommand, { gamePath })
      }
      setHasChanges(false)
      onClose()
    } catch (error) {
      console.error(`Failed to save ${spec.dialogTitle}:`, error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    setHasChanges(false)
    onClose()
  }

  const updateConfig = (key: string, value: unknown) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
    setHasChanges(true)
  }

  return (
    <Dialog visible={visible} onClose={handleCancel} size="medium">
      <DialogHeader onClose={handleCancel} hideCloseButton={true}>
        <div className="settings-header">
          <h3>{spec.dialogTitle}</h3>
        </div>
        <p className="dialog-subtitle">{gameTitle}</p>
      </DialogHeader>

      <DialogBody>
        <div className="api-settings-content">
          <div className="settings-section">
            <AnimatedCheckbox
              checked={enabled}
              onChange={() => {
                setEnabled(!enabled)
                setHasChanges(true)
              }}
              label={spec.enableLabel}
              sublabel={spec.enableSublabel}
            />
          </div>

          <div className={`settings-options ${!enabled ? 'disabled' : ''}`}>
            {spec.sections.map((section) => (
              <div className="settings-section" key={section.title}>
                <h4>{section.title}</h4>

                {section.fields.map((field) =>
                  field.kind === 'dropdown' ? (
                    <Dropdown
                      key={field.key}
                      label={field.label}
                      description={field.description}
                      value={config[field.key] as string}
                      options={field.options}
                      onChange={(value) => updateConfig(field.key, value)}
                      disabled={!enabled}
                    />
                  ) : (
                    <div className="checkbox-option" key={field.key}>
                      <AnimatedCheckbox
                        checked={Boolean(config[field.key])}
                        onChange={() => updateConfig(field.key, !config[field.key])}
                        label={field.label}
                        sublabel={field.sublabel}
                      />
                    </div>
                  )
                )}
              </div>
            ))}
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

export default ApiSettingsDialog
