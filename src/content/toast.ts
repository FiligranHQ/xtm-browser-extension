/**
 * Toast Notifications
 * Uses Shadow DOM for complete isolation from page styles.
 */

let toastHost: HTMLElement | null = null;
let toastShadowRoot: ShadowRoot | null = null;
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

// Complete toast styles - fully self-contained
const TOAST_STYLES = `
  :host {
    all: initial;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 0;
    z-index: 2147483647;
    pointer-events: none;
  }
  
  .toast-container {
    position: fixed;
    top: 24px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2147483647;
    pointer-events: auto;
  }
  
  .toast {
    display: flex;
    align-items: center;
    gap: 12px;
    background: linear-gradient(135deg, #070d19 0%, #09101e 100%);
    color: rgba(255, 255, 255, 0.9);
    padding: 12px 20px;
    border-radius: 8px;
    font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.1);
    max-width: 500px;
    animation: slideIn 0.3s ease-out;
  }
  
  .toast.hiding {
    animation: slideOut 0.2s ease-in forwards;
  }
  
  .toast-info { border-left: 4px solid #0fbcff; }
  .toast-success { border-left: 4px solid #4caf50; }
  .toast-error { border-left: 4px solid #f44336; }
  .toast-warning { border-left: 4px solid #ff9800; }
  
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes slideOut {
    from {
      opacity: 1;
      transform: translateY(0);
    }
    to {
      opacity: 0;
      transform: translateY(-20px);
    }
  }
  
  .toast-icon {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .toast-spinner {
    width: 20px;
    height: 20px;
    border: 2px solid rgba(15, 188, 255, 0.3);
    border-top-color: #0fbcff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .toast-message {
    flex: 1;
    line-height: 1.4;
  }
  
  .toast-action {
    background: #0fbcff;
    color: #001e3c;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
    white-space: nowrap;
  }
  
  .toast-action:hover {
    background: #40caff;
  }
  
  .toast-close {
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s;
    flex-shrink: 0;
  }
  
  .toast-close:hover {
    color: rgba(255, 255, 255, 0.9);
  }
`;

function ensureToastHost(): ShadowRoot | null {
  if (toastShadowRoot) return toastShadowRoot;
  
  if (!document.body) return null;
  
  // Create host element
  toastHost = document.createElement('div');
  toastHost.id = 'xtm-toast-host';
  document.body.appendChild(toastHost);
  
  // Attach shadow root
  toastShadowRoot = toastHost.attachShadow({ mode: 'closed' });
  
  // Inject styles into shadow DOM
  const style = document.createElement('style');
  style.textContent = TOAST_STYLES;
  toastShadowRoot.appendChild(style);
  
  return toastShadowRoot;
}

/**
 * Show a toast notification
 */
export function showToast(options: ToastOptions): void {
  // Remove existing toast
  hideToast(true);
  
  const shadowRoot = ensureToastHost();
  if (!shadowRoot) return;
  
  const { type, message, showSpinner = false, action, persistent = false, duration = 4000 } = options;
  
  // Create container
  const container = document.createElement('div');
  container.className = 'toast-container';
  
  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  // Icon/spinner
  const iconContainer = document.createElement('div');
  iconContainer.className = 'toast-icon';
  
  if (showSpinner) {
    const spinner = document.createElement('div');
    spinner.className = 'toast-spinner';
    iconContainer.appendChild(spinner);
  } else {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '20');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke-width', '2.5');
    
    const color = type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : type === 'warning' ? '#ff9800' : '#0fbcff';
    svg.setAttribute('stroke', color);
    
    if (type === 'success') {
      const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      polyline.setAttribute('points', '20 6 9 17 4 12');
      svg.appendChild(polyline);
    } else if (type === 'error') {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', '12');
      circle.setAttribute('cy', '12');
      circle.setAttribute('r', '10');
      svg.appendChild(circle);
      const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line1.setAttribute('x1', '15');
      line1.setAttribute('y1', '9');
      line1.setAttribute('x2', '9');
      line1.setAttribute('y2', '15');
      svg.appendChild(line1);
      const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line2.setAttribute('x1', '9');
      line2.setAttribute('y1', '9');
      line2.setAttribute('x2', '15');
      line2.setAttribute('y2', '15');
      svg.appendChild(line2);
    } else if (type === 'warning') {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z');
      svg.appendChild(path);
      const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line1.setAttribute('x1', '12');
      line1.setAttribute('y1', '9');
      line1.setAttribute('x2', '12');
      line1.setAttribute('y2', '13');
      svg.appendChild(line1);
      const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line2.setAttribute('x1', '12');
      line2.setAttribute('y1', '17');
      line2.setAttribute('x2', '12.01');
      line2.setAttribute('y2', '17');
      svg.appendChild(line2);
    } else {
      // info
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', '12');
      circle.setAttribute('cy', '12');
      circle.setAttribute('r', '10');
      svg.appendChild(circle);
      const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line1.setAttribute('x1', '12');
      line1.setAttribute('y1', '16');
      line1.setAttribute('x2', '12');
      line1.setAttribute('y2', '12');
      svg.appendChild(line1);
      const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line2.setAttribute('x1', '12');
      line2.setAttribute('y1', '8');
      line2.setAttribute('x2', '12.01');
      line2.setAttribute('y2', '8');
      svg.appendChild(line2);
    }
    
    iconContainer.appendChild(svg);
  }
  
  toast.appendChild(iconContainer);
  
  // Message
  const messageSpan = document.createElement('span');
  messageSpan.className = 'toast-message';
  messageSpan.textContent = message;
  toast.appendChild(messageSpan);
  
  // Action button
  if (action) {
    const actionBtn = document.createElement('button');
    actionBtn.className = 'toast-action';
    actionBtn.textContent = action.label;
    actionBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      action.onClick();
      hideToast();
    });
    toast.appendChild(actionBtn);
  }
  
  // Close button (only if not showing spinner)
  if (!showSpinner) {
    const closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    
    const closeSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    closeSvg.setAttribute('width', '16');
    closeSvg.setAttribute('height', '16');
    closeSvg.setAttribute('viewBox', '0 0 24 24');
    closeSvg.setAttribute('fill', 'none');
    closeSvg.setAttribute('stroke', 'currentColor');
    closeSvg.setAttribute('stroke-width', '2');
    
    const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line1.setAttribute('x1', '18');
    line1.setAttribute('y1', '6');
    line1.setAttribute('x2', '6');
    line1.setAttribute('y2', '18');
    closeSvg.appendChild(line1);
    
    const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line2.setAttribute('x1', '6');
    line2.setAttribute('y1', '6');
    line2.setAttribute('x2', '18');
    line2.setAttribute('y2', '18');
    closeSvg.appendChild(line2);
    
    closeBtn.appendChild(closeSvg);
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideToast();
    });
    toast.appendChild(closeBtn);
  }
  
  container.appendChild(toast);
  shadowRoot.appendChild(container);
  currentToast = container;
  
  // Auto-dismiss
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
  
  if (currentToast && toastShadowRoot) {
    if (immediate) {
      currentToast.remove();
      currentToast = null;
    } else {
      const toast = currentToast.querySelector('.toast');
      if (toast) {
        toast.classList.add('hiding');
        setTimeout(() => {
          if (currentToast) {
            currentToast.remove();
            currentToast = null;
          }
        }, 200);
      } else {
        currentToast.remove();
        currentToast = null;
      }
    }
  }
}
