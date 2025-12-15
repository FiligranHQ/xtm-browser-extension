import React, { useEffect, useState, useMemo } from 'react';
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Chip,
  Divider,
  Paper,
  CircularProgress,
  LinearProgress,
  Autocomplete,
  Alert,
  Stepper,
  Step,
  StepLabel,
  InputAdornment,
  FormControlLabel,
  Checkbox,
  Switch,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Tooltip,
} from '@mui/material';
import {
  CloseOutlined,
  SearchOutlined,
  OpenInNewOutlined,
  ContentCopyOutlined,
  ChevronLeftOutlined,
  ChevronRightOutlined,
  ArrowForwardOutlined,
  AddOutlined,
  DescriptionOutlined,
  SecurityOutlined,
  WarningAmberOutlined,
  PictureAsPdfOutlined,
  RefreshOutlined,
  TravelExploreOutlined,
  ComputerOutlined,
  LanOutlined,
  PersonOutlined,
  GroupsOutlined,
  MovieFilterOutlined,
  Kayaking,
  DomainOutlined,
  CheckCircleOutlined,
  ErrorOutline,
  LanguageOutlined,
  DnsOutlined,
  ArrowBackOutlined,
  EmailOutlined,
  InfoOutlined,
  AutoAwesomeOutlined,
  CheckBoxOutlined,
  CheckBoxOutlineBlankOutlined,
} from '@mui/icons-material';
import { LockPattern, Target, MicrosoftWindows, Linux, Apple, Android } from 'mdi-material-ui';
import ThemeDark, { THEME_DARK_AI } from '../shared/theme/ThemeDark';
import ThemeLight, { THEME_LIGHT_AI } from '../shared/theme/ThemeLight';
import ItemIcon from '../shared/components/ItemIcon';
import { itemColor, hexToRGB } from '../shared/theme/colors';

// Helper to get AI colors based on theme mode
const getAiColor = (mode: 'dark' | 'light') => mode === 'dark' ? THEME_DARK_AI : THEME_LIGHT_AI;
import { loggers } from '../shared/utils/logger';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  parsePrefixedType,
  isNonDefaultPlatformEntity,
  getPlatformFromEntity,
  getDisplayType,
  createPrefixedType,
  isDefaultPlatform,
  PLATFORM_REGISTRY,
  type PlatformType,
} from '../shared/platform';
import {
  getOAEVEntityName,
  getOAEVEntityId,
  getOAEVEntityUrl,
  getOAEVEntityColor,
  getOAEVTypeFromClass,
} from '../shared/utils/entity';
import { formatDate, formatDateTime } from '../shared/utils/formatters';

const log = loggers.panel;

// Helper function to get platform icon and color
const getPlatformIcon = (platform: string, size: 'small' | 'medium' = 'small') => {
  const iconSize = size === 'small' ? 14 : 18;
  const platformLower = platform.toLowerCase();
  
  switch (platformLower) {
    case 'windows':
      return <MicrosoftWindows sx={{ fontSize: iconSize }} />;
    case 'linux':
      return <Linux sx={{ fontSize: iconSize }} />;
    case 'macos':
    case 'darwin':
      return <Apple sx={{ fontSize: iconSize }} />;
    case 'android':
      return <Android sx={{ fontSize: iconSize }} />;
    default:
      return <ComputerOutlined sx={{ fontSize: iconSize }} />;
  }
};

const getPlatformColor = (platform: string): string => {
  const platformLower = platform.toLowerCase();
  switch (platformLower) {
    case 'windows':
      return '#0078d4';
    case 'linux':
      return '#f57c00';
    case 'macos':
    case 'darwin':
      return '#7b1fa2';
    case 'android':
      return '#3ddc84';
    case 'ios':
      return '#a2aaad';
    case 'browser':
      return '#4285f4';
    default:
      return '#757575';
  }
};

type PanelMode = 'empty' | 'loading' | 'entity' | 'not-found' | 'add' | 'preview' | 'platform-select' | 'container-type' | 'container-form' | 'investigation' | 'search' | 'search-results' | 'existing-containers' | 'atomic-testing' | 'oaev-search' | 'unified-search' | 'import-results' | 'scan-results' | 'scenario-overview' | 'scenario-form';

// Interface for platform match in scan results
interface ScanResultPlatformMatch {
  platformId: string;
  platformType: 'opencti' | 'openaev';
  entityId?: string;
  entityData?: any;
  type: string; // The type with platform prefix if needed
}

// Interface for scan result entity
interface ScanResultEntity {
  id: string;
  type: string;
  name: string;
  value?: string;
  found: boolean;
  entityId?: string;
  platformId?: string;
  platformType?: 'opencti' | 'openaev';
  entityData?: any;
  // Multi-platform support: track all platforms where this entity was found
  platformMatches?: ScanResultPlatformMatch[];
  // AI discovery fields
  discoveredByAI?: boolean;
  aiReason?: string;
  aiConfidence?: 'high' | 'medium' | 'low';
}

// Interface for import results statistics
interface ImportResults {
  success: boolean;
  total: number;
  created: Array<{ id: string; type: string; value: string }>;
  failed: Array<{ type: string; value: string; error?: string }>;
  platformName: string;
}

interface EntityData {
  id?: string;
  type?: string;
  name?: string;
  description?: string;
  confidence?: number;
  created?: string;
  modified?: string;
  created_at?: string;
  updated_at?: string;
  value?: string;
  existsInPlatform?: boolean;
  aliases?: string[];
  x_opencti_score?: number;
  entity_type?: string;
  standard_id?: string;
  objectMarking?: Array<{ definition: string; x_opencti_color?: string }>;
  objectLabel?: Array<{ value: string; color: string }>;
  createdBy?: { id: string; name: string };
  creators?: Array<{ id: string; name: string }>;
  representative?: { main?: string };
  // Vulnerability CVSS fields
  x_opencti_cvss_base_score?: number;
  x_opencti_cvss_base_severity?: string;
  x_opencti_cvss_attack_vector?: string;
  x_opencti_cisa_kev?: boolean;
  x_opencti_epss_score?: number;
  x_opencti_epss_percentile?: number;
  // Threat Actor fields
  first_seen?: string;
  last_seen?: string;
  goals?: string[];
  // Malware fields
  malware_types?: string[];
  is_family?: boolean;
  // Multi-platform support
  _platformId?: string;
  _platformType?: string;
  _isNonDefaultPlatform?: boolean;
  platformId?: string;
  // Allow additional properties from platform-specific entities
  [key: string]: unknown;
}

interface ContainerData {
  id: string;
  entity_type: string;
  name: string;
  created: string;
  modified: string;
  createdBy?: { id: string; name: string };
}

interface SearchResult extends EntityData {
  _platformId?: string;
}

interface PlatformInfo {
  id: string;
  name: string;
  url: string;
  version?: string;
  isEnterprise?: boolean;
  type?: 'opencti' | 'openaev';
}

