import React, { useEffect, useState, useMemo } from 'react';
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
import ThemeDark from '../shared/theme/ThemeDark';
import ThemeLight from '../shared/theme/ThemeLight';
import { loggers } from '../shared/utils/logger';
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
import { useEntityState, type MultiPlatformResult } from './hooks/useEntityState';
import { useAddSelectionState } from './hooks/useAddSelectionState';
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
import { OAEVEntityView } from './views/OAEVEntityView';
import { OAEVAtomicTestingView } from './views/OAEVAtomicTestingView';
import { OAEVScenarioView } from './views/OAEVScenarioView';
import { parsePrefixedType } from '../shared/platform/registry';
import { formatDate } from '../shared/utils/formatters';
import { SCENARIO_DEFAULT_VALUES } from '../shared/types/openaev';
import type { PlatformConfig } from '../shared/types/settings';
import { processScanResults } from './handlers/scan-results-handler';
import type {
  PanelMode,
  EntityData,
  PlatformInfo,
} from './types/panel-types';
const log = loggers.panel;

const App: React.FC = () => {
  const [mode, setMode] = useState<'dark' | 'light'>('dark');
  const [panelMode, setPanelMode] = useState<PanelMode>('empty');

  // Platform state
  const [availablePlatforms, setAvailablePlatforms] = useState<PlatformInfo[]>([]);
  const [selectedPlatformId, setSelectedPlatformId] = useState<string>('');
  const [platformUrl, setPlatformUrl] = useState('');
  const availablePlatformsRef = React.useRef<PlatformInfo[]>([]);
  React.useEffect(() => { availablePlatformsRef.current = availablePlatforms; }, [availablePlatforms]);

  const openctiPlatforms = useMemo(() => availablePlatforms.filter(p => p.type === 'opencti'), [availablePlatforms]);
  const openaevPlatforms = useMemo(() => availablePlatforms.filter(p => p.type === 'openaev'), [availablePlatforms]);
  const openctiPlatformsRef = React.useRef<PlatformInfo[]>([]);
  React.useEffect(() => { openctiPlatformsRef.current = openctiPlatforms; }, [openctiPlatforms]);

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
    entityFromScanResults, setEntityFromScanResults,
    getSelectedEntitiesForPreview,
  } = useScanResultsState();

  // Search state hook
  const {
    unifiedSearchQuery, setUnifiedSearchQuery,
    unifiedSearchResults, setUnifiedSearchResults,
    unifiedSearching, setUnifiedSearching,
    unifiedSearchPlatformFilter, setUnifiedSearchPlatformFilter,
    handleUnifiedSearch,
  } = useSearchState();

  // Add selection state hook
  const {
    addSelectionText, setAddSelectionText,
    addSelectionEntityType, setAddSelectionEntityType,
    addingSelection, setAddingSelection,
    addSelectionFromContextMenu, setAddSelectionFromContextMenu,
  } = useAddSelectionState();

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
    investigationPlatformSelected, setInvestigationPlatformSelected,
    investigationPlatformId, setInvestigationPlatformId,
    investigationEntityTypes,
    filteredInvestigationEntities,
    selectedInvestigationCount,
    resetInvestigationState,
  } = useInvestigationState();

  const theme = useMemo(() => {
    const themeOptions = mode === 'dark' ? ThemeDark() : ThemeLight();
    return createTheme(themeOptions);
  }, [mode]);

  // Toast notification helper
  const showToast = React.useCallback((options: {
    type: 'success' | 'info' | 'warning' | 'error';
    message: string;
    action?: { label: string; type: 'scroll_to_first' | 'close_panel' | 'custom' };
    persistent?: boolean;
    duration?: number;
  }) => {
    window.parent.postMessage({ type: 'XTM_SHOW_TOAST', payload: options }, '*');
  }, []);

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
      chrome.runtime.sendMessage({ type: 'FETCH_LABELS', payload: { platformId: targetPlatformId } }, (response) => {
        if (chrome.runtime.lastError) return;
        if (response?.success && response.data) {
          setAvailableLabels(response.data);
          setLabelsLoaded(true);
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
    
    chrome.runtime.sendMessage({ type: 'FETCH_IDENTITIES', payload: { platformId: targetPlatformId } }, (response) => {
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
        payload: { entityId, limit: 10, platformId },
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

  // Handle investigation scan
  const handleInvestigationScan = async (platformId?: string) => {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;
    const targetPlatformId = platformId || investigationPlatformId;
    if (!targetPlatformId && openctiPlatforms.length > 1) return;
    
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
  };

  // Wrapper for unified search that passes platforms
  const doUnifiedSearch = async (queryOverride?: string) => {
    await handleUnifiedSearch(availablePlatforms, queryOverride);
  };

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

    // Get settings and platforms
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response?.success) {
        if (response.data?.theme) {
          setMode(response.data.theme === 'light' ? 'light' : 'dark');
        }
        
        const platforms: PlatformConfig[] = response.data?.openctiPlatforms || [];
        const enabledPlatforms = platforms
          .filter((p) => p.enabled !== false && p.url && p.apiToken)
          .map((p) => ({ id: p.id, name: p.name || 'OpenCTI', url: p.url, type: 'opencti' as const, isEnterprise: p.isEnterprise }));
        
        const oaevPlatforms: PlatformConfig[] = response.data?.openaevPlatforms || [];
        const enabledOAEVPlatforms = oaevPlatforms
          .filter((p) => p.enabled !== false && p.url && p.apiToken)
          .map((p) => ({ id: p.id, name: p.name || 'OpenAEV', url: p.url, type: 'openaev' as const, isEnterprise: p.isEnterprise }));
        
        setAvailablePlatforms([...enabledPlatforms, ...enabledOAEVPlatforms]);
        
        const ai = response.data?.ai;
        const aiAvailable = !!(ai?.provider && ai?.apiKey && ai?.model);
        setAiSettings({ enabled: aiAvailable, provider: ai?.provider, available: aiAvailable });

        // Test connections for EE status
        [...enabledPlatforms, ...enabledOAEVPlatforms].forEach((platform: PlatformInfo) => {
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
        
        if (enabledPlatforms.length > 0) {
          setPlatformUrl(enabledPlatforms[0].url);
          setSelectedPlatformId(enabledPlatforms[0].id);
        } else if (enabledOAEVPlatforms.length > 0) {
          setPlatformUrl(enabledOAEVPlatforms[0].url);
          setSelectedPlatformId(enabledOAEVPlatforms[0].id);
        }
      }
    });

    window.addEventListener('message', handleMessage);
    window.parent.postMessage({ type: 'XTM_PANEL_READY' }, '*');
    
    chrome.runtime.sendMessage({ type: 'GET_PANEL_STATE' }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response?.success && response.data) handlePanelState(response.data);
    });
    
    // Listen for storage changes
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === 'local' && changes.settings) {
        const newSettings = changes.settings.newValue;
        if (newSettings) {
          const enabledOpenCTI = ((newSettings.openctiPlatforms || []) as PlatformConfig[])
            .filter((p) => p.enabled !== false && p.url && p.apiToken)
            .map((p) => ({ id: p.id, name: p.name || 'OpenCTI', url: p.url, type: 'opencti' as const, isEnterprise: p.isEnterprise }));
          
          const enabledOpenAEV = ((newSettings.openaevPlatforms || []) as PlatformConfig[])
            .filter((p) => p.enabled !== false && p.url && p.apiToken)
            .map((p) => ({ id: p.id, name: p.name || 'OpenAEV', url: p.url, type: 'openaev' as const, isEnterprise: p.isEnterprise }));
          
          const allPlatforms = [...enabledOpenCTI, ...enabledOpenAEV];
          setAvailablePlatforms(allPlatforms);
          
          if (allPlatforms.length > 0 && !allPlatforms.find(p => p.id === selectedPlatformId)) {
            setPlatformUrl(allPlatforms[0].url);
            setSelectedPlatformId(allPlatforms[0].id);
          }
          
          const ai = newSettings.ai;
          const aiAvailable = !!(ai?.provider && ai?.apiKey && ai?.model);
          setAiSettings({ enabled: aiAvailable, provider: ai?.provider, available: aiAvailable });
        }
      }
    };
    
    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      window.removeEventListener('message', handleMessage);
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      case 'SHOW_PREVIEW':
      case 'SHOW_PREVIEW_PANEL':
        handleShowPreview(data.payload);
        break;
      case 'SHOW_CREATE_CONTAINER':
      case 'SHOW_CONTAINER_PANEL':
        await handleShowContainer(data.payload);
        break;
      case 'SHOW_INVESTIGATION_PANEL':
        handleShowInvestigation();
        break;
      case 'SHOW_ATOMIC_TESTING_PANEL':
      case 'ATOMIC_TESTING_SCAN_RESULTS':
        handleShowAtomicTesting(data.payload);
        break;
      case 'ATOMIC_TESTING_SELECT':
        handleAtomicTestingSelect(data.payload);
        break;
      case 'INVESTIGATION_SCAN_RESULTS':
        handleInvestigationResults(data.payload);
        break;
      case 'SCAN_RESULTS':
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
    setEntityFromScanResults(scanResultsEntitiesRef.current.length > 0);
    
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
        
        const matchPlatformType = match.platformType || platform?.type || 'opencti';
        const matchType = match.type || match.entityData?.entity_type || payload?.type || entityType || '';
        const cleanType = matchType.replace(/^oaev-/, '');
        const displayType = matchPlatformType === 'openaev' && !matchType.startsWith('oaev-') ? `oaev-${cleanType}` : matchType;
        
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

  // Handler: Show Preview
  const handleShowPreview = (payload: any) => {
    setEntitiesToAdd(payload?.entities || []);
    setCurrentPageUrl(payload?.pageUrl || '');
    setCurrentPageTitle(payload?.pageTitle || '');
    const previewDescription = payload?.pageDescription || generateDescription(payload?.pageContent || '');
    const previewContent = payload?.pageHtmlContent || payload?.pageContent || '';
    setContainerForm({ name: payload?.pageTitle || '', description: previewDescription, content: cleanHtmlContent(previewContent) });
    setPanelMode('preview');
  };

  // Handler: Show Container
  const handleShowContainer = async (payload: any) => {
    const pageContent = payload?.pageContent || '';
    const pageHtmlContent = payload?.pageHtmlContent || pageContent;
    const pageUrl = payload?.pageUrl || '';
    const pageTitle = payload?.pageTitle || '';
    const containerDescription = payload?.pageDescription || generateDescription(pageContent);
    
    setContainerForm({ name: pageTitle, description: containerDescription, content: cleanHtmlContent(pageHtmlContent) });
    setEntitiesToAdd(payload?.entities || []);
    setCurrentPageUrl(pageUrl);
    setCurrentPageTitle(pageTitle);
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

  // Handler: Atomic Testing Select
  const handleAtomicTestingSelect = (payload: any) => {
    setSelectedAtomicTarget(payload);
    setAtomicTestingTitle(`Atomic Test - ${payload?.name || ''}`);
    setAtomicTestingShowList(false);
    setAtomicTestingInjectorContracts([]);
    setAtomicTestingSelectedContract(null);
    
    const entityId = payload?.entityId || payload?.data?.entityId || payload?.data?.attack_pattern_id || payload?.data?.id;
    if (payload?.type === 'attack-pattern' && entityId && atomicTestingPlatformId) {
      chrome.runtime.sendMessage({
        type: 'FETCH_INJECTOR_CONTRACTS',
        payload: { attackPatternId: entityId, platformId: atomicTestingPlatformId },
      }).then((res: any) => {
        if (res?.success) setAtomicTestingInjectorContracts(res.data || []);
      });
    }
  };

  // Handler: Investigation Results
  const handleInvestigationResults = (payload: any) => {
    clearEntityState();
    setEntityContainers([]);
    const entities = payload?.entities || [];
    setInvestigationEntities(entities.map((e: any) => ({
      id: e.entityId || e.id,
      type: e.type || e.entity_type,
      name: e.name || e.value,
      value: e.value,
      platformId: e.platformId || e.platformId,
      selected: false,
    })));
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
  const handleClose = () => window.parent.postMessage({ type: 'XTM_CLOSE_PANEL' }, '*');
  const handleOpenInPlatform = (entityId: string, draftId?: string) => {
    if (platformUrl && entityId) {
      const url = draftId ? `${platformUrl}/dashboard/data/import/draft/${draftId}` : `${platformUrl}/dashboard/id/${entityId}`;
      window.open(url, '_blank');
    }
  };
  const handleCopyValue = (value: string) => window.parent.postMessage({ type: 'XTM_COPY_TO_CLIPBOARD', payload: value }, '*');

  const handleAddEntities = async () => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
    if (openctiPlatforms.length === 0) {
      setImportResults({ success: false, total: entitiesToAdd.length, created: [], failed: entitiesToAdd.map(e => ({ type: e.type || 'unknown', value: e.value || e.name || 'unknown', error: 'No OpenCTI platform configured' })), platformName: 'OpenCTI' });
      setPanelMode('import-results');
      return;
    }
    
    setSubmitting(true);
    const selectedIsOpenCTI = openctiPlatforms.some(p => p.id === selectedPlatformId);
    const targetPlatformId = selectedIsOpenCTI ? selectedPlatformId : openctiPlatforms[0].id;
    const targetPlatform = openctiPlatforms.find(p => p.id === targetPlatformId) || openctiPlatforms[0];
    
    const response = await chrome.runtime.sendMessage({
      type: 'CREATE_OBSERVABLES_BULK',
      payload: { entities: entitiesToAdd, platformId: targetPlatformId, createIndicator: createIndicators },
    });

    if (response?.success && response.data) {
      const createdEntities = response.data as Array<{ id: string; entity_type?: string; observable_value?: string; value?: string; type?: string }>;
      setImportResults({
        success: true, total: entitiesToAdd.length,
        created: createdEntities.map((e, i) => ({ id: e.id, type: e.entity_type || e.type || entitiesToAdd[i]?.type || 'unknown', value: e.observable_value || e.value || entitiesToAdd[i]?.value || entitiesToAdd[i]?.name || 'unknown' })),
        failed: [], platformName: targetPlatform.name,
      });
      setPanelMode('import-results');
      setEntitiesToAdd([]);
    } else {
      setImportResults({ success: false, total: entitiesToAdd.length, created: [], failed: entitiesToAdd.map(e => ({ type: e.type || 'unknown', value: e.value || e.name || 'unknown', error: response?.error || 'Failed to create entity' })), platformName: targetPlatform.name });
      setPanelMode('import-results');
    }
    setSubmitting(false);
  };

  const handleGenerateAIDescription = async () => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
    const selectedIsOpenCTI = openctiPlatforms.some(p => p.id === selectedPlatformId);
    const targetPlatformId = selectedIsOpenCTI ? selectedPlatformId : openctiPlatforms[0]?.id;
    const targetPlatform = availablePlatforms.find(p => p.id === targetPlatformId);
    
    if (!aiSettings.available || !targetPlatform?.isEnterprise) return;
    
    setAiGeneratingDescription(true);
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'AI_GENERATE_DESCRIPTION',
        payload: { pageTitle: currentPageTitle, pageUrl: currentPageUrl, pageContent: containerForm.content || '', containerType, containerName: containerForm.name, detectedEntities: entitiesToAdd.map(e => e.name || e.value).filter(Boolean) },
      });
      if (response?.success && response.data) {
        setContainerForm(prev => ({ ...prev, description: response.data }));
        showToast({ type: 'success', message: 'AI generated description' });
      } else {
        showToast({ type: 'error', message: 'AI description generation failed' });
      }
    } catch {
      showToast({ type: 'error', message: 'AI description generation error' });
    } finally {
      setAiGeneratingDescription(false);
    }
  };

  const handleCreateContainer = async () => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
    setSubmitting(true);
    
    let pdfData: { data: string; filename: string } | null = null;
    if (attachPdf) {
      setGeneratingPdf(true);
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          const pdfResponse = await chrome.tabs.sendMessage(tab.id, { type: 'GENERATE_PDF' });
          if (pdfResponse?.success && pdfResponse.data) pdfData = pdfResponse.data;
        }
      } catch { /* PDF generation failed */ }
      setGeneratingPdf(false);
    }
    
    const existingEntitiesWithIndex = entitiesToAdd.map((e, i) => ({ entity: e, originalIndex: i })).filter(({ entity }) => entity.id);
    const entitiesToCreateWithIndex = entitiesToAdd.map((e, i) => ({ entity: e, originalIndex: i })).filter(({ entity }) => !entity.id && (entity.value || entity.observable_value));
    const existingEntityIds = existingEntitiesWithIndex.map(({ entity }) => entity.id as string);
    const entitiesToCreate = entitiesToCreateWithIndex.map(({ entity }) => ({ type: entity.type || entity.entity_type || 'Unknown', value: entity.value || entity.observable_value || entity.name || '' }));
    
    const indexMapping: Record<number, number> = {};
    existingEntitiesWithIndex.forEach(({ originalIndex }, idx) => { indexMapping[originalIndex] = idx; });
    entitiesToCreateWithIndex.forEach(({ originalIndex }, idx) => { indexMapping[originalIndex] = existingEntityIds.length + idx; });
    
    const relationshipsToCreate = resolvedRelationships.map(rel => ({
      fromEntityIndex: indexMapping[rel.fromIndex] ?? -1,
      toEntityIndex: indexMapping[rel.toIndex] ?? -1,
      relationship_type: rel.relationshipType,
      description: rel.reason,
    })).filter(rel => rel.fromEntityIndex >= 0 && rel.toEntityIndex >= 0);
    
    const response = await chrome.runtime.sendMessage({
      type: 'CREATE_CONTAINER',
      payload: {
        type: containerType, name: containerForm.name, description: containerForm.description, content: containerForm.content,
        labels: selectedLabels.map(l => l.id), markings: selectedMarkings.map(m => m.id),
        entities: existingEntityIds, entitiesToCreate, platformId: selectedPlatformId || undefined, pdfAttachment: pdfData,
        pageUrl: currentPageUrl, pageTitle: currentPageTitle,
        report_types: containerSpecificFields.report_types.length > 0 ? containerSpecificFields.report_types : undefined,
        context: containerSpecificFields.context || undefined, severity: containerSpecificFields.severity || undefined,
        priority: containerSpecificFields.priority || undefined,
        response_types: containerSpecificFields.response_types.length > 0 ? containerSpecificFields.response_types : undefined,
        createdBy: containerSpecificFields.createdBy || undefined, createAsDraft,
        relationshipsToCreate: relationshipsToCreate.length > 0 ? relationshipsToCreate : undefined,
        updateContainerId: updatingContainerId || undefined,
        published: updatingContainerId && containerType === 'Report' ? updatingContainerDates?.published : undefined,
        created: updatingContainerId && containerType !== 'Report' ? updatingContainerDates?.created : undefined,
      },
    });

    if (response?.success && response.data) {
      const createdContainer = response.data;
      const createdPlatformId = createdContainer.platformId || selectedPlatformId;
      if (createdPlatformId) {
        const platform = availablePlatforms.find(p => p.id === createdPlatformId);
        if (platform) { setPlatformUrl(platform.url); setSelectedPlatformId(platform.id); }
      }
      setEntity({
        id: createdContainer.id, entity_type: createdContainer.entity_type || containerType, type: createdContainer.entity_type || containerType,
        name: createdContainer.name || containerForm.name, description: createdContainer.description || containerForm.description,
        created: createdContainer.created, modified: createdContainer.modified, createdBy: createdContainer.createdBy,
        objectLabel: createdContainer.objectLabel, objectMarking: createdContainer.objectMarking, existsInPlatform: true,
        platformId: createdPlatformId, platformType: 'opencti', isNonDefaultPlatform: false, _draftId: createdContainer.draftId,
      });
      setEntityContainers([]);
      setPanelMode('entity');
      showToast({ type: 'success', message: `${containerType} ${updatingContainerId ? 'updated' : 'created'} successfully` });
      setContainerForm({ name: '', description: '', content: '' });
      setEntitiesToAdd([]);
      setContainerWorkflowOrigin(null);
      setAttachPdf(true);
      setCreateAsDraft(false);
      setUpdatingContainerId(null);
      setUpdatingContainerDates(null);
    } else {
      showToast({ type: 'error', message: response?.error || 'Container creation failed' });
    }
    setSubmitting(false);
  };

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

  // Investigation handlers
  const handleSelectInvestigationPlatform = (platformId: string) => {
    setInvestigationPlatformId(platformId);
    setInvestigationPlatformSelected(true);
    handleInvestigationScan(platformId);
  };

  const toggleInvestigationEntity = async (entityId: string) => {
    const entity = investigationEntities.find(e => e.id === entityId);
    const newSelected = entity ? !entity.selected : true;
    setInvestigationEntities(prev => prev.map(e => e.id === entityId ? { ...e, selected: newSelected } : e));
    
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: 'INVESTIGATION_SYNC_SELECTION', payload: { entityId, selected: newSelected } });
    }
  };

  const selectAllInvestigationEntities = async () => {
    const filteredIds = filteredInvestigationEntities.map(e => e.id);
    setInvestigationEntities(prev => prev.map(e => filteredIds.includes(e.id) ? { ...e, selected: true } : e));
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: 'INVESTIGATION_SYNC_ALL', payload: { entityIds: filteredIds, selected: true } });
    }
  };

  const clearInvestigationSelection = async () => {
    const filteredIds = filteredInvestigationEntities.map(e => e.id);
    setInvestigationEntities(prev => prev.map(e => filteredIds.includes(e.id) ? { ...e, selected: false } : e));
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: 'INVESTIGATION_SYNC_ALL', payload: { entityIds: filteredIds, selected: false } });
    }
  };

  const handleCreateWorkbench = async () => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
    const selectedEntities = investigationEntities.filter(e => e.selected);
    if (selectedEntities.length === 0) return;
    
    setSubmitting(true);
    let workbenchName = 'Investigation';
    let currentTab: chrome.tabs.Tab | undefined;
    try { const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); currentTab = tab; if (tab?.title) workbenchName = tab.title; } catch { /* use default */ }
    
    const entityIds = selectedEntities.map(e => e.id).filter(id => id && id.length > 0);
    const response = await chrome.runtime.sendMessage({
      type: 'CREATE_WORKBENCH',
      payload: { name: workbenchName, description: `Investigation with ${entityIds.length} entities`, entityIds, platformId: selectedPlatformId || availablePlatforms[0]?.id },
    });
    
    if (response?.success && response.data?.url) {
      chrome.tabs.create({ url: response.data.url });
      if (currentTab?.id) { chrome.tabs.sendMessage(currentTab.id, { type: 'CLEAR_HIGHLIGHTS' }); chrome.tabs.sendMessage(currentTab.id, { type: 'HIDE_PANEL' }); }
      setInvestigationEntities([]);
      setInvestigationTypeFilter('all');
      setPanelMode('empty');
      showToast({ type: 'success', message: 'Workbench created successfully' });
    } else {
      showToast({ type: 'error', message: response?.error || 'Failed to create workbench' });
    }
    setSubmitting(false);
  };

  const resetInvestigation = () => {
    resetInvestigationState();
    setPanelMode('empty');
    chrome.tabs?.query({ active: true, currentWindow: true }).then(([tab]) => { if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: 'CLEAR_HIGHLIGHTS' }); });
  };

  const containerSteps = openctiPlatforms.length > 1 ? ['Select Platform', 'Select Type', 'Configure Details'] : ['Select Type', 'Configure Details'];
  const logoSuffix = mode === 'dark' ? 'dark-theme' : 'light-theme';

  const renderHeader = () => (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <img src={`../assets/logos/logo_filigran_${logoSuffix}_embleme_square.svg`} alt="XTM" width={28} height={28} />
        <Typography variant="h5" sx={{ fontWeight: 600, fontSize: 20, color: mode === 'dark' ? '#ffffff' : '#1a1a2e' }}>Filigran Threat Management</Typography>
      </Box>
      <IconButton size="small" onClick={handleClose} sx={{ color: mode === 'dark' ? '#ffffff' : 'text.primary' }}><CloseOutlined fontSize="small" /></IconButton>
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
      case 'not-found': return <CommonNotFoundView entity={entity} mode={mode} entityFromScanResults={entityFromScanResults} setEntityFromScanResults={setEntityFromScanResults} setPanelMode={setPanelMode} setEntitiesToAdd={setEntitiesToAdd} />;
      case 'add': return <OCTIAddView setPanelMode={setPanelMode} entitiesToAdd={entitiesToAdd} handleAddEntities={handleAddEntities} submitting={submitting} />;
      case 'import-results': return <OCTIImportResultsView mode={mode} importResults={importResults} setImportResults={setImportResults} handleClose={handleClose} logoSuffix={logoSuffix} />;
      case 'preview': return <CommonPreviewView mode={mode} setPanelMode={setPanelMode} entitiesToAdd={entitiesToAdd} setEntitiesToAdd={setEntitiesToAdd} setSelectedScanItems={setSelectedScanItems} createIndicators={createIndicators} setCreateIndicators={setCreateIndicators} resolvedRelationships={resolvedRelationships} setResolvedRelationships={setResolvedRelationships} aiSettings={aiSettings} aiResolvingRelationships={aiResolvingRelationships} setAiResolvingRelationships={setAiResolvingRelationships} availablePlatforms={availablePlatforms} openctiPlatforms={openctiPlatforms} selectedPlatformId={selectedPlatformId} setSelectedPlatformId={setSelectedPlatformId} setPlatformUrl={setPlatformUrl} setContainerWorkflowOrigin={setContainerWorkflowOrigin} setExistingContainers={setExistingContainers} setCheckingExisting={setCheckingExisting} currentPageUrl={currentPageUrl} currentPageTitle={currentPageTitle} scanPageContent={scanPageContent} showToast={showToast} handleAddEntities={handleAddEntities} submitting={submitting} />;
      case 'platform-select': return <CommonPlatformSelectView mode={mode} setPanelMode={setPanelMode} openctiPlatforms={openctiPlatforms} selectedPlatformId={selectedPlatformId} setSelectedPlatformId={setSelectedPlatformId} setPlatformUrl={setPlatformUrl} containerWorkflowOrigin={containerWorkflowOrigin} setContainerWorkflowOrigin={setContainerWorkflowOrigin} containerSteps={containerSteps} entitiesToAdd={entitiesToAdd} handleAddEntities={handleAddEntities} logoSuffix={logoSuffix} />;
      case 'existing-containers': return <OCTIExistingContainersView mode={mode} existingContainers={existingContainers} selectedPlatformId={selectedPlatformId} setSelectedPlatformId={setSelectedPlatformId} availablePlatforms={availablePlatforms} openctiPlatforms={openctiPlatforms} setPlatformUrl={setPlatformUrl} setPanelMode={setPanelMode} setEntity={setEntity} setMultiPlatformResults={setMultiPlatformResults} setCurrentPlatformIndex={setCurrentPlatformIndex} setEntityContainers={setEntityContainers} fetchEntityContainers={fetchEntityContainers} setUpdatingContainerId={setUpdatingContainerId} setOCTIContainerType={setOCTIContainerType} setContainerForm={setContainerForm} setSelectedLabels={setSelectedLabels} setSelectedMarkings={setSelectedMarkings} containerSpecificFields={containerSpecificFields} setContainerSpecificFields={setContainerSpecificFields} setUpdatingContainerDates={setUpdatingContainerDates} loadLabelsAndMarkings={loadLabelsAndMarkings} formatDate={formatDate} />;
      case 'container-type': return <OCTIContainerTypeView mode={mode} setPanelMode={setPanelMode} setOCTIContainerType={setOCTIContainerType} containerWorkflowOrigin={containerWorkflowOrigin} openctiPlatformsCount={openctiPlatforms.length} containerSteps={containerSteps} entitiesToAdd={entitiesToAdd} />;
      case 'container-form': return <OCTIContainerFormView mode={mode} setPanelMode={setPanelMode} containerType={containerType} containerSteps={containerSteps} containerForm={containerForm} setContainerForm={setContainerForm} containerSpecificFields={containerSpecificFields} setContainerSpecificFields={setContainerSpecificFields} updatingContainerId={updatingContainerId} availablePlatforms={availablePlatforms} openctiPlatforms={openctiPlatforms} selectedPlatformId={selectedPlatformId} aiSettings={aiSettings} aiGeneratingDescription={aiGeneratingDescription} handleGenerateAIDescription={handleGenerateAIDescription} availableLabels={availableLabels} selectedLabels={selectedLabels} setSelectedLabels={setSelectedLabels} availableMarkings={availableMarkings} selectedMarkings={selectedMarkings} setSelectedMarkings={setSelectedMarkings} availableReportTypes={availableReportTypes} availableContexts={availableContexts} availableSeverities={availableSeverities} availablePriorities={availablePriorities} availableResponseTypes={availableResponseTypes} availableAuthors={availableAuthors} attachPdf={attachPdf} setAttachPdf={setAttachPdf} createAsDraft={createAsDraft} setCreateAsDraft={setCreateAsDraft} entitiesToAdd={entitiesToAdd} handleCreateContainer={handleCreateContainer} submitting={submitting} generatingPdf={generatingPdf} />;
      case 'investigation': return <OCTIInvestigationView mode={mode} openctiPlatforms={openctiPlatforms} availablePlatforms={availablePlatforms} investigationPlatformId={investigationPlatformId} investigationPlatformSelected={investigationPlatformSelected} setInvestigationPlatformSelected={setInvestigationPlatformSelected} investigationEntities={investigationEntities} setInvestigationEntities={setInvestigationEntities} investigationScanning={investigationScanning} investigationTypeFilter={investigationTypeFilter} setInvestigationTypeFilter={setInvestigationTypeFilter} investigationEntityTypes={investigationEntityTypes} filteredInvestigationEntities={filteredInvestigationEntities} selectedInvestigationCount={selectedInvestigationCount} submitting={submitting} resetInvestigation={resetInvestigation} handleSelectInvestigationPlatform={handleSelectInvestigationPlatform} handleInvestigationScan={handleInvestigationScan} toggleInvestigationEntity={toggleInvestigationEntity} selectAllInvestigationEntities={selectAllInvestigationEntities} clearInvestigationSelection={clearInvestigationSelection} handleCreateWorkbench={handleCreateWorkbench} />;
      case 'scan-results': return <CommonScanResultsView mode={mode} handleClose={handleClose} scanResultsEntities={scanResultsEntities} setScanResultsEntities={setScanResultsEntities} scanResultsEntitiesRef={scanResultsEntitiesRef} scanResultsTypeFilter={scanResultsTypeFilter} setScanResultsTypeFilter={setScanResultsTypeFilter} scanResultsFoundFilter={scanResultsFoundFilter} setScanResultsFoundFilter={setScanResultsFoundFilter} selectedScanItems={selectedScanItems} setSelectedScanItems={setSelectedScanItems} setPanelMode={setPanelMode} setEntitiesToAdd={setEntitiesToAdd} setEntity={setEntity} setMultiPlatformResults={setMultiPlatformResults} setCurrentPlatformIndex={setCurrentPlatformIndex} setEntityFromScanResults={setEntityFromScanResults} currentPlatformIndexRef={currentPlatformIndexRef} multiPlatformResultsRef={multiPlatformResultsRef} aiSettings={aiSettings} aiDiscoveringEntities={aiDiscoveringEntities} setAiDiscoveringEntities={setAiDiscoveringEntities} availablePlatforms={availablePlatforms} openctiPlatforms={openctiPlatforms} openaevPlatforms={openaevPlatforms} selectedPlatformId={selectedPlatformId} setSelectedPlatformId={setSelectedPlatformId} platformUrl={platformUrl} setPlatformUrl={setPlatformUrl} showToast={showToast} setContainerForm={setContainerForm} currentPageTitle={currentPageTitle} currentPageUrl={currentPageUrl} setCurrentPageUrl={setCurrentPageUrl} setCurrentPageTitle={setCurrentPageTitle} scanPageContent={scanPageContent} logoSuffix={logoSuffix} setEntityDetailsLoading={setEntityDetailsLoading} />;
      case 'atomic-testing': return <OAEVAtomicTestingView mode={mode} availablePlatforms={availablePlatforms} aiSettings={aiSettings} setPanelMode={setPanelMode} showToast={showToast} atomicTestingTargets={atomicTestingTargets} setAtomicTestingTargets={setAtomicTestingTargets} selectedAtomicTarget={selectedAtomicTarget} setSelectedAtomicTarget={setSelectedAtomicTarget} atomicTestingShowList={atomicTestingShowList} setAtomicTestingShowList={setAtomicTestingShowList} atomicTestingPlatformId={atomicTestingPlatformId} setAtomicTestingPlatformId={setAtomicTestingPlatformId} atomicTestingPlatformSelected={atomicTestingPlatformSelected} setAtomicTestingPlatformSelected={setAtomicTestingPlatformSelected} atomicTestingTargetType={atomicTestingTargetType} setAtomicTestingTargetType={setAtomicTestingTargetType} atomicTestingAssets={atomicTestingAssets} setAtomicTestingAssets={setAtomicTestingAssets} atomicTestingAssetGroups={atomicTestingAssetGroups} setAtomicTestingAssetGroups={setAtomicTestingAssetGroups} atomicTestingTypeFilter={atomicTestingTypeFilter} setAtomicTestingTypeFilter={setAtomicTestingTypeFilter} atomicTestingInjectorContracts={atomicTestingInjectorContracts} setAtomicTestingInjectorContracts={setAtomicTestingInjectorContracts} atomicTestingSelectedAsset={atomicTestingSelectedAsset} setAtomicTestingSelectedAsset={setAtomicTestingSelectedAsset} atomicTestingSelectedAssetGroup={atomicTestingSelectedAssetGroup} setAtomicTestingSelectedAssetGroup={setAtomicTestingSelectedAssetGroup} atomicTestingSelectedContract={atomicTestingSelectedContract} setAtomicTestingSelectedContract={setAtomicTestingSelectedContract} atomicTestingTitle={atomicTestingTitle} setAtomicTestingTitle={setAtomicTestingTitle} atomicTestingCreating={atomicTestingCreating} setAtomicTestingCreating={setAtomicTestingCreating} atomicTestingLoadingAssets={atomicTestingLoadingAssets} setAtomicTestingLoadingAssets={setAtomicTestingLoadingAssets} atomicTestingAIMode={atomicTestingAIMode} setAtomicTestingAIMode={setAtomicTestingAIMode} atomicTestingAIGenerating={atomicTestingAIGenerating} setAtomicTestingAIGenerating={setAtomicTestingAIGenerating} atomicTestingAIPlatform={atomicTestingAIPlatform} setAtomicTestingAIPlatform={setAtomicTestingAIPlatform} atomicTestingAIExecutor={atomicTestingAIExecutor} setAtomicTestingAIExecutor={setAtomicTestingAIExecutor} atomicTestingAIContext={atomicTestingAIContext} setAtomicTestingAIContext={setAtomicTestingAIContext} atomicTestingAIGeneratedPayload={atomicTestingAIGeneratedPayload} setAtomicTestingAIGeneratedPayload={setAtomicTestingAIGeneratedPayload} resetAtomicTestingState={resetAtomicTestingState} />;
      case 'unified-search': return <CommonUnifiedSearchView mode={mode} unifiedSearchQuery={unifiedSearchQuery} setUnifiedSearchQuery={setUnifiedSearchQuery} unifiedSearchResults={unifiedSearchResults} setUnifiedSearchResults={setUnifiedSearchResults} unifiedSearching={unifiedSearching} setUnifiedSearching={setUnifiedSearching} unifiedSearchPlatformFilter={unifiedSearchPlatformFilter} setUnifiedSearchPlatformFilter={setUnifiedSearchPlatformFilter} setPanelMode={setPanelMode} setEntity={setEntity} setEntityFromSearchMode={setEntityFromSearchMode} setMultiPlatformResults={setMultiPlatformResults} setCurrentPlatformIndex={setCurrentPlatformIndex} currentPlatformIndexRef={currentPlatformIndexRef} multiPlatformResultsRef={multiPlatformResultsRef} availablePlatforms={availablePlatforms} logoSuffix={logoSuffix} entityDetailsLoading={entityDetailsLoading} setEntityDetailsLoading={setEntityDetailsLoading} />;
      case 'add-selection': return <OCTIAddSelectionView setPanelMode={setPanelMode} addSelectionText={addSelectionText} setAddSelectionText={setAddSelectionText} addSelectionEntityType={addSelectionEntityType} setAddSelectionEntityType={setAddSelectionEntityType} addSelectionFromContextMenu={addSelectionFromContextMenu} setAddSelectionFromContextMenu={setAddSelectionFromContextMenu} addingSelection={addingSelection} handleAddSelection={handleAddSelection} openctiPlatforms={openctiPlatforms} />;
      case 'scenario-overview':
      case 'scenario-form': return <OAEVScenarioView mode={mode} panelMode={panelMode as 'scenario-overview' | 'scenario-form'} availablePlatforms={availablePlatforms} selectedPlatformId={selectedPlatformId} setSelectedPlatformId={setSelectedPlatformId} setPlatformUrl={setPlatformUrl} setPanelMode={setPanelMode} showToast={showToast} currentPageTitle={currentPageTitle} currentPageUrl={currentPageUrl} aiSettings={aiSettings} submitting={submitting} setSubmitting={setSubmitting} aiSelectingInjects={aiSelectingInjects} setAiSelectingInjects={setAiSelectingInjects} aiFillingEmails={aiFillingEmails} setAiFillingEmails={setAiFillingEmails} handleClose={handleClose} scenarioOverviewData={scenarioOverviewData} setScenarioOverviewData={setScenarioOverviewData} scenarioForm={scenarioForm} setScenarioForm={setScenarioForm} selectedInjects={selectedInjects} setSelectedInjects={setSelectedInjects} scenarioEmails={scenarioEmails} setScenarioEmails={setScenarioEmails} scenarioLoading={scenarioLoading} setScenarioLoading={setScenarioLoading} scenarioStep={scenarioStep} setScenarioStep={setScenarioStep} scenarioTypeAffinity={scenarioTypeAffinity} setScenarioTypeAffinity={setScenarioTypeAffinity} scenarioPlatformsAffinity={scenarioPlatformsAffinity} setScenarioPlatformsAffinity={setScenarioPlatformsAffinity} scenarioInjectSpacing={scenarioInjectSpacing} setScenarioInjectSpacing={setScenarioInjectSpacing} scenarioPlatformSelected={scenarioPlatformSelected} setScenarioPlatformSelected={setScenarioPlatformSelected} scenarioPlatformId={scenarioPlatformId} setScenarioPlatformId={setScenarioPlatformId} scenarioRawAttackPatterns={scenarioRawAttackPatterns} setScenarioRawAttackPatterns={setScenarioRawAttackPatterns} scenarioTargetType={scenarioTargetType} setScenarioTargetType={setScenarioTargetType} scenarioAssets={scenarioAssets} setScenarioAssets={setScenarioAssets} scenarioAssetGroups={scenarioAssetGroups} setScenarioAssetGroups={setScenarioAssetGroups} scenarioTeams={scenarioTeams} setScenarioTeams={setScenarioTeams} scenarioSelectedAsset={scenarioSelectedAsset} setScenarioSelectedAsset={setScenarioSelectedAsset} scenarioSelectedAssetGroup={scenarioSelectedAssetGroup} setScenarioSelectedAssetGroup={setScenarioSelectedAssetGroup} scenarioSelectedTeam={scenarioSelectedTeam} setScenarioSelectedTeam={setScenarioSelectedTeam} scenarioCreating={scenarioCreating} setScenarioCreating={setScenarioCreating} scenarioAIMode={scenarioAIMode} setScenarioAIMode={setScenarioAIMode} scenarioAIGenerating={scenarioAIGenerating} setScenarioAIGenerating={setScenarioAIGenerating} scenarioAINumberOfInjects={scenarioAINumberOfInjects} setScenarioAINumberOfInjects={setScenarioAINumberOfInjects} scenarioAIPayloadAffinity={scenarioAIPayloadAffinity} setScenarioAIPayloadAffinity={setScenarioAIPayloadAffinity} scenarioAITableTopDuration={scenarioAITableTopDuration} setScenarioAITableTopDuration={setScenarioAITableTopDuration} scenarioAIEmailLanguage={scenarioAIEmailLanguage} setScenarioAIEmailLanguage={setScenarioAIEmailLanguage} scenarioAITheme={scenarioAITheme} setScenarioAITheme={setScenarioAITheme} scenarioAIContext={scenarioAIContext} setScenarioAIContext={setScenarioAIContext} scenarioAIGeneratedScenario={scenarioAIGeneratedScenario} setScenarioAIGeneratedScenario={setScenarioAIGeneratedScenario} resetScenarioState={resetScenarioState} />;
      case 'loading': return <CommonLoadingView />;
      default: return <CommonEmptyView />;
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
        {renderHeader()}
        <Box sx={{ flex: 1, overflow: 'auto' }}>{renderContent()}</Box>
      </Box>
    </ThemeProvider>
  );
};

export default App;
