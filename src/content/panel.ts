/**
 * Panel Management Module
 * Handles the side panel iframe and panel communication.
 * Supports two modes:
 * - Floating mode (default): Panel is an injected iframe, communication via postMessage
 * - Split screen mode: Panel is browser's native side panel, communication via chrome.runtime
 */

import { loggers } from '../shared/utils/logger';
import type { DetectedObservable } from '../shared/types/observables';
import type { DetectedOCTIEntity } from '../shared/types/opencti';
import { extractArticleContent, extractFirstParagraph } from './extraction';

const log = loggers.content;

// ============================================================================
// State
// ============================================================================

let panelFrame: HTMLIFrameElement | null = null;
let panelOverlay: HTMLDivElement | null = null;
let isPanelReady = false;
const panelMessageQueue: Array<{ type: string; payload?: unknown }> = [];
let documentClickHandlerInstalled = false;
let highlightClickInProgress = false;
// Split screen mode - uses browser's native side panel instead of floating iframe
let splitScreenMode = false;
let splitScreenModeChecked = false;

// ============================================================================
// Getters/Setters
// ============================================================================

export function getPanelFrame(): HTMLIFrameElement | null {
  return panelFrame;
}

export function getPanelOverlay(): HTMLDivElement | null {
  return panelOverlay;
}

export function getIsPanelReady(): boolean {
  return isPanelReady;
}

export function setIsPanelReady(ready: boolean): void {
  isPanelReady = ready;
}

export function setHighlightClickInProgress(inProgress: boolean): void {
  highlightClickInProgress = inProgress;
}

export function getHighlightClickInProgress(): boolean {
  return highlightClickInProgress;
}

export function getSplitScreenMode(): boolean {
  return splitScreenMode;
}

// ============================================================================
// Split Screen Mode Detection
// ============================================================================

/**
 * Check if split screen mode is enabled (cached after first check)
 * Note: chrome.sidePanel API is NOT available in content scripts, only in background.
 * So we must always ask the background script for the actual setting.
 * The background script handles Firefox detection and returns splitScreenMode: false for it.
 */
async function checkSplitScreenMode(): Promise<boolean> {
  if (splitScreenModeChecked) {
    log.debug('[checkSplitScreenMode] Using cached value:', splitScreenMode);
    return splitScreenMode;
  }
  
  log.debug('[checkSplitScreenMode] Fetching split screen mode from background...');
  
  // Always ask the background script for split screen mode setting
  // The background script has access to chrome.sidePanel and handles browser detection
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (response) => {
        if (chrome.runtime.lastError) {
          log.warn('[checkSplitScreenMode] Error getting settings:', chrome.runtime.lastError.message);
          splitScreenModeChecked = true;
          splitScreenMode = false;
          resolve(false);
          return;
        }
        splitScreenMode = response?.success && response.data?.splitScreenMode === true;
        splitScreenModeChecked = true;
        log.debug('[checkSplitScreenMode] Split screen mode from settings:', splitScreenMode);
        resolve(splitScreenMode);
      });
    } else {
      log.warn('[checkSplitScreenMode] chrome.runtime.sendMessage not available');
      splitScreenModeChecked = true;
      splitScreenMode = false;
      resolve(false);
    }
  });
}

/**
 * Force refresh of split screen mode setting (call when settings change)
 */
export function refreshSplitScreenMode(): void {
  splitScreenModeChecked = false;
}

/**
 * Initialize split screen mode check (call early in content script lifecycle)
 */
export async function initializeSplitScreenMode(): Promise<boolean> {
  return checkSplitScreenMode();
}

/**
 * Open the native side panel (Chrome/Edge only, split screen mode)
 * Returns a promise that resolves when the panel is opened (or failed)
 * Note: This should be called only when splitScreenMode is already confirmed,
 * so the background can open the panel immediately without checking settings.
 * 
 * On MacOS Chrome/Edge, the sidePanel API can be more restrictive.
 * This function includes retry logic to handle transient failures.
 */
