/**
 * Miscellaneous Message Handlers
 * 
 * Handles messages that don't fit into other specific handler modules:
 * - Content script injection
 * - Panel state management
 * - PDF generation
 * - Image fetching
 */

import { type MessageHandler, successResponse, errorResponse } from './types';
import { loggers } from '../../shared/utils/logger';
import { generateNativePDF, isNativePDFAvailable } from '../../shared/extraction/native-pdf';

const log = loggers.background;

/**
 * Inject content script into a tab
 */
export const handleInjectContentScript: MessageHandler = async (payload, sendResponse) => {
  const { tabId } = payload as { tabId: number };
  
  if (!tabId) {
    sendResponse(errorResponse('No tabId provided'));
    return;
  }
  
  try {
    // Check if we can inject (not a chrome:// URL, etc.)
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      sendResponse(errorResponse('Cannot inject into this page'));
      return;
    }
    
    // Inject the content script
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/index.js'],
    });
    
    // Also inject CSS if available
    try {
      await chrome.scripting.insertCSS({
        target: { tabId },
        files: ['content/styles.css'],
      });
    } catch {
      // CSS injection is optional
    }
    
    sendResponse(successResponse({ injected: true }));
  } catch (error) {
    log.error('Failed to inject content script:', error);
    sendResponse(errorResponse(
      error instanceof Error ? error.message : 'Failed to inject content script'
    ));
  }
};

/**
 * Inject content script into all matching tabs
 */
export const handleInjectAllTabs: MessageHandler = async (_payload, sendResponse) => {
  try {
    const tabs = await chrome.tabs.query({});
    let injectedCount = 0;
    
    for (const tab of tabs) {
      if (!tab.id || !tab.url) continue;
      
      // Skip chrome:// and extension pages
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        continue;
      }
      
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content/index.js'],
        });
        injectedCount++;
      } catch {
        // Skip tabs we can't inject into
      }
    }
    
    sendResponse(successResponse({ injectedCount }));
  } catch (error) {
    log.error('Failed to inject into all tabs:', error);
    sendResponse(errorResponse(
      error instanceof Error ? error.message : 'Failed to inject into tabs'
    ));
  }
};

/**
 * Show panel handlers - forward to content script
 */
export const handleShowPanel: MessageHandler = async (payload, sendResponse) => {
  const { tabId } = payload as { tabId?: number };
  
  if (!tabId) {
    sendResponse(errorResponse('No tabId provided'));
    return;
  }
  
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'SHOW_PANEL', payload });
    sendResponse(successResponse({ shown: true }));
  } catch (error) {
    sendResponse(errorResponse('Failed to show panel'));
  }
};

/**
 * Get panel state
 */
export const handleGetPanelState: MessageHandler = async (_payload, sendResponse) => {
  // Panel state is managed by the content script
  // This just confirms the panel is ready
  sendResponse(successResponse({ ready: true }));
};

/**
 * Generate native PDF from page content using Chrome's printing API
 */
export const handleGenerateNativePDF: MessageHandler = async (payload, sendResponse) => {
  const { tabId, options } = payload as {
    tabId: number;
    options?: {
      title?: string;
      url?: string;
      landscape?: boolean;
      printBackground?: boolean;
      scale?: number;
      paperWidth?: number;
      paperHeight?: number;
      marginTop?: number;
      marginBottom?: number;
      marginLeft?: number;
      marginRight?: number;
    };
  };
  
  if (!isNativePDFAvailable()) {
    sendResponse(errorResponse('Native PDF generation not available'));
    return;
  }
  
  if (!tabId) {
    sendResponse(errorResponse('No tabId provided'));
    return;
  }
  
  try {
    log.debug('Generating native PDF for tab:', tabId);
    const pdfData = await generateNativePDF(tabId, options);
    
    if (pdfData) {
      sendResponse(successResponse({ pdfData }));
    } else {
      log.warn('Native PDF generation returned no data');
      sendResponse(errorResponse('PDF generation failed'));
    }
  } catch (error) {
    log.error('Native PDF generation error:', error);
    sendResponse(errorResponse(
      error instanceof Error ? error.message : 'PDF generation failed'
    ));
  }
};

/**
 * Fetch image as data URL (bypasses CORS via background script)
 */
export const handleFetchImageAsDataURL: MessageHandler = async (payload, sendResponse) => {
  const { url } = payload as { url: string };
  
  if (!url) {
    sendResponse(errorResponse('No URL provided'));
    return;
  }
  
  try {
    log.debug(`Fetching image: ${url}`);
    const response = await fetch(url, {
      mode: 'cors',
      credentials: 'omit',
      headers: {
        'Accept': 'image/*,*/*;q=0.8',
      },
    });
    
    if (!response.ok) {
      log.warn(`Image fetch failed: ${response.status} ${response.statusText}`);
      sendResponse(errorResponse(`HTTP ${response.status}`));
      return;
    }
    
    const blob = await response.blob();
    
    // Convert blob to base64 data URL
    const reader = new FileReader();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read blob'));
      reader.readAsDataURL(blob);
    });
    
    log.debug(`Image fetched successfully: ${url.substring(0, 50)}...`);
    sendResponse(successResponse({ dataUrl }));
  } catch (error) {
    log.warn('Image fetch error:', url, error);
    sendResponse(errorResponse(
      error instanceof Error ? error.message : 'Fetch failed'
    ));
  }
};

/**
 * Export all misc handlers
 */
export const miscHandlers: Record<string, MessageHandler> = {
  INJECT_CONTENT_SCRIPT: handleInjectContentScript,
  INJECT_ALL_TABS: handleInjectAllTabs,
  SHOW_CONTAINER_PANEL: handleShowPanel,
  SHOW_SEARCH_PANEL: handleShowPanel,
  SHOW_ENTITY_PANEL: handleShowPanel,
  SHOW_INVESTIGATION_PANEL: handleShowPanel,
  SHOW_BULK_IMPORT_PANEL: handleShowPanel,
  GET_PANEL_STATE: handleGetPanelState,
  GENERATE_NATIVE_PDF: handleGenerateNativePDF,
  FETCH_IMAGE_AS_DATA_URL: handleFetchImageAsDataURL,
};

