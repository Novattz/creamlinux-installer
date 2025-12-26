import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useAppContext } from '@/contexts/useAppContext'
import { useAppLogic, useConflictDetection } from '@/hooks'
import './styles/main.scss'

// Layout components
import {
  Header,
  Sidebar,
  InitialLoadingScreen,
  ErrorBoundary,
  UpdateScreen,
  AnimatedBackground,
} from '@/components/layout'

// Dialog components
import {
  ProgressDialog,
  DlcSelectionDialog,
  SettingsDialog,
  ConflictDialog,
  ReminderDialog,
} from '@/components/dialogs'

// Game components
import { GameList } from '@/components/games'

/**
 * Main application component
 */
function App() {
  const [updateComplete, setUpdateComplete] = useState(false)

  // Get application logic from hook
  const {
    filter,
    setFilter,
    searchQuery,
    handleSearchChange,
    isInitialLoad,
    scanProgress,
    filteredGames,
    handleRefresh,
    isLoading,
    error,
  } = useAppLogic({ autoLoad: updateComplete })

  // Get action handlers from context
  const {
    games,
    dlcDialog,
    handleDlcDialogClose,
    handleProgressDialogClose,
    progressDialog,
    handleGameAction,
    handleDlcConfirm,
    handleGameEdit,
    handleUpdateDlcs,
    settingsDialog,
    handleSettingsOpen,
    handleSettingsClose,
    handleSmokeAPISettingsOpen,
    showToast,
  } = useAppContext()

  // Conflict detection
  const { currentConflict, showReminder, resolveConflict, closeReminder } =
    useConflictDetection(games)

  // Handle conflict resolution
  const handleConflictResolve = async () => {
    const resolution = resolveConflict()
    if (!resolution) return

    // Always remove files - use the special conflict resolution command
    try {
      await invoke('resolve_platform_conflict', {
        gameId: resolution.gameId,
        conflictType: resolution.conflictType,
      })
    } catch (error) {
      console.error('Error resolving conflict:', error)
      showToast(`Failed to resolve conflict: ${error}`, 'error')
    }
  }

  // Show update screen first
  if (!updateComplete) {
    return <UpdateScreen onComplete={() => setUpdateComplete(true)} />
  }

  // Then show initial loading screen
  if (isInitialLoad) {
    return <InitialLoadingScreen message={scanProgress.message} progress={scanProgress.progress} />
  }

  return (
    <ErrorBoundary>
      <div className="app-container">
        {/* Animated background */}
        <AnimatedBackground />

        {/* Header with search */}
        <Header
          onRefresh={handleRefresh}
          onSearch={handleSearchChange}
          searchQuery={searchQuery}
          refreshDisabled={isLoading}
        />

        <div className="main-content">
          {/* Sidebar for filtering */}
          <Sidebar
            setFilter={setFilter}
            currentFilter={filter}
            onSettingsClick={handleSettingsOpen}
          />

          {/* Show error or game list */}
          {error ? (
            <div className="error-message">
              <h3>Error Loading Games</h3>
              <p>{error}</p>
              <button onClick={handleRefresh}>Retry</button>
            </div>
          ) : (
            <GameList
              games={filteredGames}
              isLoading={isLoading}
              onAction={handleGameAction}
              onEdit={handleGameEdit}
              onSmokeAPISettings={handleSmokeAPISettingsOpen}
            />
          )}
        </div>

        {/* Progress Dialog */}
        <ProgressDialog
          visible={progressDialog.visible}
          title={progressDialog.title}
          message={progressDialog.message}
          progress={progressDialog.progress}
          showInstructions={progressDialog.showInstructions}
          instructions={progressDialog.instructions}
          onClose={handleProgressDialogClose}
        />

        {/* DLC Selection Dialog */}
        <DlcSelectionDialog
          visible={dlcDialog.visible}
          gameTitle={dlcDialog.gameTitle}
          gameId={dlcDialog.gameId}
          dlcs={dlcDialog.dlcs}
          isLoading={dlcDialog.isLoading}
          isEditMode={dlcDialog.isEditMode}
          isUpdating={dlcDialog.isUpdating}
          updateAttempted={dlcDialog.updateAttempted}
          loadingProgress={dlcDialog.progress}
          estimatedTimeLeft={dlcDialog.timeLeft}
          newDlcsCount={dlcDialog.newDlcsCount}
          onClose={handleDlcDialogClose}
          onConfirm={handleDlcConfirm}
          onUpdate={handleUpdateDlcs}
        />

        {/* Settings Dialog */}
        <SettingsDialog visible={settingsDialog.visible} onClose={handleSettingsClose} />

        {/* Conflict Detection Dialog */}
        {currentConflict && (
          <ConflictDialog
            visible={true}
            gameTitle={currentConflict.gameTitle}
            conflictType={currentConflict.type}
            onConfirm={handleConflictResolve}
          />
        )}

        {/* Steam Launch Options Reminder */}
        <ReminderDialog visible={showReminder} onClose={closeReminder} />
      </div>
    </ErrorBoundary>
  )
}

export default App