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
  DevicesOutlined,
  FolderOutlined,
  PersonOutlined,
  GroupsOutlined,
  BugReportOutlined,
} from '@mui/icons-material';
import ThemeDark from '../shared/theme/ThemeDark';
import ThemeLight from '../shared/theme/ThemeLight';
import ItemIcon from '../shared/components/ItemIcon';
import { itemColor, hexToRGB } from '../shared/theme/colors';
import { loggers } from '../shared/utils/logger';

const log = loggers.panel;

type PanelMode = 'empty' | 'loading' | 'entity' | 'not-found' | 'add' | 'preview' | 'platform-select' | 'container-type' | 'container-form' | 'investigation' | 'search' | 'search-results' | 'existing-containers' | 'atomic-testing';

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
  createdBy?: { name: string };
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
  platformId?: string;
}

interface ContainerData {
  id: string;
  entity_type: string;
  name: string;
  created: string;
  modified: string;
  createdBy?: { name: string };
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
  // Track container workflow origin: 'preview' (from bulk selection) or 'direct' (from action button)
  const [containerWorkflowOrigin, setContainerWorkflowOrigin] = useState<'preview' | 'direct' | null>(null);
  // Track if entity view came from search (to show back button)
  const [entityFromSearch, setEntityFromSearch] = useState(false);
  // PDF attachment option
  const [attachPdf, setAttachPdf] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  // Page URL for external reference and existing container lookup
  const [currentPageUrl, setCurrentPageUrl] = useState('');
  const [currentPageTitle, setCurrentPageTitle] = useState('');
  // Existing containers found for current page
  const [existingContainers, setExistingContainers] = useState<ContainerData[]>([]);
  const [checkingExisting, setCheckingExisting] = useState(false);
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
        
        // Get all enabled platforms
        const platforms = response.data?.openctiPlatforms || [];
        const enabledPlatforms = platforms
          .filter((p: any) => p.enabled !== false && p.url && p.apiToken)
          .map((p: any) => ({ id: p.id, name: p.name || 'OpenCTI', url: p.url, type: 'opencti' as const }));
        
        // Also add OpenAEV platforms
        const oaevPlatforms = response.data?.openaevPlatforms || [];
        const enabledOAEVPlatforms = oaevPlatforms
          .filter((p: any) => p.enabled !== false && p.url && p.apiToken)
          .map((p: any) => ({ id: p.id, name: p.name || 'OpenAEV', url: p.url, type: 'openaev' as const }));
        
        setAvailablePlatforms([...enabledPlatforms, ...enabledOAEVPlatforms]);
        
        // Fetch enterprise status for each platform in background
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
        
        // Combine all platforms
        const allPlatforms = [...enabledPlatforms, ...enabledOAEVPlatforms];
        
