/**
 * PDF Scanner Message Handlers
 * 
 * Handles messages related to PDF scanning operations:
 * - OPEN_PDF_SCANNER: Opens PDF in the extension's PDF scanner
 * - OPEN_PDF_SCANNER_PANEL: Opens the side panel for PDF scanner tab
 * - PDF_SCANNER_RESCAN: Triggers a rescan in PDF scanner
 * - FORWARD_TO_PDF_SCANNER: Forwards messages to PDF scanner tab
 * - GET_PDF_CONTENT_FROM_PDF_SCANNER: Gets PDF content for AI analysis
 * 
 * Note: SCAN_PDF_CONTENT is NOT included here because it requires the
 * detection engine from the main background context.
 */

import { type MessageHandler, type HandlerContext, type SendResponseFn } from './types';
import { loggers } from '../../shared/utils/logger';

const log = loggers.background;

/**
 * Open PDF scanner for a URL
 */
export const handleOpenPdfScanner: MessageHandler = async (
  payload: unknown,
  sendResponse: SendResponseFn,
  _context: HandlerContext
) => {
  const { pdfUrl } = payload as { pdfUrl: string };
  
  if (!pdfUrl) {
    sendResponse({ success: false, error: 'No PDF URL provided' });
    return;
  }
  
  try {
    const scannerUrl = chrome.runtime.getURL('pdf-scanner/index.html') + 
      '?url=' + encodeURIComponent(pdfUrl);
    
    const tab = await chrome.tabs.create({ url: scannerUrl });
    log.debug(`Opened PDF scanner for: ${pdfUrl}, tab: ${tab.id}`);
    sendResponse({ success: true, data: { tabId: tab.id } });
  } catch (error) {
    log.error('OPEN_PDF_SCANNER error:', error);
    sendResponse({ success: false, error: 'Failed to open PDF scanner' });
  }
};

/**
 * Open side panel for PDF scanner tab
 * Falls back to chrome.tabs.query if sender tab info is not available
 */
export const handleOpenPdfScannerPanel: MessageHandler = async (
  _payload: unknown,
  sendResponse: SendResponseFn,
  _context: HandlerContext
) => {
  try {
    // Query for active tab (we don't have sender info in dispatcher context)
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = activeTab?.id;
    const windowId = activeTab?.windowId;
    
    if (!tabId && !windowId) {
      sendResponse({ success: false, error: 'Could not determine tab' });
      return;
    }
    
    // Open side panel
    if (chrome.sidePanel) {
      let opened = false;
      
      if (tabId) {
        try {
          await chrome.sidePanel.open({ tabId });
          opened = true;
          log.debug(`PDF scanner: side panel opened for tab ${tabId}`);
        } catch (tabError) {
          log.debug(`PDF scanner: tabId approach failed, trying windowId`, tabError);
        }
      }
      
      if (!opened && windowId) {
        try {
          await chrome.sidePanel.open({ windowId });
          opened = true;
          log.debug(`PDF scanner: side panel opened for window ${windowId}`);
        } catch (windowError) {
          log.warn('PDF scanner: Failed to open side panel with windowId', windowError);
        }
      }
      
      sendResponse({ success: true, data: { opened } });
    } else {
      sendResponse({ success: false, error: 'Side panel API not available' });
    }
  } catch (error) {
    log.error('OPEN_PDF_SCANNER_PANEL error:', error);
    sendResponse({ success: false, error: 'Failed to open panel' });
  }
};

/**
 * Trigger a rescan on PDF scanner tab
 */
