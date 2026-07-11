import { createContext } from 'react'
import { Game, DlcInfo, EpicGame } from '@/types'
import { ActionType } from '@/components/buttons/ActionButton'
import { DlcDialogState } from '@/hooks/useDlcManager'

// Types for context sub-components
export interface InstallationInstructions {
  type: string
  command: string
  game_title: string
  dlc_count?: number
}

export interface ProgressDialogState {
  visible: boolean
  title: string
  message: string
  progress: number
  showInstructions: boolean
  instructions?: InstallationInstructions
}

export interface SmokeAPISettingsDialogState {
  visible: boolean
  gamePath: string
  gameTitle: string
}

export interface RatingDialogState {
  visible: boolean
  gameId: string
  gameTitle: string
  unlocker: 'creamlinux' | 'smokeapi'
  steamPath: string
}

// A single entry in the Overview page's recent-activity feed. Session-only
// (not persisted) just a friendlier view of what you've been doing since
// the app was launched.
export interface ActivityItem {
  id: string
  message: string
  type: 'install' | 'uninstall' | 'update'
  timestamp: number
}

// Define the context type
export interface AppContextType {
  // Game state
  games: Game[]
  isLoading: boolean
  isInitialLoad: boolean
  scanProgress: { message: string; progress: number }
  error: string | null
  loadGames: () => Promise<boolean>
  handleProgressDialogClose: () => void

  // DLC management
  dlcDialog: DlcDialogState
  handleGameEdit: (gameId: string) => void
  handleDlcDialogClose: () => void
  handleUpdateDlcs: (gameId: string) => Promise<void>

  // Epic Games
  epicGames: EpicGame[]
  epicLoading: boolean
  epicInstallingId: string | null
  loadEpicGames: () => Promise<void>
  handleEpicInstall: (game: EpicGame) => void
  handleEpicUninstallScream: (game: EpicGame) => void
  handleEpicUninstallKoaloader: (game: EpicGame) => void
  handleEpicSettings: (game: EpicGame) => void

  // Game actions
  progressDialog: ProgressDialogState
  handleGameAction: (gameId: string, action: ActionType) => Promise<void>
  handleDlcConfirm: (selectedDlcs: DlcInfo[]) => void

  // SmokeAPI settings
  smokeAPISettingsDialog: SmokeAPISettingsDialogState
  handleSmokeAPISettingsOpen: (gameId: string) => void
  handleSmokeAPISettingsClose: () => void

  // SmokeAPI votes dialog
  smokeAPIVotesDialog: {
  visible: boolean
  gameId: string | null
  gameTitle: string | null
  }
  handleSmokeAPIVotesClose: () => void
  handleSmokeAPIVotesConfirm: () => void

  // Rating dialog
  ratingDialog: RatingDialogState
  handleOpenRating: (gameId: string) => void
  handleCloseRating: () => void
  handleSubmitRating: (worked: boolean) => Promise<void>
  reportingEnabled: boolean

  // Recent activity feed (session-only, shown on Overview)
  activityFeed: ActivityItem[]

  // Toast notifications
  showToast: (
    message: string,
    type: 'success' | 'error' | 'warning' | 'info',
    options?: Record<string, unknown>
  ) => void

  // Unlocker selection
  unlockerSelectionDialog: {
    visible: boolean
    gameId: string | null
    gameTitle: string | null
  }
  handleSelectCreamLinux: () => void
  handleSelectSmokeAPI: () => void
  closeUnlockerDialog: () => void
}

// Create the context with a default value
export const AppContext = createContext<AppContextType | undefined>(undefined)