async function openNativeSidePanel(retryCount = 0): Promise<boolean> {
  const MAX_RETRIES = 2;
  
  if (!splitScreenMode) {
    return false;
  }
  
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      // Send OPEN_SIDE_PANEL_IMMEDIATE - background will open immediately without settings check
      chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL_IMMEDIATE' }, (response) => {
        if (chrome.runtime.lastError) {
          log.warn('Failed to open native side panel:', chrome.runtime.lastError.message);
          // Retry on failure (helps with MacOS timing issues)
          if (retryCount < MAX_RETRIES) {
            setTimeout(() => {
              openNativeSidePanel(retryCount + 1).then(resolve);
            }, 100 * (retryCount + 1));
          } else {
            resolve(false);
          }
          return;
        }
        
        const opened = response?.success && response.data?.opened === true;
        if (!opened && retryCount < MAX_RETRIES) {
          // Retry if not opened (MacOS may need multiple attempts)
          log.debug(`Side panel open returned false, retrying (${retryCount + 1}/${MAX_RETRIES})...`);
          setTimeout(() => {
            openNativeSidePanel(retryCount + 1).then(resolve);
          }, 100 * (retryCount + 1));
        } else {
          if (!opened) {
            log.warn('Failed to open native side panel after retries, reason:', response?.data?.reason);
          }
          resolve(opened);
        }
      });
    } else {
      resolve(false);
    }
  });
}

/**
 * Open the panel (either native side panel or floating iframe)
 * This is a unified function that handles both modes automatically.
 * Should be called after scan operations complete to show results.
 */
export async function openPanel(): Promise<void> {
  log.info('[IFRAME-DEBUG] ===== openPanel() called =====');
  log.info('[IFRAME-DEBUG] Current URL:', window.location.href);
  log.info('[IFRAME-DEBUG] splitScreenMode (before check):', splitScreenMode);
  log.info('[IFRAME-DEBUG] splitScreenModeChecked:', splitScreenModeChecked);
  
  await checkSplitScreenMode();
  log.info('[IFRAME-DEBUG] splitScreenMode (after check):', splitScreenMode);
  
  if (splitScreenMode) {
    // In split screen mode, open the native side panel
    log.info('[IFRAME-DEBUG] Mode: NATIVE SIDE PANEL (split screen)');
    log.info('[IFRAME-DEBUG] Attempting to open native side panel...');
    const opened = await openNativeSidePanel();
    if (!opened) {
      log.warn('[IFRAME-DEBUG] Native side panel FAILED to open');
    } else {
      log.info('[IFRAME-DEBUG] Native side panel opened SUCCESSFULLY');
    }
  } else {
    // Floating mode - create and show iframe elements
    log.info('[IFRAME-DEBUG] Mode: FLOATING IFRAME');
    
    // Ensure body exists
    if (!document.body) {
      log.error('[IFRAME-DEBUG] CRITICAL ERROR: document.body not available!');
      return;
    }
    
    log.info('[IFRAME-DEBUG] Calling ensurePanelElements()...');
    ensurePanelElements();
    
    // Wait for iframe src to be set and for a paint cycle
    log.info('[IFRAME-DEBUG] Waiting for iframe src to be set...');
    await new Promise<void>(resolve => {
      let checkCount = 0;
      const checkAndResolve = () => {
        checkCount++;
        if (panelFrame && panelFrame.src) {
          log.info('[IFRAME-DEBUG] Iframe src is set after', checkCount, 'checks');
          resolve();
        } else {
          if (checkCount < 20) {
            requestAnimationFrame(checkAndResolve);
          }
        }
      };
      
      requestAnimationFrame(checkAndResolve);
      
      // Resolve after timeout to avoid infinite wait
      setTimeout(() => {
        log.info('[IFRAME-DEBUG] Wait timeout reached, panelFrame exists:', !!panelFrame, 'src:', panelFrame?.src);
        resolve();
      }, 100);
    });
    
    log.info('[IFRAME-DEBUG] Calling showPanelElements()...');
    showPanelElements();
    log.info('[IFRAME-DEBUG] ===== openPanel() complete =====');
  }
}

/**
 * Force reopen the floating panel iframe (useful for debugging)
 * Destroys and recreates the iframe
 */
