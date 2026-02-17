import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  Box,
  Typography,
  IconButton,
} from '@mui/material';
import {
  CloseOutlined,
} from '@mui/icons-material';
import themeDark from '../shared/theme/theme-dark';
import themeLight from '../shared/theme/theme-light';
import { loggers } from '../shared/utils/logger';
import { sessionStorage } from '../shared/utils/storage';
import { cleanHtmlContent, generateDescription } from './utils/description-helpers';
import { CommonEmptyView } from './components/CommonEmptyView';
import { CommonLoadingView } from './components/CommonLoadingView';
import { useScenarioState } from './hooks/useScenarioState';
import { useAIState } from './hooks/useAIState';
import { useAtomicTestingState } from './hooks/useAtomicTestingState';
import { useInvestigationState } from './hooks/useInvestigationState';
import { useContainerState } from './hooks/useContainerState';
import { useScanResultsState } from './hooks/useScanResultsState';
import { useSearchState } from './hooks/useSearchState';
import { useEntityState } from './hooks/useEntityState';
import { useAddSelectionState } from './hooks/useAddSelectionState';
import { useContainerActions } from './hooks/useContainerActions';
import { useInvestigationActions } from './hooks/useInvestigationActions';
import { useToast } from './hooks/useToast';
import { usePlatforms } from './hooks/usePlatforms';
import { CommonNotFoundView } from './components/CommonNotFoundView';
import { CommonScanResultsView } from './views/CommonScanResultsView';
import { CommonUnifiedSearchView } from './views/CommonUnifiedSearchView';
import { CommonPreviewView } from './views/CommonPreviewView';
import { CommonPlatformSelectView } from './views/CommonPlatformSelectView';
import { OCTIEntityView } from './views/OCTIEntityView';
import { OCTIImportResultsView } from './views/OCTIImportResultsView';
import { OCTIContainerTypeView } from './views/OCTIContainerTypeView';
import { OCTIContainerFormView } from './views/OCTIContainerFormView';
import { OCTIExistingContainersView } from './views/OCTIExistingContainersView';
import { OCTIInvestigationView } from './views/OCTIInvestigationView';
import { OCTIAddView } from './views/OCTIAddView';
import { OCTIAddSelectionView } from './views/OCTIAddSelectionView';
import { AddToScanResultsView } from './views/AddToScanResultsView';
import { OAEVEntityView } from './views/OAEVEntityView';
import { OAEVAtomicTestingView } from './views/OAEVAtomicTestingView';
import { OAEVScenarioView } from './views/OAEVScenarioView';
import { parsePrefixedType, prefixEntityType, type PlatformType } from '../shared/platform/registry';
import { formatDate } from '../shared/utils/formatters';
import { SCENARIO_DEFAULT_VALUES } from '../shared/types/openaev';
import type { PlatformConfig } from '../shared/types/settings';
import { processScanResults } from './handlers/scan-results-handler';
import { sendMessageToContentScript } from './utils/content-messaging';
import type {
  PanelMode,
  EntityData,
  PlatformInfo,
  MultiPlatformResult,
} from './types/panel-types';
const log = loggers.panel;

