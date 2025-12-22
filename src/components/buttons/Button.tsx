import { FC, ButtonHTMLAttributes } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'warning'
export type ButtonSize = 'small' | 'medium' | 'large'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  isLoading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  fullWidth?: boolean
  iconOnly?: boolean
}

/**
 * Button component with different variants, sizes and states
 */
const Button: FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'medium',
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  iconOnly = false,
  className = '',
  disabled,
  ...props
}) => {
  // Size class mapping
  const sizeClass = {
    small: 'btn-sm',
    medium: 'btn-md',
    large: 'btn-lg',
  }[size]

  // Variant class mapping
  const variantClass = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    danger: 'btn-danger',
    success: 'btn-success',
    warning: 'btn-warning',
  }[variant]

  // Determine if this is an icon-only button
  const isIconOnly = iconOnly || (!children && (leftIcon || rightIcon))

  return (
    <button
      className={`btn ${variantClass} ${sizeClass} ${fullWidth ? 'btn-full' : ''} ${
        isLoading ? 'btn-loading' : ''
      } ${isIconOnly ? 'btn-icon-only' : ''} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <span className="btn-spinner">
          <span className="spinner"></span>
        </span>
      )}

      {leftIcon && !isLoading && <span className="btn-icon btn-icon-left">{leftIcon}</span>}
      {children && <span className="btn-text">{children}</span>}
      {rightIcon && !isLoading && <span className="btn-icon btn-icon-right">{rightIcon}</span>}
    </button>
  )
}

export default Button