/**
 * usePopupActions - Hook for popup action handlers
 */

import { useCallback } from 'react';
import { loggers } from '../../shared/utils/logger';

const log = loggers.popup;

interface UsePopupActionsProps {
  aiConfigured: boolean;
  hasEnterprise: boolean;
  setPopoverAnchor: (anchor: HTMLElement | null) => void;
  setShowEETrialDialog: (show: boolean) => void;
}

interface UsePopupActionsReturn {
  ensureContentScriptAndSendMessage: (tabId: number, message: { type: string; payload?: unknown }) => Promise<void>;
  handleUnifiedScan: () => Promise<void>;
  handleUnifiedSearch: () => Promise<void>;
  handleCreateContainer: () => Promise<void>;
  handleInvestigate: () => Promise<void>;
  handleAtomicTesting: () => Promise<void>;
  handleGenerateScenario: () => Promise<void>;
  handleClear: () => Promise<void>;
  handleOpenSettings: () => void;
  handleOpenPlatform: (url: string) => void;
  handleFooterClick: (event: React.MouseEvent<HTMLElement>) => void;
  handleAIAction: (action: () => Promise<void>) => Promise<void>;
}

export const usePopupActions = ({
  aiConfigured,
  hasEnterprise,
  setPopoverAnchor,
  setShowEETrialDialog,
}: UsePopupActionsProps): UsePopupActionsReturn => {
  
  // Helper function to ensure content script is loaded before sending messages
  // Note: Panel opening is handled by the content script via openPanel() after operations complete.
  // This avoids conflicts between popup and content script both trying to open panels.
  const ensureContentScriptAndSendMessage = useCallback(async (tabId: number, message: { type: string; payload?: unknown }) => {
    try {
      // First try to send the message directly
      await chrome.tabs.sendMessage(tabId, message);
    } catch {
      // Content script not loaded - inject it first
      try {
        await chrome.runtime.sendMessage({
          type: 'INJECT_CONTENT_SCRIPT',
          payload: { tabId },
        });
        
        // Wait a bit for the script to initialize
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Try sending the message again
        await chrome.tabs.sendMessage(tabId, message);
      } catch (error) {
        log.error('Failed to inject content script or send message:', error);
      }
    }
  }, []);

  // Unified scan across ALL platforms
  const handleUnifiedScan = useCallback(async () => {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      // Don't await - close popup immediately, let content script handle the rest
      ensureContentScriptAndSendMessage(tab.id, { type: 'SCAN_ALL' });
    }
    window.close();
  }, [ensureContentScriptAndSendMessage]);

  // Unified search across ALL platforms
  const handleUnifiedSearch = useCallback(async () => {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      // Don't await - close popup immediately, let content script handle the rest
      ensureContentScriptAndSendMessage(tab.id, { type: 'OPEN_UNIFIED_SEARCH_PANEL' });
    }
    window.close();
  }, [ensureContentScriptAndSendMessage]);

  const handleCreateContainer = useCallback(async () => {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      // Don't await - close popup immediately, let content script handle the rest
      ensureContentScriptAndSendMessage(tab.id, { type: 'CREATE_CONTAINER_FROM_PAGE' });
    }
    window.close();
  }, [ensureContentScriptAndSendMessage]);

  const handleInvestigate = useCallback(async () => {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      // Don't await - close popup immediately, let content script handle the rest
      ensureContentScriptAndSendMessage(tab.id, { type: 'CREATE_INVESTIGATION' });
    }
    window.close();
  }, [ensureContentScriptAndSendMessage]);

  const handleAtomicTesting = useCallback(async () => {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      // Don't await - close popup immediately, let content script handle the rest
      ensureContentScriptAndSendMessage(tab.id, { type: 'SCAN_ATOMIC_TESTING' });
    }
    window.close();
  }, [ensureContentScriptAndSendMessage]);

  const handleGenerateScenario = useCallback(async () => {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      // Don't await - close popup immediately, let content script handle the rest
      ensureContentScriptAndSendMessage(tab.id, { type: 'CREATE_SCENARIO_FROM_PAGE' });
    }
    window.close();
  }, [ensureContentScriptAndSendMessage]);

  const handleClear = useCallback(async () => {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await ensureContentScriptAndSendMessage(tab.id, { type: 'CLEAR_HIGHLIGHTS' });
    }
  }, [ensureContentScriptAndSendMessage]);

  const handleOpenSettings = useCallback(() => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.openOptionsPage) return;
    chrome.runtime.openOptionsPage();
  }, []);

  const handleOpenPlatform = useCallback((url: string) => {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;
    chrome.tabs.create({ url });
    setPopoverAnchor(null);
  }, [setPopoverAnchor]);

  const handleFooterClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setPopoverAnchor(event.currentTarget);
  }, [setPopoverAnchor]);

  // Helper to handle AI-powered actions with proper status checks
  const handleAIAction = useCallback(async (action: () => Promise<void>) => {
    if (aiConfigured) {
      await action();
      return;
    }
    
    if (hasEnterprise) {
      if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      }
      window.close();
      return;
    }
    
    setShowEETrialDialog(true);
  }, [aiConfigured, hasEnterprise, setShowEETrialDialog]);

  return {
    ensureContentScriptAndSendMessage,
    handleUnifiedScan,
    handleUnifiedSearch,
    handleCreateContainer,
    handleInvestigate,
    handleAtomicTesting,
    handleGenerateScenario,
    handleClear,
    handleOpenSettings,
    handleOpenPlatform,
    handleFooterClick,
    handleAIAction,
  };
};

export default usePopupActions;

