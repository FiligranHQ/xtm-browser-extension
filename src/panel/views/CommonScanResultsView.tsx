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
  ArrowForwardOutlined,
  AutoAwesomeOutlined,
  CheckBoxOutlined,
  CheckBoxOutlineBlankOutlined,
  LayersOutlined,
} from '@mui/icons-material';
import ItemIcon from '../../shared/components/ItemIcon';
import { itemColor, hexToRGB } from '../../shared/theme/colors';
import type { ScanResultsViewProps } from '../types/view-props';
import type { ScanResultEntity, EntityData, MultiPlatformResult } from '../types';
import { loggers } from '../../shared/utils/logger';
import { generateDescription, cleanHtmlContent, getAiColor } from '../utils';
import { isDefaultPlatform, getCanonicalTypeName, getUniqueCanonicalTypes } from '../../shared/platform/registry';

const log = loggers.panel;

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
              _platformId: platform.id,
              _platformType: match.platformType || platform.type,
              _isNonDefaultPlatform: (match.platformType || platform.type) !== 'opencti',
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
            _platformId: entity.platformId,
            _platformType: entity.platformType || 'opencti',
            _isNonDefaultPlatform: entity.platformType !== 'opencti',
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
      const platformType = (firstResult.entity as any)._platformType || 'opencti';
      
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
              
              // Update the entity with full details, preserving platform metadata
              const updatedEntity: EntityData = {
                ...fullEntityData,
                _platformId: platformId,
                _platformType: platformType,
                _isNonDefaultPlatform: platformType !== 'opencti',
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
              setScanResultsEntities((prev: ScanResultEntity[]) => [...prev, ...newEntities]);
              showToast({ type: 'success', message: `AI discovered ${newEntities.length} additional entit${newEntities.length === 1 ? 'y' : 'ies'}` });
              
              // Highlight AI-discovered entities on the page
              (async () => {
                try {
                  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                  if (tab?.id) {
                    chrome.tabs.sendMessage(tab.id, {
                      type: 'XTM_HIGHLIGHT_AI_ENTITIES',
                      payload: {
                        entities: newEntities.map(e => ({
                          type: e.type,
                          value: e.value,
                          name: e.name,
                        })),
                      },
                    });
                  }
                } catch {
                  // Silently handle highlighting errors
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
            const selectedExistingCount = selectedCount - selectedNewCount;

            if (selectableEntities.length === 0) return null;

            return (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {selectedCount > 0
                    ? `${selectedCount} selected (${selectedNewCount} new, ${selectedExistingCount} existing)`
                    : `${selectableEntities.length} entities available for selection`
                  }
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
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
            {filteredScanResultsEntities.map((entity, index) => {
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
                  {/* Status chip */}
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

export default CommonScanResultsView;

