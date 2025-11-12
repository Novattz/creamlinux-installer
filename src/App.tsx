import { useState } from 'react'
import { useAppContext } from '@/contexts/useAppContext'
import { useAppLogic } from '@/hooks'
import './styles/main.scss'

// Layout components
import { Header, Sidebar, InitialLoadingScreen, ErrorBoundary, UpdateScreen, AnimatedBackground } from '@/components/layout'

// Dialog components
import { ProgressDialog, DlcSelectionDialog, SettingsDialog } from '@/components/dialogs'

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
    dlcDialog,
    handleDlcDialogClose,
    handleProgressDialogClose,
    progressDialog,
    handleGameAction,
    handleDlcConfirm,
    handleGameEdit,
    settingsDialog,
    handleSettingsOpen,
    handleSettingsClose,
  } = useAppContext()

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
          <Sidebar setFilter={setFilter} currentFilter={filter} onSettingsClick={handleSettingsOpen} />

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
          dlcs={dlcDialog.dlcs}
          isLoading={dlcDialog.isLoading}
          isEditMode={dlcDialog.isEditMode}
          loadingProgress={dlcDialog.progress}
          estimatedTimeLeft={dlcDialog.timeLeft}
          onClose={handleDlcDialogClose}
          onConfirm={handleDlcConfirm}
        />

        {/* Settings Dialog */}
        <SettingsDialog 
          visible ={settingsDialog.visible}
          onClose={handleSettingsClose}
        />
      </div>
    </ErrorBoundary>
  )
}

export default App