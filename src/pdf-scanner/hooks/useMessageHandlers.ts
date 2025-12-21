/**
 * useMessageHandlers Hook
 * 
 * Handles Chrome runtime messages and postMessage communication for PDF viewer
 */

import { useEffect } from 'react';
import type { ScanResultPayload } from '../../shared/types/messages';
import type { ScanEntity } from '../types';

/**
 * Extract filename from a URL
 */
function extractFilenameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    // Get the last segment of the path
    const segments = pathname.split('/');
    const lastSegment = segments[segments.length - 1] || '';
    // Remove query params and decode
    const filename = decodeURIComponent(lastSegment.split('?')[0]);
    // Return filename or fallback
    return filename || 'document.pdf';
  } catch {
    // Fallback: try simple split
    const parts = url.split('/');
    const lastPart = parts[parts.length - 1] || '';
    return decodeURIComponent(lastPart.split('?')[0]) || 'document.pdf';
  }
}

interface UseMessageHandlersOptions {
  /** Reference to page texts for AI content requests */
  pageTextsRef: React.MutableRefObject<string[]>;
  /** Reference to PDF URL */
  pdfUrlRef: React.MutableRefObject<string>;
  /** Reference to scan function */
  scanAndShowPanelRef: React.MutableRefObject<((content: string) => Promise<void>) | undefined>;
  /** Reference to panel iframe */
  panelIframeRef: React.MutableRefObject<HTMLIFrameElement | null>;
  /** PDF URL */
  pdfUrl: string | null;
  /** PDF metadata title (from PDF document info) */
  pdfMetadataTitle?: string;
  /** Set scan results */
  setScanResults: React.Dispatch<React.SetStateAction<ScanResultPayload | null>>;
  /** Set selected entities */
  setSelectedEntities: React.Dispatch<React.SetStateAction<Set<string>>>;
  /** Set hovered entity */
  setHoveredEntity: React.Dispatch<React.SetStateAction<{ entity: ScanEntity; x: number; y: number } | null>>;
  /** Set theme mode */
  setMode: React.Dispatch<React.SetStateAction<'dark' | 'light'>>;
  /** Set split screen mode */
  setSplitScreenMode: React.Dispatch<React.SetStateAction<boolean>>;
  /** Close iframe panel callback */
  closeIframePanel: () => void;
}

