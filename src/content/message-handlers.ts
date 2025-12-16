/**
 * Content Script Message Handlers
 * 
 * Handles messages from background script and panel iframe.
 */

import { loggers } from '../shared/utils/logger';
import type { DetectedObservable, DetectedSDO, ScanResultPayload, ObservableType } from '../shared/types';

const log = loggers.content;

/**
 * Message handler context
 * Contains all the state and functions needed by handlers
 */
export interface MessageHandlerContext {
  // State
  scanResults: ScanResultPayload | null;
  selectedEntity: DetectedObservable | DetectedSDO | null;
  selectedForImport: Set<string>;
  currentScanMode: 'scan' | 'atomic' | 'scenario' | 'investigation' | null;
  lastScanData: ScanResultPayload | null;
  
  // State setters
  setScanResults: (results: ScanResultPayload | null) => void;
  setSelectedEntity: (entity: DetectedObservable | DetectedSDO | null) => void;
  setCurrentScanMode: (mode: 'scan' | 'atomic' | 'scenario' | 'investigation' | null) => void;
  setLastScanData: (data: ScanResultPayload | null) => void;
  
  // Selection handlers
  toggleSelection: (element: HTMLElement, value: string) => void;
  handleSelectAll: (values: string[]) => void;
  handleDeselectAll: () => void;
  handleDeselectItem: (value: string) => void;
  
  // Panel functions
  showPanel: () => void;
  hidePanel: () => void;
  isPanelHidden: () => boolean;
  showPreviewPanel: (entities: Array<{ type: string; value?: string; name?: string }>, pageContent: string, pageUrl: string, pageTitle: string, pageDescription?: string, pageHtmlContent?: string) => void;
  showContainerPanel: (pageContent: string, pageUrl: string, pageTitle: string, pageDescription?: string, pageHtmlContent?: string) => void;
  showInvestigationPanel: (pageContent: string, pageUrl: string, pageTitle: string, pageDescription?: string) => void;
  showSearchPanel: (searchText: string, theme?: string) => void;
  showOAEVSearchPanel: (searchText: string, theme?: string) => void;
  showUnifiedSearchPanel: (searchText: string, theme?: string) => void;
  showAddSelectionPanel: (text: string) => void;
  sendPanelMessage: (type: string, payload?: unknown) => void;
  getCurrentTheme: () => Promise<'dark' | 'light'>;
  setIsPanelReady: (ready: boolean) => void;
  flushPanelMessageQueue: () => void;
  
  // Highlighting functions
  clearHighlights: () => void;
  highlightResults: (data: ScanResultPayload, clickHandler: (element: HTMLElement, value: string) => void) => number;
  highlightResultsForInvestigation: (data: ScanResultPayload, clickHandler: (element: HTMLElement, value: string) => void) => number;
  highlightForAtomicTesting: (data: ScanResultPayload) => void;
  highlightScenarioAttackPatterns: (data: ScanResultPayload) => void;
  highlightAIEntities: (entities: Array<{ type: string; value: string; name: string }>, clickHandler: (element: HTMLElement, value: string) => void) => number;
  scrollToFirstHighlight: () => void;
  
  // Content extraction functions
  extractArticleContent: () => string | null;
  generateArticlePDF: () => Promise<string | null>;
  generateCleanDescription: () => string;
  getComprehensivePageContent: () => { text: string; html: string };
  detectDomainsAndHostnamesForAtomicTesting: () => Array<{ type: string; value: string }>;
  
  // Toast functions
  showToast: (options: {
    type: 'success' | 'info' | 'warning' | 'error';
    message: string;
    action?: { label: string; type: string };
    persistent?: boolean;
    duration?: number;
  }) => void;
  hideToast: () => void;
}

/**
 * Handle messages from the background script
 */
