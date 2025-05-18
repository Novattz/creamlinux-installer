/**
 * General-purpose utility functions
 */

/**
 * Formats a timestamp in seconds to a human-readable string
 * @param seconds Number of seconds
 * @returns Formatted string (e.g., "5m 30s" or "30s")
 */
export function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  
  if (remainingSeconds === 0) {
    return `${minutes}m`;
  }
  
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Truncates a string if it exceeds the specified length
 * @param str String to truncate
 * @param maxLength Maximum length before truncation
 * @param suffix Suffix to append to truncated string (default: "...")
 * @returns Truncated string
 */
export function truncateString(str: string, maxLength: number, suffix: string = '...'): string {
  if (str.length <= maxLength) {
    return str;
  }
  
  return str.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Debounces a function to limit how often it's called
 * @param fn Function to debounce
 * @param delay Delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: NodeJS.Timeout | null = null;
  
  return function(...args: Parameters<T>) {
    if (timer) {
      clearTimeout(timer);
    }
    
    timer = setTimeout(() => {
      fn(...args);
    }, delay);
  };
}

/**
 * Creates a throttled function that only invokes the provided function at most once per specified interval
 * @param fn Function to throttle
 * @param limit Interval in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  
  return function(...args: Parameters<T>) {
    const now = Date.now();
    
    if (now - lastCall < limit) {
      return;
    }
    
    lastCall = now;
    return fn(...args);
  };
}