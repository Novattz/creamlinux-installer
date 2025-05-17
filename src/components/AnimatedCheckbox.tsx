// src/components/AnimatedCheckbox.tsx
import React from 'react';

interface AnimatedCheckboxProps {
  checked: boolean;
  onChange: () => void;
  label?: string;
  sublabel?: string;
  className?: string;
}

const AnimatedCheckbox: React.FC<AnimatedCheckboxProps> = ({
  checked,
  onChange,
  label,
  sublabel,
  className = ''
}) => {
  return (
    <label className={`animated-checkbox ${className}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="checkbox-original"
      />
      <span className={`checkbox-custom ${checked ? 'checked' : ''}`}>
        <svg viewBox="0 0 24 24" className="checkmark-icon">
          <path 
            className={`checkmark ${checked ? 'checked' : ''}`}
            d="M5 12l5 5L20 7" 
            stroke="#fff" 
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {(label || sublabel) && (
        <div className="checkbox-content">
          {label && <span className="checkbox-label">{label}</span>}
          {sublabel && <span className="checkbox-sublabel">{sublabel}</span>}
        </div>
      )}
    </label>
  );
};

export default AnimatedCheckbox;