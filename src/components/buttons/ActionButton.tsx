import { FC } from 'react'
import Button, { ButtonVariant } from '../buttons/Button'
import { Icon, trash, download } from '@/components/icons'

// Define available action types
export type ActionType = 'install_cream' | 'uninstall_cream' | 'install_smoke' | 'uninstall_smoke'

interface ActionButtonProps {
  action: ActionType
  isInstalled: boolean
  isWorking: boolean
  onClick: () => void
  disabled?: boolean
  className?: string
}

/**
 * Specialized button for game installation actions
 */
const ActionButton: FC<ActionButtonProps> = ({
  action,
  isInstalled,
  isWorking,
  onClick,
  disabled = false,
  className = '',
}) => {
  // Determine button text based on state
  const getButtonText = () => {
    if (isWorking) return 'Working...'

    const isCream = action.includes('cream')
    const product = isCream ? 'CreamLinux' : 'SmokeAPI'

    return isInstalled ? `Uninstall ${product}` : `Install ${product}`
  }

  // Map to button variant
  const getButtonVariant = (): ButtonVariant => {
    // For uninstall actions, use danger variant
    if (isInstalled) return 'danger'
    // For install actions, use success variant
    return 'success'
  }

  // Select appropriate icon based on action type and state
  const getIconInfo = () => {
    if (isInstalled) {
      // Uninstall actions
      return { name: trash, variant: 'solid' }
    } else {
      // Install actions
      return { name: download, variant: 'solid' }
    }
  }

  const iconInfo = getIconInfo()

  return (
    <Button
      variant={getButtonVariant()}
      isLoading={isWorking}
      onClick={onClick}
      disabled={disabled || isWorking}
      fullWidth
      className={`action-button ${className}`}
      leftIcon={
        isWorking ? undefined : <Icon name={iconInfo.name} variant={iconInfo.variant} size="md" />
      }
    >
      {getButtonText()}
    </Button>
  )
}

export default ActionButton
