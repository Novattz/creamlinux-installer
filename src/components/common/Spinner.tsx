interface SpinnerProps {
  className?: string
}

/**
 * Windows/Fluent-style indeterminate ring spinner an SVG circle whose
 * stroke-dasharray and rotation are animated (see .spinner-ring in
 * _loading.scss), rather than a CSS conic-gradient mask. Size and color
 * come from whatever wrapping className/context is passed in.
 */
const Spinner = ({ className = '' }: SpinnerProps) => (
  <svg viewBox="0 0 16 16" className={`spinner-ring ${className}`}>
    <circle cx="8" cy="8" r="7" />
  </svg>
)

export default Spinner