export function forceReopenFloatingPanel(): void {
  log.debug('[forceReopenFloatingPanel] Forcing panel recreation...');
  
  // Remove existing elements
  if (panelFrame) {
    panelFrame.remove();
    panelFrame = null;
  }
  if (panelOverlay) {
    panelOverlay.remove();
    panelOverlay = null;
  }
  
  isPanelReady = false;
  panelMessageQueue.length = 0;
  
  // Recreate
  ensurePanelElements();
  showPanelElements();
}

// ============================================================================
// Panel Communication
// ============================================================================

/**
 * Send a message to the panel.
 * In floating mode: sends via postMessage to iframe
 * In split screen mode: sends via chrome.runtime to native side panel
 */
export function sendPanelMessage(type: string, payload?: unknown): void {
  // In split screen mode, send via chrome.runtime to the native side panel
  if (splitScreenMode) {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ 
        type: 'FORWARD_TO_PANEL', 
        payload: { type, payload } 
      });
    }
    return;
  }
  
  // Floating mode - send via postMessage to iframe
  if (!panelFrame) {
    return;
  }
  
  // Queue message if panel isn't ready
  if (!isPanelReady || !panelFrame.contentWindow) {
    panelMessageQueue.push({ type, payload });
    return;
  }
  
  panelFrame.contentWindow.postMessage({ type, payload }, '*');
}

/**
 * Send a message to the panel and wait for confirmation (split screen mode only).
 * This ensures the message is stored in pendingPanelState before returning.
 * In floating mode, behaves like sendPanelMessage.
 */
