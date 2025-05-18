import { Icon, check } from '@/components/icons'

interface AnimatedCheckboxProps {
  checked: boolean
  onChange: () => void
  label?: string
  sublabel?: string
  className?: string
}

/**
 * Animated checkbox component with optional label and sublabel
 */
const AnimatedCheckbox = ({
  checked,
  onChange,
  label,
  sublabel,
  className = '',
}: AnimatedCheckboxProps) => {
  return (
    <label className={`animated-checkbox ${className}`}>
      <input type="checkbox" checked={checked} onChange={onChange} className="checkbox-original" />

      <span className={`checkbox-custom ${checked ? 'checked' : ''}`}>
        {checked && <Icon name={check} variant="bold" size="sm" className="checkbox-icon" />}
      </span>

      {(label || sublabel) && (
        <div className="checkbox-content">
          {label && <span className="checkbox-label">{label}</span>}
          {sublabel && <span className="checkbox-sublabel">{sublabel}</span>}
        </div>
      )}
    </label>
  )
}

export default AnimatedCheckbox
