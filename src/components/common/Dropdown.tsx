import { useState, useRef, useEffect } from 'react'
import { Icon, arrowUp } from '@/components/icons'

export interface DropdownOption<T = string> {
  value: T
  label:  string
}

interface DropdownProps<T = string> {
  label: string
  description?: string
  value: T
  options: DropdownOption<T>[]
  onChange: (value: T) => void
  disabled?: boolean
  className?: string
}

/**
 * Dropdown component for selecting from a list of options
 */
const Dropdown = <T extends string | number | boolean>({
  label,
  description,
  value,
  options,
  onChange,
  disabled = false,
  className = '',
}: DropdownProps<T>) => {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const selectedOption = options.find((opt) => opt.value === value)

  const handleSelect = (optionValue: T) => {
    onChange(optionValue)
    setIsOpen(false)
  }

  return (
    <div className={`dropdown-container ${className}`}>
      <div className="dropdown-label-container">
        <label className="dropdown-label">{label}</label>
        {description && <p className="dropdown-description">{description}</p>}
      </div>

      <div className={`dropdown ${disabled ? 'disabled' : ''}`} ref={dropdownRef}>
        <button
          type="button"
          className="dropdown-trigger"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
        >
          <span className="dropdown-value">{selectedOption?.label || 'Select...'}</span>
          <Icon
            name={arrowUp}
            variant="solid"
            size="sm"
            className={`dropdown-icon ${isOpen ? 'open' : ''}`}
          />
        </button>

        {isOpen && !disabled && (
          <div className="dropdown-menu">
            {options.map((option) => (
              <button
                key={String(option.value)}
                type="button"
                className={`dropdown-option ${option.value === value ? 'selected' : ''}`}
                onClick={() => handleSelect(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Dropdown