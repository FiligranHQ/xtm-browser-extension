/**
 * Panel Management Module
 * Handles the side panel iframe and panel communication.
 * Supports two modes:
 * - Floating mode (default): Panel is an injected iframe, communication via postMessage
 * - Split screen mode: Panel is browser's native side panel/sidebar, communication via chrome.runtime
 * 
 * Browser support for split screen mode:
 * - Chrome/Edge: Uses chrome.sidePanel API
 * - Firefox: Uses browser.sidebarAction API
 * 
 * The sidebar/panel opens automatically when triggered from popup (scan, search, etc.).
 * Messages are forwarded via background script and queued if panel is not yet open.
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
 * Check if split screen mode is enabled
 * Note: Side panel APIs are NOT available in content scripts, only in background/popup.
 * So we must always ask the background script for the actual setting.
 * 
 * Browser support:
 * - Chrome/Edge: Uses chrome.sidePanel API
 * - Firefox: Uses browser.sidebarAction API
 * 
 * Both browsers open the panel/sidebar automatically when triggered from popup.
 * 
 * @param forceRefresh - If true, always fetch fresh value from background (don't use cache)
 */
async function checkSplitScreenMode(forceRefresh = false): Promise<boolean> {
  if (splitScreenModeChecked && !forceRefresh) {
    log.debug('[checkSplitScreenMode] Using cached value:', splitScreenMode);
    return splitScreenMode;
  }
  
  log.debug('[checkSplitScreenMode] Fetching split screen mode from background... (forceRefresh:', forceRefresh, ')');
  
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
        const newValue = response?.success && response.data?.splitScreenMode === true;
        if (splitScreenModeChecked && newValue !== splitScreenMode) {
          log.info('[checkSplitScreenMode] Split screen mode CHANGED from', splitScreenMode, 'to', newValue);
        }
        splitScreenMode = newValue;
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
 * Open the native side panel (Chrome/Edge) or sidebar (Firefox)
 * Returns a promise that resolves when the panel is opened (or the request is sent)
 * 
 * Note: This should be called only when splitScreenMode is already confirmed,
 * so the background can open the panel immediately without checking settings.
 * 
 * Browser behavior:
 * - Chrome/Edge: Opens the sidePanel via chrome.sidePanel.open() (background script)
 * - Firefox: Popup opens sidebar via browser.sidebarAction.open() (requires user gesture)
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
      // Send OPEN_SIDE_PANEL_IMMEDIATE - background will open for Chrome/Edge
      // For Firefox, the popup already opened the sidebar, background just confirms
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
        const reason = response?.data?.reason || '';
        const isUserGestureError = reason.includes('user gesture') || reason.includes('User gesture');
        const isFirefoxHandled = reason === 'firefox_popup_handles';
        
        if (!opened && !isUserGestureError && !isFirefoxHandled && retryCount < MAX_RETRIES) {
          // Retry if not opened (MacOS may need multiple attempts)
          // Don't retry if it's a user gesture error - panel is likely already open
          // Don't retry on Firefox - popup already handled sidebar opening
          log.debug(`Side panel open returned false, retrying (${retryCount + 1}/${MAX_RETRIES})...`);
          setTimeout(() => {
            openNativeSidePanel(retryCount + 1).then(resolve);
          }, 100 * (retryCount + 1));
        } else {
          if (!opened && !isUserGestureError && !isFirefoxHandled) {
            log.debug('Failed to open native side panel, reason:', reason);
          }
          // Resolve true for user gesture errors - panel is likely already open from popup
          // Resolve true for Firefox - popup already opened the sidebar
          resolve(opened || isUserGestureError || isFirefoxHandled);
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
 * 
 * In split screen mode: The popup opens the native side panel immediately (in user gesture context).
 * The content script just tries to open it again as a fallback, but doesn't fall back to iframe.
 * 
 * In floating mode: The content script creates and shows the iframe panel.
 */
export async function openPanel(): Promise<void> {
  // Always fetch fresh settings to avoid stale cache issues
  await checkSplitScreenMode(true);
  
  if (splitScreenMode) {
    // In split screen mode, the popup should have already opened the native side panel
    // (in user gesture context). We try here as a fallback but don't fall back to iframe.
    await openNativeSidePanel();
    return; // Don't create iframe in split screen mode
  }
  
  // Floating iframe mode
  if (!document.body) {
    log.error('Cannot open panel: document.body not available');
    return;
  }
  
  ensurePanelElements();
  
  // Wait for iframe src to be set
  await new Promise<void>(resolve => {
    let checkCount = 0;
    const checkAndResolve = () => {
      checkCount++;
      if (panelFrame && panelFrame.src) {
        resolve();
      } else if (checkCount < 20) {
        requestAnimationFrame(checkAndResolve);
      }
    };
    requestAnimationFrame(checkAndResolve);
    setTimeout(resolve, 100); // Timeout fallback
  });
  
  showPanelElements();
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
  // In split screen mode, don't create floating iframe elements
  if (splitScreenMode) {
    return;
  }
  
  // Create overlay
  if (!panelOverlay) {
    panelOverlay = document.createElement('div');
    panelOverlay.className = 'xtm-panel-overlay hidden';
    panelOverlay.id = 'xtm-panel-overlay';
    document.body.appendChild(panelOverlay);
  }
  
  // Create inline panel
  if (!panelFrame) {
    isPanelReady = false;
    panelMessageQueue.length = 0;
    
    panelFrame = document.createElement('iframe');
    panelFrame.className = 'xtm-panel-frame hidden';
    panelFrame.setAttribute('allow', 'clipboard-read; clipboard-write');
    panelFrame.setAttribute('frameBorder', '0');
    panelFrame.setAttribute('scrolling', 'no');
    panelFrame.id = 'xtm-panel-iframe';
    
    panelFrame.addEventListener('error', (err) => {
      log.error('Iframe error:', err);
    });
    
    const panelUrl = chrome.runtime.getURL('panel/index.html');
    
    // Append to DOM first, then set src - required for Edge compatibility
    document.body.appendChild(panelFrame);
    
    // Set src using multiple strategies for cross-browser compatibility
    Promise.resolve().then(() => {
      if (panelFrame && !panelFrame.src) {
        panelFrame.src = panelUrl;
      }
    });
    
    requestAnimationFrame(() => {
      if (panelFrame && !panelFrame.src) {
        panelFrame.src = panelUrl;
      }
    });
    
    setTimeout(() => {
      if (panelFrame && !panelFrame.src) {
        panelFrame.src = panelUrl;
      }
    }, 100);
  }
  
  // Install document click handler
  if (!documentClickHandlerInstalled) {
    document.addEventListener('click', handleDocumentClickForPanel, true);
    documentClickHandlerInstalled = true;
  }
}

/**
 * Show panel elements (only in floating mode)
 * In split screen mode, the browser handles showing the panel via native side panel
 */
export function showPanelElements(): void {
  // In split screen mode, don't show floating panel elements
  if (splitScreenMode) {
    return;
  }
  
  if (!panelFrame) {
    log.error('Cannot show panel: panelFrame is null');
    return;
  }
  
  panelOverlay?.classList.remove('hidden');
  panelFrame.classList.remove('hidden');
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
  await checkSplitScreenMode(true); // Always fetch fresh settings
  
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
  await checkSplitScreenMode(true); // Always fetch fresh settings
  
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
  await checkSplitScreenMode(true); // Always fetch fresh settings
  
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
  await checkSplitScreenMode(true); // Always fetch fresh settings
  
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
  await checkSplitScreenMode(true); // Always fetch fresh settings
  
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
  await checkSplitScreenMode(true); // Always fetch fresh settings
  
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
  await checkSplitScreenMode(true); // Always fetch fresh settings
  
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
  await checkSplitScreenMode(true); // Always fetch fresh settings
  
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

