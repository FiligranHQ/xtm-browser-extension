/**
 * Preview View Component
 *
 * Displays selected entities for import with options for AI relationships and container creation.
 */

import React from 'react';
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
import { hexToRGB } from '../../shared/theme/colors';
import { getAiColor } from '../utils/platform-helpers';
import { loggers } from '../../shared/utils/logger';
import { ScanResultsRelationshipItem } from '../components/scan-results/ScanResultsRelationshipItem';
import type { PanelMode, EntityData, PlatformInfo, ContainerData, ResolvedRelationship, PanelAIState } from '../types/panel-types';

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
  aiSettings: PanelAIState;
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

  // Calculate if we have relationships to show equal height sections
  const hasRelationships = entitiesToAdd.length >= 2;

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh',
      overflow: 'hidden',
    }}>
      {/* Fixed Header Section */}
      <Box sx={{ p: 2, pb: 1, flexShrink: 0 }}>
        {/* Back to scan results button */}
        <Box sx={{ mb: 1 }}>
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

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <ArrowForwardOutlined sx={{ color: 'primary.main' }} />
          <Typography variant="h6">Import Selection</Typography>
        </Box>

        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {entitiesToAdd.length} entit{entitiesToAdd.length === 1 ? 'y' : 'ies'} selected for import
        </Typography>
      </Box>

      {/* Scrollable Content Section - Equal Height Lists */}
      <Box sx={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column',
        gap: 1.5,
        px: 2,
        overflow: 'hidden',
        minHeight: 0,
      }}>
        {/* Entity list */}
        <Box sx={{ 
          flex: hasRelationships ? 1 : 'none',
          minHeight: hasRelationships ? 0 : 'auto',
          maxHeight: hasRelationships ? 'none' : 300,
          display: 'flex',
          flexDirection: 'column',
        }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, fontWeight: 500 }}>
            Entities ({entitiesToAdd.length})
          </Typography>
          <Box sx={{ 
            flex: 1,
            overflow: 'auto', 
            border: 1, 
            borderColor: 'divider', 
            borderRadius: 1,
            minHeight: 0,
          }}>
            {entitiesToAdd.map((e, i) => (
              <Paper
                key={i}
                elevation={0}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  p: 1,
                  borderBottom: i < entitiesToAdd.length - 1 ? 1 : 0,
                  borderColor: 'divider',
                  bgcolor: 'transparent',
                }}
              >
                <ItemIcon type={e.type} size="small" />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: 'break-word', fontSize: '0.8rem' }}>
                    {e.value || e.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                    {e.type?.replace(/-/g, ' ')}
                  </Typography>
                </Box>
                <Chip
                  label={e.existsInPlatform ? 'Exists' : 'New'}
                  size="small"
                  color={e.existsInPlatform ? 'success' : 'warning'}
                  variant="outlined"
                  sx={{ height: 20, fontSize: '0.65rem' }}
                />
                <IconButton
                  size="small"
                  onClick={() => handleRemoveEntity(i, e)}
                  sx={{
                    p: 0.25,
                    color: 'text.secondary',
                    '&:hover': {
                      color: 'error.main',
                    },
                  }}
                >
                  <DeleteOutlined sx={{ fontSize: '1rem' }} />
                </IconButton>
              </Paper>
            ))}
          </Box>
        </Box>

        {/* AI Relationship Resolution - Equal Height */}
        {hasRelationships && (
          <Box sx={{ 
            flex: 1, 
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            p: 1.5, 
            border: 1, 
            borderColor: 'divider', 
            borderRadius: 1, 
            bgcolor: 'background.paper',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, flexShrink: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AutoAwesomeOutlined sx={{ color: getAiColor(mode).main, fontSize: '1.1rem' }} />
                <Typography variant="caption" sx={{ fontWeight: 500, color: 'text.secondary' }}>
                  AI Relationships{resolvedRelationships.length > 0 && ` (${resolvedRelationships.length})`}
                </Typography>
              </Box>
              <Tooltip title={!aiSettings.available ? 'AI not configured' : !hasEnterprisePlatform ? 'Requires Enterprise platform' : 'Analyze page context to find relationships between entities'}>
                <span>
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={aiResolvingRelationships || !aiSettings.available || !hasEnterprisePlatform}
                    onClick={handleResolveRelationships}
                    startIcon={aiResolvingRelationships ? <CircularProgress size={12} color="inherit" /> : <AutoAwesomeOutlined sx={{ fontSize: '0.9rem' }} />}
                    sx={{
                      textTransform: 'none',
                      fontSize: '0.7rem',
                      py: 0.25,
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
            {resolvedRelationships.length > 0 ? (
              <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                {resolvedRelationships.map((rel, index) => (
                  <ScanResultsRelationshipItem
                    key={index}
                    relationship={rel}
                    index={index}
                    mode={mode}
                    aiColors={getAiColor(mode)}
                    entities={entitiesToAdd}
                    onDelete={(i) => setResolvedRelationships(prev => prev.filter((_, idx) => idx !== i))}
                    compact
                  />
                ))}
              </Box>
            ) : (
              <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', textAlign: 'center' }}>
                  {aiResolvingRelationships ? 'Discovering relationships...' : 'Use AI to discover relationships between entities'}
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </Box>

      {/* Fixed Footer Section */}
      <Box sx={{ p: 2, pt: 1.5, flexShrink: 0 }}>
        {/* Options */}
        <FormControlLabel
          control={
            <Switch
              checked={createIndicators}
              onChange={(e) => setCreateIndicators(e.target.checked)}
              size="small"
            />
          }
          label={
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Create indicators from observables
            </Typography>
          }
          sx={{ mb: 1.5, ml: 0 }}
        />

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Button
            variant="contained"
            color="primary"
            onClick={handleCreateContainer}
            startIcon={<DescriptionOutlined />}
            fullWidth
            size="small"
          >
            Create Container{resolvedRelationships.length > 0 ? ` (${entitiesToAdd.length}+${resolvedRelationships.length})` : ` (${entitiesToAdd.length})`}
          </Button>
          <Button
            variant="outlined"
            onClick={handleImportWithoutContainer}
            disabled={submitting}
            fullWidth
            size="small"
          >
            {submitting ? 'Importing...' : 'Import without Container'}
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default CommonPreviewView;
