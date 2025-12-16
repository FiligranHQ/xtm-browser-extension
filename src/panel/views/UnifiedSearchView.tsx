/**
 * Unified Search View Component
 * 
 * Provides unified search across both OpenCTI and OpenAEV platforms.
 */

import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  TextField,
  Paper,
  Chip,
  IconButton,
  InputAdornment,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  SearchOutlined,
  ChevronRightOutlined,
} from '@mui/icons-material';
import ItemIcon from '../../shared/components/ItemIcon';
import { itemColor, hexToRGB } from '../../shared/theme/colors';
import type { 
  PanelMode, 
  EntityData, 
  PlatformInfo,
  MultiPlatformResult,
  UnifiedSearchResult,
} from '../types';
import { loggers } from '../../shared/utils/logger';
import { getOAEVEntityName, getOAEVTypeFromClass } from '../../shared/utils/entity';

const log = loggers.panel;

export interface UnifiedSearchViewProps {
  mode: 'dark' | 'light';
  unifiedSearchQuery: string;
  setUnifiedSearchQuery: (query: string) => void;
  unifiedSearchResults: UnifiedSearchResult[];
  setUnifiedSearchResults: (results: UnifiedSearchResult[]) => void;
  unifiedSearching: boolean;
  setUnifiedSearching: (searching: boolean) => void;
  unifiedSearchPlatformFilter: 'all' | 'opencti' | 'openaev';
  setUnifiedSearchPlatformFilter: (filter: 'all' | 'opencti' | 'openaev') => void;
  setPanelMode: (mode: PanelMode) => void;
  setEntity: (entity: EntityData | null) => void;
  setEntityFromSearchMode: (mode: 'search' | 'oaev-search' | 'unified-search' | null) => void;
  setMultiPlatformResults: (results: MultiPlatformResult[]) => void;
  setCurrentPlatformIndex: (index: number) => void;
  currentPlatformIndexRef: React.MutableRefObject<number>;
  multiPlatformResultsRef: React.MutableRefObject<MultiPlatformResult[]>;
  availablePlatforms: PlatformInfo[];
  logoSuffix: string;
}

