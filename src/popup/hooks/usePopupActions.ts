/**
 * usePopupActions - Hook for popup action handlers
 */

import { useCallback } from 'react';
import { loggers } from '../../shared/utils/logger';

const log = loggers.popup;

interface UsePopupActionsProps {
  aiConfigured: boolean;
  hasEnterprise: boolean;
  splitScreenMode: boolean;
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
  splitScreenMode,
  setPopoverAnchor,
  setShowEETrialDialog,
}: UsePopupActionsProps): UsePopupActionsReturn => {
  
  // CRITICAL: Firefox loses user gesture context after ANY async operation
  // We must open sidebar IMMEDIATELY at the start of click handler, before any await
  // This function is called synchronously BEFORE any async operations
  const openFirefoxSidebarSync = useCallback((): void => {
    if (!splitScreenMode) return;
    
    const isFirefox = typeof browser !== 'undefined' && browser.sidebarAction?.open;
    if (isFirefox && browser.sidebarAction) {
      try {
        browser.sidebarAction.open();
        log.debug('Firefox sidebar opened from popup (sync)');
      } catch (error) {
        log.debug('Firefox sidebar open failed:', error);
      }
    }
  }, [splitScreenMode]);
  
  // Chrome/Edge: Can be called after async operations (more lenient with user gesture)
  const openChromeSidePanel = useCallback(async (tabId: number): Promise<void> => {
    if (!splitScreenMode) return;
    
    // Skip for Firefox (handled synchronously above)
    const isFirefox = typeof browser !== 'undefined' && browser.sidebarAction?.open;
    if (isFirefox) return;
    
    try {
      if (chrome.sidePanel) {
        await chrome.sidePanel.open({ tabId });
        log.debug('Chrome side panel opened from popup');
      }
    } catch (error) {
      log.debug('Side panel open failed from popup:', error);
    }
  }, [splitScreenMode]);
  
  // Helper function to ensure content script is loaded before sending messages
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
    // CRITICAL: Open Firefox sidebar FIRST, synchronously, before any await
    openFirefoxSidebarSync();
    
    if (typeof chrome === 'undefined' || !chrome.tabs) return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      // Open Chrome side panel (Firefox already opened above)
      await openChromeSidePanel(tab.id);
      // Then send message - don't await, let content script handle the rest
      ensureContentScriptAndSendMessage(tab.id, { type: 'SCAN_ALL' });
    }
    window.close();
  }, [ensureContentScriptAndSendMessage, openFirefoxSidebarSync, openChromeSidePanel]);

  // Unified search across ALL platforms
  const handleUnifiedSearch = useCallback(async () => {
    // CRITICAL: Open Firefox sidebar FIRST, synchronously, before any await
    openFirefoxSidebarSync();
    
    if (typeof chrome === 'undefined' || !chrome.tabs) return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await openChromeSidePanel(tab.id);
      ensureContentScriptAndSendMessage(tab.id, { type: 'OPEN_UNIFIED_SEARCH_PANEL' });
    }
    window.close();
  }, [ensureContentScriptAndSendMessage, openFirefoxSidebarSync, openChromeSidePanel]);

  const handleCreateContainer = useCallback(async () => {
    // CRITICAL: Open Firefox sidebar FIRST, synchronously, before any await
    openFirefoxSidebarSync();
    
    if (typeof chrome === 'undefined' || !chrome.tabs) return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await openChromeSidePanel(tab.id);
      ensureContentScriptAndSendMessage(tab.id, { type: 'CREATE_CONTAINER_FROM_PAGE' });
    }
    window.close();
  }, [ensureContentScriptAndSendMessage, openFirefoxSidebarSync, openChromeSidePanel]);

  const handleInvestigate = useCallback(async () => {
    // CRITICAL: Open Firefox sidebar FIRST, synchronously, before any await
    openFirefoxSidebarSync();
    
    if (typeof chrome === 'undefined' || !chrome.tabs) return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await openChromeSidePanel(tab.id);
      ensureContentScriptAndSendMessage(tab.id, { type: 'CREATE_INVESTIGATION' });
    }
    window.close();
  }, [ensureContentScriptAndSendMessage, openFirefoxSidebarSync, openChromeSidePanel]);

  const handleAtomicTesting = useCallback(async () => {
    // CRITICAL: Open Firefox sidebar FIRST, synchronously, before any await
    openFirefoxSidebarSync();
    
    if (typeof chrome === 'undefined' || !chrome.tabs) return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await openChromeSidePanel(tab.id);
      ensureContentScriptAndSendMessage(tab.id, { type: 'SCAN_ATOMIC_TESTING' });
    }
    window.close();
  }, [ensureContentScriptAndSendMessage, openFirefoxSidebarSync, openChromeSidePanel]);

  const handleGenerateScenario = useCallback(async () => {
    // CRITICAL: Open Firefox sidebar FIRST, synchronously, before any await
    openFirefoxSidebarSync();
    
    if (typeof chrome === 'undefined' || !chrome.tabs) return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await openChromeSidePanel(tab.id);
      ensureContentScriptAndSendMessage(tab.id, { type: 'CREATE_SCENARIO_FROM_PAGE' });
    }
    window.close();
  }, [ensureContentScriptAndSendMessage, openFirefoxSidebarSync, openChromeSidePanel]);

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

