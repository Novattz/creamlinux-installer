import { useState, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'

/**
 * Toast type definition
 */
export type ToastType = 'success' | 'error' | 'warning' | 'info'

/**
 * Toast interface
 */
export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  title?: string;
}

/**
 * Toast options interface
 */
export interface ToastOptions {
  title?: string;
  duration?: number;
}

/**
 * Hook for managing toast notifications
 * Provides methods for adding and removing notifications of different types
 */
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([])

  /**
   * Removes a toast by ID
   */
  const removeToast = useCallback((id: string) => {
    setToasts(currentToasts => currentToasts.filter(toast => toast.id !== id))
  }, [])

  /**
   * Adds a new toast with the specified type and options
   */
  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = uuidv4()
    const newToast = { ...toast, id }
    
    setToasts(currentToasts => [...currentToasts, newToast])
    
    // Auto-remove toast after its duration expires
    if (toast.duration !== Infinity) {
      setTimeout(() => {
        removeToast(id)
      }, toast.duration || 5000) // Default 5 seconds
    }
    
    return id
  }, [removeToast])
  
  /**
   * Shorthand method for success toasts
   */
  const success = useCallback((message: string, options: ToastOptions = {}) => 
    addToast({ message, type: 'success', ...options }), [addToast])
  
  /**
   * Shorthand method for error toasts
   */
  const error = useCallback((message: string, options: ToastOptions = {}) => 
    addToast({ message, type: 'error', ...options }), [addToast])
  
  /**
   * Shorthand method for warning toasts
   */
  const warning = useCallback((message: string, options: ToastOptions = {}) => 
    addToast({ message, type: 'warning', ...options }), [addToast])
  
  /**
   * Shorthand method for info toasts
   */
  const info = useCallback((message: string, options: ToastOptions = {}) => 
    addToast({ message, type: 'info', ...options }), [addToast])

  return {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info,
  }
}