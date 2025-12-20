/**
 * Preview View Component
 *
 * Displays selected entities for import with options for AI relationships and container creation.
 */

import React, { useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Chip,
  IconButton,
  FormControlLabel,
  Switch,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  ChevronLeftOutlined,
  ArrowForwardOutlined,
  DeleteOutlined,
  DescriptionOutlined,
  AutoAwesomeOutlined,
} from '@mui/icons-material';
import ItemIcon from '../../shared/components/ItemIcon';
import { hexToRGB, itemColor } from '../../shared/theme/colors';
import { getAiColor } from '../utils/platform-helpers';
import { loggers } from '../../shared/utils/logger';
import type { PanelMode, EntityData, PlatformInfo, ContainerData, ResolvedRelationship, AISettings } from '../types/panel-types';

const log = loggers.panel;

export interface PreviewViewProps {
  mode: 'dark' | 'light';
  setPanelMode: (mode: PanelMode) => void;
  entitiesToAdd: EntityData[];
  setEntitiesToAdd: (entities: EntityData[] | ((prev: EntityData[]) => EntityData[])) => void;
  setSelectedScanItems: (items: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  createIndicators: boolean;
  setCreateIndicators: (value: boolean) => void;
  resolvedRelationships: ResolvedRelationship[];
  setResolvedRelationships: (rels: ResolvedRelationship[] | ((prev: ResolvedRelationship[]) => ResolvedRelationship[])) => void;
  aiSettings: AISettings;
  aiResolvingRelationships: boolean;
  setAiResolvingRelationships: (value: boolean) => void;
  availablePlatforms: PlatformInfo[];
  openctiPlatforms: PlatformInfo[];
  selectedPlatformId: string;
  setSelectedPlatformId: (id: string) => void;
  setPlatformUrl: (url: string) => void;
  setContainerWorkflowOrigin: (origin: 'preview' | 'direct' | 'import' | null) => void;
  setExistingContainers: (containers: ContainerData[]) => void;
  setCheckingExisting: (value: boolean) => void;
  currentPageUrl: string;
  currentPageTitle: string;
  scanPageContent: string;
  showToast: (options: {
    type: 'success' | 'info' | 'warning' | 'error';
    message: string;
    action?: { label: string; type: 'scroll_to_first' | 'close_panel' | 'custom' };
    persistent?: boolean;
    duration?: number;
  }) => void;
  handleAddEntities: () => void;
  submitting: boolean;
}

export const CommonPreviewView: React.FC<PreviewViewProps> = ({
  mode,
  setPanelMode,
  entitiesToAdd,
  setEntitiesToAdd,
  setSelectedScanItems,
  createIndicators,
  setCreateIndicators,
  resolvedRelationships,
  setResolvedRelationships,
  aiSettings,
  aiResolvingRelationships,
  setAiResolvingRelationships,
  availablePlatforms,
  openctiPlatforms,
  setSelectedPlatformId,
  setPlatformUrl,
  setContainerWorkflowOrigin,
  setExistingContainers,
  setCheckingExisting,
  currentPageUrl,
  currentPageTitle,
  scanPageContent,
  showToast,
  handleAddEntities,
  submitting,
}) => {
  // Check for Enterprise Edition platform (OpenCTI or OpenAEV)
  const hasEnterprisePlatform = availablePlatforms.some(p => p.isEnterprise);

  // Send relationship lines to content script when relationships change
  useEffect(() => {
    const sendRelationshipLines = async () => {
      if (resolvedRelationships.length > 0) {
        const relationshipData = resolvedRelationships.map(rel => ({
          fromValue: rel.fromEntityValue || '',
          toValue: rel.toEntityValue || '',
          relationshipType: rel.relationshipType,
          confidence: rel.confidence,
        })).filter(r => r.fromValue && r.toValue);

        // Send via postMessage for iframe mode
        window.parent.postMessage({
          type: 'XTM_DRAW_RELATIONSHIP_LINES',
          payload: { relationships: relationshipData },
        }, '*');

        // Send via chrome.tabs for split screen mode
        if (typeof chrome !== 'undefined' && chrome.tabs?.query && chrome.tabs?.sendMessage) {
          try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab?.id) {
              chrome.tabs.sendMessage(tab.id, {
                type: 'DRAW_RELATIONSHIP_LINES',
                payload: { relationships: relationshipData },
              }).catch(() => {});
            }
          } catch {
            // Silently handle errors
          }
        }
      } else {
        // Clear relationship lines
        window.parent.postMessage({ type: 'XTM_CLEAR_RELATIONSHIP_LINES' }, '*');
        if (typeof chrome !== 'undefined' && chrome.tabs?.query && chrome.tabs?.sendMessage) {
          try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab?.id) {
              chrome.tabs.sendMessage(tab.id, { type: 'CLEAR_RELATIONSHIP_LINES' }).catch(() => {});
            }
          } catch {
            // Silently handle errors
          }
        }
      }
    };

    sendRelationshipLines();
  }, [resolvedRelationships]);

  const handleRemoveEntity = (index: number, entity: EntityData) => {
    // Remove entity from the list
    const newEntities = entitiesToAdd.filter((_, idx) => idx !== index);
    setEntitiesToAdd(newEntities);

    // Also update selection on page highlight
    const entityValue = entity.value || entity.name;
    if (entityValue) {
      window.parent.postMessage({ type: 'XTM_DESELECT_ITEM', value: entityValue }, '*');
      setSelectedScanItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(entityValue);
        return newSet;
      });
    }

    // If no entities left, go back to scan results
    if (newEntities.length === 0) {
      setPanelMode('scan-results');
    }
  };

  const handleResolveRelationships = async () => {
    if (!aiSettings.available) return;

    setAiResolvingRelationships(true);

    try {
      // Get page content for AI analysis
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
        log.error('No page content available for AI relationship resolution');
        setAiResolvingRelationships(false);
        return;
      }

      // Build entities array for AI
      const entities = entitiesToAdd.map(e => ({
        type: e.type,
        name: e.name || e.value || '',
        value: e.value,
        existsInPlatform: e.existsInPlatform || false,
        octiEntityId: (e as any).octiEntityId,
      }));

      // Call AI to resolve relationships
      chrome.runtime.sendMessage(
        {
          type: 'AI_RESOLVE_RELATIONSHIPS',
          payload: {
            pageTitle,
            pageUrl,
            pageContent,
            entities,
          },
        },
        (response) => {
          setAiResolvingRelationships(false);

          if (chrome.runtime.lastError) {
            log.error('AI relationship resolution error:', chrome.runtime.lastError);
            return;
          }

          if (response?.success && response.data?.relationships) {
            // Convert indices to entity values for reliable lookup
            const relationshipsWithValues = response.data.relationships.map((rel: ResolvedRelationship) => ({
              ...rel,
              fromEntityValue: entitiesToAdd[rel.fromIndex]?.value || entitiesToAdd[rel.fromIndex]?.name,
              toEntityValue: entitiesToAdd[rel.toIndex]?.value || entitiesToAdd[rel.toIndex]?.name,
            }));
            setResolvedRelationships(relationshipsWithValues);
            log.info(`AI resolved ${relationshipsWithValues.length} relationships`);
            if (relationshipsWithValues.length > 0) {
              showToast({ type: 'success', message: `AI found ${relationshipsWithValues.length} relationship${relationshipsWithValues.length === 1 ? '' : 's'}` });
            } else {
              showToast({ type: 'info', message: 'AI found no relationships' });
            }
          } else {
            log.warn('AI relationship resolution failed:', response?.error);
            showToast({ type: 'error', message: 'AI relationship resolution failed' });
          }
        }
      );
    } catch (error) {
      log.error('AI relationship resolution error:', error);
      showToast({ type: 'error', message: 'AI relationship resolution error' });
      setAiResolvingRelationships(false);
    }
  };

  const handleCreateContainer = async () => {
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
            if (openctiPlatforms.length > 1) {
              setPanelMode('platform-select');
            } else {
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
            if (openctiPlatforms.length > 1) {
              setPanelMode('platform-select');
            } else {
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
      if (openctiPlatforms.length > 1) {
        setPanelMode('platform-select');
      } else {
        if (openctiPlatforms.length === 1) {
          setSelectedPlatformId(openctiPlatforms[0].id);
          setPlatformUrl(openctiPlatforms[0].url);
        }
        setPanelMode('container-type');
      }
    }
  };

  const handleImportWithoutContainer = () => {
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
  };

  return (
    <Box sx={{ p: 2 }}>
      {/* Back to scan results button */}
      <Box sx={{ mb: 1.5 }}>
        <Button
          size="small"
          startIcon={<ChevronLeftOutlined />}
          onClick={() => {
            setPanelMode('scan-results');
            // Keep resolved relationships when going back so they're preserved
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
            <IconButton
              size="small"
              onClick={() => handleRemoveEntity(i, e)}
              sx={{
                color: 'text.secondary',
                '&:hover': {
                  color: 'error.main',
                },
              }}
            >
              <DeleteOutlined fontSize="small" />
            </IconButton>
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

      {/* AI Relationship Resolution */}
      {entitiesToAdd.length >= 2 && (
        <Box sx={{ mb: 2, p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: resolvedRelationships.length > 0 ? 1.5 : 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AutoAwesomeOutlined sx={{ color: getAiColor(mode).main, fontSize: '1.2rem' }} />
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                AI Relationships{resolvedRelationships.length > 0 && ` (${resolvedRelationships.length} relationship${resolvedRelationships.length > 1 ? 's' : ''} found)`}
              </Typography>
            </Box>
            <Tooltip title={!aiSettings.available ? 'AI not configured' : !hasEnterprisePlatform ? 'Requires Enterprise platform' : 'Analyze page context to find relationships between entities'}>
              <span>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={aiResolvingRelationships || !aiSettings.available || !hasEnterprisePlatform}
                  onClick={handleResolveRelationships}
                  startIcon={aiResolvingRelationships ? <CircularProgress size={14} color="inherit" /> : <AutoAwesomeOutlined />}
                  sx={{
                    textTransform: 'none',
                    fontSize: '0.75rem',
                    color: getAiColor(mode).main,
                    borderColor: getAiColor(mode).main,
                    '&:hover': {
                      borderColor: getAiColor(mode).dark,
                      bgcolor: hexToRGB(getAiColor(mode).main, 0.1),
                    },
                  }}
                >
                  {aiResolvingRelationships ? 'Scanning...' : 'Discover'}
                </Button>
              </span>
            </Tooltip>
          </Box>

          {/* Resolved relationships list */}
          {resolvedRelationships.length > 0 && (
            <Box sx={{ maxHeight: 180, overflow: 'auto' }}>
              {resolvedRelationships.map((rel, index) => {
                // Look up entities by value (more reliable) or fallback to index
                const fromEntity = rel.fromEntityValue 
                  ? entitiesToAdd.find(e => (e.value || e.name) === rel.fromEntityValue)
                  : entitiesToAdd[rel.fromIndex];
                const toEntity = rel.toEntityValue
                  ? entitiesToAdd.find(e => (e.value || e.name) === rel.toEntityValue)
                  : entitiesToAdd[rel.toIndex];
                if (!fromEntity || !toEntity) return null;

                const aiColors = getAiColor(mode);
                const fromColor = itemColor(fromEntity.type, mode === 'dark');
                const toColor = itemColor(toEntity.type, mode === 'dark');
                const confidenceColor = rel.confidence === 'high' ? 'success.main' : rel.confidence === 'medium' ? 'warning.main' : 'text.secondary';

                return (
                  <Paper
                    key={index}
                    elevation={0}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      p: 1,
                      mb: 0.5,
                      bgcolor: hexToRGB(aiColors.main, 0.05),
                      border: 1,
                      borderColor: hexToRGB(aiColors.main, 0.2),
                      borderRadius: 1,
                    }}
                  >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      {/* One-line relationship display */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'nowrap' }}>
                        {/* From entity */}
                        <Tooltip title={fromEntity.type?.replace(/-/g, ' ') || ''} placement="top">
                          <Box sx={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            bgcolor: hexToRGB(fromColor, 0.15),
                            borderRadius: 0.5,
                            p: 0.3,
                            flexShrink: 0,
                          }}>
                            <ItemIcon type={fromEntity.type} size="small" color={fromColor} />
                          </Box>
                        </Tooltip>
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            fontWeight: 500, 
                            color: 'text.primary',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            minWidth: 0,
                            flex: '0 1 auto',
                          }}
                        >
                          {fromEntity.name || fromEntity.value}
                        </Typography>
                        {/* Relationship type */}
                        <Chip
                          label={rel.relationshipType}
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: '0.65rem',
                            bgcolor: hexToRGB(aiColors.main, 0.2),
                            color: aiColors.main,
                            flexShrink: 0,
                            '& .MuiChip-label': { px: 0.75 },
                          }}
                        />
                        {/* To entity */}
                        <Tooltip title={toEntity.type?.replace(/-/g, ' ') || ''} placement="top">
                          <Box sx={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            bgcolor: hexToRGB(toColor, 0.15),
                            borderRadius: 0.5,
                            p: 0.3,
                            flexShrink: 0,
                          }}>
                            <ItemIcon type={toEntity.type} size="small" color={toColor} />
                          </Box>
                        </Tooltip>
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            fontWeight: 500, 
                            color: 'text.primary',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            minWidth: 0,
                            flex: '0 1 auto',
                          }}
                        >
                          {toEntity.name || toEntity.value}
                        </Typography>
                      </Box>
                      {/* Reason */}
                      <Tooltip title={rel.reason} placement="bottom-start">
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.25, fontStyle: 'italic' }} noWrap>
                          {rel.reason}
                        </Typography>
                      </Tooltip>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                      <Chip
                        label={rel.confidence}
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: '0.6rem',
                          color: confidenceColor,
                          borderColor: confidenceColor,
                        }}
                        variant="outlined"
                      />
                      <IconButton
                        size="small"
                        onClick={() => {
                          setResolvedRelationships(prev => prev.filter((_, i) => i !== index));
                        }}
                        sx={{
                          p: 0.25,
                          color: 'text.secondary',
                          '&:hover': { color: 'error.main' },
                        }}
                      >
                        <DeleteOutlined sx={{ fontSize: '0.9rem' }} />
                      </IconButton>
                    </Box>
                  </Paper>
                );
              })}
            </Box>
          )}

          {resolvedRelationships.length === 0 && !aiResolvingRelationships && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Use AI to discover relationships between selected entities based on page context
            </Typography>
          )}
        </Box>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Button
          variant="contained"
          color="primary"
          onClick={handleCreateContainer}
          startIcon={<DescriptionOutlined />}
          fullWidth
        >
          Create Container{resolvedRelationships.length > 0 ? ` (${entitiesToAdd.length} entities, ${resolvedRelationships.length} relationships)` : ` with ${entitiesToAdd.length} entities`}
        </Button>
        <Button
          variant="outlined"
          onClick={handleImportWithoutContainer}
          disabled={submitting}
          fullWidth
        >
          {submitting ? 'Importing...' : 'Import without Container'}
        </Button>
      </Box>
    </Box>
  );
};

export default CommonPreviewView;