export function createBackgroundMessageHandler(ctx: MessageHandlerContext) {
  return async function handleBackgroundMessage(
    message: { type: string; payload?: unknown },
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void
  ): Promise<boolean> {
    log.debug('Received message from background:', message.type);
    
    switch (message.type) {
      case 'PING':
        sendResponse({ success: true, pong: true });
        break;
        
      case 'SCAN_PAGE':
        await handleScanPage(ctx, false);
        sendResponse({ success: true });
        break;
        
      case 'AUTO_SCAN_PAGE':
        await handleScanPage(ctx, true);
        sendResponse({ success: true });
        break;
        
      case 'SCAN_OAEV':
        await handleScanOAEV(ctx);
        sendResponse({ success: true });
        break;
        
      case 'SCAN_ALL':
        await handleScanAll(ctx);
        sendResponse({ success: true });
        break;
        
      case 'SCAN_ATOMIC_TESTING':
        await handleScanAtomicTesting(ctx);
        sendResponse({ success: true });
        break;
        
      case 'CREATE_SCENARIO_FROM_PAGE':
        await handleCreateScenarioFromPage(ctx);
        sendResponse({ success: true });
        break;
        
      case 'CLEAR_HIGHLIGHTS':
        ctx.clearHighlights();
        ctx.selectedForImport.clear();
        sendResponse({ success: true });
        break;
        
      case 'SCAN_FOR_INVESTIGATION':
        await handleScanForInvestigation(ctx);
        sendResponse({ success: true });
        break;
        
      case 'HIDE_PANEL':
        ctx.hidePanel();
        sendResponse({ success: true });
        break;
        
      case 'GET_PAGE_CONTENT':
        sendResponse({
          success: true,
          data: ctx.getComprehensivePageContent(),
        });
        break;
        
      case 'GET_ARTICLE_CONTENT':
        sendResponse({
          success: true,
          data: ctx.extractArticleContent(),
        });
        break;
        
      case 'CREATE_CONTAINER_FROM_PAGE':
        await handleCreateContainerFromPage(ctx);
        sendResponse({ success: true });
        break;
        
      case 'CREATE_INVESTIGATION':
        await handleCreateInvestigation(ctx);
        sendResponse({ success: true });
        break;
        
      case 'OPEN_SEARCH_PANEL':
        ctx.showSearchPanel('');
        sendResponse({ success: true });
        break;
        
      case 'OPEN_OAEV_SEARCH_PANEL':
        ctx.showOAEVSearchPanel('');
        sendResponse({ success: true });
        break;
        
      case 'OPEN_UNIFIED_SEARCH_PANEL':
        ctx.showUnifiedSearchPanel('');
        sendResponse({ success: true });
        break;
        
      case 'SEARCH_SELECTION':
        handleSearchSelection(ctx, message.payload);
        sendResponse({ success: true });
        break;
        
      case 'ADD_SELECTION':
        handleAddSelection(ctx, message.payload);
        sendResponse({ success: true });
        break;
        
      case 'GENERATE_PDF':
        const pdfData = await ctx.generateArticlePDF();
        sendResponse({
          success: !!pdfData,
          data: pdfData,
        });
        break;
        
      case 'GET_SELECTION':
        sendResponse({
          success: true,
          data: {
            selectedCount: ctx.selectedForImport.size,
            selectedItems: Array.from(ctx.selectedForImport),
          },
        });
        break;
        
      case 'CLEAR_SELECTION':
        ctx.handleDeselectAll();
        sendResponse({ success: true });
        break;
        
      case 'ENTITY_ADDED':
        handleEntityAdded(ctx, message.payload);
        sendResponse({ success: true });
        break;
        
      default:
        log.debug('Unknown message type:', message.type);
        sendResponse({ success: false, error: 'Unknown message type' });
    }
    
    return true; // Keep channel open for async response
  };
}

/**
 * Handle messages from the panel iframe
 */
export function createPanelMessageHandler(ctx: ExtendedMessageHandlerContext) {
  return function handlePanelMessage(event: MessageEvent): void {
    // Only handle messages from our panel iframe
    if (event.source !== ctx.getPanelFrame()?.contentWindow) {
      return;
    }
    
    const { type, payload } = event.data || {};
    
    switch (type) {
      case 'XTM_PANEL_READY':
        log.debug('Panel ready, flushing message queue');
        ctx.setIsPanelReady(true);
        ctx.flushPanelMessageQueue();
        break;
        
      case 'XTM_TOGGLE_SELECTION':
        if (payload?.value) {
          const highlight = document.querySelector(
            `.xtm-highlight[data-value="${CSS.escape(payload.value)}"]`
          ) as HTMLElement;
          if (highlight) {
            ctx.toggleSelection(highlight, payload.value);
          }
        }
        break;
        
      case 'XTM_SELECT_ALL':
        if (payload?.values) {
          ctx.handleSelectAll(payload.values);
        }
        break;
        
      case 'XTM_DESELECT_ALL':
        ctx.handleDeselectAll();
        break;
        
      case 'XTM_DESELECT_ITEM':
        if (payload?.value) {
          ctx.handleDeselectItem(payload.value);
        }
        break;
        
      case 'XTM_CLOSE_PANEL':
        ctx.hidePanel();
        break;
        
      case 'XTM_SCROLL_TO_FIRST':
        ctx.scrollToFirstHighlight();
        break;
        
      case 'XTM_SHOW_TOAST':
        ctx.showToast(payload);
        break;
        
      case 'XTM_HIDE_TOAST':
        ctx.hideToast();
        break;
        
      case 'XTM_HIGHLIGHT_AI_ENTITIES':
        if (payload?.entities) {
          ctx.highlightAIEntities(payload.entities, (highlight, value) => {
            ctx.toggleSelection(highlight, value);
          });
        }
        break;
    }
  };
}

