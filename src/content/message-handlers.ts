/**
 * Content Script Message Handlers
 * 
 * Centralized message handling for the content script.
 * This module handles all incoming messages from the background script and panel.
 */

import { loggers } from '../shared/utils/logger';
import {
  clearHighlights,
  scrollToFirstHighlight,
  scrollToHighlightByValue,
} from './highlighting';
import {
  sendPanelMessage,
  hidePanel,
  showContainerPanel,
  showInvestigationPanel,
  showSearchPanel,
  showUnifiedSearchPanel,
  showAddSelectionPanel,
  initializeSplitScreenMode,
  refreshSplitScreenMode,
} from './panel';
import { 
  extractArticleContent, 
  extractFirstParagraph, 
  generateArticlePDF,
} from './extraction';

const log = loggers.content;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Sync highlight selection state for investigation entities
 * Extracted to reduce duplication between INVESTIGATION_SYNC_SELECTION and INVESTIGATION_SYNC_ALL
 * 
 * @param entityIds - Array of entity IDs to update
 * @param selected - Whether to select (true) or deselect (false) the entities
 */
function syncHighlightSelection(entityIds: string[], selected: boolean): void {
  for (const entityId of entityIds) {
    const highlight = document.querySelector(
      `.xtm-highlight.xtm-investigation[data-entity-id="${entityId}"]`
    );
    if (highlight) {
      highlight.classList.toggle('xtm-selected', selected);
    }
  }
}

// ============================================================================
// Types
// ============================================================================

/**
 * Context object containing mutable state and scan functions
 */
export interface MessageHandlerContext {
  selectedForImport: Set<string>;
  currentScanMode: 'scan' | 'atomic' | 'scenario' | 'investigation' | null;
  lastScanData: unknown | null;
  // Scan functions
  scanPage: () => Promise<void>;
  scanPageForOAEV: () => Promise<void>;
  scanAllPlatforms: () => Promise<void>;
  scanPageForAtomicTesting: () => Promise<void>;
  scanPageForScenario: () => Promise<void>;
  scanPageForInvestigation: (platformId?: string) => Promise<void>;
  handleHighlightAIEntities: (entities: unknown[]) => { 
    highlightedEntities: Array<{ type: string; value: string; name: string }>;
    failedEntities: Array<{ type: string; value: string; name: string }>;
  };
  // State setters
  setCurrentScanMode: (mode: 'scan' | 'atomic' | 'scenario' | 'investigation' | null) => void;
  setLastScanData: (data: unknown | null) => void;
}

/**
 * Handle incoming messages from background script
 */