export const UnifiedSearchView: React.FC<UnifiedSearchViewProps> = ({
  mode,
  unifiedSearchQuery,
  setUnifiedSearchQuery,
  unifiedSearchResults,
  setUnifiedSearchResults,
  unifiedSearching,
  setUnifiedSearching,
  unifiedSearchPlatformFilter,
  setUnifiedSearchPlatformFilter,
  setPanelMode,
  setEntity,
  setEntityFromSearchMode,
  setMultiPlatformResults,
  setCurrentPlatformIndex,
  currentPlatformIndexRef,
  multiPlatformResultsRef,
  availablePlatforms,
  logoSuffix,
}) => {
  // Get platform counts
  const openctiPlatforms = useMemo(() => 
    availablePlatforms.filter(p => p.type === 'opencti'),
    [availablePlatforms]
  );
  
  const openaevPlatforms = useMemo(() => 
    availablePlatforms.filter(p => p.type === 'openaev'),
    [availablePlatforms]
  );

  const hasOpenCTI = openctiPlatforms.length > 0;
  const hasOpenAEV = openaevPlatforms.length > 0;

  // Filter results based on platform filter
  const filteredResults = useMemo(() => {
    if (unifiedSearchPlatformFilter === 'all') return unifiedSearchResults;
    return unifiedSearchResults.filter(r => r.source === unifiedSearchPlatformFilter);
  }, [unifiedSearchResults, unifiedSearchPlatformFilter]);

  // Count results by source
  const openctiResultCount = useMemo(() => 
    unifiedSearchResults.filter(r => r.source === 'opencti').length,
    [unifiedSearchResults]
  );
  
  const openaevResultCount = useMemo(() => 
    unifiedSearchResults.filter(r => r.source === 'openaev').length,
    [unifiedSearchResults]
  );

  // Handle unified search
  const handleUnifiedSearch = async (queryOverride?: string) => {
    const query = (queryOverride || unifiedSearchQuery).trim();
    if (!query || unifiedSearching) return;

    setUnifiedSearching(true);
    setUnifiedSearchResults([]);

    const allResults: UnifiedSearchResult[] = [];

    // Search OpenCTI platforms
    for (const platform of openctiPlatforms) {
      try {
        const response = await new Promise<{ success: boolean; data?: any[]; error?: string }>((resolve) => {
          chrome.runtime.sendMessage(
            {
              type: 'SEARCH_ENTITIES',
              payload: { query, platformId: platform.id },
            },
            resolve
          );
        });

        if (response?.success && response.data) {
          const results: UnifiedSearchResult[] = response.data.map(r => ({
            id: r.id,
            type: r.entity_type || r.type || 'unknown',
            name: r.representative?.main || r.name || r.value || 'Unknown',
            source: 'opencti' as const,
            platformId: platform.id,
            platformName: platform.name,
            entityData: r,
          }));
          allResults.push(...results);
        }
      } catch (error) {
        log.error(`Unified search error for OpenCTI platform ${platform.id}:`, error);
      }
    }

    // Search OpenAEV platforms
    for (const platform of openaevPlatforms) {
      try {
        const response = await new Promise<{ success: boolean; data?: any[]; error?: string }>((resolve) => {
          chrome.runtime.sendMessage(
            {
              type: 'OAEV_SEARCH',
              payload: { query, platformId: platform.id },
            },
            resolve
          );
        });

        if (response?.success && response.data) {
          const results: UnifiedSearchResult[] = response.data.map((r: any) => {
            const entityClass = r._entityClass || '';
            const oaevType = getOAEVTypeFromClass(entityClass);
            return {
              id: r.id || r.asset_id || r.team_id,
              type: `oaev-${oaevType}`,
              name: getOAEVEntityName(r, oaevType),
              source: 'openaev' as const,
              platformId: platform.id,
              platformName: platform.name,
              entityData: r,
            };
          });
          allResults.push(...results);
        }
      } catch (error) {
        log.error(`Unified search error for OpenAEV platform ${platform.id}:`, error);
      }
    }

    setUnifiedSearchResults(allResults);
    setUnifiedSearching(false);
  };

  // Handle result click
  const handleUnifiedSearchResultClick = async (result: UnifiedSearchResult) => {
    log.debug('[UNIFIED-SEARCH-CLICK] Result clicked:', result.name, result.type, result.source);

    const platform = availablePlatforms.find(p => p.id === result.platformId);
    
    const baseEntityData = typeof result.entityData === 'object' && result.entityData !== null 
      ? result.entityData as Record<string, unknown>
      : {};
    
    const entityData: EntityData = {
      ...baseEntityData,
      id: result.id,
      type: result.type,
      name: result.name,
      _platformId: result.platformId,
      _platformType: result.source,
      _isNonDefaultPlatform: result.source !== 'opencti',
    };

    const multiResult: MultiPlatformResult = {
      platformId: result.platformId,
      platformName: result.platformName || platform?.name || 'Unknown',
      entity: entityData,
    };

    // Update refs and state
    multiPlatformResultsRef.current = [multiResult];
    currentPlatformIndexRef.current = 0;

    setMultiPlatformResults([multiResult]);
    setCurrentPlatformIndex(0);
    setEntity(entityData);
    setEntityFromSearchMode('unified-search');
    setPanelMode('entity');
  };

  const hasSearched = unifiedSearchResults.length > 0 || (unifiedSearchQuery.trim() && !unifiedSearching);

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Typography variant="h6">Search</Typography>
        <Box sx={{ display: 'flex', gap: 0.5, ml: 'auto' }}>
          {hasOpenCTI && (
            <img
              src={typeof chrome !== 'undefined' && chrome.runtime?.getURL
                ? chrome.runtime.getURL(`assets/logos/logo_opencti_${logoSuffix}_embleme_square.svg`)
                : `../assets/logos/logo_opencti_${logoSuffix}_embleme_square.svg`
              }
              alt="OpenCTI"
              width={20}
              height={20}
            />
          )}
          {hasOpenAEV && (
            <img
              src={typeof chrome !== 'undefined' && chrome.runtime?.getURL
                ? chrome.runtime.getURL(`assets/logos/logo_openaev_${logoSuffix}_embleme_square.svg`)
                : `../assets/logos/logo_openaev_${logoSuffix}_embleme_square.svg`
              }
              alt="OpenAEV"
              width={20}
              height={20}
            />
          )}
        </Box>
      </Box>

      <TextField
        placeholder="Search across all platforms..."
        value={unifiedSearchQuery}
        onChange={(e) => setUnifiedSearchQuery(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && handleUnifiedSearch()}
        fullWidth
        autoFocus
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton onClick={() => handleUnifiedSearch()} edge="end" disabled={unifiedSearching}>
                {unifiedSearching ? <CircularProgress size={20} /> : <SearchOutlined />}
              </IconButton>
            </InputAdornment>
          ),
        }}
        sx={{ mb: 2 }}
      />

      {/* Platform filter - only show if both platforms have results */}
      {unifiedSearchResults.length > 0 && hasOpenCTI && hasOpenAEV && (
        <Box sx={{ mb: 2 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Filter by platform</InputLabel>
            <Select
              value={unifiedSearchPlatformFilter}
              label="Filter by platform"
              onChange={(e) => setUnifiedSearchPlatformFilter(e.target.value as 'all' | 'opencti' | 'openaev')}
            >
              <MenuItem value="all">
                <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <span>All platforms</span>
                  <Chip label={unifiedSearchResults.length} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
                </Box>
              </MenuItem>
              <MenuItem value="opencti">
                <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <span>OpenCTI only</span>
                  <Chip label={openctiResultCount} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
                </Box>
              </MenuItem>
              <MenuItem value="openaev">
                <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <span>OpenAEV only</span>
                  <Chip label={openaevResultCount} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
                </Box>
              </MenuItem>
            </Select>
          </FormControl>
        </Box>
      )}

      {/* Results section */}
      {unifiedSearching ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 1 }}>
          <CircularProgress size={32} />
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Searching across {availablePlatforms.length} platform{availablePlatforms.length > 1 ? 's' : ''}...
          </Typography>
        </Box>
      ) : hasSearched && filteredResults.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            No results found for "{unifiedSearchQuery}"
          </Typography>
        </Box>
      ) : filteredResults.length > 0 ? (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {filteredResults.length} result{filteredResults.length !== 1 ? 's' : ''} found
            </Typography>
          </Box>
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {filteredResults.map((result, i) => {
              const displayType = result.type.replace('oaev-', '');
              const entityColor = itemColor(result.type, mode === 'dark');
              const isOpenAEV = result.source === 'openaev';

              return (
                <Paper
                  key={result.id + '-' + i}
                  onClick={() => handleUnifiedSearchResultClick(result)}
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
                    <ItemIcon type={result.type} size="small" color={entityColor} />
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
                        {displayType.replace(/-/g, ' ')}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>·</Typography>
                      <Chip
                        label={isOpenAEV ? 'OAEV' : 'OCTI'}
                        size="small"
                        sx={{
                          height: 16,
                          fontSize: '0.6rem',
                          bgcolor: hexToRGB(isOpenAEV ? '#00bcd4' : '#ff9800', 0.2),
                          color: isOpenAEV ? '#00bcd4' : '#ff9800',
                          '& .MuiChip-label': { px: 0.75 },
                        }}
                      />
                      {availablePlatforms.length > 2 && (
                        <>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>·</Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {result.platformName}
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
            Search for entities across all your platforms
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Enter a search term and press Enter or click the search icon
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default UnifiedSearchView;