// ============================================================================
// Individual Handler Implementations
// ============================================================================

async function handleScanPage(ctx: MessageHandlerContext, isAutoScan: boolean): Promise<void> {
  log.info(isAutoScan ? 'Auto-scanning page...' : 'Scanning page...');
  
  ctx.setCurrentScanMode('scan');
  ctx.clearHighlights();
  ctx.selectedForImport.clear();
  
  const { text: pageContent, html: htmlContent } = ctx.getComprehensivePageContent();
  const pageUrl = window.location.href;
  const pageTitle = document.title;
  const pageDescription = ctx.generateCleanDescription();
  
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'SCAN_ALL',
      payload: { content: pageContent, pageUrl, pageTitle },
    });
    
    if (response?.success && response.data) {
      const data = response.data as ScanResultPayload;
      ctx.setScanResults(data);
      ctx.setLastScanData(data);
      
      const totalEntities = (data.observables?.length || 0) + (data.sdos?.length || 0);
      
      if (totalEntities > 0) {
        ctx.highlightResults(data, (highlight, value) => {
          ctx.toggleSelection(highlight, value);
        });
        ctx.showPreviewPanel(
          [...(data.observables || []), ...(data.sdos || [])],
          pageContent,
          pageUrl,
          pageTitle,
          pageDescription,
          htmlContent
        );
        ctx.showToast({
          type: 'success',
          message: `Found ${totalEntities} entities`,
          action: { label: 'Go to first', type: 'scroll_to_first' },
        });
      } else {
        ctx.showToast({
          type: 'info',
          message: 'No entities detected on this page',
        });
      }
    } else {
      log.error('Scan failed:', response?.error);
      ctx.showToast({
        type: 'error',
        message: 'Scan failed: ' + (response?.error || 'Unknown error'),
      });
    }
  } catch (error) {
    log.error('Scan error:', error);
    ctx.showToast({
      type: 'error',
      message: 'Scan failed',
    });
  }
}

async function handleScanOAEV(_ctx: MessageHandlerContext): Promise<void> {
  log.info('Scanning page for OpenAEV entities...');
  
  const pageContent = document.body?.innerText || '';
  const pageUrl = window.location.href;
  const pageTitle = document.title;
  
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'SCAN_OAEV',
      payload: { content: pageContent, pageUrl, pageTitle },
    });
    
    if (response?.success && response.data) {
      log.info('OpenAEV scan complete:', response.data);
    }
  } catch (error) {
    log.error('OpenAEV scan error:', error);
  }
}

async function handleScanAll(ctx: MessageHandlerContext): Promise<void> {
  log.info('Scanning page for all platforms...');
  
  const { text: pageContent, html: htmlContent } = ctx.getComprehensivePageContent();
  const pageUrl = window.location.href;
  const pageTitle = document.title;
  const pageDescription = ctx.generateCleanDescription();
  
  ctx.setCurrentScanMode('scan');
  ctx.clearHighlights();
  ctx.selectedForImport.clear();
  
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'SCAN_ALL',
      payload: { content: pageContent, pageUrl, pageTitle },
    });
    
    if (response?.success && response.data) {
      const data = response.data as ScanResultPayload;
      ctx.setScanResults(data);
      ctx.setLastScanData(data);
      
      const totalEntities = (data.observables?.length || 0) + (data.sdos?.length || 0);
      
      if (totalEntities > 0) {
        ctx.highlightResults(data, (highlight, value) => {
          ctx.toggleSelection(highlight, value);
        });
        ctx.showPreviewPanel(
          [...(data.observables || []), ...(data.sdos || [])],
          pageContent,
          pageUrl,
          pageTitle,
          pageDescription,
          htmlContent
        );
      }
    }
  } catch (error) {
    log.error('Scan all error:', error);
  }
}

