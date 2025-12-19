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
    return splitScreenMode;
  }
  
  // Always ask the background script for split screen mode setting
  // The background script has access to chrome.sidePanel and handles browser detection
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (response) => {
        if (chrome.runtime.lastError) {
          splitScreenModeChecked = true;
          splitScreenMode = false;
          resolve(false);
          return;
        }
        splitScreenMode = response?.success && response.data?.splitScreenMode === true;
        splitScreenModeChecked = true;
        resolve(splitScreenMode);
      });
    } else {
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
    
    panelFrame.addEventListener('error', (err) => {
      log.error('Iframe error event:', err);
    });
    
    const panelUrl = chrome.runtime.getURL('panel/index.html');
    
    // Append to DOM first, then set src - required for Edge compatibility
    document.body.appendChild(panelFrame);
    
    // Use requestAnimationFrame to set src - helps Edge process the iframe
    requestAnimationFrame(() => {
      if (panelFrame) {
        panelFrame.src = panelUrl;
      }
    });
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
  
  panelOverlay?.classList.remove('hidden');
  panelFrame?.classList.remove('hidden');
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
 */
export async function showPanel(
  entity: DetectedObservable | DetectedOCTIEntity,
  platformMatches?: Array<{ platformId: string; entityId: string; entityData?: unknown }>
): Promise<void> {
  // Ensure split screen mode is checked first
  await checkSplitScreenMode();
  
  ensurePanelElements();
  showPanelElements();
  
  const theme = await getCurrentTheme();
  
  sendPanelMessage('SHOW_ENTITY', { 
    ...entity, 
    existsInPlatform: entity.found ?? false, 
    theme,
    platformMatches,
  });
}

/**
 * Show add panel for non-existing entities
 */
export async function showAddPanel(entity: DetectedObservable | DetectedOCTIEntity): Promise<void> {
  await checkSplitScreenMode();
  
  ensurePanelElements();
  showPanelElements();
  
  sendPanelMessage('SHOW_ADD_ENTITY', entity);
}

/**
 * Show preview panel with selected entities
 */
export async function showPreviewPanel(
  selectedEntities: Array<DetectedObservable | DetectedOCTIEntity>
): Promise<void> {
  await checkSplitScreenMode();
  
  ensurePanelElements();
  showPanelElements();
  
  const article = extractArticleContent();
  const description = extractFirstParagraph(article.textContent);
  const theme = await getCurrentTheme();
  
  sendPanelMessage('SHOW_PREVIEW', { 
    entities: selectedEntities, 
    pageUrl: window.location.href, 
    pageTitle: article.title,
    pageContent: article.textContent,
    pageHtmlContent: article.content,
    pageDescription: description,
    pageExcerpt: article.excerpt,
    theme: theme,
  });
}

/**
 * Show container creation panel
 */
export async function showContainerPanel(): Promise<void> {
  await checkSplitScreenMode();
  
  ensurePanelElements();
  showPanelElements();
  
  const article = extractArticleContent();
  const description = extractFirstParagraph(article.textContent);
  const theme = await getCurrentTheme();
  
  sendPanelMessage('SHOW_CREATE_CONTAINER', { 
    pageUrl: window.location.href, 
    pageTitle: article.title,
    pageContent: article.textContent,
    pageHtmlContent: article.content,
    pageDescription: description,
    pageExcerpt: article.excerpt,
    theme: theme,
  });
}

/**
 * Show investigation panel
 */
export async function showInvestigationPanel(): Promise<void> {
  await checkSplitScreenMode();
  
  ensurePanelElements();
  showPanelElements();
  
  const theme = await getCurrentTheme();
  
  sendPanelMessage('SHOW_INVESTIGATION_PANEL', { theme });
}

/**
 * Show search panel
 */
export async function showSearchPanel(): Promise<void> {
  await checkSplitScreenMode();
  
  ensurePanelElements();
  showPanelElements();
  
  const theme = await getCurrentTheme();
  
  sendPanelMessage('SHOW_SEARCH_PANEL', { theme });
}

/**
 * Show unified search panel
 */
export async function showUnifiedSearchPanel(initialQuery?: string): Promise<void> {
  await checkSplitScreenMode();
  
  ensurePanelElements();
  showPanelElements();
  
  const theme = await getCurrentTheme();
  
  sendPanelMessage('SHOW_UNIFIED_SEARCH_PANEL', { theme, initialQuery });
}

/**
 * Show add selection panel (context menu)
 */
export async function showAddSelectionPanel(selectedText: string): Promise<void> {
  await checkSplitScreenMode();
  
  ensurePanelElements();
  showPanelElements();
  
  const theme = await getCurrentTheme();
  
  sendPanelMessage('SHOW_ADD_SELECTION', { theme, selectedText });
}

