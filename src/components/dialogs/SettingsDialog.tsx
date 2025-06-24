import React from 'react'
import {
  Dialog,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogActions,
} from '@/components/dialogs'
import { Button } from '@/components/buttons'
import { Icon, settings } from '@/components/icons'

interface SettingsDialogProps {
  visible: boolean
  onClose: () => void
}

/**
 * Settings Dialog component
 * Contains application settings and configuration options
 */
const SettingsDialog: React.FC<SettingsDialogProps> = ({ visible, onClose }) => {
  return (
    <Dialog visible={visible} onClose={onClose} size="medium">
      <DialogHeader onClose={onClose} hideCloseButton={true}>
        <div className="settings-header">
          <Icon name={settings} variant="bold" size="md" />
          <h3>Settings</h3>
        </div>
      </DialogHeader>

      <DialogBody>
        <div className="settings-content">
          <div className="settings-section">
            <h4>General Settings</h4>
            <p className="settings-description">
              Configure your CreamLinux preferences and application behavior.
            </p>
            
            <div className="settings-placeholder">
              <div className="placeholder-icon"> <Icon name={settings} variant="bold" size="xl" /> </div>
              <div className="placeholder-text">
                <h5>Settings Coming Soon</h5>
                <p>
                  Working on adding customizable settings to improve your experience.
                  Future options may include:
                </p>
                <ul>
                  <li>Custom Steam library paths</li>
                  <li>Automatic update settings</li>
                  <li>Scan frequency options</li>
                  <li>DLC catalog</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="settings-section">
            <h4>About CreamLinux</h4>
            <div className="app-info">
              <div className="info-row">
                <span className="info-label">Version:</span>
                <span className="info-value">1.0.2</span>
              </div>
              <div className="info-row">
                <span className="info-label">Build:</span>
                <span className="info-value">Beta</span>
              </div>
              <div className="info-row">
                <span className="info-label">Repository:</span>
                <a 
                  href="https://github.com/Novattz/creamlinux-installer" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="info-link"
                >
                  GitHub
                </a>
              </div>
            </div>
          </div>
        </div>
      </DialogBody>

      <DialogFooter>
        <DialogActions>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </DialogActions>
      </DialogFooter>
    </Dialog>
  )
}

export default SettingsDialog