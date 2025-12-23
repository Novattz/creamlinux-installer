import React, { useState, useEffect, useCallback } from 'react'
import Dialog from './Dialog'
import DialogHeader from './DialogHeader'
import DialogBody from './DialogBody'
import DialogFooter from './DialogFooter'
import DialogActions from './DialogActions'
import { Button, AnimatedCheckbox } from '@/components/buttons'
import { DlcInfo } from '@/types'
import { Icon, check } from '@/components/icons'

export interface DlcSelectionDialogProps {
  visible: boolean
  gameTitle: string
  gameId: string
  dlcs: DlcInfo[]
  onClose: () => void
  onConfirm: (selectedDlcs: DlcInfo[]) => void
  onUpdate?: (gameId: string) => void
  isLoading: boolean
  isEditMode?: boolean
  isUpdating?: boolean
  loadingProgress?: number
  estimatedTimeLeft?: string
  newDlcsCount?: number
}

/**
 * DLC Selection Dialog component
 * Allows users to select which DLCs they want to enable
 * Works for both initial installation and editing existing configurations
 */
const DlcSelectionDialog = ({
  visible,
  gameTitle,
  gameId,
  dlcs,
  onClose,
  onConfirm,
  onUpdate,
  isLoading,
  isEditMode = false,
  isUpdating = false,
  loadingProgress = 0,
  estimatedTimeLeft = '',
  newDlcsCount = 0,
}: DlcSelectionDialogProps) => {
  // State for DLC management
  const [selectedDlcs, setSelectedDlcs] = useState<DlcInfo[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectAll, setSelectAll] = useState(true)
  const [initialized, setInitialized] = useState(false)

  // Reset dialog state when it opens or closes
  useEffect(() => {
    if (!visible) {
      setInitialized(false)
      setSelectedDlcs([])
      setSearchQuery('')
    }
  }, [visible])

  // Initialize selected DLCs when DLC list changes
  useEffect(() => {
    if (dlcs.length > 0) {
      if (!initialized) {
        // Create a new array to ensure we don't share references
        setSelectedDlcs([...dlcs])

        // Determine initial selectAll state based on if all DLCs are enabled
        const allSelected = dlcs.every((dlc) => dlc.enabled)
        setSelectAll(allSelected)

        // Mark as initialized to avoid resetting selections on subsequent updates
        setInitialized(true)
      } else {
        // Find new DLCs that aren't in our current selection
        const currentAppIds = new Set(selectedDlcs.map((dlc) => dlc.appid))
        const newDlcs = dlcs.filter((dlc) => !currentAppIds.has(dlc.appid))

        // If we found new DLCs, add them to our selection
        if (newDlcs.length > 0) {
          setSelectedDlcs((prev) => [...prev, ...newDlcs])
        }
      }
    }
  }, [dlcs, selectedDlcs, initialized])

  // Memoize filtered DLCs to avoid unnecessary recalculations
  const filteredDlcs = React.useMemo(() => {
    return searchQuery.trim() === ''
      ? selectedDlcs
      : selectedDlcs.filter(
          (dlc) =>
            dlc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            dlc.appid.includes(searchQuery)
        )
  }, [selectedDlcs, searchQuery])

  // Update DLC selection status
  const handleToggleDlc = useCallback((appid: string) => {
    setSelectedDlcs((prev) =>
      prev.map((dlc) => (dlc.appid === appid ? { ...dlc, enabled: !dlc.enabled } : dlc))
    )
  }, [])

  // Update selectAll state when individual DLC selections change
  useEffect(() => {
    if (selectedDlcs.length > 0) {
      const allSelected = selectedDlcs.every((dlc) => dlc.enabled)
      setSelectAll(allSelected)
    }
  }, [selectedDlcs])

  // Toggle all DLCs at once
  const handleToggleSelectAll = useCallback(() => {
    const newSelectAllState = !selectAll
    setSelectAll(newSelectAllState)

    setSelectedDlcs((prev) =>
      prev.map((dlc) => ({
        ...dlc,
        enabled: newSelectAllState,
      }))
    )
  }, [selectAll])

  // Submit selected DLCs to parent component
  const handleConfirm = useCallback(() => {
    // Create a deep copy to prevent reference issues
    const dlcsCopy = JSON.parse(JSON.stringify(selectedDlcs))
    onConfirm(dlcsCopy)
  }, [onConfirm, selectedDlcs])

  // Count selected DLCs
  const selectedCount = selectedDlcs.filter((dlc) => dlc.enabled).length

  // Format dialog title and messages based on mode
  const dialogTitle = isEditMode ? 'Edit DLCs' : 'Select DLCs to Enable'
  const actionButtonText = isEditMode ? 'Save Changes' : 'Install with Selected DLCs'

  // Format loading message to show total number of DLCs found
  const getLoadingInfoText = () => {
    if (isLoading && loadingProgress < 100) {
      return ` (Loading more DLCs...)`
    } else if (dlcs.length > 0) {
      return ` (Total DLCs: ${dlcs.length})`
    }
    return ''
  }

  return (
    <Dialog visible={visible} onClose={onClose} size="large" preventBackdropClose={isLoading}>
      <DialogHeader onClose={onClose} hideCloseButton={true}>
        <h3>{dialogTitle}</h3>
        <div className="dlc-game-info">
          <span className="game-title">{gameTitle}</span>
          <span className="dlc-count">
            {selectedCount} of {selectedDlcs.length} DLCs selected
            {getLoadingInfoText()}
          </span>
        </div>
      </DialogHeader>

      <div className="dlc-dialog-search">
        <input
          type="text"
          placeholder="Search DLCs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="dlc-search-input"
        />
        <div className="select-all-container">
          <AnimatedCheckbox
            checked={selectAll}
            onChange={handleToggleSelectAll}
            label="Select All"
          />
        </div>
      </div>

      {(isLoading || isUpdating) && loadingProgress > 0 && (
        <div className="dlc-loading-progress">
          <div className="progress-bar-container">
            <div className="progress-bar" style={{ width: `${loadingProgress}%` }} />
          </div>
          <div className="loading-details">
            <span>{isUpdating ? 'Updating DLC list' : 'Loading DLCs'}: {loadingProgress}%</span>
            {estimatedTimeLeft && (
              <span className="time-left">Est. time left: {estimatedTimeLeft}</span>
            )}
          </div>
        </div>
      )}

      <DialogBody className="dlc-list-container">
        {selectedDlcs.length > 0 ? (
          <ul className="dlc-list">
            {filteredDlcs.map((dlc) => (
              <li key={dlc.appid} className="dlc-item">
                <AnimatedCheckbox
                  checked={dlc.enabled}
                  onChange={() => handleToggleDlc(dlc.appid)}
                  label={dlc.name}
                  sublabel={`ID: ${dlc.appid}`}
                />
              </li>
            ))}
            {isLoading && (
              <li className="dlc-item dlc-item-loading">
                <div className="loading-pulse"></div>
              </li>
            )}
          </ul>
        ) : (
          <div className="dlc-loading">
            <div className="loading-spinner"></div>
            <p>Loading DLC information...</p>
          </div>
        )}
      </DialogBody>

      <DialogFooter>
        {/* Show update results if we found new DLCs */}
        {newDlcsCount > 0 && !isUpdating && (
          <div className="dlc-update-results">
            <span className="update-success-message">
              <Icon name={check} size="sm" variant="solid" className="dlc-update-icon" /> Found {newDlcsCount} new DLC{newDlcsCount > 1 ? 's' : ''}!
            </span>
          </div>
        )}
        
        <DialogActions>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={(isLoading || isUpdating) && loadingProgress < 10}
          >
            Cancel
          </Button>
          
          {/* Update button - only show in edit mode */}
          {isEditMode && onUpdate && (
            <Button
              variant="warning"
              onClick={() => onUpdate(gameId)}
              disabled={isLoading || isUpdating}
            >
              {isUpdating ? 'Updating...' : 'Update DLC List'}
            </Button>
          )}
          
          <Button variant="primary" onClick={handleConfirm} disabled={isLoading || isUpdating}>
            {actionButtonText}
          </Button>
        </DialogActions>
      </DialogFooter>
    </Dialog>
  )
}

export default DlcSelectionDialog