        // Set first OpenCTI platform as default
        if (enabledPlatforms.length > 0) {
          setPlatformUrl(enabledPlatforms[0].url);
          setSelectedPlatformId(enabledPlatforms[0].id);
        } else if (enabledOAEVPlatforms.length > 0) {
          setPlatformUrl(enabledOAEVPlatforms[0].url);
          setSelectedPlatformId(enabledOAEVPlatforms[0].id);
        } else {
          // Fallback to legacy single platform
          const legacyUrl = response.data?.opencti?.url || '';
          setPlatformUrl(legacyUrl);
          if (legacyUrl) {
            setAvailablePlatforms([{ id: 'default', name: 'OpenCTI', url: legacyUrl, type: 'opencti' }]);
            setSelectedPlatformId('default');
          }
        }
      }
    });

    // NOTE: Labels and markings are loaded lazily when container form is opened
    // This avoids blocking the panel while slow platforms respond

    // Listen for messages from content script
    window.addEventListener('message', handleMessage);

    // Cleanup function

    // Get initial panel state
    chrome.runtime.sendMessage({ type: 'GET_PANEL_STATE' }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response?.success && response.data) {
        handlePanelState(response.data);
      }
    });

    return () => window.removeEventListener('message', handleMessage);
  }, []);

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

  // Helper to clean HTML for content field
  const cleanHtmlContent = (html: string): string => {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    // Remove scripts, styles, and tracking elements
    temp.querySelectorAll('script, style, noscript, iframe, svg').forEach(el => el.remove());
    // Remove inline styles and event handlers
    temp.querySelectorAll('*').forEach(el => {
      el.removeAttribute('style');
      el.removeAttribute('onclick');
      el.removeAttribute('onload');
      el.removeAttribute('onerror');
    });
    return temp.innerHTML;
  };

  // Fetch containers for an entity
  const fetchEntityContainers = async (entityId: string, platformId?: string) => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
    
    setLoadingContainers(true);
    setEntityContainers([]); // Clear previous containers
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
      case 'SHOW_ENTITY': {
        const payload = data.payload;
        setEntityContainers([]);
        setEntityFromSearch(false); // Not from search
        
        // Check if we need to fetch full entity details (SDOs from cache have minimal data)
        const entityId = payload?.entityData?.id || payload?.entityId || payload?.id;
        const entityType = payload?.entityData?.entity_type || payload?.type || payload?.entity_type;
        const platformId = payload?.platformId || payload?._platformId;
        
        // Handle multi-platform results if entity is found in multiple platforms
        const platformMatches = payload?.platformMatches || payload?.entityData?.platformMatches;
        if (platformMatches && platformMatches.length > 0) {
          // Build multi-platform results for navigation
          const multiResults = platformMatches.map((match: { platformId: string; entityId: string; entityData?: any }) => {
            const platform = availablePlatforms.find(p => p.id === match.platformId);
            return {
              platformId: match.platformId,
              platformName: platform?.name || match.platformId,
              entity: {
                ...payload,
                entityId: match.entityId,
                entityData: match.entityData || payload?.entityData,
                _platformId: match.platformId,
              },
            };
          });
          setMultiPlatformResults(multiResults);
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
        
        // Check if this is an OpenAEV entity (type starts with 'oaev-')
        const isOAEVEntity = entityType?.startsWith('oaev-');
        const actualEntityType = isOAEVEntity ? entityType.replace('oaev-', '') : entityType;
        
        // Determine if this looks like minimal cache data (has id and name but no description/labels)
        const isMinimalData = entityId && payload?.existsInPlatform && 
          !payload?.entityData?.description && 
          !payload?.entityData?.objectLabel &&
          !payload?.description;
        
        if (isMinimalData && typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
          // Set loading state with basic info
          setEntity(payload);
          setPanelMode('loading');
          
          try {
            // Fetch full entity details from appropriate API (OpenCTI or OpenAEV)
            const response = await chrome.runtime.sendMessage({
              type: isOAEVEntity ? 'GET_OAEV_ENTITY_DETAILS' : 'GET_ENTITY_DETAILS',
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
                _isOAEV: isOAEVEntity,
              });
              setPanelMode('entity');
              // Don't fetch containers for OpenAEV entities
              if (!isOAEVEntity) {
                fetchEntityContainers(entityId, platformId);
              }
            } else {
              // Fall back to original data
              setEntity({ ...payload, _isOAEV: isOAEVEntity });
              setPanelMode(payload?.existsInPlatform ? 'entity' : 'not-found');
            }
          } catch (error) {
            log.error(' Failed to fetch entity details:', error);
            setEntity({ ...payload, _isOAEV: isOAEVEntity });
            setPanelMode(payload?.existsInPlatform ? 'entity' : 'not-found');
          }
        } else {
          // Full data already present or not in platform
          setEntity({ ...payload, _isOAEV: isOAEVEntity });
          setPanelMode(payload?.existsInPlatform ? 'entity' : 'not-found');
          
          // Fetch containers if entity exists in platform (not for OpenAEV)
          if (payload?.existsInPlatform && entityId && !isOAEVEntity) {
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
      case 'SHOW_ATOMIC_TESTING_PANEL': {
        const targets = data.payload?.targets || [];
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
        setPanelMode('atomic-testing');
        break;
      }
      case 'ATOMIC_TESTING_SELECT': {
        // User clicked on a target to select it
        const target = data.payload;
        setSelectedAtomicTarget(target);
        setAtomicTestingTitle(`Atomic Test - ${target?.name || ''}`);
        
        // If it's an attack pattern and platform is selected, load injector contracts
        if (target?.type === 'attack-pattern' && target?.data?.entityId && atomicTestingPlatformId) {
          chrome.runtime.sendMessage({
            type: 'FETCH_INJECTOR_CONTRACTS',
            payload: { attackPatternId: target.data.entityId, platformId: atomicTestingPlatformId },
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
      case 'SHOW_SEARCH_PANEL':
        setPanelMode('search');
        break;
      case 'LOADING':
        setPanelMode('loading');
        break;
    }
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

  const handleSearchResultClick = async (merged: MergedSearchResult) => {
    // Mark that we're coming from search (for back button)
    setEntityFromSearch(true);
    
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
        const response = await chrome.runtime.sendMessage({
          type: 'GET_ENTITY_DETAILS',
          payload: { 
            id: p.result.id, 
            entityType: p.result.entity_type || p.result.type,
            platformId: p.platformId,
          },
        });
        
        return {
          platformId: p.platformId,
          platformName: p.platformName,
          entity: response?.success ? { ...response.data, existsInPlatform: true, _platformId: p.platformId } : { ...p.result, existsInPlatform: true },
        };
      });
      
      const results = await Promise.all(entityPromises);
      
      // Set up multi-platform navigation
      setMultiPlatformResults(results);
      setCurrentPlatformIndex(0);
      setEntity(results[0].entity);
      setPanelMode('entity');
      fetchEntityContainers(results[0].entity.id, results[0].platformId);
    } else {
      // Single platform - load directly
      const platform = merged.platforms[0];
      const platformInfo = availablePlatforms.find(p => p.id === platform.platformId);
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
        
        if (response?.success && response.data) {
          setEntity({ ...response.data, existsInPlatform: true, _platformId: platform.platformId });
          setMultiPlatformResults([]); // Clear multi-platform
          setPanelMode('entity');
          fetchEntityContainers(response.data.id, platform.platformId);
        } else {
          setEntity({ ...platform.result, existsInPlatform: true });
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
    
    setSubmitting(true);
    const response = await chrome.runtime.sendMessage({
      type: 'CREATE_OBSERVABLES_BULK',
      payload: { entities: entitiesToAdd },
    });

    if (chrome.runtime.lastError) {
      setSubmitting(false);
      return;
    }

    if (response?.success) {
      setPanelMode('empty');
      setEntitiesToAdd([]);
    }
    setSubmitting(false);
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
    
    const response = await chrome.runtime.sendMessage({
      type: 'CREATE_CONTAINER',
      payload: {
        type: containerType,
        name: containerForm.name,
        description: containerForm.description,
        content: containerForm.content,
        labels: selectedLabels.map((l) => l.id),
        markings: selectedMarkings.map((m) => m.id),
        entities: entitiesToAdd.map((e) => e.id).filter(Boolean),
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
      setEntity({
        id: createdContainer.id,
        entity_type: containerType,
        name: containerForm.name,
        description: containerForm.description,
        existsInPlatform: true,
        _platformId: createdPlatformId,
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
        <Typography variant="h5" sx={{ fontWeight: 600, fontSize: 20, color: mode === 'dark' ? '#ffffff' : '#1a1a2e' }}>
          Filigran Threat Management
        </Typography>
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
    
    // Color based on entity type
    const getOAEVColor = () => {
      switch (oaevType) {
        case 'Asset': return '#00bcd4'; // Cyan
        case 'AssetGroup': return '#009688'; // Teal
        case 'Player': return '#ff9800'; // Orange
        case 'Team': return '#4caf50'; // Green
        case 'AttackPattern': return '#d4e157'; // Yellow-green (matches OpenCTI Attack-Pattern)
        default: return '#00bcd4';
      }
    };
    const color = getOAEVColor();
    
    // Get entity properties based on type
    let name = '';
    let description = '';
    let entityId = '';
    let entityUrl = '';
    let mitreId = ''; // For attack patterns
    
    switch (oaevType) {
      case 'Asset': {
        const asset = entityData as any;
        name = asset.endpoint_name || asset.asset_name || asset.name || 'Unknown Asset';
        description = asset.endpoint_description || asset.asset_description || '';
        entityId = asset.endpoint_id || asset.asset_id || asset.id || '';
        entityUrl = `${platformUrl}/admin/assets/endpoints/${entityId}`;
        break;
      }
      case 'AssetGroup': {
        const group = entityData as any;
        name = group.asset_group_name || group.name || 'Unknown Asset Group';
        description = group.asset_group_description || '';
        entityId = group.asset_group_id || group.id || '';
        entityUrl = `${platformUrl}/admin/assets/asset_groups/${entityId}`;
        break;
      }
      case 'Player': {
        const player = entityData as any;
        name = [player.user_firstname, player.user_lastname].filter(Boolean).join(' ') || player.user_email || 'Unknown Player';
        description = player.user_organization || '';
        entityId = player.user_id || player.id || '';
        entityUrl = `${platformUrl}/admin/teams/players/${entityId}`;
        break;
      }
      case 'Team': {
        const team = entityData as any;
        name = team.team_name || team.name || 'Unknown Team';
        description = team.team_description || '';
        entityId = team.team_id || team.id || '';
        entityUrl = `${platformUrl}/admin/teams/teams/${entityId}`;
        break;
      }
      case 'AttackPattern': {
        const ap = entityData as any;
        name = ap.attack_pattern_name || ap.name || 'Unknown Attack Pattern';
        description = ap.attack_pattern_description || '';
        mitreId = ap.attack_pattern_external_id || '';
        entityId = ap.attack_pattern_id || ap.id || '';
        entityUrl = `${platformUrl}/admin/attack_patterns/${entityId}`;
        break;
      }
    }
    
    // Get OpenAEV icon based on type
    const getOAEVIcon = () => {
      switch (oaevType) {
        case 'Asset': return <DevicesOutlined sx={{ fontSize: 20, color }} />;
        case 'AssetGroup': return <FolderOutlined sx={{ fontSize: 20, color }} />;
        case 'Player': return <PersonOutlined sx={{ fontSize: 20, color }} />;
        case 'Team': return <GroupsOutlined sx={{ fontSize: 20, color }} />;
        case 'AttackPattern': return <SecurityOutlined sx={{ fontSize: 20, color }} />;
        default: return <DevicesOutlined sx={{ fontSize: 20, color }} />;
      }
    };
    
    return (
      <Box sx={{ p: 2, overflow: 'auto' }}>
        {/* Back to search button */}
        {entityFromSearch && (
          <Box sx={{ mb: 1.5 }}>
            <Button
              size="small"
              startIcon={<ChevronLeftOutlined />}
              onClick={() => {
                setEntityFromSearch(false);
                setMultiPlatformResults([]);
                setPanelMode('search');
              }}
              sx={{ 
                color: 'text.secondary',
                textTransform: 'none',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              Back to search
            </Button>
          </Box>
        )}
        
        {/* Platform indicator */}
        {platform && (
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              mb: 2, 
              p: 1, 
              bgcolor: 'action.hover',
              borderRadius: 1,
              border: 1,
              borderColor: 'divider',
              gap: 1,
            }}
          >
            <img
              src={typeof chrome !== 'undefined' && chrome.runtime?.getURL 
                ? chrome.runtime.getURL(`assets/logos/logo_openaev_${logoSuffix}_embleme_square.svg`)
                : `../assets/logos/logo_openaev_${logoSuffix}_embleme_square.svg`
              }
              alt="OpenAEV"
              width={18}
              height={18}
            />
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {platform.name || 'OpenAEV'}
            </Typography>
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
        
        {/* Tags */}
        {((entityData.asset_group_tags || entityData.team_tags || entityData.asset_tags) && 
          (entityData.asset_group_tags || entityData.team_tags || entityData.asset_tags).length > 0) && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" sx={sectionTitleStyle}>
              Tags
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {(entityData.asset_group_tags || entityData.team_tags || entityData.asset_tags).map((tag: string, i: number) => (
                <Chip key={i} label={tag} size="small" variant="outlined" sx={{ borderRadius: 1 }} />
              ))}
            </Box>
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Actions */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          {entityUrl && (
            <Button
              variant="contained"
              size="small"
              startIcon={
                <img 
                  src={typeof chrome !== 'undefined' && chrome.runtime?.getURL 
                    ? chrome.runtime.getURL(`assets/logos/logo_openaev_${mode === 'dark' ? 'light' : 'dark'}-theme_embleme_square.svg`)
                    : `../assets/logos/logo_openaev_${mode === 'dark' ? 'light' : 'dark'}-theme_embleme_square.svg`
                  } 
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
              sx={{ bgcolor: color, '&:hover': { bgcolor: color, opacity: 0.9 } }}
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
    
    // Check if this is an OpenAEV entity
    const isOAEVEntity = (entity as any)._isOAEV || (entity as any).type?.startsWith('oaev-');
    
    // If OpenAEV entity, render OpenAEV-specific view
    if (isOAEVEntity) {
      return renderOAEVEntityView();
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

    // Platform navigation handlers
    const handlePrevPlatform = () => {
      if (currentPlatformIndex > 0) {
        const prevIndex = currentPlatformIndex - 1;
        setCurrentPlatformIndex(prevIndex);
        const prevResult = multiPlatformResults[prevIndex];
        setEntity({ ...prevResult.entity, _platformId: prevResult.platformId });
        setSelectedPlatformId(prevResult.platformId);
        const platform = availablePlatforms.find(p => p.id === prevResult.platformId);
        if (platform) setPlatformUrl(platform.url);
      }
    };

    const handleNextPlatform = () => {
      if (currentPlatformIndex < multiPlatformResults.length - 1) {
        const nextIndex = currentPlatformIndex + 1;
        setCurrentPlatformIndex(nextIndex);
        const nextResult = multiPlatformResults[nextIndex];
        setEntity({ ...nextResult.entity, _platformId: nextResult.platformId });
        setSelectedPlatformId(nextResult.platformId);
        const platform = availablePlatforms.find(p => p.id === nextResult.platformId);
        if (platform) setPlatformUrl(platform.url);
      }
    };

    // Handle back to search
    const handleBackToSearch = () => {
      setEntityFromSearch(false);
      setMultiPlatformResults([]);
      setPanelMode('search');
    };

    return (
      <Box sx={{ p: 2, overflow: 'auto' }}>
        {/* Back to search button */}
        {entityFromSearch && (
          <Box sx={{ mb: 1.5 }}>
            <Button
              size="small"
              startIcon={<ChevronLeftOutlined />}
              onClick={handleBackToSearch}
              sx={{ 
                color: 'text.secondary',
                textTransform: 'none',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              Back to search
            </Button>
          </Box>
        )}
        
        {/* Platform indicator bar */}
        {(availablePlatforms.length > 1 || hasMultiplePlatforms) && (
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
                      ? chrome.runtime.getURL(`assets/logos/logo_opencti_${logoSuffix}_embleme_square.svg`)
                      : `../assets/logos/logo_opencti_${logoSuffix}_embleme_square.svg`
                    }
                    alt="OpenCTI"
                    width={18}
                    height={18}
                  />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {currentPlatform?.name || 'Unknown'}
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
                    ? chrome.runtime.getURL(`assets/logos/logo_opencti_${logoSuffix}_embleme_square.svg`)
                    : `../assets/logos/logo_opencti_${logoSuffix}_embleme_square.svg`
                  }
                  alt="OpenCTI"
                  width={18}
                  height={18}
                />
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {currentPlatform?.name || 'OpenCTI'}
                </Typography>
              </Box>
            )}
          </Box>
        )}

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

        {/* Description */}
        {description && (
          <Box sx={{ mb: 2.5 }}>
            <Typography variant="caption" sx={sectionTitleStyle}>
              Description
            </Typography>
            <Typography variant="body2" sx={contentTextStyle}>
              {description.slice(0, 400)}
              {description.length > 400 && '...'}
            </Typography>
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
                <Typography variant="body2" sx={{ fontWeight: 500, ...contentTextStyle }}>
                  {author.name}
                </Typography>
              </Box>
            )}
            {creators && creators.length > 0 && (
              <Box>
                <Typography variant="caption" sx={sectionTitleStyle}>
                  Creator{creators.length > 1 ? 's' : ''}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 500, ...contentTextStyle }}>
                  {creators.map((c: { name: string }) => c.name).join(', ')}
                </Typography>
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
                    {new Date(created).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                  </Typography>
                </Box>
              )}
              {modified && (
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.25 }}>
                    Modified (STIX)
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, ...contentTextStyle }}>
                    {new Date(modified).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
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
                    {new Date(entityData.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                  </Typography>
                </Box>
              )}
              {entityData.updated_at && (
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.25 }}>
                    Updated (Platform)
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, ...contentTextStyle }}>
                    {new Date(entityData.updated_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
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
                    {new Date(entityData.first_seen).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                  </Typography>
                </Box>
              )}
              {entityData.last_seen && (
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.25 }}>
                    Last Seen
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, ...contentTextStyle }}>
                    {new Date(entityData.last_seen).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
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
                          <span>{new Date(container.created).toLocaleDateString()}</span>
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

  const renderPreviewView = () => (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Typography variant="h6">Preview Selection</Typography>
      </Box>
      
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        {entitiesToAdd.length} entit{entitiesToAdd.length === 1 ? 'y' : 'ies'} selected for import
      </Typography>

      {/* Entity list */}
      <Box sx={{ maxHeight: 300, overflow: 'auto', mb: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
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
                    if (availablePlatforms.length > 1) {
                      setPanelMode('platform-select');
                    } else {
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
                    if (availablePlatforms.length > 1) {
                      setPanelMode('platform-select');
                    } else {
                      setPanelMode('container-type');
                    }
                  }
                }
              );
            } else {
              // No page URL - go directly to creation flow
              if (availablePlatforms.length > 1) {
                setPanelMode('platform-select');
              } else {
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
          onClick={handleAddEntities}
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
    // Only show back if coming from preview mode (has entities selected)
    const showBackButton = containerWorkflowOrigin === 'preview' && entitiesToAdd.length > 0;
    
    return (
    <Box sx={{ p: 2 }}>
      {/* Stepper */}
      <Stepper activeStep={0} sx={{ mb: 3 }}>
        {containerSteps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        {showBackButton && (
          <IconButton size="small" onClick={() => setPanelMode('preview')}>
            <ChevronLeftOutlined />
          </IconButton>
        )}
        <Typography variant="h6" sx={{ fontSize: 16 }}>Select Platform</Typography>
      </Box>

      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Choose which OpenCTI platform to create the container in:
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {openctiPlatforms.map((platform) => (
          <Paper
            key={platform.id}
            onClick={() => {
              setSelectedPlatformId(platform.id);
              setPlatformUrl(platform.url);
              setPanelMode('container-type');
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
              existsInPlatform: true,
              _platformId: containerPlatformId,
            });
            setMultiPlatformResults([{
              platformId: containerPlatformId,
              platformName: availablePlatforms.find(p => p.id === containerPlatformId)?.name || 'OpenCTI',
              entity: { ...response.data, existsInPlatform: true },
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
        name: container.name,
        description: (container as any).description,
        existsInPlatform: true,
        _platformId: containerPlatformId,
      });
      setMultiPlatformResults([{
        platformId: containerPlatformId,
        platformName: availablePlatforms.find(p => p.id === containerPlatformId)?.name || 'OpenCTI',
        entity: { id: container.id, entity_type: container.entity_type, name: container.name, existsInPlatform: true },
      }]);
      setCurrentPlatformIndex(0);
      setEntityContainers([]);
      setPanelMode('entity');
    };

    const handleRefreshContainer = (container: ContainerData) => {
      // Pre-fill the form with the container's data and go to creation with same name
      setContainerForm({
        name: container.name,
        description: containerForm.description, // Keep the new description
        content: containerForm.content, // Keep the new content
      });
      setContainerType(container.entity_type);
      setPanelMode('container-form');
    };

    const handleCreateNew = () => {
      // Clear existing container selection and proceed to create new
      // If multiple platforms, go to platform select first
      if (availablePlatforms.length > 1) {
        setPanelMode('platform-select');
      } else {
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
                      {container.modified && <span>• {new Date(container.modified).toLocaleDateString()}</span>}
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
    if (!targetPlatformId && availablePlatforms.length > 1) {
      log.error(' No platform selected for investigation');
      return;
    }
    
    setInvestigationScanning(true);
    setInvestigationEntities([]);
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        // Send scan request with platform ID for filtering
        chrome.tabs.sendMessage(tab.id, { 
          type: 'SCAN_FOR_INVESTIGATION',
          payload: { platformId: targetPlatformId || availablePlatforms[0]?.id },
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
              <TextField
                select
                size="small"
                fullWidth
                value={investigationTypeFilter}
                onChange={(e) => setInvestigationTypeFilter(e.target.value)}
                SelectProps={{ native: true }}
                sx={{ '& .MuiInputBase-input': { py: 1 } }}
              >
                <option value="all">All types ({investigationEntities.length})</option>
                {investigationEntityTypes.map(type => (
                  <option key={type} value={type}>
                    {type.replace(/-/g, ' ').replace(/^oaev-/, 'OpenAEV ')} ({investigationEntities.filter(e => e.type === type).length})
                  </option>
                ))}
              </TextField>
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

  // ============================================================================
  // Atomic Testing Mode (OpenAEV)
  // ============================================================================
  
  // State for atomic testing
  const [atomicTestingTargets, setAtomicTestingTargets] = useState<Array<{
    type: string;
    value: string;
    name: string;
    data: any;
  }>>([]);
  const [selectedAtomicTarget, setSelectedAtomicTarget] = useState<{
    type: string;
    value: string;
    name: string;
    data: any;
  } | null>(null);
  const [atomicTestingPlatformId, setAtomicTestingPlatformId] = useState<string | null>(null);
  const [atomicTestingPlatformSelected, setAtomicTestingPlatformSelected] = useState(false);
  const [atomicTestingTargetType, setAtomicTestingTargetType] = useState<'asset' | 'asset_group'>('asset');
  const [atomicTestingAssets, setAtomicTestingAssets] = useState<any[]>([]);
  const [atomicTestingAssetGroups, setAtomicTestingAssetGroups] = useState<any[]>([]);
  const [atomicTestingInjectorContracts, setAtomicTestingInjectorContracts] = useState<any[]>([]);
  const [atomicTestingSelectedAsset, setAtomicTestingSelectedAsset] = useState<string | null>(null);
  const [atomicTestingSelectedAssetGroup, setAtomicTestingSelectedAssetGroup] = useState<string | null>(null);
  const [atomicTestingSelectedContract, setAtomicTestingSelectedContract] = useState<string | null>(null);
  const [atomicTestingTitle, setAtomicTestingTitle] = useState<string>('');
  const [atomicTestingCreating, setAtomicTestingCreating] = useState(false);
  const [atomicTestingLoadingAssets, setAtomicTestingLoadingAssets] = useState(false);
  
  // Get OpenAEV platforms only
  const openaevPlatforms = React.useMemo(() => 
    availablePlatforms.filter(p => p.type === 'openaev'), 
    [availablePlatforms]
  );
  
  // Handle platform selection for atomic testing
  const handleSelectAtomicTestingPlatform = async (platformId: string) => {
    setAtomicTestingPlatformId(platformId);
    setAtomicTestingPlatformSelected(true);
    
    // Load assets and asset groups
    setAtomicTestingLoadingAssets(true);
    try {
      const [assetsRes, groupsRes] = await Promise.all([
        chrome.runtime.sendMessage({ type: 'FETCH_OAEV_ASSETS', payload: { platformId } }),
        chrome.runtime.sendMessage({ type: 'FETCH_OAEV_ASSET_GROUPS', payload: { platformId } }),
      ]);
      
      if (assetsRes?.success) {
        setAtomicTestingAssets(assetsRes.data || []);
      }
      if (groupsRes?.success) {
        setAtomicTestingAssetGroups(groupsRes.data || []);
      }
      
      // If selected target is attack pattern, load injector contracts
      if (selectedAtomicTarget?.type === 'attack-pattern' && selectedAtomicTarget?.data?.entityId) {
        const contractsRes = await chrome.runtime.sendMessage({
          type: 'FETCH_INJECTOR_CONTRACTS',
          payload: { attackPatternId: selectedAtomicTarget.data.entityId, platformId },
        });
        if (contractsRes?.success) {
          setAtomicTestingInjectorContracts(contractsRes.data || []);
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
      if (selectedAtomicTarget.type === 'domain' || selectedAtomicTarget.type === 'hostname') {
        // Create DNS resolution payload
        const payloadRes = await chrome.runtime.sendMessage({
          type: 'CREATE_OAEV_PAYLOAD',
          payload: {
            hostname: selectedAtomicTarget.value,
            name: `DNS Resolution - ${selectedAtomicTarget.value}`,
            platforms: ['Linux', 'Windows', 'MacOS'],
            platformId: atomicTestingPlatformId,
          },
        });
        
        if (!payloadRes?.success) {
          log.error(' Failed to create payload:', payloadRes?.error);
          return;
        }
        
        // Get the injector contract from the payload
        const payload = payloadRes.data;
        injectorContractId = payload?.payload_injector_contract?.injector_contract_id;
        
        if (!injectorContractId) {
          log.error(' No injector contract in created payload');
          return;
        }
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
        
        // Clear highlights and close panel
        chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
          if (tab?.id) {
            chrome.tabs.sendMessage(tab.id, { type: 'CLEAR_HIGHLIGHTS' });
            chrome.tabs.sendMessage(tab.id, { type: 'HIDE_PANEL' });
          }
        });
        
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
  
  const renderAtomicTestingView = () => {
    // Step 1: Platform selection (if multiple OpenAEV platforms)
    if (openaevPlatforms.length > 1 && !atomicTestingPlatformSelected) {
      return (
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <BugReportOutlined sx={{ color: '#f44336' }} />
            <Typography variant="h6" sx={{ fontSize: 16, flex: 1 }}>Atomic Testing</Typography>
            <IconButton size="small" onClick={resetAtomicTesting}>
              <CloseOutlined fontSize="small" />
            </IconButton>
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
                <img 
                  src={typeof chrome !== 'undefined' && chrome.runtime?.getURL 
                    ? chrome.runtime.getURL(`assets/logos/logo_openaev_${mode === 'dark' ? 'dark' : 'light'}-theme_embleme_square.svg`)
                    : `../assets/logos/logo_openaev_${mode === 'dark' ? 'dark' : 'light'}-theme_embleme_square.svg`
                  } 
                  alt="OpenAEV" 
                  style={{ width: 24, height: 24 }} 
                />
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
    
    // Step 2: Show form once platform is selected
    return (
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <BugReportOutlined sx={{ color: '#f44336' }} />
          <Typography variant="h6" sx={{ fontSize: 16, flex: 1 }}>Atomic Testing</Typography>
          <IconButton size="small" onClick={resetAtomicTesting}>
            <CloseOutlined fontSize="small" />
          </IconButton>
        </Box>
        
        {/* Target Info */}
        {selectedAtomicTarget ? (
          <Paper elevation={0} sx={{ p: 2, mb: 2, border: 1, borderColor: '#f44336', borderRadius: 1, bgcolor: 'rgba(244, 67, 54, 0.1)' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>Selected Target</Typography>
            <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedAtomicTarget.name}</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'capitalize' }}>
              {selectedAtomicTarget.type.replace('-', ' ')}
            </Typography>
          </Paper>
        ) : (
          <Alert severity="info" sx={{ mb: 2 }}>
            Click on a highlighted target on the page to select it for atomic testing
          </Alert>
        )}
        
        {atomicTestingLoadingAssets ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={32} />
          </Box>
        ) : selectedAtomicTarget && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, overflow: 'auto' }}>
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
                  sx={{ flex: 1 }}
                >
                  Asset
                </Button>
                <Button
                  variant={atomicTestingTargetType === 'asset_group' ? 'contained' : 'outlined'}
                  size="small"
                  onClick={() => setAtomicTestingTargetType('asset_group')}
                  sx={{ flex: 1 }}
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
            
            {/* Injector Contract Selection (for attack patterns) */}
            {selectedAtomicTarget.type === 'attack-pattern' && (
              <Autocomplete
                options={atomicTestingInjectorContracts}
                getOptionLabel={(option) => option.injector_contract_labels?.en || option.injector_contract_id || 'Unknown'}
                value={atomicTestingInjectorContracts.find(c => c.injector_contract_id === atomicTestingSelectedContract) || null}
                onChange={(_, value) => setAtomicTestingSelectedContract(value?.injector_contract_id || null)}
                renderInput={(params) => <TextField {...params} label="Select Injector Contract" size="small" />}
                size="small"
              />
            )}
            
            {/* Info for domain/hostname */}
            {(selectedAtomicTarget.type === 'domain' || selectedAtomicTarget.type === 'hostname') && (
              <Alert severity="info" sx={{ fontSize: 12 }}>
                A DNS Resolution payload will be created automatically for this {selectedAtomicTarget.type}.
              </Alert>
            )}
            
            {/* Create Button */}
            <Box sx={{ mt: 'auto', pt: 2 }}>
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
                startIcon={atomicTestingCreating ? <CircularProgress size={16} color="inherit" /> : <BugReportOutlined />}
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
                        bgcolor: 'action.hover',
                        borderColor: 'primary.main',
                      },
                    }}
                  >
                    <ItemIcon type={merged.type} size="small" />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: 'break-word' }}>
                        {merged.name}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'capitalize' }}>
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

  // Keep for backwards compatibility but redirect to search view
  const renderSearchResultsView = () => renderSearchView();

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
      case 'atomic-testing':
        return renderAtomicTestingView();
      case 'search':
        return renderSearchView();
      case 'search-results':
        return renderSearchResultsView();
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
