/**
 * Toast Hook
 * 
 * Hook for showing toast notifications via the content script.
 */

import { useCallback } from 'react';
import type { ToastOptions } from '../../shared/types/common';

/**
 * Hook for showing toast notifications
 */
export function useToast() {
  const showToast = useCallback((options: ToastOptions) => {
    window.parent.postMessage({ type: 'XTM_SHOW_TOAST', payload: options }, '*');
  }, []);

  return { showToast };
}
