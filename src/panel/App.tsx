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
import { cleanHtmlContent, generateDescription } from './utils';
import { CommonEmptyView, CommonLoadingView } from './components';
import { useScenarioState, useAIState, useAtomicTestingState, useInvestigationState } from './hooks';
import {
  // Common views (cross-platform)
  CommonScanResultsView,
  CommonUnifiedSearchView,
  CommonPreviewView,
  CommonPlatformSelectView,
  CommonNotFoundView,
  // OpenCTI-specific views
  OCTIEntityView,
  OCTIImportResultsView,
  OCTIContainerTypeView,
  OCTIContainerFormView,
  OCTIExistingContainersView,
  OCTIInvestigationView,
  OCTIAddView,
  OCTIAddSelectionView,
  // OpenAEV-specific views
  OAEVEntityView,
  OAEVAtomicTestingView,
  OAEVScenarioView,
} from './views';
import {
  parsePrefixedType,
  prefixEntityType,
} from '../shared/platform';
import {
  getOAEVEntityName,
  getOAEVEntityId,
  getOAEVTypeFromClass,
} from '../shared/utils/entity';
import { formatDate } from '../shared/utils/formatters';
import type {
  PanelMode,
  ScanResultEntity,
  ScanResultPlatformMatch,
  ImportResults,
  EntityData,
  ContainerData,
  PlatformInfo,
  UnifiedSearchResult,
} from './types';

const log = loggers.panel;