export async function sendPanelMessageAndWait(type: string, payload?: unknown): Promise<void> {
  // In split screen mode, wait for the background to confirm message storage
  if (splitScreenMode) {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({ 
          type: 'FORWARD_TO_PANEL', 
          payload: { type, payload } 
        }, () => {
          // Message has been processed by background and stored
          if (chrome.runtime.lastError) {
            log.warn('Failed to forward message to panel:', chrome.runtime.lastError.message);
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
  
  // Floating mode - same as sendPanelMessage (synchronous)
  sendPanelMessage(type, payload);
}

/**
 * Flush all queued messages to the panel.
 * If contentWindow is not available yet, retries after a short delay.
 */
export function flushPanelMessageQueue(retryCount = 0): void {
  const MAX_RETRIES = 5;
  const RETRY_DELAY = 100; // ms
  
  if (!panelFrame?.contentWindow) {
    if (retryCount < MAX_RETRIES && panelMessageQueue.length > 0) {
      log.debug(`Cannot flush panel queue: contentWindow not ready, retrying (${retryCount + 1}/${MAX_RETRIES})...`);
      setTimeout(() => flushPanelMessageQueue(retryCount + 1), RETRY_DELAY);
      return;
    }
    log.warn('Cannot flush panel queue: panel not available after retries');
    return;
  }
  
  log.debug(` Flushing ${panelMessageQueue.length} queued panel messages`);
  while (panelMessageQueue.length > 0) {
    const msg = panelMessageQueue.shift();
    if (msg) {
      log.debug(` sendPanelMessage: Sending queued '${msg.type}' to panel iframe`);
      panelFrame.contentWindow.postMessage(msg, '*');
    }
  }
}

// ============================================================================
// Panel Element Management
// ============================================================================

/**
 * Ensure panel elements exist (only in floating mode)
 * In split screen mode, the browser handles the panel via native side panel
 */
export function ensurePanelElements(): void {
  // Log browser info for debugging
  const userAgent = navigator.userAgent;
  const isMac = userAgent.includes('Mac');
  const isChrome = userAgent.includes('Chrome') && !userAgent.includes('Edg');
  const isEdge = userAgent.includes('Edg');
  log.info('[IFRAME-DEBUG] ensurePanelElements called - Browser:', isChrome ? 'Chrome' : isEdge ? 'Edge' : 'Other', '| MacOS:', isMac);
  log.info('[IFRAME-DEBUG] User Agent:', userAgent);
  log.info('[IFRAME-DEBUG] splitScreenMode:', splitScreenMode, '| splitScreenModeChecked:', splitScreenModeChecked);
  
  // In split screen mode, don't create floating iframe elements
  if (splitScreenMode) {
    log.info('[IFRAME-DEBUG] Skipping iframe creation - split screen mode is enabled');
    return;
  }
  
  log.info('[IFRAME-DEBUG] Creating floating panel elements (iframe mode)...');
  
  // Check document state
  log.info('[IFRAME-DEBUG] document.readyState:', document.readyState);
  log.info('[IFRAME-DEBUG] document.body exists:', !!document.body);
  log.info('[IFRAME-DEBUG] document.head exists:', !!document.head);
  
  // Check if styles are injected
  const styleEl = document.getElementById('xtm-styles');
  log.info('[IFRAME-DEBUG] XTM styles element exists:', !!styleEl);
  if (!styleEl) {
    log.warn('[IFRAME-DEBUG] WARNING: XTM styles not found in document! Panel may not display correctly.');
  } else {
    // Check if panel-frame styles are present
    const hasFrameStyle = styleEl.textContent?.includes('xtm-panel-frame');
    log.info('[IFRAME-DEBUG] Styles contain xtm-panel-frame:', hasFrameStyle);
  }
  
  // Create overlay
  if (!panelOverlay) {
    log.info('[IFRAME-DEBUG] Creating overlay element...');
    panelOverlay = document.createElement('div');
    panelOverlay.className = 'xtm-panel-overlay hidden';
    panelOverlay.id = 'xtm-panel-overlay';
    document.body.appendChild(panelOverlay);
    log.info('[IFRAME-DEBUG] Overlay created and appended to body');
  } else {
    log.info('[IFRAME-DEBUG] Overlay already exists');
  }
  
  // Create inline panel
  if (!panelFrame) {
    log.info('[IFRAME-DEBUG] Creating iframe element...');
    isPanelReady = false;
    panelMessageQueue.length = 0;
    
    panelFrame = document.createElement('iframe');
    panelFrame.className = 'xtm-panel-frame hidden';
    panelFrame.setAttribute('allow', 'clipboard-read; clipboard-write');
    panelFrame.setAttribute('frameBorder', '0');
    panelFrame.setAttribute('scrolling', 'no');
    panelFrame.id = 'xtm-panel-iframe';
    
    // Add detailed event listeners
    panelFrame.addEventListener('error', (err) => {
      log.error('[IFRAME-DEBUG] Iframe ERROR event:', err);
      log.error('[IFRAME-DEBUG] Error type:', err.type);
    });
    
    panelFrame.addEventListener('load', () => {
      log.info('[IFRAME-DEBUG] Iframe LOAD event fired - content should be loaded');
      log.info('[IFRAME-DEBUG] Iframe src after load:', panelFrame?.src);
      log.info('[IFRAME-DEBUG] Iframe contentWindow exists:', !!panelFrame?.contentWindow);
    });
    
    panelFrame.addEventListener('abort', () => {
      log.warn('[IFRAME-DEBUG] Iframe ABORT event - loading was aborted');
    });
    
    const panelUrl = chrome.runtime.getURL('panel/index.html');
    log.info('[IFRAME-DEBUG] Panel URL:', panelUrl);
    log.info('[IFRAME-DEBUG] chrome.runtime.id:', chrome.runtime.id);
    
    // Append to DOM first, then set src - required for Edge compatibility
    document.body.appendChild(panelFrame);
    log.info('[IFRAME-DEBUG] Iframe appended to body');
    log.info('[IFRAME-DEBUG] Iframe in DOM:', document.getElementById('xtm-panel-iframe') !== null);
    
    // Set src immediately after appending (more reliable across browsers)
    // Use a microtask to ensure DOM is updated
    Promise.resolve().then(() => {
      if (panelFrame && !panelFrame.src) {
        log.info('[IFRAME-DEBUG] Setting iframe src via Promise.resolve() microtask');
        panelFrame.src = panelUrl;
        log.info('[IFRAME-DEBUG] Iframe src set to:', panelFrame.src);
      } else if (panelFrame) {
        log.info('[IFRAME-DEBUG] Promise.resolve: src already set:', panelFrame.src);
      }
    });
    
    // Also use requestAnimationFrame as fallback for Edge
    requestAnimationFrame(() => {
      if (panelFrame && !panelFrame.src) {
        log.info('[IFRAME-DEBUG] Setting iframe src via requestAnimationFrame (fallback)');
        panelFrame.src = panelUrl;
      } else if (panelFrame) {
        log.info('[IFRAME-DEBUG] requestAnimationFrame: src already set:', panelFrame.src);
      }
    });
    
    // Final fallback with setTimeout for very slow browsers
    setTimeout(() => {
      if (panelFrame && !panelFrame.src) {
        log.info('[IFRAME-DEBUG] Setting iframe src via setTimeout (final fallback)');
        panelFrame.src = panelUrl;
      } else if (panelFrame) {
        log.info('[IFRAME-DEBUG] setTimeout: src is:', panelFrame.src);
      }
      
      // Log final state after all attempts
      if (panelFrame) {
        const rect = panelFrame.getBoundingClientRect();
        log.info('[IFRAME-DEBUG] Final iframe state - src:', panelFrame.src);
        log.info('[IFRAME-DEBUG] Final iframe rect:', JSON.stringify({ top: rect.top, right: rect.right, width: rect.width, height: rect.height }));
        log.info('[IFRAME-DEBUG] Final iframe classList:', panelFrame.classList.toString());
      }
    }, 100);
  } else {
    log.info('[IFRAME-DEBUG] Iframe already exists');
    log.info('[IFRAME-DEBUG] Existing iframe src:', panelFrame.src);
    log.info('[IFRAME-DEBUG] Existing iframe classList:', panelFrame.classList.toString());
  }
  
  // Install document click handler
  if (!documentClickHandlerInstalled) {
    document.addEventListener('click', handleDocumentClickForPanel, true);
    documentClickHandlerInstalled = true;
    log.info('[IFRAME-DEBUG] Document click handler installed');
  }
}

/**
 * Show panel elements (only in floating mode)
 * In split screen mode, the browser handles showing the panel via native side panel
 */
export function showPanelElements(): void {
  log.info('[IFRAME-DEBUG] showPanelElements called');
  log.info('[IFRAME-DEBUG] splitScreenMode:', splitScreenMode);
  
  // In split screen mode, don't show floating panel elements
  if (splitScreenMode) {
    log.info('[IFRAME-DEBUG] Skipping show - split screen mode is enabled');
    return;
  }
  
  log.info('[IFRAME-DEBUG] Showing floating panel...');
  log.info('[IFRAME-DEBUG] panelOverlay exists:', !!panelOverlay);
  log.info('[IFRAME-DEBUG] panelFrame exists:', !!panelFrame);
  
  if (!panelFrame) {
    log.error('[IFRAME-DEBUG] ERROR: panelFrame is null! Cannot show panel. Call ensurePanelElements() first.');
    return;
  }
  
  if (!panelOverlay) {
    log.warn('[IFRAME-DEBUG] WARNING: panelOverlay is null');
  }
  
  // Log state BEFORE removing hidden class
  log.info('[IFRAME-DEBUG] Before show - panelFrame.classList:', panelFrame.classList.toString());
  log.info('[IFRAME-DEBUG] Before show - panelFrame.src:', panelFrame.src);
  
  const computedBefore = window.getComputedStyle(panelFrame);
  log.info('[IFRAME-DEBUG] Before show - computed styles:', JSON.stringify({
    transform: computedBefore.transform,
    visibility: computedBefore.visibility,
    display: computedBefore.display,
    opacity: computedBefore.opacity,
    position: computedBefore.position,
    right: computedBefore.right,
    width: computedBefore.width,
    height: computedBefore.height,
    zIndex: computedBefore.zIndex,
  }));
  
  // Remove hidden class
  panelOverlay?.classList.remove('hidden');
  panelFrame.classList.remove('hidden');
  
  // Log state AFTER removing hidden class
  log.info('[IFRAME-DEBUG] After show - panelFrame.classList:', panelFrame.classList.toString());
  
  const computedAfter = window.getComputedStyle(panelFrame);
  log.info('[IFRAME-DEBUG] After show - computed styles:', JSON.stringify({
    transform: computedAfter.transform,
    visibility: computedAfter.visibility,
    display: computedAfter.display,
    opacity: computedAfter.opacity,
    position: computedAfter.position,
    right: computedAfter.right,
    width: computedAfter.width,
    height: computedAfter.height,
    zIndex: computedAfter.zIndex,
  }));
  
  // Log bounding rect
  const rect = panelFrame.getBoundingClientRect();
  log.info('[IFRAME-DEBUG] After show - bounding rect:', JSON.stringify({
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  }));
  
  // Check if panel is actually visible on screen
  const isOnScreen = rect.right > 0 && rect.width > 0 && rect.height > 0;
  log.info('[IFRAME-DEBUG] Panel appears to be on screen:', isOnScreen);
  
  // Log viewport info
  log.info('[IFRAME-DEBUG] Viewport:', JSON.stringify({
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
  }));
}

/**
 * Hide the panel
 */
export function hidePanel(): void {
  if (panelFrame) {
    panelFrame.classList.add('hidden');
  }
  if (panelOverlay) {
    panelOverlay.classList.add('hidden');
  }
}

/**
 * Check if panel is hidden
 * In split screen mode, always returns false (browser manages panel visibility)
 */
export function isPanelHidden(): boolean {
  // In split screen mode, the panel is managed by the browser
  // We return false to prevent the content script from trying to re-open it
  if (splitScreenMode) {
    return false;
  }
  return panelFrame?.classList.contains('hidden') ?? true;
}

// ============================================================================
// Click Handling
// ============================================================================

/**
 * Document click handler for closing panel when clicking outside
 */
function handleDocumentClickForPanel(e: MouseEvent): void {
  if (panelFrame?.classList.contains('hidden')) {
    return;
  }
  
  if (highlightClickInProgress) {
    return;
  }
  
  const target = e.target as HTMLElement;
  
  if (panelFrame && (target === panelFrame || panelFrame.contains(target))) {
    return;
  }
  
  if (target.closest('.xtm-highlight')) {
    return;
  }
  
  if (target.closest('[class*="xtm-"]')) {
    return;
  }
  
  const panelAreaStart = window.innerWidth - 560;
  if (e.clientX >= panelAreaStart) {
    return;
  }
  
  hidePanel();
}

// ============================================================================
// Theme Helper
// ============================================================================

/**
 * Get current theme from background
 */
export async function getCurrentTheme(): Promise<'dark' | 'light'> {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'GET_PLATFORM_THEME' }, (response) => {
        if (chrome.runtime.lastError || !response?.success) {
          resolve('dark');
          return;
        }
        resolve(response.data === 'light' ? 'light' : 'dark');
      });
    } else {
      resolve('dark');
    }
  });
}

