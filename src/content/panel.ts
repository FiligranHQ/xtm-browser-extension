/**
 * Panel Management Module
 * Handles the side panel iframe and panel communication.
 */

import { loggers } from '../shared/utils/logger';
import type { DetectedObservable, DetectedSDO } from '../shared/types';
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

// ============================================================================
// Panel Communication
// ============================================================================

/**
 * Send a message to the panel iframe.
 * If the panel is not ready yet, the message is queued.
 */
export function sendPanelMessage(type: string, payload?: unknown): void {
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
 * Ensure panel elements exist
 */
export function ensurePanelElements(): void {
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
 * Show panel elements
 */
export function showPanelElements(): void {
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
 */
export function isPanelHidden(): boolean {
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
  entity: DetectedObservable | DetectedSDO,
  platformMatches?: Array<{ platformId: string; entityId: string; entityData?: unknown }>
): Promise<void> {
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
export function showAddPanel(entity: DetectedObservable | DetectedSDO): void {
  ensurePanelElements();
  showPanelElements();
  
  sendPanelMessage('SHOW_ADD_ENTITY', entity);
}

/**
 * Show preview panel with selected entities
 */
export async function showPreviewPanel(
  selectedEntities: Array<DetectedObservable | DetectedSDO>
): Promise<void> {
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
  ensurePanelElements();
  showPanelElements();
  
  const theme = await getCurrentTheme();
  
  sendPanelMessage('SHOW_INVESTIGATION_PANEL', { theme });
}

/**
 * Show search panel
 */
export async function showSearchPanel(): Promise<void> {
  ensurePanelElements();
  showPanelElements();
  
  const theme = await getCurrentTheme();
  
  sendPanelMessage('SHOW_SEARCH_PANEL', { theme });
}

/**
 * Show OpenAEV search panel
 */
export async function showOAEVSearchPanel(): Promise<void> {
  ensurePanelElements();
  showPanelElements();
  
  const theme = await getCurrentTheme();
  
  sendPanelMessage('SHOW_OAEV_SEARCH_PANEL', { theme });
}

/**
 * Show unified search panel
 */
export async function showUnifiedSearchPanel(initialQuery?: string): Promise<void> {
  ensurePanelElements();
  showPanelElements();
  
  const theme = await getCurrentTheme();
  
  sendPanelMessage('SHOW_UNIFIED_SEARCH_PANEL', { theme, initialQuery });
}

/**
 * Show add selection panel (context menu)
 */
export async function showAddSelectionPanel(selectedText: string): Promise<void> {
  ensurePanelElements();
  showPanelElements();
  
  const theme = await getCurrentTheme();
  
  sendPanelMessage('SHOW_ADD_SELECTION', { theme, selectedText });
}

