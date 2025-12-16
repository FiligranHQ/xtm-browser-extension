/**
 * Toast Notifications
 * Floating, centered notifications for content script feedback.
 */

let currentToast: HTMLElement | null = null;
let toastTimeout: ReturnType<typeof setTimeout> | null = null;

export interface ToastOptions {
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
  showSpinner?: boolean;
  action?: { label: string; onClick: () => void };
  persistent?: boolean; // Won't auto-dismiss if true
  duration?: number; // Auto-dismiss duration in ms (default: 4000)
}

/**
 * Show a toast notification
 */
export function showToast(options: ToastOptions): void {
  // Remove existing toast
  hideToast(true);
  
  const { type, message, showSpinner = false, action, persistent = false, duration = 4000 } = options;
  
  // Create toast element
  const toast = document.createElement('div');
  toast.className = `xtm-toast xtm-toast-${type}`;
  toast.id = 'xtm-toast';
  
  // Icon/spinner
  const iconHtml = showSpinner 
    ? '<div class="xtm-toast-icon"><div class="xtm-toast-spinner"></div></div>'
    : type === 'success'
    ? `<div class="xtm-toast-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4caf50" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>`
    : type === 'error'
    ? `<div class="xtm-toast-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f44336" stroke-width="2.5">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
      </div>`
    : type === 'warning'
    ? `<div class="xtm-toast-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff9800" stroke-width="2.5">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      </div>`
    : `<div class="xtm-toast-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0fbcff" stroke-width="2.5">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
      </div>`;
  
  // Action button
  const actionHtml = action 
    ? `<button class="xtm-toast-action" id="xtm-toast-action">${action.label}</button>` 
    : '';
  
  // Close button (only if not showing spinner / scanning)
  const closeHtml = !showSpinner
    ? `<button class="xtm-toast-close" id="xtm-toast-close">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>`
    : '';
  
  toast.innerHTML = `
    ${iconHtml}
    <span class="xtm-toast-message">${message}</span>
    ${actionHtml}
    ${closeHtml}
  `;
  
  document.body.appendChild(toast);
  currentToast = toast;
  
  // Add event listeners
  if (action) {
    const actionBtn = toast.querySelector('#xtm-toast-action');
    if (actionBtn) {
      actionBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        action.onClick();
        hideToast();
      });
    }
  }
  
  const closeBtn = toast.querySelector('#xtm-toast-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideToast();
    });
  }
  
  // Auto-dismiss (unless persistent or has action button with longer duration)
  if (!persistent) {
    const dismissDuration = action ? Math.max(duration, 8000) : duration;
    toastTimeout = setTimeout(() => {
      hideToast();
    }, dismissDuration);
  }
}

/**
 * Hide the current toast notification
 */
export function hideToast(immediate: boolean = false): void {
  if (toastTimeout) {
    clearTimeout(toastTimeout);
    toastTimeout = null;
  }
  
  if (currentToast) {
    if (immediate) {
      currentToast.remove();
      currentToast = null;
    } else {
      // Animate out
      currentToast.classList.add('xtm-toast-hiding');
      setTimeout(() => {
        if (currentToast) {
          currentToast.remove();
          currentToast = null;
        }
      }, 200);
    }
  }
}