export const handlePdfScannerRescan: MessageHandler = async (
  payload: unknown,
  sendResponse: SendResponseFn,
  _context: HandlerContext
) => {
  try {
    // Use tabId from payload if provided, otherwise query for active tab
    const payloadData = payload as { tabId?: number } | undefined;
    let targetTabId = payloadData?.tabId;
    
    if (!targetTabId) {
      // Fallback: try to find the PDF scanner tab
      const extensionId = chrome.runtime.id;
      const tabs = await chrome.tabs.query({});
      const pdfScannerTab = tabs.find(t => 
        t.url?.includes(`${extensionId}/pdf-scanner/`)
      );
      targetTabId = pdfScannerTab?.id;
      
      // If still no tab found, try active tab
      if (!targetTabId) {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        targetTabId = activeTab?.id;
      }
    }
    
    if (targetTabId) {
      // Open side panel first (might fail if not from user gesture, that's okay)
      if (chrome.sidePanel) {
        try {
          await chrome.sidePanel.open({ tabId: targetTabId });
          log.debug('Side panel opened for PDF scanner rescan');
        } catch (e) {
          log.debug('Side panel may already be open or user gesture required:', e);
        }
      }
      
      // Send rescan trigger to the PDF scanner page
      await chrome.tabs.sendMessage(targetTabId, { type: 'PDF_SCANNER_RESCAN_TRIGGER' });
      log.debug('PDF scanner rescan triggered for tab:', targetTabId);
      sendResponse({ success: true, data: { triggered: true } });
    } else {
      sendResponse({ success: false, error: 'No PDF scanner tab found' });
    }
  } catch (error) {
    log.error('PDF_SCANNER_RESCAN error:', error);
    sendResponse({ success: false, error: 'Failed to trigger rescan' });
  }
};

/**
 * Forward message to PDF scanner tab
 */
export const handleForwardToPdfScanner: MessageHandler = async (
  payload: unknown,
  sendResponse: SendResponseFn,
  _context: HandlerContext
) => {
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab?.id && activeTab.url) {
      const extensionId = chrome.runtime.id;
      // Check if active tab is PDF scanner
      if (activeTab.url.includes(`${extensionId}/pdf-scanner/`)) {
        const innerPayload = payload as { type: string; payload: unknown };
        await chrome.tabs.sendMessage(activeTab.id, innerPayload);
        log.debug('Message forwarded to PDF scanner:', innerPayload.type);
        sendResponse({ success: true, data: { forwarded: true } });
      } else {
        // Not a PDF scanner tab - silently succeed (message not applicable)
        sendResponse({ success: true, data: { forwarded: false, reason: 'Not PDF scanner tab' } });
      }
    } else {
      sendResponse({ success: true, data: { forwarded: false, reason: 'No active tab' } });
    }
  } catch (error) {
    log.error('FORWARD_TO_PDF_SCANNER error:', error);
    sendResponse({ success: false, error: 'Failed to forward to PDF scanner' });
  }
};

/**
 * Get PDF content from PDF scanner tab for AI analysis
 */
export const handleGetPdfContentFromScanner: MessageHandler = async (
  _payload: unknown,
  sendResponse: SendResponseFn,
  _context: HandlerContext
) => {
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab?.id && activeTab.url) {
      const extensionId = chrome.runtime.id;
      // Check if active tab is PDF scanner
      if (activeTab.url.includes(`${extensionId}/pdf-scanner/`)) {
        // Send message to PDF scanner and wait for response
        const response = await chrome.tabs.sendMessage(activeTab.id, { type: 'GET_PDF_CONTENT' });
        sendResponse(response);
      } else {
        sendResponse({ success: false, error: 'Not a PDF scanner tab' });
      }
    } else {
      sendResponse({ success: false, error: 'No active tab' });
    }
  } catch (error) {
    log.error('GET_PDF_CONTENT_FROM_PDF_SCANNER error:', error);
    sendResponse({ success: false, error: 'Failed to get PDF content' });
  }
};

/**
 * PDF handlers registry for message dispatcher
 */
export const pdfHandlers: Record<string, MessageHandler> = {
  OPEN_PDF_SCANNER: handleOpenPdfScanner,
  OPEN_PDF_SCANNER_PANEL: handleOpenPdfScannerPanel,
  PDF_SCANNER_RESCAN: handlePdfScannerRescan,
  FORWARD_TO_PDF_SCANNER: handleForwardToPdfScanner,
  GET_PDF_CONTENT_FROM_PDF_SCANNER: handleGetPdfContentFromScanner,
};
