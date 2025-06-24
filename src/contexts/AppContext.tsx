import { createContext } from 'react'
import { Game, DlcInfo } from '@/types'
import { ActionType } from '@/components/buttons/ActionButton'

// Types for context sub-components
export interface InstallationInstructions {
  type: string
  command: string
  game_title: string
  dlc_count?: number
}

export interface DlcDialogState {
  visible: boolean
  gameId: string
  gameTitle: string
  dlcs: DlcInfo[]
  isLoading: boolean
  isEditMode: boolean
  progress: number
  timeLeft?: string
}

export interface ProgressDialogState {
  visible: boolean
  title: string
  message: string
  progress: number
  showInstructions: boolean
  instructions?: InstallationInstructions
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

  // Game actions
  progressDialog: ProgressDialogState
  handleGameAction: (gameId: string, action: ActionType) => Promise<void>
  handleDlcConfirm: (selectedDlcs: DlcInfo[]) => void

  // Settings
  settingsDialog: { visible: boolean }
  handleSettingsOpen: () => void
  handleSettingsClose: () => void

  // Toast notifications
  showToast: (
    message: string,
    type: 'success' | 'error' | 'warning' | 'info',
    options?: Record<string, unknown>
  ) => void
}

// Create the context with a default value
export const AppContext = createContext<AppContextType | undefined>(undefined)
