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
 */
async function checkSplitScreenMode(): Promise<boolean> {
  if (splitScreenModeChecked) {
    return splitScreenMode;
  }
  
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (response) => {
        if (chrome.runtime.lastError) {
          splitScreenModeChecked = true;
          resolve(false);
          return;
        }
        splitScreenMode = response?.success && response.data?.splitScreenMode === true;
        splitScreenModeChecked = true;
        log.debug('[PANEL] Split screen mode:', splitScreenMode);
        resolve(splitScreenMode);
      });
    } else {
      splitScreenModeChecked = true;
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
    log.debug(` sendPanelMessage [SPLIT]: Sending '${type}' via runtime`);
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ 
        type: 'FORWARD_TO_PANEL', 
        payload: { type, payload } 
      });
    }
    return;
  }
  
  // Floating mode - send via postMessage to iframe
  if (!panelFrame?.contentWindow) {
    log.debug(`Cannot send panel message '${type}': panel not available`);
    return;
  }
  
  if (!isPanelReady) {
    log.debug(` sendPanelMessage: Panel not ready, queuing '${type}'`);
    panelMessageQueue.push({ type, payload });
    return;
  }
  
  log.debug(` sendPanelMessage: Sending '${type}' to panel iframe`);
  panelFrame.contentWindow.postMessage({ type, payload }, '*');
}

/**
 * Flush all queued messages to the panel.
 */
export function flushPanelMessageQueue(): void {
  if (!panelFrame?.contentWindow) {
    log.warn('Cannot flush panel queue: panel not available');
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
 * In split screen mode, the browser handles the panel
 */
export function ensurePanelElements(): void {
  // In split screen mode, don't create floating iframe elements
  if (splitScreenMode) {
    log.debug('[PANEL] Split screen mode - skipping floating panel elements');
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
    panelFrame.src = chrome.runtime.getURL('panel/index.html');
    document.body.appendChild(panelFrame);
  }
  
  // Install document click handler
  if (!documentClickHandlerInstalled) {
    document.addEventListener('click', handleDocumentClickForPanel, true);
    documentClickHandlerInstalled = true;
  }
}

/**
 * Show panel elements (only in floating mode)
 * In split screen mode, the browser handles showing the panel
 */
export function showPanelElements(): void {
  // In split screen mode, don't show floating panel elements
  if (splitScreenMode) {
    log.debug('[SHOW-PANEL-ELEMENTS] Split screen mode - skipping floating panel show');
    return;
  }
  
  log.debug('[SHOW-PANEL-ELEMENTS] Called, panelOverlay:', !!panelOverlay, 'panelFrame:', !!panelFrame);
  
  // Check if styles are injected
  const styleEl = document.getElementById('xtm-styles');
  log.debug('[SHOW-PANEL-ELEMENTS] Style element exists:', !!styleEl);
  if (styleEl) {
    const hasFrameStyle = styleEl.textContent?.includes('xtm-panel-frame');
    log.debug('[SHOW-PANEL-ELEMENTS] Style contains xtm-panel-frame:', hasFrameStyle);
  }
  
  panelOverlay?.classList.remove('hidden');
  panelFrame?.classList.remove('hidden');
  
  // Log computed styles to debug
  if (panelFrame) {
    const computed = window.getComputedStyle(panelFrame);
    log.debug('[SHOW-PANEL-ELEMENTS] panelFrame computed:', {
      transform: computed.transform,
      visibility: computed.visibility,
      display: computed.display,
      position: computed.position,
      right: computed.right,
      width: computed.width,
    });
  }
  
  log.debug('[SHOW-PANEL-ELEMENTS] After removing hidden class, panelFrame.classList:', panelFrame?.classList.toString());
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
  
  log.debug(' showPreviewPanel - title:', article.title, 'textContent length:', article.textContent?.length);
  
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
  
  log.debug(' showContainerPanel - title:', article.title, 'textContent length:', article.textContent?.length);
  
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