const App: React.FC = () => {
  const [mode, setMode] = useState<'dark' | 'light'>('dark');
  const [panelMode, setPanelMode] = useState<PanelMode>('empty');
  const [entity, setEntity] = useState<EntityData | null>(null);
  // Search state (searches both OpenCTI and OpenAEV)
  const [unifiedSearchQuery, setUnifiedSearchQuery] = useState('');
  const [unifiedSearchResults, setUnifiedSearchResults] = useState<UnifiedSearchResult[]>([]);
  const [unifiedSearching, setUnifiedSearching] = useState(false);
  const [unifiedSearchPlatformFilter, setUnifiedSearchPlatformFilter] = useState<'all' | 'opencti' | 'openaev'>('all');
  // Add selection state (from context menu "Add to OpenCTI")
  const [addSelectionText, setAddSelectionText] = useState('');
  const [containerType, setContainerType] = useState<string>('');
  const [containerForm, setContainerForm] = useState({
    name: '',
    description: '',
    content: '',
  });
  const [entityContainers, setEntityContainers] = useState<ContainerData[]>([]);
  const [loadingContainers, setLoadingContainers] = useState(false);
  const [selectedLabels, setSelectedLabels] = useState<Array<{ id: string; value: string; color: string }>>([]);
  const [selectedMarkings, setSelectedMarkings] = useState<Array<{ id: string; definition: string }>>([]);
  const [availableLabels, setAvailableLabels] = useState<Array<{ id: string; value: string; color: string }>>([]);
  const [availableMarkings, setAvailableMarkings] = useState<Array<{ id: string; definition: string }>>([]);
  const [entitiesToAdd, setEntitiesToAdd] = useState<EntityData[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [platformUrl, setPlatformUrl] = useState('');
  const [availablePlatforms, setAvailablePlatforms] = useState<PlatformInfo[]>([]);
  const [selectedPlatformId, setSelectedPlatformId] = useState<string>('');
  // Ref to track latest platforms (for use in event handlers that may have stale closures)
  const availablePlatformsRef = React.useRef<PlatformInfo[]>([]);
  
  // Keep ref in sync with state
  React.useEffect(() => {
    availablePlatformsRef.current = availablePlatforms;
  }, [availablePlatforms]);
  
  // Helper to get only OpenCTI platforms (for container creation and investigation)
  const openctiPlatforms = React.useMemo(() => 
    availablePlatforms.filter(p => p.type === 'opencti'), 
    [availablePlatforms]
  );
  const openctiPlatformsRef = React.useRef<PlatformInfo[]>([]);
  React.useEffect(() => {
    openctiPlatformsRef.current = openctiPlatforms;
  }, [openctiPlatforms]);
  // Multi-platform entity results (same entity found in multiple platforms)
  const [multiPlatformResults, setMultiPlatformResults] = useState<Array<{ platformId: string; platformName: string; entity: EntityData }>>([]);
  const [currentPlatformIndex, setCurrentPlatformIndex] = useState(0);
  // Refs for reading latest values in navigation handlers (updated inline wherever state is set)
  const multiPlatformResultsRef = React.useRef<Array<{ platformId: string; platformName: string; entity: EntityData }>>([]);
  const currentPlatformIndexRef = React.useRef(0);
  // NOTE: Refs are updated inline wherever setMultiPlatformResults/setCurrentPlatformIndex are called
  // No useEffect sync needed - inline updates ensure refs are always current
  
  // Track container workflow origin: 'preview' (from bulk selection), 'direct' (from action button), or 'import' (import without container)
  const [containerWorkflowOrigin, setContainerWorkflowOrigin] = useState<'preview' | 'direct' | 'import' | null>(null);
  // Track which search mode the entity view came from (to show back button and return to correct mode)
  // null = not from search, 'unified-search' = from search
  const [entityFromSearchMode, setEntityFromSearchMode] = useState<'unified-search' | null>(null);
  // Track if entity view came from scan results (to show back button)
  const [entityFromScanResults, setEntityFromScanResults] = useState(false);
  // Scan results entities (from page scan)
  const [scanResultsEntities, setScanResultsEntities] = useState<ScanResultEntity[]>([]);
  // Ref to track latest scan results for use in event handlers (avoids stale closure)
  const scanResultsEntitiesRef = React.useRef<ScanResultEntity[]>([]);
  React.useEffect(() => {
    scanResultsEntitiesRef.current = scanResultsEntities;
  }, [scanResultsEntities]);
  const [scanResultsTypeFilter, setScanResultsTypeFilter] = useState<string>('all');
  const [scanResultsFoundFilter, setScanResultsFoundFilter] = useState<'all' | 'found' | 'not-found' | 'ai-discovered'>('all');
  // Selected items for import (synced with content script)
  const [selectedScanItems, setSelectedScanItems] = useState<Set<string>>(new Set());
  
  // Sync entitiesToAdd with selectedScanItems when in preview mode
  React.useEffect(() => {
    if (panelMode === 'preview' && scanResultsEntitiesRef.current.length > 0) {
      // Helper function to check if entity is selectable for OpenCTI (inlined to avoid dependency issues)
      const checkSelectable = (entity: ScanResultEntity): boolean => {
        // OpenAEV-specific types can't be added to OpenCTI containers
        if (entity.type.startsWith('oaev-')) return false;
        return true;
      };
      
      // Helper function to check if entity already exists in OpenCTI
      const checkFoundInOpenCTI = (entity: ScanResultEntity): boolean => {
        const octiCount = entity.platformMatches?.filter(pm => pm.platformType === 'opencti').length || 0;
        return octiCount > 0;
      };
      
      // When in preview mode and selection changes, sync the entities list
      const selectedEntities = scanResultsEntitiesRef.current.filter(entity => {
        const entityValue = entity.value || entity.name;
        return entityValue && selectedScanItems.has(entityValue) && checkSelectable(entity);
      });
      
      // Convert to entitiesToAdd format (mark existsInPlatform based on OpenCTI status)
      const updatedEntities = selectedEntities.map(entity => {
        const octiMatch = entity.platformMatches?.find(pm => pm.platformType === 'opencti');
        const octiEntityId = octiMatch?.entityId;
        return {
          type: entity.type,
          value: entity.value,
          name: entity.name || entity.value,
          existsInPlatform: checkFoundInOpenCTI(entity),
          discoveredByAI: entity.discoveredByAI,
          // Use 'id' field so container creation recognizes it as existing
          id: octiEntityId,
          octiEntityId: octiEntityId,
        };
      });
      
      // Only update if the selection actually changed
      setEntitiesToAdd(current => {
        const currentValues = new Set(current.map(e => e.value || e.name));
        const newValues = new Set(updatedEntities.map(e => e.value || e.name));
        
        // Check if sets are equal
        if (currentValues.size !== newValues.size) {
          return updatedEntities;
        }
        for (const v of currentValues) {
          if (!newValues.has(v)) {
            return updatedEntities;
          }
        }
        return current; // No change
      });
    }
  }, [panelMode, selectedScanItems]);
  
  // Create indicators from observables option
  const [createIndicators, setCreateIndicators] = useState(true);
  // PDF attachment option
  const [attachPdf, setAttachPdf] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  // Create as draft option
  const [createAsDraft, setCreateAsDraft] = useState(false);
  // Page URL for external reference and existing container lookup
  const [currentPageUrl, setCurrentPageUrl] = useState('');
  const [currentPageTitle, setCurrentPageTitle] = useState('');
  // Existing containers found for current page
  const [existingContainers, setExistingContainers] = useState<ContainerData[]>([]);
  const [_checkingExisting, setCheckingExisting] = useState(false);
  // Container being updated (for upsert mode)
  const [updatingContainerId, setUpdatingContainerId] = useState<string | null>(null);
  // Original dates from container being updated (to avoid creating duplicates)
  const [updatingContainerDates, setUpdatingContainerDates] = useState<{
    published?: string; // For Report
    created?: string; // For other container types
  } | null>(null);
  // Import results for displaying confirmation screen
  const [importResults, setImportResults] = useState<ImportResults | null>(null);
  // Container-specific fields
  const [containerSpecificFields, setContainerSpecificFields] = useState<{
    // Report
    report_types: string[];
    // Grouping
    context: string;
    // Case
    severity: string;
    priority: string;
    response_types: string[];
    // Author
    createdBy: string;
  }>({
    report_types: [],
    context: '',
    severity: '',
    priority: '',
    response_types: [],
    createdBy: '',
  });
  // Available options loaded from OpenCTI
  const [availableReportTypes, setAvailableReportTypes] = useState<Array<{ id: string; name: string }>>([]);
  const [availableContexts, setAvailableContexts] = useState<Array<{ id: string; name: string }>>([]);
  const [availableSeverities, setAvailableSeverities] = useState<Array<{ id: string; name: string }>>([]);
  const [availablePriorities, setAvailablePriorities] = useState<Array<{ id: string; name: string }>>([]);
  const [availableResponseTypes, setAvailableResponseTypes] = useState<Array<{ id: string; name: string }>>([]);
  const [availableAuthors, setAvailableAuthors] = useState<Array<{ id: string; name: string; entity_type: string }>>([]);

  // AI state - extracted to useAIState hook
  const {
    aiSettings, setAiSettings,
    aiGeneratingDescription, setAiGeneratingDescription,
    aiSelectingInjects, setAiSelectingInjects,
    aiFillingEmails, setAiFillingEmails,
    aiDiscoveringEntities, setAiDiscoveringEntities,
    aiResolvingRelationships, setAiResolvingRelationships,
    resolvedRelationships, setResolvedRelationships,
    scanPageContent, setScanPageContent,
  } = useAIState();
  
  // Toast notification helper - sends to content script
  const showToast = React.useCallback((options: {
    type: 'success' | 'info' | 'warning' | 'error';
    message: string;
    action?: { label: string; type: 'scroll_to_first' | 'close_panel' | 'custom' };
    persistent?: boolean;
    duration?: number;
  }) => {
    window.parent.postMessage({ type: 'XTM_SHOW_TOAST', payload: options }, '*');
  }, []);

  // Scenario creation state (OpenAEV) - extracted to useScenarioState hook
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

  // Atomic Testing state - extracted to useAtomicTestingState hook
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

  // Investigation state - extracted to useInvestigationState hook
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

  // Track if labels/markings have been loaded (lazy loading)
  const [labelsLoaded, setLabelsLoaded] = useState(false);
  const [markingsLoaded, setMarkingsLoaded] = useState(false);

  // Lazy load labels, markings, vocabularies and authors when container form is needed
  // Must pass platformId to ensure we fetch from the correct platform
  const loadLabelsAndMarkings = (platformId?: string) => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
    
    const targetPlatformId = platformId || selectedPlatformId;
    
    // Always refetch when platformId changes (reset loaded flags externally if needed)
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
    
    // Load vocabularies (don't check if loaded - they're type-specific anyway)
    chrome.runtime.sendMessage({ type: 'FETCH_VOCABULARY', payload: { category: 'report_types_ov', platformId: targetPlatformId } }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response?.success && response.data) {
        setAvailableReportTypes(response.data);
      }
    });
    
    chrome.runtime.sendMessage({ type: 'FETCH_VOCABULARY', payload: { category: 'grouping_context_ov', platformId: targetPlatformId } }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response?.success && response.data) {
        setAvailableContexts(response.data);
      }
    });
    
    chrome.runtime.sendMessage({ type: 'FETCH_VOCABULARY', payload: { category: 'case_severity_ov', platformId: targetPlatformId } }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response?.success && response.data) {
        setAvailableSeverities(response.data);
      }
    });
    
    chrome.runtime.sendMessage({ type: 'FETCH_VOCABULARY', payload: { category: 'case_priority_ov', platformId: targetPlatformId } }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response?.success && response.data) {
        setAvailablePriorities(response.data);
      }
    });
    
    chrome.runtime.sendMessage({ type: 'FETCH_VOCABULARY', payload: { category: 'incident_response_types_ov', platformId: targetPlatformId } }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response?.success && response.data) {
        setAvailableResponseTypes(response.data);
      }
    });
    
    // Load identities (authors) from the selected platform
    chrome.runtime.sendMessage({ type: 'FETCH_IDENTITIES', payload: { platformId: targetPlatformId } }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response?.success && response.data) {
        setAvailableAuthors(response.data);
      }
    });
  };

  useEffect(() => {
    // Check if we're running in an extension context
    const isExtension = typeof chrome !== 'undefined' && chrome.runtime?.sendMessage;
    
    if (!isExtension) {
      // Outside extension context - use default dark theme
      setMode('dark');
      return;
    }

    // Get theme setting - strictly from configuration
    chrome.runtime.sendMessage({ type: 'GET_PLATFORM_THEME' }, (response) => {
      if (chrome.runtime.lastError) {
        return;
      }
      if (response?.success) {
        const themeMode = response.data;
        // Theme is strictly configuration-based - no auto detection
        setMode(themeMode === 'light' ? 'light' : 'dark');
      }
    });

    // Get platform URL and available platforms - quick, from local storage
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response?.success) {
        // Also set theme from settings to ensure consistency
        if (response.data?.theme) {
          const themeMode = response.data.theme;
          // Theme is strictly from settings - default to dark
          setMode(themeMode === 'light' ? 'light' : 'dark');
        }
        
        // Get all enabled platforms - include isEnterprise from saved settings
        const platforms = response.data?.openctiPlatforms || [];
        const enabledPlatforms = platforms
          .filter((p: any) => p.enabled !== false && p.url && p.apiToken)
          .map((p: any) => ({ 
            id: p.id, 
            name: p.name || 'OpenCTI', 
            url: p.url, 
            type: 'opencti' as const,
            isEnterprise: p.isEnterprise, // Include saved EE status
          }));
        
        // Also add OpenAEV platforms - include isEnterprise from saved settings
        const oaevPlatforms = response.data?.openaevPlatforms || [];
        const enabledOAEVPlatforms = oaevPlatforms
          .filter((p: any) => p.enabled !== false && p.url && p.apiToken)
          .map((p: any) => ({ 
            id: p.id, 
            name: p.name || 'OpenAEV', 
            url: p.url, 
            type: 'openaev' as const,
            isEnterprise: p.isEnterprise, // Include saved EE status
          }));
        
        setAvailablePlatforms([...enabledPlatforms, ...enabledOAEVPlatforms]);
        
        // Fetch AI settings availability
        const ai = response.data?.ai;
        const aiAvailable = !!(ai?.provider && ai?.apiKey && ai?.model);
        setAiSettings({
          enabled: aiAvailable,
          provider: ai?.provider,
          available: aiAvailable,
        });
        // Fetch enterprise status for each OpenCTI platform in background
        enabledPlatforms.forEach((platform: PlatformInfo) => {
          chrome.runtime.sendMessage(
            { type: 'TEST_PLATFORM_CONNECTION', payload: { platformId: platform.id, platformType: 'opencti' } },
            (testResponse) => {
              if (chrome.runtime.lastError || !testResponse?.success) return;
              // Update platform with enterprise info
              setAvailablePlatforms(prev => prev.map(p => 
                p.id === platform.id 
                  ? { 
                      ...p, 
                      version: testResponse.data?.version,
                      isEnterprise: testResponse.data?.enterprise_edition,
                    }
                  : p
              ));
            }
          );
        });
        
        // Also fetch enterprise status for OpenAEV platforms
        enabledOAEVPlatforms.forEach((platform: PlatformInfo) => {
          chrome.runtime.sendMessage(
            { type: 'TEST_PLATFORM_CONNECTION', payload: { platformId: platform.id, platformType: 'openaev' } },
            (testResponse) => {
              if (chrome.runtime.lastError || !testResponse?.success) return;
              // Update platform with enterprise info
              setAvailablePlatforms(prev => prev.map(p => 
                p.id === platform.id 
                  ? { 
                      ...p, 
                      version: testResponse.data?.version,
                      isEnterprise: testResponse.data?.enterprise_edition,
                    }
                  : p
              ));
            }
          );
        });
        
        
        // Set first OpenCTI platform as default
        if (enabledPlatforms.length > 0) {
          setPlatformUrl(enabledPlatforms[0].url);
          setSelectedPlatformId(enabledPlatforms[0].id);
        } else if (enabledOAEVPlatforms.length > 0) {
          setPlatformUrl(enabledOAEVPlatforms[0].url);
          setSelectedPlatformId(enabledOAEVPlatforms[0].id);
        }
      }
    });

    // NOTE: Labels and markings are loaded lazily when container form is opened
    // This avoids blocking the panel while slow platforms respond

    // Listen for messages from content script
    window.addEventListener('message', handleMessage);
    
    // Signal to the content script that the panel is ready to receive messages
    // This ensures scan results aren't lost if sent before the panel loads
    window.parent.postMessage({ type: 'XTM_PANEL_READY' }, '*');
    // Get initial panel state
    chrome.runtime.sendMessage({ type: 'GET_PANEL_STATE' }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response?.success && response.data) {
        handlePanelState(response.data);
      }
    });
    
    // Listen for storage changes to keep platforms in sync when settings change
    // This handles the case where the popup adds a new platform
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === 'local' && changes.settings) {
        const newSettings = changes.settings.newValue;
        if (newSettings) {
          // Reload OpenCTI platforms
          const openctiPlatforms = newSettings.openctiPlatforms || [];
          const enabledOpenCTI = openctiPlatforms
            .filter((p: any) => p.enabled !== false && p.url && p.apiToken)
            .map((p: any) => ({ 
              id: p.id, 
              name: p.name || 'OpenCTI', 
              url: p.url, 
              type: 'opencti' as const,
              isEnterprise: p.isEnterprise,
            }));
          
          // Reload OpenAEV platforms  
          const openaevPlatforms = newSettings.openaevPlatforms || [];
          const enabledOpenAEV = openaevPlatforms
            .filter((p: any) => p.enabled !== false && p.url && p.apiToken)
            .map((p: any) => ({ 
              id: p.id, 
              name: p.name || 'OpenAEV', 
              url: p.url, 
              type: 'openaev' as const,
              isEnterprise: p.isEnterprise,
            }));
          
          const allPlatforms = [...enabledOpenCTI, ...enabledOpenAEV];
          setAvailablePlatforms(allPlatforms);
          
          // Update selected platform if needed
          if (allPlatforms.length > 0 && !allPlatforms.find(p => p.id === selectedPlatformId)) {
            setPlatformUrl(allPlatforms[0].url);
            setSelectedPlatformId(allPlatforms[0].id);
          }
          
          // Update AI settings
          const ai = newSettings.ai;
          const aiAvailable = !!(ai?.provider && ai?.apiKey && ai?.model);
          setAiSettings({
            enabled: aiAvailable,
            provider: ai?.provider,
            available: aiAvailable,
          });
          
          // Test connections for new platforms to get EE status
          allPlatforms.forEach((platform) => {
            chrome.runtime.sendMessage(
              { type: 'TEST_PLATFORM_CONNECTION', payload: { platformId: platform.id, platformType: platform.type } },
              (testResponse) => {
                if (chrome.runtime.lastError || !testResponse?.success) return;
                setAvailablePlatforms(prev => prev.map(p => 
                  p.id === platform.id 
                    ? { 
                        ...p, 
                        version: testResponse.data?.version,
                        isEnterprise: testResponse.data?.enterprise_edition,
                      }
                    : p
                ));
              }
            );
          });
        }
      }
    };
    
    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      window.removeEventListener('message', handleMessage);
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // MUST be empty - only run once on mount. DO NOT add selectedPlatformId or navigation will break!

  // Load labels and markings lazily when container form is needed
  // Also reload when the selected platform changes to ensure we get data from the correct platform
  useEffect(() => {
    if (panelMode === 'container-form' || panelMode === 'container-type') {
      // Reset loaded flags when platform changes to force refetch
      setLabelsLoaded(false);
      setMarkingsLoaded(false);
      // Clear previously selected values to prevent using data from a different platform
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

  // Fetch containers for an entity
  const fetchEntityContainers = async (entityId: string, platformId?: string) => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
    if (!entityId) {
      log.warn(' fetchEntityContainers: No entityId provided');
      return;
    }
    
    setLoadingContainers(true);
    setEntityContainers([]); // Clear previous containers
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'FETCH_ENTITY_CONTAINERS',
        payload: { entityId, limit: 10, platformId },
      });
      if (response?.success && response.data) {
        setEntityContainers(response.data);
      } else if (response?.error) {
        log.warn(' fetchEntityContainers failed:', response.error);
      }
    } catch (error) {
      log.error('Failed to fetch containers:', error);
    } finally {
      setLoadingContainers(false);
    }
  };

  const handlePanelState = async (data: { type: string; payload?: any }) => {
    // If theme is passed in payload, use it immediately
    if (data.payload?.theme && (data.payload.theme === 'dark' || data.payload.theme === 'light')) {
      if (data.payload.theme !== mode) {
        setMode(data.payload.theme);
      }
    } else {
      // Otherwise, re-fetch theme on every panel state change to ensure consistency
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({ type: 'GET_PLATFORM_THEME' }, (response) => {
          if (chrome.runtime.lastError) return;
          if (response?.success) {
            // Theme is strictly configuration-based - no auto detection
            const themeMode = response.data === 'light' ? 'light' : 'dark';
            if (themeMode !== mode) {
              setMode(themeMode);
            }
          }
        });
      }
    }
    
    switch (data.type) {
      case 'SHOW_ENTITY':
      case 'SHOW_ENTITY_PANEL': {
        const payload = data.payload;
        setEntityContainers([]);
        setEntityFromSearchMode(null); // Not from search
        // If scan results exist, allow back navigation to them
        // Use ref to get latest value (avoids stale closure in event handler)
        const hasScanResults = scanResultsEntitiesRef.current.length > 0;
        setEntityFromScanResults(hasScanResults);
        
        // Check if we need to fetch full entity details (SDOs from cache have minimal data)
        const entityId = payload?.entityData?.id || payload?.entityId || payload?.id;
        const entityType = payload?.entityData?.entity_type || payload?.type || payload?.entity_type;
        const platformId = payload?.platformId || payload?._platformId;
        
        // Handle multi-platform results if entity is found in multiple platforms
        const platformMatches = payload?.platformMatches || payload?.entityData?.platformMatches;
        if (platformMatches && platformMatches.length > 0) {
          // Build multi-platform results for navigation
          // IMPORTANT: Set entity data structure consistently for navigation to work
          const multiResults: Array<{ platformId: string; platformName: string; entity: EntityData }> = platformMatches.map((match: { platformId: string; platformType?: string; entityId: string; entityData?: any; type?: string }) => {
            const platform = availablePlatforms.find(p => p.id === match.platformId);
            const matchPlatformType = match.platformType || platform?.type || 'opencti';
            // Get the entity type from match data
            const matchType = match.type || match.entityData?.entity_type || payload?.type || entityType || '';
            // Clean type without oaev- prefix for API calls
            const cleanType = matchType.replace(/^oaev-/, '');
            // Prefixed type for display (add oaev- if OpenAEV and not already prefixed)
            const displayType = matchPlatformType === 'openaev' && !matchType.startsWith('oaev-') 
              ? `oaev-${cleanType}` 
              : matchType;
            
            return {
              platformId: match.platformId,
              platformName: platform?.name || match.platformId,
              entity: {
                ...payload,
                id: match.entityId,
                entityId: match.entityId,
                type: displayType, // Prefixed type for display
                entity_type: cleanType, // Clean type for API calls
                name: payload?.name || payload?.value || match.entityData?.name,
                value: payload?.value || payload?.name,
                existsInPlatform: true,
                platformId: match.platformId,
                _platformId: match.platformId,
                _platformType: matchPlatformType,
                _isNonDefaultPlatform: matchPlatformType !== 'opencti',
                entityData: {
                  ...(match.entityData || payload?.entityData || {}),
                  entity_type: cleanType, // Also include in entityData for navigation handlers
                },
              } as EntityData,
            };
          });
          // Sort results: OpenCTI platforms first (knowledge base reference)
          const sortedResults = sortPlatformResults(multiResults);
          setMultiPlatformResults(sortedResults);
          multiPlatformResultsRef.current = sortedResults; // Update ref synchronously
          setCurrentPlatformIndex(0);
          currentPlatformIndexRef.current = 0; // Update ref synchronously
        } else if (platformId) {
          // Single platform result - still set it for consistent display
          const platform = availablePlatforms.find(p => p.id === platformId);
          const singleResult = [{
            platformId,
            platformName: platform?.name || platformId,
            entity: { ...payload, _platformId: platformId },
          }];
          setMultiPlatformResults(singleResult);
          multiPlatformResultsRef.current = singleResult; // Update ref synchronously
          setCurrentPlatformIndex(0);
          currentPlatformIndexRef.current = 0; // Update ref synchronously
        } else {
          setMultiPlatformResults([]);
          multiPlatformResultsRef.current = []; // Update ref synchronously
          setCurrentPlatformIndex(0);
          currentPlatformIndexRef.current = 0; // Update ref synchronously
        }
        
        // Update platform URL based on entity's platform
        if (platformId && availablePlatforms.length > 0) {
          const platform = availablePlatforms.find(p => p.id === platformId);
          if (platform) {
            setPlatformUrl(platform.url);
            setSelectedPlatformId(platform.id);
          }
        }
        
        // Check if this is a non-default platform entity (has platform prefix)
        const parsedType = entityType ? parsePrefixedType(entityType) : null;
        const isNonDefaultPlatform = parsedType !== null;
        const actualEntityType = parsedType ? parsedType.entityType : entityType;
        const entityPlatformType = parsedType?.platformType || 'opencti';
        
        // Determine if this looks like minimal cache data (has id and name but no description/labels)
        // For OpenCTI: check for description and objectLabel
        // For OpenAEV: check for type-specific fields (finding_type, endpoint_name, etc.)
        const isMinimalData = entityId && payload?.existsInPlatform && (
          entityPlatformType === 'openaev' 
            ? (
                // OpenAEV minimal data check: no type-specific detailed fields
                !payload?.entityData?.finding_type && 
                !payload?.entityData?.finding_created_at &&
                !payload?.entityData?.endpoint_name &&
                !payload?.entityData?.asset_group_name &&
                !payload?.entityData?.team_name &&
                !payload?.entityData?.attack_pattern_name &&
                !payload?.entityData?.scenario_name &&
                !payload?.entityData?.exercise_name &&
                !payload?.entityData?.user_email
              )
            : (
                // OpenCTI minimal data check
                !payload?.entityData?.description && 
                !payload?.entityData?.objectLabel &&
                !payload?.description
              )
        );
        
        if (isMinimalData && typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
          // Set entity immediately with what we have - don't wait for fetch
          // This prevents race conditions where user navigates before fetch completes
          const initialEntity = { 
            ...payload, 
            _platformId: platformId,
            _platformType: entityPlatformType, 
            _isNonDefaultPlatform: isNonDefaultPlatform 
          };
          setEntity(initialEntity);
          setPanelMode('entity');
          
          // Fetch full details in background - only update if user hasn't navigated
          const fetchStartIndex = currentPlatformIndexRef.current;
          const messageType = entityPlatformType === 'openaev' ? 'GET_OAEV_ENTITY_DETAILS' : 'GET_ENTITY_DETAILS';
          
          chrome.runtime.sendMessage({
            type: messageType,
            payload: { 
              id: entityId,
              entityId: entityId,
              entityType: actualEntityType,
              platformId,
            },
          }, (response) => {
            if (chrome.runtime.lastError) return;
            // Only update if user is still on the same platform index (hasn't navigated)
            if (currentPlatformIndexRef.current !== fetchStartIndex) return;
            
            if (response?.success && response.data) {
              const fullEntity = { 
                ...payload, 
                ...response.data, 
                entityData: response.data,
                existsInPlatform: true,
                _platformId: platformId,
                _platformType: entityPlatformType,
                _isNonDefaultPlatform: isNonDefaultPlatform,
              };
              setEntity(fullEntity);
              // Also update the cached entity in multiPlatformResults - BOTH state AND ref!
              setMultiPlatformResults(prev => prev.map((r, i) => 
                i === fetchStartIndex ? { 
                  ...r, 
                  entity: { 
                    ...r.entity, 
                    ...response.data, 
                    entityData: response.data,
                  } 
                } : r
              ));
              // CRITICAL: Also update the ref so navigation works correctly
              multiPlatformResultsRef.current = multiPlatformResultsRef.current.map((r, i) =>
                i === fetchStartIndex ? { 
                  ...r, 
                  entity: { 
                    ...r.entity, 
                    ...response.data, 
                    entityData: response.data,
                  } as EntityData
                } : r
              );
              // Fetch containers for OpenCTI entities
              if (!isNonDefaultPlatform) {
                fetchEntityContainers(entityId, platformId);
              }
            }
          });
        } else {
          // Full data already present or not in platform
          setEntity({ ...payload, _platformType: entityPlatformType, _isNonDefaultPlatform: isNonDefaultPlatform });
          setPanelMode(payload?.existsInPlatform ? 'entity' : 'not-found');
          
          // Fetch containers only for default platform (OpenCTI) entities
          if (payload?.existsInPlatform && entityId && !isNonDefaultPlatform) {
            fetchEntityContainers(entityId, platformId);
          }
        }
        break;
      }
      case 'SHOW_ADD_PANEL':
        setEntitiesToAdd(data.payload?.entities || []);
        setPanelMode('add');
        break;
      case 'SHOW_PREVIEW':
      case 'SHOW_PREVIEW_PANEL': {
        setEntitiesToAdd(data.payload?.entities || []);
        // Store page info for potential container creation
        setCurrentPageUrl(data.payload?.pageUrl || '');
        setCurrentPageTitle(data.payload?.pageTitle || '');
        
        // Use pre-computed description if available, otherwise generate from content
        const previewDescription = data.payload?.pageDescription || 
          generateDescription(data.payload?.pageContent || '');
        // Use HTML content for content field if available, otherwise use text content
        const previewContent = data.payload?.pageHtmlContent || data.payload?.pageContent || '';
        
        setContainerForm({
          name: data.payload?.pageTitle || '',
          description: previewDescription,
          content: cleanHtmlContent(previewContent),
        });
        setPanelMode('preview');
        break;
      }
      case 'SHOW_CREATE_CONTAINER':
      case 'SHOW_CONTAINER_PANEL': {
        const pageContent = data.payload?.pageContent || '';
        const pageHtmlContent = data.payload?.pageHtmlContent || pageContent;
        const pageUrl = data.payload?.pageUrl || '';
        const pageTitle = data.payload?.pageTitle || '';
        
        // Use pre-computed description if available, otherwise generate from content
        const containerDescription = data.payload?.pageDescription || 
          generateDescription(pageContent);
        
        setContainerForm({
          name: pageTitle,
          description: containerDescription,
          content: cleanHtmlContent(pageHtmlContent),
        });
        setEntitiesToAdd(data.payload?.entities || []);
        setCurrentPageUrl(pageUrl);
        setCurrentPageTitle(pageTitle);
        // Mark this as a direct container creation workflow (not from preview)
        setContainerWorkflowOrigin('direct');
        setExistingContainers([]); // Reset
        
        // Helper function to go to next step based on OpenCTI platform count
        // Use ref to get latest platforms (avoid stale closure)
        const goToNextStep = () => {
          const platforms = openctiPlatformsRef.current;
          if (platforms.length > 1) {
            setPanelMode('platform-select');
          } else {
            // Auto-select the single OpenCTI platform
            if (platforms.length === 1) {
              setSelectedPlatformId(platforms[0].id);
              setPlatformUrl(platforms[0].url);
            }
            setPanelMode('container-type');
          }
        };
        
        // Check for existing containers with this URL
        if (pageUrl && typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
          setCheckingExisting(true);
          setPanelMode('loading');
          
          chrome.runtime.sendMessage(
            { type: 'FIND_CONTAINERS_BY_URL', payload: { url: pageUrl } },
            (response) => {
              setCheckingExisting(false);
              if (chrome.runtime.lastError) {
                goToNextStep();
                return;
              }
              
              if (response?.success && response.data?.length > 0) {
                // Found existing containers - show them first
                setExistingContainers(response.data);
                setPanelMode('existing-containers');
              } else {
                // No existing containers - go to platform select or container type
                goToNextStep();
              }
            }
          );
        } else {
          goToNextStep();
        }
        break;
      }
      case 'SHOW_INVESTIGATION_PANEL': {
        // Clear previous data and set investigation mode
        setInvestigationEntities([]);
        setInvestigationTypeFilter('all');
        // Use ref to get latest OpenCTI platforms (investigation is OpenCTI-only)
        const platforms = openctiPlatformsRef.current;
        // If single OpenCTI platform, auto-select and start scanning
        // If multiple OpenCTI platforms, show platform selection first
        if (platforms.length <= 1) {
          const singlePlatformId = platforms[0]?.id || null;
          setInvestigationPlatformSelected(true);
          setInvestigationPlatformId(singlePlatformId);
          setInvestigationScanning(true);
          setPanelMode('investigation');
          // Auto-trigger scan for single platform
          setTimeout(() => {
            handleInvestigationScan(singlePlatformId || undefined);
          }, 100);
        } else {
          setInvestigationPlatformSelected(false);
          setInvestigationPlatformId(null);
          setInvestigationScanning(false);
          setPanelMode('investigation');
        }
        break;
      }
      // Atomic Testing
      case 'SHOW_ATOMIC_TESTING_PANEL':
      case 'ATOMIC_TESTING_SCAN_RESULTS': {
        const targets = data.payload?.targets || [];
        const themeFromPayload = data.payload?.theme;
        
        // Clear previous entity state
        setEntity(null);
        setMultiPlatformResults([]);
        multiPlatformResultsRef.current = [];
        setCurrentPlatformIndex(0);
        currentPlatformIndexRef.current = 0;
        setEntityContainers([]);
        
        // Set theme if provided
        if (themeFromPayload && (themeFromPayload === 'dark' || themeFromPayload === 'light')) {
          setMode(themeFromPayload);
        }
        
        setAtomicTestingTargets(targets);
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
        setAtomicTestingShowList(true); // Show the list first
        setAtomicTestingTypeFilter('all'); // Reset type filter
        setPanelMode('atomic-testing');
        break;
      }
      case 'ATOMIC_TESTING_SELECT': {
        // User clicked on a target to select it (from highlight or list)
        const target = data.payload;
        setSelectedAtomicTarget(target);
        setAtomicTestingTitle(`Atomic Test - ${target?.name || ''}`);
        setAtomicTestingShowList(false); // Hide list, show form
        setAtomicTestingInjectorContracts([]); // Reset contracts
        setAtomicTestingSelectedContract(null);
        
        // If it's an attack pattern and platform is selected, load injector contracts
        // The attack pattern ID should be from OpenAEV - check multiple possible locations
        const entityId = target?.entityId || 
          target?.data?.entityId || 
          target?.data?.attack_pattern_id ||
          target?.data?.id;
        if (target?.type === 'attack-pattern' && entityId && atomicTestingPlatformId) {
          chrome.runtime.sendMessage({
            type: 'FETCH_INJECTOR_CONTRACTS',
            payload: { attackPatternId: entityId, platformId: atomicTestingPlatformId },
          }).then((res: any) => {
            if (res?.success) {
              setAtomicTestingInjectorContracts(res.data || []);
            }
          });
        }
        break;
      }
      case 'INVESTIGATION_SCAN_RESULTS': {
        // Receive results from investigation scan (only entities found in platform)
        // Clear previous entity state
        setEntity(null);
        setMultiPlatformResults([]);
        multiPlatformResultsRef.current = [];
        setCurrentPlatformIndex(0);
        currentPlatformIndexRef.current = 0;
        setEntityContainers([]);
        
        const entities = data.payload?.entities || [];
        setInvestigationEntities(entities.map((e: any) => ({
          id: e.entityId || e.id,
          type: e.type || e.entity_type,
          name: e.name || e.value,
          value: e.value,
          platformId: e.platformId || e._platformId,
          selected: false,
        })));
        setInvestigationScanning(false);
        setInvestigationTypeFilter('all'); // Reset filter
        break;
      }
      case 'SCAN_RESULTS': {
        // Receive results from page scan (all detected entities)
        const results = data.payload || {};
        
        // CRITICAL: Clear all previous entity state when a new scan starts
        // This prevents showing old entity data from previous page
        setEntity(null);
        setMultiPlatformResults([]);
        multiPlatformResultsRef.current = [];
        setCurrentPlatformIndex(0);
        currentPlatformIndexRef.current = 0;
        setEntityContainers([]);
        setEntityFromSearchMode(null);
        
        // Map to group entities by their normalized name/value (case-insensitive)
        // This allows us to track the same entity found in multiple platforms
        const entityMap = new Map<string, ScanResultEntity>();
        
        // Helper to normalize key for grouping (lowercase, trimmed, normalized whitespace)
        // This ensures entities with the same NAME from different platforms are merged
        // IMPORTANT: Always use the canonical entity NAME for grouping, not the matched value
        // This way "T1098.001" (matched) and "Additional Cloud Credentials" (name) merge correctly
        const getGroupKey = (name: string): string => {
          return (name || '')
            .toLowerCase()
            .trim()
            .replace(/\s+/g, ' '); // Normalize multiple spaces to single space
        };
        
        // Helper to add entity or merge with existing entry
        // IMPORTANT: platformMatches should ONLY contain platforms where entity was FOUND
        const addOrMergeEntity = (entity: ScanResultEntity) => {
          const groupKey = getGroupKey(entity.name);
          
          // Only create a platform match if the entity was FOUND on this platform
          const platformMatch: ScanResultPlatformMatch | null = entity.found ? {
            platformId: entity.platformId || '',
            platformType: entity.platformType || 'opencti',
            entityId: entity.entityId,
            entityData: entity.entityData,
            type: entity.type,
          } : null;
          
          const existing = entityMap.get(groupKey);
          if (existing) {
            // Merge: add this platform to existing entry ONLY if found
            if (entity.found && platformMatch) {
              if (!existing.platformMatches) {
                existing.platformMatches = [];
              }
              // Only add if not already present (same platformId AND same platformType)
              const isDuplicate = existing.platformMatches.some(pm => 
                pm.platformId === platformMatch.platformId && pm.platformType === platformMatch.platformType
              );
              if (!isDuplicate) {
                existing.platformMatches.push(platformMatch);
              }
              // Mark the entity as found since at least one platform found it
              existing.found = true;
            }
          } else {
            // New entry - only add platformMatches if found
            entityMap.set(groupKey, {
              ...entity,
              platformMatches: platformMatch ? [platformMatch] : [],
            });
          }
        };
        
        // Add OpenCTI observables
        if (results.observables) {
          for (const obs of results.observables) {
            addOrMergeEntity({
              id: obs.entityId || obs.id || `obs-${obs.value}`,
              type: obs.type,
              name: obs.value,
              value: obs.value,
              found: obs.found,
              entityId: obs.entityId,
              platformId: obs.platformId,
              platformType: 'opencti',
              entityData: obs,
            });
          }
        }
        
        // Add OpenCTI SDOs
        if (results.sdos) {
          for (const sdo of results.sdos) {
            addOrMergeEntity({
              id: sdo.entityId || sdo.id || `sdo-${sdo.name}`,
              type: sdo.type,
              name: sdo.name,
              value: sdo.name,
              found: sdo.found,
              entityId: sdo.entityId,
              platformId: sdo.platformId,
              platformType: 'opencti',
              entityData: sdo,
            });
          }
        }
        
        // Add CVEs
        if (results.cves) {
          for (const cve of results.cves) {
            addOrMergeEntity({
              id: cve.entityId || cve.id || `cve-${cve.name}`,
              type: 'Vulnerability',
              name: cve.name,
              value: cve.name,
              found: cve.found,
              entityId: cve.entityId,
              platformId: cve.platformId,
              platformType: 'opencti',
              entityData: cve,
            });
          }
        }
        
        // Add OpenAEV entities
        if (results.platformEntities) {
          for (const entity of results.platformEntities) {
            const platformType = entity.platformType || 'openaev';
            // For OpenAEV entities, extract the proper ID
            // entity.entityId is already set from scan results
            // Fall back to extracting from entityData using type-specific field names
            const entityType = entity.type || '';
            const oaevEntityId = entity.entityId || (platformType === 'openaev' 
              ? getOAEVEntityId(entity.entityData || entity, entityType)
              : entity.id) || '';
            addOrMergeEntity({
              id: oaevEntityId || `${platformType}-${entity.name}`,
              type: prefixEntityType(entityType, platformType as 'opencti' | 'openaev' | 'opengrc'),
              name: entity.name,
              value: entity.value || entity.name,
              found: entity.found ?? true,
              entityId: oaevEntityId,
              platformId: entity.platformId,
              platformType: platformType as 'opencti' | 'openaev',
              entityData: entity,
            });
          }
        }
        
        const scanEntities = Array.from(entityMap.values());
        setScanResultsEntities(scanEntities);
        setScanResultsTypeFilter('all');
        setScanResultsFoundFilter('all');
        // Store page content for AI features (relationship resolution, etc.)
        if (results.pageContent) {
          setScanPageContent(results.pageContent);
        }
        // Update page title/URL if provided
        if (results.pageTitle) {
          setCurrentPageTitle(results.pageTitle);
        }
        if (results.pageUrl) {
          setCurrentPageUrl(results.pageUrl);
        }
        // Note: Don't clear selections here - SELECTION_UPDATED message follows with correct state
        // This allows selections to persist when re-opening panel
        setEntityFromScanResults(false);
        setPanelMode('scan-results');
        break;
      }
      case 'INVESTIGATION_TOGGLE_ENTITY': {
        // Sync selection from page highlight click
        const { entityId, selected } = data.payload || {};
        if (entityId) {
          setInvestigationEntities(prev => 
            prev.map(e => e.id === entityId ? { ...e, selected } : e)
          );
        }
        break;
      }
      case 'SELECTION_UPDATED': {
        // Sync selection state from content script (highlight checkbox clicks)
        const { selectedItems } = data.payload || {};
        if (Array.isArray(selectedItems)) {
          setSelectedScanItems(new Set(selectedItems));
        } else {
          log.warn(' SELECTION_UPDATED: selectedItems is not an array:', selectedItems);
        }
        break;
      }
      case 'SHOW_UNIFIED_SEARCH_PANEL': {
        // Support initial query from context menu "Search in OpenCTI"
        const initialQuery = data.payload?.initialQuery || '';
        setUnifiedSearchQuery(initialQuery);
        setUnifiedSearchResults([]);
        setPanelMode('unified-search');
        // Auto-trigger search if there's an initial query (from context menu)
        if (initialQuery.trim()) {
          // Small delay to ensure state is set and panel is visible
          setTimeout(() => {
            handleUnifiedSearch(initialQuery);
          }, 100);
        }
        break;
      }
      case 'SHOW_ADD_SELECTION':
        // Context menu "Add to OpenCTI" - show entity creation for selected text
        if (data.payload?.selectedText) {
          setAddSelectionText(data.payload.selectedText);
          setAddSelectionFromContextMenu(true); // Track that we came from context menu
          setPanelMode('add-selection');
        }
        break;
      case 'SHOW_SCENARIO_PANEL': {
        // Initialize scenario creation with attack patterns from the page
        const { attackPatterns, pageTitle, pageUrl, pageDescription, theme: themeFromPayload } = data.payload || {};
        // Set theme if provided
        if (themeFromPayload && (themeFromPayload === 'dark' || themeFromPayload === 'light')) {
          setMode(themeFromPayload);
        }
        
        // Store page info
        setCurrentPageUrl(pageUrl || '');
        setCurrentPageTitle(pageTitle || '');
        
        // Initialize scenario form with page info
        setScenarioForm({
          name: pageTitle || 'New Scenario',
          description: pageDescription || '',
          subtitle: '',
          category: 'attack-scenario',
        });
        
        // Reset scenario state
        setSelectedInjects([]);
        setScenarioStep(0); // Start at affinity selection step
        setScenarioTypeAffinity('ENDPOINT');
        setScenarioPlatformsAffinity(['windows', 'linux', 'macos']);
        setScenarioOverviewData(null);
        
        // Reset AI scenario generation state
        setScenarioAIMode(false);
        setScenarioAIGenerating(false);
        setScenarioAINumberOfInjects(5);
        setScenarioAIPayloadAffinity('powershell');
        setScenarioAITableTopDuration(60);
        setScenarioAIEmailLanguage('english');
        setScenarioAIContext('');
        setScenarioAIGeneratedScenario(null);
        
        // Store raw attack patterns (they have platformId from the scan)
        setScenarioRawAttackPatterns(attackPatterns || []);
        
        // Check how many OpenAEV platforms are configured
        // Use ref to get latest value (avoid stale closure)
        let currentPlatforms = availablePlatformsRef.current;
        
        // If platforms haven't loaded yet, try to fetch them from settings
        if (currentPlatforms.length === 0 && typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
          try {
            const settingsResponse = await new Promise<any>((resolve) => {
              chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, resolve);
            });
            
            if (settingsResponse?.success && settingsResponse.data) {
              // Use openctiPlatforms to match the initial load logic
              const platforms = settingsResponse.data?.openctiPlatforms || settingsResponse.data?.platforms || [];
              const enabledPlatforms = platforms
                .filter((p: any) => p.enabled !== false && p.url && p.apiToken)
                .map((p: any) => ({ 
                  id: p.id, 
                  name: p.name || 'OpenCTI', 
                  url: p.url, 
                  type: 'opencti' as const,
                  isEnterprise: p.isEnterprise, // Include saved EE status
                }));
              
              const oaevPlatformsFromSettings = settingsResponse.data?.openaevPlatforms || [];
              const enabledOAEVPlatforms = oaevPlatformsFromSettings
                .filter((p: any) => p.enabled !== false && p.url && p.apiToken)
                .map((p: any) => ({ 
                  id: p.id, 
                  name: p.name || 'OpenAEV', 
                  url: p.url, 
                  type: 'openaev' as const,
                  isEnterprise: p.isEnterprise, // Include saved EE status
                }));
              
              currentPlatforms = [...enabledPlatforms, ...enabledOAEVPlatforms];
              
              // Update state and ref
              setAvailablePlatforms(currentPlatforms);
              availablePlatformsRef.current = currentPlatforms;
            }
          } catch (error) {
            log.warn(' Failed to fetch platforms:', error);
          }
        }
        
        const oaevPlatforms = currentPlatforms.filter(p => p.type === 'openaev');
        if (oaevPlatforms.length > 1) {
          // Multiple OpenAEV platforms - show platform selection first
          setScenarioPlatformSelected(false);
          setScenarioPlatformId(null);
          setScenarioLoading(false);
          setPanelMode('scenario-overview');
        } else if (oaevPlatforms.length === 1) {
          // Single OpenAEV platform - auto-select and fetch contracts
          const singlePlatformId = oaevPlatforms[0].id;
          setScenarioPlatformSelected(true);
          setScenarioPlatformId(singlePlatformId);
          setSelectedPlatformId(singlePlatformId);
          setPlatformUrl(oaevPlatforms[0].url);
          // Fetch assets, asset groups, and teams for target selection
          if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
            Promise.all([
              chrome.runtime.sendMessage({ type: 'FETCH_OAEV_ASSETS', payload: { platformId: singlePlatformId } }),
              chrome.runtime.sendMessage({ type: 'FETCH_OAEV_ASSET_GROUPS', payload: { platformId: singlePlatformId } }),
              chrome.runtime.sendMessage({ type: 'FETCH_OAEV_TEAMS', payload: { platformId: singlePlatformId } }),
            ]).then(([assetsRes, assetGroupsRes, teamsRes]) => {
              if (assetsRes?.success) setScenarioAssets(assetsRes.data || []);
              if (assetGroupsRes?.success) setScenarioAssetGroups(assetGroupsRes.data || []);
              if (teamsRes?.success) setScenarioTeams(teamsRes.data || []);
            }).catch((error) => {
              log.error(' Failed to fetch scenario targets:', error);
            });
          }
          
          // Reset target selections
          setScenarioSelectedAsset(null);
          setScenarioSelectedAssetGroup(null);
          setScenarioSelectedTeam(null);
          
          // Filter attack patterns to only those from this platform
          // If attack patterns don't have platformId or all have same platformId, include them all
          const filteredPatterns = (attackPatterns || []).filter(
            (ap: any) => !ap.platformId || ap.platformId === singlePlatformId
          );
          // Fetch contracts for filtered attack patterns
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
                setScenarioOverviewData({
                  ...response.data,
                  pageTitle: pageTitle || '',
                  pageUrl: pageUrl || '',
                  pageDescription: pageDescription || '',
                });
                
                // Don't auto-select contracts - let the user choose
                setSelectedInjects([]);
              }
            });
          } else {
            setScenarioOverviewData({
              attackPatterns: [],
              killChainPhases: [],
              pageTitle: pageTitle || '',
              pageUrl: pageUrl || '',
              pageDescription: pageDescription || '',
            });
            setScenarioLoading(false);
            setPanelMode('scenario-overview');
          }
        } else {
          // No OpenAEV platforms configured or not loaded yet
          // Still show the attack patterns from the page so user can see what was detected
          setScenarioPlatformSelected(false);
          setScenarioPlatformId(null);
          
          // Convert raw attack patterns to the format expected by the UI
          const rawPatternsForDisplay = (attackPatterns || []).map((ap: any) => ({
            id: ap.id || ap.entityId,
            name: ap.name,
            externalId: ap.externalId,
            description: ap.description,
            killChainPhases: ap.killChainPhases || [],
            contracts: [], // No contracts available without platform
          }));
          setScenarioOverviewData({
            attackPatterns: rawPatternsForDisplay,
            killChainPhases: [],
            pageTitle: pageTitle || '',
            pageUrl: pageUrl || '',
            pageDescription: pageDescription || '',
          });
          setScenarioLoading(false);
          setPanelMode('scenario-overview');
        }
        break;
      }
      case 'LOADING':
        setPanelMode('loading');
        break;
    }
  };

  // Helper function to sort multi-platform results with OpenCTI platforms first
  // OpenCTI is the knowledge base reference, so it should always be displayed first
  const sortPlatformResults = <T extends { platformId: string }>(results: T[]): T[] => {
    return [...results].sort((a, b) => {
      const platformA = availablePlatforms.find(p => p.id === a.platformId);
      const platformB = availablePlatforms.find(p => p.id === b.platformId);
      const typeA = platformA?.type || 'opencti';
      const typeB = platformB?.type || 'opencti';
      
      // OpenCTI platforms should come before OpenAEV (and other platforms)
      if (typeA === 'opencti' && typeB !== 'opencti') return -1;
      if (typeA !== 'opencti' && typeB === 'opencti') return 1;
      
      // Within the same platform type, maintain original order (stable sort)
      return 0;
    });
  };

  // Unified search handler - searches BOTH OpenCTI and OpenAEV
  // Can optionally pass a query directly (used when auto-searching from context menu)
  const handleUnifiedSearch = async (queryOverride?: string) => {
    const searchQuery = queryOverride ?? unifiedSearchQuery;
    if (!searchQuery.trim()) return;
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
    
    setUnifiedSearching(true);
    const results: UnifiedSearchResult[] = [];

    // Search OpenCTI (all platforms)
    try {
      const octiResponse = await chrome.runtime.sendMessage({
        type: 'SEARCH_PLATFORM',
        payload: { searchTerm: searchQuery, limit: 20, platformType: 'opencti' },
      });

      if (octiResponse?.success && octiResponse.data) {
        for (const result of octiResponse.data) {
          const platformInfo = availablePlatforms.find(p => p.id === result._platformId);
          results.push({
            id: `opencti-${result.id}-${result._platformId}`,
            name: result.representative?.main || result.name || result.value || 'Unknown',
            type: result.entity_type || result.type || 'Unknown',
            description: result.description,
            source: 'opencti',
            platformId: result._platformId,
            platformName: platformInfo?.name || 'OpenCTI',
            entityId: result.id,
            data: result,
          });
        }
      }
    } catch (error) {
      log.warn('OpenCTI search failed:', error);
    }

    // Search OpenAEV (all platforms)
    try {
      const oaevResponse = await chrome.runtime.sendMessage({
        type: 'SEARCH_PLATFORM',
        payload: { searchTerm: searchQuery, platformType: 'openaev' },
      });

      if (oaevResponse?.success && oaevResponse.data) {
        for (const result of oaevResponse.data) {
          const platformInfo = availablePlatforms.find(p => p.id === result._platformId);
          const entityClass = result._entityClass || '';
          const oaevType = getOAEVTypeFromClass(entityClass);
          results.push({
            id: `openaev-${result._id || result.asset_id || result.team_id || result.player_id || Math.random()}-${result._platformId}`,
            name: getOAEVEntityName(result, oaevType),
            type: oaevType,
            description: result.asset_description || result.team_description || result.scenario_description || undefined,
            source: 'openaev',
            platformId: result._platformId,
            platformName: platformInfo?.name || 'OpenAEV',
            entityId: result._id || result.asset_id || result.team_id || result.player_id || '',
            data: result,
          });
        }
      }
    } catch (error) {
      log.warn('OpenAEV search failed:', error);
    }

    setUnifiedSearchResults(results);
    setUnifiedSearching(false);
  };

  const handleClose = () => {
    window.parent.postMessage({ type: 'XTM_CLOSE_PANEL' }, '*');
  };

  const handleOpenInPlatform = (entityId: string, draftId?: string) => {
    if (platformUrl && entityId) {
      // If entity was created as draft, navigate to draft workspace
      const url = draftId 
        ? `${platformUrl}/dashboard/data/import/draft/${draftId}`
        : `${platformUrl}/dashboard/id/${entityId}`;
      window.open(url, '_blank');
    }
  };

  const handleCopyValue = (value: string) => {
    window.parent.postMessage({ type: 'XTM_COPY_TO_CLIPBOARD', payload: value }, '*');
  };

  const handleAddEntities = async () => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
    
    // Check if we have any OpenCTI platforms - observables can only be created in OpenCTI
    if (openctiPlatforms.length === 0) {
      const results: ImportResults = {
        success: false,
        total: entitiesToAdd.length,
        created: [],
        failed: entitiesToAdd.map(e => ({
          type: e.type || 'unknown',
          value: e.value || e.name || 'unknown',
          error: 'No OpenCTI platform configured. Observables can only be created in OpenCTI.',
        })),
        platformName: 'OpenCTI',
      };
      setImportResults(results);
      setPanelMode('import-results');
      return;
    }
    
    setSubmitting(true);
    
    // Always use an OpenCTI platform for observable creation
    // Check if selectedPlatformId is an OpenCTI platform, otherwise use first OpenCTI platform
    const selectedIsOpenCTI = openctiPlatforms.some(p => p.id === selectedPlatformId);
    const targetPlatformId = selectedIsOpenCTI ? selectedPlatformId : openctiPlatforms[0].id;
    const targetPlatform = openctiPlatforms.find(p => p.id === targetPlatformId) || openctiPlatforms[0];
    
    const response = await chrome.runtime.sendMessage({
      type: 'CREATE_OBSERVABLES_BULK',
      payload: { 
        entities: entitiesToAdd,
        platformId: targetPlatformId,
        createIndicator: createIndicators,
      },
    });

    if (chrome.runtime.lastError) {
      setSubmitting(false);
      return;
    }

    if (response?.success && response.data) {
      // Build import results from the response
      const createdEntities = response.data as Array<{ id: string; entity_type?: string; observable_value?: string; value?: string; type?: string }>;
      
      const results: ImportResults = {
        success: true,
        total: entitiesToAdd.length,
        created: createdEntities.map((e, i) => ({
          id: e.id,
          type: e.entity_type || e.type || entitiesToAdd[i]?.type || 'unknown',
          value: e.observable_value || e.value || entitiesToAdd[i]?.value || entitiesToAdd[i]?.name || 'unknown',
        })),
        failed: [],
        platformName: targetPlatform.name,
      };
      
      setImportResults(results);
      setPanelMode('import-results');
      setEntitiesToAdd([]);
    } else {
      // Handle error case
      const results: ImportResults = {
        success: false,
        total: entitiesToAdd.length,
        created: [],
        failed: entitiesToAdd.map(e => ({
          type: e.type || 'unknown',
          value: e.value || e.name || 'unknown',
          error: response?.error || 'Failed to create entity',
        })),
        platformName: targetPlatform.name,
      };
      
      setImportResults(results);
      setPanelMode('import-results');
    }
    setSubmitting(false);
  };

  // AI-powered description generation for containers
  const handleGenerateAIDescription = async () => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
    
    // Get the selected OpenCTI platform to check enterprise status
    const selectedIsOpenCTI = openctiPlatforms.some(p => p.id === selectedPlatformId);
    const targetPlatformId = selectedIsOpenCTI ? selectedPlatformId : openctiPlatforms[0]?.id;
    const targetPlatform = availablePlatforms.find(p => p.id === targetPlatformId);
    
    // Validate AI and enterprise requirements
    if (!aiSettings.available) {
      log.warn(' AI is not configured');
      return;
    }
    if (!targetPlatform?.isEnterprise) {
      log.warn(' AI features require Enterprise Edition');
      return;
    }
    
    setAiGeneratingDescription(true);
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'AI_GENERATE_DESCRIPTION',
        payload: {
          pageTitle: currentPageTitle,
          pageUrl: currentPageUrl,
          pageContent: containerForm.content || '',
          containerType,
          containerName: containerForm.name,
          detectedEntities: entitiesToAdd.map(e => e.name || e.value).filter(Boolean),
        },
      });
      
      if (response?.success && response.data) {
        setContainerForm(prev => ({ ...prev, description: response.data }));
        showToast({ type: 'success', message: 'AI generated description' });
      } else {
        log.error(' AI description generation failed:', response?.error);
        showToast({ type: 'error', message: 'AI description generation failed' });
      }
    } catch (error) {
      log.error(' AI description generation error:', error);
      showToast({ type: 'error', message: 'AI description generation error' });
    } finally {
      setAiGeneratingDescription(false);
    }
  };

  const handleCreateContainer = async () => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
    
    setSubmitting(true);
    
    // Generate PDF if option is enabled
    let pdfData: { data: string; filename: string } | null = null;
    if (attachPdf) {
      setGeneratingPdf(true);
      try {
        // Get active tab and request PDF generation from content script
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          const pdfResponse = await chrome.tabs.sendMessage(tab.id, { type: 'GENERATE_PDF' });
          if (pdfResponse?.success && pdfResponse.data) {
            pdfData = pdfResponse.data;
          } else {
            log.warn(' PDF generation failed:', pdfResponse?.error);
          }
        }
      } catch (error) {
        log.error(' Failed to generate PDF:', error);
      }
      setGeneratingPdf(false);
    }
    
    // Separate entities that exist (have IDs) from those that need to be created
    // Keep track of indices for relationship mapping
    const existingEntitiesWithIndex = entitiesToAdd
      .map((e, originalIndex) => ({ entity: e, originalIndex }))
      .filter(({ entity }) => entity.id);
    const entitiesToCreateWithIndex = entitiesToAdd
      .map((e, originalIndex) => ({ entity: e, originalIndex }))
      .filter(({ entity }) => !entity.id && (entity.value || entity.observable_value));
    
    const existingEntityIds = existingEntitiesWithIndex.map(({ entity }) => entity.id as string);
    const entitiesToCreate = entitiesToCreateWithIndex.map(({ entity }) => ({
      type: entity.type || entity.entity_type || 'Unknown',
      value: entity.value || entity.observable_value || entity.name || '',
    }));
    
    // Build a mapping from original entity index to the combined array index
    // Combined array = existingEntityIds + entitiesToCreate (in that order)
    const indexMapping: Record<number, number> = {};
    existingEntitiesWithIndex.forEach(({ originalIndex }, idx) => {
      indexMapping[originalIndex] = idx;
    });
    entitiesToCreateWithIndex.forEach(({ originalIndex }, idx) => {
      indexMapping[originalIndex] = existingEntityIds.length + idx;
    });
    
    // Map resolved relationships to use combined array indices
    const relationshipsToCreate = resolvedRelationships.map(rel => ({
      fromEntityIndex: indexMapping[rel.fromIndex] ?? -1,
      toEntityIndex: indexMapping[rel.toIndex] ?? -1,
      relationship_type: rel.relationshipType,
      description: rel.reason,
    })).filter(rel => rel.fromEntityIndex >= 0 && rel.toEntityIndex >= 0);
    
    const response = await chrome.runtime.sendMessage({
      type: 'CREATE_CONTAINER',
      payload: {
        type: containerType,
        name: containerForm.name,
        description: containerForm.description,
        content: containerForm.content,
        labels: selectedLabels.map((l) => l.id),
        markings: selectedMarkings.map((m) => m.id),
        entities: existingEntityIds,
        entitiesToCreate: entitiesToCreate,
        platformId: selectedPlatformId || undefined,
        pdfAttachment: pdfData,
        pageUrl: currentPageUrl,
        pageTitle: currentPageTitle,
        // Type-specific fields
        report_types: containerSpecificFields.report_types.length > 0 ? containerSpecificFields.report_types : undefined,
        context: containerSpecificFields.context || undefined,
        severity: containerSpecificFields.severity || undefined,
        priority: containerSpecificFields.priority || undefined,
        response_types: containerSpecificFields.response_types.length > 0 ? containerSpecificFields.response_types : undefined,
        createdBy: containerSpecificFields.createdBy || undefined,
        // Draft mode
        createAsDraft: createAsDraft,
        // Relationships from AI resolution
        relationshipsToCreate: relationshipsToCreate.length > 0 ? relationshipsToCreate : undefined,
        // Update mode: pass the existing container ID and dates to avoid duplicates
        updateContainerId: updatingContainerId || undefined,
        // For Reports, use 'published'; for other containers, use 'created'
        published: updatingContainerId && containerType === 'Report' ? updatingContainerDates?.published : undefined,
        created: updatingContainerId && containerType !== 'Report' ? updatingContainerDates?.created : undefined,
      },
    });

    if (chrome.runtime.lastError) {
      log.error(' Container creation failed:', chrome.runtime.lastError);
      showToast({ type: 'error', message: 'Container creation failed' });
      setSubmitting(false);
      return;
    }

    if (response?.success && response.data) {
      // Show the created container in the panel
      const createdContainer = response.data;
      const createdPlatformId = createdContainer._platformId || selectedPlatformId;
      
      // Update platform URL if needed
      if (createdPlatformId) {
        const platform = availablePlatforms.find(p => p.id === createdPlatformId);
        if (platform) {
          setPlatformUrl(platform.url);
          setSelectedPlatformId(platform.id);
        }
      }
      
      // Set entity to the created container and show entity view
      // Use data from the API response if available, otherwise use form data
      setEntity({
        id: createdContainer.id,
        entity_type: createdContainer.entity_type || containerType,
        type: createdContainer.entity_type || containerType, // Also set 'type' for consistency
        name: createdContainer.name || containerForm.name,
        description: createdContainer.description || containerForm.description,
        created: createdContainer.created,
        modified: createdContainer.modified,
        createdBy: createdContainer.createdBy,
        objectLabel: createdContainer.objectLabel,
        objectMarking: createdContainer.objectMarking,
        existsInPlatform: true,
        _platformId: createdPlatformId,
        _platformType: 'opencti', // Explicitly mark as OpenCTI entity
        _isNonDefaultPlatform: false, // Not a non-default platform
        _draftId: createdContainer.draftId, // Draft ID if created as draft
      });
      setEntityContainers([]);
      setPanelMode('entity');
      
      // Show success notification
      const actionText = updatingContainerId ? 'updated' : 'created';
      showToast({ type: 'success', message: `${containerType} ${actionText} successfully` });
      
      // Reset form
      setContainerForm({ name: '', description: '', content: '' });
      setEntitiesToAdd([]);
      setContainerWorkflowOrigin(null);
      setAttachPdf(true); // Reset PDF option
      setCreateAsDraft(false); // Reset draft option
      setUpdatingContainerId(null); // Reset update mode
      setUpdatingContainerDates(null); // Reset update dates
    } else {
      log.error(' Container creation failed:', response?.error);
      showToast({ type: 'error', message: response?.error || 'Container creation failed' });
    }
    setSubmitting(false);
  };

  const logoSuffix = mode === 'dark' ? 'dark-theme' : 'light-theme';
  
  const renderHeader = () => (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        p: 2,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <img
          src={`../assets/logos/logo_filigran_${logoSuffix}_embleme_square.svg`}
          alt="XTM"
          width={28}
          height={28}
        />
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
          <Typography variant="h5" sx={{ fontWeight: 600, fontSize: 20, color: mode === 'dark' ? '#ffffff' : '#1a1a2e' }}>
            Filigran Threat Management
          </Typography>
        </Box>
      </Box>
      <IconButton size="small" onClick={handleClose} sx={{ color: mode === 'dark' ? '#ffffff' : 'text.primary' }}>
        <CloseOutlined fontSize="small" />
      </IconButton>
    </Box>
  );

  // Helper to detect entity type from text (for add-selection)
  const detectEntityType = (text: string): string => {
    const trimmed = text.trim();
    // IPv4
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(trimmed)) return 'IPv4-Addr';
    // IPv6 (simplified)
    if (/^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(trimmed) || 
        /^([0-9a-fA-F]{1,4}:){1,7}:$/.test(trimmed) ||
        /^:(:([0-9a-fA-F]{1,4})){1,7}$/.test(trimmed) ||
        /^([0-9a-fA-F]{1,4}:)+(:([0-9a-fA-F]{1,4})){1,6}$/.test(trimmed)) return 'IPv6-Addr';
    // Domain
    if (/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/.test(trimmed)) return 'Domain-Name';
    // URL
    if (/^https?:\/\//i.test(trimmed)) return 'Url';
    // Email
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return 'Email-Addr';
    // CVE
    if (/^CVE-\d{4}-\d+$/i.test(trimmed)) return 'Vulnerability';
    // MD5
    if (/^[a-fA-F0-9]{32}$/.test(trimmed)) return 'StixFile';
    // SHA-1
    if (/^[a-fA-F0-9]{40}$/.test(trimmed)) return 'StixFile';
    // SHA-256
    if (/^[a-fA-F0-9]{64}$/.test(trimmed)) return 'StixFile';
    // SHA-512
    if (/^[a-fA-F0-9]{128}$/.test(trimmed)) return 'StixFile';
    // MITRE ATT&CK
    if (/^T\d{4}(\.\d{3})?$/.test(trimmed)) return 'Attack-Pattern';
    // Default to unknown - user must select
    return '';
  };

  const [addSelectionEntityType, setAddSelectionEntityType] = useState('');
  const [addingSelection, setAddingSelection] = useState(false);
  const [addSelectionFromContextMenu, setAddSelectionFromContextMenu] = useState(false);

  const handleAddSelection = async () => {
    if (!addSelectionText || !addSelectionEntityType) return;
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;

    setAddingSelection(true);

    try {
      // Use first OpenCTI platform
      const platformId = openctiPlatforms[0]?.id;
      if (!platformId) {
        log.error('No OpenCTI platform available');
        setAddingSelection(false);
        return;
      }

      const response = await chrome.runtime.sendMessage({
        type: 'CREATE_ENTITY',
        payload: {
          type: addSelectionEntityType,
          value: addSelectionText.trim(),
          name: addSelectionText.trim(),
          platformId,
        },
      });

      if (response?.success && response.data) {
        // Show the created entity
        setEntity({
          ...response.data,
          existsInPlatform: true,
          _platformType: 'opencti',
        });
        setPlatformUrl(openctiPlatforms[0]?.url || '');
        setSelectedPlatformId(platformId);
        setPanelMode('entity');
        setAddSelectionText('');
        setAddSelectionEntityType('');
        setAddSelectionFromContextMenu(false);
        showToast({ type: 'success', message: 'Entity created successfully' });
      } else {
        log.error('Failed to create entity:', response?.error);
        showToast({ type: 'error', message: response?.error || 'Failed to create entity' });
      }
    } catch (error) {
      log.error('Error creating entity:', error);
      showToast({ type: 'error', message: 'Error creating entity' });
    }

    setAddingSelection(false);
  };

  // Auto-detect type when addSelectionText changes
  React.useEffect(() => {
    if (addSelectionText) {
      const detected = detectEntityType(addSelectionText);
      setAddSelectionEntityType(detected);
    }
  }, [addSelectionText]);

  // Container creation is OpenCTI-only, so only count OpenCTI platforms
  const containerSteps = openctiPlatforms.length > 1 
    ? ['Select Platform', 'Select Type', 'Configure Details']
    : ['Select Type', 'Configure Details'];

  // Handle investigation scan - only show existing entities for selected platform
  const handleInvestigationScan = async (platformId?: string) => {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;
    
    const targetPlatformId = platformId || investigationPlatformId;
    // Investigation is OpenCTI-only, so check openctiPlatforms
    if (!targetPlatformId && openctiPlatforms.length > 1) {
      log.error(' No platform selected for investigation');
      return;
    }
    
    setInvestigationScanning(true);
    setInvestigationEntities([]);
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        // Send scan request with platform ID for filtering (use first OpenCTI platform if none selected)
        chrome.tabs.sendMessage(tab.id, { 
          type: 'SCAN_FOR_INVESTIGATION',
          payload: { platformId: targetPlatformId || openctiPlatforms[0]?.id },
        });
      }
    } catch (error) {
      log.error(' Investigation scan failed:', error);
    }
  };

  // Select platform for investigation and start scan
  const handleSelectInvestigationPlatform = (platformId: string) => {
    setInvestigationPlatformId(platformId);
    setInvestigationPlatformSelected(true);
    handleInvestigationScan(platformId);
  };

  // Handle creating workbench
  const handleCreateWorkbench = async () => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
    
    const selectedEntities = investigationEntities.filter(e => e.selected);
    if (selectedEntities.length === 0) return;
    
    setSubmitting(true);
    
    // Get page info for workbench name
    let workbenchName = 'Investigation';
    let currentTab: chrome.tabs.Tab | undefined;
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      currentTab = tab;
      if (tab?.title) {
        workbenchName = tab.title;
      }
    } catch (e) {
      // Use default name
    }
    
    // Extract entity IDs - make sure they're valid
    const entityIds = selectedEntities
      .map(e => e.id)
      .filter(id => id && id.length > 0);
    const response = await chrome.runtime.sendMessage({
      type: 'CREATE_WORKBENCH',
      payload: {
        name: workbenchName,
        description: `Investigation created from XTM Browser Extension with ${entityIds.length} entities`,
        entityIds,
        platformId: selectedPlatformId || availablePlatforms[0]?.id,
      },
    });
    
    if (response?.success && response.data?.url) {
      // Open workbench in new tab
      chrome.tabs.create({ url: response.data.url });
      
      // Clear highlights and close panel on the page
      if (currentTab?.id) {
        chrome.tabs.sendMessage(currentTab.id, { type: 'CLEAR_HIGHLIGHTS' });
        chrome.tabs.sendMessage(currentTab.id, { type: 'HIDE_PANEL' });
      }
      
      // Reset investigation state
      setInvestigationEntities([]);
      setInvestigationTypeFilter('all');
      setPanelMode('empty');
      showToast({ type: 'success', message: 'Workbench created successfully' });
    } else {
      log.error(' Failed to create workbench:', response?.error);
      showToast({ type: 'error', message: response?.error || 'Failed to create workbench' });
    }
    
    setSubmitting(false);
  };

  // Toggle entity selection for investigation
  const toggleInvestigationEntity = async (entityId: string) => {
    const entity = investigationEntities.find(e => e.id === entityId);
    const newSelected = entity ? !entity.selected : true;
    
    setInvestigationEntities(prev => 
      prev.map(e => e.id === entityId ? { ...e, selected: newSelected } : e)
    );
    
    // Sync with page highlights
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { 
          type: 'INVESTIGATION_SYNC_SELECTION',
          payload: { entityId, selected: newSelected },
        });
      }
    }
  };

  // Select all investigation entities (filtered or all)
  const selectAllInvestigationEntities = async () => {
    const filteredIds = filteredInvestigationEntities.map(e => e.id);
    setInvestigationEntities(prev => prev.map(e => 
      filteredIds.includes(e.id) ? { ...e, selected: true } : e
    ));
    
    // Sync with page
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { 
          type: 'INVESTIGATION_SYNC_ALL',
          payload: { entityIds: filteredIds, selected: true },
        });
      }
    }
  };

  // Clear investigation selection
  const clearInvestigationSelection = async () => {
    const filteredIds = filteredInvestigationEntities.map(e => e.id);
    setInvestigationEntities(prev => prev.map(e => 
      filteredIds.includes(e.id) ? { ...e, selected: false } : e
    ));
    
    // Sync with page
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { 
          type: 'INVESTIGATION_SYNC_ALL',
          payload: { entityIds: filteredIds, selected: false },
        });
      }
    }
  };

  // Reset investigation state helper (wraps hook's reset and also sets panel mode)
  const resetInvestigation = () => {
    resetInvestigationState();
    setPanelMode('empty');
    // Clear highlights
    chrome.tabs?.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { type: 'CLEAR_HIGHLIGHTS' });
      }
    });
  };

  // ============================================================================
  // Atomic Testing Mode (OpenAEV)
  // ============================================================================
  
  // Atomic testing state is now provided by useAtomicTestingState hook
  
  // Get OpenAEV platforms only
  const openaevPlatforms = React.useMemo(() => 
    availablePlatforms.filter(p => p.type === 'openaev'), 
    [availablePlatforms]
  );
  
  // Atomic testing handlers are now in OAEVAtomicTestingView component
  // NOTE: All atomic testing functions (handleSelectAtomicTestingPlatform, handleCreateAtomicTesting,
  //       handleCreateAtomicTestingWithAIPayload, handleGenerateAIPayload, handleSelectAtomicTargetFromList,
  //       and renderAtomicTestingView) have been moved to OAEVAtomicTestingView component.
  
  // NOTE: Scenario functions (handleCreateScenario, handleSelectScenarioPlatform) have been moved
  // to OAEVScenarioView component. See: src/panel/views/OAEVScenarioView.tsx

  // NOTE: REMOVED handleCreateScenario function (moved to OAEVScenarioView)
  // NOTE: renderScenarioOverviewView and renderScenarioFormView have been extracted
  // to OAEVScenarioView component to reduce App.tsx file size.
  // See: src/panel/views/OAEVScenarioView.tsx

  const renderContent = () => {
    switch (panelMode) {
      case 'entity': {
        // Check if this is a non-default platform entity
        const entityType = (entity as any)?.type || '';
        const isNonDefaultPlatformEntity = (entity as any)?._isNonDefaultPlatform || 
          (entity as any)?._platformType !== 'opencti' ||
          parsePrefixedType(entityType) !== null;
        
        if (isNonDefaultPlatformEntity) {
          return (
            <OAEVEntityView
              mode={mode}
              entity={entity}
              setEntity={setEntity}
              availablePlatforms={availablePlatforms}
              multiPlatformResults={multiPlatformResults}
              setMultiPlatformResults={setMultiPlatformResults}
              currentPlatformIndex={currentPlatformIndex}
              setCurrentPlatformIndex={setCurrentPlatformIndex}
              currentPlatformIndexRef={currentPlatformIndexRef}
              multiPlatformResultsRef={multiPlatformResultsRef}
              setPlatformUrl={setPlatformUrl}
              setSelectedPlatformId={setSelectedPlatformId}
              entityFromSearchMode={entityFromSearchMode}
              setEntityFromSearchMode={setEntityFromSearchMode}
              entityFromScanResults={entityFromScanResults}
              setEntityFromScanResults={setEntityFromScanResults}
              setPanelMode={setPanelMode}
              handleCopyValue={handleCopyValue}
            />
          );
        }
        
        return (
          <OCTIEntityView
            mode={mode}
            entity={entity}
            setEntity={setEntity}
            entityContainers={entityContainers}
            loadingContainers={loadingContainers}
            availablePlatforms={availablePlatforms}
            multiPlatformResults={multiPlatformResults}
            setMultiPlatformResults={setMultiPlatformResults}
            currentPlatformIndex={currentPlatformIndex}
            setCurrentPlatformIndex={setCurrentPlatformIndex}
            currentPlatformIndexRef={currentPlatformIndexRef}
            multiPlatformResultsRef={multiPlatformResultsRef}
            platformUrl={platformUrl}
            setPlatformUrl={setPlatformUrl}
            selectedPlatformId={selectedPlatformId}
            setSelectedPlatformId={setSelectedPlatformId}
            entityFromSearchMode={entityFromSearchMode}
            setEntityFromSearchMode={setEntityFromSearchMode}
            entityFromScanResults={entityFromScanResults}
            setEntityFromScanResults={setEntityFromScanResults}
            setPanelMode={setPanelMode}
            handleCopyValue={handleCopyValue}
            handleOpenInPlatform={handleOpenInPlatform}
          />
        );
      }
      case 'not-found':
        return (
          <CommonNotFoundView
            entity={entity}
            mode={mode}
            entityFromScanResults={entityFromScanResults}
            setEntityFromScanResults={setEntityFromScanResults}
            setPanelMode={setPanelMode}
            setEntitiesToAdd={setEntitiesToAdd}
          />
        );
      case 'add':
        return (
          <OCTIAddView
            setPanelMode={setPanelMode}
            entitiesToAdd={entitiesToAdd}
            handleAddEntities={handleAddEntities}
            submitting={submitting}
          />
        );
      case 'import-results':
        return (
          <OCTIImportResultsView
            mode={mode}
            importResults={importResults}
            setImportResults={setImportResults}
            handleClose={handleClose}
            logoSuffix={logoSuffix}
          />
        );
      case 'preview':
        return (
          <CommonPreviewView
            mode={mode}
            setPanelMode={setPanelMode}
            entitiesToAdd={entitiesToAdd}
            setEntitiesToAdd={setEntitiesToAdd}
            setSelectedScanItems={setSelectedScanItems}
            createIndicators={createIndicators}
            setCreateIndicators={setCreateIndicators}
            resolvedRelationships={resolvedRelationships}
            setResolvedRelationships={setResolvedRelationships}
            aiSettings={aiSettings}
            aiResolvingRelationships={aiResolvingRelationships}
            setAiResolvingRelationships={setAiResolvingRelationships}
            availablePlatforms={availablePlatforms}
            openctiPlatforms={openctiPlatforms}
            selectedPlatformId={selectedPlatformId}
            setSelectedPlatformId={setSelectedPlatformId}
            setPlatformUrl={setPlatformUrl}
            setContainerWorkflowOrigin={setContainerWorkflowOrigin}
            setExistingContainers={setExistingContainers}
            setCheckingExisting={setCheckingExisting}
            currentPageUrl={currentPageUrl}
            currentPageTitle={currentPageTitle}
            scanPageContent={scanPageContent}
            showToast={showToast}
            handleAddEntities={handleAddEntities}
            submitting={submitting}
          />
        );
      case 'platform-select':
        return (
          <CommonPlatformSelectView
            mode={mode}
            setPanelMode={setPanelMode}
            openctiPlatforms={openctiPlatforms}
            selectedPlatformId={selectedPlatformId}
            setSelectedPlatformId={setSelectedPlatformId}
            setPlatformUrl={setPlatformUrl}
            containerWorkflowOrigin={containerWorkflowOrigin}
            setContainerWorkflowOrigin={setContainerWorkflowOrigin}
            containerSteps={containerSteps}
            entitiesToAdd={entitiesToAdd}
            handleAddEntities={handleAddEntities}
            logoSuffix={logoSuffix}
          />
        );
      case 'existing-containers':
        return (
          <OCTIExistingContainersView
            mode={mode}
            existingContainers={existingContainers}
            selectedPlatformId={selectedPlatformId}
            setSelectedPlatformId={setSelectedPlatformId}
            availablePlatforms={availablePlatforms}
            openctiPlatforms={openctiPlatforms}
            setPlatformUrl={setPlatformUrl}
            setPanelMode={setPanelMode}
            setEntity={setEntity}
            setMultiPlatformResults={setMultiPlatformResults}
            setCurrentPlatformIndex={setCurrentPlatformIndex}
            setEntityContainers={setEntityContainers}
            fetchEntityContainers={fetchEntityContainers}
            setUpdatingContainerId={setUpdatingContainerId}
            setContainerType={setContainerType}
            setContainerForm={setContainerForm}
            setSelectedLabels={setSelectedLabels}
            setSelectedMarkings={setSelectedMarkings}
            containerSpecificFields={containerSpecificFields}
            setContainerSpecificFields={setContainerSpecificFields}
            setUpdatingContainerDates={setUpdatingContainerDates}
            loadLabelsAndMarkings={loadLabelsAndMarkings}
            formatDate={formatDate}
          />
        );
      case 'container-type':
        return (
          <OCTIContainerTypeView
            mode={mode}
            setPanelMode={setPanelMode}
            setContainerType={setContainerType}
            containerWorkflowOrigin={containerWorkflowOrigin}
            openctiPlatformsCount={openctiPlatforms.length}
            containerSteps={containerSteps}
            entitiesToAdd={entitiesToAdd}
          />
        );
      case 'container-form':
        return (
          <OCTIContainerFormView
            mode={mode}
            setPanelMode={setPanelMode}
            containerType={containerType}
            containerSteps={containerSteps}
            containerForm={containerForm}
            setContainerForm={setContainerForm}
            containerSpecificFields={containerSpecificFields}
            setContainerSpecificFields={setContainerSpecificFields}
            updatingContainerId={updatingContainerId}
            availablePlatforms={availablePlatforms}
            openctiPlatforms={openctiPlatforms}
            selectedPlatformId={selectedPlatformId}
            aiSettings={aiSettings}
            aiGeneratingDescription={aiGeneratingDescription}
            handleGenerateAIDescription={handleGenerateAIDescription}
            availableLabels={availableLabels}
            selectedLabels={selectedLabels}
            setSelectedLabels={setSelectedLabels}
            availableMarkings={availableMarkings}
            selectedMarkings={selectedMarkings}
            setSelectedMarkings={setSelectedMarkings}
            availableReportTypes={availableReportTypes}
            availableContexts={availableContexts}
            availableSeverities={availableSeverities}
            availablePriorities={availablePriorities}
            availableResponseTypes={availableResponseTypes}
            availableAuthors={availableAuthors}
            attachPdf={attachPdf}
            setAttachPdf={setAttachPdf}
            createAsDraft={createAsDraft}
            setCreateAsDraft={setCreateAsDraft}
            entitiesToAdd={entitiesToAdd}
            handleCreateContainer={handleCreateContainer}
            submitting={submitting}
            generatingPdf={generatingPdf}
          />
        );
      case 'investigation':
        return (
          <OCTIInvestigationView
            mode={mode}
            openctiPlatforms={openctiPlatforms}
            availablePlatforms={availablePlatforms}
            investigationPlatformId={investigationPlatformId}
            investigationPlatformSelected={investigationPlatformSelected}
            setInvestigationPlatformSelected={setInvestigationPlatformSelected}
            investigationEntities={investigationEntities}
            setInvestigationEntities={setInvestigationEntities}
            investigationScanning={investigationScanning}
            investigationTypeFilter={investigationTypeFilter}
            setInvestigationTypeFilter={setInvestigationTypeFilter}
            investigationEntityTypes={investigationEntityTypes}
            filteredInvestigationEntities={filteredInvestigationEntities}
            selectedInvestigationCount={selectedInvestigationCount}
            submitting={submitting}
            resetInvestigation={resetInvestigation}
            handleSelectInvestigationPlatform={handleSelectInvestigationPlatform}
            handleInvestigationScan={handleInvestigationScan}
            toggleInvestigationEntity={toggleInvestigationEntity}
            selectAllInvestigationEntities={selectAllInvestigationEntities}
            clearInvestigationSelection={clearInvestigationSelection}
            handleCreateWorkbench={handleCreateWorkbench}
          />
        );
      case 'scan-results':
        return (
          <CommonScanResultsView
            mode={mode}
            handleClose={handleClose}
            scanResultsEntities={scanResultsEntities}
            setScanResultsEntities={setScanResultsEntities}
            scanResultsEntitiesRef={scanResultsEntitiesRef}
            scanResultsTypeFilter={scanResultsTypeFilter}
            setScanResultsTypeFilter={setScanResultsTypeFilter}
            scanResultsFoundFilter={scanResultsFoundFilter}
            setScanResultsFoundFilter={setScanResultsFoundFilter}
            selectedScanItems={selectedScanItems}
            setSelectedScanItems={setSelectedScanItems}
            setPanelMode={setPanelMode}
            setEntitiesToAdd={setEntitiesToAdd}
            setEntity={setEntity}
            setMultiPlatformResults={setMultiPlatformResults}
            setCurrentPlatformIndex={setCurrentPlatformIndex}
            setEntityFromScanResults={setEntityFromScanResults}
            currentPlatformIndexRef={currentPlatformIndexRef}
            multiPlatformResultsRef={multiPlatformResultsRef}
            aiSettings={aiSettings}
            aiDiscoveringEntities={aiDiscoveringEntities}
            setAiDiscoveringEntities={setAiDiscoveringEntities}
            availablePlatforms={availablePlatforms}
            openctiPlatforms={openctiPlatforms}
            openaevPlatforms={openaevPlatforms}
            selectedPlatformId={selectedPlatformId}
            setSelectedPlatformId={setSelectedPlatformId}
            platformUrl={platformUrl}
            setPlatformUrl={setPlatformUrl}
            showToast={showToast}
            setContainerForm={setContainerForm}
            currentPageTitle={currentPageTitle}
            currentPageUrl={currentPageUrl}
            setCurrentPageUrl={setCurrentPageUrl}
            setCurrentPageTitle={setCurrentPageTitle}
            scanPageContent={scanPageContent}
            logoSuffix={logoSuffix}
          />
        );
      case 'atomic-testing':
        return (
          <OAEVAtomicTestingView
            mode={mode}
            availablePlatforms={availablePlatforms}
            aiSettings={aiSettings}
            setPanelMode={setPanelMode}
            showToast={showToast}
            atomicTestingTargets={atomicTestingTargets}
            setAtomicTestingTargets={setAtomicTestingTargets}
            selectedAtomicTarget={selectedAtomicTarget}
            setSelectedAtomicTarget={setSelectedAtomicTarget}
            atomicTestingShowList={atomicTestingShowList}
            setAtomicTestingShowList={setAtomicTestingShowList}
            atomicTestingPlatformId={atomicTestingPlatformId}
            setAtomicTestingPlatformId={setAtomicTestingPlatformId}
            atomicTestingPlatformSelected={atomicTestingPlatformSelected}
            setAtomicTestingPlatformSelected={setAtomicTestingPlatformSelected}
            atomicTestingTargetType={atomicTestingTargetType}
            setAtomicTestingTargetType={setAtomicTestingTargetType}
            atomicTestingAssets={atomicTestingAssets}
            setAtomicTestingAssets={setAtomicTestingAssets}
            atomicTestingAssetGroups={atomicTestingAssetGroups}
            setAtomicTestingAssetGroups={setAtomicTestingAssetGroups}
            atomicTestingTypeFilter={atomicTestingTypeFilter}
            setAtomicTestingTypeFilter={setAtomicTestingTypeFilter}
            atomicTestingInjectorContracts={atomicTestingInjectorContracts}
            setAtomicTestingInjectorContracts={setAtomicTestingInjectorContracts}
            atomicTestingSelectedAsset={atomicTestingSelectedAsset}
            setAtomicTestingSelectedAsset={setAtomicTestingSelectedAsset}
            atomicTestingSelectedAssetGroup={atomicTestingSelectedAssetGroup}
            setAtomicTestingSelectedAssetGroup={setAtomicTestingSelectedAssetGroup}
            atomicTestingSelectedContract={atomicTestingSelectedContract}
            setAtomicTestingSelectedContract={setAtomicTestingSelectedContract}
            atomicTestingTitle={atomicTestingTitle}
            setAtomicTestingTitle={setAtomicTestingTitle}
            atomicTestingCreating={atomicTestingCreating}
            setAtomicTestingCreating={setAtomicTestingCreating}
            atomicTestingLoadingAssets={atomicTestingLoadingAssets}
            setAtomicTestingLoadingAssets={setAtomicTestingLoadingAssets}
            atomicTestingAIMode={atomicTestingAIMode}
            setAtomicTestingAIMode={setAtomicTestingAIMode}
            atomicTestingAIGenerating={atomicTestingAIGenerating}
            setAtomicTestingAIGenerating={setAtomicTestingAIGenerating}
            atomicTestingAIPlatform={atomicTestingAIPlatform}
            setAtomicTestingAIPlatform={setAtomicTestingAIPlatform}
            atomicTestingAIExecutor={atomicTestingAIExecutor}
            setAtomicTestingAIExecutor={setAtomicTestingAIExecutor}
            atomicTestingAIContext={atomicTestingAIContext}
            setAtomicTestingAIContext={setAtomicTestingAIContext}
            atomicTestingAIGeneratedPayload={atomicTestingAIGeneratedPayload}
            setAtomicTestingAIGeneratedPayload={setAtomicTestingAIGeneratedPayload}
            resetAtomicTestingState={resetAtomicTestingState}
          />
        );
      case 'unified-search':
        return (
          <CommonUnifiedSearchView
            mode={mode}
            unifiedSearchQuery={unifiedSearchQuery}
            setUnifiedSearchQuery={setUnifiedSearchQuery}
            unifiedSearchResults={unifiedSearchResults}
            setUnifiedSearchResults={setUnifiedSearchResults}
            unifiedSearching={unifiedSearching}
            setUnifiedSearching={setUnifiedSearching}
            unifiedSearchPlatformFilter={unifiedSearchPlatformFilter}
            setUnifiedSearchPlatformFilter={setUnifiedSearchPlatformFilter}
            setPanelMode={setPanelMode}
            setEntity={setEntity}
            setEntityFromSearchMode={setEntityFromSearchMode}
            setMultiPlatformResults={setMultiPlatformResults}
            setCurrentPlatformIndex={setCurrentPlatformIndex}
            currentPlatformIndexRef={currentPlatformIndexRef}
            multiPlatformResultsRef={multiPlatformResultsRef}
            availablePlatforms={availablePlatforms}
            logoSuffix={logoSuffix}
          />
        );
      case 'add-selection':
        return (
          <OCTIAddSelectionView
            setPanelMode={setPanelMode}
            addSelectionText={addSelectionText}
            setAddSelectionText={setAddSelectionText}
            addSelectionEntityType={addSelectionEntityType}
            setAddSelectionEntityType={setAddSelectionEntityType}
            addSelectionFromContextMenu={addSelectionFromContextMenu}
            setAddSelectionFromContextMenu={setAddSelectionFromContextMenu}
            addingSelection={addingSelection}
            handleAddSelection={handleAddSelection}
            openctiPlatforms={openctiPlatforms}
          />
        );
      case 'scenario-overview':
      case 'scenario-form':
        return (
          <OAEVScenarioView
            mode={mode}
            panelMode={panelMode as 'scenario-overview' | 'scenario-form'}
            availablePlatforms={availablePlatforms}
            selectedPlatformId={selectedPlatformId}
            setSelectedPlatformId={setSelectedPlatformId}
            setPlatformUrl={setPlatformUrl}
            setPanelMode={setPanelMode}
            showToast={showToast}
            currentPageTitle={currentPageTitle}
            currentPageUrl={currentPageUrl}
            aiSettings={aiSettings}
            submitting={submitting}
            setSubmitting={setSubmitting}
            aiSelectingInjects={aiSelectingInjects}
            setAiSelectingInjects={setAiSelectingInjects}
            aiFillingEmails={aiFillingEmails}
            setAiFillingEmails={setAiFillingEmails}
            handleClose={handleClose}
            // Scenario state from useScenarioState hook
            scenarioOverviewData={scenarioOverviewData}
            setScenarioOverviewData={setScenarioOverviewData}
            scenarioForm={scenarioForm}
            setScenarioForm={setScenarioForm}
            selectedInjects={selectedInjects}
            setSelectedInjects={setSelectedInjects}
            scenarioEmails={scenarioEmails}
            setScenarioEmails={setScenarioEmails}
            scenarioLoading={scenarioLoading}
            setScenarioLoading={setScenarioLoading}
            scenarioStep={scenarioStep}
            setScenarioStep={setScenarioStep}
            scenarioTypeAffinity={scenarioTypeAffinity}
            setScenarioTypeAffinity={setScenarioTypeAffinity}
            scenarioPlatformsAffinity={scenarioPlatformsAffinity}
            setScenarioPlatformsAffinity={setScenarioPlatformsAffinity}
            scenarioInjectSpacing={scenarioInjectSpacing}
            setScenarioInjectSpacing={setScenarioInjectSpacing}
            scenarioPlatformSelected={scenarioPlatformSelected}
            setScenarioPlatformSelected={setScenarioPlatformSelected}
            scenarioPlatformId={scenarioPlatformId}
            setScenarioPlatformId={setScenarioPlatformId}
            scenarioRawAttackPatterns={scenarioRawAttackPatterns}
            setScenarioRawAttackPatterns={setScenarioRawAttackPatterns}
            scenarioTargetType={scenarioTargetType}
            setScenarioTargetType={setScenarioTargetType}
            scenarioAssets={scenarioAssets}
            setScenarioAssets={setScenarioAssets}
            scenarioAssetGroups={scenarioAssetGroups}
            setScenarioAssetGroups={setScenarioAssetGroups}
            scenarioTeams={scenarioTeams}
            setScenarioTeams={setScenarioTeams}
            scenarioSelectedAsset={scenarioSelectedAsset}
            setScenarioSelectedAsset={setScenarioSelectedAsset}
            scenarioSelectedAssetGroup={scenarioSelectedAssetGroup}
            setScenarioSelectedAssetGroup={setScenarioSelectedAssetGroup}
            scenarioSelectedTeam={scenarioSelectedTeam}
            setScenarioSelectedTeam={setScenarioSelectedTeam}
            scenarioCreating={scenarioCreating}
            setScenarioCreating={setScenarioCreating}
            scenarioAIMode={scenarioAIMode}
            setScenarioAIMode={setScenarioAIMode}
            scenarioAIGenerating={scenarioAIGenerating}
            setScenarioAIGenerating={setScenarioAIGenerating}
            scenarioAINumberOfInjects={scenarioAINumberOfInjects}
            setScenarioAINumberOfInjects={setScenarioAINumberOfInjects}
            scenarioAIPayloadAffinity={scenarioAIPayloadAffinity}
            setScenarioAIPayloadAffinity={setScenarioAIPayloadAffinity}
            scenarioAITableTopDuration={scenarioAITableTopDuration}
            setScenarioAITableTopDuration={setScenarioAITableTopDuration}
            scenarioAIEmailLanguage={scenarioAIEmailLanguage}
            setScenarioAIEmailLanguage={setScenarioAIEmailLanguage}
            scenarioAITheme={scenarioAITheme}
            setScenarioAITheme={setScenarioAITheme}
            scenarioAIContext={scenarioAIContext}
            setScenarioAIContext={setScenarioAIContext}
            scenarioAIGeneratedScenario={scenarioAIGeneratedScenario}
            setScenarioAIGeneratedScenario={setScenarioAIGeneratedScenario}
            resetScenarioState={resetScenarioState}
          />
        );
      case 'loading':
        return <CommonLoadingView />;
      default:
        return <CommonEmptyView />;
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          width: '100%',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.default',
        }}
      >
        {renderHeader()}
        <Box sx={{ flex: 1, overflow: 'auto' }}>{renderContent()}</Box>
      </Box>
    </ThemeProvider>
  );
};

export default App;
