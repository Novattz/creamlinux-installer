import { createContext } from 'react'
import { Game, DlcInfo } from '@/types'
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

// Define the context type
export interface AppContextType {
  // Game state
  games: Game[]
  isLoading: boolean
  error: string | null
  loadGames: () => Promise<boolean>
  handleProgressDialogClose: () => void

  // DLC management
  dlcDialog: DlcDialogState
  handleGameEdit: (gameId: string) => void
  handleDlcDialogClose: () => void
  handleUpdateDlcs: (gameId: string) => Promise<void>

  // Game actions
  progressDialog: ProgressDialogState
  handleGameAction: (gameId: string, action: ActionType) => Promise<void>
  handleDlcConfirm: (selectedDlcs: DlcInfo[]) => void

  // Settings
  settingsDialog: { visible: boolean }
  handleSettingsOpen: () => void
  handleSettingsClose: () => void

  // SmokeAPI settings
  smokeAPISettingsDialog: SmokeAPISettingsDialogState
  handleSmokeAPISettingsOpen: (gameId: string) => void
  handleSmokeAPISettingsClose: () => void

  // Toast notifications
  showToast: (
    message: string,
    type: 'success' | 'error' | 'warning' | 'info',
    options?: Record<string, unknown>
  ) => void
}

// Create the context with a default value
export const AppContext = createContext<AppContextType | undefined>(undefined)