// ============================================================================
// Panel Show Functions
// ============================================================================

/**
 * Show panel with entity details
 * @param entity The entity to show
 * @param platformMatches Optional platform matches for multi-platform entities
 * @param fromScanResults Whether we're navigating from scan results (shows "Back to scan results" link)
 * @param scanResults The full scan results to restore in panel (needed when panel was closed and reopened)
 */
export async function showPanel(
  entity: DetectedObservable | DetectedOCTIEntity,
  platformMatches?: Array<{ platformId: string; entityId: string; entityData?: unknown }>,
  fromScanResults?: boolean,
  scanResults?: { observables: DetectedObservable[]; openctiEntities: DetectedOCTIEntity[] } | null
): Promise<void> {
  await checkSplitScreenMode();
  
  const theme = await getCurrentTheme();
  const messagePayload = { 
    ...entity, 
    existsInPlatform: entity.found ?? false, 
    theme,
    platformMatches,
    fromScanResults: fromScanResults ?? false,
    scanResults: scanResults ?? null,
  };
  
  if (splitScreenMode) {
    // In split screen mode, send message BEFORE opening panel to avoid race condition
    await sendPanelMessageAndWait('SHOW_ENTITY', messagePayload);
    await openNativeSidePanel();
  } else {
    // Floating mode - create elements, show, then send message
    ensurePanelElements();
    showPanelElements();
    sendPanelMessage('SHOW_ENTITY', messagePayload);
  }
}

