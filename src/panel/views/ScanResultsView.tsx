/**
 * Scan Results View Component
 * 
 * Displays scan results with filtering, selection, and import functionality.
 */

import React, { useMemo } from 'react';
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
} from '@mui/material';
import {
  TravelExploreOutlined,
  SearchOutlined,
  ChevronRightOutlined,
  ArrowForwardOutlined,
  AutoAwesomeOutlined,
  CheckBoxOutlined,
  CheckBoxOutlineBlankOutlined,
} from '@mui/icons-material';
import ItemIcon from '../../shared/components/ItemIcon';
import { itemColor, hexToRGB } from '../../shared/theme/colors';
import { THEME_DARK_AI } from '../../shared/theme/ThemeDark';
import { THEME_LIGHT_AI } from '../../shared/theme/ThemeLight';
import type { ScanResultsViewProps } from '../types/view-props';
import type { ScanResultEntity, EntityData, MultiPlatformResult } from '../types';
import { loggers } from '../../shared/utils/logger';
import { generateDescription, cleanHtmlContent } from '../utils/description-helpers';

const log = loggers.panel;

// Helper function to get AI colors based on theme mode
const getAiColor = (mode: 'dark' | 'light') => {
  return mode === 'dark' ? THEME_DARK_AI : THEME_LIGHT_AI;
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
    // Legacy single-platform check
    return entity.platformType === 'opencti' || !entity.platformType;
  }
  return false;
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
}

export const ScanResultsView: React.FC<ExtendedScanResultsViewProps> = ({
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
}) => {
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
    
    return filtered;
  }, [scanResultsEntities, scanResultsFoundFilter, scanResultsTypeFilter]);

  // Handle entity click - navigate to entity view
  const handleScanResultEntityClick = async (entity: ScanResultEntity) => {
    log.debug('[SCAN-CLICK] Entity clicked:', entity.name, entity.type, entity.found);
    
    // Build multi-platform results from platformMatches
    const results: MultiPlatformResult[] = [];
    
    if (entity.platformMatches && entity.platformMatches.length > 0) {
      // Use platformMatches for multi-platform support
      for (const match of entity.platformMatches) {
        const platform = availablePlatforms.find(p => p.id === match.platformId);
        if (platform) {
          results.push({
            platformId: match.platformId,
            platformName: platform.name,
            entity: {
              ...entity,
              entityId: match.entityId,
              entityData: match.entityData,
              type: match.type,
              _platformId: match.platformId,
              _platformType: match.platformType,
              _isNonDefaultPlatform: match.platformType !== 'opencti',
            } as EntityData,
          });
        }
      }
    } else if (entity.found && entity.platformId) {
      // Legacy single-platform entity
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
    setEntity(results[0]?.entity || fallbackEntity);
    setEntityFromScanResults(true);
    setPanelMode(results.length > 0 && results[0].entity.existsInPlatform !== false ? 'entity' : 'not-found');
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
        } catch (error) {
          log.debug('Could not get page content for AI discovery:', error);
        }
      }

      if (!pageContent) {
        showToast({ type: 'error', message: 'Could not get page content for AI analysis' });
        setAiDiscoveringEntities(false);
        return;
      }

      // Get existing entities for context
      const existingEntities = scanResultsEntities.map(e => ({
        type: e.type,
        value: e.value || e.name,
      }));

      // Call AI discovery
      chrome.runtime.sendMessage(
        {
          type: 'AI_DISCOVER_ENTITIES',
          payload: {
            pageTitle,
            pageUrl,
            pageContent,
            existingEntities,
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
      // For entities found in OpenCTI, get the OpenCTI entity ID
      const octiMatch = e.platformMatches?.find(pm => pm.platformType === 'opencti');
      const octiEntityId = octiMatch?.entityId || (e.platformType === 'opencti' ? e.entityId : undefined);
      
      return {
        type: e.type,
        name: e.name,
        value: e.value,
        existsInPlatform: isFoundInOpenCTI(e),
        id: octiEntityId,
        octiEntityId: octiEntityId,
      } as EntityData;
    });

    log.debug('Importing selected scan results:', entitiesToImport.length, 'entities');

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
      } catch (error) {
        log.debug('Could not get page content for container form:', error);
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
              const displayType = entity.type.replace('oaev-', '');

              const octiCount = entity.platformMatches?.filter(pm => pm.platformType === 'opencti').length || 0;
              const oaevCount = entity.platformMatches?.filter(pm => pm.platformType === 'openaev').length || 0;
              const hasMultiplePlatforms = (entity.platformMatches?.length || 0) > 1;

              const entityValue = entity.value || entity.name;
              const isSelected = selectedScanItems.has(entityValue);

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
                        p: 0.5,
                        mr: 0.5,
                        '&.Mui-checked': { color: entity.discoveredByAI ? aiColors.main : (isFoundInOpenCTI(entity) ? 'success.main' : 'primary.main') },
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

export default ScanResultsView;