export function useMessageHandlers({
  pageTextsRef,
  pdfUrlRef,
  scanAndShowPanelRef,
  panelIframeRef,
  pdfUrl,
  pdfMetadataTitle,
  setScanResults,
  setSelectedEntities,
  setHoveredEntity,
  setMode,
  setSplitScreenMode,
  closeIframePanel,
}: UseMessageHandlersOptions): void {
  // Handle Chrome runtime messages
  useEffect(() => {
    // Get theme and split screen mode from settings
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (response) => {
        if (chrome.runtime.lastError) return;
        if (response?.success && response.data) {
          if (response.data.theme) {
            setMode(response.data.theme === 'light' ? 'light' : 'dark');
          }
          if (response.data.splitScreenMode !== undefined) {
            setSplitScreenMode(response.data.splitScreenMode);
          }
        }
      });
    }

    // Listen for messages from popup/panel
    const handleMessage = (
      message: { type: string; payload?: unknown },
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response?: unknown) => void
    ): boolean | undefined => {
      if (message.type === 'PDF_SCANNER_RESCAN_TRIGGER') {
        // Clear highlights first before rescanning
        setScanResults(null);
        setSelectedEntities(new Set());
        setHoveredEntity(null);
        
        // Notify panel to clear results and show spinner
        // This ensures the panel shows loading state while PDF is being rescanned
        chrome.runtime.sendMessage({
          type: 'FORWARD_TO_PANEL',
          payload: { type: 'SCAN_STARTED' },
        }).catch(() => {}); // Ignore errors if no listener
        
        // Trigger rescan after clearing
        const fullText = pageTextsRef.current.join('\n');
        if (fullText && scanAndShowPanelRef.current) {
          scanAndShowPanelRef.current(fullText);
        }
        sendResponse({ success: true });
        return true;
      } else if (message.type === 'CLEAR_HIGHLIGHTS' || message.type === 'PDF_SCANNER_CLEAR_HIGHLIGHTS') {
        setScanResults(null);
        setSelectedEntities(new Set());
        setHoveredEntity(null);
        chrome.runtime.sendMessage({
          type: 'FORWARD_TO_PANEL',
          payload: { type: 'CLEAR_SCAN_RESULTS' },
        }).catch(() => {}); // Ignore errors if no listener
        sendResponse({ success: true });
        return true;
      } else if (message.type === 'CLEAR_HIGHLIGHTS_ONLY') {
        // Clear highlights only - don't send CLEAR_SCAN_RESULTS (user stays on scan results view)
        setScanResults(null);
        setSelectedEntities(new Set());
        setHoveredEntity(null);
        sendResponse({ success: true });
        return true;
      } else if (message.type === 'ADD_AI_ENTITIES_TO_PDF') {
        // Add AI-discovered entities from panel to scanResults
        const aiEntities = message.payload as Array<{
          id: string;
          type: string;
          name: string;
          value: string;
          aiReason?: string;
          aiConfidence?: 'high' | 'medium' | 'low';
        }>;
        
        if (aiEntities && aiEntities.length > 0) {
          setScanResults(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              aiDiscoveredEntities: [
                ...(prev.aiDiscoveredEntities || []),
                ...aiEntities,
              ],
            };
          });
        }
        sendResponse({ success: true });
        return true;
      } else if (message.type === 'GET_PDF_CONTENT') {
        // Return the extracted PDF text content for AI discovery
        const fullText = pageTextsRef.current.join('\n');
        const filename = extractFilenameFromUrl(pdfUrlRef.current);
        // Use PDF metadata title if available, otherwise use filename without extension
        const pdfTitle = pdfMetadataTitle || filename.replace(/\.pdf$/i, '') || 'PDF Document';
        sendResponse({
          success: true,
          data: {
            content: fullText,
            title: pdfTitle,
            url: pdfUrlRef.current,
            filename: filename,
          },
        });
        return true;
      }
      // Return undefined for unhandled messages - don't indicate async response
      return undefined;
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, [pageTextsRef, pdfUrlRef, scanAndShowPanelRef, setScanResults, setSelectedEntities, setHoveredEntity, setMode, setSplitScreenMode]);

  // Listen for postMessage from the panel iframe
  useEffect(() => {
    const handlePostMessage = (event: MessageEvent) => {
      if (event.data?.type === 'XTM_PANEL_READY') {
        // Panel iframe is ready - notify it that it's in PDF view mode
        const iframe = panelIframeRef.current;
        if (iframe?.contentWindow) {
          iframe.contentWindow.postMessage({ type: 'SET_PDF_VIEW_MODE', payload: true }, '*');
        }
      } else if (event.data?.type === 'XTM_CLOSE_PANEL') {
        // Close the iframe panel when X button is clicked inside the panel
        closeIframePanel();
      } else if (event.data?.type === 'XTM_TOGGLE_SELECTION' && event.data.value) {
        // Panel is toggling selection - sync with PDF scanner's selection state
        const value = event.data.value;
        setSelectedEntities(prev => {
          const next = new Set(prev);
          if (next.has(value)) {
            next.delete(value);
          } else {
            next.add(value);
          }
          return next;
        });
      } else if (event.data?.type === 'XTM_SELECT_ALL' && event.data.values) {
        // Panel is selecting all items - sync with PDF scanner's selection state
        const values = event.data.values as string[];
        setSelectedEntities(new Set(values));
      } else if (event.data?.type === 'XTM_DESELECT_ALL') {
        // Panel is deselecting all items - clear PDF scanner's selection state
        setSelectedEntities(new Set());
      } else if (event.data?.type === 'XTM_CHECK_PDF_VIEW') {
        // Panel is checking if it's in PDF view mode (e.g., after tab switch)
        // Respond with SET_PDF_VIEW_MODE to confirm we're in PDF scanner
        const iframe = panelIframeRef.current;
        if (iframe?.contentWindow) {
          iframe.contentWindow.postMessage({ type: 'SET_PDF_VIEW_MODE', payload: true }, '*');
        }
      } else if (event.data?.type === 'XTM_PDF_SCANNER_RESCAN') {
        // Panel is requesting a rescan - triggered when user clicks Scan button in panel
        // Clear highlights first before rescanning
        setScanResults(null);
        setSelectedEntities(new Set());
        setHoveredEntity(null);
        
        // Notify panel to clear results and show spinner
        chrome.runtime.sendMessage({
          type: 'FORWARD_TO_PANEL',
          payload: { type: 'SCAN_STARTED' },
        }).catch(() => {}); // Ignore errors if no listener
        
        // Also send to iframe panel directly
        const iframe = panelIframeRef.current;
        if (iframe?.contentWindow) {
          iframe.contentWindow.postMessage({ type: 'SCAN_STARTED' }, '*');
        }
        
        // Trigger rescan
        const fullText = pageTextsRef.current.join('\n');
        if (fullText && scanAndShowPanelRef.current) {
          scanAndShowPanelRef.current(fullText);
        }
      } else if (event.data?.type === 'XTM_GET_PDF_CONTENT') {
        // Panel iframe is requesting PDF content for AI analysis or container creation
        const fullText = pageTextsRef.current.join('\n');
        const currentUrl = pdfUrl || '';
        const filename = extractFilenameFromUrl(currentUrl);
        // Use PDF metadata title if available, otherwise use filename without extension
        const pdfTitle = pdfMetadataTitle || filename.replace(/\.pdf$/i, '') || 'PDF Document';
        
        const responsePayload = {
          success: true,
          data: {
            content: fullText,
            title: pdfTitle,
            url: currentUrl,
            filename: filename,
          },
        };
        
        // Send response back to the iframe
        const iframe = panelIframeRef.current;
        if (iframe?.contentWindow) {
          iframe.contentWindow.postMessage({
            type: 'XTM_PDF_CONTENT_RESPONSE',
            payload: responsePayload,
          }, '*');
        }
        // Also send via chrome runtime for split screen mode
        if (event.source && event.source !== window) {
          (event.source as Window).postMessage({
            type: 'XTM_PDF_CONTENT_RESPONSE',
            payload: responsePayload,
          }, '*');
        }
      }
    };

    window.addEventListener('message', handlePostMessage);
    return () => window.removeEventListener('message', handlePostMessage);
  }, [pdfUrl, pdfMetadataTitle, closeIframePanel, pageTextsRef, panelIframeRef, setSelectedEntities]);
  
  // Re-notify panel that it's in PDF view mode when tab becomes visible
  // This handles the case where user switches away from PDF tab and comes back
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Tab became visible - re-notify panel that we're in PDF view mode
        const iframe = panelIframeRef.current;
        if (iframe?.contentWindow) {
          iframe.contentWindow.postMessage({ type: 'SET_PDF_VIEW_MODE', payload: true }, '*');
        }
        // Also forward to background for native side panel
        chrome.runtime.sendMessage({
          type: 'FORWARD_TO_PANEL',
          payload: { type: 'SET_PDF_VIEW_MODE', payload: true },
        }).catch(() => {}); // Ignore errors if no listener
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [panelIframeRef]);
}

