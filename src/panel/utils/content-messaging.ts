/**
 * Content Script Messaging Utilities
 * 
 * Provides unified messaging to content scripts for both:
 * - Floating iframe mode (postMessage)
 * - Split screen mode (chrome.tabs.sendMessage)
 */

import { loggers } from '../../shared/utils/logger';

const log = loggers.panel;

export interface ContentScriptMessage {
  type: string;
  payload?: unknown;
  value?: unknown;
  values?: unknown;
}

/**
 * Check if we're running in split screen (side panel) mode
 * vs floating iframe mode
 */
export const isInSplitScreenMode = (): boolean => {
  return window.parent === window;
};

/**
 * Send a message to the content script.
 * Handles both floating iframe mode (postMessage) and split screen mode (chrome.tabs.sendMessage)
 * 
 * @param message - The message to send
 * @returns Promise that resolves when message is sent
 */
export const sendToContentScript = async (message: ContentScriptMessage): Promise<void> => {
  const isInSidePanel = isInSplitScreenMode();
  
  if (isInSidePanel && typeof chrome !== 'undefined' && chrome.tabs?.query && chrome.tabs?.sendMessage) {
    // Split screen mode - send directly to active tab
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, message);
      }
    } catch {
      // Fallback to postMessage
      window.parent.postMessage(message, '*');
    }
  } else {
    // Floating iframe mode - use postMessage
    window.parent.postMessage(message, '*');
  }
};

/**
 * Send a message to the content script using type and payload separately.
 * Convenience wrapper for simple messages.
 * 
 * @param type - Message type
 * @param payload - Optional message payload
 */
export const sendMessageToContentScript = async (type: string, payload?: unknown): Promise<void> => {
  if (typeof chrome === 'undefined' || !chrome.tabs) return;
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type, payload });
    }
  } catch (error) {
    log.error(`Failed to send ${type} to content script:`, error);
  }
};

/**
 * Get the currently active tab
 */
export const getActiveTab = async (): Promise<chrome.tabs.Tab | null> => {
  if (typeof chrome === 'undefined' || !chrome.tabs?.query) return null;
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab || null;
  } catch {
    return null;
  }
};

/**
 * Check if the current page is a PDF page
 */
export const isPdfPage = async (): Promise<boolean> => {
  const tab = await getActiveTab();
  if (!tab?.url) return false;
  
  const url = tab.url;
  
  // Check for PDF scanner extension page
  if (url.includes('pdf-scanner') || url.includes('pdf-scanner.html')) {
    return true;
  }
  
  // Check for direct PDF URLs
  return url.toLowerCase().endsWith('.pdf');
};