async function handleScanAtomicTesting(ctx: MessageHandlerContext): Promise<void> {
  log.info('Scanning page for atomic testing targets...');
  
  ctx.setCurrentScanMode('atomic');
  ctx.clearHighlights();
  ctx.selectedForImport.clear();
  
  const pageContent = document.body?.innerText || '';
  const pageUrl = window.location.href;
  const pageTitle = document.title;
  
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'SCAN_ALL',
      payload: { content: pageContent, pageUrl, pageTitle },
    });
    
    if (response?.success && response.data) {
      const data = response.data as ScanResultPayload;
      
      // Add detected domains/hostnames as DetectedObservable
      const domainTargets = ctx.detectDomainsAndHostnamesForAtomicTesting();
      if (domainTargets.length > 0) {
        const domainObservables: DetectedObservable[] = domainTargets.map((target, index) => ({
          type: target.type as ObservableType,
          value: target.value,
          startIndex: index,
          endIndex: index + target.value.length,
          found: false,
        }));
        data.observables = [...(data.observables || []), ...domainObservables];
      }
      
      ctx.setScanResults(data);
      ctx.setLastScanData(data);
      ctx.highlightForAtomicTesting(data);
    }
  } catch (error) {
    log.error('Atomic testing scan error:', error);
  }
}

async function handleCreateScenarioFromPage(ctx: MessageHandlerContext): Promise<void> {
  log.info('Scanning page for scenario creation...');
  
  ctx.setCurrentScanMode('scenario');
  ctx.clearHighlights();
  ctx.selectedForImport.clear();
  
  const pageContent = document.body?.innerText || '';
  const pageUrl = window.location.href;
  const pageTitle = document.title;
  
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'SCAN_ALL',
      payload: { content: pageContent, pageUrl, pageTitle },
    });
    
    if (response?.success && response.data) {
      const data = response.data as ScanResultPayload;
      ctx.setScanResults(data);
      ctx.setLastScanData(data);
      ctx.highlightScenarioAttackPatterns(data);
    }
  } catch (error) {
    log.error('Scenario scan error:', error);
  }
}

async function handleScanForInvestigation(ctx: MessageHandlerContext): Promise<void> {
  log.info('Scanning page for investigation...');
  
  ctx.setCurrentScanMode('investigation');
  ctx.clearHighlights();
  ctx.selectedForImport.clear();
  
  const { text: pageContent } = ctx.getComprehensivePageContent();
  const pageUrl = window.location.href;
  const pageTitle = document.title;
  
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'SCAN_ALL',
      payload: { content: pageContent, pageUrl, pageTitle },
    });
    
    if (response?.success && response.data) {
      const data = response.data as ScanResultPayload;
      ctx.setScanResults(data);
      ctx.setLastScanData(data);
      
      const totalEntities = (data.observables?.length || 0) + (data.sdos?.length || 0);
      
      if (totalEntities > 0) {
        ctx.highlightResultsForInvestigation(data, (highlight, value) => {
          ctx.toggleSelection(highlight, value);
        });
      }
    }
  } catch (error) {
    log.error('Investigation scan error:', error);
  }
}

async function handleCreateContainerFromPage(ctx: MessageHandlerContext): Promise<void> {
  const pageContent = document.body?.innerText || '';
  const { html: htmlContent } = ctx.getComprehensivePageContent();
  const pageUrl = window.location.href;
  const pageTitle = document.title;
  const pageDescription = ctx.generateCleanDescription();
  
  ctx.showContainerPanel(pageContent, pageUrl, pageTitle, pageDescription, htmlContent);
}

async function handleCreateInvestigation(ctx: MessageHandlerContext): Promise<void> {
  const pageContent = document.body?.innerText || '';
  const pageUrl = window.location.href;
  const pageTitle = document.title;
  const pageDescription = ctx.generateCleanDescription();
  
  ctx.showInvestigationPanel(pageContent, pageUrl, pageTitle, pageDescription);
}

function handleSearchSelection(ctx: MessageHandlerContext, payload: unknown): void {
  const { text } = (payload || {}) as { text?: string };
  if (text) {
    ctx.showSearchPanel(text.trim());
  }
}

function handleAddSelection(ctx: MessageHandlerContext, payload: unknown): void {
  const { text } = (payload || {}) as { text?: string };
  if (text) {
    ctx.showAddSelectionPanel(text.trim());
  }
}

function handleEntityAdded(ctx: MessageHandlerContext, payload: unknown): void {
  const { value, type } = (payload || {}) as { value?: string; type?: string };
  
  if (value) {
    // Update highlight to show entity is now found
    document.querySelectorAll(`.xtm-highlight[data-value="${CSS.escape(value)}"]`).forEach(el => {
      el.classList.remove('xtm-not-found');
      el.classList.add('xtm-found');
      el.setAttribute('data-found', 'true');
    });
    
    ctx.showToast({
      type: 'success',
      message: `${type || 'Entity'} added successfully`,
    });
  }
}

/**
 * Extended context interface that includes getPanelFrame
 */
export interface ExtendedMessageHandlerContext extends MessageHandlerContext {
  getPanelFrame: () => HTMLIFrameElement | null;
}