const App: React.FC = () => {
  const [mode, setMode] = useState<'dark' | 'light'>('dark');
  const [panelMode, setPanelMode] = useState<PanelMode>('empty');
  const [entity, setEntity] = useState<EntityData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [oaevSearchQuery, setOaevSearchQuery] = useState('');
  const [oaevSearchResults, setOaevSearchResults] = useState<any[]>([]);
  const [oaevSearching, setOaevSearching] = useState(false);
  // Unified search state (searches both OpenCTI and OpenAEV)
  const [unifiedSearchQuery, setUnifiedSearchQuery] = useState('');
  const [unifiedSearchResults, setUnifiedSearchResults] = useState<UnifiedSearchResult[]>([]);
  const [unifiedSearching, setUnifiedSearching] = useState(false);
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
  // Track container workflow origin: 'preview' (from bulk selection), 'direct' (from action button), or 'import' (import without container)
  const [containerWorkflowOrigin, setContainerWorkflowOrigin] = useState<'preview' | 'direct' | 'import' | null>(null);
  // Track which search mode the entity view came from (to show back button and return to correct mode)
  // null = not from search, 'search' = OpenCTI search, 'oaev-search' = OpenAEV search, 'unified-search' = unified search
  const [entityFromSearchMode, setEntityFromSearchMode] = useState<'search' | 'oaev-search' | 'unified-search' | null>(null);
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
  const [scanResultsFoundFilter, setScanResultsFoundFilter] = useState<'all' | 'found' | 'not-found'>('all');
  // Selected items for import (synced with content script)
  const [selectedScanItems, setSelectedScanItems] = useState<Set<string>>(new Set());
  // Create indicators from observables option
  const [createIndicators, setCreateIndicators] = useState(true);
  // PDF attachment option
  const [attachPdf, setAttachPdf] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  // Page URL for external reference and existing container lookup
  const [currentPageUrl, setCurrentPageUrl] = useState('');
  const [currentPageTitle, setCurrentPageTitle] = useState('');
  // Existing containers found for current page
  const [existingContainers, setExistingContainers] = useState<ContainerData[]>([]);
  const [checkingExisting, setCheckingExisting] = useState(false);
  // Container being updated (for upsert mode)
  const [updatingContainerId, setUpdatingContainerId] = useState<string | null>(null);
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

  // AI Configuration state
  const [aiSettings, setAiSettings] = useState<{
    enabled: boolean;
    provider?: string;
    available: boolean;
  }>({ enabled: false, available: false });
  const [aiGeneratingDescription, setAiGeneratingDescription] = useState(false);
  const [aiSelectingInjects, setAiSelectingInjects] = useState(false);
  const [aiFillingEmails, setAiFillingEmails] = useState(false);
  const [aiDiscoveringEntities, setAiDiscoveringEntities] = useState(false);
  // Store page content for AI discovery (set when scan completes)
  const [scanPageContent, setScanPageContent] = useState<string>('');

  // Scenario creation state (OpenAEV)
  const [scenarioOverviewData, setScenarioOverviewData] = useState<{
    attackPatterns: Array<{
      id: string;
      name: string;
      externalId: string;
      description?: string;
      killChainPhases: string[];
      contracts: any[];
    }>;
    killChainPhases: Array<{
      phase_id: string;
      phase_kill_chain_name: string;
      phase_name: string;
      phase_order: number;
    }>;
    pageTitle: string;
    pageUrl: string;
    pageDescription: string;
  } | null>(null);
  const [scenarioForm, setScenarioForm] = useState({
    name: '',
    description: '',
    subtitle: '',
    category: 'attack-scenario',
  });
  const [selectedInjects, setSelectedInjects] = useState<Array<{
    attackPatternId: string;
    attackPatternName: string;
    contractId: string;
    contractLabel: string;
    delayMinutes: number;
  }>>([]);
  // AI-generated email content for table-top scenarios
  const [scenarioEmails, setScenarioEmails] = useState<Array<{
    attackPatternId: string;
    subject: string;
    body: string;
  }>>([]);
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [scenarioStep, setScenarioStep] = useState<0 | 1 | 2>(0); // 0: Affinity, 1: Injects, 2: Details
  const [scenarioTypeAffinity, setScenarioTypeAffinity] = useState<'ENDPOINT' | 'CLOUD' | 'WEB' | 'TABLE-TOP'>('ENDPOINT');
  const [scenarioPlatformsAffinity, setScenarioPlatformsAffinity] = useState<string[]>(['windows', 'linux', 'macos']);
  const [scenarioInjectSpacing, setScenarioInjectSpacing] = useState<number>(1); // Spacing between injects in minutes (1 for technical, 5 for table-top)
  // Scenario platform selection (when multiple OpenAEV platforms are configured)
  const [scenarioPlatformSelected, setScenarioPlatformSelected] = useState(false);
  const [scenarioPlatformId, setScenarioPlatformId] = useState<string | null>(null);
  // Raw attack patterns from scan (before filtering by platform)
  const [scenarioRawAttackPatterns, setScenarioRawAttackPatterns] = useState<Array<{
    id: string;
    entityId: string;
    name: string;
    externalId?: string;
    description?: string;
    killChainPhases?: string[];
    platformId?: string;
  }>>([]);
  // Scenario target selection (for technical scenarios: asset/asset_group, for table-top: team)
  const [scenarioTargetType, setScenarioTargetType] = useState<'asset' | 'asset_group'>('asset');
  const [scenarioAssets, setScenarioAssets] = useState<any[]>([]);
  const [scenarioAssetGroups, setScenarioAssetGroups] = useState<any[]>([]);
  const [scenarioTeams, setScenarioTeams] = useState<any[]>([]);
  const [scenarioSelectedAsset, setScenarioSelectedAsset] = useState<string | null>(null);
  const [scenarioSelectedAssetGroup, setScenarioSelectedAssetGroup] = useState<string | null>(null);
  const [scenarioSelectedTeam, setScenarioSelectedTeam] = useState<string | null>(null);

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
      // Running outside extension context - use defaults
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setMode(isDark ? 'dark' : 'light');
      return;
    }

    // Get theme setting - quick, from local storage
    chrome.runtime.sendMessage({ type: 'GET_PLATFORM_THEME' }, (response) => {
      if (chrome.runtime.lastError) {
        log.debug(' GET_PLATFORM_THEME error:', chrome.runtime.lastError);
        return;
      }
      if (response?.success) {
        let themeMode = response.data;
        log.debug(' Theme from GET_PLATFORM_THEME:', themeMode);
        if (themeMode === 'auto') {
          themeMode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        setMode(themeMode);
      }
    });

    // Get platform URL and available platforms - quick, from local storage
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response?.success) {
        // Also set theme from settings to ensure consistency
        if (response.data?.theme) {
          let themeMode = response.data.theme;
          log.debug(' Theme from GET_SETTINGS:', themeMode);
          if (themeMode === 'auto') {
            themeMode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
          }
          setMode(themeMode);
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
        const aiAvailable = !!(ai?.enabled && ai?.provider && ai?.apiKey);
        setAiSettings({
          enabled: ai?.enabled || false,
          provider: ai?.provider,
          available: aiAvailable,
        });
        log.debug(' AI settings loaded:', { available: aiAvailable, provider: ai?.provider });
        
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
        
        // Combine all platforms
        const allPlatforms = [...enabledPlatforms, ...enabledOAEVPlatforms];
        
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
          log.debug('Storage change detected, reloading platforms...');
          
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
          const aiAvailable = !!(ai?.enabled && ai?.provider && ai?.apiKey);
          setAiSettings({
            enabled: ai?.enabled || false,
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
  }, [selectedPlatformId]);

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
  }, [panelMode, selectedPlatformId]);

  const handleMessage = (event: MessageEvent) => {
    const { type, payload } = event.data;
    if (type === 'SELECTION_UPDATED') {
      log.debug(' handleMessage received SELECTION_UPDATED:', payload);
    }
    handlePanelState({ type, payload });
  };

  // Helper to generate clean description from HTML
  const generateDescription = (html: string, maxLength = 500): string => {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    // Remove non-content elements aggressively
    const selectorsToRemove = [
      'script', 'style', 'noscript', 'iframe', 'svg', 'canvas',
      'nav', 'footer', 'header', 'aside', 'menu', 'menuitem',
      'form', 'input', 'button', 'select', 'textarea',
      'figure', 'figcaption', 'picture', 'video', 'audio', 'source', 'track',
      '[role="navigation"]', '[role="banner"]', '[role="complementary"]', '[role="contentinfo"]',
      '[role="search"]', '[role="form"]', '[role="menu"]', '[role="menubar"]',
      '.sidebar', '.navigation', '.menu', '.advertisement', '.ad', '.advert',
      '.share', '.social', '.comments', '.comment', '.related', '.recommended',
      '.newsletter', '.subscribe', '.popup', '.modal', '.cookie', '.banner',
      '[class*="share"]', '[class*="social"]', '[class*="comment"]', '[class*="sidebar"]',
      '[class*="advert"]', '[class*="cookie"]', '[class*="newsletter"]', '[class*="popup"]',
      '[id*="share"]', '[id*="social"]', '[id*="comment"]', '[id*="sidebar"]',
      '[id*="advert"]', '[id*="cookie"]', '[id*="newsletter"]', '[id*="popup"]',
    ];
    
    selectorsToRemove.forEach(selector => {
      try {
        temp.querySelectorAll(selector).forEach(el => el.remove());
      } catch { /* Skip invalid selectors */ }
    });
    
    // Get text content and clean it
    let text = temp.textContent || temp.innerText || '';
    
    // Clean up whitespace, tabs, and multiple newlines
    text = text
      .replace(/[\t\r]/g, ' ')           // Replace tabs/carriage returns with spaces
      .replace(/\n{3,}/g, '\n\n')        // Max 2 newlines in a row
      .replace(/[ ]{2,}/g, ' ')          // Max 1 space in a row
      .replace(/\n /g, '\n')             // Remove spaces after newlines
      .replace(/ \n/g, '\n')             // Remove spaces before newlines
      .trim();
    
    // Get first meaningful paragraph (skip very short lines)
    const lines = text.split('\n').filter(line => line.trim().length > 20);
    if (lines.length > 0) {
      text = lines.slice(0, 5).join(' ').replace(/\s+/g, ' ').trim();
    }
    
    // Truncate and add ellipsis
    if (text.length > maxLength) {
      // Try to cut at a sentence or word boundary
      let cutPoint = text.lastIndexOf('. ', maxLength);
      if (cutPoint < maxLength / 2) {
        cutPoint = text.lastIndexOf(' ', maxLength);
      }
      if (cutPoint < maxLength / 2) {
        cutPoint = maxLength;
      }
      text = text.substring(0, cutPoint).trim() + '...';
    }
    
    return text;
  };

  // Helper to clean HTML for content field - minimal cleaning to preserve article content
  // We intentionally do LIGHT cleaning to avoid breaking paywalled/restricted content
  const cleanHtmlContent = (html: string): string => {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    // Remove ONLY elements that are definitely not content
    // Be conservative - better to include too much than lose actual content
    const elementsToRemove = [
      // Scripts and styles (never content)
      'script', 'style', 'noscript',
      // Interactive elements that don't render as text
      'iframe', 'object', 'embed', 'applet',
      // Form elements
      'input', 'button', 'select', 'textarea',
      // Only remove clearly modal/overlay framework elements (exact class matches)
      '.MuiModal-root', '.MuiBackdrop-root', '.MuiDialog-root',
      '.ReactModal__Overlay', '.ReactModal__Content',
      // Hidden elements
      '[hidden]', '[aria-hidden="true"]',
    ];
    
    elementsToRemove.forEach(selector => {
      try {
        temp.querySelectorAll(selector).forEach(el => el.remove());
      } catch { /* Skip invalid selectors */ }
    });
    
    // Remove ONLY event handlers (keep styles - they may affect layout/images)
    temp.querySelectorAll('*').forEach(el => {
      // Remove event handlers only
      el.removeAttribute('onclick');
      el.removeAttribute('onload');
      el.removeAttribute('onerror');
      el.removeAttribute('onmouseover');
      el.removeAttribute('onmouseout');
      el.removeAttribute('onfocus');
      el.removeAttribute('onblur');
    });
    
    return temp.innerHTML;
  };

  // Fetch containers for an entity
  const fetchEntityContainers = async (entityId: string, platformId?: string) => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
    
    log.debug(' fetchEntityContainers called:', { entityId, platformId });
    
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
      log.debug(' fetchEntityContainers response:', response);
      if (response?.success && response.data) {
        log.debug(' fetchEntityContainers: Found', response.data.length, 'containers');
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
        log.debug(' Theme set from payload:', data.payload.theme);
        setMode(data.payload.theme);
      }
    } else {
      // Otherwise, re-fetch theme on every panel state change to ensure consistency
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({ type: 'GET_PLATFORM_THEME' }, (response) => {
          if (chrome.runtime.lastError) return;
          if (response?.success) {
            let themeMode = response.data;
            if (themeMode === 'auto') {
              themeMode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            }
            if (themeMode !== mode) {
              log.debug(' Theme updated on panel state change:', themeMode);
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
          const multiResults: Array<{ platformId: string; platformName: string; entity: EntityData }> = platformMatches.map((match: { platformId: string; entityId: string; entityData?: any }) => {
            const platform = availablePlatforms.find(p => p.id === match.platformId);
            return {
              platformId: match.platformId,
              platformName: platform?.name || match.platformId,
              entity: {
                ...payload,
                entityId: match.entityId,
                entityData: match.entityData || payload?.entityData,
                _platformId: match.platformId,
              } as EntityData,
            };
          });
          // Sort results: OpenCTI platforms first (knowledge base reference)
          const sortedResults = sortPlatformResults(multiResults);
          setMultiPlatformResults(sortedResults);
          setCurrentPlatformIndex(0);
        } else if (platformId) {
          // Single platform result - still set it for consistent display
          const platform = availablePlatforms.find(p => p.id === platformId);
          setMultiPlatformResults([{
            platformId,
            platformName: platform?.name || platformId,
            entity: { ...payload, _platformId: platformId },
          }]);
          setCurrentPlatformIndex(0);
        } else {
          setMultiPlatformResults([]);
          setCurrentPlatformIndex(0);
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
          // Set loading state with basic info
          setEntity(payload);
          setPanelMode('loading');
          
          try {
            // Fetch full entity details from appropriate API based on platform
            // TODO: When adding new platforms, add their message types here
            const messageType = entityPlatformType === 'openaev' ? 'GET_OAEV_ENTITY_DETAILS' : 'GET_ENTITY_DETAILS';
            const response = await chrome.runtime.sendMessage({
              type: messageType,
              payload: { 
                id: entityId,
                entityId: entityId, // For OpenAEV
                entityType: actualEntityType,
                platformId,
              },
            });
            
            if (response?.success && response.data) {
              // Merge full data with original payload (keep platform info)
              setEntity({ 
                ...payload, 
                ...response.data, 
                entityData: response.data,
                existsInPlatform: true,
                _platformId: platformId,
                _platformType: entityPlatformType,
                _isNonDefaultPlatform: isNonDefaultPlatform,
              });
              setPanelMode('entity');
              // Only fetch containers for default platform (OpenCTI) entities
              if (!isNonDefaultPlatform) {
                fetchEntityContainers(entityId, platformId);
              }
            } else {
              // Fall back to original data
              setEntity({ ...payload, _platformType: entityPlatformType, _isNonDefaultPlatform: isNonDefaultPlatform });
              setPanelMode(payload?.existsInPlatform ? 'entity' : 'not-found');
            }
          } catch (error) {
            log.error(' Failed to fetch entity details:', error);
            setEntity({ ...payload, _platformType: entityPlatformType, _isNonDefaultPlatform: isNonDefaultPlatform });
            setPanelMode(payload?.existsInPlatform ? 'entity' : 'not-found');
          }
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
          log.debug(' goToNextStep - OpenCTI platforms:', platforms.length);
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
        log.debug(' SHOW_INVESTIGATION_PANEL - OpenCTI platforms:', platforms.length);
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
        
        log.debug(' ATOMIC_TESTING_SELECT - target:', { target, entityId, platformId: atomicTestingPlatformId });
        
        if (target?.type === 'attack-pattern' && entityId && atomicTestingPlatformId) {
          log.debug(' Fetching injector contracts for attack pattern:', entityId);
          chrome.runtime.sendMessage({
            type: 'FETCH_INJECTOR_CONTRACTS',
            payload: { attackPatternId: entityId, platformId: atomicTestingPlatformId },
          }).then((res: any) => {
            log.debug(' Injector contracts response:', res);
            if (res?.success) {
              setAtomicTestingInjectorContracts(res.data || []);
            }
          });
        }
        break;
      }
      case 'INVESTIGATION_SCAN_RESULTS': {
        // Receive results from investigation scan (only entities found in platform)
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
        
        // Map to group entities by their normalized name/value (case-insensitive)
        // This allows us to track the same entity found in multiple platforms
        const entityMap = new Map<string, ScanResultEntity>();
        
        // Helper to normalize key for grouping (use lowercase name/value only)
        const getGroupKey = (name: string, value?: string): string => {
          return (value || name || '').toLowerCase();
        };
        
        // Helper to add entity or merge with existing entry
        const addOrMergeEntity = (entity: ScanResultEntity) => {
          const groupKey = getGroupKey(entity.name, entity.value);
          
          const platformMatch: ScanResultPlatformMatch = {
            platformId: entity.platformId || '',
            platformType: entity.platformType || 'opencti',
            entityId: entity.entityId,
            entityData: entity.entityData,
            type: entity.type,
          };
          
          const existing = entityMap.get(groupKey);
          if (existing) {
            // Merge: add this platform to existing entry
            if (!existing.platformMatches) {
              existing.platformMatches = [{
                platformId: existing.platformId || '',
                platformType: existing.platformType || 'opencti',
                entityId: existing.entityId,
                entityData: existing.entityData,
                type: existing.type,
              }];
            }
            // Only add if not already present (same platformId)
            if (!existing.platformMatches.some(pm => pm.platformId === platformMatch.platformId)) {
              existing.platformMatches.push(platformMatch);
            }
            // If this is a "found" entry, mark the entity as found
            if (entity.found) {
              existing.found = true;
            }
          } else {
            // New entry
            entityMap.set(groupKey, {
              ...entity,
              platformMatches: [platformMatch],
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
              type: platformType === 'openaev' ? `oaev-${entityType}` : entityType,
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
        
        setScanResultsEntities(Array.from(entityMap.values()));
        setScanResultsTypeFilter('all');
        setScanResultsFoundFilter('all');
        setSelectedScanItems(new Set()); // Clear selections for new scan
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
        log.debug(' SELECTION_UPDATED received:', data.payload);
        const { selectedItems } = data.payload || {};
        if (Array.isArray(selectedItems)) {
          log.debug(' Setting selectedScanItems to:', selectedItems);
          setSelectedScanItems(new Set(selectedItems));
        } else {
          log.warn(' SELECTION_UPDATED: selectedItems is not an array:', selectedItems);
        }
        break;
      }
      case 'SHOW_SEARCH_PANEL':
        setPanelMode('search');
        break;
      case 'SHOW_OAEV_SEARCH_PANEL':
        setOaevSearchQuery('');
        setOaevSearchResults([]);
        setPanelMode('oaev-search');
        break;
      case 'SHOW_UNIFIED_SEARCH_PANEL':
        setUnifiedSearchQuery('');
        setUnifiedSearchResults([]);
        setPanelMode('unified-search');
        break;
      case 'SHOW_SCENARIO_PANEL': {
        // Initialize scenario creation with attack patterns from the page
        const { attackPatterns, pageTitle, pageUrl, pageDescription, theme: themeFromPayload } = data.payload || {};
        
        log.debug(' SHOW_SCENARIO_PANEL received:', {
          attackPatternsCount: attackPatterns?.length || 0,
          attackPatterns: attackPatterns?.slice(0, 3).map((ap: any) => ({ name: ap.name, platformId: ap.platformId })),
        });
        
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
        
        // Store raw attack patterns (they have platformId from the scan)
        setScenarioRawAttackPatterns(attackPatterns || []);
        
        // Check how many OpenAEV platforms are configured
        // Use ref to get latest value (avoid stale closure)
        let currentPlatforms = availablePlatformsRef.current;
        
        // If platforms haven't loaded yet, try to fetch them from settings
        if (currentPlatforms.length === 0 && typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
          log.debug(' Platforms not loaded yet, fetching from settings...');
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
              
              log.debug(' Loaded platforms from settings:', currentPlatforms.map(p => ({ id: p.id, name: p.name, type: p.type })));
            }
          } catch (error) {
            log.warn(' Failed to fetch platforms:', error);
          }
        }
        
        const oaevPlatforms = currentPlatforms.filter(p => p.type === 'openaev');
        log.debug(' OpenAEV platforms:', oaevPlatforms.map(p => ({ id: p.id, name: p.name })));
        log.debug(' All platforms:', currentPlatforms.map(p => ({ id: p.id, name: p.name, type: p.type })));
        
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
          
          log.debug(' Single platform selected:', singlePlatformId);
          log.debug(' Attack patterns platformIds:', (attackPatterns || []).map((ap: any) => ap.platformId));
          
          // Fetch assets, asset groups, and teams for target selection
          if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
            log.debug(' Starting fetch of scenario targets for platform:', singlePlatformId);
            Promise.all([
              chrome.runtime.sendMessage({ type: 'FETCH_OAEV_ASSETS', payload: { platformId: singlePlatformId } }),
              chrome.runtime.sendMessage({ type: 'FETCH_OAEV_ASSET_GROUPS', payload: { platformId: singlePlatformId } }),
              chrome.runtime.sendMessage({ type: 'FETCH_OAEV_TEAMS', payload: { platformId: singlePlatformId } }),
            ]).then(([assetsRes, assetGroupsRes, teamsRes]) => {
              log.debug(' Scenario targets fetch responses:', {
                assets: { success: assetsRes?.success, count: assetsRes?.data?.length, error: assetsRes?.error },
                assetGroups: { success: assetGroupsRes?.success, count: assetGroupsRes?.data?.length, error: assetGroupsRes?.error },
                teams: { success: teamsRes?.success, count: teamsRes?.data?.length, error: teamsRes?.error },
              });
              
              if (assetsRes?.success) setScenarioAssets(assetsRes.data || []);
              if (assetGroupsRes?.success) setScenarioAssetGroups(assetGroupsRes.data || []);
              if (teamsRes?.success) setScenarioTeams(teamsRes.data || []);
              
              log.debug(' Scenario targets loaded (single platform):', {
                assets: assetsRes?.data?.length || 0,
                assetGroups: assetGroupsRes?.data?.length || 0,
                teams: teamsRes?.data?.length || 0,
              });
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
          
          log.debug(' Filtered patterns count:', filteredPatterns.length);
          
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
          
          log.debug(' Showing raw attack patterns (no platform):', rawPatternsForDisplay.length);
          
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

  // Interface for merged search results
  interface MergedSearchResult {
    representativeKey: string; // Key for grouping (name + type)
    name: string;
    type: string;
    platforms: Array<{
      platformId: string;
      platformName: string;
      result: SearchResult;
    }>;
  }

  // Interface for unified search results (across OpenCTI and OpenAEV)
  interface UnifiedSearchResult {
    id: string;
    name: string;
    type: string;
    description?: string;
    source: 'opencti' | 'openaev';
    platformId: string;
    platformName: string;
    entityId: string;
    // Additional fields for display
    data?: Record<string, unknown>;
  }

  // Merge search results by representative (name + type)
  const getMergedSearchResults = (): MergedSearchResult[] => {
    const grouped = new Map<string, MergedSearchResult>();
    
    searchResults.forEach((result) => {
      const name = result.representative?.main || result.name || result.value || 'Unknown';
      const type = result.entity_type || result.type || 'unknown';
      const key = `${name.toLowerCase()}::${type.toLowerCase()}`;
      
      const platformId = result._platformId || 'unknown';
      const platform = availablePlatforms.find(p => p.id === platformId);
      const platformName = platform?.name || platformId;
      
      if (grouped.has(key)) {
        const existing = grouped.get(key)!;
        // Only add if this platform isn't already in the list
        if (!existing.platforms.some(p => p.platformId === platformId)) {
          existing.platforms.push({ platformId, platformName, result });
        }
      } else {
        grouped.set(key, {
          representativeKey: key,
          name,
          type,
          platforms: [{ platformId, platformName, result }],
        });
      }
    });
    
    return Array.from(grouped.values());
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
    
    setSearching(true);
    // Stay on search view - results will appear below

    const response = await chrome.runtime.sendMessage({
      type: 'SEARCH_ENTITIES',
      payload: { searchTerm: searchQuery, limit: 20 },
    });

    if (chrome.runtime.lastError) {
      setSearching(false);
      return;
    }

    if (response?.success) {
      // Results are now flat array with _platformId
      setSearchResults(response.data || []);
    }
    setSearching(false);
  };

  const handleOaevSearch = async () => {
    if (!oaevSearchQuery.trim()) return;
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
    
    setOaevSearching(true);

    const response = await chrome.runtime.sendMessage({
      type: 'SEARCH_OAEV',
      payload: { searchTerm: oaevSearchQuery },
    });

    if (chrome.runtime.lastError) {
      setOaevSearching(false);
      return;
    }

    if (response?.success) {
      setOaevSearchResults(response.data || []);
    }
    setOaevSearching(false);
  };

  // Unified search handler - searches BOTH OpenCTI and OpenAEV
  const handleUnifiedSearch = async () => {
    if (!unifiedSearchQuery.trim()) return;
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
    
    setUnifiedSearching(true);
    const results: UnifiedSearchResult[] = [];

    // Search OpenCTI (all platforms)
    try {
      const octiResponse = await chrome.runtime.sendMessage({
        type: 'SEARCH_ENTITIES',
        payload: { searchTerm: unifiedSearchQuery, limit: 20 },
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
        type: 'SEARCH_OAEV',
        payload: { searchTerm: unifiedSearchQuery },
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

  // Handle click on unified search result
  const handleUnifiedSearchResultClick = async (result: UnifiedSearchResult) => {
    setEntityFromSearchMode('unified-search');
    
    const platformInfo = availablePlatforms.find(p => p.id === result.platformId);
    if (platformInfo) {
      setSelectedPlatformId(platformInfo.id);
      setPlatformUrl(platformInfo.url);
    }

    if (result.source === 'opencti') {
      // Handle OpenCTI result - fetch full entity details
      const originalData = result.data as Record<string, unknown>;
      
      // Set loading state with basic info first
      setEntity({
        ...originalData,
        type: result.type,
        entity_type: result.type,
        name: result.name,
        existsInPlatform: true,
        _platformId: result.platformId,
        _platformType: 'opencti',
        _isNonDefaultPlatform: false,
      } as unknown as EntityData);
      setPanelMode('loading');
      
      // Fetch full entity details from OpenCTI API
      try {
        if (result.entityId && result.platformId) {
          const response = await chrome.runtime.sendMessage({
            type: 'GET_ENTITY_DETAILS',
            payload: {
              id: result.entityId,
              entityType: result.type,
              platformId: result.platformId,
            },
          });
          
          if (response?.success && response.data) {
            // Update entity with full details
            setEntity({
              ...response.data,
              type: response.data.entity_type || result.type,
              entity_type: response.data.entity_type || result.type,
              name: response.data.name || result.name,
              existsInPlatform: true,
              _platformId: result.platformId,
              _platformType: 'opencti',
              _isNonDefaultPlatform: false,
            } as unknown as EntityData);
            setPanelMode('entity');
            // Fetch containers for OpenCTI entities
            fetchEntityContainers(result.entityId, result.platformId);
          } else {
            // Fall back to search result data
            setPanelMode('entity');
            if (result.entityId) {
              fetchEntityContainers(result.entityId, result.platformId);
            }
          }
        } else {
          // No entity ID, just show what we have
          setPanelMode('entity');
        }
      } catch (error) {
        console.warn('Failed to fetch full OpenCTI entity details:', error);
        setPanelMode('entity');
        if (result.entityId) {
          fetchEntityContainers(result.entityId, result.platformId);
        }
      }
    } else {
      // Handle OpenAEV result - fetch full entity details
      const originalData = result.data as Record<string, unknown>;
      const prefixedType = createPrefixedType(result.type, 'openaev');
      
      // Set initial entity data from search result with LOADING state
      setEntity({
        ...originalData,
        type: prefixedType,
        name: result.name,
        entityData: originalData,
        existsInPlatform: true,
        _platformId: result.platformId,
        _platformType: 'openaev',
        _isNonDefaultPlatform: true,
      } as unknown as EntityData);
      setPanelMode('loading'); // Show loading state while fetching full details
      
      // Fetch full entity details from OpenAEV API
      try {
        const entityId = result.entityId || (originalData as any)._id || 
          (originalData as any).asset_id || (originalData as any).team_id || 
          (originalData as any).user_id || (originalData as any).scenario_id ||
          (originalData as any).exercise_id || (originalData as any).finding_id ||
          (originalData as any).asset_group_id || (originalData as any).attack_pattern_id ||
          (originalData as any).organization_id || (originalData as any).player_id;
          
        if (entityId && result.platformId) {
          const response = await chrome.runtime.sendMessage({
            type: 'GET_OAEV_ENTITY_DETAILS',
            payload: {
              entityId,
              entityType: result.type,
              platformId: result.platformId,
            },
          });
          
          if (response?.success && response.data) {
            // Update entity with full details
            setEntity({
              ...response.data,
              type: prefixedType,
              name: result.name || response.data.asset_name || response.data.team_name || 
                response.data.user_email || response.data.scenario_name || response.data.exercise_name ||
                response.data.attack_pattern_name || response.data.finding_name || response.data.organization_name ||
                response.data.player_name || response.data.asset_group_name,
              entityData: response.data,
              existsInPlatform: true,
              _platformId: result.platformId,
              _platformType: 'openaev',
              _isNonDefaultPlatform: true,
            } as unknown as EntityData);
            setPanelMode('entity');
          } else {
            // Fall back to search result data
            setPanelMode('entity');
          }
        } else {
          // No entity ID, just show what we have from search
          setPanelMode('entity');
        }
      } catch (error) {
        // Keep the initial entity data from search result if fetch fails
        console.warn('Failed to fetch full OpenAEV entity details:', error);
        setPanelMode('entity');
      }
    }
  };

  const handleOaevSearchResultClick = async (result: any) => {
    setEntityFromSearchMode('oaev-search');
    
    // Determine entity type from _entityClass
    const entityClass = result._entityClass || '';
    const oaevType = getOAEVTypeFromClass(entityClass);
    
    // Get platform info
    const platformId = result._platformId;
    const platformInfo = availablePlatforms.find(p => p.id === platformId);
    if (platformInfo) {
      setSelectedPlatformId(platformInfo.id);
      setPlatformUrl(platformInfo.url);
    }
    
    // Set initial entity data from search result with loading state
    const entityName = getOAEVEntityName(result, oaevType);
    setEntity({
      ...result,
      type: `oaev-${oaevType}`,
      name: entityName,
      entityData: result,
      existsInPlatform: true,
      _platformId: platformId,
      _platformType: 'openaev',
      _isNonDefaultPlatform: true,
    });
    setPanelMode('loading');
    
    // Fetch full entity details from OpenAEV API
    try {
      const entityId = result._id || result.asset_id || result.team_id || 
        result.user_id || result.scenario_id || result.exercise_id || 
        result.finding_id || result.asset_group_id || result.attack_pattern_id ||
        result.organization_id;
        
      if (entityId && platformId) {
        const response = await chrome.runtime.sendMessage({
          type: 'GET_OAEV_ENTITY_DETAILS',
          payload: {
            entityId,
            entityType: oaevType,
            platformId,
          },
        });
        
        if (response?.success && response.data) {
          // Update entity with full details
          setEntity({
            ...response.data,
            type: `oaev-${oaevType}`,
            name: entityName || response.data.asset_name || response.data.team_name || 
              response.data.user_email || response.data.scenario_name || response.data.exercise_name ||
              response.data.attack_pattern_name || response.data.finding_name || response.data.organization_name,
            entityData: response.data,
            existsInPlatform: true,
            _platformId: platformId,
            _platformType: 'openaev',
            _isNonDefaultPlatform: true,
          });
          setPanelMode('entity');
        } else {
          // Fall back to search result data
          setPanelMode('entity');
        }
      } else {
        // No entity ID, just show what we have
        setPanelMode('entity');
      }
    } catch (error) {
      // Keep the initial entity data from search result if fetch fails
      console.warn('Failed to fetch full OpenAEV entity details:', error);
      setPanelMode('entity');
    }
  };


  const handleSearchResultClick = async (merged: MergedSearchResult) => {
    // Mark that we're coming from search (for back button)
    setEntityFromSearchMode('search');
    
    // Helper to get platform type from platformId
    const getPlatformType = (platformId: string): 'opencti' | 'openaev' => {
      const platform = availablePlatforms.find(p => p.id === platformId);
      return platform?.type || 'opencti'; // Default to opencti for search results
    };
    
    // If found in multiple platforms, set up multi-platform navigation
    if (merged.platforms.length > 1) {
      // Load entity for first platform and set up multi-platform results
      const firstPlatform = merged.platforms[0];
      const platformInfo = availablePlatforms.find(p => p.id === firstPlatform.platformId);
      if (platformInfo) {
        setSelectedPlatformId(platformInfo.id);
        setPlatformUrl(platformInfo.url);
      }
      
      setPanelMode('loading');
      
      // Fetch entity details for all platforms in parallel
      const entityPromises = merged.platforms.map(async (p) => {
        const platformType = getPlatformType(p.platformId);
        const response = await chrome.runtime.sendMessage({
          type: 'GET_ENTITY_DETAILS',
          payload: { 
            id: p.result.id, 
            entityType: p.result.entity_type || p.result.type,
            platformId: p.platformId,
          },
        });
        
        const entityType = p.result.entity_type || p.result.type;
        return {
          platformId: p.platformId,
          platformName: p.platformName,
          entity: response?.success 
            ? { 
                ...response.data, 
                existsInPlatform: true, 
                _platformId: p.platformId,
                _platformType: platformType,
                _isNonDefaultPlatform: platformType !== 'opencti',
                type: response.data.entity_type || response.data.type || entityType,
              } 
            : { 
                ...p.result, 
                existsInPlatform: true,
                _platformId: p.platformId,
                _platformType: platformType,
                _isNonDefaultPlatform: platformType !== 'opencti',
                type: entityType,
              },
        };
      });
      
      const results = await Promise.all(entityPromises);
      
      // Sort results: OpenCTI platforms first (knowledge base reference)
      const sortedResults = sortPlatformResults(results);
      
      // Set up multi-platform navigation
      setMultiPlatformResults(sortedResults);
      setCurrentPlatformIndex(0);
      setEntity(sortedResults[0].entity);
      setPanelMode('entity');
      // Only fetch containers for OpenCTI platforms
      if (getPlatformType(sortedResults[0].platformId) === 'opencti') {
        fetchEntityContainers(sortedResults[0].entity.id, sortedResults[0].platformId);
      }
    } else {
      // Single platform - load directly
      const platform = merged.platforms[0];
      const platformInfo = availablePlatforms.find(p => p.id === platform.platformId);
      const platformType = platformInfo?.type || 'opencti';
      
      if (platformInfo) {
        setSelectedPlatformId(platformInfo.id);
        setPlatformUrl(platformInfo.url);
      }
      
      setPanelMode('loading');
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        const response = await chrome.runtime.sendMessage({
          type: 'GET_ENTITY_DETAILS',
          payload: { 
            id: platform.result.id, 
            entityType: platform.result.entity_type || platform.result.type,
            platformId: platform.platformId,
          },
        });
        
        const entityType = platform.result.entity_type || platform.result.type;
        if (response?.success && response.data) {
          setEntity({ 
            ...response.data, 
            existsInPlatform: true, 
            _platformId: platform.platformId,
            _platformType: platformType,
            _isNonDefaultPlatform: platformType !== 'opencti',
            type: response.data.entity_type || response.data.type || entityType,
          });
          setMultiPlatformResults([]); // Clear multi-platform
          setPanelMode('entity');
          // Only fetch containers for OpenCTI platforms
          if (platformType === 'opencti') {
            fetchEntityContainers(response.data.id, platform.platformId);
          }
        } else {
          setEntity({ 
            ...platform.result, 
            existsInPlatform: true,
            _platformId: platform.platformId,
            _platformType: platformType,
            _isNonDefaultPlatform: platformType !== 'opencti',
            type: entityType,
          });
          setMultiPlatformResults([]);
          setPanelMode('entity');
        }
      }
    }
  };

  const handleClose = () => {
    window.parent.postMessage({ type: 'XTM_CLOSE_PANEL' }, '*');
  };

  const handleOpenInPlatform = (entityId: string) => {
    if (platformUrl && entityId) {
      const url = `${platformUrl}/dashboard/id/${entityId}`;
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
        log.debug(' AI generated description:', response.data.substring(0, 100) + '...');
      } else {
        log.error(' AI description generation failed:', response?.error);
      }
    } catch (error) {
      log.error(' AI description generation error:', error);
    } finally {
      setAiGeneratingDescription(false);
    }
  };

  /**
   * Discover additional entities using AI
   * Analyzes page content and finds entities that regex patterns might have missed
   */
  const handleDiscoverEntitiesWithAI = async () => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
    
    // Check if AI is available
    if (!aiSettings.available) {
      log.warn('AI is not configured for entity discovery');
      return;
    }
    
    // Check for Enterprise Edition platform (OpenCTI or OpenAEV)
    const hasEnterprisePlatform = availablePlatforms.some(p => p.isEnterprise);
    if (!hasEnterprisePlatform) {
      log.warn('AI entity discovery requires at least one Enterprise Edition platform');
      return;
    }
    
    setAiDiscoveringEntities(true);
    
    try {
      // Get page content from the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      let pageContent = '';
      let pageTitle = currentPageTitle;
      let pageUrl = currentPageUrl;
      
      if (tab?.id) {
        const contentResponse = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_CONTENT' });
        if (contentResponse?.success) {
          pageContent = contentResponse.data?.content || '';
          pageTitle = contentResponse.data?.title || pageTitle;
          pageUrl = contentResponse.data?.url || pageUrl;
        }
      }
      
      if (!pageContent) {
        log.error('Could not get page content for AI discovery');
        return;
      }
      
      // Build list of already detected entities (both found and not found)
      const alreadyDetected = scanResultsEntities.map(e => ({
        type: e.type,
        name: e.name,
        value: e.value,
        found: e.found,
      }));
      
      log.debug('AI discovery request:', {
        alreadyDetectedCount: alreadyDetected.length,
        contentLength: pageContent.length,
      });
      
      const response = await chrome.runtime.sendMessage({
        type: 'AI_DISCOVER_ENTITIES',
        payload: {
          pageTitle,
          pageUrl,
          pageContent,
          alreadyDetected,
        },
      });
      
      if (response?.success && response.data?.entities) {
        const discoveredEntities = response.data.entities;
        log.info(`AI discovered ${discoveredEntities.length} new entities`);
        
        if (discoveredEntities.length > 0) {
          // Add AI-discovered entities to scan results
          const newEntities: ScanResultEntity[] = discoveredEntities.map((e: any, index: number) => ({
            id: `ai-${Date.now()}-${index}`,
            type: e.type,
            name: e.name,
            value: e.value,
            found: false, // AI-discovered entities are not yet in the platform
            discoveredByAI: true,
            aiReason: e.reason,
            aiConfidence: e.confidence,
          }));
          
          // Add to scan results - avoid duplicates
          const existingValues = new Set(
            scanResultsEntities.map(e => (e.value || e.name).toLowerCase())
          );
          
          const uniqueNewEntities = newEntities.filter(e => 
            !existingValues.has((e.value || e.name).toLowerCase())
          );
          
          if (uniqueNewEntities.length > 0) {
            setScanResultsEntities(prev => [...prev, ...uniqueNewEntities]);
            
            // Highlight the new AI-discovered entities on the page
            if (tab?.id) {
              window.parent.postMessage({
                type: 'XTM_HIGHLIGHT_AI_ENTITIES',
                entities: uniqueNewEntities.map(e => ({
                  type: e.type,
                  value: e.value || e.name,
                  name: e.name,
                })),
              }, '*');
            }
            
            log.info(`Added ${uniqueNewEntities.length} AI-discovered entities to scan results`);
          } else {
            log.info('All AI-discovered entities were already in the list');
          }
        } else {
          log.info('AI did not discover any additional entities');
        }
      } else {
        log.error('AI entity discovery failed:', response?.error);
      }
    } catch (error) {
      log.error('AI entity discovery error:', error);
    } finally {
      setAiDiscoveringEntities(false);
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
            log.debug(' PDF generated:', pdfResponse.data.filename);
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
    const existingEntityIds = entitiesToAdd.filter(e => e.id).map(e => e.id as string);
    const entitiesToCreate = entitiesToAdd.filter(e => !e.id && (e.value || e.observable_value)).map(e => ({
      type: e.type || e.entity_type || 'Unknown',
      value: e.value || e.observable_value || e.name || '',
    }));
    
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
      },
    });

    if (chrome.runtime.lastError) {
      log.error(' Container creation failed:', chrome.runtime.lastError);
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
      });
      setEntityContainers([]);
      setPanelMode('entity');
      
      // Reset form
      setContainerForm({ name: '', description: '', content: '' });
      setEntitiesToAdd([]);
      setContainerWorkflowOrigin(null);
      setAttachPdf(true); // Reset PDF option
    } else {
      log.error(' Container creation failed:', response?.error);
    }
    setSubmitting(false);
  };

  const handleStartInvestigation = async () => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
    
    setSubmitting(true);
    const response = await chrome.runtime.sendMessage({
      type: 'CREATE_INVESTIGATION_WITH_ENTITIES',
      payload: { entities: entitiesToAdd },
    });

    if (chrome.runtime.lastError) {
      setSubmitting(false);
      return;
    }

    if (response?.success) {
      setPanelMode('empty');
      handleOpenInPlatform(response.data?.id);
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
          <Typography variant="caption" sx={{ fontWeight: 500, fontSize: 10, color: '#ff9800' }}>
            (beta)
          </Typography>
        </Box>
      </Box>
      <IconButton size="small" onClick={handleClose} sx={{ color: mode === 'dark' ? '#ffffff' : 'text.primary' }}>
        <CloseOutlined fontSize="small" />
      </IconButton>
    </Box>
  );

  // Helper for CVSS score color - optimized for visibility in both modes
  const getCvssColor = (score: number | undefined) => {
    if (score === undefined || score === null) return '#607d8b';
    if (score === 0) return '#607d8b';
    if (score <= 3.9) return '#4caf50'; // Green - Low
    if (score <= 6.9) return '#ffb74d'; // Amber - Medium (lighter for dark mode)
    if (score <= 8.9) return '#ff7043'; // Orange - High
    return '#ef5350'; // Red - Critical
  };
  
  // Helper for CVSS chip styling - high visibility
  const getCvssChipStyle = (score: number | undefined) => {
    const color = getCvssColor(score);
    return {
      fontWeight: 700,
      fontSize: 14,
      height: 34,
      bgcolor: color,
      color: '#ffffff',
      border: 'none',
      '& .MuiChip-icon': { color: '#ffffff' },
    };
  };

  // Helper for severity color - high visibility
  const getSeverityColor = (severity: string | undefined) => {
    switch (severity?.toLowerCase()) {
      case 'low': return { bgcolor: '#4caf50', color: '#ffffff' };
      case 'medium': return { bgcolor: '#5c7bf5', color: '#ffffff' };
      case 'high': return { bgcolor: '#ff9800', color: '#ffffff' };
      case 'critical': return { bgcolor: '#f44336', color: '#ffffff' };
      default: return { bgcolor: '#607d8b', color: '#ffffff' };
    }
  };
  
  // Helper for marking definition colors (fallback when x_opencti_color is not present)
  const getMarkingColor = (definition: string | undefined): string => {
    if (!definition) return '#ffffff';
    switch (definition) {
      case 'TLP:RED':
      case 'PAP:RED':
      case 'CD':
      case 'CD-SF':
      case 'DR':
      case 'DR-SF':
        return '#c62828';
      case 'TLP:AMBER':
      case 'TLP:AMBER+STRICT':
      case 'PAP:AMBER':
        return '#d84315';
      case 'TLP:GREEN':
      case 'PAP:GREEN':
      case 'NP':
        return '#2e7d32';
      case 'TLP:CLEAR':
      case 'TLP:WHITE':
      case 'PAP:CLEAR':
        return mode === 'dark' ? '#ffffff' : '#2b2b2b';
      case 'SF':
        return '#283593';
      default:
        return '#ffffff';
    }
  };
  
  // Label style for section titles
  const sectionTitleStyle = {
    color: 'text.secondary',
    fontWeight: 500,
    fontSize: 11,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    mb: 1,
    display: 'block',
  };
  
  // Content text style - always visible
  const contentTextStyle = {
    color: mode === 'dark' ? '#ffffff' : 'text.primary',
    lineHeight: 1.6,
  };

  // OpenAEV Entity View - renders OpenAEV-specific entities (Asset, AssetGroup, Player, Team)
  const renderOAEVEntityView = () => {
    if (!entity) return null;
    
    const entityData = (entity as any).entityData || entity || {};
    const rawType = (entity as any).type || '';
    const oaevType = rawType.replace('oaev-', '');
    const entityPlatformId = (entity as any)._platformId || (entity as any).platformId;
    
    // Find the platform
    const platform = entityPlatformId 
      ? availablePlatforms.find(p => p.id === entityPlatformId)
      : availablePlatforms.find(p => p.type === 'openaev');
    const platformUrl = platform?.url || '';
    
    // Color based on entity type (using shared utility)
    const color = getOAEVEntityColor(oaevType);
    
    // Get entity properties using shared utilities
    const name = getOAEVEntityName(entityData, oaevType);
    const entityId = getOAEVEntityId(entityData, oaevType);
    const entityUrl = getOAEVEntityUrl(platformUrl, oaevType, entityId);
    const mitreId = entityData.attack_pattern_external_id || ''; // For attack patterns
    
    // Extract description based on entity type
    const getDescription = (): string => {
      switch (oaevType) {
        case 'Asset': return entityData.endpoint_description || entityData.asset_description || '';
        case 'AssetGroup': return entityData.asset_group_description || '';
        case 'Player':
        case 'User': return entityData.user_organization || entityData.description || '';
        case 'Team': return entityData.team_description || '';
        case 'Organization': return entityData.organization_description || entityData.description || '';
        case 'AttackPattern': return entityData.attack_pattern_description || '';
        case 'Finding': return entityData.finding_description || `Type: ${entityData.finding_type || 'Unknown'}`;
        case 'Scenario': return entityData.scenario_description || entityData.description || '';
        case 'Exercise': return entityData.exercise_description || entityData.description || '';
        default: return entityData.description || '';
      }
    };
    const description = getDescription();
    
    // Get OpenAEV icon based on type (matches OpenAEV's useEntityIcon.tsx)
    const getOAEVIcon = () => {
      switch (oaevType) {
        case 'Asset': return <ComputerOutlined sx={{ fontSize: 20, color }} />;
        case 'AssetGroup': return <LanOutlined sx={{ fontSize: 20, color }} />;
        case 'Player':
        case 'User': return <PersonOutlined sx={{ fontSize: 20, color }} />;
        case 'Team': return <GroupsOutlined sx={{ fontSize: 20, color }} />;
        case 'Organization': return <DomainOutlined sx={{ fontSize: 20, color }} />;
        case 'Scenario': return <MovieFilterOutlined sx={{ fontSize: 20, color }} />;
        case 'Exercise': return <Kayaking sx={{ fontSize: 20, color }} />;
        case 'AttackPattern': return <LockPattern sx={{ fontSize: 20, color }} />;
        case 'Finding': return <TravelExploreOutlined sx={{ fontSize: 20, color }} />;
        default: return <ComputerOutlined sx={{ fontSize: 20, color }} />;
      }
    };
    
    return (
      <Box sx={{ p: 2, overflow: 'auto' }}>
        {/* Back to search/scan results button */}
        {(entityFromSearchMode || entityFromScanResults) && (
          <Box sx={{ mb: 1.5 }}>
            <Button
              size="small"
              startIcon={<ChevronLeftOutlined />}
              onClick={() => {
                if (entityFromScanResults) {
                  setEntityFromScanResults(false);
                  setMultiPlatformResults([]);
                  setPanelMode('scan-results');
                } else if (entityFromSearchMode) {
                  // Go back to the specific search mode (preserves search results)
                  setMultiPlatformResults([]);
                  setPanelMode(entityFromSearchMode);
                  setEntityFromSearchMode(null);
                }
              }}
              sx={{ 
                color: 'text.secondary',
                textTransform: 'none',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              {entityFromScanResults ? 'Back to scan results' : 'Back to search'}
            </Button>
          </Box>
        )}
        
        {/* Platform indicator bar with navigation */}
        {(availablePlatforms.length > 1 || multiPlatformResults.length > 1) && (
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              mb: 2, 
              p: 1, 
              bgcolor: 'action.hover',
              borderRadius: 1,
              border: 1,
              borderColor: 'divider',
            }}
          >
            {multiPlatformResults.length > 1 ? (
              (() => {
                // Get current platform info for display
                const currentResult = multiPlatformResults[currentPlatformIndex];
                const currentPlatform = availablePlatforms.find(p => p.id === currentResult?.platformId);
                const currentPlatformType = currentPlatform?.type || 'opencti';
                const platformLogo = currentPlatformType === 'openaev' ? 'openaev' : 'opencti';
                
                return (
                  <>
                    <IconButton 
                      size="small" 
                      onClick={async () => {
                        if (currentPlatformIndex > 0) {
                          const prevIndex = currentPlatformIndex - 1;
                          setCurrentPlatformIndex(prevIndex);
                          const prevResult = multiPlatformResults[prevIndex];
                          const prevPlatform = availablePlatforms.find(p => p.id === prevResult.platformId);
                          const prevPlatformType = prevPlatform?.type || 'opencti';
                          
                          // Fetch full entity data when switching platforms
                          // Use the appropriate message type based on platform
                          setPanelMode('loading');
                          try {
                            const entityDataObj = (prevResult.entity as any).entityData || prevResult.entity;
                            // Check multiple possible sources for entity type - prefer entity_type (clean) over type (prefixed)
                            const rawEntityType = entityDataObj?.entity_type || prevResult.entity.type || prevResult.entity.entity_type || entityDataObj?.type || '';
                            // Strip oaev- prefix if present for the API call
                            const entityType = rawEntityType?.replace(/^oaev-/, '');
                            
                            // For OpenAEV entities, use the helper function to get the proper ID
                            // OpenAEV uses type-specific ID fields (e.g., attack_pattern_id, team_id)
                            const entityId = prevPlatformType === 'openaev'
                              ? getOAEVEntityId(entityDataObj, entityType) || entityDataObj.id || (prevResult.entity as any).entityId
                              : prevResult.entity.id || (prevResult.entity as any).entityId || entityDataObj?.id;
                            
                            const messageType = prevPlatformType === 'openaev' 
                              ? 'GET_OAEV_ENTITY_DETAILS' 
                              : 'GET_ENTITY_DETAILS';
                            
                            const response = await chrome.runtime.sendMessage({
                              type: messageType,
                              payload: {
                                id: entityId,
                                entityId: entityId,
                                entityType: entityType,
                                platformId: prevResult.platformId,
                              },
                            });
                            
                            if (response?.success && response.data) {
                              const fullEntity = {
                                ...response.data,
                                _platformId: prevResult.platformId,
                                _platformType: prevPlatformType,
                                _isNonDefaultPlatform: prevPlatformType !== 'opencti',
                              };
                              // Update the multiPlatformResults with full data
                              setMultiPlatformResults(prev => prev.map((r, i) => 
                                i === prevIndex ? { ...r, entity: fullEntity } : r
                              ));
                              setEntity(fullEntity);
                            } else {
                              setEntity({ 
                                ...prevResult.entity, 
                                _platformId: prevResult.platformId,
                                _platformType: prevPlatformType,
                                _isNonDefaultPlatform: prevPlatformType !== 'opencti',
                              });
                            }
                          } catch (error) {
                            setEntity({ 
                              ...prevResult.entity, 
                              _platformId: prevResult.platformId,
                              _platformType: prevPlatformType,
                              _isNonDefaultPlatform: prevPlatformType !== 'opencti',
                            });
                          }
                          setPanelMode('entity');
                          setSelectedPlatformId(prevResult.platformId);
                          if (prevPlatform) setPlatformUrl(prevPlatform.url);
                        }
                      }} 
                      disabled={currentPlatformIndex === 0}
                      sx={{ opacity: currentPlatformIndex === 0 ? 0.3 : 1 }}
                    >
                      <ChevronLeftOutlined />
                    </IconButton>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <img
                        src={typeof chrome !== 'undefined' && chrome.runtime?.getURL 
                          ? chrome.runtime.getURL(`assets/logos/logo_${platformLogo}_${logoSuffix}_embleme_square.svg`)
                          : `../assets/logos/logo_${platformLogo}_${logoSuffix}_embleme_square.svg`
                        }
                        alt={currentPlatformType === 'openaev' ? 'OpenAEV' : 'OpenCTI'}
                        width={18}
                        height={18}
                      />
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {currentPlatform?.name || (currentPlatformType === 'openaev' ? 'OpenAEV' : 'OpenCTI')}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        ({currentPlatformIndex + 1}/{multiPlatformResults.length})
                      </Typography>
                    </Box>
                    <IconButton 
                      size="small" 
                      onClick={async () => {
                        if (currentPlatformIndex < multiPlatformResults.length - 1) {
                          const nextIndex = currentPlatformIndex + 1;
                          setCurrentPlatformIndex(nextIndex);
                          const nextResult = multiPlatformResults[nextIndex];
                          const nextPlatform = availablePlatforms.find(p => p.id === nextResult.platformId);
                          const nextPlatformType = nextPlatform?.type || 'opencti';
                          
                          // Fetch full entity data when switching platforms
                          // Use the appropriate message type based on platform
                          setPanelMode('loading');
                          try {
                            const entityDataObj = (nextResult.entity as any).entityData || nextResult.entity;
                            // Check multiple possible sources for entity type - prefer entity_type (clean) over type (prefixed)
                            const rawEntityType = entityDataObj?.entity_type || nextResult.entity.type || nextResult.entity.entity_type || entityDataObj?.type || '';
                            // Strip oaev- prefix if present for the API call
                            const entityType = rawEntityType?.replace(/^oaev-/, '');
                            
                            // For OpenAEV entities, use the helper function to get the proper ID
                            // OpenAEV uses type-specific ID fields (e.g., attack_pattern_id, team_id)
                            const entityId = nextPlatformType === 'openaev'
                              ? getOAEVEntityId(entityDataObj, entityType) || entityDataObj.id || (nextResult.entity as any).entityId
                              : nextResult.entity.id || (nextResult.entity as any).entityId || entityDataObj?.id;
                            
                            const messageType = nextPlatformType === 'openaev' 
                              ? 'GET_OAEV_ENTITY_DETAILS' 
                              : 'GET_ENTITY_DETAILS';
                            
                            const response = await chrome.runtime.sendMessage({
                              type: messageType,
                              payload: {
                                id: entityId,
                                entityId: entityId,
                                entityType: entityType,
                                platformId: nextResult.platformId,
                              },
                            });
                            
                            if (response?.success && response.data) {
                              const fullEntity = {
                                ...response.data,
                                _platformId: nextResult.platformId,
                                _platformType: nextPlatformType,
                                _isNonDefaultPlatform: nextPlatformType !== 'opencti',
                              };
                              // Update the multiPlatformResults with full data
                              setMultiPlatformResults(prev => prev.map((r, i) => 
                                i === nextIndex ? { ...r, entity: fullEntity } : r
                              ));
                              setEntity(fullEntity);
                            } else {
                              setEntity({ 
                                ...nextResult.entity, 
                                _platformId: nextResult.platformId,
                                _platformType: nextPlatformType,
                                _isNonDefaultPlatform: nextPlatformType !== 'opencti',
                              });
                            }
                          } catch (error) {
                            setEntity({ 
                              ...nextResult.entity, 
                              _platformId: nextResult.platformId,
                              _platformType: nextPlatformType,
                              _isNonDefaultPlatform: nextPlatformType !== 'opencti',
                            });
                          }
                          setPanelMode('entity');
                          setSelectedPlatformId(nextResult.platformId);
                          if (nextPlatform) setPlatformUrl(nextPlatform.url);
                        }
                      }} 
                      disabled={currentPlatformIndex === multiPlatformResults.length - 1}
                      sx={{ opacity: currentPlatformIndex === multiPlatformResults.length - 1 ? 0.3 : 1 }}
                    >
                      <ChevronRightOutlined />
                    </IconButton>
                  </>
                );
              })()
            ) : (() => {
              // Single platform display - determine logo based on entity platform type
              const entityPlatformType = (entity as any)?._platformType || 'opencti';
              const singlePlatformLogo = entityPlatformType === 'openaev' ? 'openaev' : 'opencti';
              const singlePlatform = (entity as any)?._platformId 
                ? availablePlatforms.find(p => p.id === (entity as any)?._platformId)
                : availablePlatforms[0];
              
              return singlePlatform ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', justifyContent: 'center' }}>
                  <img
                    src={typeof chrome !== 'undefined' && chrome.runtime?.getURL 
                      ? chrome.runtime.getURL(`assets/logos/logo_${singlePlatformLogo}_${logoSuffix}_embleme_square.svg`)
                      : `../assets/logos/logo_${singlePlatformLogo}_${logoSuffix}_embleme_square.svg`
                    }
                    alt={entityPlatformType === 'openaev' ? 'OpenAEV' : 'OpenCTI'}
                    width={18}
                    height={18}
                  />
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {singlePlatform.name || (entityPlatformType === 'openaev' ? 'OpenAEV' : 'OpenCTI')}
                  </Typography>
                </Box>
              ) : null;
            })()}
          </Box>
        )}

        {/* Type Badge */}
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 1,
            px: 2,
            py: 1,
            mb: 2,
            borderRadius: 1,
            bgcolor: hexToRGB(color, 0.2),
            border: `2px solid ${color}`,
          }}
        >
          {getOAEVIcon()}
          <Typography variant="body2" sx={{ fontWeight: 700, color, letterSpacing: '0.5px' }}>
            {oaevType.replace(/([A-Z])/g, ' $1').trim()}
          </Typography>
        </Box>

        {/* Name */}
        <Typography variant="h6" sx={{ mb: 1.5, wordBreak: 'break-word', fontWeight: 600 }}>
          {name}
        </Typography>

        {/* Entity-specific details */}
        {oaevType === 'Asset' && (
          <>
            {/* Hostname */}
            {(entityData.endpoint_hostname || entityData.asset_hostname) && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={sectionTitleStyle}>
                  Hostname
                </Typography>
                <Typography variant="body2" sx={contentTextStyle}>
                  {entityData.endpoint_hostname || entityData.asset_hostname}
                </Typography>
              </Box>
            )}
            
            {/* IPs */}
            {((entityData.endpoint_ips || entityData.asset_ips) && (entityData.endpoint_ips || entityData.asset_ips).length > 0) && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={sectionTitleStyle}>
                  IP Addresses
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {(entityData.endpoint_ips || entityData.asset_ips).map((ip: string, i: number) => (
                    <Chip key={i} label={ip} size="small" sx={{ bgcolor: 'action.selected', borderRadius: 1 }} />
                  ))}
                </Box>
              </Box>
            )}
            
            {/* Platform */}
            {(entityData.endpoint_platform || entityData.asset_platform) && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={sectionTitleStyle}>
                  Platform
                </Typography>
                <Chip 
                  label={entityData.endpoint_platform || entityData.asset_platform} 
                  size="small" 
                  sx={{ bgcolor: 'action.selected', borderRadius: 1 }}
                />
              </Box>
            )}
            
            {/* Architecture */}
            {entityData.endpoint_arch && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={sectionTitleStyle}>
                  Architecture
                </Typography>
                <Chip label={entityData.endpoint_arch} size="small" sx={{ bgcolor: 'action.selected', borderRadius: 1 }} />
              </Box>
            )}
            
            {/* Asset Type */}
            {(entityData.asset_type || entityData.endpoint_type) && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={sectionTitleStyle}>
                  Asset Type
                </Typography>
                <Chip label={entityData.asset_type || entityData.endpoint_type} size="small" sx={{ bgcolor: 'action.selected', borderRadius: 1 }} />
              </Box>
            )}
            
            {/* Last Seen */}
            {(entityData.asset_last_seen || entityData.endpoint_last_seen) && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={sectionTitleStyle}>
                  Last Seen
                </Typography>
                <Typography variant="body2" sx={contentTextStyle}>
                  {formatDateTime(entityData.asset_last_seen || entityData.endpoint_last_seen)}
                </Typography>
              </Box>
            )}
            
            {/* MACs */}
            {((entityData.endpoint_mac_addresses || entityData.asset_mac_addresses) && (entityData.endpoint_mac_addresses || entityData.asset_mac_addresses).length > 0) && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={sectionTitleStyle}>
                  MAC Addresses
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {(entityData.endpoint_mac_addresses || entityData.asset_mac_addresses).map((mac: string, i: number) => (
                    <Chip key={i} label={mac} size="small" sx={{ bgcolor: 'action.selected', borderRadius: 1 }} />
                  ))}
                </Box>
              </Box>
            )}
            
            {/* Tags (resolved) */}
            {((entityData.asset_tags_resolved || entityData.endpoint_tags_resolved || entityData.asset_tags || entityData.endpoint_tags) && 
              (entityData.asset_tags_resolved || entityData.endpoint_tags_resolved || entityData.asset_tags || entityData.endpoint_tags).length > 0) && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={sectionTitleStyle}>
                  Tags
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {(entityData.asset_tags_resolved || entityData.endpoint_tags_resolved || entityData.asset_tags || entityData.endpoint_tags).map((tag: string, i: number) => (
                    <Chip key={i} label={tag} size="small" variant="outlined" sx={{ borderRadius: 1 }} />
                  ))}
                </Box>
              </Box>
            )}
          </>
        )}
        
        {oaevType === 'Player' && (
          <>
            {/* Email */}
            {entityData.user_email && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={sectionTitleStyle}>
                  Email
                </Typography>
                <Typography variant="body2" sx={contentTextStyle}>
                  {entityData.user_email}
                </Typography>
              </Box>
            )}
            
            {/* Phone */}
            {entityData.user_phone && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={sectionTitleStyle}>
                  Phone
                </Typography>
                <Typography variant="body2" sx={contentTextStyle}>
                  {entityData.user_phone}
                </Typography>
              </Box>
            )}
            
            {/* Organization */}
            {entityData.user_organization && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={sectionTitleStyle}>
                  Organization
                </Typography>
                <Typography variant="body2" sx={contentTextStyle}>
                  {entityData.user_organization}
                </Typography>
              </Box>
            )}
          </>
        )}
        
        {oaevType === 'AssetGroup' && (
          <>
            {/* Assets count */}
            {entityData.asset_group_assets_number != null && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={sectionTitleStyle}>
                  Assets in Group
                </Typography>
                <Typography variant="body2" sx={contentTextStyle}>
                  {entityData.asset_group_assets_number} endpoint{entityData.asset_group_assets_number !== 1 ? 's' : ''}
                </Typography>
              </Box>
            )}
          </>
        )}
        
        {oaevType === 'Team' && (
          <>
            {/* Members count */}
            {entityData.team_users_number != null && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={sectionTitleStyle}>
                  Team Members
                </Typography>
                <Typography variant="body2" sx={contentTextStyle}>
                  {entityData.team_users_number} player{entityData.team_users_number !== 1 ? 's' : ''}
                </Typography>
              </Box>
            )}
          </>
        )}
        
        {oaevType === 'AttackPattern' && (
          <>
            {/* External ID (e.g., T1234) */}
            {mitreId && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={sectionTitleStyle}>
                  Technique ID
                </Typography>
                <Chip 
                  label={mitreId} 
                  size="small" 
                  sx={{ 
                    bgcolor: hexToRGB(color, 0.2), 
                    color,
                    fontWeight: 600,
                    borderRadius: 1,
                  }} 
                />
              </Box>
            )}
            
            {/* Description */}
            {description && (
              <Box sx={{ mb: 2.5 }}>
                <Typography variant="caption" sx={sectionTitleStyle}>
                  Description
                </Typography>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    ...contentTextStyle,
                    lineHeight: 1.6,
                    maxHeight: 200,
                    overflow: 'auto',
                  }}
                >
                  {description}
                </Typography>
              </Box>
            )}
            
            {/* Kill Chain Phases */}
            {((entityData.attack_pattern_kill_chain_phases) && entityData.attack_pattern_kill_chain_phases.length > 0) && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={sectionTitleStyle}>
                  Kill Chain Phases
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {entityData.attack_pattern_kill_chain_phases.map((phase: string, i: number) => (
                    <Chip 
                      key={i} 
                      label={phase} 
                      size="small" 
                      sx={{ 
                        bgcolor: hexToRGB('#e91e63', 0.15), 
                        color: '#e91e63',
                        fontWeight: 500,
                        borderRadius: 1,
                      }} 
                    />
                  ))}
                </Box>
              </Box>
            )}
            
            {/* Platforms */}
            {((entityData.attack_pattern_platforms) && entityData.attack_pattern_platforms.length > 0) && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={sectionTitleStyle}>
                  Platforms
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {entityData.attack_pattern_platforms.map((platform: string, i: number) => (
                    <Chip key={i} label={platform} size="small" sx={{ bgcolor: 'action.selected', borderRadius: 1 }} />
                  ))}
                </Box>
              </Box>
            )}
            
            {/* Permissions Required */}
            {((entityData.attack_pattern_permissions_required) && entityData.attack_pattern_permissions_required.length > 0) && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={sectionTitleStyle}>
                  Permissions Required
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {entityData.attack_pattern_permissions_required.map((perm: string, i: number) => (
                    <Chip 
                      key={i} 
                      label={perm} 
                      size="small" 
                      sx={{ 
                        bgcolor: hexToRGB('#ff9800', 0.15),
                        color: '#ff9800',
                        fontWeight: 500,
                        borderRadius: 1,
                      }} 
                    />
                  ))}
                </Box>
              </Box>
            )}
            
            {/* Parent Attack Pattern */}
            {entityData.attack_pattern_parent && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={sectionTitleStyle}>
                  Parent Technique
                </Typography>
                <Typography variant="body2" sx={contentTextStyle}>
                  {entityData.attack_pattern_parent}
                </Typography>
              </Box>
            )}
            
            {/* Created Date */}
            {entityData.attack_pattern_created_at && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={sectionTitleStyle}>
                  Created
                </Typography>
                <Typography variant="body2" sx={contentTextStyle}>
                  {formatDateTime(entityData.attack_pattern_created_at)}
                </Typography>
              </Box>
            )}
            
            {/* Updated Date */}
            {entityData.attack_pattern_updated_at && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={sectionTitleStyle}>
                  Last Modified
                </Typography>
                <Typography variant="body2" sx={contentTextStyle}>
                  {formatDateTime(entityData.attack_pattern_updated_at)}
                </Typography>
              </Box>
            )}
          </>
        )}
        
        {oaevType === 'Scenario' && (
          <>
            {/* Subtitle */}
            {(entityData.scenario_subtitle) && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={sectionTitleStyle}>
                  Subtitle
                </Typography>
                <Typography variant="body2" sx={contentTextStyle}>
                  {entityData.scenario_subtitle}
                </Typography>
              </Box>
            )}
            
            {/* Category */}
            {(entityData.scenario_category) && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={sectionTitleStyle}>
                  Category
                </Typography>
                <Chip label={entityData.scenario_category} size="small" sx={{ bgcolor: 'action.selected', borderRadius: 1 }} />
              </Box>
            )}
            
            {/* Severity */}
            {(entityData.scenario_severity) && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={sectionTitleStyle}>
                  Severity
                </Typography>
                <Chip label={entityData.scenario_severity} size="small" sx={{ bgcolor: 'action.selected', borderRadius: 1 }} />
              </Box>
            )}
            
            {/* Tags */}
            {((entityData.scenario_tags_resolved || entityData.scenario_tags) && (entityData.scenario_tags_resolved || entityData.scenario_tags).length > 0) && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={sectionTitleStyle}>
                  Tags
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {(entityData.scenario_tags_resolved || entityData.scenario_tags).map((tag: string, i: number) => (
                    <Chip key={i} label={tag} size="small" variant="outlined" sx={{ borderRadius: 1 }} />
                  ))}
                </Box>
              </Box>
            )}
          </>
        )}
        
        {oaevType === 'Exercise' && (
          <>
            {/* Subtitle */}
            {(entityData.exercise_subtitle) && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={sectionTitleStyle}>
                  Subtitle
                </Typography>
                <Typography variant="body2" sx={contentTextStyle}>
                  {entityData.exercise_subtitle}
                </Typography>
              </Box>
            )}
            
            {/* Category */}
            {(entityData.exercise_category) && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={sectionTitleStyle}>
                  Category
                </Typography>
                <Chip label={entityData.exercise_category} size="small" sx={{ bgcolor: 'action.selected', borderRadius: 1 }} />
              </Box>
            )}
            
            {/* Severity */}
            {(entityData.exercise_severity) && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={sectionTitleStyle}>
                  Severity
                </Typography>
                <Chip label={entityData.exercise_severity} size="small" sx={{ bgcolor: 'action.selected', borderRadius: 1 }} />
              </Box>
            )}
            
            {/* Start date */}
            {(entityData.exercise_start_date) && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={sectionTitleStyle}>
                  Start Date
                </Typography>
                <Typography variant="body2" sx={contentTextStyle}>
                  {formatDate(entityData.exercise_start_date)}
                </Typography>
              </Box>
            )}
            
            {/* Tags */}
            {((entityData.exercise_tags_resolved || entityData.exercise_tags) && (entityData.exercise_tags_resolved || entityData.exercise_tags).length > 0) && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={sectionTitleStyle}>
                  Tags
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {(entityData.exercise_tags_resolved || entityData.exercise_tags).map((tag: string, i: number) => (
                    <Chip key={i} label={tag} size="small" variant="outlined" sx={{ borderRadius: 1 }} />
                  ))}
                </Box>
              </Box>
            )}
          </>
        )}
        
        {(oaevType === 'User') && (
          <>
            {/* Email */}
            {entityData.user_email && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={sectionTitleStyle}>
                  Email
                </Typography>
                <Typography variant="body2" sx={contentTextStyle}>
                  {entityData.user_email}
                </Typography>
              </Box>
            )}
            
            {/* Phone */}
            {entityData.user_phone && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={sectionTitleStyle}>
                  Phone
                </Typography>
                <Typography variant="body2" sx={contentTextStyle}>
                  {entityData.user_phone}
                </Typography>
              </Box>
            )}
            
            {/* Organization */}
            {entityData.user_organization && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={sectionTitleStyle}>
                  Organization
                </Typography>
                <Typography variant="body2" sx={contentTextStyle}>
                  {entityData.user_organization}
                </Typography>
              </Box>
            )}
          </>
        )}
        
        {oaevType === 'Finding' && (
          <>
            {/* Finding Type */}
            {entityData.finding_type && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={sectionTitleStyle}>
                  Type
                </Typography>
                <Chip 
                  label={entityData.finding_type} 
                  size="small" 
                  sx={{ 
                    bgcolor: hexToRGB(color, 0.2), 
                    color,
                    fontWeight: 600,
                    borderRadius: 1,
                  }} 
                />
              </Box>
            )}
            
            {/* Finding Value */}
            {entityData.finding_value && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={sectionTitleStyle}>
                  Value
                </Typography>
                <Typography variant="body2" sx={{ ...contentTextStyle, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  {entityData.finding_value}
                </Typography>
              </Box>
            )}
            
            {/* Finding Created At */}
            {entityData.finding_created_at && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={sectionTitleStyle}>
                  Created
                </Typography>
                <Typography variant="body2" sx={contentTextStyle}>
                  {formatDateTime(entityData.finding_created_at)}
                </Typography>
              </Box>
            )}
            
            {/* Associated Assets */}
            {entityData.finding_assets && entityData.finding_assets.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={sectionTitleStyle}>
                  Assets
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {entityData.finding_assets.map((asset: { asset_id: string; asset_name: string }, i: number) => (
                    <Chip key={i} label={asset.asset_name || asset.asset_id} size="small" sx={{ bgcolor: 'action.selected', borderRadius: 1 }} />
                  ))}
                </Box>
              </Box>
            )}
            
            {/* Associated Asset Groups */}
            {entityData.finding_asset_groups && entityData.finding_asset_groups.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={sectionTitleStyle}>
                  Asset Groups
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {entityData.finding_asset_groups.map((group: { asset_group_id: string; asset_group_name: string }, i: number) => (
                    <Chip key={i} label={group.asset_group_name || group.asset_group_id} size="small" sx={{ bgcolor: 'action.selected', borderRadius: 1 }} />
                  ))}
                </Box>
              </Box>
            )}
          </>
        )}
        
        {oaevType === 'Organization' && (
          <>
            {/* Organization Description is handled below */}
          </>
        )}

        {/* Description (common to all types) */}
        {description && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" sx={sectionTitleStyle}>
              Description
            </Typography>
            <Typography variant="body2" sx={contentTextStyle}>
              {description}
            </Typography>
          </Box>
        )}
        
        {/* Tags (for AssetGroup and Team entities - resolved if available) */}
        {(oaevType === 'AssetGroup' || oaevType === 'Team') && (() => {
          const tags = oaevType === 'AssetGroup' 
            ? (entityData.asset_group_tags_resolved || entityData.asset_group_tags)
            : (entityData.team_tags_resolved || entityData.team_tags);
          return tags && tags.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" sx={sectionTitleStyle}>
                Tags
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {tags.map((tag: string, i: number) => (
                  <Chip key={i} label={tag} size="small" variant="outlined" sx={{ borderRadius: 1 }} />
                ))}
              </Box>
            </Box>
          );
        })()}

        <Divider sx={{ my: 2 }} />

        {/* Actions */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          {entityUrl && (
            <Button
              variant="contained"
              size="small"
              startIcon={
                <img 
                  src={`../assets/logos/logo_openaev_${mode === 'dark' ? 'light' : 'dark'}-theme_embleme_square.svg`} 
                  alt="" 
                  style={{ width: 18, height: 18 }} 
                />
              }
              onClick={() => {
                if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
                  chrome.tabs.create({ url: entityUrl });
                } else {
                  window.open(entityUrl, '_blank');
                }
              }}
              fullWidth
            >
              Open in OpenAEV
            </Button>
          )}
          {name && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<ContentCopyOutlined />}
              onClick={() => handleCopyValue(name)}
            >
              Copy
            </Button>
          )}
        </Box>
      </Box>
    );
  };

  const renderEntityView = () => {
    if (!entity) return null;
    
    // Check if this is a non-default platform entity (any platform other than OpenCTI)
    const entityType = (entity as any).type || '';
    const isNonDefaultPlatformEntity = (entity as any)._isNonDefaultPlatform || 
      (entity as any)._platformType !== 'opencti' ||
      parsePrefixedType(entityType) !== null;
    
    // If non-default platform entity, render platform-specific view
    // TODO: When adding new platforms, add switch/case for different platform renderers
    if (isNonDefaultPlatformEntity) {
      const platformType = (entity as any)._platformType || 
        (parsePrefixedType(entityType)?.platformType) || 'openaev';
      
      // Render appropriate view based on platform
      switch (platformType) {
        case 'openaev':
          return renderOAEVEntityView();
        // Add new platform cases here as they are implemented
        // case 'opengrc':
        //   return renderOpenGRCEntityView();
        default:
          return renderOAEVEntityView(); // Fallback to generic non-default view
      }
    }
    
    // Entity might be a DetectedSDO/DetectedObservable with entityData, or direct entity data
    const entityData = (entity as any).entityData || entity || {};
    // Get entityId from multiple possible locations (cache data, fetched data, or direct)
    const entityId = (entity as any).entityId || entityData?.id || entity?.id;
    const entityPlatformId = (entity as any)._platformId || (entity as any).platformId;
    
    const type = entityData.entity_type || entity.type || 'unknown';
    const color = itemColor(type, mode === 'dark');
    const name = entityData.representative?.main || entityData.name || entity.value || entity.name || 'Unknown';
    const description = entityData.description || entity.description;
    const aliases = entityData.aliases || entity.aliases;
    const objectLabel = entityData.objectLabel || entity.objectLabel;
    const objectMarking = entityData.objectMarking || entity.objectMarking;
    const created = entityData.created || entity.created;
    const modified = entityData.modified || entity.modified;
    
    // Author and creators
    const author = entityData.createdBy || entity.createdBy;
    const creators = entityData.creators || entity.creators;
    
    // Get current platform info
    const currentPlatform = entityPlatformId 
      ? availablePlatforms.find(p => p.id === entityPlatformId)
      : availablePlatforms[0];
    const hasMultiplePlatforms = multiPlatformResults.length > 1;
    
    // Determine if this is an observable or SDO
    const observableTypes = ['IPv4-Addr', 'IPv6-Addr', 'Domain-Name', 'Hostname', 'Url', 'Email-Addr', 'Mac-Addr', 'StixFile', 'Artifact', 'Cryptocurrency-Wallet', 'User-Agent', 'Phone-Number', 'Bank-Account'];
    const isObservable = observableTypes.some(t => type.toLowerCase().includes(t.toLowerCase().replace(/-/g, ''))) || 
                         type.includes('Addr') || type.includes('Observable');
    const isIndicator = type.toLowerCase() === 'indicator';
    
    // Confidence is for SDOs (not observables), Score is for observables and indicators
    const confidence = (!isObservable && !isIndicator) ? (entityData.confidence ?? entity.confidence) : undefined;
    const score = (isObservable || isIndicator) ? (entityData.x_opencti_score ?? entity.x_opencti_score) : undefined;
    
    // CVSS fields for vulnerabilities
    const cvssScore = entityData.x_opencti_cvss_base_score;
    const cvssSeverity = entityData.x_opencti_cvss_base_severity;
    const cvssAttackVector = entityData.x_opencti_cvss_attack_vector;
    const cisaKev = entityData.x_opencti_cisa_kev;
    const epssScore = entityData.x_opencti_epss_score;
    const epssPercentile = entityData.x_opencti_epss_percentile;

    const isVulnerability = type.toLowerCase() === 'vulnerability';

    // Platform navigation handlers - fetch full entity data when switching
    const handlePrevPlatform = async () => {
      if (currentPlatformIndex > 0) {
        const prevIndex = currentPlatformIndex - 1;
        setCurrentPlatformIndex(prevIndex);
        const prevResult = multiPlatformResults[prevIndex];
        const platform = availablePlatforms.find(p => p.id === prevResult.platformId);
        const platformType = platform?.type || 'opencti';
        
        // Fetch full entity data when switching platforms
        // Use the appropriate message type based on platform
        setPanelMode('loading');
        try {
          const entityDataObj = (prevResult.entity as any).entityData || prevResult.entity;
          // Check multiple possible sources for entity type - prefer entity_type (clean) over type (prefixed)
          const rawEntityType = entityDataObj?.entity_type || prevResult.entity.type || prevResult.entity.entity_type || entityDataObj?.type || '';
          // Strip oaev- prefix if present for the API call
          const entityType = rawEntityType?.replace(/^oaev-/, '');
          
          // For OpenAEV entities, get the ID from multiple possible sources
          // Priority: entityId on result > getOAEVEntityId helper > id field
          const entityIdToFetch = platformType === 'openaev'
            ? (prevResult.entity as any).entityId || getOAEVEntityId(entityDataObj, entityType) || entityDataObj?.id || ''
            : prevResult.entity.id || (prevResult.entity as any).entityId || entityDataObj?.id;
          
          const messageType = platformType === 'openaev' 
            ? 'GET_OAEV_ENTITY_DETAILS' 
            : 'GET_ENTITY_DETAILS';
          
          const response = await chrome.runtime.sendMessage({
            type: messageType,
            payload: {
              id: entityIdToFetch,
              entityId: entityIdToFetch,
              entityType: entityType,
              platformId: prevResult.platformId,
            },
          });
          
          if (response?.success && response.data) {
            // Preserve the original type from prevResult.entity for view rendering
            const originalType = prevResult.entity.type || prevResult.entity.entity_type || '';
            const fullEntity = {
              ...response.data,
              type: originalType, // Preserve type for view rendering
              entity_type: originalType.replace(/^oaev-/, ''), // Clean type
              _platformId: prevResult.platformId,
              _platformType: platformType,
              _isNonDefaultPlatform: platformType !== 'opencti',
            };
            // Update the multiPlatformResults with full data
            setMultiPlatformResults(prev => prev.map((r, i) => 
              i === prevIndex ? { ...r, entity: fullEntity } : r
            ));
            setEntity(fullEntity);
          } else {
            setEntity({ 
              ...prevResult.entity, 
              _platformId: prevResult.platformId,
              _platformType: platformType,
              _isNonDefaultPlatform: platformType !== 'opencti',
            });
          }
        } catch (error) {
          setEntity({ 
            ...prevResult.entity, 
            _platformId: prevResult.platformId,
            _platformType: platformType,
            _isNonDefaultPlatform: platformType !== 'opencti',
          });
        }
        setPanelMode('entity');
        setSelectedPlatformId(prevResult.platformId);
        if (platform) setPlatformUrl(platform.url);
      }
    };

    const handleNextPlatform = async () => {
      if (currentPlatformIndex < multiPlatformResults.length - 1) {
        const nextIndex = currentPlatformIndex + 1;
        setCurrentPlatformIndex(nextIndex);
        const nextResult = multiPlatformResults[nextIndex];
        const platform = availablePlatforms.find(p => p.id === nextResult.platformId);
        const platformType = platform?.type || 'opencti';
        
        // Fetch full entity data when switching platforms
        // Use the appropriate message type based on platform
        setPanelMode('loading');
        try {
          const entityDataObj = (nextResult.entity as any).entityData || nextResult.entity;
          // Check multiple possible sources for entity type - prefer entity_type (clean) over type (prefixed)
          const rawEntityType = entityDataObj?.entity_type || nextResult.entity.type || nextResult.entity.entity_type || entityDataObj?.type || '';
          // Strip oaev- prefix if present for the API call
          const entityType = rawEntityType?.replace(/^oaev-/, '');
          
          // For OpenAEV entities, get the ID from multiple possible sources
          // Priority: entityId on result > getOAEVEntityId helper > id field
          const entityIdToFetch = platformType === 'openaev'
            ? (nextResult.entity as any).entityId || getOAEVEntityId(entityDataObj, entityType) || entityDataObj?.id || ''
            : nextResult.entity.id || (nextResult.entity as any).entityId || entityDataObj?.id;
          
          const messageType = platformType === 'openaev' 
            ? 'GET_OAEV_ENTITY_DETAILS' 
            : 'GET_ENTITY_DETAILS';
          
          const response = await chrome.runtime.sendMessage({
            type: messageType,
            payload: {
              id: entityIdToFetch,
              entityId: entityIdToFetch,
              entityType: entityType,
              platformId: nextResult.platformId,
            },
          });
          
          if (response?.success && response.data) {
            // Preserve the original type from nextResult.entity for view rendering
            const originalType = nextResult.entity.type || nextResult.entity.entity_type || '';
            const fullEntity = {
              ...response.data,
              type: originalType, // Preserve type for view rendering
              entity_type: originalType.replace(/^oaev-/, ''), // Clean type
              _platformId: nextResult.platformId,
              _platformType: platformType,
              _isNonDefaultPlatform: platformType !== 'opencti',
            };
            // Update the multiPlatformResults with full data
            setMultiPlatformResults(prev => prev.map((r, i) => 
              i === nextIndex ? { ...r, entity: fullEntity } : r
            ));
            setEntity(fullEntity);
          } else {
            setEntity({ 
              ...nextResult.entity, 
              _platformId: nextResult.platformId,
              _platformType: platformType,
              _isNonDefaultPlatform: platformType !== 'opencti',
            });
          }
        } catch (error) {
          setEntity({ 
            ...nextResult.entity, 
            _platformId: nextResult.platformId,
            _platformType: platformType,
            _isNonDefaultPlatform: platformType !== 'opencti',
          });
        }
        setPanelMode('entity');
        setSelectedPlatformId(nextResult.platformId);
        if (platform) setPlatformUrl(platform.url);
      }
    };

    // Handle back to search/scan results
    const handleBackToList = () => {
      if (entityFromScanResults) {
        setEntityFromScanResults(false);
        setMultiPlatformResults([]);
        setPanelMode('scan-results');
      } else if (entityFromSearchMode) {
        // Go back to the specific search mode (preserves search results)
        setMultiPlatformResults([]);
        setPanelMode(entityFromSearchMode);
        setEntityFromSearchMode(null);
      }
    };

    return (
      <Box sx={{ p: 2, overflow: 'auto' }}>
        {/* Back to search/scan results button */}
        {(entityFromSearchMode || entityFromScanResults) && (
          <Box sx={{ mb: 1.5 }}>
            <Button
              size="small"
              startIcon={<ChevronLeftOutlined />}
              onClick={handleBackToList}
              sx={{ 
                color: 'text.secondary',
                textTransform: 'none',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              {entityFromScanResults ? 'Back to scan results' : 'Back to search'}
            </Button>
          </Box>
        )}
        
        {/* Platform indicator bar */}
        {(availablePlatforms.length > 1 || hasMultiplePlatforms) && (() => {
          // Determine current platform type for logo display
          const currentPlatformType = currentPlatform?.type || 'opencti';
          const platformLogo = currentPlatformType === 'openaev' ? 'openaev' : 'opencti';
          const platformAlt = currentPlatformType === 'openaev' ? 'OpenAEV' : 'OpenCTI';
          
          return (
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              mb: 2, 
              p: 1, 
              bgcolor: 'action.hover',
              borderRadius: 1,
              border: 1,
              borderColor: 'divider',
            }}
          >
            {hasMultiplePlatforms ? (
              <>
                <IconButton 
                  size="small" 
                  onClick={handlePrevPlatform} 
                  disabled={currentPlatformIndex === 0}
                  sx={{ opacity: currentPlatformIndex === 0 ? 0.3 : 1 }}
                >
                  <ChevronLeftOutlined />
                </IconButton>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <img
                    src={typeof chrome !== 'undefined' && chrome.runtime?.getURL 
                      ? chrome.runtime.getURL(`assets/logos/logo_${platformLogo}_${logoSuffix}_embleme_square.svg`)
                      : `../assets/logos/logo_${platformLogo}_${logoSuffix}_embleme_square.svg`
                    }
                    alt={platformAlt}
                    width={18}
                    height={18}
                  />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {currentPlatform?.name || platformAlt}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    ({currentPlatformIndex + 1}/{multiPlatformResults.length})
                  </Typography>
                </Box>
                <IconButton 
                  size="small" 
                  onClick={handleNextPlatform} 
                  disabled={currentPlatformIndex === multiPlatformResults.length - 1}
                  sx={{ opacity: currentPlatformIndex === multiPlatformResults.length - 1 ? 0.3 : 1 }}
                >
                  <ChevronRightOutlined />
                </IconButton>
              </>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', justifyContent: 'center' }}>
                <img
                  src={typeof chrome !== 'undefined' && chrome.runtime?.getURL 
                    ? chrome.runtime.getURL(`assets/logos/logo_${platformLogo}_${logoSuffix}_embleme_square.svg`)
                    : `../assets/logos/logo_${platformLogo}_${logoSuffix}_embleme_square.svg`
                  }
                  alt={platformAlt}
                  width={18}
                  height={18}
                />
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {currentPlatform?.name || platformAlt}
                </Typography>
              </Box>
            )}
          </Box>
          );
        })()}

        {/* Type Badge - More visible */}
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 1,
            px: 2,
            py: 1,
            mb: 2,
            borderRadius: 1,
            bgcolor: hexToRGB(color, 0.2),
            border: `2px solid ${color}`,
          }}
        >
          <ItemIcon type={type} size="small" color={color} />
          <Typography variant="body2" sx={{ fontWeight: 700, color, textTransform: 'capitalize', letterSpacing: '0.5px' }}>
            {type.replace(/-/g, ' ')}
          </Typography>
        </Box>

        {/* Name */}
        <Typography variant="h6" sx={{ mb: 1, wordBreak: 'break-word', fontWeight: 600 }}>
          {name}
        </Typography>

        {/* Vulnerability-specific: CVSS Scores */}
        {isVulnerability && (cvssScore != null || cvssSeverity) && (
          <Box sx={{ mb: 2.5, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            {cvssScore != null && (
              <Chip
                icon={<SecurityOutlined sx={{ fontSize: 16 }} />}
                label={`CVSS ${cvssScore.toFixed(1)}`}
                sx={getCvssChipStyle(cvssScore)}
              />
            )}
            {cvssSeverity && (
              <Chip
                label={cvssSeverity.toUpperCase()}
                sx={{
                  fontWeight: 700,
                  fontSize: 12,
                  height: 34,
                  ...getSeverityColor(cvssSeverity),
                }}
              />
            )}
            {cisaKev && (
              <Chip
                icon={<WarningAmberOutlined sx={{ fontSize: 16 }} />}
                label="CISA KEV"
                sx={{
                  fontWeight: 700,
                  fontSize: 12,
                  height: 34,
                  bgcolor: '#d32f2f',
                  color: '#ffffff',
                  '& .MuiChip-icon': { color: '#ffffff' },
                }}
              />
            )}
          </Box>
        )}

        {/* Vulnerability: EPSS Score */}
        {isVulnerability && (epssScore !== undefined || epssPercentile !== undefined) && (
          <Box sx={{ mb: 2.5 }}>
            <Typography variant="caption" sx={sectionTitleStyle}>
              EPSS (Exploit Prediction)
            </Typography>
            <Box sx={{ display: 'flex', gap: 3 }}>
              {epssScore != null && (
                <Box>
                  <Typography variant="body1" sx={{ fontWeight: 700, ...contentTextStyle }}>
                    {(epssScore * 100).toFixed(2)}%
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>Score</Typography>
                </Box>
              )}
              {epssPercentile != null && (
                <Box>
                  <Typography variant="body1" sx={{ fontWeight: 700, ...contentTextStyle }}>
                    {(epssPercentile * 100).toFixed(1)}%
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>Percentile</Typography>
                </Box>
              )}
            </Box>
          </Box>
        )}

        {/* Vulnerability: Attack Vector */}
        {isVulnerability && cvssAttackVector && (
          <Box sx={{ mb: 2.5 }}>
            <Typography variant="caption" sx={sectionTitleStyle}>
              Attack Vector
            </Typography>
            <Chip 
              label={cvssAttackVector} 
              size="small" 
              sx={{ 
                bgcolor: 'action.selected',
                fontWeight: 500,
                borderRadius: 1,
              }} 
            />
          </Box>
        )}

        {/* Description - Rendered as Markdown */}
        {description && (
          <Box sx={{ mb: 2.5 }}>
            <Typography variant="caption" sx={sectionTitleStyle}>
              Description
            </Typography>
            <Box 
              className="markdown-content"
              sx={{ 
                ...contentTextStyle,
                '& p': { margin: '0 0 8px 0' },
                '& p:last-child': { margin: 0 },
                '& a': { color: 'primary.main', textDecoration: 'none' },
                '& a:hover': { textDecoration: 'underline' },
                '& code': { 
                  bgcolor: 'action.hover', 
                  px: 0.5, 
                  py: 0.25, 
                  borderRadius: 0.5,
                  fontSize: '0.875em',
                },
                '& pre': { 
                  bgcolor: 'action.hover', 
                  p: 1, 
                  borderRadius: 1,
                  overflow: 'auto',
                  fontSize: '0.875em',
                },
                '& ul, & ol': { pl: 2, my: 1 },
                '& li': { mb: 0.5 },
                '& blockquote': { 
                  borderLeft: 3, 
                  borderColor: 'divider', 
                  pl: 1.5, 
                  my: 1,
                  color: 'text.secondary',
                },
              }}
            >
              <Markdown remarkPlugins={[remarkGfm]}>
                {description.length > 500 ? description.slice(0, 500) + '...' : description}
              </Markdown>
            </Box>
          </Box>
        )}

        {/* Aliases */}
        {aliases && aliases.length > 0 && (
          <Box sx={{ mb: 2.5 }}>
            <Typography variant="caption" sx={sectionTitleStyle}>
              Aliases
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {aliases.slice(0, 8).map((alias: string, i: number) => (
                <Chip 
                  key={i} 
                  label={alias} 
                  size="small" 
                  sx={{ 
                    borderRadius: 1, 
                    bgcolor: 'action.selected',
                    fontWeight: 500,
                  }} 
                />
              ))}
              {aliases.length > 8 && (
                <Chip 
                  label={`+${aliases.length - 8}`} 
                  size="small" 
                  sx={{ bgcolor: 'action.hover', fontWeight: 600 }}
                />
              )}
            </Box>
          </Box>
        )}

        {/* Author and Creator Section */}
        {(author || (creators && creators.length > 0)) && (
          <Box sx={{ mb: 2.5 }}>
            {author && (
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="caption" sx={sectionTitleStyle}>
                  Author
                </Typography>
                {author.id && platformUrl ? (
                  <Typography 
                    variant="body2" 
                    onClick={() => handleOpenInPlatform(author.id)}
                    sx={{ 
                      fontWeight: 500, 
                      ...contentTextStyle,
                      color: 'primary.main',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.5,
                      '&:hover': { textDecoration: 'underline' },
                    }}
                  >
                    {author.name}
                    <OpenInNewOutlined sx={{ fontSize: 14 }} />
                  </Typography>
                ) : (
                  <Typography variant="body2" sx={{ fontWeight: 500, ...contentTextStyle }}>
                    {author.name}
                  </Typography>
                )}
              </Box>
            )}
            {creators && creators.length > 0 && (
              <Box>
                <Typography variant="caption" sx={sectionTitleStyle}>
                  Creator{creators.length > 1 ? 's' : ''}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {creators.map((c: { id: string; name: string }, idx: number) => (
                    <Typography key={c.id || idx} variant="body2" sx={{ fontWeight: 500, ...contentTextStyle }}>
                      {c.name}
                    </Typography>
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        )}

        {/* Confidence - only for SDOs (not observables or indicators) */}
        {confidence !== undefined && confidence !== null && (
          <Box sx={{ mb: 2.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
              <Typography variant="caption" sx={sectionTitleStyle}>
                Confidence Level
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, ...contentTextStyle }}>
                {confidence}/100
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={confidence || 0}
              sx={{
                height: 10,
                borderRadius: 1,
                bgcolor: 'action.hover',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 1,
                  bgcolor: confidence >= 70 ? '#4caf50' :
                    confidence >= 40 ? '#ff9800' : '#f44336',
                },
              }}
            />
          </Box>
        )}

        {/* Score - for observables and indicators */}
        {score !== undefined && score !== null && (
          <Box sx={{ mb: 2.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
              <Typography variant="caption" sx={sectionTitleStyle}>
                Score
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, ...contentTextStyle }}>
                {score}/100
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={score || 0}
              sx={{
                height: 10,
                borderRadius: 1,
                bgcolor: 'action.hover',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 1,
                  bgcolor: score >= 70 ? '#f44336' :
                    score >= 40 ? '#ff9800' : '#4caf50',
                },
              }}
            />
          </Box>
        )}

        {/* Labels - OpenCTI style: outlined with colored border */}
        {objectLabel && objectLabel.length > 0 && (
          <Box sx={{ mb: 2.5 }}>
            <Typography variant="caption" sx={sectionTitleStyle}>
              Labels
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {objectLabel.map((label: any, i: number) => (
                <Chip
                  key={i}
                  label={label.value}
                  size="small"
                  variant="outlined"
                  sx={{ 
                    color: label.color,
                    borderColor: label.color,
                    bgcolor: hexToRGB(label.color, 0.08),
                    fontWeight: 500,
                    borderRadius: 1,
                  }}
                />
              ))}
            </Box>
          </Box>
        )}

        {/* Markings - OpenCTI style: bordered with semi-transparent background */}
        {objectMarking && objectMarking.length > 0 && (
          <Box sx={{ mb: 2.5 }}>
            <Typography variant="caption" sx={sectionTitleStyle}>
              Marking Definitions
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {objectMarking.map((marking: any, i: number) => {
                const markingColor = marking.x_opencti_color || getMarkingColor(marking.definition);
                return (
                  <Chip 
                    key={i} 
                    label={marking.definition} 
                    size="small" 
                    sx={{
                      borderRadius: 1,
                      fontWeight: 600,
                      fontSize: 12,
                      height: 25,
                      bgcolor: hexToRGB(markingColor, 0.2),
                      color: mode === 'dark' ? '#ffffff' : 'text.primary',
                      border: `2px solid ${markingColor}`,
                    }}
                  />
                );
              })}
            </Box>
          </Box>
        )}

        {/* Dates Section - All 4 dates as in OpenCTI */}
        {(created || modified || entityData.created_at || entityData.updated_at || entityData.first_seen || entityData.last_seen) && (
          <Paper 
            elevation={0} 
            sx={{ 
              mb: 2.5, 
              p: 2, 
              borderRadius: 1, 
              bgcolor: mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
              border: 1,
              borderColor: 'divider',
            }}
          >
            <Typography variant="caption" sx={sectionTitleStyle}>
              Dates
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
              {/* STIX dates */}
              {created && (
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.25 }}>
                    Created (STIX)
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, ...contentTextStyle }}>
                    {formatDate(created)}
                  </Typography>
                </Box>
              )}
              {modified && (
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.25 }}>
                    Modified (STIX)
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, ...contentTextStyle }}>
                    {formatDate(modified)}
                  </Typography>
                </Box>
              )}
              {/* Platform dates */}
              {entityData.created_at && (
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.25 }}>
                    Created (Platform)
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, ...contentTextStyle }}>
                    {formatDate(entityData.created_at)}
                  </Typography>
                </Box>
              )}
              {entityData.updated_at && (
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.25 }}>
                    Updated (Platform)
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, ...contentTextStyle }}>
                    {formatDate(entityData.updated_at)}
                  </Typography>
                </Box>
              )}
              {/* Activity dates */}
              {entityData.first_seen && (
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.25 }}>
                    First Seen
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, ...contentTextStyle }}>
                    {formatDate(entityData.first_seen)}
                  </Typography>
                </Box>
              )}
              {entityData.last_seen && (
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.25 }}>
                    Last Seen
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, ...contentTextStyle }}>
                    {formatDate(entityData.last_seen)}
                  </Typography>
                </Box>
              )}
            </Box>
          </Paper>
        )}

        {/* Containers Section */}
        {entityContainers.length > 0 && (
          <Box sx={{ mb: 2.5 }}>
            <Typography variant="caption" sx={sectionTitleStyle}>
              Latest Containers ({entityContainers.length})
            </Typography>
            <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
              {entityContainers.map((container, idx) => {
                const containerColor = itemColor(container.entity_type, mode === 'dark');
                return (
                  <Box
                    key={container.id}
                    onClick={() => handleOpenInPlatform(container.id)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      p: 1.5,
                      cursor: 'pointer',
                      borderBottom: idx < entityContainers.length - 1 ? 1 : 0,
                      borderColor: 'divider',
                      transition: 'background-color 0.2s',
                      '&:hover': {
                        bgcolor: 'action.hover',
                      },
                    }}
                  >
                    <ItemIcon type={container.entity_type} size="small" color={containerColor} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            fontWeight: 500, 
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            ...contentTextStyle,
                          }}
                        >
                          {container.name}
                        </Typography>
                      </Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {container.createdBy?.name && (
                          <>
                            <span>{container.createdBy.name}</span>
                            <span>•</span>
                          </>
                        )}
                        {container.created && (
                          <span>{formatDate(container.created)}</span>
                        )}
                      </Typography>
                    </Box>
                    <OpenInNewOutlined fontSize="small" sx={{ color: 'text.secondary', opacity: 0.5 }} />
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}
        {loadingContainers && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
            <CircularProgress size={16} />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Loading containers...
            </Typography>
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Actions */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          {entityId && platformUrl && (
            <Button
              variant="contained"
              size="small"
              startIcon={
                <img 
                  src={typeof chrome !== 'undefined' && chrome.runtime?.getURL 
                    ? chrome.runtime.getURL(`assets/logos/logo_opencti_${mode === 'dark' ? 'light' : 'dark'}-theme_embleme_square.svg`)
                    : `../assets/logos/logo_opencti_${mode === 'dark' ? 'light' : 'dark'}-theme_embleme_square.svg`
                  } 
                  alt="" 
                  style={{ width: 18, height: 18 }} 
                />
              }
              onClick={() => handleOpenInPlatform(entityId)}
              fullWidth
            >
              Open in OpenCTI
            </Button>
          )}
          {(entity.value || name) && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<ContentCopyOutlined />}
              onClick={() => handleCopyValue(entity.value || name || '')}
            >
              Copy
            </Button>
          )}
        </Box>
      </Box>
    );
  };

  const renderNotFoundView = () => {
    if (!entity) return null;
    const type = entity.type || 'unknown';
    const color = itemColor(type, mode === 'dark');
    const value = entity.value || entity.name || 'Unknown';

    return (
      <Box sx={{ p: 2 }}>
        {/* Back to scan results button */}
        {entityFromScanResults && (
          <Box sx={{ mb: 1.5 }}>
            <Button
              size="small"
              startIcon={<ChevronLeftOutlined />}
              onClick={() => {
                setEntityFromScanResults(false);
                setPanelMode('scan-results');
              }}
              sx={{ 
                color: 'text.secondary',
                textTransform: 'none',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              Back to scan results
            </Button>
          </Box>
        )}
        
        <Alert severity="warning" sx={{ mb: 2, borderRadius: 1 }}>
          This entity was not found in OpenCTI
        </Alert>

        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.75,
            px: 1.5,
            py: 0.5,
            mb: 2,
            borderRadius: 1,
            bgcolor: hexToRGB(color, 0.15),
            border: `1px solid ${hexToRGB(color, 0.3)}`,
          }}
        >
          <ItemIcon type={type} size="small" color={color} />
          <Typography variant="caption" sx={{ fontWeight: 600, color, textTransform: 'capitalize' }}>
            {type.replace(/-/g, ' ')}
          </Typography>
        </Box>

        <Typography variant="h6" sx={{ mb: 2, wordBreak: 'break-word' }}>
          {value}
        </Typography>

        <Button
          variant="contained"
          startIcon={<AddOutlined />}
          onClick={() => {
            setEntitiesToAdd([entity]);
            setPanelMode('add');
          }}
          fullWidth
        >
          Add to OpenCTI
        </Button>
      </Box>
    );
  };

  const renderAddView = () => (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 1 }}>Add to OpenCTI</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        The following entities will be created:
      </Typography>

      <Box sx={{ maxHeight: 300, overflow: 'auto', mb: 2 }}>
        {entitiesToAdd.map((e, i) => (
          <Paper
            key={i}
            elevation={0}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              p: 1.5,
              mb: 1,
              bgcolor: 'background.paper',
              borderRadius: 1,
            }}
          >
            <ItemIcon type={e.type} size="small" />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: 'break-word' }}>
                {e.value || e.name}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'capitalize' }}>
                {e.type?.replace(/-/g, ' ')}
              </Typography>
            </Box>
          </Paper>
        ))}
      </Box>

      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          variant="contained"
          onClick={handleAddEntities}
          disabled={submitting}
          fullWidth
        >
          {submitting ? 'Creating...' : 'Create Entities'}
        </Button>
        <Button variant="outlined" onClick={() => setPanelMode('empty')}>
          Cancel
        </Button>
      </Box>
    </Box>
  );

  const renderImportResultsView = () => {
    if (!importResults) return null;
    
    const logoSuffix = mode === 'dark' ? 'dark-theme' : 'light-theme';
    
    // Group created entities by type for statistics
    const typeStats = importResults.created.reduce((acc, entity) => {
      const type = entity.type || 'unknown';
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(entity);
      return acc;
    }, {} as Record<string, typeof importResults.created>);
    
    const sortedTypes = Object.entries(typeStats).sort((a, b) => b[1].length - a[1].length);
    
    return (
      <Box sx={{ p: 2 }}>
        {/* Success/Error header */}
        <Box 
          sx={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center', 
            textAlign: 'center',
            mb: 3,
            p: 3,
            bgcolor: importResults.success ? 'success.main' : 'error.main',
            borderRadius: 2,
            color: 'white',
          }}
        >
          {importResults.success ? (
            <CheckCircleOutlined sx={{ fontSize: 48, mb: 1 }} />
          ) : (
            <ErrorOutline sx={{ fontSize: 48, mb: 1 }} />
          )}
          <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.5 }}>
            {importResults.success ? 'Import Successful!' : 'Import Failed'}
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.9 }}>
            {importResults.success 
              ? `${importResults.created.length} entit${importResults.created.length === 1 ? 'y' : 'ies'} created in ${importResults.platformName}`
              : `Failed to create ${importResults.failed.length} entit${importResults.failed.length === 1 ? 'y' : 'ies'}`
            }
          </Typography>
        </Box>
        
        {/* Platform indicator */}
        <Box 
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            gap: 1, 
            mb: 2.5,
            p: 1.5,
            bgcolor: 'action.hover',
            borderRadius: 1,
            border: 1,
            borderColor: 'divider',
          }}
        >
          <img
            src={typeof chrome !== 'undefined' && chrome.runtime?.getURL 
              ? chrome.runtime.getURL(`assets/logos/logo_opencti_${logoSuffix}_embleme_square.svg`)
              : `../assets/logos/logo_opencti_${logoSuffix}_embleme_square.svg`
            }
            alt="OpenCTI"
            width={20}
            height={20}
          />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {importResults.platformName}
          </Typography>
        </Box>
        
        {/* Statistics breakdown by type */}
        {importResults.success && sortedTypes.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1.5, color: 'text.secondary', fontWeight: 600 }}>
              BREAKDOWN BY TYPE
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {sortedTypes.map(([type, entities]) => {
                const color = itemColor(type, mode === 'dark');
                return (
                  <Box
                    key={type}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      p: 1.5,
                      bgcolor: hexToRGB(color, 0.08),
                      border: 1,
                      borderColor: hexToRGB(color, 0.2),
                      borderRadius: 1.5,
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 36,
                        height: 36,
                        borderRadius: 1,
                        bgcolor: hexToRGB(color, 0.15),
                      }}
                    >
                      <ItemIcon type={type} size="small" color={color} />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, textTransform: 'capitalize' }}>
                        {type.replace(/-/g, ' ')}
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: 32,
                        height: 32,
                        borderRadius: '50%',
                        bgcolor: color,
                        color: mode === 'dark' ? '#1a1a2e' : 'white', // Dark text on light bg in dark mode
                        fontWeight: 700,
                        fontSize: 14,
                      }}
                    >
                      {entities.length}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}
        
        {/* Created entities list (collapsible) */}
        {importResults.success && importResults.created.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1.5, color: 'text.secondary', fontWeight: 600 }}>
              CREATED ENTITIES ({importResults.created.length})
            </Typography>
            <Box sx={{ maxHeight: 200, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
              {importResults.created.map((entity, idx) => {
                const color = itemColor(entity.type, mode === 'dark');
                return (
                  <Box
                    key={entity.id || idx}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      p: 1.5,
                      borderBottom: idx < importResults.created.length - 1 ? 1 : 0,
                      borderColor: 'divider',
                    }}
                  >
                    <ItemIcon type={entity.type} size="small" color={color} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          fontWeight: 500, 
                          wordBreak: 'break-word',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {entity.value}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'capitalize' }}>
                        {entity.type.replace(/-/g, ' ')}
                      </Typography>
                    </Box>
                    <CheckCircleOutlined sx={{ fontSize: 18, color: 'success.main' }} />
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}
        
        {/* Failed entities list */}
        {importResults.failed.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1.5, color: 'error.main', fontWeight: 600 }}>
              FAILED ({importResults.failed.length})
            </Typography>
            <Box sx={{ maxHeight: 150, overflow: 'auto', border: 1, borderColor: 'error.main', borderRadius: 1, bgcolor: 'error.dark', opacity: 0.1 }}>
              {importResults.failed.map((entity, idx) => (
                <Box
                  key={idx}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    p: 1.5,
                    borderBottom: idx < importResults.failed.length - 1 ? 1 : 0,
                    borderColor: 'divider',
                  }}
                >
                  <ItemIcon type={entity.type} size="small" />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: 'break-word' }}>
                      {entity.value}
                    </Typography>
                    {entity.error && (
                      <Typography variant="caption" sx={{ color: 'error.main' }}>
                        {entity.error}
                      </Typography>
                    )}
                  </Box>
                  <ErrorOutline sx={{ fontSize: 18, color: 'error.main' }} />
                </Box>
              ))}
            </Box>
          </Box>
        )}
        
        {/* Action buttons */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            onClick={() => {
              setImportResults(null);
              handleClose();
            }}
            fullWidth
            startIcon={<CheckCircleOutlined />}
          >
            Done
          </Button>
        </Box>
      </Box>
    );
  };

  const renderPreviewView = () => (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <ArrowForwardOutlined sx={{ color: 'primary.main' }} />
        <Typography variant="h6">Import Selection</Typography>
      </Box>
      
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        {entitiesToAdd.length} entit{entitiesToAdd.length === 1 ? 'y' : 'ies'} selected for import
      </Typography>

      {/* Entity list */}
      <Box sx={{ maxHeight: 250, overflow: 'auto', mb: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
        {entitiesToAdd.map((e, i) => (
          <Paper
            key={i}
            elevation={0}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              p: 1.5,
              borderBottom: i < entitiesToAdd.length - 1 ? 1 : 0,
              borderColor: 'divider',
              bgcolor: 'transparent',
            }}
          >
            <ItemIcon type={e.type} size="small" />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: 'break-word' }}>
                {e.value || e.name}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {e.type?.replace(/-/g, ' ')}
              </Typography>
            </Box>
            <Chip
              label={e.existsInPlatform ? 'Exists' : 'New'}
              size="small"
              color={e.existsInPlatform ? 'success' : 'warning'}
              variant="outlined"
            />
          </Paper>
        ))}
      </Box>

      {/* Options */}
      <Box sx={{ mb: 2 }}>
        <FormControlLabel
          control={
            <Switch
              checked={createIndicators}
              onChange={(e) => setCreateIndicators(e.target.checked)}
              size="small"
            />
          }
          label={
            <Box>
              <Typography variant="body2">Create indicators from observables</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Automatically generate STIX indicators for each observable
              </Typography>
            </Box>
          }
          sx={{ alignItems: 'flex-start', ml: 0 }}
        />
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Button
          variant="contained"
          color="primary"
          onClick={async () => {
            // Mark this as coming from preview (has entities to add)
            setContainerWorkflowOrigin('preview');
            setExistingContainers([]);
            
            // Check for existing containers first if we have a page URL
            if (currentPageUrl && typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
              setCheckingExisting(true);
              setPanelMode('loading');
              
              chrome.runtime.sendMessage(
                { type: 'FIND_CONTAINERS_BY_URL', payload: { url: currentPageUrl } },
                (response) => {
                  setCheckingExisting(false);
                  if (chrome.runtime.lastError) {
                    // On error, proceed to creation
                    // Only check OpenCTI platforms for container creation (not OpenAEV)
                    if (openctiPlatforms.length > 1) {
                      setPanelMode('platform-select');
                    } else {
                      // Auto-select the single OpenCTI platform
                      if (openctiPlatforms.length === 1) {
                        setSelectedPlatformId(openctiPlatforms[0].id);
                        setPlatformUrl(openctiPlatforms[0].url);
                      }
                      setPanelMode('container-type');
                    }
                    return;
                  }
                  
                  if (response?.success && response.data?.length > 0) {
                    // Found existing containers - show them first
                    setExistingContainers(response.data);
                    setPanelMode('existing-containers');
                  } else {
                    // No existing containers - proceed to creation
                    // Only check OpenCTI platforms for container creation (not OpenAEV)
                    if (openctiPlatforms.length > 1) {
                      setPanelMode('platform-select');
                    } else {
                      // Auto-select the single OpenCTI platform
                      if (openctiPlatforms.length === 1) {
                        setSelectedPlatformId(openctiPlatforms[0].id);
                        setPlatformUrl(openctiPlatforms[0].url);
                      }
                      setPanelMode('container-type');
                    }
                  }
                }
              );
            } else {
              // No page URL - go directly to creation flow
              // Only check OpenCTI platforms for container creation (not OpenAEV)
              if (openctiPlatforms.length > 1) {
                setPanelMode('platform-select');
              } else {
                // Auto-select the single OpenCTI platform
                if (openctiPlatforms.length === 1) {
                  setSelectedPlatformId(openctiPlatforms[0].id);
                  setPlatformUrl(openctiPlatforms[0].url);
                }
                setPanelMode('container-type');
              }
            }
          }}
          startIcon={<DescriptionOutlined />}
          fullWidth
        >
          Create Container with Entities
        </Button>
        <Button
          variant="outlined"
          onClick={() => {
            // For import without container, check if multiple OpenCTI platforms
            if (openctiPlatforms.length > 1) {
              // Need platform selection first
              setContainerWorkflowOrigin('import');
              setPanelMode('platform-select');
            } else if (openctiPlatforms.length === 1) {
              // Auto-select single platform and import
              setSelectedPlatformId(openctiPlatforms[0].id);
              setPlatformUrl(openctiPlatforms[0].url);
              handleAddEntities();
            } else {
              // No OpenCTI platform - handleAddEntities will show error
              handleAddEntities();
            }
          }}
          disabled={submitting}
          fullWidth
        >
          {submitting ? 'Importing...' : 'Import without Container'}
        </Button>
      </Box>
    </Box>
  );

  const renderPlatformSelectView = () => {
    // Determine if back button should be shown
    // Show back if coming from preview mode (has entities selected) or from import workflow
    const showBackButton = (containerWorkflowOrigin === 'preview' || containerWorkflowOrigin === 'import') && entitiesToAdd.length > 0;
    const isImportWorkflow = containerWorkflowOrigin === 'import';
    
    return (
    <Box sx={{ p: 2 }}>
      {/* Stepper - only show for container creation, not import */}
      {!isImportWorkflow && (
        <Stepper activeStep={0} sx={{ mb: 3 }}>
          {containerSteps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        {showBackButton && (
          <IconButton size="small" onClick={() => setPanelMode('preview')}>
            <ChevronLeftOutlined />
          </IconButton>
        )}
        <Typography variant="h6" sx={{ fontSize: 16 }}>Select Platform</Typography>
      </Box>

      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        {isImportWorkflow 
          ? 'Choose which OpenCTI platform to import entities into:'
          : 'Choose which OpenCTI platform to create the container in:'
        }
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {openctiPlatforms.map((platform) => (
          <Paper
            key={platform.id}
            onClick={() => {
              setSelectedPlatformId(platform.id);
              setPlatformUrl(platform.url);
              if (isImportWorkflow) {
                // Import workflow - proceed with entity creation
                setContainerWorkflowOrigin(null);
                handleAddEntities();
              } else {
                // Container workflow - go to type selection
                setPanelMode('container-type');
              }
            }}
            elevation={0}
            sx={{
              p: 2,
              cursor: 'pointer',
              border: 2,
              borderColor: selectedPlatformId === platform.id ? 'primary.main' : 'divider',
              borderRadius: 1,
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              '&:hover': { 
                borderColor: 'primary.main',
                bgcolor: 'action.hover',
              },
            }}
          >
            <img 
              src={typeof chrome !== 'undefined' && chrome.runtime?.getURL 
                ? chrome.runtime.getURL(`assets/logos/logo_opencti_${logoSuffix}_embleme_square.svg`)
                : `../assets/logos/logo_opencti_${logoSuffix}_embleme_square.svg`
              } 
              alt="OpenCTI" 
              style={{ width: 32, height: 32 }} 
            />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25 }}>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {platform.name}
                </Typography>
                {platform.isEnterprise !== undefined && (
                  <Box
                    sx={{
                      px: 0.5,
                      py: 0.1,
                      borderRadius: 0.5,
                      fontSize: '9px',
                      fontWeight: 700,
                      lineHeight: 1.3,
                      bgcolor: platform.isEnterprise 
                        ? (mode === 'dark' ? '#00f1bd' : '#0c7e69')
                        : '#616161',
                      color: platform.isEnterprise ? '#000' : '#fff',
                    }}
                  >
                    {platform.isEnterprise ? 'EE' : 'CE'}
                  </Box>
                )}
              </Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', wordBreak: 'break-all' }}>
                {platform.url} {platform.version ? `• v${platform.version}` : ''}
              </Typography>
            </Box>
          </Paper>
        ))}
      </Box>
    </Box>
  );
  };

  // Container creation is OpenCTI-only, so only count OpenCTI platforms
  const containerSteps = openctiPlatforms.length > 1 
    ? ['Select Platform', 'Select Type', 'Configure Details']
    : ['Select Type', 'Configure Details'];

  const renderContainerTypeView = () => {
    // Determine if we should show back button
    // Show back if: coming from preview, or if multi-platform (can go back to platform select)
    // Use openctiPlatforms since container creation is OpenCTI-only
    const canGoBack = containerWorkflowOrigin === 'preview' || openctiPlatforms.length > 1;
    
    const handleBack = () => {
      if (openctiPlatforms.length > 1) {
        setPanelMode('platform-select' as PanelMode);
      } else if (containerWorkflowOrigin === 'preview') {
        setPanelMode('preview');
      }
      // If direct workflow with single platform, don't navigate (button won't be shown anyway)
    };

    return (
      <Box sx={{ p: 2 }}>
        {/* Stepper */}
        <Stepper activeStep={openctiPlatforms.length > 1 ? 1 : 0} sx={{ mb: 3 }}>
          {containerSteps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          {canGoBack && (
            <IconButton size="small" onClick={handleBack}>
              <ChevronLeftOutlined />
            </IconButton>
          )}
          <Typography variant="h6" sx={{ fontSize: 16 }}>Select Container Type</Typography>
        </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5 }}>
        {[
          { type: 'Report', color: '#4a148c', description: 'Threat intelligence report' },
          { type: 'Grouping', color: '#689f38', description: 'Group related objects' },
          { type: 'Case-Incident', color: '#ad1457', description: 'Security incident' },
          { type: 'Case-Rfi', color: '#0c5c98', description: 'Request for information' },
        ].map((item) => (
          <Paper
            key={item.type}
            onClick={() => {
              setContainerType(item.type);
              setPanelMode('container-form');
            }}
            elevation={0}
            sx={{
              p: 2,
              cursor: 'pointer',
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              transition: 'all 0.2s',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              '&:hover': { 
                borderColor: item.color,
                bgcolor: hexToRGB(item.color, 0.08),
              },
            }}
          >
            <Box sx={{ mb: 1 }}>
              <ItemIcon type={item.type} color={item.color} size="medium" />
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
              {item.type.replace(/-/g, ' ')}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.3 }}>
              {item.description}
            </Typography>
          </Paper>
        ))}
      </Box>

      {entitiesToAdd.length > 0 && (
        <Alert severity="success" sx={{ mt: 2, borderRadius: 1 }}>
          {entitiesToAdd.length} entit{entitiesToAdd.length === 1 ? 'y' : 'ies'} will be added to this container
        </Alert>
      )}
    </Box>
  );
  };

  // View for existing containers found for the current page URL
  const renderExistingContainersView = () => {
    const handleOpenExistingContainer = async (container: ContainerData) => {
      // Show this container in entity view - fetch full details
      const containerPlatformId = (container as any)._platformId || selectedPlatformId;
      if (containerPlatformId) {
        const platform = availablePlatforms.find(p => p.id === containerPlatformId);
        if (platform) {
          setPlatformUrl(platform.url);
          setSelectedPlatformId(platform.id);
        }
      }
      
      // Set loading state first
      setPanelMode('loading');
      
      // Fetch full entity details from API
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage && container.id) {
        try {
          const response = await chrome.runtime.sendMessage({
            type: 'GET_ENTITY_DETAILS',
            payload: {
              id: container.id,
              entityType: container.entity_type,
              platformId: containerPlatformId,
            },
          });
          
          if (response?.success && response.data) {
            setEntity({
              ...response.data,
              type: response.data.entity_type || container.entity_type,
              existsInPlatform: true,
              _platformId: containerPlatformId,
              _platformType: 'opencti',
              _isNonDefaultPlatform: false,
            });
            setMultiPlatformResults([{
              platformId: containerPlatformId,
              platformName: availablePlatforms.find(p => p.id === containerPlatformId)?.name || 'OpenCTI',
              entity: { ...response.data, existsInPlatform: true, _platformType: 'opencti', _isNonDefaultPlatform: false },
            }]);
            setCurrentPlatformIndex(0);
            setEntityContainers([]);
            setPanelMode('entity');
            
            // Also fetch containers for this entity
            fetchEntityContainers(container.id, containerPlatformId);
            return;
          }
        } catch (error) {
          log.error(' Failed to fetch container details:', error);
        }
      }
      
      // Fallback to basic data
      setEntity({
        id: container.id,
        entity_type: container.entity_type,
        type: container.entity_type,
        name: container.name,
        description: (container as any).description,
        existsInPlatform: true,
        _platformId: containerPlatformId,
        _platformType: 'opencti',
        _isNonDefaultPlatform: false,
      });
      setMultiPlatformResults([{
        platformId: containerPlatformId,
        platformName: availablePlatforms.find(p => p.id === containerPlatformId)?.name || 'OpenCTI',
        entity: { id: container.id, entity_type: container.entity_type, type: container.entity_type, name: container.name, existsInPlatform: true, _platformType: 'opencti', _isNonDefaultPlatform: false },
      }]);
      setCurrentPlatformIndex(0);
      setEntityContainers([]);
      setPanelMode('entity');
    };

    const handleRefreshContainer = async (container: ContainerData) => {
      // Set the container ID for upsert mode
      setUpdatingContainerId(container.id);
      
      // Set container type first
      setContainerType(container.entity_type);
      
      // Get platform info
      const containerPlatformId = (container as any)._platformId || selectedPlatformId;
      if (containerPlatformId) {
        const platform = availablePlatforms.find(p => p.id === containerPlatformId);
        if (platform) {
          setPlatformUrl(platform.url);
          setSelectedPlatformId(platform.id);
        }
      }
      
      // Show loading while fetching full container details
      setPanelMode('loading');
      
      // Fetch full container details from OpenCTI
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage && container.id) {
        try {
          const response = await chrome.runtime.sendMessage({
            type: 'GET_ENTITY_DETAILS',
            payload: {
              id: container.id,
              entityType: container.entity_type,
              platformId: containerPlatformId,
            },
          });
          
          if (response?.success && response.data) {
            const fullContainer = response.data;
            log.debug(' handleRefreshContainer: Full container data:', fullContainer);
            
            // Pre-fill the form with the container's existing data (but keep new content)
            setContainerForm({
              name: fullContainer.name || container.name,
              description: fullContainer.description || '',
              content: containerForm.content, // Keep the new content from page
            });
            
            // Pre-fill labels if available
            if (fullContainer.objectLabel && fullContainer.objectLabel.length > 0) {
              setSelectedLabels(fullContainer.objectLabel.map((l: any) => ({
                id: l.id || l.value,
                value: l.value,
                color: l.color,
              })));
            }
            
            // Pre-fill markings if available
            if (fullContainer.objectMarking && fullContainer.objectMarking.length > 0) {
              setSelectedMarkings(fullContainer.objectMarking.map((m: any) => ({
                id: m.id || m.definition,
                definition: m.definition,
              })));
            }
            
            // Pre-fill container-specific fields based on type
            const newSpecificFields = { ...containerSpecificFields };
            
            // Report types
            if (fullContainer.report_types) {
              newSpecificFields.report_types = fullContainer.report_types;
            }
            
            // Grouping context
            if (fullContainer.context) {
              newSpecificFields.context = fullContainer.context;
            }
            
            // Case fields
            if (fullContainer.severity) {
              newSpecificFields.severity = fullContainer.severity;
            }
            if (fullContainer.priority) {
              newSpecificFields.priority = fullContainer.priority;
            }
            if (fullContainer.response_types) {
              newSpecificFields.response_types = fullContainer.response_types;
            }
            
            // Author (createdBy)
            if (fullContainer.createdBy?.id) {
              newSpecificFields.createdBy = fullContainer.createdBy.id;
            }
            
            setContainerSpecificFields(newSpecificFields);
            
            // Load labels and markings for the platform (if not already loaded)
            loadLabelsAndMarkings(containerPlatformId);
            
            setPanelMode('container-form');
            return;
          }
        } catch (error) {
          log.error(' handleRefreshContainer: Failed to fetch container details:', error);
        }
      }
      
      // Fallback: Use basic container data
      setContainerForm({
        name: container.name,
        description: (container as any).description || '',
        content: containerForm.content,
      });
      
      // Load labels and markings for the platform
      loadLabelsAndMarkings(containerPlatformId);
      
      setPanelMode('container-form');
    };

    const handleCreateNew = () => {
      // Clear existing container selection and proceed to create new
      // If multiple OpenCTI platforms, go to platform select first (containers are OpenCTI-only)
      if (openctiPlatforms.length > 1) {
        setPanelMode('platform-select');
      } else {
        // Auto-select the single OpenCTI platform
        if (openctiPlatforms.length === 1) {
          setSelectedPlatformId(openctiPlatforms[0].id);
          setPlatformUrl(openctiPlatforms[0].url);
        }
        setPanelMode('container-type');
      }
    };

    return (
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <DescriptionOutlined sx={{ color: 'primary.main' }} />
          <Typography variant="h6" sx={{ fontSize: 16 }}>Existing Container Found</Typography>
        </Box>
        
        <Alert severity="info" sx={{ mb: 2, borderRadius: 1 }}>
          A container already exists for this article. You can view it, update it with new content, or create a new one.
        </Alert>
        
        {/* List existing containers */}
        <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block', fontWeight: 600, textTransform: 'uppercase' }}>
          Found {existingContainers.length} container{existingContainers.length > 1 ? 's' : ''}
        </Typography>
        
        <Box sx={{ mb: 2 }}>
          {existingContainers.map((container, idx) => {
            const containerColor = itemColor(container.entity_type, mode === 'dark');
            const containerPlatform = availablePlatforms.find(p => p.id === (container as any)._platformId);
            
            return (
              <Paper
                key={container.id || idx}
                elevation={0}
                sx={{
                  p: 1.5,
                  mb: 1,
                  bgcolor: 'background.paper',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.5 }}>
                  <ItemIcon type={container.entity_type} size="small" color={containerColor} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, wordBreak: 'break-word' }}>
                      {container.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <span style={{ textTransform: 'capitalize' }}>{container.entity_type.replace(/-/g, ' ')}</span>
                      {containerPlatform && <span>• {containerPlatform.name}</span>}
                      {container.createdBy?.name && <span>• {container.createdBy.name}</span>}
                      {container.modified && <span>• {formatDate(container.modified)}</span>}
                    </Typography>
                  </Box>
                </Box>
                
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<OpenInNewOutlined sx={{ fontSize: 16 }} />}
                    onClick={() => handleOpenExistingContainer(container)}
                    sx={{ flex: 1 }}
                  >
                    View
                  </Button>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<RefreshOutlined sx={{ fontSize: 16 }} />}
                    onClick={() => handleRefreshContainer(container)}
                    sx={{ flex: 1 }}
                  >
                    Update
                  </Button>
                </Box>
              </Paper>
            );
          })}
        </Box>
        
        <Divider sx={{ my: 2 }} />
        
        <Button
          variant="outlined"
          onClick={handleCreateNew}
          startIcon={<AddOutlined />}
          fullWidth
        >
          Create New Container
        </Button>
      </Box>
    );
  };

  const renderContainerFormView = () => (
    <Box sx={{ p: 2 }}>
      {/* Stepper - activeStep should be the last step (Configure Details) */}
      <Stepper activeStep={containerSteps.length - 1} sx={{ mb: 3 }}>
        {containerSteps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <IconButton size="small" onClick={() => setPanelMode('container-type')}>
          <ChevronLeftOutlined />
        </IconButton>
        <ItemIcon type={containerType} size="small" />
        <Typography variant="h6" sx={{ fontSize: 16 }}>
          {containerType.replace(/-/g, ' ')} Details
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          label="Name"
          value={containerForm.name}
          onChange={(e) => setContainerForm({ ...containerForm, name: e.target.value })}
          fullWidth
          required
          size="small"
          placeholder="Enter container name..."
          helperText="Pre-filled from page title"
        />

        {/* Report-specific: Report Types */}
        {containerType === 'Report' && (
          <Autocomplete
            multiple
            options={availableReportTypes}
            getOptionLabel={(option) => option.name}
            value={availableReportTypes.filter(r => containerSpecificFields.report_types.includes(r.name))}
            onChange={(_, newValue) => setContainerSpecificFields(prev => ({ 
              ...prev, 
              report_types: newValue.map(v => v.name) 
            }))}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderInput={(params) => (
              <TextField {...params} label="Report Types" size="small" placeholder="Select type..." />
            )}
            size="small"
          />
        )}

        {/* Grouping-specific: Context (mandatory) */}
        {containerType === 'Grouping' && (
          <Autocomplete
            options={availableContexts}
            getOptionLabel={(option) => option.name}
            value={availableContexts.find(c => c.name === containerSpecificFields.context) || null}
            onChange={(_, newValue) => setContainerSpecificFields(prev => ({ 
              ...prev, 
              context: newValue?.name || '' 
            }))}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderInput={(params) => (
              <TextField {...params} label="Context" size="small" required placeholder="Select context..." />
            )}
            size="small"
          />
        )}

        {/* Case-specific: Severity, Priority, Response Types */}
        {containerType.startsWith('Case') && (
          <>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <Autocomplete
                options={availableSeverities}
                getOptionLabel={(option) => option.name}
                value={availableSeverities.find(s => s.name === containerSpecificFields.severity) || null}
                onChange={(_, newValue) => setContainerSpecificFields(prev => ({ 
                  ...prev, 
                  severity: newValue?.name || '' 
                }))}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderInput={(params) => (
                  <TextField {...params} label="Severity" size="small" placeholder="Select..." />
                )}
                size="small"
              />
              <Autocomplete
                options={availablePriorities}
                getOptionLabel={(option) => option.name}
                value={availablePriorities.find(p => p.name === containerSpecificFields.priority) || null}
                onChange={(_, newValue) => setContainerSpecificFields(prev => ({ 
                  ...prev, 
                  priority: newValue?.name || '' 
                }))}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderInput={(params) => (
                  <TextField {...params} label="Priority" size="small" placeholder="Select..." />
                )}
                size="small"
              />
            </Box>
            {containerType === 'Case-Incident' && (
              <Autocomplete
                multiple
                options={availableResponseTypes}
                getOptionLabel={(option) => option.name}
                value={availableResponseTypes.filter(r => containerSpecificFields.response_types.includes(r.name))}
                onChange={(_, newValue) => setContainerSpecificFields(prev => ({ 
                  ...prev, 
                  response_types: newValue.map(v => v.name) 
                }))}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderInput={(params) => (
                  <TextField {...params} label="Incident Types" size="small" placeholder="Select..." />
                )}
                size="small"
              />
            )}
          </>
        )}

        {/* Author (createdBy) - for all container types */}
        <Autocomplete
          options={availableAuthors}
          getOptionLabel={(option) => option.name}
          value={availableAuthors.find(a => a.id === containerSpecificFields.createdBy) || null}
          onChange={(_, newValue) => setContainerSpecificFields(prev => ({ 
            ...prev, 
            createdBy: newValue?.id || '' 
          }))}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          renderInput={(params) => (
            <TextField {...params} label="Author" size="small" placeholder="Select author..." />
          )}
          renderOption={(props, option) => (
            <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ItemIcon type={option.entity_type} size="small" />
              <Typography variant="body2">{option.name}</Typography>
            </Box>
          )}
          size="small"
        />

        {/* Description field with AI generate button */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <TextField
            label="Description"
            value={containerForm.description}
            onChange={(e) => setContainerForm({ ...containerForm, description: e.target.value })}
            multiline
            rows={4}
            fullWidth
            size="small"
            placeholder="Enter description..."
            helperText="Extracted from article content"
          />
          {(() => {
            // Check if AI is available for the container platform
            const selectedIsOpenCTI = openctiPlatforms.some(p => p.id === selectedPlatformId);
            const targetPlatformId = selectedIsOpenCTI ? selectedPlatformId : openctiPlatforms[0]?.id;
            const targetPlatform = availablePlatforms.find(p => p.id === targetPlatformId);
            const isAIAvailable = aiSettings.available && targetPlatform?.isEnterprise;
            
            let tooltipMessage = '';
            if (!aiSettings.available) {
              tooltipMessage = 'AI is not configured. Configure AI in extension settings.';
            } else if (!targetPlatform?.isEnterprise) {
              tooltipMessage = 'AI features require Enterprise Edition. The selected platform is Community Edition.';
            } else {
              tooltipMessage = 'Use AI to generate a summary of the page content as description';
            }
            
            return (
              <Tooltip title={tooltipMessage} placement="top">
                <span>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleGenerateAIDescription}
                    disabled={!isAIAvailable || aiGeneratingDescription}
                    startIcon={aiGeneratingDescription ? <CircularProgress size={14} /> : <AutoAwesomeOutlined />}
                    sx={{ 
                      alignSelf: 'flex-start',
                      textTransform: 'none',
                      opacity: !isAIAvailable ? 0.5 : 1,
                    }}
                  >
                    {aiGeneratingDescription ? 'Generating...' : 'Generate with AI'}
                  </Button>
                </span>
              </Tooltip>
            );
          })()}
        </Box>

        {/* Labels Autocomplete */}
        <Autocomplete
          multiple
          options={availableLabels}
          getOptionLabel={(option) => option.value}
          value={selectedLabels}
          onChange={(_, newValue) => setSelectedLabels(newValue)}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          renderInput={(params) => (
            <TextField 
              {...params} 
              label="Labels" 
              size="small"
              placeholder={selectedLabels.length === 0 ? "Select labels..." : ""}
            />
          )}
          renderOption={(props, option) => (
            <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 14, height: 14, borderRadius: 0.5, bgcolor: option.color }} />
              <Typography variant="body2">{option.value}</Typography>
            </Box>
          )}
          renderTags={(value, getTagProps) =>
            value.map((option, index) => (
              <Chip
                {...getTagProps({ index })}
                key={option.id}
                label={option.value}
                size="small"
                sx={{ 
                  bgcolor: option.color, 
                  color: '#fff',
                  borderRadius: 0.5,
                  '& .MuiChip-deleteIcon': { color: 'rgba(255,255,255,0.7)' },
                }}
              />
            ))
          }
        />

        {/* Markings Autocomplete */}
        <Autocomplete
          multiple
          options={availableMarkings}
          getOptionLabel={(option) => option.definition}
          value={selectedMarkings}
          onChange={(_, newValue) => setSelectedMarkings(newValue)}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          renderInput={(params) => (
            <TextField 
              {...params} 
              label="Marking Definitions" 
              size="small"
              placeholder={selectedMarkings.length === 0 ? "Select markings..." : ""}
            />
          )}
          renderOption={(props, option) => (
            <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box 
                sx={{ 
                  width: 14, 
                  height: 14, 
                  borderRadius: 0.5, 
                  bgcolor: (option as any).x_opencti_color || 'grey.500' 
                }} 
              />
              <Typography variant="body2">{option.definition}</Typography>
            </Box>
          )}
          renderTags={(value, getTagProps) =>
            value.map((option, index) => (
              <Chip
                {...getTagProps({ index })}
                key={option.id}
                label={option.definition}
                size="small"
                variant="outlined"
                sx={{ 
                  borderRadius: 0.5,
                  borderColor: (option as any).x_opencti_color || 'divider',
                }}
              />
            ))
          }
        />

        {/* PDF Attachment Option */}
        <FormControlLabel
          control={
            <Switch
              checked={attachPdf}
              onChange={(e) => setAttachPdf(e.target.checked)}
              color="primary"
              size="small"
            />
          }
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PictureAsPdfOutlined fontSize="small" sx={{ color: attachPdf ? 'primary.main' : 'text.secondary' }} />
              <Typography variant="body2">
                Attach PDF snapshot of this page
              </Typography>
            </Box>
          }
          sx={{ ml: 0 }}
        />

        {/* Content field info */}
        <Alert severity="info" sx={{ borderRadius: 1, py: 0.5 }}>
          <Typography variant="caption">
            Page HTML content will be saved to the container's "content" field for indexing.
          </Typography>
        </Alert>

        {entitiesToAdd.length > 0 && (
          <Alert severity="success" sx={{ borderRadius: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {entitiesToAdd.length} entit{entitiesToAdd.length === 1 ? 'y' : 'ies'} will be added
            </Typography>
          </Alert>
        )}

        <Button
          variant="contained"
          onClick={handleCreateContainer}
          disabled={!containerForm.name || submitting}
          endIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <ArrowForwardOutlined />}
          fullWidth
          sx={{ mt: 1 }}
        >
          {generatingPdf ? 'Generating PDF...' : submitting ? 'Creating...' : 'Create Container'}
        </Button>
      </Box>
    </Box>
  );

  // State for investigation mode
  const [investigationEntities, setInvestigationEntities] = useState<Array<{
    id: string;
    type: string;
    name: string;
    value?: string;
    platformId?: string;
    selected: boolean;
  }>>([]);
  const [investigationScanning, setInvestigationScanning] = useState(false);
  const [investigationTypeFilter, setInvestigationTypeFilter] = useState<string>('all');
  const [investigationPlatformSelected, setInvestigationPlatformSelected] = useState(false);
  const [investigationPlatformId, setInvestigationPlatformId] = useState<string | null>(null);

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
    
    log.debug(' Creating workbench with', entityIds.length, 'entities:', entityIds);
    
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
    } else {
      log.error(' Failed to create workbench:', response?.error);
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

  // Get unique entity types for filter
  const investigationEntityTypes = useMemo(() => {
    const types = new Set(investigationEntities.map(e => e.type));
    return Array.from(types).sort();
  }, [investigationEntities]);

  // Filter investigation entities by type
  const filteredInvestigationEntities = useMemo(() => {
    if (investigationTypeFilter === 'all') return investigationEntities;
    return investigationEntities.filter(e => e.type === investigationTypeFilter);
  }, [investigationEntities, investigationTypeFilter]);

  const selectedInvestigationCount = investigationEntities.filter(e => e.selected).length;

  // Reset investigation state helper
  const resetInvestigation = () => {
    setInvestigationEntities([]);
    setInvestigationPlatformSelected(false);
    setInvestigationPlatformId(null);
    setInvestigationTypeFilter('all');
    setPanelMode('empty');
    // Clear highlights
    chrome.tabs?.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { type: 'CLEAR_HIGHLIGHTS' });
      }
    });
  };

  // Get the selected investigation platform info
  const investigationPlatform = availablePlatforms.find(p => p.id === investigationPlatformId);

  const renderInvestigationView = () => {
    // Step 1: If multiple OpenCTI platforms and none selected, show platform selection
    // Investigation is OpenCTI-only - filter out OpenAEV platforms
    if (openctiPlatforms.length > 1 && !investigationPlatformSelected) {
      return (
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <TravelExploreOutlined sx={{ color: 'primary.main' }} />
            <Typography variant="h6" sx={{ fontSize: 16, flex: 1 }}>Investigation Mode</Typography>
            <IconButton size="small" onClick={resetInvestigation}>
              <CloseOutlined fontSize="small" />
            </IconButton>
          </Box>
          
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Select the OpenCTI platform to scan for existing entities:
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {openctiPlatforms.map((platform) => (
              <Paper
                key={platform.id}
                onClick={() => handleSelectInvestigationPlatform(platform.id)}
                elevation={0}
                sx={{
                  p: 2,
                  cursor: 'pointer',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  transition: 'all 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  '&:hover': {
                    borderColor: 'primary.main',
                    bgcolor: 'action.hover',
                  },
                }}
              >
                <img 
                  src={typeof chrome !== 'undefined' && chrome.runtime?.getURL 
                    ? chrome.runtime.getURL(`assets/logos/logo_opencti_${mode === 'dark' ? 'dark' : 'light'}-theme_embleme_square.svg`)
                    : `../assets/logos/logo_opencti_${mode === 'dark' ? 'dark' : 'light'}-theme_embleme_square.svg`
                  } 
                  alt="OpenCTI" 
                  style={{ width: 32, height: 32 }} 
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25 }}>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {platform.name}
                    </Typography>
                    {platform.isEnterprise !== undefined && (
                      <Box
                        sx={{
                          px: 0.5,
                          py: 0.1,
                          borderRadius: 0.5,
                          fontSize: '9px',
                          fontWeight: 700,
                          lineHeight: 1.3,
                          bgcolor: platform.isEnterprise ? '#7b1fa2' : '#616161',
                          color: '#fff',
                        }}
                      >
                        {platform.isEnterprise ? 'EE' : 'CE'}
                      </Box>
                    )}
                  </Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', wordBreak: 'break-all' }}>
                    {platform.url} {platform.version ? `• v${platform.version}` : ''}
                  </Typography>
                </Box>
              </Paper>
            ))}
          </Box>
        </Box>
      );
    }

    // Step 2: Show scanning / results view
    return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <TravelExploreOutlined sx={{ color: 'primary.main' }} />
        <Typography variant="h6" sx={{ fontSize: 16, flex: 1 }}>Investigation Mode</Typography>
        <IconButton size="small" onClick={resetInvestigation}>
          <CloseOutlined fontSize="small" />
        </IconButton>
      </Box>
      
      {/* Show selected platform only if multiple OpenCTI platforms */}
      {openctiPlatforms.length > 1 && investigationPlatform && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
          <img 
            src={typeof chrome !== 'undefined' && chrome.runtime?.getURL 
              ? chrome.runtime.getURL(`assets/logos/logo_opencti_${mode === 'dark' ? 'dark' : 'light'}-theme_embleme_square.svg`)
              : `../assets/logos/logo_opencti_${mode === 'dark' ? 'dark' : 'light'}-theme_embleme_square.svg`
            } 
            alt="OpenCTI" 
            style={{ width: 20, height: 20 }} 
          />
          <Typography variant="body2" sx={{ fontWeight: 500, flex: 1 }}>
            {investigationPlatform.name}
          </Typography>
          <Button 
            size="small" 
            onClick={() => {
              setInvestigationPlatformSelected(false);
              setInvestigationEntities([]);
              // Clear highlights
              chrome.tabs?.query({ active: true, currentWindow: true }).then(([tab]) => {
                if (tab?.id) {
                  chrome.tabs.sendMessage(tab.id, { type: 'CLEAR_HIGHLIGHTS' });
                }
              });
            }}
          >
            Change
          </Button>
        </Box>
      )}
      
      {investigationScanning ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 2 }}>
          <CircularProgress size={40} />
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Scanning page for existing entities...
          </Typography>
        </Box>
      ) : investigationEntities.length === 0 ? (
        <>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            No entities found in {investigationPlatform?.name || 'OpenCTI'} on this page.
          </Typography>
          
          <Button
            variant="outlined"
            onClick={() => handleInvestigationScan()}
            startIcon={<SearchOutlined />}
            fullWidth
          >
            Rescan Page
          </Button>
        </>
      ) : (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Found {investigationEntities.length} entities
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button size="small" onClick={selectAllInvestigationEntities}>Select All</Button>
              <Button size="small" onClick={clearInvestigationSelection}>Clear</Button>
            </Box>
          </Box>
          
          {/* Type filter */}
          {investigationEntityTypes.length > 1 && (
            <Box sx={{ mb: 2 }}>
              <FormControl fullWidth size="small">
                <InputLabel id="investigation-type-filter-label">Filter by type</InputLabel>
                <Select
                  labelId="investigation-type-filter-label"
                  value={investigationTypeFilter}
                  label="Filter by type"
                  onChange={(e) => setInvestigationTypeFilter(e.target.value)}
                >
                  <MenuItem value="all">
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                      <span>All types</span>
                      <Chip label={investigationEntities.length} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
                    </Box>
                  </MenuItem>
                  {investigationEntityTypes.map(type => (
                    <MenuItem key={type} value={type}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                        <span>{type.replace(/-/g, ' ').replace(/^oaev-/, 'OpenAEV ')}</span>
                        <Chip label={investigationEntities.filter(e => e.type === type).length} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          )}
          
          <Box sx={{ flex: 1, overflow: 'auto', mb: 2 }}>
            {filteredInvestigationEntities.map((entity) => {
              const entityColor = itemColor(entity.type, mode === 'dark');
              return (
                <Paper
                  key={entity.id}
                  elevation={0}
                  onClick={() => toggleInvestigationEntity(entity.id)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    p: 1.5,
                    mb: 1,
                    bgcolor: entity.selected ? hexToRGB(theme.palette.primary.main, 0.1) : 'background.paper',
                    border: 1,
                    borderColor: entity.selected ? 'primary.main' : 'divider',
                    borderRadius: 1,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    '&:hover': {
                      borderColor: 'primary.main',
                    },
                  }}
                >
                  <Checkbox 
                    checked={entity.selected} 
                    size="small"
                    sx={{ p: 0 }}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggleInvestigationEntity(entity.id)}
                  />
                  <ItemIcon type={entity.type} size="small" color={entityColor} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: 'break-word' }}>
                      {entity.name || entity.value}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {entity.type.replace(/-/g, ' ')}
                    </Typography>
                  </Box>
                </Paper>
              );
            })}
          </Box>
          
          {selectedInvestigationCount > 0 && (
            <Paper 
              elevation={3} 
              sx={{ 
                p: 2, 
                borderRadius: 1, 
                bgcolor: 'background.paper',
                border: 1,
                borderColor: 'divider',
              }}
            >
              <Typography variant="body2" sx={{ mb: 1.5, fontWeight: 600 }}>
                {selectedInvestigationCount} entit{selectedInvestigationCount === 1 ? 'y' : 'ies'} selected
              </Typography>
              <Button
                variant="contained"
                onClick={handleCreateWorkbench}
                disabled={submitting}
                startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <TravelExploreOutlined />}
                fullWidth
              >
                {submitting ? 'Creating...' : 'Start Investigation'}
              </Button>
            </Paper>
          )}
        </>
      )}
    </Box>
    );
  };

  // Get unique entity types for scan results filter
  const scanResultsEntityTypes = useMemo(() => {
    const types = new Set(scanResultsEntities.map(e => e.type));
    return Array.from(types).sort();
  }, [scanResultsEntities]);

  // Filter scan results entities by type and found status
  const filteredScanResultsEntities = useMemo(() => {
    let filtered = scanResultsEntities;
    
    // Filter by type
    if (scanResultsTypeFilter !== 'all') {
      filtered = filtered.filter(e => e.type === scanResultsTypeFilter);
    }
    
    // Filter by found status
    if (scanResultsFoundFilter === 'found') {
      filtered = filtered.filter(e => e.found);
    } else if (scanResultsFoundFilter === 'not-found') {
      filtered = filtered.filter(e => !e.found);
    }
    
    return filtered;
  }, [scanResultsEntities, scanResultsTypeFilter, scanResultsFoundFilter]);

  // Get counts for scan results
  const scanResultsFoundCount = scanResultsEntities.filter(e => e.found).length;
  const scanResultsNotFoundCount = scanResultsEntities.filter(e => !e.found).length;

  // Handle click on scan result entity to show its overview
  const handleScanResultEntityClick = async (entity: ScanResultEntity) => {
    if (!entity.found) {
      // Not found - show not-found view with add option
      setEntity({
        type: entity.type,
        value: entity.value,
        name: entity.name,
        existsInPlatform: false,
        entityData: entity.entityData,
      });
      setEntityFromScanResults(true);
      setMultiPlatformResults([]);
      setPanelMode('not-found');
      return;
    }
    
    // Found entity - show entity overview
    // Use the first platform match if available, otherwise use entity's platform
    const firstMatch = entity.platformMatches?.[0];
    const platformType = firstMatch?.platformType || entity.platformType || (entity.type.startsWith('oaev-') ? 'openaev' : 'opencti');
    const entityType = firstMatch?.type || entity.type;
    const actualType = entityType.replace('oaev-', '');
    const entityId = firstMatch?.entityId || entity.entityId || entity.id;
    const platformId = firstMatch?.platformId || entity.platformId;
    
    setEntityFromScanResults(true);
    
    // Set up multi-platform results for navigation if entity exists in multiple platforms
    if (entity.platformMatches && entity.platformMatches.length > 1) {
      const multiResults = entity.platformMatches.map(match => {
        const platform = availablePlatforms.find(p => p.id === match.platformId);
        // Clean type without oaev- prefix for API calls
        const cleanType = match.type.replace(/^oaev-/, '');
        return {
          platformId: match.platformId,
          platformName: platform?.name || match.platformId,
          entity: {
            id: match.entityId,
            entityId: match.entityId,
            type: match.type, // Prefixed type for display
            entity_type: cleanType, // Clean type for API calls
            name: entity.name,
            value: entity.value,
            existsInPlatform: true,
            platformId: match.platformId,
            _platformId: match.platformId,
            _platformType: match.platformType,
            _isNonDefaultPlatform: match.platformType !== 'opencti',
            entityData: {
              ...match.entityData,
              entity_type: cleanType, // Also include in entityData for navigation handlers
            },
          } as EntityData,
        };
      });
      // Sort: OpenCTI first
      const sorted = sortPlatformResults(multiResults);
      setMultiPlatformResults(sorted);
      setCurrentPlatformIndex(0);
      
      // Use the first sorted result
      const firstResult = sorted[0];
      const firstPlatformType = firstResult.entity._platformType || 'opencti';
      const firstEntityType = (firstResult.entity.type || '').replace('oaev-', '');
      const firstEntityId = String(firstResult.entity.entityId || firstResult.entity.id || '');
      
      setEntity({
        id: firstEntityId,
        entityId: firstEntityId,
        type: firstResult.entity.type,
        entity_type: firstResult.entity.type,
        name: entity.name,
        value: entity.value,
        existsInPlatform: true,
        platformId: firstResult.platformId,
        _platformId: firstResult.platformId,
        _platformType: firstPlatformType,
        _isNonDefaultPlatform: firstPlatformType !== 'opencti',
        entityData: firstResult.entity.entityData,
      });
      
      // Fetch full entity details for the first platform
      if (firstResult.entity.entityId && typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        setPanelMode('loading');
        try {
          const messageType = firstPlatformType === 'openaev' ? 'GET_OAEV_ENTITY_DETAILS' : 'GET_ENTITY_DETAILS';
          const response = await chrome.runtime.sendMessage({
            type: messageType,
            payload: {
              id: firstResult.entity.entityId,
              entityId: firstResult.entity.entityId,
              entityType: firstEntityType,
              platformId: firstResult.platformId,
            },
          });
          
          if (response?.success && response.data) {
            const fullEntity = {
              ...response.data,
              id: firstResult.entity.entityId,
              entityId: firstResult.entity.entityId,
              type: firstResult.entity.type,
              entity_type: firstResult.entity.type,
              name: entity.name || response.data.name,
              value: entity.value,
              existsInPlatform: true,
              platformId: firstResult.platformId,
              _platformId: firstResult.platformId,
              _platformType: firstPlatformType,
              _isNonDefaultPlatform: firstPlatformType !== 'opencti',
              entityData: response.data,
            };
            setEntity(fullEntity);
            // Update multiPlatformResults with full data
            setMultiPlatformResults(prev => prev.map((r, i) => 
              i === 0 ? { ...r, entity: fullEntity as EntityData } : r
            ));
          }
          setPanelMode('entity');
        } catch (error) {
          log.error(' Failed to fetch entity details:', error);
          setPanelMode('entity');
        }
      } else {
        setPanelMode('entity');
      }
    } else {
      // Single platform - no multi-platform navigation
      setMultiPlatformResults([]);
      setEntity({
        id: entityId,
        entityId: entityId,
        type: entityType,
        entity_type: entityType,
        name: entity.name,
        value: entity.value,
        existsInPlatform: true,
        platformId: platformId,
        _platformId: platformId,
        _platformType: platformType,
        _isNonDefaultPlatform: platformType !== 'opencti',
        entityData: entity.entityData,
      });
      
      // Fetch full entity details if we have an ID
      if (entityId && typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        setPanelMode('loading');
        try {
          const messageType = platformType === 'openaev' ? 'GET_OAEV_ENTITY_DETAILS' : 'GET_ENTITY_DETAILS';
          const response = await chrome.runtime.sendMessage({
            type: messageType,
            payload: {
              id: entityId,
              entityId: entityId,
              entityType: actualType,
              platformId: platformId,
            },
          });
          
          if (response?.success && response.data) {
            setEntity({
              ...response.data,
              id: entityId,
              entityId: entityId,
              type: entityType,
              entity_type: entityType,
              name: entity.name || response.data.name,
              value: entity.value,
              existsInPlatform: true,
              platformId: platformId,
              _platformId: platformId,
              _platformType: platformType,
              _isNonDefaultPlatform: platformType !== 'opencti',
              entityData: response.data,
            });
          }
          setPanelMode('entity');
        } catch (error) {
          log.error(' Failed to fetch entity details:', error);
          setPanelMode('entity');
        }
      } else {
        setPanelMode('entity');
      }
    }
  };

  const renderScanResultsView = () => {
    const logoSuffix = mode === 'dark' ? 'dark-theme' : 'light-theme';
    
    return (
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <TravelExploreOutlined sx={{ color: 'primary.main' }} />
          <Typography variant="h6" sx={{ fontWeight: 600, flex: 1 }}>
            Scan Results
          </Typography>
        </Box>
        
        {scanResultsEntities.length === 0 ? (
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            flex: 1,
            color: 'text.secondary',
          }}>
            <SearchOutlined sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
            <Typography variant="body1">No entities detected</Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              Scan a page to see detected entities here
            </Typography>
          </Box>
        ) : (
          <>
            {/* Stats - Clickable for filtering */}
            <Box sx={{ 
              display: 'flex', 
              gap: 0, 
              mb: 2, 
              borderRadius: 1,
              border: 1,
              borderColor: 'divider',
              overflow: 'hidden',
            }}>
              <Box 
                onClick={() => setScanResultsFoundFilter(scanResultsFoundFilter === 'found' ? 'all' : 'found')}
                sx={{ 
                  flex: 1, 
                  textAlign: 'center', 
                  p: 1.5,
                  cursor: 'pointer',
                  bgcolor: scanResultsFoundFilter === 'found' ? 'success.main' : 'action.hover',
                  color: scanResultsFoundFilter === 'found' ? 'white' : 'inherit',
                  transition: 'all 0.15s',
                  '&:hover': {
                    bgcolor: scanResultsFoundFilter === 'found' ? 'success.dark' : 'action.selected',
                  },
                }}
              >
                <Typography variant="h5" sx={{ fontWeight: 700, color: scanResultsFoundFilter === 'found' ? 'inherit' : 'success.main' }}>
                  {scanResultsFoundCount}
                </Typography>
                <Typography variant="caption" sx={{ color: scanResultsFoundFilter === 'found' ? 'inherit' : 'text.secondary', opacity: scanResultsFoundFilter === 'found' ? 0.9 : 1 }}>
                  Found
                </Typography>
              </Box>
              <Divider orientation="vertical" flexItem />
              <Box 
                onClick={() => setScanResultsFoundFilter(scanResultsFoundFilter === 'not-found' ? 'all' : 'not-found')}
                sx={{ 
                  flex: 1, 
                  textAlign: 'center', 
                  p: 1.5,
                  cursor: 'pointer',
                  bgcolor: scanResultsFoundFilter === 'not-found' ? 'warning.main' : 'action.hover',
                  color: scanResultsFoundFilter === 'not-found' ? 'white' : 'inherit',
                  transition: 'all 0.15s',
                  '&:hover': {
                    bgcolor: scanResultsFoundFilter === 'not-found' ? 'warning.dark' : 'action.selected',
                  },
                }}
              >
                <Typography variant="h5" sx={{ fontWeight: 700, color: scanResultsFoundFilter === 'not-found' ? 'inherit' : 'warning.main' }}>
                  {scanResultsNotFoundCount}
                </Typography>
                <Typography variant="caption" sx={{ color: scanResultsFoundFilter === 'not-found' ? 'inherit' : 'text.secondary', opacity: scanResultsFoundFilter === 'not-found' ? 0.9 : 1 }}>
                  Not Found
                </Typography>
              </Box>
            </Box>
            
            {/* Type filter */}
            {scanResultsEntityTypes.length > 1 && (
              <Box sx={{ mb: 2 }}>
                <FormControl fullWidth size="small">
                  <InputLabel id="scan-results-type-filter-label">Filter by type</InputLabel>
                  <Select
                    labelId="scan-results-type-filter-label"
                    value={scanResultsTypeFilter}
                    label="Filter by type"
                    onChange={(e) => setScanResultsTypeFilter(e.target.value)}
                  >
                    <MenuItem value="all">
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                        <span>All types</span>
                        <Chip label={scanResultsEntities.length} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
                      </Box>
                    </MenuItem>
                    {scanResultsEntityTypes.map(type => (
                      <MenuItem key={type} value={type}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                          <span>{type.replace(/-/g, ' ').replace(/^oaev-/, 'OpenAEV ')}</span>
                          <Chip label={scanResultsEntities.filter(e => e.type === type).length} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            )}
            
            {/* Discover more with AI button - always visible */}
            {(() => {
              const hasEnterprisePlatform = availablePlatforms.some(p => p.isEnterprise);
              const isAiButtonDisabled = aiDiscoveringEntities || !aiSettings.available || !hasEnterprisePlatform;
              const aiColors = getAiColor(mode);
              
              // Determine tooltip message based on state
              let tooltipMessage = 'Use AI to find additional entities that may have been missed by pattern matching';
              if (aiDiscoveringEntities) {
                tooltipMessage = 'Analyzing page content...';
              } else if (!aiSettings.available) {
                tooltipMessage = 'AI is not configured. Go to Settings → Agentic AI to enable.';
              } else if (!hasEnterprisePlatform) {
                tooltipMessage = 'Requires at least one Enterprise Edition platform';
              }
              
              return (
                <Box sx={{ mb: 2 }}>
                  <Tooltip title={tooltipMessage} placement="top">
                    <span>
                      <Button
                        variant="outlined"
                        fullWidth
                        onClick={handleDiscoverEntitiesWithAI}
                        disabled={isAiButtonDisabled}
                        startIcon={aiDiscoveringEntities ? <CircularProgress size={16} /> : <AutoAwesomeOutlined />}
                        sx={{
                          textTransform: 'none',
                          borderColor: aiColors.main,
                          color: aiColors.main,
                          '&:hover': {
                            borderColor: aiColors.dark,
                            bgcolor: hexToRGB(aiColors.main, 0.08),
                          },
                          '&.Mui-disabled': {
                            borderColor: hexToRGB(aiColors.main, 0.3),
                            color: hexToRGB(aiColors.main, 0.5),
                          },
                        }}
                      >
                        {aiDiscoveringEntities ? 'Discovering...' : 'Discover more with AI'}
                      </Button>
                    </span>
                  </Tooltip>
                </Box>
              );
            })()}
            
            {/* Select All / Deselect All for new (not found) entities */}
            {(() => {
              const notFoundEntities = filteredScanResultsEntities.filter(e => !e.found);
              const notFoundValues = notFoundEntities.map(e => e.value || e.name);
              const selectedNotFoundCount = notFoundValues.filter(v => selectedScanItems.has(v)).length;
              const allSelected = selectedNotFoundCount === notFoundEntities.length && notFoundEntities.length > 0;
              
              if (notFoundEntities.length === 0) return null;
              
              return (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {selectedNotFoundCount > 0 
                      ? `${selectedNotFoundCount} of ${notFoundEntities.length} new entities selected`
                      : `${notFoundEntities.length} new entities available for import`
                    }
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      if (allSelected) {
                        // Deselect all
                        window.parent.postMessage({ type: 'XTM_DESELECT_ALL' }, '*');
                        setSelectedScanItems(new Set());
                      } else {
                        // Select all not-found entities
                        window.parent.postMessage({ type: 'XTM_SELECT_ALL', values: notFoundValues }, '*');
                        setSelectedScanItems(new Set(notFoundValues));
                      }
                    }}
                    startIcon={allSelected ? <CheckBoxOutlined /> : <CheckBoxOutlineBlankOutlined />}
                    sx={{ 
                      textTransform: 'none', 
                      fontSize: '0.75rem',
                      py: 0.25,
                      minWidth: 'auto',
                    }}
                  >
                    {allSelected ? 'Deselect all' : 'Select all new'}
                  </Button>
                </Box>
              );
            })()}
            
            {/* Entity list */}
            <Box sx={{ flex: 1, overflow: 'auto' }}>
              {filteredScanResultsEntities.map((entity, index) => {
                const aiColors = getAiColor(mode);
                const entityColor = entity.discoveredByAI ? aiColors.main : itemColor(entity.type, mode === 'dark');
                const displayType = entity.type.replace('oaev-', '');
                
                // Count platforms by type
                const octiCount = entity.platformMatches?.filter(pm => pm.platformType === 'opencti').length || 0;
                const oaevCount = entity.platformMatches?.filter(pm => pm.platformType === 'openaev').length || 0;
                const hasMultiplePlatforms = (entity.platformMatches?.length || 0) > 1;
                
                const entityValue = entity.value || entity.name;
                const isSelected = selectedScanItems.has(entityValue);
                
                // Determine border color: AI color for AI-discovered, green for found, orange for not found
                const borderColor = entity.discoveredByAI 
                  ? aiColors.main 
                  : (entity.found ? 'success.main' : 'warning.main');
                
                return (
                  <Paper
                    key={entity.id + '-' + index}
                    elevation={0}
                    onClick={() => handleScanResultEntityClick(entity)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      p: 1.5,
                      mb: 1,
                      bgcolor: isSelected 
                        ? hexToRGB('#1976d2', 0.08) 
                        : (entity.discoveredByAI ? hexToRGB(aiColors.main, 0.05) : 'background.paper'),
                      border: 1,
                      borderColor: isSelected ? 'primary.main' : borderColor,
                      borderRadius: 1,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      borderLeftWidth: 4,
                      '&:hover': {
                        bgcolor: isSelected 
                          ? hexToRGB('#1976d2', 0.12) 
                          : (entity.discoveredByAI ? hexToRGB(aiColors.main, 0.1) : 'action.hover'),
                        boxShadow: 1,
                      },
                    }}
                  >
                    {/* Checkbox for non-found entities (including AI-discovered) */}
                    {!entity.found && (
                      <Checkbox
                        checked={isSelected}
                        onClick={(e) => {
                          e.stopPropagation();
                          window.parent.postMessage({ type: 'XTM_TOGGLE_SELECTION', value: entityValue }, '*');
                          setSelectedScanItems(prev => {
                            const next = new Set(prev);
                            if (next.has(entityValue)) {
                              next.delete(entityValue);
                            } else {
                              next.add(entityValue);
                            }
                            return next;
                          });
                        }}
                        size="small"
                        sx={{ 
                          p: 0.5, 
                          mr: 0.5,
                          '&.Mui-checked': { color: entity.discoveredByAI ? aiColors.main : 'primary.main' },
                        }}
                      />
                    )}
                    <ItemIcon type={entity.type} size="small" color={entityColor} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: 'break-word' }}>
                        {entity.name || entity.value}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                        <Typography variant="caption" sx={{ color: entity.discoveredByAI ? aiColors.main : 'text.secondary' }}>
                          {displayType.replace(/-/g, ' ')}
                        </Typography>
                        {/* Show AI indicator for AI-discovered entities */}
                        {entity.discoveredByAI && (
                          <Tooltip title={entity.aiReason || 'Detected by AI analysis'} placement="top">
                            <Chip 
                              icon={<AutoAwesomeOutlined sx={{ fontSize: '0.7rem !important' }} />}
                              label="AI"
                              size="small" 
                              sx={{ 
                                height: 16, 
                                fontSize: '0.6rem',
                                bgcolor: hexToRGB(aiColors.main, 0.2),
                                color: aiColors.main,
                                '& .MuiChip-label': { px: 0.5 },
                                '& .MuiChip-icon': { ml: 0.5, mr: -0.25 },
                              }} 
                            />
                          </Tooltip>
                        )}
                        {/* Show platform counts */}
                        {!entity.discoveredByAI && (octiCount > 0 || oaevCount > 0) && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 0.5 }}>
                            {octiCount > 0 && (
                              <Chip 
                                label={`OCTI${hasMultiplePlatforms ? ` (${octiCount})` : ''}`}
                                size="small" 
                                sx={{ 
                                  height: 16, 
                                  fontSize: '0.6rem',
                                  bgcolor: hexToRGB('#ff9800', 0.2),
                                  color: '#ff9800',
                                  '& .MuiChip-label': { px: 0.75 },
                                }} 
                              />
                            )}
                            {oaevCount > 0 && (
                              <Chip 
                                label={`OAEV${hasMultiplePlatforms ? ` (${oaevCount})` : ''}`}
                                size="small" 
                                sx={{ 
                                  height: 16, 
                                  fontSize: '0.6rem',
                                  bgcolor: hexToRGB('#00bcd4', 0.2),
                                  color: '#00bcd4',
                                  '& .MuiChip-label': { px: 0.75 },
                                }} 
                              />
                            )}
                          </Box>
                        )}
                      </Box>
                    </Box>
                    {/* Status chip: Found (green), New (orange), or AI (purple) */}
                    <Chip
                      label={entity.found ? 'Found' : (entity.discoveredByAI ? 'AI' : 'New')}
                      size="small"
                      variant="outlined"
                      sx={{ 
                        minWidth: 50,
                        borderColor: entity.discoveredByAI ? aiColors.main : undefined,
                        color: entity.discoveredByAI ? aiColors.main : undefined,
                      }}
                      color={entity.found ? 'success' : (entity.discoveredByAI ? undefined : 'warning')}
                    />
                    <ChevronRightOutlined sx={{ color: 'text.secondary', fontSize: 18 }} />
                  </Paper>
                );
              })}
            </Box>
          </>
        )}
      </Box>
    );
  };

  // ============================================================================
  // Atomic Testing Mode (OpenAEV)
  // ============================================================================
  
  // State for atomic testing
  const [atomicTestingTargets, setAtomicTestingTargets] = useState<Array<{
    type: string;
    value: string;
    name: string;
    entityId?: string;
    platformId?: string;
    data: any;
  }>>([]);
  const [selectedAtomicTarget, setSelectedAtomicTarget] = useState<{
    type: string;
    value: string;
    name: string;
    entityId?: string;
    platformId?: string;
    data: any;
  } | null>(null);
  const [atomicTestingShowList, setAtomicTestingShowList] = useState(true); // Show target list first
  const [atomicTestingPlatformId, setAtomicTestingPlatformId] = useState<string | null>(null);
  const [atomicTestingPlatformSelected, setAtomicTestingPlatformSelected] = useState(false);
  const [atomicTestingTargetType, setAtomicTestingTargetType] = useState<'asset' | 'asset_group'>('asset');
  const [atomicTestingAssets, setAtomicTestingAssets] = useState<any[]>([]);
  const [atomicTestingAssetGroups, setAtomicTestingAssetGroups] = useState<any[]>([]);
  const [atomicTestingTypeFilter, setAtomicTestingTypeFilter] = useState<'all' | 'attack-pattern' | 'domain'>('all');
  const [atomicTestingInjectorContracts, setAtomicTestingInjectorContracts] = useState<any[]>([]);
  const [atomicTestingSelectedAsset, setAtomicTestingSelectedAsset] = useState<string | null>(null);
  const [atomicTestingSelectedAssetGroup, setAtomicTestingSelectedAssetGroup] = useState<string | null>(null);
  const [atomicTestingSelectedContract, setAtomicTestingSelectedContract] = useState<string | null>(null);
  const [atomicTestingTitle, setAtomicTestingTitle] = useState<string>('');
  const [atomicTestingCreating, setAtomicTestingCreating] = useState(false);
  const [atomicTestingLoadingAssets, setAtomicTestingLoadingAssets] = useState(false);
  
  // AI Payload Generation state for atomic testing
  const [atomicTestingAIMode, setAtomicTestingAIMode] = useState(false); // Whether AI payload generation is selected
  const [atomicTestingAIGenerating, setAtomicTestingAIGenerating] = useState(false);
  const [atomicTestingAIPlatform, setAtomicTestingAIPlatform] = useState<string>('Windows'); // Windows, Linux, MacOS
  const [atomicTestingAIExecutor, setAtomicTestingAIExecutor] = useState<string>('psh'); // psh, cmd, bash, sh
  const [atomicTestingAIContext, setAtomicTestingAIContext] = useState<string>(''); // Page context for AI
  const [atomicTestingAIGeneratedPayload, setAtomicTestingAIGeneratedPayload] = useState<{
    name: string;
    description: string;
    executor: string;
    command: string;
    cleanupCommand?: string;
    cleanupExecutor?: string;
    platform: string;
  } | null>(null);
  
  // Get OpenAEV platforms only
  const openaevPlatforms = React.useMemo(() => 
    availablePlatforms.filter(p => p.type === 'openaev'), 
    [availablePlatforms]
  );
  
  // Handle platform selection for atomic testing
  const handleSelectAtomicTestingPlatform = async (platformId: string) => {
    setAtomicTestingPlatformId(platformId);
    setAtomicTestingPlatformSelected(true);
    setAtomicTestingTypeFilter('all'); // Reset filter
    
    // Load assets and asset groups
    setAtomicTestingLoadingAssets(true);
    try {
      // Fetch assets, asset groups, and all contracts in parallel
      const [assetsRes, groupsRes, allContractsRes] = await Promise.all([
        chrome.runtime.sendMessage({ type: 'FETCH_OAEV_ASSETS', payload: { platformId } }),
        chrome.runtime.sendMessage({ type: 'FETCH_OAEV_ASSET_GROUPS', payload: { platformId } }),
        chrome.runtime.sendMessage({ type: 'FETCH_INJECTOR_CONTRACTS', payload: { platformId } }), // Fetch all contracts
      ]);
      
      if (assetsRes?.success) {
        setAtomicTestingAssets(assetsRes.data || []);
      }
      if (groupsRes?.success) {
        setAtomicTestingAssetGroups(groupsRes.data || []);
      }
      
      // Enrich attack patterns with contract availability
      // Only process attack patterns from the selected platform - others won't have matching contracts
      if (allContractsRes?.success) {
        const allContracts = allContractsRes.data || [];
        log.debug(' All contracts for atomic testing:', allContracts.length, 'for platform:', platformId);
        
        // Update targets with contract availability
        setAtomicTestingTargets(prevTargets => {
          return prevTargets.map(target => {
            if (target.type !== 'attack-pattern') return target;
            
            // Only process attack patterns from the selected platform
            if (target.platformId !== platformId) {
              return target; // Keep original data, won't be displayed anyway
            }
            
            const targetId = target.entityId || target.data?.entityId || target.data?.attack_pattern_id || target.data?.id;
            
            // Find contracts that match this attack pattern
            // NOTE: injector_contract_attack_patterns is a List<String> of UUIDs, not objects!
            const matchingContracts = allContracts.filter((contract: any) => {
              const contractApIds: string[] = contract.injector_contract_attack_patterns || [];
              // Each item in the array is a UUID string, match directly
              return contractApIds.includes(targetId);
            });
            
            // Collect all unique platforms from matching contracts
            const availablePlatforms = new Set<string>();
            for (const contract of matchingContracts) {
              const platforms = contract.injector_contract_platforms || [];
              for (const p of platforms) {
                availablePlatforms.add(p);
              }
            }
            
            log.debug(' Attack pattern', target.name, '(', targetId, ') has', matchingContracts.length, 'contracts, platforms:', Array.from(availablePlatforms));
            
            return {
              ...target,
              data: {
                ...target.data,
                hasContracts: matchingContracts.length > 0,
                contractCount: matchingContracts.length,
                availablePlatforms: Array.from(availablePlatforms),
              },
            };
          });
        });
      }
      
      // If selected target is attack pattern, load injector contracts for it
      if (selectedAtomicTarget?.type === 'attack-pattern') {
        const entityId = selectedAtomicTarget.entityId || 
          selectedAtomicTarget.data?.entityId || 
          selectedAtomicTarget.data?.attack_pattern_id ||
          selectedAtomicTarget.data?.id;
        
        if (entityId) {
          log.debug(' Platform selected, fetching injector contracts for:', entityId);
          const contractsRes = await chrome.runtime.sendMessage({
            type: 'FETCH_INJECTOR_CONTRACTS',
            payload: { attackPatternId: entityId, platformId },
          });
          log.debug(' Injector contracts response:', contractsRes);
          if (contractsRes?.success) {
            setAtomicTestingInjectorContracts(contractsRes.data || []);
          }
        }
      }
    } catch (error) {
      log.error(' Failed to load assets:', error);
    } finally {
      setAtomicTestingLoadingAssets(false);
    }
  };
  
  // Handle atomic testing creation
  const handleCreateAtomicTesting = async () => {
    if (!selectedAtomicTarget || !atomicTestingPlatformId) return;
    
    const targetAssetId = atomicTestingTargetType === 'asset' ? atomicTestingSelectedAsset : null;
    const targetAssetGroupId = atomicTestingTargetType === 'asset_group' ? atomicTestingSelectedAssetGroup : null;
    
    if (!targetAssetId && !targetAssetGroupId) {
      log.error(' No target selected');
      return;
    }
    
    setAtomicTestingCreating(true);
    
    try {
      let injectorContractId = atomicTestingSelectedContract;
      
      // If it's a domain/hostname, we need to create a payload first
      // Types from content script are 'Domain-Name' and 'Hostname'
      const isDomainOrHostname = selectedAtomicTarget.type === 'Domain-Name' || 
                                  selectedAtomicTarget.type === 'Hostname' ||
                                  selectedAtomicTarget.type === 'domain' || 
                                  selectedAtomicTarget.type === 'hostname';
      
      if (isDomainOrHostname) {
        log.debug(' Processing DNS resolution for:', selectedAtomicTarget.value);
        
        // First, check if a DNS resolution payload already exists for this hostname
        log.debug(' Checking for existing DNS resolution payload...');
        const existingPayloadRes = await chrome.runtime.sendMessage({
          type: 'FIND_DNS_RESOLUTION_PAYLOAD',
          payload: {
            hostname: selectedAtomicTarget.value,
            platformId: atomicTestingPlatformId,
          },
        });
        
        let payload: any = null;
        
        if (existingPayloadRes?.success && existingPayloadRes.data) {
          // Reuse existing payload
          log.debug(' Found existing DNS resolution payload:', existingPayloadRes.data.payload_id);
          payload = existingPayloadRes.data;
        } else {
          // Create new DNS resolution payload
          log.debug(' No existing payload found, creating new one...');
          const payloadRes = await chrome.runtime.sendMessage({
            type: 'CREATE_OAEV_PAYLOAD',
            payload: {
              hostname: selectedAtomicTarget.value,
              name: `DNS Resolution - ${selectedAtomicTarget.value}`,
              platforms: ['Linux', 'Windows', 'MacOS'],
              platformId: atomicTestingPlatformId,
            },
          });
          
          log.debug(' Payload creation response:', payloadRes);
          
          if (!payloadRes?.success) {
            log.error(' Failed to create payload:', payloadRes?.error);
            return;
          }
          
          payload = payloadRes.data;
          log.debug(' Created new payload:', payload);
        }
        
        // Try to get injector contract ID from various possible locations in the response
        injectorContractId = payload?.payload_injector_contract?.injector_contract_id ||
                            payload?.payload_injector_contract ||
                            payload?.injector_contract_id;
        
        // If not in response, search for the injector contract by payload ID
        if (!injectorContractId && payload?.payload_id) {
          log.debug(' Injector contract not in response, searching by payload ID...');
          
          // Use the API to find the injector contract for this payload
          const findContractRes = await chrome.runtime.sendMessage({
            type: 'FIND_INJECTOR_CONTRACT_BY_PAYLOAD',
            payload: {
              payloadId: payload.payload_id,
              platformId: atomicTestingPlatformId,
            },
          });
          
          log.debug(' Find injector contract response:', findContractRes);
          
          if (findContractRes?.success && findContractRes.data) {
            injectorContractId = findContractRes.data.injector_contract_id;
          }
        }
        
        if (!injectorContractId) {
          log.error(' No injector contract found for payload. Payload:', payload);
          return;
        }
        
        log.debug(' Using injector contract ID:', injectorContractId);
      }
      
      if (!injectorContractId) {
        log.error(' No injector contract selected');
        return;
      }
      
      // Create atomic testing
      const result = await chrome.runtime.sendMessage({
        type: 'CREATE_ATOMIC_TESTING',
        payload: {
          title: atomicTestingTitle || `Atomic Test - ${selectedAtomicTarget.name}`,
          injectorContractId,
          assetIds: targetAssetId ? [targetAssetId] : [],
          assetGroupIds: targetAssetGroupId ? [targetAssetGroupId] : [],
          platformId: atomicTestingPlatformId,
        },
      });
      
      if (result?.success && result.data?.url) {
        // Open in new tab
        chrome.tabs.create({ url: result.data.url });
        
        // Close panel via postMessage to content script
        window.parent.postMessage({ type: 'XTM_CLOSE_PANEL' }, '*');
        
        // Reset state
        setAtomicTestingTargets([]);
        setSelectedAtomicTarget(null);
        setAtomicTestingPlatformSelected(false);
        setPanelMode('empty');
      }
    } catch (error) {
      log.error(' Failed to create atomic testing:', error);
    } finally {
      setAtomicTestingCreating(false);
    }
  };
  
  // Reset atomic testing state
  const resetAtomicTesting = () => {
    setAtomicTestingTargets([]);
    setSelectedAtomicTarget(null);
    setAtomicTestingShowList(true);
    setAtomicTestingPlatformId(null);
    setAtomicTestingPlatformSelected(false);
    setAtomicTestingAssets([]);
    setAtomicTestingAssetGroups([]);
    setAtomicTestingInjectorContracts([]);
    setAtomicTestingSelectedAsset(null);
    setAtomicTestingSelectedAssetGroup(null);
    setAtomicTestingSelectedContract(null);
    setAtomicTestingTitle('');
    setPanelMode('empty');
    
    // Clear highlights
    chrome.tabs?.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { type: 'CLEAR_HIGHLIGHTS' });
      }
    });
  };
  
  // Handle selecting a target from the list
  const handleSelectAtomicTargetFromList = (target: typeof atomicTestingTargets[0]) => {
    setSelectedAtomicTarget(target);
    setAtomicTestingTitle(`Atomic Test - ${target.name}`);
    setAtomicTestingShowList(false);
    setAtomicTestingInjectorContracts([]); // Reset contracts
    setAtomicTestingSelectedContract(null);
    
    // If it's an attack pattern and platform is selected, load injector contracts
    // The attack pattern ID should be from OpenAEV - check multiple possible locations
    const entityId = target.entityId || 
      target.data?.entityId || 
      target.data?.attack_pattern_id ||
      target.data?.id;
    
    log.debug(' Selecting atomic target:', { target, entityId, platformId: atomicTestingPlatformId });
    
    if (target.type === 'attack-pattern' && entityId && atomicTestingPlatformId) {
      log.debug(' Fetching injector contracts for attack pattern:', entityId);
      chrome.runtime.sendMessage({
        type: 'FETCH_INJECTOR_CONTRACTS',
        payload: { attackPatternId: entityId, platformId: atomicTestingPlatformId },
      }).then((res: any) => {
        log.debug(' Injector contracts response:', res);
        if (res?.success) {
          setAtomicTestingInjectorContracts(res.data || []);
        }
      });
    }
  };
  
  // Handle AI payload generation
  const handleGenerateAIPayload = async () => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
    
    setAtomicTestingAIGenerating(true);
    
    try {
      // Get page content for context
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      let pageContent = '';
      let pageTitle = '';
      let pageUrl = '';
      
      if (tab?.id) {
        const contentResponse = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_CONTENT' });
        if (contentResponse?.success) {
          pageContent = contentResponse.data?.content || '';
          pageTitle = contentResponse.data?.title || '';
          pageUrl = contentResponse.data?.url || '';
        }
      }
      
      // Call AI to generate atomic test payload
      const response = await chrome.runtime.sendMessage({
        type: 'AI_GENERATE_ATOMIC_TEST',
        payload: {
          attackPattern: {
            name: `AI Generated Payload for ${atomicTestingAIPlatform}`,
            description: atomicTestingAIContext || 'Generate a security simulation payload based on the page content',
          },
          targetPlatform: atomicTestingAIPlatform.toLowerCase(),
          context: pageContent.substring(0, 3000) + (atomicTestingAIContext ? `\n\nAdditional context: ${atomicTestingAIContext}` : ''),
        },
      });
      
      if (response?.success && response.data) {
        const generatedTest = response.data;
        setAtomicTestingAIGeneratedPayload({
          name: generatedTest.name || `AI Payload - ${atomicTestingAIPlatform}`,
          description: generatedTest.description || 'AI-generated security simulation payload',
          executor: atomicTestingAIExecutor,
          command: generatedTest.command || '',
          cleanupCommand: generatedTest.cleanupCommand,
          cleanupExecutor: atomicTestingAIExecutor,
          platform: atomicTestingAIPlatform,
        });
        setAtomicTestingTitle(`Atomic Test - ${generatedTest.name || 'AI Generated'}`);
        log.debug(' AI generated payload:', generatedTest);
      } else {
        log.error(' AI payload generation failed:', response?.error);
      }
    } catch (error) {
      log.error(' AI payload generation error:', error);
    } finally {
      setAtomicTestingAIGenerating(false);
    }
  };
  
  // Handle creating atomic testing with AI-generated payload
  const handleCreateAtomicTestingWithAIPayload = async () => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
    if (!atomicTestingAIGeneratedPayload) return;
    
    setAtomicTestingCreating(true);
    
    try {
      // Step 1: Create the Command payload on OpenAEV
      log.debug(' Creating AI-generated Command payload on OpenAEV...');
      
      const payloadData = {
        payload_type: 'Command',
        payload_name: atomicTestingAIGeneratedPayload.name,
        payload_description: atomicTestingAIGeneratedPayload.description,
        payload_platforms: [atomicTestingAIGeneratedPayload.platform],
        command_executor: atomicTestingAIGeneratedPayload.executor,
        command_content: atomicTestingAIGeneratedPayload.command,
        payload_cleanup_executor: atomicTestingAIGeneratedPayload.cleanupExecutor || null,
        payload_cleanup_command: atomicTestingAIGeneratedPayload.cleanupCommand || null,
        payload_source: 'MANUAL',
        payload_status: 'VERIFIED',
        payload_execution_arch: 'ALL_ARCHITECTURES',
        payload_expectations: ['PREVENTION', 'DETECTION'],
      };
      
      const payloadRes = await chrome.runtime.sendMessage({
        type: 'CREATE_OAEV_PAYLOAD',
        payload: {
          payload: payloadData,
          platformId: atomicTestingPlatformId,
        },
      });
      
      if (!payloadRes?.success || !payloadRes.data) {
        log.error(' Failed to create AI payload:', payloadRes?.error);
        setAtomicTestingCreating(false);
        return;
      }
      
      log.debug(' AI payload created:', payloadRes.data);
      const createdPayload = payloadRes.data;
      
      // Step 2: Get the injector contract for this payload
      let injectorContractId = createdPayload.payload_injector_contract?.injector_contract_id ||
        createdPayload.payload_injector_contract ||
        createdPayload.injector_contract_id;
      
      // If no contract ID in response, find the injector contract for this payload
      if (!injectorContractId) {
        log.debug(' Searching for injector contract for created payload...');
        const findContractRes = await chrome.runtime.sendMessage({
          type: 'FIND_INJECTOR_CONTRACT_BY_PAYLOAD',
          payload: {
            payloadId: createdPayload.payload_id,
            platformId: atomicTestingPlatformId,
          },
        });
        
        if (findContractRes?.success && findContractRes.data) {
          injectorContractId = findContractRes.data.injector_contract_id;
          log.debug(' Found injector contract:', injectorContractId);
        }
      }
      
      if (!injectorContractId) {
        log.error(' No injector contract found for AI-generated payload');
        setAtomicTestingCreating(false);
        return;
      }
      
      // Step 3: Create the atomic testing
      const targetAssetId = atomicTestingTargetType === 'asset' ? atomicTestingSelectedAsset : null;
      const targetAssetGroupId = atomicTestingTargetType === 'asset_group' ? atomicTestingSelectedAssetGroup : null;
      
      const response = await chrome.runtime.sendMessage({
        type: 'CREATE_ATOMIC_TESTING',
        payload: {
          title: atomicTestingTitle || `Atomic Test - ${atomicTestingAIGeneratedPayload.name}`,
          injectorContractId,
          assetIds: targetAssetId ? [targetAssetId] : [],
          assetGroupIds: targetAssetGroupId ? [targetAssetGroupId] : [],
          platformId: atomicTestingPlatformId,
        },
      });
      
      if (response?.success && response.data) {
        log.debug(' Atomic testing created from AI payload:', response.data);
        
        // Close panel
        window.parent.postMessage({ type: 'XTM_CLOSE_PANEL' }, '*');
        window.parent.postMessage({ type: 'XTM_CLEAR_HIGHLIGHTS' }, '*');
        
        // Open in new tab
        const atomicTestingId = response.data.atomic_id || response.data.id;
        if (atomicTestingId && atomicTestingPlatformId) {
          const platformUrl = openaevPlatforms.find(p => p.id === atomicTestingPlatformId)?.url || '';
          const atomicTestingUrl = `${platformUrl}/admin/atomic_testings/${atomicTestingId}`;
          chrome.tabs.create({ url: atomicTestingUrl });
        }
        
        // Reset state
        setAtomicTestingAIMode(false);
        setAtomicTestingAIGeneratedPayload(null);
        setAtomicTestingShowList(true);
      } else {
        log.error(' Failed to create atomic testing from AI payload:', response?.error);
      }
    } catch (error) {
      log.error(' Error creating atomic testing with AI payload:', error);
    } finally {
      setAtomicTestingCreating(false);
    }
  };
  
  const renderAtomicTestingView = () => {
    const logoSuffix = mode === 'dark' ? 'dark-theme' : 'light-theme';
    const openaevLogoPath = `../assets/logos/logo_openaev_${logoSuffix}_embleme_square.svg`;
    
    // Step 1: Platform selection (if multiple OpenAEV platforms)
    if (openaevPlatforms.length > 1 && !atomicTestingPlatformSelected) {
      return (
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <img src={openaevLogoPath} alt="OpenAEV" style={{ height: 24, width: 'auto' }} />
            <Typography variant="h6" sx={{ fontSize: 16, flex: 1 }}>Atomic Testing</Typography>
          </Box>
          
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Select OpenAEV platform to create atomic testing:
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {openaevPlatforms.map((platform) => (
              <Paper
                key={platform.id}
                onClick={() => handleSelectAtomicTestingPlatform(platform.id)}
                elevation={0}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  p: 2,
                  cursor: 'pointer',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.main' },
                }}
              >
                <img src={openaevLogoPath} alt="OpenAEV" style={{ width: 24, height: 24 }} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {platform.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {platform.url}
                  </Typography>
                </Box>
                <ChevronRightOutlined sx={{ color: 'text.secondary' }} />
              </Paper>
            ))}
          </Box>
        </Box>
      );
    }
    
    // Auto-select single platform
    if (openaevPlatforms.length === 1 && !atomicTestingPlatformSelected && !atomicTestingLoadingAssets) {
      handleSelectAtomicTestingPlatform(openaevPlatforms[0].id);
    }
    
    // Step 2: Show list of found targets (like scan results)
    if (atomicTestingShowList && atomicTestingPlatformSelected) {
      // Filter attack patterns to only show those from the selected OpenAEV platform
      // Attack patterns from other platforms won't have matching contracts
      const attackPatterns = atomicTestingTargets.filter(t => 
        t.type === 'attack-pattern' && t.platformId === atomicTestingPlatformId
      );
      const domains = atomicTestingTargets.filter(t => t.type === 'Domain-Name' || t.type === 'domain');
      const hostnames = atomicTestingTargets.filter(t => t.type === 'Hostname' || t.type === 'hostname');
      
      // Separate attack patterns by contract availability
      const attackPatternsWithContracts = attackPatterns.filter(t => t.data?.hasContracts === true);
      const attackPatternsWithoutContracts = attackPatterns.filter(t => t.data?.hasContracts !== true);
      
      // Apply filter using state variable
      const showAttackPatterns = atomicTestingTypeFilter === 'all' || atomicTestingTypeFilter === 'attack-pattern';
      const showDomains = atomicTestingTypeFilter === 'all' || atomicTestingTypeFilter === 'domain';
      const showHostnames = atomicTestingTypeFilter === 'all' || atomicTestingTypeFilter === 'domain'; // Include hostnames with domains
      
      return (
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexShrink: 0 }}>
            <img src={openaevLogoPath} alt="OpenAEV" style={{ height: 24, width: 'auto' }} />
            <Typography variant="h6" sx={{ fontSize: 16, flex: 1 }}>Atomic Testing</Typography>
          </Box>
          
          {/* Type Stats - Clickable Boxes */}
          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexShrink: 0 }}>
            {attackPatterns.length > 0 && (
              <Paper
                elevation={0}
                onClick={() => setAtomicTestingTypeFilter(atomicTestingTypeFilter === 'attack-pattern' ? 'all' : 'attack-pattern')}
                sx={{
                  flex: 1,
                  p: 1.5,
                  borderRadius: 1,
                  textAlign: 'center',
                  cursor: 'pointer',
                  border: 2,
                  borderColor: atomicTestingTypeFilter === 'attack-pattern' ? '#d4e157' : 'transparent',
                  bgcolor: atomicTestingTypeFilter === 'attack-pattern' ? 'rgba(212, 225, 87, 0.1)' : 'action.hover',
                  transition: 'all 0.2s',
                  '&:hover': { bgcolor: 'rgba(212, 225, 87, 0.15)' },
                }}
              >
                <LockPattern sx={{ fontSize: 24, color: '#d4e157', mb: 0.5 }} />
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#d4e157' }}>
                  {attackPatterns.length}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  Attack Patterns
                </Typography>
              </Paper>
            )}
            {(domains.length > 0 || hostnames.length > 0) && (
              <Paper
                elevation={0}
                onClick={() => setAtomicTestingTypeFilter(atomicTestingTypeFilter === 'domain' ? 'all' : 'domain')}
                sx={{
                  flex: 1,
                  p: 1.5,
                  borderRadius: 1,
                  textAlign: 'center',
                  cursor: 'pointer',
                  border: 2,
                  borderColor: atomicTestingTypeFilter === 'domain' ? '#00bcd4' : 'transparent',
                  bgcolor: atomicTestingTypeFilter === 'domain' ? 'rgba(0, 188, 212, 0.1)' : 'action.hover',
                  transition: 'all 0.2s',
                  '&:hover': { bgcolor: 'rgba(0, 188, 212, 0.15)' },
                }}
              >
                <LanguageOutlined sx={{ fontSize: 24, color: '#00bcd4', mb: 0.5 }} />
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#00bcd4' }}>
                  {domains.length + hostnames.length}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  Domains
                </Typography>
              </Paper>
            )}
          </Box>
          
          {/* AI Generate Payload Option - Show at top when AI is available */}
          {(() => {
            const targetPlatform = openaevPlatforms.find(p => p.id === atomicTestingPlatformId);
            const isAIAvailable = aiSettings.available && targetPlatform?.isEnterprise;
            
            let tooltipMessage = '';
            if (!aiSettings.available) {
              tooltipMessage = 'AI is not configured. Configure AI in extension settings.';
            } else if (!targetPlatform?.isEnterprise) {
              tooltipMessage = 'AI features require Enterprise Edition.';
            }
            
            return (
              <Paper
                elevation={0}
                sx={{
                  p: 1.5,
                  mb: 2,
                  borderRadius: 1,
                  border: 1,
                  borderColor: isAIAvailable ? 'primary.main' : 'divider',
                  bgcolor: isAIAvailable ? 'rgba(100, 181, 246, 0.08)' : 'action.disabledBackground',
                  opacity: isAIAvailable ? 1 : 0.6,
                  flexShrink: 0,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <AutoAwesomeOutlined sx={{ fontSize: 24, color: isAIAvailable ? 'primary.main' : 'text.disabled' }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: isAIAvailable ? 'text.primary' : 'text.disabled' }}>
                      Generate Payload with AI
                    </Typography>
                    <Typography variant="caption" sx={{ color: isAIAvailable ? 'text.secondary' : 'text.disabled' }}>
                      {isAIAvailable ? 'Create a custom payload based on page content' : tooltipMessage}
                    </Typography>
                  </Box>
                  <Tooltip title={isAIAvailable ? 'Create payload with AI' : tooltipMessage}>
                    <span>
                      <Button
                        variant="contained"
                        size="small"
                        disabled={!isAIAvailable}
                        onClick={() => {
                          setAtomicTestingAIMode(true);
                          setAtomicTestingShowList(false);
                          setSelectedAtomicTarget(null);
                        }}
                        startIcon={<AutoAwesomeOutlined />}
                        sx={{ textTransform: 'none' }}
                      >
                        Generate
                      </Button>
                    </span>
                  </Tooltip>
                </Box>
              </Paper>
            );
          })()}
          
          {/* Loading indicator while resolving compatible injects */}
          {atomicTestingLoadingAssets && (
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1.5, 
              p: 1.5, 
              mb: 2, 
              bgcolor: 'action.hover', 
              borderRadius: 1,
              flexShrink: 0,
            }}>
              <CircularProgress size={18} />
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Resolving compatible injects for attack patterns...
              </Typography>
            </Box>
          )}
          
          {atomicTestingTargets.length === 0 ? (
            <Alert severity="info">
              No attack patterns or domains found on this page
            </Alert>
          ) : (
            <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
              {/* Domains/Hostnames - Always Playable (show first) */}
              {showDomains && (domains.length > 0 || hostnames.length > 0) && (
                <>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                      Domains & Hostnames ({domains.length + hostnames.length})
                    </Typography>
                    <Chip label="Always playable" size="small" sx={{ height: 18, fontSize: 10, bgcolor: '#4caf50', color: 'white' }} />
                  </Box>
                  {domains.map((target, i) => (
                    <Paper
                      key={`domain-${i}`}
                      onClick={() => handleSelectAtomicTargetFromList(target)}
                      elevation={0}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        p: 1.5,
                        mb: 1,
                        cursor: 'pointer',
                        borderRadius: 1,
                        border: 1,
                        borderColor: 'divider',
                        transition: 'all 0.15s',
                        '&:hover': { bgcolor: 'action.hover', borderColor: '#00bcd4' },
                      }}
                    >
                      <LanguageOutlined sx={{ fontSize: 20, color: '#00bcd4' }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: 'break-word' }}>
                          {target.value}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#4caf50' }}>
                          DNS Resolution payload
                        </Typography>
                      </Box>
                      <ChevronRightOutlined fontSize="small" sx={{ color: 'text.secondary' }} />
                    </Paper>
                  ))}
                  {hostnames.map((target, i) => (
                    <Paper
                      key={`hostname-${i}`}
                      onClick={() => handleSelectAtomicTargetFromList(target)}
                      elevation={0}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        p: 1.5,
                        mb: 1,
                        cursor: 'pointer',
                        borderRadius: 1,
                        border: 1,
                        borderColor: 'divider',
                        transition: 'all 0.15s',
                        '&:hover': { bgcolor: 'action.hover', borderColor: '#9c27b0' },
                      }}
                    >
                      <DnsOutlined sx={{ fontSize: 20, color: '#9c27b0' }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: 'break-word' }}>
                          {target.value}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#4caf50' }}>
                          DNS Resolution payload
                        </Typography>
                      </Box>
                      <ChevronRightOutlined fontSize="small" sx={{ color: 'text.secondary' }} />
                    </Paper>
                  ))}
                </>
              )}
              
              {/* Attack Patterns WITH Contracts - Playable */}
              {showAttackPatterns && attackPatternsWithContracts.length > 0 && (
                <>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, mt: domains.length > 0 || hostnames.length > 0 ? 2 : 0 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                      Attack Patterns ({attackPatternsWithContracts.length})
                    </Typography>
                    <Chip label="Injects available" size="small" sx={{ height: 18, fontSize: 10, bgcolor: '#4caf50', color: 'white' }} />
                  </Box>
                  {attackPatternsWithContracts.map((target, i) => (
                    <Paper
                      key={`ap-ready-${i}`}
                      onClick={() => handleSelectAtomicTargetFromList(target)}
                      elevation={0}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        p: 1.5,
                        mb: 1,
                        cursor: 'pointer',
                        borderRadius: 1,
                        border: 1,
                        borderColor: 'divider',
                        transition: 'all 0.15s',
                        '&:hover': { bgcolor: 'action.hover', borderColor: '#d4e157' },
                      }}
                    >
                      <LockPattern sx={{ fontSize: 20, color: '#d4e157' }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: 'break-word' }}>
                          {target.name}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                          {target.data?.attack_pattern_external_id && (
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              {target.data.attack_pattern_external_id}
                            </Typography>
                          )}
                          {target.data?.contractCount && (
                            <Typography variant="caption" sx={{ color: '#4caf50', fontWeight: 500 }}>
                              {target.data?.attack_pattern_external_id ? ' · ' : ''}{target.data.contractCount} inject{target.data.contractCount !== 1 ? 's' : ''}
                            </Typography>
                          )}
                        </Box>
                        {/* Available platforms */}
                        {target.data?.availablePlatforms && target.data.availablePlatforms.length > 0 && (
                          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                            {target.data.availablePlatforms.map((platform: string) => (
                              <Chip
                                key={platform}
                                icon={getPlatformIcon(platform)}
                                label={platform}
                                size="small"
                                sx={{ 
                                  height: 20, 
                                  fontSize: 10,
                                  bgcolor: getPlatformColor(platform),
                                  color: 'white',
                                  '& .MuiChip-icon': { color: 'white', ml: 0.5 },
                                }}
                              />
                            ))}
                          </Box>
                        )}
                      </Box>
                      <ChevronRightOutlined fontSize="small" sx={{ color: 'text.secondary' }} />
                    </Paper>
                  ))}
                </>
              )}
              
              {/* Attack Patterns WITHOUT Contracts - Not Playable */}
              {showAttackPatterns && attackPatternsWithoutContracts.length > 0 && (
                <>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, mt: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                      Attack Patterns ({attackPatternsWithoutContracts.length})
                    </Typography>
                    <Chip label="No injects" size="small" sx={{ height: 18, fontSize: 10, bgcolor: 'text.disabled', color: 'white' }} />
                  </Box>
                  {attackPatternsWithoutContracts.map((target, i) => (
                    <Paper
                      key={`ap-no-contract-${i}`}
                      elevation={0}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        p: 1.5,
                        mb: 1,
                        borderRadius: 1,
                        border: 1,
                        borderColor: 'divider',
                        opacity: 0.6,
                      }}
                    >
                      <LockPattern sx={{ fontSize: 20, color: 'text.disabled' }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: 'break-word', color: 'text.secondary' }}>
                          {target.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                          {target.data?.attack_pattern_external_id || ''} • No inject contracts
                        </Typography>
                      </Box>
                    </Paper>
                  ))}
                </>
              )}
            </Box>
          )}
          
          <Typography variant="caption" sx={{ color: 'text.secondary', mt: 2, textAlign: 'center', flexShrink: 0 }}>
            Select a target from the list or click on a highlight on the page
          </Typography>
        </Box>
      );
    }
    
    // Step 3: Show AI generation form if AI mode is active
    if (atomicTestingAIMode) {
      return (
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexShrink: 0 }}>
            <img src={openaevLogoPath} alt="OpenAEV" style={{ height: 24, width: 'auto' }} />
            <Typography variant="h6" sx={{ fontSize: 16, flex: 1 }}>AI Payload Generation</Typography>
          </Box>
          
          {/* Back to list button */}
          <Box sx={{ mb: 1.5, flexShrink: 0 }}>
            <Button
              size="small"
              startIcon={<ChevronLeftOutlined />}
              onClick={() => {
                setAtomicTestingAIMode(false);
                setAtomicTestingShowList(true);
                setAtomicTestingAIGeneratedPayload(null);
              }}
              sx={{ 
                color: 'text.secondary',
                textTransform: 'none',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              Back to list
            </Button>
          </Box>
          
          {/* AI Info Card */}
          <Paper 
            elevation={0} 
            sx={{ 
              p: 2, 
              mb: 2, 
              border: 1, 
              borderColor: 'primary.main', 
              borderRadius: 1, 
              bgcolor: 'rgba(100, 181, 246, 0.08)', 
              flexShrink: 0 
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <AutoAwesomeOutlined sx={{ color: 'primary.main' }} />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>AI-Generated Payload</Typography>
            </Box>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              AI will analyze the page content and generate a command payload for testing. 
              Select target platform and executor below.
            </Typography>
          </Paper>
          
          {/* Show generated payload if available, otherwise show generation form */}
          {atomicTestingAIGeneratedPayload ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>
              {/* Generated Payload Info */}
              <Paper elevation={0} sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>Generated Payload</Typography>
                <Typography variant="body1" sx={{ fontWeight: 600, mb: 1 }}>{atomicTestingAIGeneratedPayload.name}</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1, fontSize: 12 }}>
                  {atomicTestingAIGeneratedPayload.description}
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  <Chip label={atomicTestingAIGeneratedPayload.platform} size="small" sx={{ height: 20, fontSize: 10 }} />
                  <Chip label={atomicTestingAIGeneratedPayload.executor} size="small" sx={{ height: 20, fontSize: 10 }} />
                </Box>
              </Paper>
              
              {/* Command Preview */}
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>Command</Typography>
                <Box 
                  sx={{ 
                    p: 1.5, 
                    bgcolor: mode === 'dark' ? '#1e1e1e' : '#f5f5f5', 
                    borderRadius: 1, 
                    fontFamily: 'monospace', 
                    fontSize: 11,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    maxHeight: 120,
                    overflow: 'auto',
                  }}
                >
                  {atomicTestingAIGeneratedPayload.command}
                </Box>
              </Box>
              
              {atomicTestingAIGeneratedPayload.cleanupCommand && (
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>Cleanup Command</Typography>
                  <Box 
                    sx={{ 
                      p: 1.5, 
                      bgcolor: mode === 'dark' ? '#1e1e1e' : '#f5f5f5', 
                      borderRadius: 1, 
                      fontFamily: 'monospace', 
                      fontSize: 11,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      maxHeight: 80,
                      overflow: 'auto',
                    }}
                  >
                    {atomicTestingAIGeneratedPayload.cleanupCommand}
                  </Box>
                </Box>
              )}
              
              {/* Title */}
              <TextField
                label="Test Title"
                value={atomicTestingTitle}
                onChange={(e) => setAtomicTestingTitle(e.target.value)}
                placeholder={`Atomic Test - ${atomicTestingAIGeneratedPayload.name}`}
                size="small"
                fullWidth
              />
              
              {/* Target Type Selection */}
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
                  Target Type
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant={atomicTestingTargetType === 'asset' ? 'contained' : 'outlined'}
                    size="small"
                    onClick={() => setAtomicTestingTargetType('asset')}
                    startIcon={<ComputerOutlined />}
                    sx={{ flex: 1, minWidth: 0 }}
                  >
                    Asset
                  </Button>
                  <Button
                    variant={atomicTestingTargetType === 'asset_group' ? 'contained' : 'outlined'}
                    size="small"
                    onClick={() => setAtomicTestingTargetType('asset_group')}
                    startIcon={<LanOutlined />}
                    sx={{ flex: 1, minWidth: 0 }}
                  >
                    Asset Group
                  </Button>
                </Box>
              </Box>
              
              {/* Asset/Asset Group Selection */}
              {atomicTestingTargetType === 'asset' ? (
                <Autocomplete
                  options={atomicTestingAssets}
                  getOptionLabel={(option) => option.asset_name || option.endpoint_hostname || 'Unknown'}
                  value={atomicTestingAssets.find(a => a.asset_id === atomicTestingSelectedAsset) || null}
                  onChange={(_, value) => setAtomicTestingSelectedAsset(value?.asset_id || null)}
                  renderInput={(params) => <TextField {...params} label="Select Asset" size="small" />}
                  size="small"
                />
              ) : (
                <Autocomplete
                  options={atomicTestingAssetGroups}
                  getOptionLabel={(option) => option.asset_group_name || 'Unknown'}
                  value={atomicTestingAssetGroups.find(g => g.asset_group_id === atomicTestingSelectedAssetGroup) || null}
                  onChange={(_, value) => setAtomicTestingSelectedAssetGroup(value?.asset_group_id || null)}
                  renderInput={(params) => <TextField {...params} label="Select Asset Group" size="small" />}
                  size="small"
                />
              )}
              
              {/* Create Button */}
              <Button
                variant="contained"
                fullWidth
                disabled={
                  atomicTestingCreating ||
                  (atomicTestingTargetType === 'asset' && !atomicTestingSelectedAsset) ||
                  (atomicTestingTargetType === 'asset_group' && !atomicTestingSelectedAssetGroup)
                }
                onClick={handleCreateAtomicTestingWithAIPayload}
                startIcon={atomicTestingCreating ? <CircularProgress size={16} color="inherit" /> : <Target />}
              >
                {atomicTestingCreating ? 'Creating...' : 'Create Atomic Testing'}
              </Button>
              
              {/* Regenerate Button */}
              <Button
                variant="outlined"
                size="small"
                onClick={() => setAtomicTestingAIGeneratedPayload(null)}
                startIcon={<RefreshOutlined />}
                sx={{ textTransform: 'none' }}
              >
                Generate Different Payload
              </Button>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>
              {/* Platform Selection */}
              <FormControl fullWidth size="small">
                <InputLabel>Target Platform</InputLabel>
                <Select
                  value={atomicTestingAIPlatform}
                  label="Target Platform"
                  onChange={(e) => {
                    setAtomicTestingAIPlatform(e.target.value);
                    // Auto-set executor based on platform
                    if (e.target.value === 'Windows') {
                      setAtomicTestingAIExecutor('psh');
                    } else {
                      setAtomicTestingAIExecutor('bash');
                    }
                  }}
                >
                  <MenuItem value="Windows">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {getPlatformIcon('Windows')}
                      <span>Windows</span>
                    </Box>
                  </MenuItem>
                  <MenuItem value="Linux">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {getPlatformIcon('Linux')}
                      <span>Linux</span>
                    </Box>
                  </MenuItem>
                  <MenuItem value="MacOS">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {getPlatformIcon('MacOS')}
                      <span>macOS</span>
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
              
              {/* Executor Selection */}
              <FormControl fullWidth size="small">
                <InputLabel>Command Executor</InputLabel>
                <Select
                  value={atomicTestingAIExecutor}
                  label="Command Executor"
                  onChange={(e) => setAtomicTestingAIExecutor(e.target.value)}
                >
                  {atomicTestingAIPlatform === 'Windows' ? (
                    [
                      <MenuItem key="psh" value="psh">PowerShell</MenuItem>,
                      <MenuItem key="cmd" value="cmd">Command Prompt (cmd)</MenuItem>,
                    ]
                  ) : (
                    [
                      <MenuItem key="bash" value="bash">Bash</MenuItem>,
                      <MenuItem key="sh" value="sh">Sh</MenuItem>,
                    ]
                  )}
                </Select>
              </FormControl>
              
              {/* Additional Context */}
              <TextField
                label="Additional Context (optional)"
                value={atomicTestingAIContext}
                onChange={(e) => setAtomicTestingAIContext(e.target.value)}
                multiline
                rows={3}
                size="small"
                placeholder="Provide any additional context or specific behavior you want the payload to simulate..."
                helperText="AI will use the page content plus this context to generate a relevant payload"
              />
              
              {/* Generate Button */}
              <Button
                variant="contained"
                fullWidth
                disabled={atomicTestingAIGenerating}
                onClick={handleGenerateAIPayload}
                startIcon={atomicTestingAIGenerating ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeOutlined />}
              >
                {atomicTestingAIGenerating ? 'Generating Payload...' : 'Generate Payload with AI'}
              </Button>
            </Box>
          )}
        </Box>
      );
    }
    
    // Step 4: Show form once target is selected
    return (
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexShrink: 0 }}>
          <img src={openaevLogoPath} alt="OpenAEV" style={{ height: 24, width: 'auto' }} />
          <Typography variant="h6" sx={{ fontSize: 16, flex: 1 }}>Atomic Testing</Typography>
        </Box>
        
        {/* Back to list button */}
        {atomicTestingTargets.length > 0 && (
          <Box sx={{ mb: 1.5, flexShrink: 0 }}>
            <Button
              size="small"
              startIcon={<ChevronLeftOutlined />}
              onClick={() => {
                setSelectedAtomicTarget(null);
                setAtomicTestingShowList(true);
              }}
              sx={{ 
                color: 'text.secondary',
                textTransform: 'none',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              Back to list
            </Button>
          </Box>
        )}
        
        {/* Target Info */}
        {selectedAtomicTarget ? (
          <Paper elevation={0} sx={{ p: 2, mb: 2, border: 1, borderColor: '#f44336', borderRadius: 1, bgcolor: 'rgba(244, 67, 54, 0.1)', flexShrink: 0 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>Selected Target</Typography>
            <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedAtomicTarget.name}</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'capitalize' }}>
              {selectedAtomicTarget.type.replace('-', ' ').replace('_', ' ')}
            </Typography>
          </Paper>
        ) : (
          <Alert severity="info" sx={{ mb: 2, flexShrink: 0 }}>
            Click on a highlighted target on the page or select from the list
          </Alert>
        )}
        
        {atomicTestingLoadingAssets ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={32} />
          </Box>
        ) : selectedAtomicTarget && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>
            {/* Title */}
            <TextField
              label="Test Title"
              value={atomicTestingTitle}
              onChange={(e) => setAtomicTestingTitle(e.target.value)}
              placeholder={`Atomic Test - ${selectedAtomicTarget.name}`}
              size="small"
              fullWidth
            />
            
            {/* Target Type Selection */}
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
                Target Type
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant={atomicTestingTargetType === 'asset' ? 'contained' : 'outlined'}
                  size="small"
                  onClick={() => setAtomicTestingTargetType('asset')}
                  startIcon={<ComputerOutlined />}
                  sx={{ flex: 1, minWidth: 0 }}
                >
                  Asset
                </Button>
                <Button
                  variant={atomicTestingTargetType === 'asset_group' ? 'contained' : 'outlined'}
                  size="small"
                  onClick={() => setAtomicTestingTargetType('asset_group')}
                  startIcon={<LanOutlined />}
                  sx={{ flex: 1, minWidth: 0 }}
                >
                  Asset Group
                </Button>
              </Box>
            </Box>
            
            {/* Asset/Asset Group Selection */}
            {atomicTestingTargetType === 'asset' ? (
              <Autocomplete
                options={atomicTestingAssets}
                getOptionLabel={(option) => option.asset_name || option.endpoint_hostname || 'Unknown'}
                value={atomicTestingAssets.find(a => a.asset_id === atomicTestingSelectedAsset) || null}
                onChange={(_, value) => setAtomicTestingSelectedAsset(value?.asset_id || null)}
                renderInput={(params) => <TextField {...params} label="Select Asset" size="small" />}
                size="small"
              />
            ) : (
              <Autocomplete
                options={atomicTestingAssetGroups}
                getOptionLabel={(option) => option.asset_group_name || 'Unknown'}
                value={atomicTestingAssetGroups.find(g => g.asset_group_id === atomicTestingSelectedAssetGroup) || null}
                onChange={(_, value) => setAtomicTestingSelectedAssetGroup(value?.asset_group_id || null)}
                renderInput={(params) => <TextField {...params} label="Select Asset Group" size="small" />}
                size="small"
              />
            )}
            
            {/* Inject Selection (for attack patterns) */}
            {selectedAtomicTarget.type === 'attack-pattern' && (
              <Box>
                <Autocomplete
                  options={atomicTestingInjectorContracts}
                  getOptionLabel={(option) => {
                    const label = option.injector_contract_labels?.en || 
                      option.injector_contract_labels?.['en-US'] || 
                      option.injector_name || 
                      'Unknown Inject';
                    return label;
                  }}
                  value={atomicTestingInjectorContracts.find(c => c.injector_contract_id === atomicTestingSelectedContract) || null}
                  onChange={(_, value) => setAtomicTestingSelectedContract(value?.injector_contract_id || null)}
                  renderInput={(params) => (
                    <TextField 
                      {...params} 
                      label="Select inject" 
                      size="small"
                      helperText={atomicTestingInjectorContracts.length === 0 ? 'No injects available for this attack pattern' : undefined}
                    />
                  )}
                  renderOption={(props, option) => {
                    const label = option.injector_contract_labels?.en || 
                      option.injector_contract_labels?.['en-US'] || 
                      option.injector_name || 
                      'Unknown Inject';
                    const platforms = option.injector_contract_platforms || [];
                    const injectorType = option.injector_contract_injector_type || option.injector_type || '';
                    const payloadType = option.injector_contract_payload_type || '';
                    const content = option.injector_contract_content;
                    
                    // Build tooltip content
                    const tooltipContent = (
                      <Box sx={{ p: 1, maxWidth: 350 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                          {label}
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          {injectorType && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="caption" sx={{ color: 'text.secondary', minWidth: 80 }}>Injector:</Typography>
                              <Typography variant="caption" sx={{ fontWeight: 500 }}>{injectorType}</Typography>
                            </Box>
                          )}
                          {payloadType && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="caption" sx={{ color: 'text.secondary', minWidth: 80 }}>Payload type:</Typography>
                              <Typography variant="caption" sx={{ fontWeight: 500 }}>{payloadType}</Typography>
                            </Box>
                          )}
                          {platforms.length > 0 && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="caption" sx={{ color: 'text.secondary', minWidth: 80 }}>Platforms:</Typography>
                              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                {platforms.map((p: string) => (
                                  <Chip key={p} label={p} size="small" sx={{ height: 16, fontSize: 9 }} />
                                ))}
                              </Box>
                            </Box>
                          )}
                          {content && typeof content === 'object' && (
                            <Box sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
                              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>Configuration fields:</Typography>
                              <Box sx={{ mt: 0.5, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {Object.keys(content).slice(0, 5).map((key) => (
                                  <Chip key={key} label={key} size="small" variant="outlined" sx={{ height: 16, fontSize: 9 }} />
                                ))}
                                {Object.keys(content).length > 5 && (
                                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                    +{Object.keys(content).length - 5} more
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                          )}
                        </Box>
                      </Box>
                    );
                    
                    return (
                      <Tooltip 
                        key={option.injector_contract_id}
                        title={tooltipContent} 
                        placement="right"
                        arrow
                        enterDelay={300}
                        leaveDelay={100}
                        componentsProps={{
                          tooltip: {
                            sx: {
                              bgcolor: 'background.paper',
                              color: 'text.primary',
                              boxShadow: 3,
                              border: 1,
                              borderColor: 'divider',
                              maxWidth: 400,
                              '& .MuiTooltip-arrow': {
                                color: 'background.paper',
                                '&::before': {
                                  border: 1,
                                  borderColor: 'divider',
                                },
                              },
                            },
                          },
                        }}
                      >
                        <li {...props}>
                          <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 1 }}>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>{label}</Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                                {platforms.map((platform: string) => (
                                  <Chip
                                    key={platform}
                                    icon={getPlatformIcon(platform)}
                                    label={platform}
                                    size="small"
                                    sx={{ 
                                      height: 20, 
                                      fontSize: 10,
                                      bgcolor: getPlatformColor(platform),
                                      color: 'white',
                                      '& .MuiChip-icon': { color: 'white', ml: 0.5 },
                                    }}
                                  />
                                ))}
                                {injectorType && (
                                  <Typography variant="caption" sx={{ color: 'text.secondary', ml: 1 }}>
                                    {injectorType}
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                            <InfoOutlined fontSize="small" sx={{ color: 'text.secondary', opacity: 0.5 }} />
                          </Box>
                        </li>
                      </Tooltip>
                    );
                  }}
                  size="small"
                  noOptionsText="No injects available for this attack pattern"
                />
                {atomicTestingInjectorContracts.length > 0 && atomicTestingSelectedContract && (
                  <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {(() => {
                      const selectedContract = atomicTestingInjectorContracts.find(c => c.injector_contract_id === atomicTestingSelectedContract);
                      const platforms = selectedContract?.injector_contract_platforms || [];
                      return platforms.map((platform: string) => (
                        <Chip
                          key={platform}
                          icon={getPlatformIcon(platform)}
                          label={platform}
                          size="small"
                          sx={{ 
                            height: 22, 
                            fontSize: 11,
                            bgcolor: getPlatformColor(platform),
                            color: 'white',
                            '& .MuiChip-icon': { color: 'white', ml: 0.5 },
                          }}
                        />
                      ));
                    })()}
                  </Box>
                )}
              </Box>
            )}
            
            {/* Info for domain/hostname */}
            {(selectedAtomicTarget.type === 'Domain-Name' || selectedAtomicTarget.type === 'domain' || 
              selectedAtomicTarget.type === 'Hostname' || selectedAtomicTarget.type === 'hostname') && (
              <Alert severity="info" sx={{ fontSize: 12 }}>
                A DNS Resolution payload will be created automatically for this {selectedAtomicTarget.type.toLowerCase().replace('-', ' ')}.
              </Alert>
            )}
            
            {/* Create Button */}
            <Box sx={{ mt: 'auto', pt: 2, flexShrink: 0 }}>
              <Button
                fullWidth
                variant="contained"
                color="error"
                onClick={handleCreateAtomicTesting}
                disabled={
                  atomicTestingCreating || 
                  !selectedAtomicTarget ||
                  (atomicTestingTargetType === 'asset' && !atomicTestingSelectedAsset) ||
                  (atomicTestingTargetType === 'asset_group' && !atomicTestingSelectedAssetGroup) ||
                  (selectedAtomicTarget.type === 'attack-pattern' && !atomicTestingSelectedContract)
                }
                startIcon={atomicTestingCreating ? <CircularProgress size={16} color="inherit" /> : <Target />}
              >
                {atomicTestingCreating ? 'Creating...' : 'Create Atomic Testing'}
              </Button>
            </Box>
          </Box>
        )}
      </Box>
    );
  };

  const renderSearchView = () => {
    const mergedResults = getMergedSearchResults();
    const hasSearched = searchResults.length > 0 || (searchQuery.trim() && !searching);
    
    return (
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Search OpenCTI</Typography>

        <TextField
          placeholder="Search entities..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          fullWidth
          autoFocus
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={handleSearch} edge="end" disabled={searching}>
                  {searching ? <CircularProgress size={20} /> : <SearchOutlined />}
                </IconButton>
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2 }}
        />
        
        {/* Results section */}
        {searching ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 1 }}>
            <CircularProgress size={32} />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Searching across {openctiPlatforms.length} platform{openctiPlatforms.length > 1 ? 's' : ''}...
            </Typography>
          </Box>
        ) : hasSearched && mergedResults.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              No results found for "{searchQuery}"
            </Typography>
          </Box>
        ) : mergedResults.length > 0 ? (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {mergedResults.length} result{mergedResults.length !== 1 ? 's' : ''} found
              </Typography>
              {searchResults.length !== mergedResults.length && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  ({searchResults.length} across platforms)
                </Typography>
              )}
            </Box>
            <Box sx={{ flex: 1, overflow: 'auto' }}>
              {mergedResults.map((merged, i) => {
                const platformCount = merged.platforms.length;
                const platformNames = merged.platforms.map(p => p.platformName).join(', ');
                const entityColor = itemColor(merged.type, mode === 'dark');
                
                return (
                  <Paper
                    key={merged.representativeKey}
                    onClick={() => handleSearchResultClick(merged)}
                    elevation={0}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      p: 1.5,
                      mb: 1,
                      cursor: 'pointer',
                      borderRadius: 1,
                      border: 1,
                      borderColor: 'divider',
                      transition: 'all 0.15s',
                      '&:hover': { 
                        bgcolor: hexToRGB(entityColor, 0.08),
                        borderColor: entityColor,
                      },
                    }}
                  >
                    {/* Entity type icon with color */}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 36,
                        height: 36,
                        borderRadius: 1,
                        bgcolor: hexToRGB(entityColor, 0.15),
                        flexShrink: 0,
                      }}
                    >
                      <ItemIcon type={merged.type} size="small" color={entityColor} />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: 'break-word' }}>
                        {merged.name}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            color: entityColor, 
                            fontWeight: 500,
                          }}
                        >
                          {merged.type.replace(/-/g, ' ')}
                        </Typography>
                        {platformCount > 1 ? (
                          <>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>·</Typography>
                            <Chip 
                              label={`${platformCount} platforms`}
                              size="small"
                              sx={{ 
                                height: 18, 
                                fontSize: '10px',
                                bgcolor: 'action.selected',
                                color: 'text.secondary',
                                '& .MuiChip-label': { px: 0.75 },
                              }}
                            />
                          </>
                        ) : openctiPlatforms.length > 1 && (
                          <>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>·</Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              {platformNames}
                            </Typography>
                          </>
                        )}
                      </Box>
                    </Box>
                    <ChevronRightOutlined fontSize="small" sx={{ color: 'text.secondary' }} />
                  </Paper>
                );
              })}
            </Box>
          </>
        ) : (
          <Box sx={{ textAlign: 'center', py: 4, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
              Search for entities across your OpenCTI platforms
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Enter a search term and press Enter or click the search icon
            </Typography>
          </Box>
        )}
      </Box>
    );
  };

  // Alias for search results view - redirects to unified search view
  const renderSearchResultsView = () => renderSearchView();

  // Helper to get icon and color for OAEV entity type - now uses centralized itemColor
  const getOaevEntityColor = (entityClass: string): string => {
    const simpleName = entityClass.split('.').pop() || entityClass;
    return itemColor(`oaev-${simpleName}`, mode === 'dark');
  };

  const renderOAEVSearchView = () => {
    const oaevPlatforms = availablePlatforms.filter(p => p.type === 'openaev');
    const hasSearched = oaevSearchResults.length > 0 || (oaevSearchQuery.trim() && !oaevSearching);
    
    return (
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Search OpenAEV</Typography>

        <TextField
          placeholder="Search entities..."
          value={oaevSearchQuery}
          onChange={(e) => setOaevSearchQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleOaevSearch()}
          fullWidth
          autoFocus
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={handleOaevSearch} edge="end" disabled={oaevSearching}>
                  {oaevSearching ? <CircularProgress size={20} /> : <SearchOutlined />}
                </IconButton>
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2 }}
        />
        
        {/* Results section */}
        {oaevSearching ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 1 }}>
            <CircularProgress size={32} />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Searching across {oaevPlatforms.length} platform{oaevPlatforms.length > 1 ? 's' : ''}...
            </Typography>
          </Box>
        ) : hasSearched && oaevSearchResults.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              No results found for "{oaevSearchQuery}"
            </Typography>
          </Box>
        ) : oaevSearchResults.length > 0 ? (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {oaevSearchResults.length} result{oaevSearchResults.length !== 1 ? 's' : ''} found
              </Typography>
            </Box>
            <Box sx={{ flex: 1, overflow: 'auto' }}>
              {oaevSearchResults.map((result, i) => {
                const entityClass = result._entityClass || '';
                const oaevType = getOAEVTypeFromClass(entityClass);
                const displayName = getOAEVEntityName(result, oaevType);
                const platformInfo = result._platform;
                const entityColor = getOaevEntityColor(entityClass);
                const typeForIcon = `oaev-${oaevType}`;
                
                return (
                  <Paper
                    key={result.id || i}
                    onClick={() => handleOaevSearchResultClick(result)}
                    elevation={0}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      p: 1.5,
                      mb: 1,
                      cursor: 'pointer',
                      borderRadius: 1,
                      border: 1,
                      borderColor: 'divider',
                      transition: 'all 0.15s',
                      '&:hover': { 
                        bgcolor: hexToRGB(entityColor, 0.08),
                        borderColor: entityColor,
                      },
                    }}
                  >
                    {/* Entity type icon with color */}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 36,
                        height: 36,
                        borderRadius: 1,
                        bgcolor: hexToRGB(entityColor, 0.15),
                        flexShrink: 0,
                      }}
                    >
                      <ItemIcon 
                        type={typeForIcon} 
                        size="small" 
                        color={entityColor}
                      />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: 'break-word' }}>
                        {displayName}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            color: entityColor, 
                            fontWeight: 500,
                          }}
                        >
                          {oaevType.replace(/([A-Z])/g, ' $1').trim()}
                        </Typography>
                        {platformInfo && (
                          <>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>·</Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              {platformInfo.name || platformInfo.url}
                            </Typography>
                          </>
                        )}
                      </Box>
                    </Box>
                    <ChevronRightOutlined fontSize="small" sx={{ color: 'text.secondary' }} />
                  </Paper>
                );
              })}
            </Box>
          </>
        ) : (
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Enter a search term and press Enter or click the search icon
            </Typography>
          </Box>
        )}
      </Box>
    );
  };

  // Unified search view - searches across both OpenCTI and OpenAEV
  const renderUnifiedSearchView = () => {
    const totalPlatforms = availablePlatforms.length;
    const hasSearched = unifiedSearchResults.length > 0 || (unifiedSearchQuery.trim() && !unifiedSearching);
    
    // Group results by source for display
    const octiResults = unifiedSearchResults.filter(r => r.source === 'opencti');
    const oaevResults = unifiedSearchResults.filter(r => r.source === 'openaev');
    
    return (
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Search All Platforms</Typography>

        <TextField
          placeholder="Search entities across all platforms..."
          value={unifiedSearchQuery}
          onChange={(e) => setUnifiedSearchQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleUnifiedSearch()}
          fullWidth
          autoFocus
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={handleUnifiedSearch} edge="end" disabled={unifiedSearching}>
                  {unifiedSearching ? <CircularProgress size={20} /> : <SearchOutlined />}
                </IconButton>
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2 }}
        />
        
        {/* Results section */}
        {unifiedSearching ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 1 }}>
            <CircularProgress size={32} />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Searching across {totalPlatforms} platform{totalPlatforms > 1 ? 's' : ''}...
            </Typography>
          </Box>
        ) : hasSearched && unifiedSearchResults.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              No results found for "{unifiedSearchQuery}"
            </Typography>
          </Box>
        ) : unifiedSearchResults.length > 0 ? (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, flexWrap: 'wrap', gap: 0.5 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {unifiedSearchResults.length} result{unifiedSearchResults.length !== 1 ? 's' : ''} found
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {octiResults.length > 0 && (
                  <Typography variant="caption" sx={{ color: '#00bcd4', fontWeight: 500 }}>
                    {octiResults.length} in OpenCTI
                  </Typography>
                )}
                {oaevResults.length > 0 && (
                  <Typography variant="caption" sx={{ color: '#9c27b0', fontWeight: 500 }}>
                    {oaevResults.length} in OpenAEV
                  </Typography>
                )}
              </Box>
            </Box>
            <Box sx={{ flex: 1, overflow: 'auto' }}>
              {unifiedSearchResults.map((result) => {
                // Get the proper type for color/icon lookup
                const typeForColor = result.source === 'openaev' 
                  ? `oaev-${result.type}` 
                  : result.type;
                const entityColor = itemColor(typeForColor, mode === 'dark');
                
                return (
                  <Paper
                    key={result.id}
                    onClick={() => handleUnifiedSearchResultClick(result)}
                    sx={{
                      p: 1.5,
                      mb: 1,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      bgcolor: 'background.paper',
                      border: '1px solid',
                      borderColor: 'divider',
                      transition: 'all 0.15s',
                      '&:hover': { 
                        bgcolor: hexToRGB(entityColor, 0.08),
                        borderColor: entityColor,
                      },
                    }}
                  >
                    {/* Entity type icon with color */}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 36,
                        height: 36,
                        borderRadius: 1,
                        bgcolor: hexToRGB(entityColor, 0.15),
                        flexShrink: 0,
                      }}
                    >
                      <ItemIcon 
                        type={typeForColor} 
                        size="small" 
                        color={entityColor}
                      />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: 'break-word' }}>
                        {result.name}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            color: entityColor, 
                            fontWeight: 500,
                          }}
                        >
                          {result.type.replace(/([A-Z])/g, ' $1').trim()}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>·</Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {result.platformName}
                        </Typography>
                      </Box>
                    </Box>
                    <ChevronRightOutlined fontSize="small" sx={{ color: 'text.secondary' }} />
                  </Paper>
                );
              })}
            </Box>
          </>
        ) : (
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Enter a search term and press Enter or click the search icon
            </Typography>
          </Box>
        )}
      </Box>
    );
  };

  // ============================================================================
  // Scenario Creation Views (OpenAEV)
  // ============================================================================
  
  // OpenAEV email injector contract ID (hardcoded in OpenAEV platform)
  const EMAIL_INJECTOR_CONTRACT_ID = '138ad8f8-32f8-4a22-8114-aaa12322bd09';
  
  const handleCreateScenario = async () => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
    
    setSubmitting(true);
    
    // Use scenarioPlatformId if available, fallback to selectedPlatformId
    const targetPlatformId = scenarioPlatformId || selectedPlatformId;
    log.debug(' Creating scenario with platformId:', targetPlatformId, '(scenarioPlatformId:', scenarioPlatformId, ', selectedPlatformId:', selectedPlatformId, ')');
    log.debug(' Scenario type:', scenarioTypeAffinity);
    log.debug(' Selected injects:', selectedInjects.length, selectedInjects);
    
    if (!targetPlatformId) {
      log.error(' No platform ID available for scenario creation');
      setSubmitting(false);
      return;
    }
    
    try {
      // First create the scenario
      const scenarioResponse = await chrome.runtime.sendMessage({
        type: 'CREATE_SCENARIO',
        payload: {
          name: scenarioForm.name,
          description: scenarioForm.description,
          subtitle: scenarioForm.subtitle,
          category: scenarioForm.category,
          platformId: targetPlatformId,
        },
      });
      
      if (!scenarioResponse?.success || !scenarioResponse.data) {
        log.error(' Scenario creation failed:', scenarioResponse?.error);
        setSubmitting(false);
        return;
      }
      
      const scenario = scenarioResponse.data;
      log.info(' Scenario created:', scenario.scenario_id);
      
      // Add selected injects to the scenario
      let previousInjectId: string | null = null;
      const isTableTop = scenarioTypeAffinity === 'TABLE-TOP';
      
      for (let i = 0; i < selectedInjects.length; i++) {
        const inject = selectedInjects[i];
        
        // Build inject payload based on scenario type
        const injectPayload: any = {
          inject_title: isTableTop 
            ? `Email - ${inject.attackPatternName}`
            : `${inject.attackPatternName} - ${inject.contractLabel}`,
          inject_description: isTableTop
            ? `Email notification for ${inject.attackPatternName}`
            : `Inject for ${inject.attackPatternName}`,
          inject_injector_contract: isTableTop 
            ? EMAIL_INJECTOR_CONTRACT_ID  // Use email contract for TABLE-TOP
            : inject.contractId,          // Use selected contract for technical
          inject_depends_duration: i * scenarioInjectSpacing * 60, // Convert to seconds, sequential timing
        };
        
        // Add target based on scenario type
        if (isTableTop) {
          // For TABLE-TOP scenarios, target the selected team
          if (scenarioSelectedTeam) {
            injectPayload.inject_teams = [scenarioSelectedTeam];
          }
          
          // Check if we have AI-generated content for this attack pattern
          const aiContent = scenarioEmails.find((e: { attackPatternId: string; subject: string; body: string }) => e.attackPatternId === inject.attackPatternId);
          
          injectPayload.inject_content = {
            subject: aiContent?.subject || `[SIMULATION] Security Alert: ${inject.attackPatternName}`,
            body: aiContent?.body || `<p>This is a simulated security exercise notification.</p>
<p><strong>Attack Pattern:</strong> ${inject.attackPatternName}</p>
<p><strong>Description:</strong> A simulated ${inject.attackPatternName} attack has been detected in this exercise.</p>
<p>Please follow your incident response procedures.</p>
<p><em>This is a simulation exercise - no actual security incident has occurred.</em></p>`,
          };
        } else {
          // For technical scenarios, target the selected asset or asset group
          if (scenarioTargetType === 'asset' && scenarioSelectedAsset) {
            injectPayload.inject_assets = [scenarioSelectedAsset];
          } else if (scenarioTargetType === 'asset_group' && scenarioSelectedAssetGroup) {
            injectPayload.inject_asset_groups = [scenarioSelectedAssetGroup];
          }
        }
        
        // Chain injects if there's a previous one
        if (previousInjectId) {
          injectPayload.inject_depends_on = previousInjectId;
        }
        
        log.debug(` Adding inject ${i + 1}/${selectedInjects.length}:`, injectPayload);
        
        const injectResponse = await chrome.runtime.sendMessage({
          type: 'ADD_INJECT_TO_SCENARIO',
          payload: {
            scenarioId: scenario.scenario_id,
            inject: injectPayload,
            platformId: targetPlatformId,
          },
        });
        
        if (injectResponse?.success && injectResponse.data?.inject_id) {
          previousInjectId = injectResponse.data.inject_id;
          log.debug(` Inject created:`, injectResponse.data.inject_id);
        } else {
          log.error(` Failed to create inject:`, injectResponse?.error);
        }
      }
      
      log.info(` Scenario creation complete with ${selectedInjects.length} injects`);
      
      // Open the scenario in the platform
      if (scenario.url) {
        chrome.tabs.create({ url: scenario.url });
      }
      
      // Reset and close
      setScenarioForm({ name: '', description: '', subtitle: '', category: 'attack-scenario' });
      setSelectedInjects([]);
      setScenarioOverviewData(null);
      setScenarioEmails([]);
      handleClose();
    } catch (error) {
      log.error(' Scenario creation error:', error);
    }
    
    setSubmitting(false);
  };
  
  // Handle platform selection for scenario creation
  const handleSelectScenarioPlatform = async (platformId: string) => {
    setScenarioPlatformId(platformId);
    setScenarioPlatformSelected(true);
    setSelectedPlatformId(platformId);
    
    const platform = availablePlatforms.find(p => p.id === platformId);
    if (platform) {
      setPlatformUrl(platform.url);
    }
    
    // Fetch assets, asset groups, and teams for target selection
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      try {
        log.debug(' Starting fetch of scenario targets for platform:', platformId);
        const [assetsRes, assetGroupsRes, teamsRes] = await Promise.all([
          chrome.runtime.sendMessage({ type: 'FETCH_OAEV_ASSETS', payload: { platformId } }),
          chrome.runtime.sendMessage({ type: 'FETCH_OAEV_ASSET_GROUPS', payload: { platformId } }),
          chrome.runtime.sendMessage({ type: 'FETCH_OAEV_TEAMS', payload: { platformId } }),
        ]);
        
        log.debug(' Scenario targets fetch responses:', {
          assets: { success: assetsRes?.success, count: assetsRes?.data?.length, error: assetsRes?.error },
          assetGroups: { success: assetGroupsRes?.success, count: assetGroupsRes?.data?.length, error: assetGroupsRes?.error },
          teams: { success: teamsRes?.success, count: teamsRes?.data?.length, error: teamsRes?.error },
        });
        
        if (assetsRes?.success) setScenarioAssets(assetsRes.data || []);
        if (assetGroupsRes?.success) setScenarioAssetGroups(assetGroupsRes.data || []);
        if (teamsRes?.success) setScenarioTeams(teamsRes.data || []);
        
        log.debug(' Scenario targets loaded:', {
          assets: assetsRes?.data?.length || 0,
          assetGroups: assetGroupsRes?.data?.length || 0,
          teams: teamsRes?.data?.length || 0,
        });
      } catch (error) {
        log.error(' Failed to fetch scenario targets:', error);
      }
    }
    
    // Reset target selections when platform changes
    setScenarioSelectedAsset(null);
    setScenarioSelectedAssetGroup(null);
    setScenarioSelectedTeam(null);
    
    // Filter attack patterns to only those from the selected platform
    const filteredPatterns = scenarioRawAttackPatterns.filter(
      (ap) => ap.platformId === platformId
    );
    
    log.debug(' Filtered attack patterns for platform', platformId, ':', filteredPatterns.length, 'of', scenarioRawAttackPatterns.length);
    
    // Fetch contracts for filtered attack patterns
    if (filteredPatterns.length > 0 && typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      setScenarioLoading(true);
      
      const attackPatternIds = filteredPatterns.map((ap) => ap.id || ap.entityId);
      
      chrome.runtime.sendMessage({
        type: 'FETCH_SCENARIO_OVERVIEW',
        payload: { attackPatternIds, platformId },
      }, (response) => {
        setScenarioLoading(false);
        if (response?.success && response.data) {
          setScenarioOverviewData({
            ...response.data,
            pageTitle: currentPageTitle || '',
            pageUrl: currentPageUrl || '',
            pageDescription: scenarioForm.description || '',
          });
          
          // Don't auto-select contracts - let the user choose
          setSelectedInjects([]);
        }
      });
    } else {
      setScenarioOverviewData({
        attackPatterns: [],
        killChainPhases: [],
        pageTitle: currentPageTitle || '',
        pageUrl: currentPageUrl || '',
        pageDescription: scenarioForm.description || '',
      });
    }
  };
  
  const renderScenarioOverviewView = () => {
    const logoSuffix = mode === 'dark' ? 'dark-theme' : 'light-theme';
    const openaevLogoPath = `../assets/logos/logo_openaev_${logoSuffix}_embleme_square.svg`;
    
    // Filter contracts by platform affinity for technical scenarios
    const getFilteredContracts = (contracts: any[]) => {
      if (scenarioTypeAffinity === 'TABLE-TOP') return []; // No contracts for table-top
      if (!contracts) return [];
      
      return contracts.filter((contract: any) => {
        const contractPlatforms = contract.injector_contract_platforms || [];
        // If no platforms specified on contract, include it
        if (contractPlatforms.length === 0) return true;
        // Check if any selected platform matches contract platforms
        return scenarioPlatformsAffinity.some(p => 
          contractPlatforms.map((cp: string) => cp.toLowerCase()).includes(p.toLowerCase())
        );
      });
    };
    
    // Handle proceeding from affinity selection to inject selection
    const handleAffinityNext = async () => {
      setScenarioStep(1);
      
      // For table-top, we don't need to fetch contracts
      if (scenarioTypeAffinity === 'TABLE-TOP') {
        return;
      }
      
      // For technical scenarios, we already have the data loaded
      // Just proceed to step 1
    };
    
    // Platform selection step (if multiple OpenAEV platforms and not yet selected)
    if (openaevPlatforms.length > 1 && !scenarioPlatformSelected) {
      // Count attack patterns per platform
      const patternCountByPlatform = new Map<string, number>();
      for (const ap of scenarioRawAttackPatterns) {
        if (ap.platformId) {
          patternCountByPlatform.set(ap.platformId, (patternCountByPlatform.get(ap.platformId) || 0) + 1);
        }
      }
      
      return (
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <img src={openaevLogoPath} alt="OpenAEV" style={{ height: 24, width: 'auto' }} />
            <Typography variant="h6" sx={{ fontSize: 16, flex: 1, fontWeight: 600 }}>Create Scenario</Typography>
          </Box>
          
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Select OpenAEV platform to create the scenario:
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {openaevPlatforms.map((platform) => {
              const patternCount = patternCountByPlatform.get(platform.id) || 0;
              return (
                <Paper
                  key={platform.id}
                  onClick={() => handleSelectScenarioPlatform(platform.id)}
                  elevation={0}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    p: 2,
                    cursor: 'pointer',
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.main' },
                  }}
                >
                  <img src={openaevLogoPath} alt="OpenAEV" style={{ width: 24, height: 24 }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {platform.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {platform.url}
                    </Typography>
                    {patternCount > 0 && (
                      <Typography variant="caption" sx={{ color: 'primary.main', display: 'block' }}>
                        {patternCount} attack pattern{patternCount !== 1 ? 's' : ''} found
                      </Typography>
                    )}
                  </Box>
                  <ChevronRightOutlined sx={{ color: 'text.secondary' }} />
                </Paper>
              );
            })}
          </Box>
        </Box>
      );
    }
    
    return (
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexShrink: 0 }}>
          <img src={openaevLogoPath} alt="OpenAEV" style={{ height: 24, width: 'auto' }} />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Create Scenario
          </Typography>
        </Box>
        
        {/* Stepper */}
        <Stepper activeStep={scenarioStep} sx={{ mb: 3, flexShrink: 0 }}>
          <Step>
            <StepLabel>Select Affinity</StepLabel>
          </Step>
          <Step>
            <StepLabel>Select Injects</StepLabel>
          </Step>
          <Step>
            <StepLabel>Configure Details</StepLabel>
          </Step>
        </Stepper>
        
        {scenarioLoading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 2 }}>
            <CircularProgress size={40} />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Loading attack patterns and inject contracts...
            </Typography>
          </Box>
        ) : scenarioStep === 0 ? (
          /* Step 0: Affinity Selection */
          <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'auto' }}>
            {/* Type Affinity */}
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Type Affinity
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', mb: 2, display: 'block' }}>
              Select the type of scenario you want to create
            </Typography>
            
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
              {[
                { value: 'ENDPOINT', label: 'Endpoint', description: 'Technical endpoint testing' },
                { value: 'CLOUD', label: 'Cloud', description: 'Technical cloud testing' },
                { value: 'WEB', label: 'Web', description: 'Technical web testing' },
                { value: 'TABLE-TOP', label: 'Table-top', description: 'Simulation with email notifications' },
              ].map((option) => (
                <Paper
                  key={option.value}
                  elevation={0}
                  onClick={() => {
                    setScenarioTypeAffinity(option.value as typeof scenarioTypeAffinity);
                    // Set default inject spacing: 1 min for technical, 5 min for table-top
                    setScenarioInjectSpacing(option.value === 'TABLE-TOP' ? 5 : 1);
                  }}
                  sx={{
                    p: 1.5,
                    flex: '1 1 calc(50% - 4px)',
                    minWidth: 120,
                    border: 2,
                    borderColor: scenarioTypeAffinity === option.value ? 'primary.main' : 'divider',
                    borderRadius: 1,
                    cursor: 'pointer',
                    bgcolor: scenarioTypeAffinity === option.value ? 'action.selected' : 'transparent',
                    transition: 'all 0.2s',
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {option.label}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {option.description}
                  </Typography>
                </Paper>
              ))}
            </Box>
            
            {/* Platform Affinity - Only show for technical scenarios */}
            {scenarioTypeAffinity !== 'TABLE-TOP' && (
              <>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                  Platform Affinity
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', mb: 2, display: 'block' }}>
                  Select target platforms for technical injects
                </Typography>
                
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
                  {[
                    { value: 'windows', label: 'Windows' },
                    { value: 'linux', label: 'Linux' },
                    { value: 'macos', label: 'macOS' },
                    { value: 'android', label: 'Android' },
                  ].map((platform) => {
                    const isSelected = scenarioPlatformsAffinity.includes(platform.value);
                    const color = getPlatformColor(platform.value);
                    return (
                      <Chip
                        key={platform.value}
                        icon={getPlatformIcon(platform.value)}
                        label={platform.label}
                        onClick={() => {
                          if (isSelected) {
                            // Don't allow deselecting if it's the last one
                            if (scenarioPlatformsAffinity.length > 1) {
                              setScenarioPlatformsAffinity(prev => prev.filter(p => p !== platform.value));
                            }
                          } else {
                            setScenarioPlatformsAffinity(prev => [...prev, platform.value]);
                          }
                        }}
                        sx={{
                          bgcolor: isSelected ? color : 'transparent',
                          color: isSelected ? 'white' : 'text.primary',
                          border: 1,
                          borderColor: isSelected ? color : 'divider',
                          '& .MuiChip-icon': { color: isSelected ? 'white' : color },
                          '&:hover': {
                            bgcolor: isSelected ? color : 'action.hover',
                          },
                        }}
                      />
                    );
                  })}
                </Box>
              </>
            )}
            
            {/* Table-top info */}
            {scenarioTypeAffinity === 'TABLE-TOP' && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Table-top scenarios use email notifications to simulate attack phases. 
                Each attack pattern will generate an email placeholder for the corresponding kill chain phase.
              </Alert>
            )}
            
            {/* Attack Patterns Preview */}
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Detected Attack Patterns ({scenarioOverviewData?.attackPatterns?.length || 0})
            </Typography>
            <Box sx={{ flex: 1, overflow: 'auto', mb: 2, minHeight: 0 }}>
              {scenarioOverviewData?.attackPatterns?.slice(0, 5).map((ap) => (
                <Box key={ap.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                  <LockPattern sx={{ fontSize: 16, color: '#d4e157' }} />
                  <Typography variant="body2" sx={{ flex: 1 }} noWrap>{ap.name}</Typography>
                  <Chip label={ap.externalId} size="small" sx={{ fontSize: 9, height: 18 }} />
                </Box>
              ))}
              {(scenarioOverviewData?.attackPatterns?.length || 0) > 5 && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  +{(scenarioOverviewData?.attackPatterns?.length || 0) - 5} more...
                </Typography>
              )}
            </Box>
            
            {/* Actions */}
            <Box sx={{ display: 'flex', gap: 1, mt: 'auto', flexShrink: 0 }}>
              <Button variant="outlined" onClick={handleClose} sx={{ flex: 1 }}>
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={handleAffinityNext}
                endIcon={<ArrowForwardOutlined />}
                sx={{ flex: 1 }}
              >
                Next
              </Button>
            </Box>
          </Box>
        ) : scenarioStep === 1 ? (
          /* Step 1: Inject Selection */
          <>
            {/* Back button */}
            <Box sx={{ mb: 1.5, flexShrink: 0 }}>
              <Button
                size="small"
                startIcon={<ChevronLeftOutlined />}
                onClick={() => setScenarioStep(0)}
                sx={{ 
                  color: 'text.secondary',
                  textTransform: 'none',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                Back to affinity selection
              </Button>
            </Box>
            
            {scenarioTypeAffinity === 'TABLE-TOP' ? (
              /* Table-top: Email placeholders */
              <>
                {/* Email Spacing Selector */}
                <TextField
                  select
                  label="Email spacing"
                  size="small"
                  fullWidth
                  value={scenarioInjectSpacing}
                  onChange={(e) => setScenarioInjectSpacing(Number(e.target.value))}
                  helperText="Time interval between each email notification"
                  sx={{ mb: 2 }}
                >
                  <MenuItem value={1}>1 minute</MenuItem>
                  <MenuItem value={2}>2 minutes</MenuItem>
                  <MenuItem value={5}>5 minutes</MenuItem>
                  <MenuItem value={10}>10 minutes</MenuItem>
                  <MenuItem value={15}>15 minutes</MenuItem>
                  <MenuItem value={30}>30 minutes</MenuItem>
                  <MenuItem value={60}>1 hour</MenuItem>
                </TextField>
                
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                  Select Attack Patterns ({selectedInjects.length}/{scenarioOverviewData?.attackPatterns?.length || 0})
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', mb: 2, display: 'block' }}>
                  Select which attack patterns to include. Email body will contain placeholders only.
                </Typography>
                
                {(!scenarioOverviewData?.attackPatterns || scenarioOverviewData.attackPatterns.length === 0) ? (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    No attack patterns found. Add attack patterns to generate email notifications.
                  </Alert>
                ) : (
                  <Box sx={{ flex: 1, overflow: 'auto', mb: 2, minHeight: 0 }}>
                    {scenarioOverviewData.attackPatterns.map((ap) => {
                      const isSelected = selectedInjects.some(i => i.attackPatternId === ap.id);
                      const selectedIndex = selectedInjects.findIndex(i => i.attackPatternId === ap.id);
                      
                      return (
                        <Paper
                          key={ap.id}
                          elevation={0}
                          onClick={() => {
                            if (isSelected) {
                              // Remove from selection
                              setSelectedInjects(prev => prev.filter(i => i.attackPatternId !== ap.id));
                            } else {
                              // Add to selection with email placeholder
                              setSelectedInjects(prev => [
                                ...prev,
                                {
                                  attackPatternId: ap.id,
                                  attackPatternName: ap.name,
                                  contractId: 'email-placeholder',
                                  contractLabel: 'Email Notification (placeholder)',
                                  delayMinutes: prev.length * scenarioInjectSpacing,
                                },
                              ]);
                            }
                          }}
                          sx={{
                            p: 1.5,
                            mb: 1,
                            border: 2,
                            borderColor: isSelected ? '#42a5f5' : 'divider',
                            borderRadius: 1,
                            cursor: 'pointer',
                            bgcolor: isSelected ? 'rgba(66, 165, 245, 0.08)' : 'transparent',
                            transition: 'all 0.2s',
                            '&:hover': {
                              bgcolor: isSelected ? 'rgba(66, 165, 245, 0.12)' : 'action.hover',
                            },
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <Checkbox
                              checked={isSelected}
                              size="small"
                              sx={{ p: 0, mr: 0.5 }}
                              onClick={(e) => e.stopPropagation()}
                              onChange={() => {
                                if (isSelected) {
                                  setSelectedInjects(prev => prev.filter(i => i.attackPatternId !== ap.id));
                                } else {
                                  setSelectedInjects(prev => [
                                    ...prev,
                                    {
                                      attackPatternId: ap.id,
                                      attackPatternName: ap.name,
                                      contractId: 'email-placeholder',
                                      contractLabel: 'Email Notification (placeholder)',
                                      delayMinutes: prev.length * scenarioInjectSpacing,
                                    },
                                  ]);
                                }
                              }}
                            />
                            <EmailOutlined sx={{ fontSize: 18, color: isSelected ? '#42a5f5' : 'text.secondary' }} />
                            <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>
                              {ap.name}
                            </Typography>
                            <Chip label={ap.externalId} size="small" sx={{ fontSize: 10, height: 20 }} />
                            {isSelected && (
                              <Chip 
                                label={`#${selectedIndex + 1}`} 
                                size="small" 
                                sx={{ fontSize: 10, height: 20, bgcolor: '#42a5f5', color: 'white' }} 
                              />
                            )}
                          </Box>
                          {ap.killChainPhases && ap.killChainPhases.length > 0 && (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, ml: 4 }}>
                              {ap.killChainPhases.map((phase, i) => (
                                <Chip key={i} label={phase} size="small" variant="outlined" sx={{ fontSize: 9, height: 18 }} />
                              ))}
                            </Box>
                          )}
                          {isSelected && (
                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1, ml: 4 }}>
                              Email Subject: [Simulation] {ap.name} ({ap.externalId})
                            </Typography>
                          )}
                        </Paper>
                      );
                    })}
                  </Box>
                )}
              </>
            ) : (
              /* Technical: Inject contracts */
              <>
                {/* Inject Spacing Selector */}
                <TextField
                  select
                  label="Inject spacing"
                  size="small"
                  fullWidth
                  value={scenarioInjectSpacing}
                  onChange={(e) => setScenarioInjectSpacing(Number(e.target.value))}
                  helperText="Time interval between each inject execution"
                  sx={{ mb: 2 }}
                >
                  <MenuItem value={1}>1 minute</MenuItem>
                  <MenuItem value={2}>2 minutes</MenuItem>
                  <MenuItem value={5}>5 minutes</MenuItem>
                  <MenuItem value={10}>10 minutes</MenuItem>
                  <MenuItem value={15}>15 minutes</MenuItem>
                  <MenuItem value={30}>30 minutes</MenuItem>
                  <MenuItem value={60}>1 hour</MenuItem>
                </TextField>
                
                {/* AI Select Injects Button */}
                {(() => {
                  const targetPlatform = openaevPlatforms.find(p => p.id === scenarioPlatformId);
                  const isAIAvailable = aiSettings.available && targetPlatform?.isEnterprise;
                  const hasPlayableAps = scenarioOverviewData?.attackPatterns?.some(ap => getFilteredContracts(ap.contracts).length > 0);
                  
                  let tooltipMessage = '';
                  if (!aiSettings.available) {
                    tooltipMessage = 'AI is not configured. Configure AI in extension settings.';
                  } else if (!targetPlatform?.isEnterprise) {
                    tooltipMessage = 'AI features require Enterprise Edition.';
                  } else if (!hasPlayableAps) {
                    tooltipMessage = 'No playable attack patterns available to select from.';
                  } else {
                    tooltipMessage = 'Use AI to automatically select the most relevant injects based on page context';
                  }
                  
                  return hasPlayableAps ? (
                    <Tooltip title={tooltipMessage}>
                      <span>
                        <Button
                          variant="outlined"
                          fullWidth
                          disabled={!isAIAvailable || aiSelectingInjects}
                          onClick={async () => {
                            if (!isAIAvailable) return;
                            
                            setAiSelectingInjects(true);
                            try {
                              const playableAps = scenarioOverviewData?.attackPatterns?.filter(ap => getFilteredContracts(ap.contracts).length > 0) || [];
                              
                              // Prepare the request
                              const response = await chrome.runtime.sendMessage({
                                type: 'AI_GENERATE_SCENARIO',
                                payload: {
                                  pageTitle: currentPageTitle,
                                  pageUrl: currentPageUrl,
                                  pageContent: document.body?.innerText?.substring(0, 3000) || '',
                                  scenarioName: scenarioForm.name || 'Security Simulation',
                                  typeAffinity: scenarioTypeAffinity,
                                  platformAffinity: scenarioPlatformsAffinity,
                                  detectedAttackPatterns: playableAps.map(ap => ({
                                    name: ap.name,
                                    id: ap.externalId,
                                    description: ap.description,
                                    availableInjects: getFilteredContracts(ap.contracts).map((c: any) => ({
                                      id: c.injector_contract_id,
                                      label: c.injector_contract_labels?.en || c.injector_contract_labels?.['en-US'] || c.injector_name || 'Unknown',
                                      platforms: c.injector_contract_platforms || [],
                                    })),
                                  })),
                                },
                              });
                              
                              if (response?.success && response.data?.injects) {
                                // Map AI response to selectedInjects
                                const newSelectedInjects: typeof selectedInjects = [];
                                let delayAccumulator = 0;
                                
                                for (const aiInject of response.data.injects) {
                                  // Find the matching attack pattern and contract
                                  const ap = playableAps.find(p => 
                                    p.name.toLowerCase().includes(aiInject.title?.toLowerCase() || '') ||
                                    aiInject.title?.toLowerCase().includes(p.name.toLowerCase()) ||
                                    p.externalId === aiInject.attackPatternId
                                  );
                                  
                                  if (ap) {
                                    const contracts = getFilteredContracts(ap.contracts);
                                    // Try to find the specific contract AI suggested, or use the first one
                                    const contract = contracts.find((c: any) => 
                                      c.injector_contract_id === aiInject.contractId ||
                                      (c.injector_contract_labels?.en || '').toLowerCase().includes((aiInject.injectLabel || '').toLowerCase())
                                    ) || contracts[0];
                                    
                                    if (contract) {
                                      const contractLabel = contract.injector_contract_labels?.en || 
                                        contract.injector_contract_labels?.['en-US'] || 
                                        contract.injector_name || 'Unknown';
                                      
                                      newSelectedInjects.push({
                                        attackPatternId: ap.id,
                                        attackPatternName: ap.name,
                                        contractId: contract.injector_contract_id,
                                        contractLabel,
                                        delayMinutes: delayAccumulator,
                                      });
                                      
                                      delayAccumulator += scenarioInjectSpacing;
                                    }
                                  }
                                }
                                
                                if (newSelectedInjects.length > 0) {
                                  setSelectedInjects(newSelectedInjects);
                                  log.debug(' AI selected', newSelectedInjects.length, 'injects');
                                }
                              }
                            } catch (error) {
                              log.error(' AI inject selection failed:', error);
                            } finally {
                              setAiSelectingInjects(false);
                            }
                          }}
                          startIcon={aiSelectingInjects ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeOutlined />}
                          sx={{ mb: 2, textTransform: 'none' }}
                        >
                          {aiSelectingInjects ? 'Selecting injects...' : 'Select using AI'}
                        </Button>
                      </span>
                    </Tooltip>
                  ) : null;
                })()}
                
                {(!scenarioOverviewData?.attackPatterns || scenarioOverviewData.attackPatterns.length === 0) ? (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    No attack patterns found on this page. You can still create an empty scenario.
                  </Alert>
                ) : (
                  <Box sx={{ flex: 1, overflow: 'auto', mb: 2, minHeight: 0 }}>
                    {/* Group attack patterns by kill chain phase */}
                    {(() => {
                      const allAps = scenarioOverviewData.attackPatterns;
                      const playableAps = allAps.filter(ap => getFilteredContracts(ap.contracts).length > 0);
                      const nonPlayableAps = allAps.filter(ap => getFilteredContracts(ap.contracts).length === 0);
                      
                      // Group playable attack patterns by kill chain phase
                      const groupedByPhase: Record<string, typeof playableAps> = {};
                      playableAps.forEach(ap => {
                        const phase = ap.killChainPhases?.[0] || 'Unknown Phase';
                        if (!groupedByPhase[phase]) {
                          groupedByPhase[phase] = [];
                        }
                        groupedByPhase[phase].push(ap);
                      });
                      
                      // Sort phases by kill chain order (if available)
                      const knownPhases = scenarioOverviewData.killChainPhases || [];
                      const sortedPhases = Object.keys(groupedByPhase).sort((a, b) => {
                        const orderA = knownPhases.find(p => p.phase_name === a)?.phase_order ?? 999;
                        const orderB = knownPhases.find(p => p.phase_name === b)?.phase_order ?? 999;
                        return orderA - orderB;
                      });
                      
                      // Render attack pattern card
                      const renderAttackPatternCard = (ap: typeof playableAps[0]) => {
                        const filteredContracts = getFilteredContracts(ap.contracts);
                        return (
                          <Paper
                            key={ap.id}
                            elevation={0}
                            sx={{ 
                              p: 1.5, 
                              mb: 1, 
                              border: 1, 
                              borderColor: 'divider', 
                              borderRadius: 1,
                              transition: 'all 0.15s',
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                              <LockPattern sx={{ fontSize: 18, color: '#d4e157' }} />
                              <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>{ap.name}</Typography>
                              <Chip label={ap.externalId} size="small" sx={{ fontSize: 10, height: 20 }} />
                              <Chip 
                                label={`${filteredContracts.length} inject${filteredContracts.length !== 1 ? 's' : ''}`} 
                                size="small" 
                                sx={{ fontSize: 10, height: 20, bgcolor: '#4caf50', color: 'white' }} 
                              />
                            </Box>
                            
                            <TextField
                              select
                              label="Select inject"
                              size="small"
                              fullWidth
                              value={selectedInjects.find(i => i.attackPatternId === ap.id)?.contractId || ''}
                              onChange={(e) => {
                                const contractId = e.target.value;
                                if (!contractId) {
                                  setSelectedInjects(prev => prev.filter(i => i.attackPatternId !== ap.id));
                                } else {
                                  const contract = filteredContracts.find((c: any) => c.injector_contract_id === contractId);
                                  const contractLabel = contract?.injector_contract_labels?.en || 
                                    contract?.injector_contract_labels?.['en-US'] || 
                                    contract?.injector_name || 'Unknown';
                                  
                                  setSelectedInjects(prev => {
                                    const existing = prev.findIndex(i => i.attackPatternId === ap.id);
                                    const newInject = {
                                      attackPatternId: ap.id,
                                      attackPatternName: ap.name,
                                      contractId,
                                      contractLabel,
                                      delayMinutes: existing >= 0 ? prev[existing].delayMinutes : prev.length * scenarioInjectSpacing,
                                    };
                                    
                                    if (existing >= 0) {
                                      const updated = [...prev];
                                      updated[existing] = newInject;
                                      return updated;
                                    }
                                    return [...prev, newInject];
                                  });
                                }
                              }}
                              sx={{ mt: 1 }}
                            >
                              <MenuItem value=""><em>Skip this attack pattern</em></MenuItem>
                              {filteredContracts.map((contract: any) => {
                                const label = contract.injector_contract_labels?.en || 
                                  contract.injector_contract_labels?.['en-US'] || 
                                  contract.injector_name || 'Unknown Inject';
                                const platforms = contract.injector_contract_platforms || [];
                                return (
                                  <MenuItem key={contract.injector_contract_id} value={contract.injector_contract_id}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                                      <Typography variant="body2" sx={{ flex: 1 }}>{label}</Typography>
                                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                                        {platforms.slice(0, 2).map((p: string) => (
                                          <Chip 
                                            key={p} 
                                            icon={getPlatformIcon(p)}
                                            label={p} 
                                            size="small" 
                                            sx={{ 
                                              height: 20, 
                                              fontSize: 9,
                                              bgcolor: getPlatformColor(p),
                                              color: 'white',
                                              '& .MuiChip-icon': { color: 'white', ml: 0.5 },
                                            }} 
                                          />
                                        ))}
                                      </Box>
                                    </Box>
                                  </MenuItem>
                                );
                              })}
                            </TextField>
                          </Paper>
                        );
                      };
                      
                      return (
                        <>
                          {/* Playable Attack Patterns grouped by Kill Chain Phase */}
                          {playableAps.length > 0 && (
                            <>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                                  Playable Attack Patterns ({playableAps.length})
                                </Typography>
                                <Chip label="Injects available" size="small" sx={{ height: 18, fontSize: 10, bgcolor: '#4caf50', color: 'white' }} />
                              </Box>
                              
                              {sortedPhases.map((phase, phaseIndex) => (
                                <Box key={phase} sx={{ mb: phaseIndex < sortedPhases.length - 1 ? 2 : 0 }}>
                                  {/* Kill Chain Phase Header */}
                                  <Box sx={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: 1, 
                                    mb: 1,
                                    py: 0.5,
                                    px: 1,
                                    bgcolor: 'action.hover',
                                    borderRadius: 1,
                                    borderLeft: 3,
                                    borderColor: '#ff9800',
                                  }}>
                                    <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', color: '#ff9800' }}>
                                      {phase}
                                    </Typography>
                                    <Chip 
                                      label={`${groupedByPhase[phase].length}`} 
                                      size="small" 
                                      sx={{ height: 16, fontSize: 10, bgcolor: '#ff9800', color: 'white', minWidth: 24 }} 
                                    />
                                  </Box>
                                  
                                  {/* Attack Patterns in this phase */}
                                  {groupedByPhase[phase].map(ap => renderAttackPatternCard(ap))}
                                </Box>
                              ))}
                            </>
                          )}
                          
                          {/* Non-playable Attack Patterns (no injects) */}
                          {nonPlayableAps.length > 0 && (
                            <>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, mt: playableAps.length > 0 ? 2 : 0 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                                  Non-playable Attack Patterns ({nonPlayableAps.length})
                                </Typography>
                                <Chip label="No injects" size="small" sx={{ height: 18, fontSize: 10, bgcolor: 'text.disabled', color: 'white' }} />
                              </Box>
                              {nonPlayableAps.map((ap) => (
                                <Paper
                                  key={ap.id}
                                  elevation={0}
                                  sx={{ p: 1.5, mb: 1, border: 1, borderColor: 'divider', borderRadius: 1, opacity: 0.6 }}
                                >
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <LockPattern sx={{ fontSize: 18, color: 'text.disabled' }} />
                                    <Typography variant="body2" sx={{ fontWeight: 600, flex: 1, color: 'text.secondary' }}>{ap.name}</Typography>
                                    <Chip label={ap.externalId} size="small" sx={{ fontSize: 10, height: 20 }} />
                                  </Box>
                                </Paper>
                              ))}
                            </>
                          )}
                        </>
                      );
                    })()}
                  </Box>
                )}
              </>
            )}
            
            {/* Summary */}
            <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1, mb: 2, flexShrink: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {scenarioTypeAffinity === 'TABLE-TOP' 
                  ? `${selectedInjects.length} email notification${selectedInjects.length !== 1 ? 's' : ''} selected`
                  : `${selectedInjects.length} inject${selectedInjects.length !== 1 ? 's' : ''} selected`
                }
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Total scenario duration: ~{selectedInjects.length > 0 ? (selectedInjects.length - 1) * scenarioInjectSpacing : 0} minutes
              </Typography>
            </Box>
            
            {/* Actions */}
            <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
              <Button variant="outlined" onClick={handleClose} sx={{ flex: 1 }}>
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={() => setPanelMode('scenario-form')}
                endIcon={<ArrowForwardOutlined />}
                sx={{ flex: 1 }}
              >
                Next
              </Button>
            </Box>
          </>
        ) : null}
      </Box>
    );
  };
  
  const renderScenarioFormView = () => {
    const logoSuffix = mode === 'dark' ? 'dark-theme' : 'light-theme';
    const openaevLogoPath = `../assets/logos/logo_openaev_${logoSuffix}_embleme_square.svg`;
    
    const categories = [
      { value: 'attack-scenario', label: 'Attack Scenario' },
      { value: 'incident-response', label: 'Incident Response' },
      { value: 'detection-validation', label: 'Detection Validation' },
      { value: 'red-team', label: 'Red Team' },
      { value: 'purple-team', label: 'Purple Team' },
    ];
    
    // For table-top, create email timeline from selected attack patterns only
    const emailTimeline = scenarioTypeAffinity === 'TABLE-TOP' && selectedInjects.length > 0
      ? selectedInjects.map((inject, index) => {
          const ap = scenarioOverviewData?.attackPatterns?.find(p => p.id === inject.attackPatternId);
          return {
            attackPatternId: inject.attackPatternId,
            attackPatternName: inject.attackPatternName,
            externalId: ap?.externalId || '',
            killChainPhases: ap?.killChainPhases || [],
            delayMinutes: index * scenarioInjectSpacing,
          };
        })
      : [];
    
    return (
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexShrink: 0 }}>
          <img src={openaevLogoPath} alt="OpenAEV" style={{ height: 24, width: 'auto' }} />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Create Scenario
          </Typography>
        </Box>
        
        {/* Stepper */}
        <Stepper activeStep={2} sx={{ mb: 3, flexShrink: 0 }}>
          <Step completed>
            <StepLabel>Select Affinity</StepLabel>
          </Step>
          <Step completed>
            <StepLabel>Select Injects</StepLabel>
          </Step>
          <Step>
            <StepLabel>Configure Details</StepLabel>
          </Step>
        </Stepper>
        
        {/* Back button */}
        <Box sx={{ mb: 1.5, flexShrink: 0 }}>
          <Button
            size="small"
            startIcon={<ChevronLeftOutlined />}
            onClick={() => {
              setScenarioStep(1);
              setPanelMode('scenario-overview');
            }}
            sx={{ 
              color: 'text.secondary',
              textTransform: 'none',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            Back to inject selection
          </Button>
        </Box>
        
        {/* Affinity Summary */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', flexShrink: 0 }}>
          <Chip 
            label={`Type: ${scenarioTypeAffinity}`} 
            size="small" 
            sx={{ 
              bgcolor: scenarioTypeAffinity === 'TABLE-TOP' ? '#42a5f5' : '#4caf50',
              color: 'white',
            }} 
          />
          {scenarioTypeAffinity !== 'TABLE-TOP' && scenarioPlatformsAffinity.map(p => (
            <Chip 
              key={p}
              icon={getPlatformIcon(p)}
              label={p.charAt(0).toUpperCase() + p.slice(1)} 
              size="small" 
              sx={{ 
                bgcolor: getPlatformColor(p),
                color: 'white',
                '& .MuiChip-icon': { color: 'white', ml: 0.5 },
              }} 
            />
          ))}
        </Box>
        
        {/* Form */}
        <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          <TextField
            label="Scenario Name"
            value={scenarioForm.name}
            onChange={(e) => setScenarioForm(prev => ({ ...prev, name: e.target.value }))}
            fullWidth
            required
            size="small"
            sx={{ mb: 2 }}
          />
          
          <TextField
            label="Subtitle"
            value={scenarioForm.subtitle}
            onChange={(e) => setScenarioForm(prev => ({ ...prev, subtitle: e.target.value }))}
            fullWidth
            size="small"
            placeholder="Short tagline for the scenario"
            sx={{ mb: 2 }}
          />
          
          <TextField
            select
            label="Category"
            value={scenarioForm.category}
            onChange={(e) => setScenarioForm(prev => ({ ...prev, category: e.target.value }))}
            fullWidth
            size="small"
            sx={{ mb: 2 }}
          >
            {categories.map((cat) => (
              <MenuItem key={cat.value} value={cat.value}>
                {cat.label}
              </MenuItem>
            ))}
          </TextField>
          
          <TextField
            label="Description"
            value={scenarioForm.description}
            onChange={(e) => setScenarioForm(prev => ({ ...prev, description: e.target.value }))}
            fullWidth
            multiline
            rows={4}
            placeholder="Detailed description of the scenario..."
            sx={{ mb: 2 }}
          />
          
          {/* Target Selection */}
          {scenarioTypeAffinity === 'TABLE-TOP' ? (
            /* Team Selection for Table-top */
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
                Default Team (for all email notifications)
              </Typography>
              {scenarioTeams.length === 0 ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 2 }}>
                  <CircularProgress size={20} />
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Loading teams...
                  </Typography>
                </Box>
              ) : (
                <Autocomplete
                  options={scenarioTeams}
                  getOptionLabel={(option) => option.team_name || 'Unknown'}
                  value={scenarioTeams.find(t => t.team_id === scenarioSelectedTeam) || null}
                  onChange={(_, value) => setScenarioSelectedTeam(value?.team_id || null)}
                  renderInput={(params) => (
                    <TextField 
                      {...params} 
                      label="Select Team" 
                      size="small" 
                      placeholder="Choose a team"
                    />
                  )}
                  renderOption={(props, option) => (
                    <Box component="li" {...props} key={option.team_id}>
                      <GroupsOutlined sx={{ mr: 1, fontSize: 18, color: 'primary.main' }} />
                      <Typography variant="body2">{option.team_name}</Typography>
                    </Box>
                  )}
                  size="small"
                  noOptionsText="No teams found"
                />
              )}
            </Box>
          ) : (
            /* Asset/Asset Group Selection for Technical scenarios */
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
                Default Target (for all injects)
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <Button
                  variant={scenarioTargetType === 'asset' ? 'contained' : 'outlined'}
                  size="small"
                  onClick={() => setScenarioTargetType('asset')}
                  startIcon={<ComputerOutlined />}
                  sx={{ flex: 1, minWidth: 0 }}
                >
                  Asset
                </Button>
                <Button
                  variant={scenarioTargetType === 'asset_group' ? 'contained' : 'outlined'}
                  size="small"
                  onClick={() => setScenarioTargetType('asset_group')}
                  startIcon={<LanOutlined />}
                  sx={{ flex: 1, minWidth: 0 }}
                >
                  Asset Group
                </Button>
              </Box>
              {scenarioTargetType === 'asset' ? (
                scenarioAssets.length === 0 ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 2 }}>
                    <CircularProgress size={20} />
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      Loading assets...
                    </Typography>
                  </Box>
                ) : (
                  <Autocomplete
                    options={scenarioAssets}
                    getOptionLabel={(option) => option.asset_name || option.endpoint_hostname || 'Unknown'}
                    value={scenarioAssets.find(a => a.asset_id === scenarioSelectedAsset) || null}
                    onChange={(_, value) => setScenarioSelectedAsset(value?.asset_id || null)}
                    renderInput={(params) => (
                      <TextField 
                        {...params} 
                        label="Select Asset" 
                        size="small"
                        placeholder="Choose an asset"
                      />
                    )}
                    renderOption={(props, option) => (
                      <Box component="li" {...props} key={option.asset_id}>
                        <ComputerOutlined sx={{ mr: 1, fontSize: 18, color: 'primary.main' }} />
                        <Typography variant="body2">{option.asset_name || option.endpoint_hostname}</Typography>
                      </Box>
                    )}
                    size="small"
                    noOptionsText="No assets found"
                  />
                )
              ) : (
                scenarioAssetGroups.length === 0 ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 2 }}>
                    <CircularProgress size={20} />
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      Loading asset groups...
                    </Typography>
                  </Box>
                ) : (
                  <Autocomplete
                    options={scenarioAssetGroups}
                    getOptionLabel={(option) => option.asset_group_name || 'Unknown'}
                    value={scenarioAssetGroups.find(g => g.asset_group_id === scenarioSelectedAssetGroup) || null}
                    onChange={(_, value) => setScenarioSelectedAssetGroup(value?.asset_group_id || null)}
                    renderInput={(params) => (
                      <TextField 
                        {...params} 
                        label="Select Asset Group" 
                        size="small"
                        placeholder="Choose an asset group"
                      />
                    )}
                    renderOption={(props, option) => (
                      <Box component="li" {...props} key={option.asset_group_id}>
                        <LanOutlined sx={{ mr: 1, fontSize: 18, color: 'primary.main' }} />
                        <Typography variant="body2">{option.asset_group_name}</Typography>
                      </Box>
                    )}
                    size="small"
                    noOptionsText="No asset groups found"
                  />
                )
              )}
            </Box>
          )}
          
          {/* Timeline Preview */}
          {scenarioTypeAffinity === 'TABLE-TOP' ? (
            /* Email Timeline for Table-top */
            emailTimeline.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    Email Timeline ({emailTimeline.length})
                  </Typography>
                  {/* Fill emails using AI button */}
                  {(() => {
                    const targetPlatform = openaevPlatforms.find(p => p.id === scenarioPlatformId);
                    const isAIAvailable = aiSettings.available && targetPlatform?.isEnterprise;
                    
                    let tooltipMessage = '';
                    if (!aiSettings.available) {
                      tooltipMessage = 'AI is not configured. Configure AI in extension settings.';
                    } else if (!targetPlatform?.isEnterprise) {
                      tooltipMessage = 'AI features require Enterprise Edition.';
                    } else {
                      tooltipMessage = 'Use AI to generate realistic email subjects and body content based on page context';
                    }
                    
                    return (
                      <Tooltip title={tooltipMessage}>
                        <span>
                          <Button
                            variant="outlined"
                            size="small"
                            disabled={!isAIAvailable || aiFillingEmails}
                            onClick={async () => {
                              if (!isAIAvailable) return;
                              
                              setAiFillingEmails(true);
                              try {
                                log.debug(' Requesting AI email generation for attack patterns:', emailTimeline.map(e => ({ id: e.attackPatternId, name: e.attackPatternName, externalId: e.externalId })));
                                
                                const response = await chrome.runtime.sendMessage({
                                  type: 'AI_GENERATE_EMAILS',
                                  payload: {
                                    pageTitle: currentPageTitle,
                                    pageUrl: currentPageUrl,
                                    pageContent: document.body?.innerText?.substring(0, 3000) || '',
                                    scenarioName: scenarioForm.name || 'Security Simulation',
                                    attackPatterns: emailTimeline.map(email => ({
                                      id: email.attackPatternId,
                                      name: email.attackPatternName,
                                      externalId: email.externalId,
                                      killChainPhases: email.killChainPhases,
                                    })),
                                  },
                                });
                                
                                log.debug(' AI email response:', response);
                                
                                if (response?.success && response.data?.emails) {
                                  // Map AI response to ensure attackPatternId matches
                                  // AI might return externalId instead of UUID, so we need to map back
                                  const mappedEmails = response.data.emails.map((aiEmail: any) => {
                                    // Find matching attack pattern by ID or externalId
                                    const matchingAp = emailTimeline.find(e => 
                                      e.attackPatternId === aiEmail.attackPatternId ||
                                      e.externalId === aiEmail.attackPatternId
                                    );
                                    return {
                                      ...aiEmail,
                                      attackPatternId: matchingAp?.attackPatternId || aiEmail.attackPatternId,
                                    };
                                  });
                                  
                                  log.debug(' Mapped emails:', mappedEmails);
                                  setScenarioEmails(mappedEmails);
                                  log.debug(' AI generated', mappedEmails.length, 'email contents');
                                } else {
                                  log.error(' AI email generation failed - no emails in response:', response);
                                }
                              } catch (error) {
                                log.error(' AI email generation failed:', error);
                              } finally {
                                setAiFillingEmails(false);
                              }
                            }}
                            startIcon={aiFillingEmails ? <CircularProgress size={14} color="inherit" /> : <AutoAwesomeOutlined />}
                            sx={{ textTransform: 'none' }}
                          >
                            {aiFillingEmails ? 'Generating...' : 'Fill with AI'}
                          </Button>
                        </span>
                      </Tooltip>
                    );
                  })()}
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {(() => {
                    // Group emails by kill chain phase
                    const sortedKillChainPhases = (scenarioOverviewData?.killChainPhases || []).sort((a, b) => a.phase_order - b.phase_order);
                    
                    // Build a map of phase name to emails
                    const emailsByPhase = new Map<string, typeof emailTimeline>();
                    const emailsWithNoPhase: typeof emailTimeline = [];
                    
                    emailTimeline.forEach(email => {
                      if (email.killChainPhases && email.killChainPhases.length > 0) {
                        // Use the first kill chain phase for grouping
                        const phaseName = email.killChainPhases[0];
                        if (!emailsByPhase.has(phaseName)) {
                          emailsByPhase.set(phaseName, []);
                        }
                        emailsByPhase.get(phaseName)!.push(email);
                      } else {
                        emailsWithNoPhase.push(email);
                      }
                    });
                    
                    // Track global index for delay calculation display
                    let globalIndex = 0;
                    
                    return (
                      <>
                        {sortedKillChainPhases.map(kcPhase => {
                          const phaseEmails = emailsByPhase.get(kcPhase.phase_name) || [];
                          if (phaseEmails.length === 0) return null;
                          
                          return (
                            <Box key={kcPhase.phase_name} sx={{ mb: 2 }}>
                              {/* Kill Chain Phase Header */}
                              <Box sx={{
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: 1, 
                                mb: 1.5,
                                borderLeft: 3, 
                                borderColor: '#f57c00', 
                                pl: 1,
                                py: 0.5,
                              }}>
                                <Typography variant="caption" sx={{ 
                                  fontWeight: 700, 
                                  textTransform: 'uppercase', 
                                  color: '#f57c00',
                                  letterSpacing: 0.5,
                                }}>
                                  {kcPhase.phase_name}
                                </Typography>
                                <Chip 
                                  label={phaseEmails.length} 
                                  size="small" 
                                  sx={{ 
                                    height: 16, 
                                    fontSize: 10, 
                                    bgcolor: '#f57c00', 
                                    color: 'white',
                                    minWidth: 20,
                                  }} 
                                />
                              </Box>
                              
                              {/* Emails in this phase */}
                              {phaseEmails.map((email, phaseIndex) => {
                                const aiEmail = scenarioEmails.find(e => e.attackPatternId === email.attackPatternId);
                                const emailSubject = aiEmail?.subject || `[Simulation] ${email.attackPatternName}`;
                                const emailBody = aiEmail?.body || '';
                                const isLastInPhase = phaseIndex === phaseEmails.length - 1;
                                const currentGlobalIndex = globalIndex++;
                                const isLastOverall = currentGlobalIndex === emailTimeline.length - 1;
                                
                                return (
                                  <Box key={email.attackPatternId} sx={{ display: 'flex', gap: 1.5, ml: 1 }}>
                                    {/* Timeline column */}
                                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0 }}>
                                      <Box
                                        sx={{
                                          width: 12,
                                          height: 12,
                                          borderRadius: '50%',
                                          bgcolor: aiEmail ? '#4caf50' : '#42a5f5',
                                          border: 2,
                                          borderColor: 'background.paper',
                                          boxShadow: 1,
                                          zIndex: 1,
                                        }}
                                      />
                                      {!isLastOverall && (
                                        <Box sx={{ 
                                          width: 2, 
                                          flex: 1, 
                                          bgcolor: isLastInPhase ? '#f57c00' : '#42a5f5', 
                                          opacity: isLastInPhase ? 0.3 : 0.5, 
                                          minHeight: emailBody ? 60 : 40,
                                        }} />
                                      )}
                                    </Box>
                                    {/* Content */}
                                    <Box sx={{ flex: 1, pb: 2 }}>
                                      <Chip 
                                        label={`+${email.delayMinutes} min`} 
                                        size="small" 
                                        sx={{ 
                                          height: 18, 
                                          fontSize: 10, 
                                          bgcolor: 'action.selected',
                                          mb: 0.5,
                                        }} 
                                      />
                                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                        {emailSubject}
                                      </Typography>
                                      {aiEmail ? (
                                        <>
                                          <Chip 
                                            label="AI generated" 
                                            size="small" 
                                            sx={{ 
                                              height: 16, 
                                              fontSize: 9, 
                                              bgcolor: '#4caf50', 
                                              color: 'white',
                                              mt: 0.5,
                                              mb: 0.5,
                                            }} 
                                          />
                                          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', whiteSpace: 'pre-wrap' }}>
                                            {emailBody.substring(0, 200)}{emailBody.length > 200 ? '...' : ''}
                                          </Typography>
                                        </>
                                      ) : (
                                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontStyle: 'italic' }}>
                                          {email.externalId} • Email body placeholder
                                        </Typography>
                                      )}
                                    </Box>
                                  </Box>
                                );
                              })}
                            </Box>
                          );
                        })}
                        
                        {/* Emails with no kill chain phase */}
                        {emailsWithNoPhase.length > 0 && (
                          <Box sx={{ mb: 2 }}>
                            <Box sx={{
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: 1, 
                              mb: 1.5,
                              borderLeft: 3, 
                              borderColor: 'text.disabled', 
                              pl: 1,
                              py: 0.5,
                            }}>
                              <Typography variant="caption" sx={{ 
                                fontWeight: 700, 
                                textTransform: 'uppercase', 
                                color: 'text.disabled',
                                letterSpacing: 0.5,
                              }}>
                                Other
                              </Typography>
                              <Chip 
                                label={emailsWithNoPhase.length} 
                                size="small" 
                                sx={{ 
                                  height: 16, 
                                  fontSize: 10, 
                                  bgcolor: 'text.disabled', 
                                  color: 'white',
                                  minWidth: 20,
                                }} 
                              />
                            </Box>
                            
                            {emailsWithNoPhase.map((email, phaseIndex) => {
                              const aiEmail = scenarioEmails.find(e => e.attackPatternId === email.attackPatternId);
                              const emailSubject = aiEmail?.subject || `[Simulation] ${email.attackPatternName}`;
                              const emailBody = aiEmail?.body || '';
                              const isLastOverall = globalIndex++ === emailTimeline.length - 1;
                              
                              return (
                                <Box key={email.attackPatternId} sx={{ display: 'flex', gap: 1.5, ml: 1 }}>
                                  {/* Timeline column */}
                                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0 }}>
                                    <Box
                                      sx={{
                                        width: 12,
                                        height: 12,
                                        borderRadius: '50%',
                                        bgcolor: aiEmail ? '#4caf50' : '#42a5f5',
                                        border: 2,
                                        borderColor: 'background.paper',
                                        boxShadow: 1,
                                        zIndex: 1,
                                      }}
                                    />
                                    {!isLastOverall && (
                                      <Box sx={{ width: 2, flex: 1, bgcolor: '#42a5f5', opacity: 0.5, minHeight: emailBody ? 60 : 40 }} />
                                    )}
                                  </Box>
                                  {/* Content */}
                                  <Box sx={{ flex: 1, pb: 2 }}>
                                    <Chip 
                                      label={`+${email.delayMinutes} min`} 
                                      size="small" 
                                      sx={{ 
                                        height: 18, 
                                        fontSize: 10, 
                                        bgcolor: 'action.selected',
                                        mb: 0.5,
                                      }} 
                                    />
                                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                      {emailSubject}
                                    </Typography>
                                    {aiEmail ? (
                                      <>
                                        <Chip 
                                          label="AI generated" 
                                          size="small" 
                                          sx={{ 
                                            height: 16, 
                                            fontSize: 9, 
                                            bgcolor: '#4caf50', 
                                            color: 'white',
                                            mt: 0.5,
                                            mb: 0.5,
                                          }} 
                                        />
                                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', whiteSpace: 'pre-wrap' }}>
                                          {emailBody.substring(0, 200)}{emailBody.length > 200 ? '...' : ''}
                                        </Typography>
                                      </>
                                    ) : (
                                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontStyle: 'italic' }}>
                                        {email.externalId} • Email body placeholder
                                      </Typography>
                                    )}
                                  </Box>
                                </Box>
                              );
                            })}
                          </Box>
                        )}
                      </>
                    );
                  })()}
                </Box>
              </Box>
            )
          ) : (
            /* Inject Timeline for Technical scenarios */
            selectedInjects.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                  Inject Timeline ({selectedInjects.length})
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {selectedInjects.map((inject, index) => (
                    <Box key={inject.contractId} sx={{ display: 'flex', gap: 1.5 }}>
                      {/* Timeline column */}
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0 }}>
                        <Box
                          sx={{
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            bgcolor: 'primary.main',
                            border: 2,
                            borderColor: 'background.paper',
                            boxShadow: 1,
                            zIndex: 1,
                          }}
                        />
                        {index < selectedInjects.length - 1 && (
                          <Box sx={{ width: 2, flex: 1, bgcolor: 'primary.main', opacity: 0.5, minHeight: 40 }} />
                        )}
                      </Box>
                      {/* Content */}
                      <Box sx={{ flex: 1, pb: 2 }}>
                        <Chip 
                          label={`+${inject.delayMinutes} min`} 
                          size="small" 
                          sx={{ 
                            height: 18, 
                            fontSize: 10, 
                            bgcolor: 'action.selected',
                            mb: 0.5,
                          }} 
                        />
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {inject.attackPatternName}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                          {inject.contractLabel}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            )
          )}
        </Box>
        
        {/* Actions */}
        <Box sx={{ display: 'flex', gap: 1, pt: 2, flexShrink: 0 }}>
          <Button
            variant="outlined"
            onClick={handleClose}
            sx={{ flex: 1 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateScenario}
            disabled={!scenarioForm.name || submitting}
            endIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <ArrowForwardOutlined />}
            sx={{ flex: 1 }}
          >
            Create Scenario
          </Button>
        </Box>
      </Box>
    );
  };

  const renderEmptyView = () => (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: 300,
        color: 'text.secondary',
        textAlign: 'center',
        p: 3,
      }}
    >
      <SearchOutlined sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
      <Typography variant="body1" sx={{ mb: 1 }}>No entity selected</Typography>
      <Typography variant="body2">
        Click on a highlighted entity or use the search to get started.
      </Typography>
    </Box>
  );

  const renderLoadingView = () => (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: 200,
      }}
    >
      <CircularProgress size={40} />
      <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
        Loading...
      </Typography>
    </Box>
  );

  const renderContent = () => {
    switch (panelMode) {
      case 'entity':
        return renderEntityView();
      case 'not-found':
        return renderNotFoundView();
      case 'add':
        return renderAddView();
      case 'import-results':
        return renderImportResultsView();
      case 'preview':
        return renderPreviewView();
      case 'platform-select':
        return renderPlatformSelectView();
      case 'existing-containers':
        return renderExistingContainersView();
      case 'container-type':
        return renderContainerTypeView();
      case 'container-form':
        return renderContainerFormView();
      case 'investigation':
        return renderInvestigationView();
      case 'scan-results':
        return renderScanResultsView();
      case 'atomic-testing':
        return renderAtomicTestingView();
      case 'search':
        return renderSearchView();
      case 'search-results':
        return renderSearchResultsView();
      case 'oaev-search':
        return renderOAEVSearchView();
      case 'unified-search':
        return renderUnifiedSearchView();
      case 'scenario-overview':
        return renderScenarioOverviewView();
      case 'scenario-form':
        return renderScenarioFormView();
      case 'loading':
        return renderLoadingView();
      default:
        return renderEmptyView();
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