const App: React.FC = () => {
  const [mode, setMode] = useState<'dark' | 'light'>('dark');
  const [panelMode, setPanelMode] = useState<PanelMode>('empty');
  // Split screen mode - panel is in browser native side panel, not floating iframe
  const [isSplitScreenMode, setIsSplitScreenMode] = useState<boolean>(false);
  // Scanning state - true when a scan is in progress
  const [isScanning, setIsScanning] = useState<boolean>(false);
  // PDF view state - true when on PDF scanner or native PDF
  const [isPdfView, setIsPdfView] = useState<boolean>(false);

  // Platform state hook
  const {
    availablePlatforms, setAvailablePlatforms, availablePlatformsRef,
    selectedPlatformId, setSelectedPlatformId,
    platformUrl, setPlatformUrl,
    openctiPlatforms, openaevPlatforms,
    loadPlatforms,
  } = usePlatforms();
  
  // Keep ref for openctiPlatforms (used in event handlers)
  const openctiPlatformsRef = React.useRef<PlatformInfo[]>([]);
  React.useEffect(() => { openctiPlatformsRef.current = openctiPlatforms; }, [openctiPlatforms]);
  
  // Test platform connections for EE status when platforms are loaded
  const platformsTestedRef = React.useRef(false);
  React.useEffect(() => {
    if (availablePlatforms.length > 0 && !platformsTestedRef.current) {
      platformsTestedRef.current = true;
      availablePlatforms.forEach((platform) => {
        chrome.runtime.sendMessage(
          { type: 'TEST_PLATFORM_CONNECTION', payload: { platformId: platform.id, platformType: platform.type } },
          (testResponse) => {
            if (chrome.runtime.lastError || !testResponse?.success) return;
            setAvailablePlatforms(prev => prev.map(p => 
              p.id === platform.id ? { ...p, version: testResponse.data?.version, isEnterprise: testResponse.data?.enterprise_edition } : p
            ));
          }
        );
      });
    }
  }, [availablePlatforms, setAvailablePlatforms]);

  // Entity state hook
  const {
    entity, setEntity,
    multiPlatformResults, setMultiPlatformResults,
    multiPlatformResultsRef,
    currentPlatformIndex, setCurrentPlatformIndex,
    currentPlatformIndexRef,
    entityFromSearchMode, setEntityFromSearchMode,
    entityDetailsLoading, setEntityDetailsLoading,
    sortPlatformResults,
    clearEntityState,
    updateMultiPlatformResultsRef,
    updateCurrentPlatformIndexRef,
  } = useEntityState();

  // Scan results state hook
  const {
    scanResultsEntities, setScanResultsEntities,
    scanResultsEntitiesRef,
    scanResultsTypeFilter, setScanResultsTypeFilter,
    scanResultsFoundFilter, setScanResultsFoundFilter,
    selectedScanItems, setSelectedScanItems,
    scanPageContent, setScanPageContent,
    currentPageUrl, setCurrentPageUrl,
    currentPageTitle, setCurrentPageTitle,
    currentPdfFileName, setCurrentPdfFileName,
    isPdfSource, setIsPdfSource,
    entityFromScanResults, setEntityFromScanResults,
    getSelectedEntitiesForPreview,
  } = useScanResultsState();

  // Search state hook
  const {
    unifiedSearchQuery, setUnifiedSearchQuery,
    unifiedSearchResults, setUnifiedSearchResults,
    unifiedSearching, setUnifiedSearching,
    unifiedSearchPlatformFilter, setUnifiedSearchPlatformFilter,
    unifiedSearchTypeFilter, setUnifiedSearchTypeFilter,
    handleUnifiedSearch,
  } = useSearchState();

  // Add selection state hook
  const {
    addSelectionText, setAddSelectionText,
    addSelectionEntityType, setAddSelectionEntityType,
    addingSelection, setAddingSelection,
    addSelectionFromContextMenu, setAddSelectionFromContextMenu,
  } = useAddSelectionState();

  // Add to scan results state (for context menu "Add to scan results")
  const [addToScanResultsText, setAddToScanResultsText] = useState<string>('');
  const [addToScanResultsEntityType, setAddToScanResultsEntityType] = useState<string>('');

  // Container state hook
  const {
    containerType, setOCTIContainerType,
    containerForm, setContainerForm,
    entityContainers, setEntityContainers,
    loadingContainers, setLoadingContainers,
    selectedLabels, setSelectedLabels,
    selectedMarkings, setSelectedMarkings,
    availableLabels, setAvailableLabels,
    availableMarkings, setAvailableMarkings,
    entitiesToAdd, setEntitiesToAdd,
    addFromNotFound, setAddFromNotFound,
    submitting, setSubmitting,
    containerSpecificFields, setContainerSpecificFields,
    availableReportTypes, setAvailableReportTypes,
    availableContexts, setAvailableContexts,
    availableSeverities, setAvailableSeverities,
    availablePriorities, setAvailablePriorities,
    availableResponseTypes, setAvailableResponseTypes,
    availableAuthors, setAvailableAuthors,
    existingContainers, setExistingContainers,
    checkingExisting: _checkingExisting, setCheckingExisting,
    updatingContainerId, setUpdatingContainerId,
    updatingContainerDates, setUpdatingContainerDates,
    importResults, setImportResults,
    containerWorkflowOrigin, setContainerWorkflowOrigin,
    createIndicators, setCreateIndicators,
    attachPdf, setAttachPdf,
    generatingPdf, setGeneratingPdf,
    createAsDraft, setCreateAsDraft,
    labelsLoaded, setLabelsLoaded,
    markingsLoaded, setMarkingsLoaded,
  } = useContainerState();

  // AI state hook
  const {
    aiSettings, setAiSettings,
    aiGeneratingDescription, setAiGeneratingDescription,
    aiSelectingInjects, setAiSelectingInjects,
    aiFillingEmails, setAiFillingEmails,
    aiDiscoveringEntities, setAiDiscoveringEntities,
    aiResolvingRelationships, setAiResolvingRelationships,
    resolvedRelationships, setResolvedRelationships,
  } = useAIState();

  // Scenario state hook
  const {
    scenarioOverviewData, setScenarioOverviewData,
    scenarioForm, setScenarioForm,
    selectedInjects, setSelectedInjects,
    scenarioEmails, setScenarioEmails,
    scenarioLoading, setScenarioLoading,
    scenarioStep, setScenarioStep,
    scenarioTypeAffinity, setScenarioTypeAffinity,
    scenarioPlatformsAffinity, setScenarioPlatformsAffinity,
    scenarioInjectSpacing, setScenarioInjectSpacing,
    scenarioPlatformSelected, setScenarioPlatformSelected,
    scenarioPlatformId, setScenarioPlatformId,
    scenarioRawAttackPatterns, setScenarioRawAttackPatterns,
    scenarioTargetType, setScenarioTargetType,
    scenarioAssets, setScenarioAssets,
    scenarioAssetGroups, setScenarioAssetGroups,
    scenarioTeams, setScenarioTeams,
    scenarioSelectedAsset, setScenarioSelectedAsset,
    scenarioSelectedAssetGroup, setScenarioSelectedAssetGroup,
    scenarioSelectedTeam, setScenarioSelectedTeam,
    scenarioCreating, setScenarioCreating,
    scenarioAIMode, setScenarioAIMode,
    scenarioAIGenerating, setScenarioAIGenerating,
    scenarioAINumberOfInjects, setScenarioAINumberOfInjects,
    scenarioAIPayloadAffinity, setScenarioAIPayloadAffinity,
    scenarioAITableTopDuration, setScenarioAITableTopDuration,
    scenarioAIEmailLanguage, setScenarioAIEmailLanguage,
    scenarioAITheme, setScenarioAITheme,
    scenarioAIContext, setScenarioAIContext,
    scenarioAIGeneratedScenario, setScenarioAIGeneratedScenario,
    resetScenarioState,
  } = useScenarioState();

  // Atomic testing state hook
  const {
    atomicTestingTargets, setAtomicTestingTargets,
    selectedAtomicTarget, setSelectedAtomicTarget,
    atomicTestingShowList, setAtomicTestingShowList,
    atomicTestingPlatformId, setAtomicTestingPlatformId,
    atomicTestingPlatformSelected, setAtomicTestingPlatformSelected,
    atomicTestingTargetType, setAtomicTestingTargetType,
    atomicTestingAssets, setAtomicTestingAssets,
    atomicTestingAssetGroups, setAtomicTestingAssetGroups,
    atomicTestingTypeFilter, setAtomicTestingTypeFilter,
    atomicTestingInjectorContracts, setAtomicTestingInjectorContracts,
    atomicTestingSelectedAsset, setAtomicTestingSelectedAsset,
    atomicTestingSelectedAssetGroup, setAtomicTestingSelectedAssetGroup,
    atomicTestingSelectedContract, setAtomicTestingSelectedContract,
    atomicTestingTitle, setAtomicTestingTitle,
    atomicTestingCreating, setAtomicTestingCreating,
    atomicTestingLoadingAssets, setAtomicTestingLoadingAssets,
    atomicTestingAIMode, setAtomicTestingAIMode,
    atomicTestingAIGenerating, setAtomicTestingAIGenerating,
    atomicTestingAIPlatform, setAtomicTestingAIPlatform,
    atomicTestingAIExecutor, setAtomicTestingAIExecutor,
    atomicTestingAIContext, setAtomicTestingAIContext,
    atomicTestingAIGeneratedPayload, setAtomicTestingAIGeneratedPayload,
    resetAtomicTestingState,
  } = useAtomicTestingState();

  // Investigation state hook
  const {
    investigationEntities, setInvestigationEntities,
    investigationScanning, setInvestigationScanning,
    investigationTypeFilter, setInvestigationTypeFilter,
    investigationSearchQuery, setInvestigationSearchQuery,
    investigationPlatformSelected, setInvestigationPlatformSelected,
    investigationPlatformId, setInvestigationPlatformId,
    investigationEntityTypes,
    filteredInvestigationEntities,
    selectedInvestigationCount,
    resetInvestigationState,
  } = useInvestigationState();

  const theme = useMemo(() => {
    const themeOptions = mode === 'dark' ? themeDark() : themeLight();
    return createTheme(themeOptions);
  }, [mode]);

  // Toast notification hook
  const { showToast } = useToast();

  // Forward declare handleInvestigationScan for the hook (will be defined below)
  const handleInvestigationScanRef = React.useRef<(platformId: string) => Promise<void>>(async () => {});

  // Container actions hook
  const { 
    handleAddEntities, 
    handleCreateContainer, 
    handleGenerateAIDescription 
  } = useContainerActions({
    openctiPlatforms,
    availablePlatforms,
    selectedPlatformId,
    setPlatformUrl,
    setSelectedPlatformId,
    entitiesToAdd,
    setEntitiesToAdd,
    containerType,
    containerForm,
    setContainerForm,
    containerSpecificFields,
    selectedLabels,
    selectedMarkings,
    createIndicators,
    attachPdf,
    setGeneratingPdf,
    createAsDraft,
    updatingContainerId,
    setUpdatingContainerId,
    updatingContainerDates,
    setUpdatingContainerDates,
    setContainerWorkflowOrigin,
    setAttachPdf,
    setCreateAsDraft,
    setImportResults,
    aiSettings,
    resolvedRelationships,
    setAiGeneratingDescription,
    setEntity,
    setEntityContainers,
    currentPageUrl,
    currentPageTitle,
    currentPdfFileName,
    isPdfSource,
    setSubmitting,
    setPanelMode,
    showToast,
  });

  // Investigation actions hook
  const {
    handleSelectInvestigationPlatform,
    toggleInvestigationEntity,
    selectAllInvestigationEntities,
    clearInvestigationSelection,
    handleCreateWorkbench,
    resetInvestigation,
  } = useInvestigationActions({
    availablePlatforms,
    selectedPlatformId,
    investigationEntities,
    setInvestigationEntities,
    filteredInvestigationEntities,
    investigationPlatformId,
    setInvestigationPlatformId,
    setInvestigationPlatformSelected,
    setInvestigationTypeFilter,
    resetInvestigationState,
    handleInvestigationScan: (platformId: string) => handleInvestigationScanRef.current?.(platformId) ?? Promise.resolve(),
    setSubmitting,
    setPanelMode,
    showToast,
  });

  // Sync entitiesToAdd with selectedScanItems when in preview mode
  React.useEffect(() => {
    if (panelMode === 'preview' && scanResultsEntitiesRef.current.length > 0) {
      const updatedEntities = getSelectedEntitiesForPreview();
      setEntitiesToAdd(current => {
        const currentValues = new Set(current.map(e => e.value || e.name));
        const newValues = new Set(updatedEntities.map(e => e.value || e.name));
        if (currentValues.size !== newValues.size) return updatedEntities;
        for (const v of currentValues) {
          if (!newValues.has(v)) return updatedEntities;
        }
        return current;
      });
    }
  }, [panelMode, selectedScanItems, getSelectedEntitiesForPreview, setEntitiesToAdd, scanResultsEntitiesRef]);

  // Load labels and markings lazily
  const loadLabelsAndMarkings = (platformId?: string) => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
    const targetPlatformId = platformId || selectedPlatformId;
    
    if (!labelsLoaded) {
      // Use SEARCH_LABELS with limit of 10 for initial load
      chrome.runtime.sendMessage({ type: 'SEARCH_LABELS', payload: { search: '', first: 10, platformId: targetPlatformId } }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Failed to load labels:', chrome.runtime.lastError);
          return;
        }
        if (response?.success && response.data) {
          setAvailableLabels(response.data);
          setLabelsLoaded(true);
        } else if (response?.error) {
          console.error('Labels load error:', response.error);
        }
      });
    }
    
    if (!markingsLoaded) {
      chrome.runtime.sendMessage({ type: 'FETCH_MARKINGS', payload: { platformId: targetPlatformId } }, (response) => {
        if (chrome.runtime.lastError) return;
        if (response?.success && response.data) {
          setAvailableMarkings(response.data);
          setMarkingsLoaded(true);
        }
      });
    }
    
    // Load vocabularies
    const vocabTypes = [
      { type: 'report_types_ov', setter: setAvailableReportTypes },
      { type: 'grouping_context_ov', setter: setAvailableContexts },
      { type: 'case_severity_ov', setter: setAvailableSeverities },
      { type: 'case_priority_ov', setter: setAvailablePriorities },
      { type: 'incident_response_types_ov', setter: setAvailableResponseTypes },
    ];
    
    vocabTypes.forEach(({ type, setter }) => {
      chrome.runtime.sendMessage({ type: 'FETCH_VOCABULARY', payload: { category: type, platformId: targetPlatformId } }, (response) => {
        if (chrome.runtime.lastError) return;
        if (response?.success && response.data) setter(response.data);
      });
    });
    
    chrome.runtime.sendMessage({ type: 'SEARCH_IDENTITIES', payload: { search: '', first: 50, platformId: targetPlatformId } }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response?.success && response.data) setAvailableAuthors(response.data);
    });
  };

  // Fetch containers for an entity
  const fetchEntityContainers = async (entityId: string, platformId?: string) => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
    if (!entityId) return;
    
    setLoadingContainers(true);
    setEntityContainers([]);
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'FETCH_ENTITY_CONTAINERS',
        payload: { entityId, limit: 5, platformId },
      });
      if (response?.success && response.data) {
        setEntityContainers(response.data);
      }
    } catch (error) {
      log.error('Failed to fetch containers:', error);
    } finally {
      setLoadingContainers(false);
    }
  };

  // Helper to check if current tab is a PDF or PDF scanner page
  const checkAndHandlePdfPage = useCallback(async (): Promise<boolean> => {
    if (typeof chrome === 'undefined' || !chrome.tabs) return false;
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url) return false;
      
      const url = tab.url;
      const extensionId = chrome.runtime.id;
      
      // Check if already on PDF scanner page
      if (url.startsWith(`chrome-extension://${extensionId}/pdf-scanner/`) ||
          url.startsWith(`moz-extension://${extensionId}/pdf-scanner/`)) {
        // Already on PDF scanner - trigger rescan
        log.debug('Triggering PDF scanner rescan, isSplitScreenMode:', isSplitScreenMode);
        
        // In iframe mode (panel embedded in PDF scanner), use postMessage directly
        // chrome.tabs.sendMessage doesn't work for extension pages
        if (!isSplitScreenMode) {
          // Send directly to parent (PDF scanner) via postMessage
          window.parent.postMessage({ type: 'XTM_PDF_SCANNER_RESCAN' }, '*');
          log.debug('PDF scanner rescan triggered via postMessage');
        } else if (tab.id) {
          // In split screen mode, go through background
          try {
            const response = await chrome.runtime.sendMessage({ 
              type: 'PDF_SCANNER_RESCAN', 
              payload: { tabId: tab.id } 
            });
            log.debug('PDF_SCANNER_RESCAN response:', response);
          } catch (e) {
            log.error('PDF_SCANNER_RESCAN failed:', e);
          }
        }
        return true;
      }
      
      // Check if on a raw PDF page (including Chrome's built-in PDF viewer)
      // Chrome's PDF viewer uses extension ID: mhjfbmdgcfjbbpaeojofohoefgiehjai
      const lowerUrl = url.toLowerCase();
      const isPdfPage = lowerUrl.endsWith('.pdf') || 
        lowerUrl.includes('.pdf?') || 
        lowerUrl.includes('.pdf#') ||
        lowerUrl.includes('mhjfbmdgcfjbbpaeojofohoefgiehjai') || // Chrome's built-in PDF viewer
        url.match(/\/[^/]+\.pdf($|\?|#)/i) !== null;
      
      if (isPdfPage) {
        // Open PDF scanner for this URL
        // For Chrome's PDF viewer, extract the actual PDF URL
        let pdfUrl = url;
        if (url.includes('mhjfbmdgcfjbbpaeojofohoefgiehjai')) {
          // Chrome PDF viewer URL format: chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/index.html?<actual_pdf_url>
          const match = url.match(/[?&]([^&]+\.pdf[^&]*)/i);
          if (match) {
            pdfUrl = decodeURIComponent(match[1]);
          }
        }
        
        const response = await chrome.runtime.sendMessage({
          type: 'OPEN_PDF_SCANNER',
          payload: { pdfUrl },
        });
        if (response?.success) {
          log.debug('PDF scanner opened for:', pdfUrl);
        }
        return true;
      }
      
      return false;
    } catch (error) {
      log.error('Error checking PDF page:', error);
      return false;
    }
  }, [isSplitScreenMode]);

  // Handle investigation scan
  const handleInvestigationScan = useCallback(async (platformId?: string) => {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;
    const targetPlatformId = platformId || investigationPlatformId;
    if (!targetPlatformId && openctiPlatforms.length > 1) return;
    
    // Check if on PDF page first - PDF pages should use the standard scan which is shown in panel
    const isPdf = await checkAndHandlePdfPage();
    if (isPdf) return;
    
    setInvestigationScanning(true);
    setInvestigationEntities([]);
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { 
          type: 'SCAN_FOR_INVESTIGATION',
          payload: { platformId: targetPlatformId || openctiPlatforms[0]?.id },
        });
      }
    } catch (error) {
      log.error('Investigation scan failed:', error);
    }
  }, [investigationPlatformId, openctiPlatforms, checkAndHandlePdfPage, setInvestigationScanning, setInvestigationEntities]);

  // Wrapper for unified search that passes platforms
  const doUnifiedSearch = async (queryOverride?: string) => {
    await handleUnifiedSearch(availablePlatforms, queryOverride);
  };

  // Helper to send message to content script - uses shared utility
  const sendToContentScript = sendMessageToContentScript;

  // Empty view action handlers
  const handleEmptyViewScan = async () => {
    // If we know we're in PDF view mode (set via postMessage from PDF scanner),
    // handle the rescan directly without relying on chrome.tabs.query
    // This is more reliable on first load when the panel is in an iframe
    if (isPdfView && !isSplitScreenMode) {
      // We're in iframe mode inside PDF scanner - send postMessage directly
      log.debug('PDF view detected via state, triggering rescan via postMessage');
      window.parent.postMessage({ type: 'XTM_PDF_SCANNER_RESCAN' }, '*');
      return;
    }
    
    // In split screen mode with PDF view detected, open PDF scanner for the current tab
    // This handles the case when user is on a native PDF page with the sidebar open
    if (isPdfView && isSplitScreenMode) {
      log.debug('PDF view in split screen mode, checking for PDF page');
      const isPdf = await checkAndHandlePdfPage();
      if (isPdf) return;
    }
    
    // Check if on PDF page first (fallback for other cases)
    const isPdf = await checkAndHandlePdfPage();
    if (isPdf) return;
    
    setIsScanning(true);
    sendToContentScript('SCAN_ALL');
  };
  const handleEmptyViewSearch = () => setPanelMode('unified-search');
  const handleEmptyViewCreateContainer = () => sendToContentScript('CREATE_CONTAINER_FROM_PAGE');
  const handleEmptyViewInvestigate = () => sendToContentScript('CREATE_INVESTIGATION');
  const handleEmptyViewAtomicTesting = () => sendToContentScript('SCAN_ATOMIC_TESTING');
  const handleEmptyViewGenerateScenario = () => sendToContentScript('CREATE_SCENARIO_FROM_PAGE');
  const handleEmptyViewClearHighlights = () => sendToContentScript('CLEAR_HIGHLIGHTS');

  // Main initialization effect
  useEffect(() => {
    const isExtension = typeof chrome !== 'undefined' && chrome.runtime?.sendMessage;
    if (!isExtension) {
      setMode('dark');
      return;
    }

    // Get theme setting
    chrome.runtime.sendMessage({ type: 'GET_PLATFORM_THEME' }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response?.success) {
        setMode(response.data === 'light' ? 'light' : 'dark');
      }
    });

    // Detect if we're in split screen mode (browser native side panel vs floating iframe)
    // In browser side panel, window.parent === window (not in an iframe)
    const isInSidePanel = window.parent === window;
    setIsSplitScreenMode(isInSidePanel);

    // Get settings for theme, split screen mode, and AI (platforms loaded via usePlatforms hook)
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response?.success) {
        if (response.data?.theme) {
          setMode(response.data.theme === 'light' ? 'light' : 'dark');
        }
        
        // Update split screen mode from settings (fallback if detection fails)
        if (response.data?.splitScreenMode !== undefined) {
          // If in iframe but setting is true, we might be in transition - use detected value
          // If not in iframe, we're definitely in side panel
          setIsSplitScreenMode(isInSidePanel || response.data.splitScreenMode);
        }
        
        const ai = response.data?.ai;
        const aiAvailable = !!(ai?.provider && ai?.apiKey && ai?.model);
        setAiSettings({ enabled: aiAvailable, provider: ai?.provider, available: aiAvailable });
      }
    });
    
    // Load platforms via hook
    loadPlatforms();

    window.addEventListener('message', handleMessage);
    window.parent.postMessage({ type: 'XTM_PANEL_READY' }, '*');
    
    // Small delay before GET_PANEL_STATE to ensure React is fully initialized
    // This helps with native side panel where timing can be critical
    setTimeout(() => {
      chrome.runtime.sendMessage({ type: 'GET_PANEL_STATE' }, (response) => {
        if (chrome.runtime.lastError) return;
        if (response?.success && response.data) handlePanelState(response.data);
      });
    }, 50);
    
    // Listen for runtime messages (for split screen mode)
    // In split screen mode, content script sends messages via chrome.runtime
    const handleRuntimeMessage = (message: { type: string; payload?: unknown }) => {
      if (message.type === 'PANEL_MESSAGE_BROADCAST' && message.payload) {
        const panelMessage = message.payload as { type: string; payload?: unknown };
        log.debug('[PANEL] Received broadcast message:', panelMessage.type);
        handlePanelState(panelMessage);
      }
    };
    
    chrome.runtime.onMessage.addListener(handleRuntimeMessage);
    
    // Track last processed message timestamp to avoid processing stale messages
    let lastProcessedMessageTime = 0;
    
    // Check for pending panel state from session storage (split screen mode in Chrome/Edge)
    // This handles the case where context menu was used but panel wasn't ready yet
    const checkPendingState = () => {
      sessionStorage.get<{ type: string; payload?: unknown; timestamp?: number }>('pendingPanelState').then((pendingState) => {
        if (pendingState) {
          // Only process if this message is newer than the last one we processed
          const messageTime = pendingState.timestamp || 0;
          if (messageTime > lastProcessedMessageTime) {
            lastProcessedMessageTime = messageTime || Date.now();
            handlePanelState(pendingState);
          }
          sessionStorage.remove('pendingPanelState');
        }
      }).catch(() => {
        // Session storage not available
      });
    };
    
    // Update handleMessage to use timestamp tracking
    const originalHandleMessage = handleMessage;
    const handleMessageWithTimestamp = (event: MessageEvent) => {
      const { type } = event.data;
      if (type) {
        lastProcessedMessageTime = Date.now();
      }
      originalHandleMessage(event);
    };
    window.removeEventListener('message', handleMessage);
    window.addEventListener('message', handleMessageWithTimestamp);
    
    // Initial check after a small delay (same as GET_PANEL_STATE)
    setTimeout(() => checkPendingState(), 100);
    
    // Poll for pending state a few times (for split screen mode in Chrome/Edge)
    // Use shorter intervals for faster response
    let pollCount = 0;
    const maxPolls = 5;
    const pollInterval = setInterval(() => {
      pollCount++;
      if (pollCount >= maxPolls) {
        clearInterval(pollInterval);
        return;
      }
      checkPendingState();
    }, 200);
    
    // Listen for storage changes
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === 'local' && changes.settings) {
        const newSettings = changes.settings.newValue as { ai?: { provider?: string; apiKey?: string; model?: string } } | undefined;
        if (newSettings) {
          // Reload platforms via hook (handles platform state updates)
          loadPlatforms();
          
          // Update AI settings
          const ai = newSettings.ai;
          const aiAvailable = !!(ai?.provider && ai?.apiKey && ai?.model);
          setAiSettings({ enabled: aiAvailable, provider: ai?.provider, available: aiAvailable });
        }
      }
    };
    
    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      window.removeEventListener('message', handleMessageWithTimestamp);
      chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
      chrome.storage.onChanged.removeListener(handleStorageChange);
      clearInterval(pollInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check if we're on a PDF view (native PDF or PDF scanner)
  useEffect(() => {
    const checkPdfView = async () => {
      // First, check if we're embedded in PDF scanner via iframe
      // This is more reliable than chrome.tabs.query when in iframe mode
      if (!isSplitScreenMode && window.parent !== window) {
        try {
          // Request PDF scanner to confirm we're in PDF view
          window.parent.postMessage({ type: 'XTM_CHECK_PDF_VIEW' }, '*');
        } catch {
          // Ignore - cross-origin issues
        }
      }
      
      // Also try chrome.tabs.query as a fallback (works better in split screen mode)
      if (typeof chrome === 'undefined' || !chrome.tabs?.query) return;
      
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.url) {
          const url = tab.url;
          const extensionId = chrome.runtime.id;
          
          // Check if on PDF scanner page
          const isPdfScannerPage = url.startsWith(`chrome-extension://${extensionId}/pdf-scanner/`) ||
                                   url.startsWith(`moz-extension://${extensionId}/pdf-scanner/`);
          
          // Check if on native PDF page (including Chrome's built-in PDF viewer)
          // Chrome's PDF viewer uses extension ID: mhjfbmdgcfjbbpaeojofohoefgiehjai
          const lowerUrl = url.toLowerCase();
          const isNativePdf = lowerUrl.endsWith('.pdf') || 
                              lowerUrl.includes('.pdf?') || 
                              lowerUrl.includes('.pdf#') ||
                              lowerUrl.includes('mhjfbmdgcfjbbpaeojofohoefgiehjai') || // Chrome's built-in PDF viewer
                              url.match(/\/[^/]+\.pdf($|\?|#)/i) !== null;
          
          setIsPdfView(isPdfScannerPage || isNativePdf);
        }
      } catch (e) {
        // Ignore - may not have tab access
      }
    };
    
    checkPdfView();
    
    // In split screen mode, also check after a delay to handle initial load timing issues
    // The PDF scanner tab might not be fully ready when the panel first loads
    if (isSplitScreenMode) {
      const delayedChecks = [100, 300, 600, 1000];
      delayedChecks.forEach(delay => {
        setTimeout(() => checkPdfView(), delay);
      });
    }
    
    // Re-check when tab changes (listen for tab activation)
    const handleTabActivated = () => checkPdfView();
    if (typeof chrome !== 'undefined' && chrome.tabs?.onActivated) {
      chrome.tabs.onActivated.addListener(handleTabActivated);
    }
    
    // Re-check when the current tab's URL changes (e.g., navigating to a PDF)
    const handleTabUpdated = (tabId: number, changeInfo: { url?: string; status?: string }) => {
      // Only check if URL changed and tab is in the current window
      if (changeInfo.url || changeInfo.status === 'complete') {
        // Check if this is the active tab in the current window
        chrome.tabs.query({ active: true, currentWindow: true }).then(([activeTab]) => {
          if (activeTab?.id === tabId) {
            checkPdfView();
          }
        }).catch(() => {});
      }
    };
    if (typeof chrome !== 'undefined' && chrome.tabs?.onUpdated) {
      chrome.tabs.onUpdated.addListener(handleTabUpdated);
    }
    
    // Re-check when page visibility changes (tab becomes active)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkPdfView();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      if (typeof chrome !== 'undefined' && chrome.tabs?.onActivated) {
        chrome.tabs.onActivated.removeListener(handleTabActivated);
      }
      if (typeof chrome !== 'undefined' && chrome.tabs?.onUpdated) {
        chrome.tabs.onUpdated.removeListener(handleTabUpdated);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isSplitScreenMode]);

  // Load labels and markings when container form is needed
  useEffect(() => {
    if (panelMode === 'container-form' || panelMode === 'container-type') {
      setLabelsLoaded(false);
      setMarkingsLoaded(false);
      setSelectedLabels([]);
      setSelectedMarkings([]);
      setContainerSpecificFields(prev => ({ ...prev, createdBy: '' }));
      loadLabelsAndMarkings(selectedPlatformId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelMode, selectedPlatformId]);

  const handleMessage = (event: MessageEvent) => {
    const { type, payload } = event.data;
    handlePanelState({ type, payload });
  };

  // Main message handler - dispatches to appropriate state updates
  const handlePanelState = async (data: { type: string; payload?: any }) => {
    // Handle theme from payload
    if (data.payload?.theme && (data.payload.theme === 'dark' || data.payload.theme === 'light')) {
      if (data.payload.theme !== mode) setMode(data.payload.theme);
    }
    
    switch (data.type) {
      case 'SHOW_ENTITY':
      case 'SHOW_ENTITY_PANEL':
        await handleShowEntity(data.payload);
        break;
      case 'SHOW_ADD_PANEL':
        setEntitiesToAdd(data.payload?.entities || []);
        setPanelMode('add');
        break;
      case 'SHOW_CREATE_CONTAINER':
      case 'SHOW_CONTAINER_PANEL':
        await handleShowContainer(data.payload);
        break;
      case 'SHOW_INVESTIGATION_PANEL':
        handleShowInvestigation();
        break;
      case 'ATOMIC_TESTING_SCAN_RESULTS':
        handleShowAtomicTesting(data.payload);
        break;
      case 'INVESTIGATION_SCAN_RESULTS':
        handleInvestigationResults(data.payload);
        break;
      case 'SCAN_STARTED':
        // Clear previous scan results and show loading spinner
        // This handles the case when user clicks "Scan" while panel is already open
        setScanResultsEntities([]);
        setScanResultsTypeFilter('all');
        setScanResultsFoundFilter('all');
        setSelectedScanItems(new Set());
        setEntityFromScanResults(false);
        setIsScanning(true);
        setPanelMode('empty'); // Panel will show spinner when isScanning is true and mode is empty
        break;
      case 'SET_PDF_VIEW_MODE':
        // PDF scanner notifies panel that it's in PDF view mode
        // This ensures buttons are disabled even if tab detection has timing issues
        if (data.payload === true || data.payload === false) {
          setIsPdfView(data.payload);
        }
        break;
      case 'SCAN_RESULTS':
        setIsScanning(false);
        handleScanResults(data.payload);
        break;
      case 'SCAN_RESULTS_WITH_FILTER':
        handleScanResultsWithFilter(data.payload);
        break;
      case 'INVESTIGATION_TOGGLE_ENTITY':
        handleInvestigationToggle(data.payload);
        break;
      case 'SELECTION_UPDATED':
        if (Array.isArray(data.payload?.selectedItems)) {
          setSelectedScanItems(new Set(data.payload.selectedItems));
        }
        break;
      case 'CLEAR_SCAN_RESULTS':
        // Clear scan results and reset to empty state when highlights are cleared
        setScanResultsEntities([]);
        setScanResultsTypeFilter('all');
        setScanResultsFoundFilter('all');
        setSelectedScanItems(new Set());
        setScanPageContent('');
        setEntityFromScanResults(false);
        setIsScanning(false);
        setPanelMode('empty');
        break;
      case 'SHOW_UNIFIED_SEARCH_PANEL':
        handleShowUnifiedSearch(data.payload);
        break;
      case 'SHOW_ADD_SELECTION':
        if (data.payload?.selectedText) {
          setAddSelectionText(data.payload.selectedText);
          setAddSelectionFromContextMenu(true);
          setPanelMode('add-selection');
        }
        break;
      case 'SHOW_ADD_TO_SCAN_RESULTS':
        if (data.payload?.selectedText) {
          setAddToScanResultsText(data.payload.selectedText);
          setAddToScanResultsEntityType(''); // Clear previous type, user must select
          setPanelMode('add-to-scan-results');
        }
        break;
      case 'SHOW_SCENARIO_PANEL':
        await handleShowScenario(data.payload);
        break;
      case 'LOADING':
        setPanelMode('loading');
        break;
    }
  };

  // Handler: Show Entity
  const handleShowEntity = async (payload: any) => {
    setEntityContainers([]);
    setEntityFromSearchMode(null);
    
    // Restore scan results from payload if available (needed when panel was closed and reopened)
    if (payload?.scanResults) {
      const { entities } = processScanResults(payload.scanResults);
      if (entities.length > 0) {
        setScanResultsEntities(entities);
        scanResultsEntitiesRef.current = entities;
      }
    }
    
    // Use fromScanResults flag from payload if available, otherwise check local scan results
    const hasScanResults = payload?.fromScanResults === true || scanResultsEntitiesRef.current.length > 0;
    setEntityFromScanResults(hasScanResults);
    
    const entityId = payload?.entityData?.id || payload?.entityId || payload?.id;
    const entityType = payload?.entityData?.entity_type || payload?.type || payload?.entity_type;
    const platformId = payload?.platformId || payload?.platformId;
    const platformMatches = payload?.platformMatches || payload?.entityData?.platformMatches;
    
    // Build multi-platform results
    let multiResults: MultiPlatformResult[] = [];
    
    // Handle multi-platform results with platform fallback (same as CommonScanResultsView)
    if (platformMatches && platformMatches.length > 0) {
      for (const match of platformMatches) {
        // Try to find platform by ID first, then fall back to platformType match
        let platform = availablePlatforms.find(p => p.id === match.platformId);
        if (!platform && match.platformType) {
          // Fall back to finding any platform of the same type
          platform = availablePlatforms.find(p => p.type === match.platformType);
        }
        
        const matchPlatformType = (match.platformType || platform?.type || 'opencti') as PlatformType;
        const matchType = match.type || match.entityData?.entity_type || payload?.type || entityType || '';
        // Remove any existing prefix and get the clean type
        const parsed = parsePrefixedType(matchType);
        const cleanType = parsed ? parsed.entityType : matchType;
        // Apply proper prefix based on platform type
        const displayType = prefixEntityType(cleanType, matchPlatformType);
        
        // Use the found platform's ID if available
        const resolvedPlatformId = platform?.id || match.platformId;
        
        multiResults.push({
          platformId: resolvedPlatformId,
          platformName: platform?.name || match.platformId,
          entity: {
            ...payload,
            id: match.entityId,
            entityId: match.entityId,
            type: displayType,
            entity_type: cleanType,
            name: payload?.name || payload?.value || match.entityData?.name,
            value: payload?.value || payload?.name,
            existsInPlatform: true,
            platformId: resolvedPlatformId,
            platformType: matchPlatformType,
            isNonDefaultPlatform: matchPlatformType !== 'opencti',
            entityData: { ...(match.entityData || payload?.entityData || {}), entity_type: cleanType },
          } as EntityData,
        });
      }
      
      const sorted = sortPlatformResults(multiResults, availablePlatforms);
      multiResults = sorted;
      setMultiPlatformResults(sorted);
      updateMultiPlatformResultsRef(sorted);
      setCurrentPlatformIndex(0);
      updateCurrentPlatformIndexRef(0);
    } else if (platformId) {
      const platform = availablePlatforms.find(p => p.id === platformId);
      const singleResult: MultiPlatformResult[] = [{ platformId, platformName: platform?.name || platformId, entity: { ...payload, platformId: platformId } as EntityData }];
      multiResults = singleResult;
      setMultiPlatformResults(singleResult);
      updateMultiPlatformResultsRef(singleResult);
      setCurrentPlatformIndex(0);
      updateCurrentPlatformIndexRef(0);
    } else {
      setMultiPlatformResults([]);
      updateMultiPlatformResultsRef([]);
      setCurrentPlatformIndex(0);
      updateCurrentPlatformIndexRef(0);
    }
    
    // Update platform URL
    if (platformId && availablePlatforms.length > 0) {
      const platform = availablePlatforms.find(p => p.id === platformId);
      if (platform) {
        setPlatformUrl(platform.url);
        setSelectedPlatformId(platform.id);
      }
    }
    
    // Determine platform type for initial entity
    const parsedType = entityType ? parsePrefixedType(entityType) : null;
    const isNonDefaultPlatform = parsedType !== null;
    const entityPlatformType = parsedType?.platformType || 'opencti';
    
    // Set initial entity and panel mode
    const initialEntity = multiResults[0]?.entity || { ...payload, platformType: entityPlatformType, isNonDefaultPlatform: isNonDefaultPlatform };
    setEntity(initialEntity);
    setPanelMode(payload?.existsInPlatform || multiResults.length > 0 ? 'entity' : 'not-found');
    
    // Always fetch entity details for the first platform if entity exists
    // This ensures fresh data regardless of what's in the cache
    if (multiResults.length > 0 && multiResults[0] && typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      const firstResult = multiResults[0];
      const firstEntityId = (firstResult.entity.entityId || firstResult.entity.id) as string | undefined;
      const firstEntityType = ((firstResult.entity.entity_type || firstResult.entity.type || '') as string).replace(/^oaev-/, '');
      const firstPlatformId = firstResult.platformId;
      const firstPlatformType = (firstResult.entity.platformType || 'opencti') as string;
      
      if (firstEntityId && firstPlatformId) {
        setEntityDetailsLoading(true);
        
        chrome.runtime.sendMessage({
          type: 'GET_ENTITY_DETAILS',
          payload: { id: firstEntityId, entityType: firstEntityType, platformId: firstPlatformId, platformType: firstPlatformType },
        }, (response) => {
          setEntityDetailsLoading(false);
          if (chrome.runtime.lastError) return;
          if (currentPlatformIndexRef.current !== 0) return;
          
          if (response?.success && response.data) {
            const fullEntity = { 
              ...firstResult.entity, ...response.data, entityData: response.data, existsInPlatform: true,
              platformId: firstPlatformId, platformType: firstPlatformType, isNonDefaultPlatform: firstPlatformType !== 'opencti',
            };
            setEntity(fullEntity);
            setMultiPlatformResults(prev => prev.map((r, i) => 
              i === 0 ? { ...r, entity: { ...r.entity, ...response.data, entityData: response.data } } : r
            ));
            multiPlatformResultsRef.current = multiPlatformResultsRef.current.map((r, i) =>
              i === 0 ? { ...r, entity: { ...r.entity, ...response.data, entityData: response.data } as EntityData } : r
            );
            if (firstPlatformType === 'opencti' && firstEntityId) fetchEntityContainers(firstEntityId, firstPlatformId);
          }
        });
      }
    } else if (payload?.existsInPlatform && entityId && !isNonDefaultPlatform && platformId) {
      // Single platform fallback (no multiResults)
      fetchEntityContainers(entityId, platformId);
    }
  };

  // Handler: Show Container
  const handleShowContainer = async (payload: any) => {
    const pageContent = payload?.pageContent || '';
    const pageHtmlContent = payload?.pageHtmlContent || pageContent;
    const pageUrl = payload?.pageUrl || '';
    const pageTitle = payload?.pageTitle || '';
    const pdfFileName = payload?.pdfFileName || '';
    const isPdfSourcePayload = payload?.isPdfSource || false;
    const containerDescription = payload?.pageDescription || generateDescription(pageContent);
    
    // For PDF source, use the PDF title as container name, not the page title (which is "Filigran XTM - PDF scanner")
    const containerName = isPdfSourcePayload && pageTitle ? pageTitle : pageTitle;
    
    setContainerForm({ name: containerName, description: containerDescription, content: cleanHtmlContent(pageHtmlContent) });
    setEntitiesToAdd(payload?.entities || []);
    setCurrentPageUrl(pageUrl);
    setCurrentPageTitle(pageTitle);
    setCurrentPdfFileName(pdfFileName);
    setIsPdfSource(isPdfSourcePayload);
    setContainerWorkflowOrigin('direct');
    setExistingContainers([]);
    
    const goToNextStep = () => {
      const platforms = openctiPlatformsRef.current;
      if (platforms.length > 1) {
        setPanelMode('platform-select');
      } else {
        if (platforms.length === 1) {
          setSelectedPlatformId(platforms[0].id);
          setPlatformUrl(platforms[0].url);
        }
        setPanelMode('container-type');
      }
    };
    
    if (pageUrl && typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      setCheckingExisting(true);
      setPanelMode('loading');
      
      chrome.runtime.sendMessage({ type: 'FIND_CONTAINERS_BY_URL', payload: { url: pageUrl } }, (response) => {
        setCheckingExisting(false);
        if (chrome.runtime.lastError) { goToNextStep(); return; }
        if (response?.success && response.data?.length > 0) {
          setExistingContainers(response.data);
          setPanelMode('existing-containers');
        } else {
          goToNextStep();
        }
      });
    } else {
      goToNextStep();
    }
  };

  // Handler: Show Investigation
  const handleShowInvestigation = () => {
    setInvestigationEntities([]);
    setInvestigationTypeFilter('all');
    const platforms = openctiPlatformsRef.current;
    if (platforms.length <= 1) {
      const singlePlatformId = platforms[0]?.id || null;
      setInvestigationPlatformSelected(true);
      setInvestigationPlatformId(singlePlatformId);
      setInvestigationScanning(true);
      setPanelMode('investigation');
      setTimeout(() => handleInvestigationScan(singlePlatformId || undefined), 100);
    } else {
      setInvestigationPlatformSelected(false);
      setInvestigationPlatformId(null);
      setInvestigationScanning(false);
      setPanelMode('investigation');
    }
  };

  // Handler: Show Atomic Testing
  const handleShowAtomicTesting = (payload: any) => {
    clearEntityState();
    setEntityContainers([]);
    if (payload?.theme && (payload.theme === 'dark' || payload.theme === 'light')) setMode(payload.theme);
    
    setAtomicTestingTargets(payload?.targets || []);
    setSelectedAtomicTarget(null);
    setAtomicTestingPlatformSelected(false);
    setAtomicTestingPlatformId(null);
    setAtomicTestingAssets([]);
    setAtomicTestingAssetGroups([]);
    setAtomicTestingInjectorContracts([]);
    setAtomicTestingSelectedAsset(null);
    setAtomicTestingSelectedAssetGroup(null);
    setAtomicTestingSelectedContract(null);
    setAtomicTestingTitle('');
    setAtomicTestingShowList(true);
    setAtomicTestingTypeFilter('all');
    setPanelMode('atomic-testing');
  };

  // Handler: Investigation Results
  const handleInvestigationResults = (payload: any) => {
    clearEntityState();
    setEntityContainers([]);
    const entities = payload?.entities || [];
    
    // Deduplicate entities by type + name/value combination
    const seenEntities = new Map<string, any>();
    for (const e of entities) {
      const type = e.type || e.entity_type;
      const name = e.name || e.value || '';
      const dedupeKey = `${type}:${name.toLowerCase()}`;
      
      if (!seenEntities.has(dedupeKey)) {
        seenEntities.set(dedupeKey, {
          id: e.entityId || e.id,
          type,
          name,
          value: e.value,
          platformId: e.platformId,
          selected: false,
        });
      }
    }
    
    setInvestigationEntities(Array.from(seenEntities.values()));
    setInvestigationScanning(false);
    setInvestigationTypeFilter('all');
  };

  // Handler: Scan Results
  const handleScanResults = (payload: any) => {
    clearEntityState();
    setEntityContainers([]);
    setEntityFromSearchMode(null);
    
    const { entities, pageContent, pageTitle, pageUrl } = processScanResults(payload || {});
    setScanResultsEntities(entities);
    setScanResultsTypeFilter('all');
    setScanResultsFoundFilter('all');
    if (pageContent) setScanPageContent(pageContent);
    if (pageTitle) setCurrentPageTitle(pageTitle);
    if (pageUrl) setCurrentPageUrl(pageUrl);
    setEntityFromScanResults(false);
    setPanelMode('scan-results');
  };

  // Handler: Scan Results with initial filter (e.g., from clicking AI highlight)
  const handleScanResultsWithFilter = (payload: any) => {
    const { initialFilter, ...rest } = payload || {};
    
    // If we already have scan results loaded and just need to change filter
    if (scanResultsEntities.length > 0 && panelMode === 'scan-results') {
      // Just update the filter
      if (initialFilter === 'ai-discovered' || initialFilter === 'found' || initialFilter === 'not-found') {
        setScanResultsFoundFilter(initialFilter);
      }
    } else {
      // Full reload of scan results
      clearEntityState();
      setEntityContainers([]);
      setEntityFromSearchMode(null);
      
      const { entities, pageContent, pageTitle, pageUrl } = processScanResults(rest || {});
      setScanResultsEntities(entities);
      setScanResultsTypeFilter('all');
      // Apply initial filter
      if (initialFilter === 'ai-discovered' || initialFilter === 'found' || initialFilter === 'not-found') {
        setScanResultsFoundFilter(initialFilter);
      } else {
        setScanResultsFoundFilter('all');
      }
      if (pageContent) setScanPageContent(pageContent);
      if (pageTitle) setCurrentPageTitle(pageTitle);
      if (pageUrl) setCurrentPageUrl(pageUrl);
      setEntityFromScanResults(false);
      setPanelMode('scan-results');
    }
  };

  // Handler: Investigation Toggle
  const handleInvestigationToggle = (payload: any) => {
    const { entityId, selected } = payload || {};
    if (entityId) {
      setInvestigationEntities(prev => prev.map(e => e.id === entityId ? { ...e, selected } : e));
    }
  };

  // Handler: Show Unified Search
  const handleShowUnifiedSearch = (payload: any) => {
    const initialQuery = payload?.initialQuery || '';
    setUnifiedSearchQuery(initialQuery);
    setUnifiedSearchResults([]);
    setPanelMode('unified-search');
    if (initialQuery.trim()) {
      setTimeout(() => doUnifiedSearch(initialQuery), 100);
    }
  };

  // Handler: Show Scenario
  const handleShowScenario = async (payload: any) => {
    const { attackPatterns, pageTitle, pageUrl, pageDescription, theme: themeFromPayload } = payload || {};
    if (themeFromPayload && (themeFromPayload === 'dark' || themeFromPayload === 'light')) setMode(themeFromPayload);
    
    setCurrentPageUrl(pageUrl || '');
    setCurrentPageTitle(pageTitle || '');
    setScenarioForm({
      name: pageTitle || 'New Scenario',
      description: pageDescription || '',
      subtitle: '',
      category: SCENARIO_DEFAULT_VALUES.category,
      mainFocus: SCENARIO_DEFAULT_VALUES.mainFocus,
      severity: SCENARIO_DEFAULT_VALUES.severity,
    });
    setSelectedInjects([]);
    setScenarioStep(0);
    setScenarioTypeAffinity('ENDPOINT');
    setScenarioPlatformsAffinity(['windows', 'linux', 'macos']);
    setScenarioOverviewData(null);
    setScenarioAIMode(false);
    setScenarioAIGenerating(false);
    setScenarioAINumberOfInjects(5);
    setScenarioAIPayloadAffinity('powershell');
    setScenarioAITableTopDuration(60);
    setScenarioAIEmailLanguage('english');
    setScenarioAIContext('');
    setScenarioAIGeneratedScenario(null);
    setScenarioRawAttackPatterns(attackPatterns || []);
    
    let currentPlatforms = availablePlatformsRef.current;
    if (currentPlatforms.length === 0 && typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      try {
        const settingsResponse = await new Promise<any>((resolve) => {
          chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, resolve);
        });
        if (settingsResponse?.success && settingsResponse.data) {
          const platforms: PlatformConfig[] = settingsResponse.data?.openctiPlatforms || [];
          const enabledPlatforms = platforms
            .filter((p) => p.enabled !== false && p.url && p.apiToken)
            .map((p) => ({ id: p.id, name: p.name || 'OpenCTI', url: p.url, type: 'opencti' as const, isEnterprise: p.isEnterprise }));
          const oaevPlatformsFromSettings: PlatformConfig[] = settingsResponse.data?.openaevPlatforms || [];
          const enabledOAEVPlatforms = oaevPlatformsFromSettings
            .filter((p) => p.enabled !== false && p.url && p.apiToken)
            .map((p) => ({ id: p.id, name: p.name || 'OpenAEV', url: p.url, type: 'openaev' as const, isEnterprise: p.isEnterprise }));
          currentPlatforms = [...enabledPlatforms, ...enabledOAEVPlatforms];
          setAvailablePlatforms(currentPlatforms);
          availablePlatformsRef.current = currentPlatforms;
        }
      } catch (error) {
        log.warn('Failed to fetch platforms:', error);
      }
    }
    
    const oaevPlatformsList = currentPlatforms.filter(p => p.type === 'openaev');
    if (oaevPlatformsList.length > 1) {
      setScenarioPlatformSelected(false);
      setScenarioPlatformId(null);
      setScenarioLoading(false);
      setPanelMode('scenario-overview');
    } else if (oaevPlatformsList.length === 1) {
      const singlePlatformId = oaevPlatformsList[0].id;
      setScenarioPlatformSelected(true);
      setScenarioPlatformId(singlePlatformId);
      setSelectedPlatformId(singlePlatformId);
      setPlatformUrl(oaevPlatformsList[0].url);
      
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        Promise.all([
          chrome.runtime.sendMessage({ type: 'FETCH_OAEV_ASSETS', payload: { platformId: singlePlatformId } }),
          chrome.runtime.sendMessage({ type: 'FETCH_OAEV_ASSET_GROUPS', payload: { platformId: singlePlatformId } }),
          chrome.runtime.sendMessage({ type: 'FETCH_OAEV_TEAMS', payload: { platformId: singlePlatformId } }),
        ]).then(([assetsRes, assetGroupsRes, teamsRes]) => {
          if (assetsRes?.success) setScenarioAssets(assetsRes.data || []);
          if (assetGroupsRes?.success) setScenarioAssetGroups(assetGroupsRes.data || []);
          if (teamsRes?.success) setScenarioTeams(teamsRes.data || []);
        }).catch((error) => log.error('Failed to fetch scenario targets:', error));
      }
      
      setScenarioSelectedAsset(null);
      setScenarioSelectedAssetGroup(null);
      setScenarioSelectedTeam(null);
      
      const filteredPatterns = (attackPatterns || []).filter((ap: any) => !ap.platformId || ap.platformId === singlePlatformId);
      if (filteredPatterns.length > 0 && typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        setScenarioLoading(true);
        setPanelMode('scenario-overview');
        const attackPatternIds = filteredPatterns.map((ap: any) => ap.id || ap.entityId);
        chrome.runtime.sendMessage({
          type: 'FETCH_SCENARIO_OVERVIEW',
          payload: { attackPatternIds, platformId: singlePlatformId },
        }, (response) => {
          setScenarioLoading(false);
          if (response?.success && response.data) {
            setScenarioOverviewData({ ...response.data, pageTitle: pageTitle || '', pageUrl: pageUrl || '', pageDescription: pageDescription || '' });
            setSelectedInjects([]);
          }
        });
      } else {
        setScenarioOverviewData({ attackPatterns: [], killChainPhases: [], pageTitle: pageTitle || '', pageUrl: pageUrl || '', pageDescription: pageDescription || '' });
        setScenarioLoading(false);
        setPanelMode('scenario-overview');
      }
    } else {
      setScenarioPlatformSelected(false);
      setScenarioPlatformId(null);
      const rawPatternsForDisplay = (attackPatterns || []).map((ap: any) => ({
        id: ap.id || ap.entityId, name: ap.name, externalId: ap.externalId, description: ap.description,
        killChainPhases: ap.killChainPhases || [], contracts: [],
      }));
      setScenarioOverviewData({ attackPatterns: rawPatternsForDisplay, killChainPhases: [], pageTitle: pageTitle || '', pageUrl: pageUrl || '', pageDescription: pageDescription || '' });
      setScenarioLoading(false);
      setPanelMode('scenario-overview');
    }
  };

  // Action handlers
  const handleClose = () => {
    // Always navigate to home (same behavior as "Back to actions")
    setPanelMode('empty');
  };
  const handleOpenInPlatform = (entityId: string, draftId?: string) => {
    if (platformUrl && entityId) {
      const url = draftId ? `${platformUrl}/dashboard/data/import/draft/${draftId}` : `${platformUrl}/dashboard/id/${entityId}`;
      window.open(url, '_blank');
    }
  };
  const handleCopyValue = (value: string) => window.parent.postMessage({ type: 'XTM_COPY_TO_CLIPBOARD', payload: value }, '*');

  // handleAddEntities, handleGenerateAIDescription, and handleCreateContainer are provided by useContainerActions hook

  const handleAddSelection = async () => {
    if (!addSelectionText || !addSelectionEntityType) return;
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;

    setAddingSelection(true);
    try {
      const platformId = openctiPlatforms[0]?.id;
      if (!platformId) { setAddingSelection(false); return; }

      const response = await chrome.runtime.sendMessage({
        type: 'CREATE_ENTITY',
        payload: { type: addSelectionEntityType, value: addSelectionText.trim(), name: addSelectionText.trim(), platformId },
      });

      if (response?.success && response.data) {
        setEntity({ ...response.data, existsInPlatform: true, platformType: 'opencti' });
        setPlatformUrl(openctiPlatforms[0]?.url || '');
        setSelectedPlatformId(platformId);
        setPanelMode('entity');
        setAddSelectionText('');
        setAddSelectionEntityType('');
        setAddSelectionFromContextMenu(false);
        showToast({ type: 'success', message: 'Entity created successfully' });
      } else {
        showToast({ type: 'error', message: response?.error || 'Failed to create entity' });
      }
    } catch {
      showToast({ type: 'error', message: 'Error creating entity' });
    }
    setAddingSelection(false);
  };

  // Handler to add selected text to scan results as a new "not found" entity
  const handleAddToScanResults = () => {
    if (!addToScanResultsText || !addToScanResultsEntityType) return;

    const trimmedValue = addToScanResultsText.trim().toLowerCase();
    
    // Check for duplicate: same type and same value (case-insensitive)
    const isDuplicate = scanResultsEntitiesRef.current.some(entity => 
      entity.type === addToScanResultsEntityType && 
      (entity.name?.toLowerCase() === trimmedValue || entity.value?.toLowerCase() === trimmedValue)
    );

    if (isDuplicate) {
      showToast({ type: 'warning', message: 'This entity already exists in scan results' });
      return;
    }

    // Create a proper ScanResultEntity with required fields
    const newEntity = {
      id: `manual-${Date.now()}`,
      type: addToScanResultsEntityType,
      name: addToScanResultsText.trim(),
      value: addToScanResultsText.trim(),
      found: false,
      matchedValue: addToScanResultsText.trim(),
      platformType: 'opencti' as const,
      platformMatches: [],
    };

    // Add to scan results
    const updatedEntities = [...scanResultsEntitiesRef.current, newEntity];
    setScanResultsEntities(updatedEntities);
    scanResultsEntitiesRef.current = updatedEntities;

    // Clear state
    setAddToScanResultsText('');
    setAddToScanResultsEntityType('');

    showToast({ type: 'success', message: 'Entity added to scan results' });
  };

  // Investigation handlers provided by useInvestigationActions hook
  // Set up the ref for handleInvestigationScan so the hook can call it
  React.useEffect(() => {
    handleInvestigationScanRef.current = handleInvestigationScan;
  }, [handleInvestigationScan]);

  const containerSteps = openctiPlatforms.length > 1 ? ['Select Platform', 'Select Type', 'Configure Details'] : ['Select Type', 'Configure Details'];
  const logoSuffix = mode === 'dark' ? 'dark-theme' : 'light-theme';

  const renderHeader = () => (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <img src={`../assets/logos/logo_filigran_${logoSuffix}_embleme_square.svg`} alt="XTM" width={28} height={28} />
        <Typography variant="h5" sx={{ fontWeight: 600, fontSize: 20, color: mode === 'dark' ? '#ffffff' : '#1a1a2e' }}>Filigran Threat Management</Typography>
      </Box>
      {/* Hide close button in split screen mode - browser handles panel closing */}
      {!isSplitScreenMode && (
        <IconButton size="small" onClick={handleClose} sx={{ color: mode === 'dark' ? '#ffffff' : 'text.primary' }}><CloseOutlined fontSize="small" /></IconButton>
      )}
    </Box>
  );

  const renderContent = () => {
    switch (panelMode) {
      case 'entity': {
        const entityType = (entity as any)?.type || '';
        const isNonDefaultPlatformEntity = (entity as any)?.isNonDefaultPlatform || (entity as any)?.platformType !== 'opencti' || parsePrefixedType(entityType) !== null;
        
        if (isNonDefaultPlatformEntity) {
          return <OAEVEntityView mode={mode} entity={entity} setEntity={setEntity} entityDetailsLoading={entityDetailsLoading} setEntityDetailsLoading={setEntityDetailsLoading} availablePlatforms={availablePlatforms} multiPlatformResults={multiPlatformResults} setMultiPlatformResults={setMultiPlatformResults} currentPlatformIndex={currentPlatformIndex} setCurrentPlatformIndex={setCurrentPlatformIndex} currentPlatformIndexRef={currentPlatformIndexRef} multiPlatformResultsRef={multiPlatformResultsRef} setPlatformUrl={setPlatformUrl} setSelectedPlatformId={setSelectedPlatformId} entityFromSearchMode={entityFromSearchMode} setEntityFromSearchMode={setEntityFromSearchMode} entityFromScanResults={entityFromScanResults} setEntityFromScanResults={setEntityFromScanResults} setPanelMode={setPanelMode} handleCopyValue={handleCopyValue} />;
        }
        return <OCTIEntityView mode={mode} entity={entity} setEntity={setEntity} entityContainers={entityContainers} loadingContainers={loadingContainers} entityDetailsLoading={entityDetailsLoading} setEntityDetailsLoading={setEntityDetailsLoading} availablePlatforms={availablePlatforms} multiPlatformResults={multiPlatformResults} setMultiPlatformResults={setMultiPlatformResults} currentPlatformIndex={currentPlatformIndex} setCurrentPlatformIndex={setCurrentPlatformIndex} currentPlatformIndexRef={currentPlatformIndexRef} multiPlatformResultsRef={multiPlatformResultsRef} platformUrl={platformUrl} setPlatformUrl={setPlatformUrl} selectedPlatformId={selectedPlatformId} setSelectedPlatformId={setSelectedPlatformId} entityFromSearchMode={entityFromSearchMode} setEntityFromSearchMode={setEntityFromSearchMode} entityFromScanResults={entityFromScanResults} setEntityFromScanResults={setEntityFromScanResults} setPanelMode={setPanelMode} handleCopyValue={handleCopyValue} handleOpenInPlatform={handleOpenInPlatform} />;
      }
      case 'not-found': return <CommonNotFoundView entity={entity} mode={mode} entityFromScanResults={entityFromScanResults} setEntityFromScanResults={setEntityFromScanResults} setPanelMode={setPanelMode} setEntitiesToAdd={setEntitiesToAdd} setAddFromNotFound={setAddFromNotFound} />;
      case 'add': return <OCTIAddView setPanelMode={setPanelMode} entitiesToAdd={entitiesToAdd} handleAddEntities={handleAddEntities} submitting={submitting} addFromNotFound={addFromNotFound} setAddFromNotFound={setAddFromNotFound} hasScanResults={scanResultsEntitiesRef.current.length > 0} />;
      case 'import-results': return <OCTIImportResultsView mode={mode} importResults={importResults} setImportResults={setImportResults} setPanelMode={setPanelMode} logoSuffix={logoSuffix} />;
      case 'preview': return <CommonPreviewView mode={mode} setPanelMode={setPanelMode} entitiesToAdd={entitiesToAdd} setEntitiesToAdd={setEntitiesToAdd} setSelectedScanItems={setSelectedScanItems} createIndicators={createIndicators} setCreateIndicators={setCreateIndicators} resolvedRelationships={resolvedRelationships} setResolvedRelationships={setResolvedRelationships} aiSettings={aiSettings} aiResolvingRelationships={aiResolvingRelationships} setAiResolvingRelationships={setAiResolvingRelationships} availablePlatforms={availablePlatforms} openctiPlatforms={openctiPlatforms} selectedPlatformId={selectedPlatformId} setSelectedPlatformId={setSelectedPlatformId} setPlatformUrl={setPlatformUrl} setContainerWorkflowOrigin={setContainerWorkflowOrigin} setExistingContainers={setExistingContainers} setCheckingExisting={setCheckingExisting} currentPageUrl={currentPageUrl} currentPageTitle={currentPageTitle} scanPageContent={scanPageContent} showToast={showToast} handleAddEntities={handleAddEntities} submitting={submitting} />;
      case 'platform-select': return <CommonPlatformSelectView mode={mode} setPanelMode={setPanelMode} openctiPlatforms={openctiPlatforms} selectedPlatformId={selectedPlatformId} setSelectedPlatformId={setSelectedPlatformId} setPlatformUrl={setPlatformUrl} containerWorkflowOrigin={containerWorkflowOrigin} setContainerWorkflowOrigin={setContainerWorkflowOrigin} containerSteps={containerSteps} entitiesToAdd={entitiesToAdd} handleAddEntities={handleAddEntities} logoSuffix={logoSuffix} />;
      case 'existing-containers': return <OCTIExistingContainersView mode={mode} existingContainers={existingContainers} selectedPlatformId={selectedPlatformId} setSelectedPlatformId={setSelectedPlatformId} availablePlatforms={availablePlatforms} openctiPlatforms={openctiPlatforms} setPlatformUrl={setPlatformUrl} setPanelMode={setPanelMode} setEntity={setEntity} setMultiPlatformResults={setMultiPlatformResults} setCurrentPlatformIndex={setCurrentPlatformIndex} setEntityContainers={setEntityContainers} fetchEntityContainers={fetchEntityContainers} setUpdatingContainerId={setUpdatingContainerId} setOCTIContainerType={setOCTIContainerType} setContainerForm={setContainerForm} setSelectedLabels={setSelectedLabels} setSelectedMarkings={setSelectedMarkings} containerSpecificFields={containerSpecificFields} setContainerSpecificFields={setContainerSpecificFields} setUpdatingContainerDates={setUpdatingContainerDates} loadLabelsAndMarkings={loadLabelsAndMarkings} formatDate={formatDate} />;
      case 'container-type': return <OCTIContainerTypeView mode={mode} setPanelMode={setPanelMode} setOCTIContainerType={setOCTIContainerType} containerWorkflowOrigin={containerWorkflowOrigin} openctiPlatformsCount={openctiPlatforms.length} containerSteps={containerSteps} entitiesToAdd={entitiesToAdd} />;
      case 'container-form': return <OCTIContainerFormView mode={mode} setPanelMode={setPanelMode} containerType={containerType} containerSteps={containerSteps} containerForm={containerForm} setContainerForm={setContainerForm} containerSpecificFields={containerSpecificFields} setContainerSpecificFields={setContainerSpecificFields} updatingContainerId={updatingContainerId} availablePlatforms={availablePlatforms} openctiPlatforms={openctiPlatforms} selectedPlatformId={selectedPlatformId} aiSettings={aiSettings} aiGeneratingDescription={aiGeneratingDescription} handleGenerateAIDescription={handleGenerateAIDescription} availableLabels={availableLabels} selectedLabels={selectedLabels} setSelectedLabels={setSelectedLabels} availableMarkings={availableMarkings} selectedMarkings={selectedMarkings} setSelectedMarkings={setSelectedMarkings} availableReportTypes={availableReportTypes} availableContexts={availableContexts} availableSeverities={availableSeverities} availablePriorities={availablePriorities} availableResponseTypes={availableResponseTypes} availableAuthors={availableAuthors} attachPdf={attachPdf} setAttachPdf={setAttachPdf} createAsDraft={createAsDraft} setCreateAsDraft={setCreateAsDraft} entitiesToAdd={entitiesToAdd} handleCreateContainer={handleCreateContainer} submitting={submitting} generatingPdf={generatingPdf} isPdfSource={isPdfSource} />;
      case 'investigation': return <OCTIInvestigationView mode={mode} openctiPlatforms={openctiPlatforms} availablePlatforms={availablePlatforms} investigationPlatformId={investigationPlatformId} investigationPlatformSelected={investigationPlatformSelected} setInvestigationPlatformSelected={setInvestigationPlatformSelected} investigationEntities={investigationEntities} setInvestigationEntities={setInvestigationEntities} investigationScanning={investigationScanning} investigationTypeFilter={investigationTypeFilter} setInvestigationTypeFilter={setInvestigationTypeFilter} investigationSearchQuery={investigationSearchQuery} setInvestigationSearchQuery={setInvestigationSearchQuery} investigationEntityTypes={investigationEntityTypes} filteredInvestigationEntities={filteredInvestigationEntities} selectedInvestigationCount={selectedInvestigationCount} submitting={submitting} resetInvestigation={resetInvestigation} handleSelectInvestigationPlatform={handleSelectInvestigationPlatform} handleInvestigationScan={handleInvestigationScan} toggleInvestigationEntity={toggleInvestigationEntity} selectAllInvestigationEntities={selectAllInvestigationEntities} clearInvestigationSelection={clearInvestigationSelection} handleCreateWorkbench={handleCreateWorkbench} />;
      case 'scan-results': return <CommonScanResultsView mode={mode} handleClose={handleClose} scanResultsEntities={scanResultsEntities} setScanResultsEntities={setScanResultsEntities} scanResultsEntitiesRef={scanResultsEntitiesRef} scanResultsTypeFilter={scanResultsTypeFilter} setScanResultsTypeFilter={setScanResultsTypeFilter} scanResultsFoundFilter={scanResultsFoundFilter} setScanResultsFoundFilter={setScanResultsFoundFilter} selectedScanItems={selectedScanItems} setSelectedScanItems={setSelectedScanItems} setPanelMode={setPanelMode} setEntitiesToAdd={setEntitiesToAdd} setEntity={setEntity} setMultiPlatformResults={setMultiPlatformResults} setCurrentPlatformIndex={setCurrentPlatformIndex} setEntityFromScanResults={setEntityFromScanResults} currentPlatformIndexRef={currentPlatformIndexRef} multiPlatformResultsRef={multiPlatformResultsRef} aiSettings={aiSettings} aiDiscoveringEntities={aiDiscoveringEntities} setAiDiscoveringEntities={setAiDiscoveringEntities} aiResolvingRelationships={aiResolvingRelationships} setAiResolvingRelationships={setAiResolvingRelationships} resolvedRelationships={resolvedRelationships} setResolvedRelationships={setResolvedRelationships} availablePlatforms={availablePlatforms} openctiPlatforms={openctiPlatforms} openaevPlatforms={openaevPlatforms} selectedPlatformId={selectedPlatformId} setSelectedPlatformId={setSelectedPlatformId} platformUrl={platformUrl} setPlatformUrl={setPlatformUrl} showToast={showToast} setContainerForm={setContainerForm} currentPageTitle={currentPageTitle} currentPageUrl={currentPageUrl} setCurrentPageUrl={setCurrentPageUrl} setCurrentPageTitle={setCurrentPageTitle} setCurrentPdfFileName={setCurrentPdfFileName} setIsPdfSource={setIsPdfSource} scanPageContent={scanPageContent} logoSuffix={logoSuffix} setEntityDetailsLoading={setEntityDetailsLoading} fetchEntityContainers={fetchEntityContainers} isPdfView={isPdfView} />;
      case 'atomic-testing': return <OAEVAtomicTestingView mode={mode} availablePlatforms={availablePlatforms} aiSettings={aiSettings} setPanelMode={setPanelMode} showToast={showToast} atomicTestingTargets={atomicTestingTargets} setAtomicTestingTargets={setAtomicTestingTargets} selectedAtomicTarget={selectedAtomicTarget} setSelectedAtomicTarget={setSelectedAtomicTarget} atomicTestingShowList={atomicTestingShowList} setAtomicTestingShowList={setAtomicTestingShowList} atomicTestingPlatformId={atomicTestingPlatformId} setAtomicTestingPlatformId={setAtomicTestingPlatformId} atomicTestingPlatformSelected={atomicTestingPlatformSelected} setAtomicTestingPlatformSelected={setAtomicTestingPlatformSelected} atomicTestingTargetType={atomicTestingTargetType} setAtomicTestingTargetType={setAtomicTestingTargetType} atomicTestingAssets={atomicTestingAssets} setAtomicTestingAssets={setAtomicTestingAssets} atomicTestingAssetGroups={atomicTestingAssetGroups} setAtomicTestingAssetGroups={setAtomicTestingAssetGroups} atomicTestingTypeFilter={atomicTestingTypeFilter} setAtomicTestingTypeFilter={setAtomicTestingTypeFilter} atomicTestingInjectorContracts={atomicTestingInjectorContracts} setAtomicTestingInjectorContracts={setAtomicTestingInjectorContracts} atomicTestingSelectedAsset={atomicTestingSelectedAsset} setAtomicTestingSelectedAsset={setAtomicTestingSelectedAsset} atomicTestingSelectedAssetGroup={atomicTestingSelectedAssetGroup} setAtomicTestingSelectedAssetGroup={setAtomicTestingSelectedAssetGroup} atomicTestingSelectedContract={atomicTestingSelectedContract} setAtomicTestingSelectedContract={setAtomicTestingSelectedContract} atomicTestingTitle={atomicTestingTitle} setAtomicTestingTitle={setAtomicTestingTitle} atomicTestingCreating={atomicTestingCreating} setAtomicTestingCreating={setAtomicTestingCreating} atomicTestingLoadingAssets={atomicTestingLoadingAssets} setAtomicTestingLoadingAssets={setAtomicTestingLoadingAssets} atomicTestingAIMode={atomicTestingAIMode} setAtomicTestingAIMode={setAtomicTestingAIMode} atomicTestingAIGenerating={atomicTestingAIGenerating} setAtomicTestingAIGenerating={setAtomicTestingAIGenerating} atomicTestingAIPlatform={atomicTestingAIPlatform} setAtomicTestingAIPlatform={setAtomicTestingAIPlatform} atomicTestingAIExecutor={atomicTestingAIExecutor} setAtomicTestingAIExecutor={setAtomicTestingAIExecutor} atomicTestingAIContext={atomicTestingAIContext} setAtomicTestingAIContext={setAtomicTestingAIContext} atomicTestingAIGeneratedPayload={atomicTestingAIGeneratedPayload} setAtomicTestingAIGeneratedPayload={setAtomicTestingAIGeneratedPayload} resetAtomicTestingState={resetAtomicTestingState} />;
      case 'unified-search': return <CommonUnifiedSearchView mode={mode} unifiedSearchQuery={unifiedSearchQuery} setUnifiedSearchQuery={setUnifiedSearchQuery} unifiedSearchResults={unifiedSearchResults} setUnifiedSearchResults={setUnifiedSearchResults} unifiedSearching={unifiedSearching} setUnifiedSearching={setUnifiedSearching} unifiedSearchPlatformFilter={unifiedSearchPlatformFilter} setUnifiedSearchPlatformFilter={setUnifiedSearchPlatformFilter} unifiedSearchTypeFilter={unifiedSearchTypeFilter} setUnifiedSearchTypeFilter={setUnifiedSearchTypeFilter} setPanelMode={setPanelMode} setEntity={setEntity} setEntityFromSearchMode={setEntityFromSearchMode} setMultiPlatformResults={setMultiPlatformResults} setCurrentPlatformIndex={setCurrentPlatformIndex} currentPlatformIndexRef={currentPlatformIndexRef} multiPlatformResultsRef={multiPlatformResultsRef} availablePlatforms={availablePlatforms} logoSuffix={logoSuffix} entityDetailsLoading={entityDetailsLoading} setEntityDetailsLoading={setEntityDetailsLoading} fetchEntityContainers={fetchEntityContainers} />;
      case 'add-selection': return <OCTIAddSelectionView setPanelMode={setPanelMode} addSelectionText={addSelectionText} setAddSelectionText={setAddSelectionText} addSelectionEntityType={addSelectionEntityType} setAddSelectionEntityType={setAddSelectionEntityType} addSelectionFromContextMenu={addSelectionFromContextMenu} setAddSelectionFromContextMenu={setAddSelectionFromContextMenu} addingSelection={addingSelection} handleAddSelection={handleAddSelection} openctiPlatforms={openctiPlatforms} hasScanResults={scanResultsEntitiesRef.current.length > 0} />;
      case 'add-to-scan-results': return <AddToScanResultsView setPanelMode={setPanelMode} addToScanResultsText={addToScanResultsText} setAddToScanResultsText={setAddToScanResultsText} addToScanResultsEntityType={addToScanResultsEntityType} setAddToScanResultsEntityType={setAddToScanResultsEntityType} handleAddToScanResults={handleAddToScanResults} hasScanResults={scanResultsEntitiesRef.current.length > 0} />;
      case 'scenario-overview':
      case 'scenario-form': return <OAEVScenarioView mode={mode} panelMode={panelMode as 'scenario-overview' | 'scenario-form'} availablePlatforms={availablePlatforms} selectedPlatformId={selectedPlatformId} setSelectedPlatformId={setSelectedPlatformId} setPlatformUrl={setPlatformUrl} setPanelMode={setPanelMode} showToast={showToast} currentPageTitle={currentPageTitle} currentPageUrl={currentPageUrl} aiSettings={aiSettings} submitting={submitting} setSubmitting={setSubmitting} aiSelectingInjects={aiSelectingInjects} setAiSelectingInjects={setAiSelectingInjects} aiFillingEmails={aiFillingEmails} setAiFillingEmails={setAiFillingEmails} handleClose={handleClose} scenarioOverviewData={scenarioOverviewData} setScenarioOverviewData={setScenarioOverviewData} scenarioForm={scenarioForm} setScenarioForm={setScenarioForm} selectedInjects={selectedInjects} setSelectedInjects={setSelectedInjects} scenarioEmails={scenarioEmails} setScenarioEmails={setScenarioEmails} scenarioLoading={scenarioLoading} setScenarioLoading={setScenarioLoading} scenarioStep={scenarioStep} setScenarioStep={setScenarioStep} scenarioTypeAffinity={scenarioTypeAffinity} setScenarioTypeAffinity={setScenarioTypeAffinity} scenarioPlatformsAffinity={scenarioPlatformsAffinity} setScenarioPlatformsAffinity={setScenarioPlatformsAffinity} scenarioInjectSpacing={scenarioInjectSpacing} setScenarioInjectSpacing={setScenarioInjectSpacing} scenarioPlatformSelected={scenarioPlatformSelected} setScenarioPlatformSelected={setScenarioPlatformSelected} scenarioPlatformId={scenarioPlatformId} setScenarioPlatformId={setScenarioPlatformId} scenarioRawAttackPatterns={scenarioRawAttackPatterns} setScenarioRawAttackPatterns={setScenarioRawAttackPatterns} scenarioTargetType={scenarioTargetType} setScenarioTargetType={setScenarioTargetType} scenarioAssets={scenarioAssets} setScenarioAssets={setScenarioAssets} scenarioAssetGroups={scenarioAssetGroups} setScenarioAssetGroups={setScenarioAssetGroups} scenarioTeams={scenarioTeams} setScenarioTeams={setScenarioTeams} scenarioSelectedAsset={scenarioSelectedAsset} setScenarioSelectedAsset={setScenarioSelectedAsset} scenarioSelectedAssetGroup={scenarioSelectedAssetGroup} setScenarioSelectedAssetGroup={setScenarioSelectedAssetGroup} scenarioSelectedTeam={scenarioSelectedTeam} setScenarioSelectedTeam={setScenarioSelectedTeam} scenarioCreating={scenarioCreating} setScenarioCreating={setScenarioCreating} scenarioAIMode={scenarioAIMode} setScenarioAIMode={setScenarioAIMode} scenarioAIGenerating={scenarioAIGenerating} setScenarioAIGenerating={setScenarioAIGenerating} scenarioAINumberOfInjects={scenarioAINumberOfInjects} setScenarioAINumberOfInjects={setScenarioAINumberOfInjects} scenarioAIPayloadAffinity={scenarioAIPayloadAffinity} setScenarioAIPayloadAffinity={setScenarioAIPayloadAffinity} scenarioAITableTopDuration={scenarioAITableTopDuration} setScenarioAITableTopDuration={setScenarioAITableTopDuration} scenarioAIEmailLanguage={scenarioAIEmailLanguage} setScenarioAIEmailLanguage={setScenarioAIEmailLanguage} scenarioAITheme={scenarioAITheme} setScenarioAITheme={setScenarioAITheme} scenarioAIContext={scenarioAIContext} setScenarioAIContext={setScenarioAIContext} scenarioAIGeneratedScenario={scenarioAIGeneratedScenario} setScenarioAIGeneratedScenario={setScenarioAIGeneratedScenario} resetScenarioState={resetScenarioState} />;
      case 'loading': return <CommonLoadingView />;
      default: return isScanning 
        ? <CommonLoadingView message="Scanning page..." /> 
        : <CommonEmptyView logoSuffix={logoSuffix} hasOpenCTI={openctiPlatforms.length > 0} hasOpenAEV={openaevPlatforms.length > 0} onScan={handleEmptyViewScan} onSearch={handleEmptyViewSearch} onCreateContainer={handleEmptyViewCreateContainer} onInvestigate={handleEmptyViewInvestigate} onAtomicTesting={handleEmptyViewAtomicTesting} onGenerateScenario={handleEmptyViewGenerateScenario} onClearHighlights={handleEmptyViewClearHighlights} isPdfView={isPdfView} />;
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
        {renderHeader()}
        <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>{renderContent()}</Box>
      </Box>
    </ThemeProvider>
  );
};

export default App;