/**
 * Show add panel for non-existing entities
 */
export async function showAddPanel(entity: DetectedObservable | DetectedOCTIEntity): Promise<void> {
  await checkSplitScreenMode();
  
  if (splitScreenMode) {
    await sendPanelMessageAndWait('SHOW_ADD_ENTITY', entity);
    await openNativeSidePanel();
  } else {
    ensurePanelElements();
    showPanelElements();
    sendPanelMessage('SHOW_ADD_ENTITY', entity);
  }
}

/**
 * Show preview panel with selected entities
 */
export async function showPreviewPanel(
  selectedEntities: Array<DetectedObservable | DetectedOCTIEntity>
): Promise<void> {
  await checkSplitScreenMode();
  
  const article = extractArticleContent();
  const description = extractFirstParagraph(article.textContent);
  const theme = await getCurrentTheme();
  
  const messagePayload = { 
    entities: selectedEntities, 
    pageUrl: window.location.href, 
    pageTitle: article.title,
    pageContent: article.textContent,
    pageHtmlContent: article.content,
    pageDescription: description,
    pageExcerpt: article.excerpt,
    theme: theme,
  };
  
  if (splitScreenMode) {
    await sendPanelMessageAndWait('SHOW_PREVIEW', messagePayload);
    await openNativeSidePanel();
  } else {
    ensurePanelElements();
    showPanelElements();
    sendPanelMessage('SHOW_PREVIEW', messagePayload);
  }
}