export function handleMessage(
  message: { type: string; payload?: unknown },
  context: MessageHandlerContext,
  sendResponse: (response: unknown) => void
): boolean {
  const { selectedForImport } = context;

  switch (message.type) {
    case 'SCAN_PAGE':
    case 'AUTO_SCAN_PAGE':
      context.scanPage().then(() => {
        sendResponse({ success: true });
      });
      return true;
    
    case 'SCAN_OAEV':
      context.scanPageForOAEV().then(() => {
        sendResponse({ success: true });
      });
      return true;
    
    case 'SCAN_ALL':
      context.scanAllPlatforms().then(() => {
        sendResponse({ success: true });
      });
      return true;
    
    case 'SCAN_ATOMIC_TESTING':
      context.scanPageForAtomicTesting().then(() => sendResponse({ success: true }));
      return true;
    
    case 'CREATE_SCENARIO_FROM_PAGE':
      context.scanPageForScenario().then(() => sendResponse({ success: true }));
      return true;
      
    case 'CLEAR_HIGHLIGHTS':
      clearHighlights();
      selectedForImport.clear();
      context.setCurrentScanMode(null);
      context.setLastScanData(null);
      sendPanelMessage('CLEAR_SCAN_RESULTS');
      sendResponse({ success: true });
      return false;
    
    case 'CLEAR_HIGHLIGHTS_ONLY':
      clearHighlights();
      selectedForImport.clear();
      context.setCurrentScanMode(null);
      context.setLastScanData(null);
      sendResponse({ success: true });
      return false;
      
    case 'SCAN_FOR_INVESTIGATION': {
      const payload = message.payload as { platformId?: string } | undefined;
      const platformId = payload?.platformId;
      context.scanPageForInvestigation(platformId).then(() => sendResponse({ success: true }));
      return true;
    }
      
    case 'INVESTIGATION_SYNC_SELECTION': {
      const payload = message.payload as { entityId?: string; selected?: boolean } | undefined;
      const { entityId, selected } = payload || {};
      if (entityId) {
        syncHighlightSelection([entityId], !!selected);
      }
      sendResponse({ success: true });
      return false;
    }
    
    case 'INVESTIGATION_SYNC_ALL': {
      const payload = message.payload as { entityIds?: string[]; selected?: boolean } | undefined;
      const { entityIds, selected } = payload || {};
      if (entityIds && Array.isArray(entityIds)) {
        syncHighlightSelection(entityIds, !!selected);
      }
      sendResponse({ success: true });
      return false;
    }
    
    case 'XTM_HIGHLIGHT_AI_ENTITIES': {
      const payload = message.payload as { entities?: unknown[] } | undefined;
      const entities = payload?.entities;
      if (entities && Array.isArray(entities)) {
        const result = context.handleHighlightAIEntities(entities);
        sendResponse({ 
          success: true, 
          highlightedEntities: result.highlightedEntities,
          failedEntities: result.failedEntities,
        });
      } else {
        sendResponse({ success: true, highlightedEntities: [], failedEntities: [] });
      }
      return false;
    }
      
    case 'HIDE_PANEL':
      hidePanel();
      sendResponse({ success: true });
      return false;
    
    case 'XTM_SCROLL_TO_FIRST':
      scrollToFirstHighlight();
      sendResponse({ success: true });
      return false;
    
    case 'XTM_SCROLL_TO_HIGHLIGHT': {
      const payload = message.payload as { value?: string | string[] } | undefined;
      const scrollValue = payload?.value;
      if (scrollValue && (typeof scrollValue === 'string' || (Array.isArray(scrollValue) && scrollValue.length > 0))) {
        const found = scrollToHighlightByValue(scrollValue);
        sendResponse({ success: true, found });
      } else {
        sendResponse({ success: false, error: 'No value provided' });
      }
      return false;
    }
    
    case 'SPLIT_SCREEN_MODE_CHANGED': {
      refreshSplitScreenMode();
      initializeSplitScreenMode().then((enabled) => {
        log.debug(' Split screen mode changed, new value:', enabled);
      });
      sendResponse({ success: true });
      return false;
    }
      
    case 'GET_PAGE_CONTENT': {
      const articleData = extractArticleContent();
      const description = extractFirstParagraph(articleData.textContent);
      
      sendResponse({
        success: true,
        data: {
          url: window.location.href,
          title: articleData.title,
          content: articleData.textContent,
          html: articleData.content,
          description: description,
          excerpt: articleData.excerpt,
          byline: articleData.byline,
        },
      });
      return false;
    }
    
    case 'GET_ARTICLE_CONTENT': {
      const article = extractArticleContent();
      const firstParagraph = extractFirstParagraph(article.textContent);
      
      sendResponse({
        success: true,
        data: {
          url: window.location.href,
          title: article.title,
          textContent: article.textContent,
          htmlContent: article.content,
          description: firstParagraph,
          excerpt: article.excerpt,
          byline: article.byline,
        },
      });
      return false;
    }
      
    case 'CREATE_CONTAINER_FROM_PAGE':
      showContainerPanel();
      sendResponse({ success: true });
      return false;
      
    case 'CREATE_INVESTIGATION':
      showInvestigationPanel();
      sendResponse({ success: true });
      return false;
    
    case 'OPEN_SEARCH_PANEL':
      showSearchPanel();
      sendResponse({ success: true });
      return false;
    
    case 'OPEN_UNIFIED_SEARCH_PANEL':
      showUnifiedSearchPanel();
      sendResponse({ success: true });
      return false;
    
    case 'SEARCH_SELECTION': {
      const payload = message.payload as { text?: string } | undefined;
      if (payload?.text) {
        showUnifiedSearchPanel(payload.text);
      }
      sendResponse({ success: true });
      return false;
    }
    
    case 'ADD_SELECTION': {
      const payload = message.payload as { text?: string } | undefined;
      if (payload?.text) {
        showAddSelectionPanel(payload.text);
      }
      sendResponse({ success: true });
      return false;
    }
    
    case 'GENERATE_PDF':
      generateArticlePDF().then(result => {
        if (result) {
          sendResponse({ success: true, data: result });
        } else {
          sendResponse({ success: false, error: 'Failed to generate PDF' });
        }
      }).catch(error => {
        sendResponse({ success: false, error: (error as Error).message });
      });
      return true;
      
    case 'GET_SELECTION':
      sendResponse({
        success: true,
        data: {
          selectedCount: selectedForImport.size,
          selectedItems: Array.from(selectedForImport),
        },
      });
      return false;
      
    case 'CLEAR_SELECTION':
      selectedForImport.clear();
      document.querySelectorAll('.xtm-highlight.xtm-selected').forEach(el => {
        el.classList.remove('xtm-selected');
      });
      sendResponse({ success: true });
      return false;
      
    case 'ENTITY_ADDED': {
      const payload = message.payload as { value?: string } | undefined;
      const value = payload?.value;
      if (value) {
        document.querySelectorAll(`.xtm-highlight[data-value="${CSS.escape(value)}"]`).forEach(el => {
          el.classList.remove('xtm-not-found', 'xtm-selected');
          el.classList.add('xtm-found');
          (el as HTMLElement).dataset.found = 'true';
        });
        selectedForImport.delete(value);
      }
      sendResponse({ success: true });
      return false;
    }
    
    default:
      // Message not handled here
      return false;
  }
}

