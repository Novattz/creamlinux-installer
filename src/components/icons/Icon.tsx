/**
 * Icon component for displaying SVG icons with standardized properties
 */
import React from 'react'

// Import all icon variants
import * as OutlineIcons from './ui/outline'
import * as BoldIcons from './ui/bold'
import * as BrandIcons from './brands'

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number
export type IconVariant = 'bold' | 'outline' | 'brand' | undefined
export type IconName = keyof typeof OutlineIcons | keyof typeof BoldIcons | keyof typeof BrandIcons

// Sets of icon names by type for determining default variants
const BRAND_ICON_NAMES = new Set(Object.keys(BrandIcons))
const OUTLINE_ICON_NAMES = new Set(Object.keys(OutlineIcons))
const BOLD_ICON_NAMES = new Set(Object.keys(BoldIcons))

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  /** Name of the icon to render */
  name: IconName | string
  /** Size of the icon */
  size?: IconSize
  /** Icon variant - bold, outline, or brand */
  variant?: IconVariant | string
  /** Title for accessibility */
  title?: string
  /** Fill color (if not specified by the SVG itself) */
  fillColor?: string
  /** Stroke color (if not specified by the SVG itself) */
  strokeColor?: string
  /** Additional CSS class names */
  className?: string
}

/**
 * Convert size string to pixel value
 */
const getSizeValue = (size: IconSize): string => {
  if (typeof size === 'number') return `${size}px`

  const sizeMap: Record<string, string> = {
    xs: '12px',
    sm: '16px',
    md: '24px',
    lg: '32px',
    xl: '48px'
  }

  return sizeMap[size] || sizeMap.md
}

/**
 * Gets the icon component based on name and variant
 */
const getIconComponent = (name: string, variant: IconVariant | string): React.ComponentType<React.SVGProps<SVGSVGElement>> | null => {
  // Normalize variant to ensure it's a valid IconVariant
  const normalizedVariant = (variant === 'bold' || variant === 'outline' || variant === 'brand') 
    ? variant as IconVariant 
    : undefined;

  // Try to get the icon from the specified variant
  switch (normalizedVariant) {
    case 'outline':
      return OutlineIcons[name as keyof typeof OutlineIcons] || null
    case 'bold':
      return BoldIcons[name as keyof typeof BoldIcons] || null
    case 'brand':
      return BrandIcons[name as keyof typeof BrandIcons] || null
    default:
      // If no variant specified, determine best default
      if (BRAND_ICON_NAMES.has(name)) {
        return BrandIcons[name as keyof typeof BrandIcons] || null
      } else if (OUTLINE_ICON_NAMES.has(name)) {
        return OutlineIcons[name as keyof typeof OutlineIcons] || null
      } else if (BOLD_ICON_NAMES.has(name)) {
        return BoldIcons[name as keyof typeof BoldIcons] || null
      }
      return null
  }
}

/**
 * Icon component
 * Renders SVG icons with consistent sizing and styling
 */
const Icon: React.FC<IconProps> = ({
  name,
  size = 'md',
  variant,
  title,
  fillColor,
  strokeColor,
  className = '',
  ...rest
}) => {
  // Determine default variant based on icon type if no variant provided
  let defaultVariant: IconVariant | string = variant
  
  if (defaultVariant === undefined) {
    if (BRAND_ICON_NAMES.has(name)) {
      defaultVariant = 'brand'
    } else {
      defaultVariant = 'bold' // Default to outline for non-brand icons
    }
  }
  
  // Get the icon component based on name and variant
  let finalIconComponent = getIconComponent(name, defaultVariant)
  let finalVariant = defaultVariant
  
  // Try fallbacks if the icon doesn't exist in the requested variant
  if (!finalIconComponent && defaultVariant !== 'outline') {
    finalIconComponent = getIconComponent(name, 'outline')
    finalVariant = 'outline'
  }
  
  if (!finalIconComponent && defaultVariant !== 'bold') {
    finalIconComponent = getIconComponent(name, 'bold')
    finalVariant = 'bold'
  }

  if (!finalIconComponent && defaultVariant !== 'brand') {
    finalIconComponent = getIconComponent(name, 'brand')
    finalVariant = 'brand'
  }
  
  // If still no icon found, return null
  if (!finalIconComponent) {
    console.warn(`Icon not found: ${name} (${defaultVariant})`)
    return null
  }

  const sizeValue = getSizeValue(size)
  const combinedClassName = `icon icon-${size} icon-${finalVariant} ${className}`.trim()
  
  const IconComponentToRender = finalIconComponent

  return (
    <IconComponentToRender
      className={combinedClassName}
      width={sizeValue}
      height={sizeValue}
      fill={fillColor || 'currentColor'} 
      stroke={strokeColor || 'currentColor'}
      role="img"
      aria-hidden={!title}
      aria-label={title}
      {...rest}
    />
  )
}

export default Icon