/**
 * Show container creation panel
 */
export async function showContainerPanel(): Promise<void> {
  await checkSplitScreenMode();
  
  const article = extractArticleContent();
  const description = extractFirstParagraph(article.textContent);
  const theme = await getCurrentTheme();
  
  const messagePayload = { 
    pageUrl: window.location.href, 
    pageTitle: article.title,
    pageContent: article.textContent,
    pageHtmlContent: article.content,
    pageDescription: description,
    pageExcerpt: article.excerpt,
    theme: theme,
  };
  
  if (splitScreenMode) {
    await sendPanelMessageAndWait('SHOW_CREATE_CONTAINER', messagePayload);
    await openNativeSidePanel();
  } else {
    ensurePanelElements();
    showPanelElements();
    sendPanelMessage('SHOW_CREATE_CONTAINER', messagePayload);
  }
}

/**
 * Show investigation panel
 */
export async function showInvestigationPanel(): Promise<void> {
  await checkSplitScreenMode();
  
  const theme = await getCurrentTheme();
  const messagePayload = { theme };
  
  if (splitScreenMode) {
    await sendPanelMessageAndWait('SHOW_INVESTIGATION_PANEL', messagePayload);
    await openNativeSidePanel();
  } else {
    ensurePanelElements();
    showPanelElements();
    sendPanelMessage('SHOW_INVESTIGATION_PANEL', messagePayload);
  }
}

/**
 * Show search panel
 */
export async function showSearchPanel(): Promise<void> {
  await checkSplitScreenMode();
  
  const theme = await getCurrentTheme();
  const messagePayload = { theme };
  
  if (splitScreenMode) {
    await sendPanelMessageAndWait('SHOW_SEARCH_PANEL', messagePayload);
    await openNativeSidePanel();
  } else {
    ensurePanelElements();
    showPanelElements();
    sendPanelMessage('SHOW_SEARCH_PANEL', messagePayload);
  }
}

/**
 * Show unified search panel
 */
export async function showUnifiedSearchPanel(initialQuery?: string): Promise<void> {
  await checkSplitScreenMode();
  
  const theme = await getCurrentTheme();
  const messagePayload = { theme, initialQuery };
  
  if (splitScreenMode) {
    await sendPanelMessageAndWait('SHOW_UNIFIED_SEARCH_PANEL', messagePayload);
    await openNativeSidePanel();
  } else {
    ensurePanelElements();
    showPanelElements();
    sendPanelMessage('SHOW_UNIFIED_SEARCH_PANEL', messagePayload);
  }
}

/**
 * Show add selection panel (context menu)
 */
export async function showAddSelectionPanel(selectedText: string): Promise<void> {
  await checkSplitScreenMode();
  
  const theme = await getCurrentTheme();
  const messagePayload = { theme, selectedText };
  
  if (splitScreenMode) {
    await sendPanelMessageAndWait('SHOW_ADD_SELECTION', messagePayload);
    await openNativeSidePanel();
  } else {
    ensurePanelElements();
    showPanelElements();
    sendPanelMessage('SHOW_ADD_SELECTION', messagePayload);
  }
}

