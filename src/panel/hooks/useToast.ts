/**
 * Toast Hook
 * 
 * Hook for showing toast notifications via the content script.
 */

import { useCallback } from 'react';

/**
 * Toast options
 */
export interface ToastOptions {
  type: 'success' | 'info' | 'warning' | 'error';
  message: string;
  action?: { label: string; type: 'scroll_to_first' | 'close_panel' | 'custom' };
  persistent?: boolean;
  duration?: number;
}

/**
 * Hook for showing toast notifications
 */
export function useToast() {
  const showToast = useCallback((options: ToastOptions) => {
    window.parent.postMessage({ type: 'XTM_SHOW_TOAST', payload: options }, '*');
  }, []);

  return { showToast };
}

