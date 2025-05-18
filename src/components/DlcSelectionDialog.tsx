import React, { useState, useEffect, useMemo } from 'react'
import AnimatedCheckbox from './AnimatedCheckbox'

interface DlcInfo {
  appid: string
  name: string
  enabled: boolean
}

interface DlcSelectionDialogProps {
  visible: boolean
  gameTitle: string
  dlcs: DlcInfo[]
  onClose: () => void
  onConfirm: (selectedDlcs: DlcInfo[]) => void
  isLoading: boolean
  isEditMode?: boolean
  loadingProgress?: number
  estimatedTimeLeft?: string
}

const DlcSelectionDialog: React.FC<DlcSelectionDialogProps> = ({
  visible,
  gameTitle,
  dlcs,
  onClose,
  onConfirm,
  isLoading,
  isEditMode = false,
  loadingProgress = 0,
  estimatedTimeLeft = '',
}) => {
  const [selectedDlcs, setSelectedDlcs] = useState<DlcInfo[]>([])
  // Use a simple string for animation state - keep it simple
  const [animationState, setAnimationState] = useState('closed')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectAll, setSelectAll] = useState(true)
  const [initialized, setInitialized] = useState(false)
  // Track previous visibility to detect changes
  const [prevVisible, setPrevVisible] = useState(false)

  // Initialize selected DLCs when DLC list changes
  useEffect(() => {
    if (visible && dlcs.length > 0 && !initialized) {
      setSelectedDlcs(dlcs)

      // Determine initial selectAll state based on if all DLCs are enabled
      const allSelected = dlcs.every((dlc) => dlc.enabled)
      setSelectAll(allSelected)

      // Mark as initialized so we don't reset selections on subsequent DLC additions
      setInitialized(true)
    }
  }, [visible, dlcs, initialized])

  // Handle animations on visibility changes
  useEffect(() => {
    // Only respond to actual changes in visibility
    if (visible !== prevVisible) {
      if (visible) {
        // Show animation
        setAnimationState('visible')
      } else {
        // Hide animation - but only if we're currently visible
        if (animationState === 'visible') {
          setAnimationState('hiding')
          // After animation completes, set to closed
          const timer = setTimeout(() => {
            setAnimationState('closed')
            // Also reset initialization when fully closed
            if (!visible) {
              setInitialized(false)
            }
          }, 200) // Match animation duration
          
          return () => clearTimeout(timer)
        }
      }
      // Update previous visibility
      setPrevVisible(visible)
    }
  }, [visible, prevVisible, animationState])

  // Memoize filtered DLCs to avoid unnecessary recalculations
  const filteredDlcs = useMemo(() => {
    return searchQuery.trim() === ''
      ? selectedDlcs
      : selectedDlcs.filter(
          (dlc) =>
            dlc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            dlc.appid.includes(searchQuery)
        )
  }, [selectedDlcs, searchQuery])

  // Update DLC selection status
  const handleToggleDlc = (appid: string) => {
    setSelectedDlcs((prev) =>
      prev.map((dlc) => (dlc.appid === appid ? { ...dlc, enabled: !dlc.enabled } : dlc))
    )
  }

  // Update selectAll state when individual DLC selections change
  useEffect(() => {
    const allSelected = selectedDlcs.every((dlc) => dlc.enabled)
    setSelectAll(allSelected)
  }, [selectedDlcs])

  // Handle new DLCs being added while dialog is already open
  useEffect(() => {
    if (initialized && dlcs.length > selectedDlcs.length) {
      // Find new DLCs that aren't in our current selection
      const currentAppIds = new Set(selectedDlcs.map((dlc) => dlc.appid))
      const newDlcs = dlcs.filter((dlc) => !currentAppIds.has(dlc.appid))

      // Add new DLCs to our selection, maintaining their enabled state
      if (newDlcs.length > 0) {
        setSelectedDlcs((prev) => [...prev, ...newDlcs])
      }
    }
  }, [dlcs, selectedDlcs, initialized])

  const handleToggleSelectAll = () => {
    const newSelectAllState = !selectAll
    setSelectAll(newSelectAllState)

    setSelectedDlcs((prev) =>
      prev.map((dlc) => ({
        ...dlc,
        enabled: newSelectAllState,
      }))
    )
  }

  const handleConfirm = () => {
    // Just call onConfirm directly
    onConfirm(selectedDlcs)
  }

  // Handle overlay click
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Prevent clicks from propagating through the overlay
    e.stopPropagation()

    // Only allow closing via overlay click if not loading
    if (e.target === e.currentTarget && !isLoading) {
      onClose()
    }
  }

  // Handle the close button click
  const handleClose = () => {
    onClose()
  }

  // Count selected DLCs
  const selectedCount = selectedDlcs.filter((dlc) => dlc.enabled).length

  // Format loading message to show total number of DLCs found
  const getLoadingInfoText = () => {
    if (isLoading && loadingProgress < 100) {
      return ` (Loading more DLCs...)`
    } else if (dlcs.length > 0) {
      return ` (Total DLCs: ${dlcs.length})`
    }
    return ''
  }

  // Don't render anything if we're in closed state
  if (animationState === 'closed') return null

  // Generate appropriate classes based on animation state
  const dialogClasses = `dlc-dialog-overlay ${animationState === 'hiding' ? 'exiting' : 'visible'}`
  const contentClasses = `dlc-selection-dialog dialog-${animationState === 'hiding' ? 'exiting' : 'visible'}`

  return (
    <div
      className={dialogClasses}
      onClick={handleOverlayClick}
    >
      <div className={contentClasses}>
        <div className="dlc-dialog-header">
          <h3>{isEditMode ? 'Edit DLCs' : 'Select DLCs to Enable'}</h3>
          <div className="dlc-game-info">
            <span className="game-title">{gameTitle}</span>
            <span className="dlc-count">
              {selectedCount} of {selectedDlcs.length} DLCs selected
              {getLoadingInfoText()}
            </span>
          </div>
        </div>

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

        {isLoading && (
          <div className="dlc-loading-progress">
            <div className="progress-bar-container">
              <div className="progress-bar" style={{ width: `${loadingProgress}%` }} />
            </div>
            <div className="loading-details">
              <span>Loading DLCs: {loadingProgress}%</span>
              {estimatedTimeLeft && (
                <span className="time-left">Est. time left: {estimatedTimeLeft}</span>
              )}
            </div>
          </div>
        )}

        <div className="dlc-list-container">
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
        </div>

        <div className="dlc-dialog-actions">
          <button
            className="cancel-button"
            onClick={handleClose}
            disabled={isLoading && loadingProgress < 10} // Briefly disable to prevent accidental closing at start
          >
            Cancel
          </button>
          <button className="confirm-button" onClick={handleConfirm} disabled={isLoading}>
            {isEditMode ? 'Save Changes' : 'Install with Selected DLCs'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default DlcSelectionDialog