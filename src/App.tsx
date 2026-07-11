import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useAppContext } from '@/contexts/useAppContext'
import { useAppLogic, useConflictDetection, useDisclaimer } from '@/hooks'
import { GameVotes } from '@/components/common/VotesDisplay'
import './styles/main.scss'

// Layout components
import {
  Header,
  Sidebar,
  InitialLoadingScreen,
  ErrorBoundary,
  UpdateScreen,
} from '@/components/layout'

// Dialog components
import {
  ProgressDialog,
  DlcSelectionDialog,
  ConflictDialog,
  DisclaimerDialog,
  UnlockerChoiceDialog,
} from '@/components/dialogs'

// Page components (Overview and Settings)
import { OverviewPage, SettingsPage } from '@/components/pages'

// Game components
import { GameList, EpicGameList } from '@/components/games'

/**
 * Main application component
 */
function App() {
  const [updateComplete, setUpdateComplete] = useState(false)
  const [creamVotes, setCreamVotes] = useState<GameVotes | null>(null)
  const [smokeVotes, setSmokeVotes] = useState<GameVotes | null>(null)

  const { showDisclaimer, handleDisclaimerClose } = useDisclaimer()

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
  } = useAppLogic()

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
    handleSmokeAPISettingsOpen,
    handleOpenRating,
    reportingEnabled,
    showToast,
    unlockerSelectionDialog,
    handleSelectCreamLinux,
    handleSelectSmokeAPI,
    closeUnlockerDialog,
    epicGames,
    epicLoading,
    epicInstallingId,
    loadEpicGames,
    handleEpicInstall,
    handleEpicUninstallScream,
    handleEpicUninstallKoaloader,
    handleEpicSettings,
  } = useAppContext()

  // Conflict detection
  const { conflicts, showDialog, resolveConflict, closeDialog } = useConflictDetection(games)

  // Community vote data for the Steam unlocker choice dialog (Epic's
  // equivalent choice has no vote data, so it skips this entirely)
  useEffect(() => {
    const gameId = unlockerSelectionDialog.gameId
    if (!unlockerSelectionDialog.visible || !gameId) {
      setCreamVotes(null)
      setSmokeVotes(null)
      return
    }

    invoke<GameVotes[]>('get_game_votes', { gameId })
      .then((results) => {
        setCreamVotes(results.find((v) => v.unlocker === 'creamlinux') ?? null)
        setSmokeVotes(results.find((v) => v.unlocker === 'smokeapi') ?? null)
      })
      .catch(() => {
        // Votes are non-critical, silently fall back to "No votes yet"
        setCreamVotes(null)
        setSmokeVotes(null)
      })
  }, [unlockerSelectionDialog.visible, unlockerSelectionDialog.gameId])

  const handleSetFilter = async (f: string) => {
    setFilter(f)
    if (f === 'epic' && epicGames.length === 0 && !epicLoading) {
      await loadEpicGames()
    }
  }

  // Handle conflict resolution
  const handleConflictResolve = async (
    gameId: string,
    conflictType: 'cream-to-proton' | 'smoke-to-native'
  ) => {
    try {
      // Invoke backend to resolve the conflict
      await invoke('resolve_platform_conflict', {
        gameId,
        conflictType,
      })

      // Remove from UI
      resolveConflict(gameId, conflictType)

      showToast('Conflict resolved successfully', 'success')
    } catch (error) {
      console.error('Error resolving conflict:', error)
      showToast('Failed to resolve conflict', 'error')
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
        {/* Header with search */}
        <Header onSearch={handleSearchChange} searchQuery={searchQuery} />

        <div className="main-content">
          {/* Sidebar for filtering */}
          <Sidebar setFilter={handleSetFilter} currentFilter={filter} />

          {filter === 'overview' ? (
            <OverviewPage />
          ) : filter === 'settings' ? (
            <SettingsPage />
          ) : filter === 'epic' ? (
            <EpicGameList
              games={epicGames}
              isLoading={epicLoading}
              installingId={epicInstallingId}
              onInstall={handleEpicInstall}
              onUninstallScream={handleEpicUninstallScream}
              onUninstallKoaloader={handleEpicUninstallKoaloader}
              onSettings={handleEpicSettings}
              onRefresh={loadEpicGames}
            />
          ) : error ? (
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
              onRate={handleOpenRating}
              onRefresh={handleRefresh}
              reportingEnabled={reportingEnabled}
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

        {/* Conflict Detection Dialog */}
        <ConflictDialog
          visible={showDialog}
          conflicts={conflicts}
          onResolve={handleConflictResolve}
          onClose={closeDialog}
        />

        {/* Unlocker Selection Dialog */}
        <UnlockerChoiceDialog
          visible={unlockerSelectionDialog.visible}
          gameTitle={unlockerSelectionDialog.gameTitle || ''}
          onClose={closeUnlockerDialog}
          options={[
            {
              key: 'cream',
              title: 'CreamLinux',
              badge: 'recommended',
              description:
                'Native Linux DLC unlocker. Works best with most native Linux games and provides better compatibility.',
              votes: creamVotes,
              buttonLabel: 'Install CreamLinux',
              buttonVariant: 'primary',
              onSelect: handleSelectCreamLinux,
            },
            {
              key: 'smoke',
              title: 'SmokeAPI',
              badge: 'alternative',
              description:
                "Cross-platform DLC unlocker. Try this if CreamLinux doesn't work for your game. Automatically fetches DLC information.",
              votes: smokeVotes,
              buttonLabel: 'Install SmokeAPI',
              buttonVariant: 'secondary',
              onSelect: handleSelectSmokeAPI,
            },
          ]}
        />

        {/* Disclaimer Dialog - Shows AFTER everything is loaded */}
        <DisclaimerDialog visible={showDisclaimer} onClose={handleDisclaimerClose} />
      </div>
    </ErrorBoundary>
  )
}

export default App