import React from 'react'

export type ActionType = 'install_cream' | 'uninstall_cream' | 'install_smoke' | 'uninstall_smoke'

interface ActionButtonProps {
  action: ActionType
  isInstalled: boolean
  isWorking: boolean
  onClick: () => void
  disabled?: boolean
}

const ActionButton: React.FC<ActionButtonProps> = ({
  action,
  isInstalled,
  isWorking,
  onClick,
  disabled = false,
}) => {
  const getButtonText = () => {
    if (isWorking) return 'Working...'

    const isCream = action.includes('cream')
    const product = isCream ? 'CreamLinux' : 'SmokeAPI'

    return isInstalled ? `Uninstall ${product}` : `Install ${product}`
  }

  const getButtonClass = () => {
    const baseClass = 'action-button'
    return `${baseClass} ${isInstalled ? 'uninstall' : 'install'}`
  }

  return (
    <button className={getButtonClass()} onClick={onClick} disabled={disabled || isWorking}>
      {getButtonText()}
    </button>
  )
}

export default ActionButton
