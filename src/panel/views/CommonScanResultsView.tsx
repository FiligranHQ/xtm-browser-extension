/**
 * Scan Results View Component
 * 
 * Displays scan results with filtering, selection, and import functionality.
 */

import React, { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Button,
  Checkbox,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  CircularProgress,
  Tooltip,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  TravelExploreOutlined,
  SearchOutlined,
  ChevronRightOutlined,
  ChevronLeftOutlined,
  ArrowForwardOutlined,
  AutoAwesomeOutlined,
  CheckBoxOutlined,
  CheckBoxOutlineBlankOutlined,
  LayersOutlined,
  GpsFixedOutlined,
  InfoOutlined,
} from '@mui/icons-material';
import ItemIcon from '../../shared/components/ItemIcon';
import { itemColor, hexToRGB } from '../../shared/theme/colors';
import type { ScanResultsViewProps } from '../types/view-props';
import type { ScanResultEntity, EntityData, MultiPlatformResult } from '../types/panel-types';
import { loggers } from '../../shared/utils/logger';
import { generateDescription, cleanHtmlContent } from '../utils/description-helpers';
import { getAiColor } from '../utils/platform-helpers';
import { isDefaultPlatform, getCanonicalTypeName, getUniqueCanonicalTypes } from '../../shared/platform/registry';

const log = loggers.panel;

/**
 * Send a message to the content script.
 * Handles both floating iframe mode (postMessage) and split screen mode (chrome.tabs.sendMessage)
 */
const sendToContentScript = async (message: { type: string; payload?: unknown; value?: unknown; values?: unknown }) => {
  // Check if we're in split screen mode (not in iframe)
  const isInSidePanel = window.parent === window;
  
  if (isInSidePanel && typeof chrome !== 'undefined' && chrome.tabs?.query && chrome.tabs?.sendMessage) {
    // Split screen mode - send directly to active tab
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, message);
      }
    } catch {
      // Fallback to postMessage
      window.parent.postMessage(message, '*');
    }
  } else {
    // Floating iframe mode - use postMessage
    window.parent.postMessage(message, '*');
  }
};

// Check if entity is selectable for OpenCTI import (not oaev-* type)
const isSelectableForOpenCTI = (entity: ScanResultEntity): boolean => {
  return !entity.type.startsWith('oaev-');
};

// Check if entity is found in OpenCTI
const isFoundInOpenCTI = (entity: ScanResultEntity): boolean => {
  if (entity.found) {
    // If it's a multi-platform entity, check if any platform is OpenCTI
    if (entity.platformMatches && entity.platformMatches.length > 0) {
      return entity.platformMatches.some(pm => pm.platformType === 'opencti');
    }
    // Single-platform fallback check
    return entity.platformType === 'opencti' || !entity.platformType;
  }
  return false;
};

// Get unique types from platform matches for multi-type display
// Uses cross-platform type mapping to deduplicate equivalent types (e.g., OCTI Attack-Pattern and OAEV AttackPattern)
const getUniqueTypesFromMatches = (entity: ScanResultEntity): { types: string[]; hasMultipleTypes: boolean } => {
  if (!entity.platformMatches || entity.platformMatches.length === 0) {
    return { types: [getCanonicalTypeName(entity.type)], hasMultipleTypes: false };
  }
  // Get all types and deduplicate using cross-platform mapping
  const allTypes = entity.platformMatches.map(pm => pm.type);
  const uniqueCanonicalTypes = getUniqueCanonicalTypes(allTypes);
  return { types: uniqueCanonicalTypes, hasMultipleTypes: uniqueCanonicalTypes.length > 1 };
};

// Format type name for display - uses canonical type name for cross-platform consistency
const formatTypeName = (type: string): string => {
  return getCanonicalTypeName(type);
};

interface ExtendedScanResultsViewProps extends Omit<ScanResultsViewProps, 'showToast' | 'entitiesToAdd' | 'setContainerWorkflowOrigin'> {
  /** Show toast notification */
  showToast: (options: {
    type: 'success' | 'info' | 'warning' | 'error';
    message: string;
    action?: { label: string; type: 'scroll_to_first' | 'close_panel' | 'custom' };
    persistent?: boolean;
    duration?: number;
  }) => void;
  /** Container form state setter */
  setContainerForm: (form: { name: string; description: string; content: string }) => void;
  /** Current page title */
  currentPageTitle: string;
  /** Current page URL */
  currentPageUrl: string;
  /** Set current page URL */
  setCurrentPageUrl: (url: string) => void;
  /** Set current page title */
  setCurrentPageTitle: (title: string) => void;
  /** Logo suffix based on theme */
  logoSuffix: string;
  /** Loading entity details state */
  entityDetailsLoading?: boolean;
  /** Set loading entity details state */
  setEntityDetailsLoading?: (loading: boolean) => void;
  /** Fetch containers for an entity (OpenCTI only) */
  fetchEntityContainers?: (entityId: string, platformId?: string) => Promise<void>;
}

