/**
 * useMessageHandlers Hook
 * 
 * Handles Chrome runtime messages and postMessage communication for PDF viewer
 */

import { useEffect } from 'react';
import type { ScanResultPayload } from '../../shared/types/messages';
import type { ScanEntity } from '../types';

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
    ) => {
      if (message.type === 'PDF_SCANNER_RESCAN_TRIGGER') {
        // Clear highlights first before rescanning
        setScanResults(null);
        setSelectedEntities(new Set());
        setHoveredEntity(null);
        
        // Trigger rescan after clearing
        const fullText = pageTextsRef.current.join('\n');
        if (fullText && scanAndShowPanelRef.current) {
          scanAndShowPanelRef.current(fullText);
        }
        sendResponse({ success: true });
      } else if (message.type === 'CLEAR_HIGHLIGHTS' || message.type === 'PDF_SCANNER_CLEAR_HIGHLIGHTS') {
        setScanResults(null);
        setSelectedEntities(new Set());
        setHoveredEntity(null);
        chrome.runtime.sendMessage({
          type: 'FORWARD_TO_PANEL',
          payload: { type: 'CLEAR_SCAN_RESULTS' },
        });
        sendResponse({ success: true });
      } else if (message.type === 'CLEAR_HIGHLIGHTS_ONLY') {
        // Clear highlights only - don't send CLEAR_SCAN_RESULTS (user stays on scan results view)
        setScanResults(null);
        setSelectedEntities(new Set());
        setHoveredEntity(null);
        sendResponse({ success: true });
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
      } else if (message.type === 'GET_PDF_CONTENT') {
        // Return the extracted PDF text content for AI discovery
        const fullText = pageTextsRef.current.join('\n');
        sendResponse({
          success: true,
          data: {
            content: fullText,
            title: document.title || 'PDF Document',
            url: pdfUrlRef.current,
          },
        });
      }
      return true;
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, [pageTextsRef, pdfUrlRef, scanAndShowPanelRef, setScanResults, setSelectedEntities, setHoveredEntity, setMode, setSplitScreenMode]);

  // Listen for postMessage from the panel iframe
  useEffect(() => {
    const handlePostMessage = (event: MessageEvent) => {
      if (event.data?.type === 'XTM_CLOSE_PANEL') {
        // Close the iframe panel when X button is clicked inside the panel
        closeIframePanel();
      } else if (event.data?.type === 'XTM_GET_PDF_CONTENT') {
        // Panel iframe is requesting PDF content for AI analysis
        const fullText = pageTextsRef.current.join('\n');
        // Send response back to the iframe
        const iframe = panelIframeRef.current;
        if (iframe?.contentWindow) {
          iframe.contentWindow.postMessage({
            type: 'XTM_PDF_CONTENT_RESPONSE',
            payload: {
              success: true,
              data: {
                content: fullText,
                title: document.title || 'PDF Document',
                url: pdfUrl || '',
              },
            },
          }, '*');
        }
        // Also send via chrome runtime for split screen mode
        if (event.source && event.source !== window) {
          (event.source as Window).postMessage({
            type: 'XTM_PDF_CONTENT_RESPONSE',
            payload: {
              success: true,
              data: {
                content: fullText,
                title: document.title || 'PDF Document',
                url: pdfUrl || '',
              },
            },
          }, '*');
        }
      }
    };

    window.addEventListener('message', handlePostMessage);
    return () => window.removeEventListener('message', handlePostMessage);
  }, [pdfUrl, closeIframePanel, pageTextsRef, panelIframeRef]);
}

