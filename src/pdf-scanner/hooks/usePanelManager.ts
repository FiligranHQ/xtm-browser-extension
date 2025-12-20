/**
 * usePanelManager Hook
 * 
 * Manages the side panel (both iframe and native modes) for PDF viewer
 */

import { useCallback, useRef } from 'react';
import type { ScanResultPayload } from '../../shared/types/messages';

interface UsePanelManagerOptions {
  splitScreenMode: boolean;
}

interface UsePanelManagerReturn {
  /** Ensure panel iframe exists (iframe mode only) */
  ensurePanelIframe: () => HTMLIFrameElement | null;
  /** Close the iframe panel */
  closeIframePanel: () => void;
  /** Check if iframe panel is open */
  isIframePanelOpen: () => boolean;
  /** Open the panel (handles both modes) */
  openPanel: (fromUserGesture?: boolean) => Promise<void>;
  /** Send message to panel (handles both modes) */
  sendToPanel: (message: { type: string; payload?: unknown }) => void;
  /** Send scan results to panel */
  sendResultsToPanel: (
    results: ScanResultPayload,
    pageContent: string,
    currentPdfUrl: string,
    autoOpen?: boolean
  ) => Promise<void>;
  /** Reference to panel iframe */
  panelIframeRef: React.MutableRefObject<HTMLIFrameElement | null>;
}

export function usePanelManager({ splitScreenMode }: UsePanelManagerOptions): UsePanelManagerReturn {
  const panelIframeRef = useRef<HTMLIFrameElement | null>(null);

  // Create or get the panel iframe (for iframe mode only)
  const ensurePanelIframe = useCallback(() => {
    // Only use iframe in non-split-screen mode
    if (splitScreenMode) return null;
    
    let iframe = panelIframeRef.current;
    if (!iframe || !document.body.contains(iframe)) {
      // Create new iframe
      iframe = document.createElement('iframe');
      iframe.id = 'xtm-pdf-panel-iframe';
      iframe.src = chrome.runtime.getURL('panel/index.html');
      iframe.style.cssText = `
        position: fixed;
        top: 0;
        right: 0;
        width: 420px;
        height: 100vh;
        border: none;
        z-index: 2147483647;
        background: transparent;
        box-shadow: -2px 0 10px rgba(0,0,0,0.2);
        transition: transform 0.3s ease;
        transform: translateX(100%);
      `;
      document.body.appendChild(iframe);
      panelIframeRef.current = iframe;
    }
    return iframe;
  }, [splitScreenMode]);

  // Close the iframe panel
  const closeIframePanel = useCallback(() => {
    const iframe = panelIframeRef.current;
    if (iframe) {
      iframe.style.transform = 'translateX(100%)';
    }
  }, []);

  // Check if iframe panel is open
  const isIframePanelOpen = useCallback((): boolean => {
    const iframe = panelIframeRef.current;
    return !!(iframe && iframe.style.transform === 'translateX(0)');
  }, []);

  // Open the panel - behavior depends on mode and context
  const openPanel = useCallback(async (fromUserGesture = false) => {
    if (splitScreenMode) {
      // Native side panel mode - only works from direct user gesture
      if (fromUserGesture && typeof chrome !== 'undefined' && chrome.sidePanel?.open) {
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab?.windowId) {
            await chrome.sidePanel.open({ windowId: tab.windowId });
          }
        } catch {
          // Silently ignore - side panel may not be available
        }
      }
      // In split screen mode without user gesture, we can't open the panel
    } else {
      // Iframe mode - can open programmatically
      const iframe = ensurePanelIframe();
      if (iframe) {
        iframe.style.transform = 'translateX(0)';
      }
    }
  }, [splitScreenMode, ensurePanelIframe]);

  // Send message to panel (handles both iframe and native panel)
  const sendToPanel = useCallback((message: { type: string; payload?: unknown }) => {
    // Always forward to background for native side panel
    chrome.runtime.sendMessage({
      type: 'FORWARD_TO_PANEL',
      payload: message,
    }).catch(() => {});
    
    // Also post to iframe if it exists
    const iframe = panelIframeRef.current;
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({
        type: message.type,
        payload: message.payload,
      }, '*');
    }
  }, []);

  // Send scan results to the panel
  const sendResultsToPanel = useCallback(async (
    results: ScanResultPayload,
    pageContent: string,
    currentPdfUrl: string,
    autoOpen = true
  ) => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;

    try {
      const payload = {
        ...results,
        pageContent,
        pageTitle: document.title || 'PDF Document',
        pageUrl: currentPdfUrl,
      };
      
      // In iframe mode, auto-open the panel
      // In split screen mode, we can't auto-open (requires user gesture)
      if (autoOpen && !splitScreenMode) {
        await openPanel();
        // Small delay to ensure panel is ready
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Send results to panel (both iframe and native)
      sendToPanel({
        type: 'SCAN_RESULTS',
        payload,
      });
    } catch (err) {
      console.error('Failed to send results to panel:', err);
    }
  }, [splitScreenMode, openPanel, sendToPanel]);

  return {
    ensurePanelIframe,
    closeIframePanel,
    isIframePanelOpen,
    openPanel,
    sendToPanel,
    sendResultsToPanel,
    panelIframeRef,
  };
}