export const CommonScanResultsView: React.FC<ExtendedScanResultsViewProps> = ({
  mode,
  scanResultsEntities,
  setScanResultsEntities,
  scanResultsTypeFilter,
  setScanResultsTypeFilter,
  scanResultsFoundFilter,
  setScanResultsFoundFilter,
  selectedScanItems,
  setSelectedScanItems,
  setPanelMode,
  setEntitiesToAdd,
  setEntity,
  setMultiPlatformResults,
  setCurrentPlatformIndex,
  setEntityFromScanResults,
  currentPlatformIndexRef,
  multiPlatformResultsRef,
  aiSettings,
  aiDiscoveringEntities,
  setAiDiscoveringEntities,
  availablePlatforms,
  showToast,
  setContainerForm,
  currentPageTitle,
  currentPageUrl,
  setCurrentPageUrl,
  setCurrentPageTitle,
  scanPageContent,
  setEntityDetailsLoading,
  fetchEntityContainers,
}) => {
  // Local state for search query
  const [searchQuery, setSearchQuery] = useState('');

  // Calculate statistics
  const scanResultsFoundCount = useMemo(() => 
    scanResultsEntities.filter(e => e.found && !e.discoveredByAI).length,
    [scanResultsEntities]
  );
  
  const scanResultsNotFoundCount = useMemo(() => 
    scanResultsEntities.filter(e => !e.found && !e.discoveredByAI).length,
    [scanResultsEntities]
  );
  
  const scanResultsAICount = useMemo(() => 
    scanResultsEntities.filter(e => e.discoveredByAI).length,
    [scanResultsEntities]
  );

  // Get unique entity types for filter
  const scanResultsEntityTypes = useMemo(() => {
    const types = new Set<string>();
    scanResultsEntities.forEach(e => types.add(e.type));
    return Array.from(types).sort();
  }, [scanResultsEntities]);

  // Filter entities based on current filters
  const filteredScanResultsEntities = useMemo(() => {
    let filtered = scanResultsEntities;
    
    // Apply found/not-found/AI filter
    if (scanResultsFoundFilter === 'found') {
      filtered = filtered.filter(e => e.found && !e.discoveredByAI);
    } else if (scanResultsFoundFilter === 'not-found') {
      filtered = filtered.filter(e => !e.found && !e.discoveredByAI);
    } else if (scanResultsFoundFilter === 'ai-discovered') {
      filtered = filtered.filter(e => e.discoveredByAI);
    }
    
    // Apply type filter
    if (scanResultsTypeFilter !== 'all') {
      filtered = filtered.filter(e => e.type === scanResultsTypeFilter);
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(e => {
        const name = (e.name || '').toLowerCase();
        const value = (e.value || '').toLowerCase();
        const type = (e.type || '').toLowerCase().replace(/-/g, ' ');
        return name.includes(query) || value.includes(query) || type.includes(query);
      });
    }
    
    return filtered;
  }, [scanResultsEntities, scanResultsFoundFilter, scanResultsTypeFilter, searchQuery]);

  // Handle entity click - navigate to entity view
  const handleScanResultEntityClick = async (entity: ScanResultEntity) => {
    // Build multi-platform results from platformMatches
    const results: MultiPlatformResult[] = [];
    
    if (entity.platformMatches && entity.platformMatches.length > 0) {
      // Use platformMatches for multi-platform support
      for (const match of entity.platformMatches) {
        // Try to find platform by ID first, then fall back to platformType match
        let platform = availablePlatforms.find(p => p.id === match.platformId);
        if (!platform && match.platformType) {
          // Fall back to finding any platform of the same type
          platform = availablePlatforms.find(p => p.type === match.platformType);
        }
        
        if (platform) {
          results.push({
            platformId: platform.id, // Use the found platform's ID
            platformName: platform.name,
            entity: {
              ...entity,
              entityId: match.entityId,
              entityData: match.entityData,
              type: match.type,
              platformId: platform.id,
              platformType: match.platformType || platform.type,
              isNonDefaultPlatform: (match.platformType || platform.type) !== 'opencti',
            } as EntityData,
          });
        }
      }
    } else if (entity.found && entity.platformId) {
      // Single-platform entity (no multi-platform matches)
      const platform = availablePlatforms.find(p => p.id === entity.platformId);
      if (platform) {
        results.push({
          platformId: entity.platformId,
          platformName: platform.name,
          entity: {
            ...entity,
            platformId: entity.platformId,
            platformType: entity.platformType || 'opencti',
            isNonDefaultPlatform: entity.platformType !== 'opencti',
          } as EntityData,
        });
      }
    } else if (!entity.found) {
      // Entity not found in any platform - show as "not found" with basic info
      results.push({
        platformId: '',
        platformName: 'Not Found',
        entity: {
          id: entity.id,
          type: entity.type,
          name: entity.name,
          value: entity.value,
          existsInPlatform: false,
        } as EntityData,
      });
    }

    // Update refs and state
    multiPlatformResultsRef.current = results;
    currentPlatformIndexRef.current = 0;
    
    setMultiPlatformResults(results);
    setCurrentPlatformIndex(0);
    // Use explicit type conversion for entity fallback
    const fallbackEntity: EntityData = {
      id: entity.id,
      type: entity.type,
      name: entity.name,
      value: entity.value,
      existsInPlatform: entity.found,
    };
    const initialEntity = results[0]?.entity || fallbackEntity;
    setEntity(initialEntity);
    setEntityFromScanResults(true);
    
    // Set panel mode
    const isFound = results.length > 0 && results[0].entity.existsInPlatform !== false;
    setPanelMode(isFound ? 'entity' : 'not-found');
    
    // If entity was found, fetch full details from the platform
    if (isFound && results[0]) {
      const firstResult = results[0];
      const entityId = (firstResult.entity as any).entityId || (firstResult.entity as any).id;
      const entityType = firstResult.entity.type || entity.type;
      const platformId = firstResult.platformId;
      const platformType = (firstResult.entity as any).platformType || 'opencti';
      
      if (entityId && platformId) {
        try {
          // Set loading state
          setEntityDetailsLoading?.(true);
          
          // Fetch full entity details from platform
          chrome.runtime.sendMessage({
            type: 'GET_ENTITY_DETAILS',
            payload: {
              id: entityId,
              entityType: entityType,
              platformId: platformId,
              platformType: platformType,
            },
          }, (response) => {
            if (chrome.runtime.lastError) {
              log.debug('Entity details fetch error:', chrome.runtime.lastError);
              setEntityDetailsLoading?.(false);
              return;
            }
            
            // Only update if we got a successful response with data
            if (response?.success && response.data) {
              const fullEntityData = response.data;
              
              // Update the entity with full details, preserving platform metadata and type
              // IMPORTANT: entityType and entityData must be preserved for view rendering
              const updatedEntity: EntityData = {
                ...fullEntityData,
                // Preserve the entity type - API response may not include 'type' field
                type: entityType,
                entity_type: entityType.replace('oaev-', ''),
                // Store API response in entityData for views that read from it
                entityData: fullEntityData,
                // Platform metadata
                platformId: platformId,
                platformType: platformType,
                isNonDefaultPlatform: platformType !== 'opencti',
                existsInPlatform: true,
              };
              
              setEntity(updatedEntity);
              
              // Also update the multi-platform results
              const updatedResults = [...results];
              if (updatedResults[0]) {
                updatedResults[0] = {
                  ...updatedResults[0],
                  entity: updatedEntity,
                };
                setMultiPlatformResults(updatedResults);
                multiPlatformResultsRef.current = updatedResults;
              }
              
              // Fetch containers for OpenCTI entities
              if (platformType === 'opencti' && fetchEntityContainers) {
                fetchEntityContainers(entityId, platformId);
              }
              
              log.debug('Entity details fetched successfully for:', entityId);
            } else {
              log.debug('Entity details fetch failed or no data:', response?.error);
            }
            setEntityDetailsLoading?.(false);
          });
        } catch (error) {
          log.debug('Failed to fetch entity details:', error);
          setEntityDetailsLoading?.(false);
        }
      }
    }
  };

  // Handle AI entity discovery
  const handleDiscoverEntitiesWithAI = async () => {
    if (!aiSettings.available) {
      showToast({ type: 'warning', message: 'AI is not configured. Go to Settings → Agentic AI to enable.' });
      return;
    }

    const hasEnterprisePlatform = availablePlatforms.some(p => p.isEnterprise);
    if (!hasEnterprisePlatform) {
      showToast({ type: 'warning', message: 'Requires at least one Enterprise Edition platform' });
      return;
    }

    setAiDiscoveringEntities(true);

    try {
      // Get page content
      let pageContent = scanPageContent;
      let pageTitle = currentPageTitle || '';
      let pageUrl = currentPageUrl || '';

      if (!pageContent && typeof chrome !== 'undefined' && chrome.tabs?.query && chrome.tabs?.sendMessage) {
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab?.id) {
            const contentResponse = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_CONTENT' });
            if (contentResponse?.success) {
              pageContent = contentResponse.data?.content || '';
              pageTitle = contentResponse.data?.title || pageTitle;
              pageUrl = contentResponse.data?.url || tab.url || pageUrl;
            }
          }
        } catch {
          // Silently handle page content retrieval errors
        }
      }

      if (!pageContent) {
        showToast({ type: 'error', message: 'Could not get page content for AI analysis' });
        setAiDiscoveringEntities(false);
        return;
      }

      // Get existing entities for context (use alreadyDetected as expected by handler)
      // Include name, value, aliases, x_mitre_id, and externalId for comprehensive deduplication
      const alreadyDetected = scanResultsEntities.map(e => {
        const entityData = e.entityData as Record<string, unknown> | undefined;
        return {
          type: e.type,
          value: e.value || e.name,
          name: e.name || e.value,
          // Include aliases from entityData if available
          aliases: entityData?.aliases as string[] | undefined 
            || entityData?.x_opencti_aliases as string[] | undefined,
          // Include MITRE ATT&CK ID if available
          externalId: entityData?.x_mitre_id as string | undefined
            || entityData?.external_id as string | undefined
            || (entityData?.externalReferences as Array<{ external_id?: string }> | undefined)?.[0]?.external_id,
        };
      });

      // Call AI discovery
      chrome.runtime.sendMessage(
        {
          type: 'AI_DISCOVER_ENTITIES',
          payload: {
            pageTitle,
            pageUrl,
            pageContent,
            alreadyDetected,
          },
        },
        (response) => {
          setAiDiscoveringEntities(false);

          if (chrome.runtime.lastError) {
            log.error('AI discovery error:', chrome.runtime.lastError);
            showToast({ type: 'error', message: 'AI discovery failed' });
            return;
          }

          if (response?.success && response.data?.entities) {
            const newEntities: ScanResultEntity[] = response.data.entities.map((e: { type: string; value: string; reason?: string; confidence?: string }, i: number) => ({
              id: `ai-${Date.now()}-${i}`,
              type: e.type,
              name: e.value,
              value: e.value,
              found: false,
              discoveredByAI: true,
              aiReason: e.reason,
              aiConfidence: e.confidence as 'high' | 'medium' | 'low' | undefined,
            }));

            if (newEntities.length > 0) {
              // Try to highlight AI-discovered entities and only add those that can be highlighted
              (async () => {
                try {
                  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                  if (tab?.id) {
                    chrome.tabs.sendMessage(
                      tab.id, 
                      {
                        type: 'XTM_HIGHLIGHT_AI_ENTITIES',
                        payload: {
                          entities: newEntities.map(e => ({
                            type: e.type,
                            value: e.value,
                            name: e.name,
                          })),
                        },
                      },
                      (highlightResponse) => {
                        // Filter to only include entities that were successfully highlighted
                        const highlightedValues = new Set(
                          (highlightResponse?.highlightedEntities || []).map((e: { value: string; name: string }) => e.value || e.name)
                        );
                        
                        const visibleEntities = newEntities.filter(e => 
                          highlightedValues.has(e.value || e.name)
                        );
                        
                        if (visibleEntities.length > 0) {
                          setScanResultsEntities((prev: ScanResultEntity[]) => [...prev, ...visibleEntities]);
                          // Send AI entities to content script to persist in lastScanData
                          window.parent.postMessage({
                            type: 'XTM_ADD_AI_ENTITIES',
                            payload: {
                              entities: visibleEntities.map(e => ({
                                id: e.id,
                                type: e.type,
                                name: e.name,
                                value: e.value,
                                aiReason: e.aiReason,
                                aiConfidence: e.aiConfidence,
                              })),
                            },
                          }, '*');
                          showToast({ 
                            type: 'success', 
                            message: `AI discovered ${visibleEntities.length} additional entit${visibleEntities.length === 1 ? 'y' : 'ies'}${
                              newEntities.length > visibleEntities.length 
                                ? ` (${newEntities.length - visibleEntities.length} not visible on page)` 
                                : ''
                            }` 
                          });
                        } else if (newEntities.length > 0) {
                          // AI found entities but none could be highlighted
                          showToast({ type: 'info', message: `AI found ${newEntities.length} entities but none are visible on the page` });
                        } else {
                          showToast({ type: 'info', message: 'AI found no additional entities' });
                        }
                      }
                    );
                  } else {
                    // No tab - add all entities (can't verify highlighting)
                    setScanResultsEntities((prev: ScanResultEntity[]) => [...prev, ...newEntities]);
                    // Send AI entities to content script to persist in lastScanData
                    window.parent.postMessage({
                      type: 'XTM_ADD_AI_ENTITIES',
                      payload: {
                        entities: newEntities.map(e => ({
                          id: e.id,
                          type: e.type,
                          name: e.name,
                          value: e.value,
                          aiReason: e.aiReason,
                          aiConfidence: e.aiConfidence,
                        })),
                      },
                    }, '*');
                    showToast({ type: 'success', message: `AI discovered ${newEntities.length} additional entit${newEntities.length === 1 ? 'y' : 'ies'}` });
                  }
                } catch {
                  // On error, add all entities (fallback)
                  setScanResultsEntities((prev: ScanResultEntity[]) => [...prev, ...newEntities]);
                  // Send AI entities to content script to persist in lastScanData
                  window.parent.postMessage({
                    type: 'XTM_ADD_AI_ENTITIES',
                    payload: {
                      entities: newEntities.map(e => ({
                        id: e.id,
                        type: e.type,
                        name: e.name,
                        value: e.value,
                        aiReason: e.aiReason,
                        aiConfidence: e.aiConfidence,
                      })),
                    },
                  }, '*');
                  showToast({ type: 'success', message: `AI discovered ${newEntities.length} additional entit${newEntities.length === 1 ? 'y' : 'ies'}` });
                }
              })();
            } else {
              showToast({ type: 'info', message: 'AI found no additional entities' });
            }
          } else {
            log.warn('AI discovery failed:', response?.error);
            showToast({ type: 'error', message: response?.error || 'AI discovery failed' });
          }
        }
      );
    } catch (error) {
      log.error('AI discovery error:', error);
      showToast({ type: 'error', message: 'AI discovery error' });
      setAiDiscoveringEntities(false);
    }
  };

  // Handle import of selected scan results
  const handleImportSelectedScanResults = async () => {
    // Get selected entities (filter by selection set)
    const selectedEntities = filteredScanResultsEntities.filter(e => {
      const entityValue = e.value || e.name;
      return selectedScanItems.has(entityValue);
    });

    if (selectedEntities.length === 0) {
      showToast({ type: 'warning', message: 'No entities selected for import' });
      return;
    }

    // Convert to EntityData format for container creation
    const entitiesToImport: EntityData[] = selectedEntities.map(e => {
      // For entities found in OpenCTI (the default platform), get the OpenCTI entity ID
      const octiMatch = e.platformMatches?.find(pm => pm.platformType === 'opencti');
      const octiEntityId = octiMatch?.entityId || (isDefaultPlatform(e.platformType as 'opencti' | 'openaev' | 'opengrc') ? e.entityId : undefined);
      
      return {
        type: e.type,
        name: e.name,
        value: e.value,
        existsInPlatform: isFoundInOpenCTI(e),
        id: octiEntityId,
        octiEntityId: octiEntityId,
      } as EntityData;
    });

    // Get page content for container form
    let pageTitle = currentPageTitle || document.title;
    let pageUrl = currentPageUrl || '';
    let pageContent = '';
    let pageHtmlContent = '';

    if (typeof chrome !== 'undefined' && chrome.tabs?.query && chrome.tabs?.sendMessage) {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          const contentResponse = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_CONTENT' });
          if (contentResponse?.success) {
            pageContent = contentResponse.data?.content || '';
            pageHtmlContent = contentResponse.data?.htmlContent || pageContent;
            pageTitle = contentResponse.data?.title || pageTitle;
            pageUrl = contentResponse.data?.url || pageUrl;
          }
        }
      } catch {
        // Silently handle page content retrieval errors
      }
    }

    // Generate description from page content
    const description = pageContent ? generateDescription(pageContent) : '';

    // Set container form with page info
    setContainerForm({
      name: pageTitle,
      description: description,
      content: pageHtmlContent ? cleanHtmlContent(pageHtmlContent) : '',
    });

    // Set entities and go to preview view
    setEntitiesToAdd(entitiesToImport);
    setCurrentPageUrl(pageUrl);
    setCurrentPageTitle(pageTitle);
    setPanelMode('preview');
  };

  const aiColors = getAiColor(mode);

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Back to actions button */}
      <Box sx={{ mb: 1.5 }}>
        <Button
          size="small"
          startIcon={<ChevronLeftOutlined />}
          onClick={() => setPanelMode('empty')}
          sx={{ 
            color: 'text.secondary',
            textTransform: 'none',
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          Back to actions
        </Button>
      </Box>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <TravelExploreOutlined sx={{ color: 'primary.main' }} />
        <Typography variant="h6" sx={{ fontWeight: 600, flex: 1 }}>
          Scan Results
        </Typography>
      </Box>

      {/* Stats - Clickable for filtering */}
      {scanResultsEntities.length > 0 && (
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
            {/* AI Findings filter - only show if there are AI discoveries */}
            {scanResultsAICount > 0 && (
              <>
                <Divider orientation="vertical" flexItem />
                <Box
                  onClick={() => setScanResultsFoundFilter(scanResultsFoundFilter === 'ai-discovered' ? 'all' : 'ai-discovered')}
                  sx={{
                    flex: 1,
                    textAlign: 'center',
                    p: 1.5,
                    cursor: 'pointer',
                    bgcolor: scanResultsFoundFilter === 'ai-discovered' ? aiColors.main : 'action.hover',
                    color: scanResultsFoundFilter === 'ai-discovered' ? 'white' : 'inherit',
                    transition: 'all 0.15s',
                    '&:hover': {
                      bgcolor: scanResultsFoundFilter === 'ai-discovered' ? aiColors.dark : 'action.selected',
                    },
                  }}
                >
                  <Typography variant="h5" sx={{ fontWeight: 700, color: scanResultsFoundFilter === 'ai-discovered' ? 'inherit' : aiColors.main }}>
                    {scanResultsAICount}
                  </Typography>
                  <Typography variant="caption" sx={{ color: scanResultsFoundFilter === 'ai-discovered' ? 'inherit' : 'text.secondary', opacity: scanResultsFoundFilter === 'ai-discovered' ? 0.9 : 1 }}>
                    AI Findings
                  </Typography>
                </Box>
              </>
            )}
          </Box>
      )}

      {/* Search and Type filter */}
          <Box sx={{ display: 'flex', gap: 1.5, mb: 2, alignItems: 'flex-end' }}>
            {/* Search field */}
            <TextField
              size="small"
              placeholder="Search findings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{ flex: 1 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchOutlined sx={{ fontSize: 18, color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
            />
            {/* Type filter */}
            {scanResultsEntityTypes.length > 1 && (
              <FormControl size="small" sx={{ flex: 1 }}>
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
            )}
          </Box>

          {/* Discover more with AI button */}
          {(() => {
            const hasEnterprisePlatform = availablePlatforms.some(p => p.isEnterprise);
            const isAiButtonDisabled = aiDiscoveringEntities || !aiSettings.available || !hasEnterprisePlatform;

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
                      startIcon={aiDiscoveringEntities ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeOutlined />}
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

          {/* Select All / Deselect All for entities selectable for OpenCTI */}
          {(() => {
            const selectableEntities = filteredScanResultsEntities.filter(e => isSelectableForOpenCTI(e));
            const selectableValues = selectableEntities.map(e => e.value || e.name);
            const selectedCount = selectableValues.filter(v => selectedScanItems.has(v)).length;
            const allSelected = selectedCount === selectableEntities.length && selectableEntities.length > 0;

            const selectedNewCount = selectableEntities.filter(e => {
              const entityValue = e.value || e.name;
              return selectedScanItems.has(entityValue) && !isFoundInOpenCTI(e);
            }).length;

            if (selectableEntities.length === 0) return null;

            return (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, gap: 1 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', flex: 1, minWidth: 0 }}>
                  {selectedCount > 0
                    ? `${selectedCount} sel.${selectedNewCount > 0 ? ` (${selectedNewCount} new)` : ''}`
                    : `${selectableEntities.length} available`
                  }
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexShrink: 0, alignItems: 'center' }}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      if (allSelected) {
                        window.parent.postMessage({ type: 'XTM_DESELECT_ALL' }, '*');
                        setSelectedScanItems(new Set());
                      } else {
                        window.parent.postMessage({ type: 'XTM_SELECT_ALL', values: selectableValues }, '*');
                        setSelectedScanItems(new Set(selectableValues));
                      }
                    }}
                    startIcon={allSelected ? <CheckBoxOutlined /> : <CheckBoxOutlineBlankOutlined />}
                    sx={{
                      textTransform: 'none',
                      fontSize: '0.75rem',
                      py: 0.25,
                      minWidth: 'auto',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {allSelected ? 'Deselect all' : 'Select all'}
                  </Button>
                  {selectedCount > 0 && (
                    <Button
                      size="small"
                      variant="contained"
                      onClick={handleImportSelectedScanResults}
                      startIcon={<ArrowForwardOutlined />}
                      sx={{
                        textTransform: 'none',
                        fontSize: '0.75rem',
                        py: 0.25,
                        minWidth: 'auto',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Import ({selectedCount})
                    </Button>
                  )}
                </Box>
              </Box>
            );
          })()}

      {/* Entity list */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {filteredScanResultsEntities.length === 0 ? (
          <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            minHeight: 150,
            color: 'text.secondary',
          }}>
            <SearchOutlined sx={{ fontSize: 40, mb: 1.5, opacity: 0.5 }} />
            <Typography variant="body2">
              {scanResultsEntities.length === 0 
                ? 'No entities detected on this page' 
                : 'No results match your filters'}
            </Typography>
            <Typography variant="caption" sx={{ mt: 0.5, opacity: 0.7 }}>
              {scanResultsEntities.length === 0 
                ? 'Try using AI discovery above' 
                : 'Adjust your search or filters'}
            </Typography>
          </Box>
        ) : (
          filteredScanResultsEntities.map((entity, index) => {
              const entityColor = entity.discoveredByAI ? aiColors.main : itemColor(entity.type, mode === 'dark');
              const { types: uniqueTypes, hasMultipleTypes } = getUniqueTypesFromMatches(entity);
              const primaryType = uniqueTypes[0] || entity.type;
              const displayType = formatTypeName(primaryType);

              const octiCount = entity.platformMatches?.filter(pm => pm.platformType === 'opencti').length || 0;
              const oaevCount = entity.platformMatches?.filter(pm => pm.platformType === 'openaev').length || 0;

              const entityValue = entity.value || entity.name;
              const isSelected = selectedScanItems.has(entityValue);

              const borderColor = entity.discoveredByAI
                ? aiColors.main
                : (entity.found ? 'success.main' : 'warning.main');

              // Build tooltip content for multi-type entities
              const multiTypeTooltip = hasMultipleTypes
                ? `Multiple types: ${uniqueTypes.map(t => formatTypeName(t)).join(', ')}`
                : '';

              return (
                <Paper
                  key={entity.id + '-' + index}
                  elevation={0}
                  onClick={() => handleScanResultEntityClick(entity)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    p: 1,
                    mb: 0.75,
                    bgcolor: isSelected
                      ? hexToRGB('#1976d2', 0.08)
                      : (entity.discoveredByAI ? hexToRGB(aiColors.main, 0.05) : 'background.paper'),
                    border: 1,
                    borderColor: isSelected ? 'primary.main' : borderColor,
                    borderRadius: 1,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    borderLeftWidth: 3,
                    '&:hover': {
                      bgcolor: isSelected
                        ? hexToRGB('#1976d2', 0.12)
                        : (entity.discoveredByAI ? hexToRGB(aiColors.main, 0.1) : 'action.hover'),
                      boxShadow: 1,
                    },
                  }}
                >
                  {/* Checkbox for entities selectable for OpenCTI */}
                  {isSelectableForOpenCTI(entity) && (
                    <Checkbox
                      checked={isSelected}
                      onClick={(e) => {
                        e.stopPropagation();
                        window.parent.postMessage({ type: 'XTM_TOGGLE_SELECTION', value: entityValue }, '*');
                        const next = new Set(selectedScanItems);
                        if (next.has(entityValue)) {
                          next.delete(entityValue);
                        } else {
                          next.add(entityValue);
                        }
                        setSelectedScanItems(next);
                      }}
                      size="small"
                      sx={{
                        p: 0.25,
                        '&.Mui-checked': { color: entity.discoveredByAI ? aiColors.main : (isFoundInOpenCTI(entity) ? 'success.main' : 'primary.main') },
                      }}
                    />
                  )}
                  {/* Entity icon - show stacked icon for multi-type */}
                  {hasMultipleTypes ? (
                    <Tooltip title={multiTypeTooltip} placement="top">
                      <Box sx={{ position: 'relative', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ItemIcon type={primaryType} size="small" color={entityColor} />
                        <LayersOutlined 
                          sx={{ 
                            position: 'absolute', 
                            bottom: -2, 
                            right: -4, 
                            fontSize: 12, 
                            color: 'primary.main',
                            bgcolor: 'background.paper',
                            borderRadius: '50%',
                          }} 
                        />
                      </Box>
                    </Tooltip>
                  ) : (
                    <ItemIcon type={entity.type} size="small" color={entityColor} />
                  )}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: 'break-word', fontSize: '0.85rem' }}>
                      {entity.name || entity.value}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap', mt: 0.25 }}>
                      {/* Type display - compact for multi-type */}
                      {hasMultipleTypes ? (
                        <Tooltip title={multiTypeTooltip} placement="top">
                          <Chip
                            icon={<LayersOutlined sx={{ fontSize: '0.65rem !important' }} />}
                            label={`${uniqueTypes.length} types`}
                            size="small"
                            color="primary"
                            sx={{
                              height: 16,
                              fontSize: '0.6rem',
                              '& .MuiChip-label': { px: 0.5 },
                              '& .MuiChip-icon': { ml: 0.5, mr: -0.25 },
                            }}
                          />
                        </Tooltip>
                      ) : (
                        <Typography variant="caption" sx={{ color: entity.discoveredByAI ? aiColors.main : 'text.secondary', fontSize: '0.7rem' }}>
                          {displayType}
                        </Typography>
                      )}
                      {/* Show AI indicator for AI-discovered entities */}
                      {entity.discoveredByAI && (
                        <Tooltip title={entity.aiReason || 'Detected by AI analysis'} placement="top">
                          <Chip
                            icon={<AutoAwesomeOutlined sx={{ fontSize: '0.65rem !important' }} />}
                            label="AI"
                            size="small"
                            sx={{
                              height: 16,
                              fontSize: '0.6rem',
                              bgcolor: hexToRGB(aiColors.main, 0.2),
                              color: aiColors.main,
                              '& .MuiChip-label': { px: 0.4 },
                              '& .MuiChip-icon': { ml: 0.4, mr: -0.25 },
                            }}
                          />
                        </Tooltip>
                      )}
                      {/* Show compact platform badges */}
                      {!entity.discoveredByAI && (octiCount > 0 || oaevCount > 0) && (
                        <>
                          {octiCount > 0 && (
                            <Chip
                              label={octiCount > 1 ? `OCTI (${octiCount})` : 'OCTI'}
                              size="small"
                              sx={{
                                height: 16,
                                fontSize: '0.6rem',
                                bgcolor: hexToRGB('#5c6bc0', 0.15),
                                color: '#5c6bc0',
                                fontWeight: octiCount > 1 ? 600 : 400,
                                '& .MuiChip-label': { px: 0.5 },
                              }}
                            />
                          )}
                          {oaevCount > 0 && (
                            <Chip
                              label={oaevCount > 1 ? `OAEV (${oaevCount})` : 'OAEV'}
                              size="small"
                              sx={{
                                height: 16,
                                fontSize: '0.6rem',
                                bgcolor: hexToRGB('#e91e63', 0.15),
                                color: '#e91e63',
                                fontWeight: oaevCount > 1 ? 600 : 400,
                                '& .MuiChip-label': { px: 0.5 },
                              }}
                            />
                          )}
                        </>
                      )}
                    </Box>
                  </Box>
                  {/* Status chip with matched strings tooltip */}
                  {(() => {
                    const hasMatchedStrings = entity.matchedStrings && entity.matchedStrings.length > 0;
                    const matchedStringsTooltip = hasMatchedStrings ? (
                      <Box sx={{ p: 0.5 }}>
                        <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                          Matched in page:
                        </Typography>
                        {entity.matchedStrings!.map((str, idx) => (
                          <Box 
                            key={idx} 
                            sx={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: 0.5,
                              py: 0.25,
                              '&:not(:last-child)': { borderBottom: '1px solid', borderColor: 'divider' },
                            }}
                          >
                            <Box 
                              sx={{ 
                                width: 6, 
                                height: 6, 
                                borderRadius: '50%', 
                                bgcolor: entity.found ? 'success.main' : 'warning.main',
                                flexShrink: 0,
                              }} 
                            />
                            <Typography 
                              variant="caption" 
                              sx={{ 
                                fontFamily: 'monospace',
                                wordBreak: 'break-word',
                              }}
                            >
                              "{str}"
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    ) : (entity.found ? 'Entity found in platform' : (entity.discoveredByAI ? 'Discovered by AI' : 'New entity not in platform'));

                    return (
                      <Tooltip 
                        title={matchedStringsTooltip} 
                        placement="left"
                        arrow
                        slotProps={{
                          tooltip: {
                            sx: {
                              bgcolor: 'background.paper',
                              color: 'text.primary',
                              boxShadow: 3,
                              border: '1px solid',
                              borderColor: 'divider',
                              maxWidth: 280,
                              '& .MuiTooltip-arrow': {
                                color: 'background.paper',
                                '&::before': {
                                  border: '1px solid',
                                  borderColor: 'divider',
                                },
                              },
                            },
                          },
                        }}
                      >
                        <Chip
                          icon={hasMatchedStrings ? <InfoOutlined sx={{ fontSize: '0.85rem !important' }} /> : undefined}
                          label={entity.found ? 'Found' : (entity.discoveredByAI ? 'AI' : 'New')}
                          size="small"
                          variant="outlined"
                          sx={{
                            minWidth: hasMatchedStrings ? 65 : 50,
                            cursor: 'help',
                            borderColor: entity.discoveredByAI ? aiColors.main : undefined,
                            color: entity.discoveredByAI ? aiColors.main : undefined,
                            '& .MuiChip-icon': { 
                              ml: 0.5, 
                              mr: -0.25,
                              color: 'inherit',
                            },
                          }}
                          color={entity.found ? 'success' : (entity.discoveredByAI ? undefined : 'warning')}
                        />
                      </Tooltip>
                    );
                  })()}
                  {/* Scroll to highlight button */}
                  <Tooltip title="Scroll to highlight on page" placement="top">
                    <Box
                      onClick={(e) => {
                        e.stopPropagation();
                        // Include both the resolved name/value AND the original matched strings
                        // This ensures we can find the highlight even when entity name differs from highlighted text
                        const primaryValue = entity.value || entity.name;
                        const allValues = entity.matchedStrings 
                          ? [primaryValue, ...entity.matchedStrings.filter(s => s.toLowerCase() !== primaryValue.toLowerCase())]
                          : [primaryValue];
                        sendToContentScript({ 
                          type: 'XTM_SCROLL_TO_HIGHLIGHT', 
                          payload: { value: allValues } 
                        });
                      }}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        '&:hover': {
                          bgcolor: 'action.hover',
                        },
                      }}
                    >
                      <GpsFixedOutlined sx={{ color: 'text.secondary', fontSize: 16 }} />
                    </Box>
                  </Tooltip>
                  <ChevronRightOutlined sx={{ color: 'text.secondary', fontSize: 18 }} />
                </Paper>
              );
            })
        )}
      </Box>
    </Box>
  );
};

export default CommonScanResultsView;

