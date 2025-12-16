/**
 * Preview View Component
 * 
 * Shows entities selected for import with options and AI relationship resolution.
 */

import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Button,
  IconButton,
  FormControlLabel,
  Switch,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  ChevronLeftOutlined,
  ArrowForwardOutlined,
  DescriptionOutlined,
  AutoAwesomeOutlined,
  DeleteOutlined,
  FileUploadOutlined,
} from '@mui/icons-material';
import ItemIcon from '../../shared/components/ItemIcon';
import { hexToRGB } from '../../shared/theme/colors';
import { THEME_DARK_AI, THEME_LIGHT_AI } from '../../shared/theme/ThemeDark';
import type { PreviewViewProps } from '../types/view-props';
import type { PlatformInfo, ResolvedRelationship } from '../types';
import { loggers } from '../../shared/utils/logger';

const log = loggers.panel;

// Helper function to get AI colors based on theme mode
const getAiColor = (mode: 'dark' | 'light') => {
  return mode === 'dark' ? THEME_DARK_AI : THEME_LIGHT_AI;
};

interface ExtendedPreviewViewProps extends Omit<PreviewViewProps, 'showToast'> {
  showToast: (options: {
    type: 'success' | 'info' | 'warning' | 'error';
    message: string;
    action?: { label: string; type: 'scroll_to_first' | 'close_panel' | 'custom' };
    persistent?: boolean;
    duration?: number;
  }) => void;
  openctiPlatforms: PlatformInfo[];
  setExistingContainers: (containers: any[]) => void;
  setCheckingExisting: (checking: boolean) => void;
}

