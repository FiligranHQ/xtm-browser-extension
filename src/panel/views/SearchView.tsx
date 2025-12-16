/**
 * Search View Component
 * 
 * Provides search functionality for OpenCTI platforms.
 */

import React from 'react';
import {
  Box,
  Typography,
  TextField,
  Paper,
  Chip,
  IconButton,
  InputAdornment,
  CircularProgress,
} from '@mui/material';
import {
  SearchOutlined,
  ChevronRightOutlined,
} from '@mui/icons-material';
import ItemIcon from '../../shared/components/ItemIcon';
import { itemColor, hexToRGB } from '../../shared/theme/colors';
import type { 
  PanelMode, 
  SearchResult, 
  EntityData, 
  PlatformInfo,
  MultiPlatformResult,
} from '../types';
import { loggers } from '../../shared/utils/logger';

const log = loggers.panel;

// Interface for merged search results (same entity across platforms)
interface MergedSearchResult {
  representativeKey: string; // type + name for deduplication
  type: string;
  name: string;
  platforms: Array<{
    platformId: string;
    platformName: string;
    entity: SearchResult;
  }>;
}

export interface SearchViewProps {
  mode: 'dark' | 'light';
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: SearchResult[];
  setSearchResults: (results: SearchResult[]) => void;
  searching: boolean;
  setSearching: (searching: boolean) => void;
  setPanelMode: (mode: PanelMode) => void;
  setEntity: (entity: EntityData | null) => void;
  setEntityFromSearchMode: (mode: 'search' | 'unified-search' | null) => void;
  setMultiPlatformResults: (results: MultiPlatformResult[]) => void;
  setCurrentPlatformIndex: (index: number) => void;
  currentPlatformIndexRef: React.MutableRefObject<number>;
  multiPlatformResultsRef: React.MutableRefObject<MultiPlatformResult[]>;
  openctiPlatforms: PlatformInfo[];
  availablePlatforms: PlatformInfo[];
}

export const SearchView: React.FC<SearchViewProps> = ({
  mode,
  searchQuery,
  setSearchQuery,
  searchResults,
  setSearchResults,
  searching,
  setSearching,
  setPanelMode,
  setEntity,
  setEntityFromSearchMode,
  setMultiPlatformResults,
  setCurrentPlatformIndex,
  currentPlatformIndexRef,
  multiPlatformResultsRef,
  openctiPlatforms,
}) => {
  // Merge search results from same entity across platforms
  const getMergedSearchResults = (): MergedSearchResult[] => {
    const merged = new Map<string, MergedSearchResult>();
    
    for (const result of searchResults) {
      const type = result.entity_type || result.type || 'unknown';
      const name = result.representative?.main || result.name || result.value || 'Unknown';
      const key = `${type}:${name.toLowerCase()}`;
      
      const platformId = result._platformId || '';
      const platform = openctiPlatforms.find(p => p.id === platformId);
      const platformName = platform?.name || 'Unknown Platform';
      
      if (merged.has(key)) {
        merged.get(key)!.platforms.push({
          platformId,
          platformName,
          entity: result,
        });
      } else {
        merged.set(key, {
          representativeKey: key,
          type,
          name,
          platforms: [{
            platformId,
            platformName,
            entity: result,
          }],
        });
      }
    }
    
    return Array.from(merged.values());
  };

  // Handle search action
  const handleSearch = async () => {
    const query = searchQuery.trim();
    if (!query || searching) return;

    setSearching(true);
    setSearchResults([]);

    // Search across all OpenCTI platforms
    const allResults: SearchResult[] = [];
    
    for (const platform of openctiPlatforms) {
      try {
        const response = await new Promise<{ success: boolean; data?: SearchResult[]; error?: string }>((resolve) => {
          chrome.runtime.sendMessage(
            {
              type: 'SEARCH_ENTITIES',
              payload: { query, platformId: platform.id },
            },
            resolve
          );
        });

        if (response?.success && response.data) {
          // Add platform ID to each result
          const resultsWithPlatform = response.data.map(r => ({
            ...r,
            _platformId: platform.id,
          }));
          allResults.push(...resultsWithPlatform);
        }
      } catch (error) {
        log.error(`Search error for platform ${platform.id}:`, error);
      }
    }

    setSearchResults(allResults);
    setSearching(false);
  };

  // Handle search result click
  const handleSearchResultClick = async (merged: MergedSearchResult) => {
    // Build multi-platform results
    const results: MultiPlatformResult[] = merged.platforms.map(p => ({
      platformId: p.platformId,
      platformName: p.platformName,
      entity: {
        ...p.entity,
        _platformId: p.platformId,
        _platformType: 'opencti',
        _isNonDefaultPlatform: false,
      } as EntityData,
    }));

    // Update refs and state
    multiPlatformResultsRef.current = results;
    currentPlatformIndexRef.current = 0;
    
    setMultiPlatformResults(results);
    setCurrentPlatformIndex(0);
    setEntity(results[0]?.entity || null);
    setEntityFromSearchMode('search');
    setPanelMode('entity');
  };

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
            {mergedResults.map((merged) => {
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

export default SearchView;

