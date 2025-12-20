/**
 * Common Types
 * 
 * Shared types used across the entire extension.
 * This is the SINGLE SOURCE OF TRUTH for these types.
 */

// ============================================================================
// Message Response Types
// ============================================================================

/**
 * Standard response wrapper for all extension messages
 */
export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Send response function type for message handlers
 */
export type SendResponseFn = (response: MessageResponse) => void;

// ============================================================================
// Toast Types
// ============================================================================

/**
 * Toast notification options
 * Used by both content script (native DOM) and panel (via postMessage)
 */
export interface ToastOptions {
  type: 'success' | 'info' | 'warning' | 'error';
  message: string;
  /** Optional action button */
  action?: { 
    label: string; 
    /** For content script: onClick handler. For panel: action type */
    type?: 'scroll_to_first' | 'close_panel' | 'custom';
    onClick?: () => void;
  };
  /** Show loading spinner instead of icon */
  showSpinner?: boolean;
  /** Won't auto-dismiss if true */
  persistent?: boolean;
  /** Auto-dismiss duration in ms (default: 4000) */
  duration?: number;
}

// ============================================================================
// Response Helper Functions
// ============================================================================

/**
 * Create a success response
 */
export function successResponse<T>(data: T): MessageResponse<T> {
  return { success: true, data };
}

/**
 * Create an error response
 */
export function errorResponse(error: string | Error): MessageResponse<never> {
  const errorMessage = error instanceof Error ? error.message : error;
  return { success: false, error: errorMessage };
}

