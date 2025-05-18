import { useContext } from 'react'
import { AppContext, AppContextType } from './AppContext'

/**
 * Custom hook to use the application context
 * Ensures proper error handling if used outside of AppProvider
 */
export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext)

  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider')
  }

  return context
}
