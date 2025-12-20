/**
 * Investigation Actions Hook
 * 
 * Handles investigation entity selection, workbench creation, and related actions.
 */

import { useCallback } from 'react';
import type { PlatformInfo, InvestigationEntity, PanelMode } from '../types/panel-types';

export interface InvestigationActionsProps {
  // Platform state
  availablePlatforms: PlatformInfo[];
  selectedPlatformId: string;
  
  // Investigation state
  investigationEntities: InvestigationEntity[];
  setInvestigationEntities: React.Dispatch<React.SetStateAction<InvestigationEntity[]>>;
  filteredInvestigationEntities: InvestigationEntity[];
  investigationPlatformId: string | null;
  setInvestigationPlatformId: (id: string | null) => void;
  setInvestigationPlatformSelected: (selected: boolean) => void;
  setInvestigationTypeFilter: (filter: string) => void;
  resetInvestigationState: () => void;
  handleInvestigationScan: (platformId: string) => Promise<void>;
  
  // UI
  setSubmitting: (submitting: boolean) => void;
  setPanelMode: React.Dispatch<React.SetStateAction<PanelMode>>;
  showToast: (options: { type: 'success' | 'info' | 'warning' | 'error'; message: string }) => void;
}

export interface InvestigationActionsReturn {
  handleSelectInvestigationPlatform: (platformId: string) => void;
  toggleInvestigationEntity: (entityId: string) => Promise<void>;
  selectAllInvestigationEntities: () => Promise<void>;
  clearInvestigationSelection: () => Promise<void>;
  handleCreateWorkbench: () => Promise<void>;
  resetInvestigation: () => void;
}

export function useInvestigationActions(props: InvestigationActionsProps): InvestigationActionsReturn {
  const {
    availablePlatforms,
    selectedPlatformId,
    investigationEntities,
    setInvestigationEntities,
    filteredInvestigationEntities,
    setInvestigationPlatformId,
    setInvestigationPlatformSelected,
    setInvestigationTypeFilter,
    resetInvestigationState,
    handleInvestigationScan,
    setSubmitting,
    setPanelMode,
    showToast,
  } = props;

  const handleSelectInvestigationPlatform = useCallback((platformId: string) => {
    setInvestigationPlatformId(platformId);
    setInvestigationPlatformSelected(true);
    handleInvestigationScan(platformId);
  }, [setInvestigationPlatformId, setInvestigationPlatformSelected, handleInvestigationScan]);

  const toggleInvestigationEntity = useCallback(async (entityId: string) => {
    const entity = investigationEntities.find(e => e.id === entityId);
    const newSelected = entity ? !entity.selected : true;
    setInvestigationEntities(prev => prev.map(e => e.id === entityId ? { ...e, selected: newSelected } : e));
    
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { 
          type: 'INVESTIGATION_SYNC_SELECTION', 
          payload: { entityId, selected: newSelected } 
        });
      }
    }
  }, [investigationEntities, setInvestigationEntities]);

  const selectAllInvestigationEntities = useCallback(async () => {
    const filteredIds = filteredInvestigationEntities.map(e => e.id);
    setInvestigationEntities(prev => prev.map(e => filteredIds.includes(e.id) ? { ...e, selected: true } : e));
    
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { 
          type: 'INVESTIGATION_SYNC_ALL', 
          payload: { entityIds: filteredIds, selected: true } 
        });
      }
    }
  }, [filteredInvestigationEntities, setInvestigationEntities]);

  const clearInvestigationSelection = useCallback(async () => {
    const filteredIds = filteredInvestigationEntities.map(e => e.id);
    setInvestigationEntities(prev => prev.map(e => filteredIds.includes(e.id) ? { ...e, selected: false } : e));
    
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { 
          type: 'INVESTIGATION_SYNC_ALL', 
          payload: { entityIds: filteredIds, selected: false } 
        });
      }
    }
  }, [filteredInvestigationEntities, setInvestigationEntities]);

  const handleCreateWorkbench = useCallback(async () => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
    const selectedEntities = investigationEntities.filter(e => e.selected);
    if (selectedEntities.length === 0) return;
    
    setSubmitting(true);
    let workbenchName = 'Investigation';
    let currentTab: chrome.tabs.Tab | undefined;
    
    try { 
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); 
      currentTab = tab; 
      if (tab?.title) workbenchName = tab.title; 
    } catch { /* use default */ }
    
    const entityIds = selectedEntities.map(e => e.id).filter(id => id && id.length > 0);
    const response = await chrome.runtime.sendMessage({
      type: 'CREATE_WORKBENCH',
      payload: { 
        name: workbenchName, 
        description: `Investigation with ${entityIds.length} entities`, 
        entityIds, 
        platformId: selectedPlatformId || availablePlatforms[0]?.id 
      },
    });
    
    if (response?.success && response.data?.url) {
      chrome.tabs.create({ url: response.data.url });
      if (currentTab?.id) { 
        chrome.tabs.sendMessage(currentTab.id, { type: 'CLEAR_HIGHLIGHTS' }); 
        chrome.tabs.sendMessage(currentTab.id, { type: 'HIDE_PANEL' }); 
      }
      setInvestigationEntities([]);
      setInvestigationTypeFilter('all');
      setPanelMode('empty');
      showToast({ type: 'success', message: 'Workbench created successfully' });
    } else {
      showToast({ type: 'error', message: response?.error || 'Failed to create workbench' });
    }
    setSubmitting(false);
  }, [investigationEntities, selectedPlatformId, availablePlatforms, setInvestigationEntities, setInvestigationTypeFilter, setPanelMode, showToast, setSubmitting]);

  const resetInvestigation = useCallback(() => {
    resetInvestigationState();
    setPanelMode('empty');
    chrome.tabs?.query({ active: true, currentWindow: true }).then(([tab]) => { 
      if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: 'CLEAR_HIGHLIGHTS' }); 
    });
  }, [resetInvestigationState, setPanelMode]);

  return {
    handleSelectInvestigationPlatform,
    toggleInvestigationEntity,
    selectAllInvestigationEntities,
    clearInvestigationSelection,
    handleCreateWorkbench,
    resetInvestigation,
  };
}