export const PreviewView: React.FC<ExtendedPreviewViewProps> = ({
  mode,
  entitiesToAdd,
  setEntitiesToAdd,
  setPanelMode,
  setContainerWorkflowOrigin,
  createIndicators,
  setCreateIndicators,
  aiSettings,
  aiResolvingRelationships,
  setAiResolvingRelationships,
  resolvedRelationships,
  setResolvedRelationships,
  scanPageContent,
  currentPageUrl,
  currentPageTitle,
  setSelectedScanItems,
  setImportResults,
  submitting,
  setSubmitting,
  availablePlatforms,
  selectedPlatformId,
  setSelectedPlatformId,
  setPlatformUrl,
  showToast,
  openctiPlatforms,
  setExistingContainers,
  setCheckingExisting,
}) => {
  const aiColors = getAiColor(mode);
  const hasEnterprisePlatform = availablePlatforms.some(p => p.isEnterprise);

  // Handle AI relationship resolution
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
        } catch (error) {
          log.debug('Could not get page content for AI relationship resolution:', error);
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
            setResolvedRelationships(response.data.relationships);
            log.info(`AI resolved ${response.data.relationships.length} relationships`);
            if (response.data.relationships.length > 0) {
              showToast({ type: 'success', message: `AI found ${response.data.relationships.length} relationship${response.data.relationships.length === 1 ? '' : 's'}` });
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

  // Handle creating container
  const handleCreateContainer = async () => {
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
            setExistingContainers(response.data);
            setPanelMode('existing-containers');
          } else {
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

  // Handle import without container
  const handleImportWithoutContainer = async () => {
    if (entitiesToAdd.length === 0) {
      showToast({ type: 'warning', message: 'No entities to import' });
      return;
    }

    // If multiple OpenCTI platforms, need to select one
    if (openctiPlatforms.length > 1) {
      setContainerWorkflowOrigin('import');
      setPanelMode('platform-select');
      return;
    }

    // Auto-select single platform
    const targetPlatformId = openctiPlatforms.length === 1 ? openctiPlatforms[0].id : selectedPlatformId;
    if (!targetPlatformId) {
      showToast({ type: 'error', message: 'No OpenCTI platform available' });
      return;
    }

    setSubmitting(true);

    try {
      const response = await new Promise<{ success: boolean; data?: any; error?: string }>((resolve) => {
        chrome.runtime.sendMessage(
          {
            type: 'IMPORT_ENTITIES',
            payload: {
              entities: entitiesToAdd,
              createIndicators,
              relationships: resolvedRelationships,
              platformId: targetPlatformId,
            },
          },
          resolve
        );
      });

      setSubmitting(false);

      if (response?.success) {
        const platform = openctiPlatforms.find(p => p.id === targetPlatformId);
        setImportResults({
          success: true,
          total: entitiesToAdd.length,
          created: response.data?.created || [],
          failed: response.data?.failed || [],
          platformName: platform?.name || 'OpenCTI',
        });
        setEntitiesToAdd([]);
        setSelectedScanItems(new Set());
        setResolvedRelationships([]);
        setPanelMode('import-results');
      } else {
        showToast({ type: 'error', message: response?.error || 'Import failed' });
      }
    } catch (error) {
      log.error('Import error:', error);
      setSubmitting(false);
      showToast({ type: 'error', message: 'Import failed' });
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
            setResolvedRelationships([]);
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
              onClick={() => {
                const newEntities = entitiesToAdd.filter((_, idx) => idx !== i);
                setEntitiesToAdd(newEntities);

                const entityValue = e.value || e.name;
                if (entityValue) {
                  window.parent.postMessage({ type: 'XTM_DESELECT_ITEM', value: entityValue }, '*');
                  setSelectedScanItems((prev: Set<string>) => {
                    const newSet = new Set(prev);
                    newSet.delete(entityValue);
                    return newSet;
                  });
                }

                if (newEntities.length === 0) {
                  setPanelMode('scan-results');
                }
              }}
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
              <AutoAwesomeOutlined sx={{ color: aiColors.main, fontSize: '1.2rem' }} />
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                AI Relationships
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
                    color: aiColors.main,
                    borderColor: aiColors.main,
                    '&:hover': {
                      borderColor: aiColors.dark,
                      bgcolor: hexToRGB(aiColors.main, 0.1),
                    },
                  }}
                >
                  {aiResolvingRelationships ? 'Resolving...' : resolvedRelationships.length > 0 ? 'Re-analyze' : 'Resolve'}
                </Button>
              </span>
            </Tooltip>
          </Box>

          {/* Resolved relationships list */}
          {resolvedRelationships.length > 0 && (
            <Box sx={{ maxHeight: 180, overflow: 'auto' }}>
              {resolvedRelationships.map((rel: ResolvedRelationship, index: number) => {
                const fromEntity = entitiesToAdd[rel.fromIndex];
                const toEntity = entitiesToAdd[rel.toIndex];
                if (!fromEntity || !toEntity) return null;

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
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                        <Typography variant="caption" sx={{ fontWeight: 500, color: 'text.primary' }}>
                          {fromEntity.name || fromEntity.value}
                        </Typography>
                        <Chip
                          label={rel.relationshipType}
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: '0.65rem',
                            bgcolor: hexToRGB(aiColors.main, 0.2),
                            color: aiColors.main,
                          }}
                        />
                        <Typography variant="caption" sx={{ fontWeight: 500, color: 'text.primary' }}>
                          {toEntity.name || toEntity.value}
                        </Typography>
                      </Box>
                      <Tooltip title={rel.reason} placement="bottom-start">
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.25 }} noWrap>
                          {rel.reason}
                        </Typography>
                      </Tooltip>
                    </Box>
                    <Chip
                      label={rel.confidence}
                      size="small"
                      sx={{
                        height: 16,
                        fontSize: '0.6rem',
                        color: confidenceColor,
                        borderColor: confidenceColor,
                      }}
                      variant="outlined"
                    />
                    <IconButton
                      size="small"
                      onClick={() => {
                        setResolvedRelationships(resolvedRelationships.filter((_: ResolvedRelationship, i: number) => i !== index));
                      }}
                      sx={{
                        p: 0.25,
                        color: 'text.secondary',
                        '&:hover': { color: 'error.main' },
                      }}
                    >
                      <DeleteOutlined sx={{ fontSize: '0.9rem' }} />
                    </IconButton>
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
          disabled={submitting}
        >
          Create Container
        </Button>

        <Button
          variant="outlined"
          color="primary"
          onClick={handleImportWithoutContainer}
          startIcon={submitting ? <CircularProgress size={16} /> : <FileUploadOutlined />}
          fullWidth
          disabled={submitting}
        >
          {submitting ? 'Importing...' : 'Import Without Container'}
        </Button>
      </Box>
    </Box>
  );
};

export default PreviewView;

