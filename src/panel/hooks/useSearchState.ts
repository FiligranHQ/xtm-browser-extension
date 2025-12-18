/**
 * Search State Hook
 * 
 * Manages unified search state for the panel.
 */

import { useState, useCallback } from 'react';
import { loggers } from '../../shared/utils/logger';
import {
  getOAEVEntityName,
  getOAEVTypeFromClass,
} from '../../shared/utils/entity';
import type { UnifiedSearchResult, PlatformInfo } from '../types/panel-types';

const log = loggers.panel;

export interface SearchStateReturn {
  // Search query
  unifiedSearchQuery: string;
  setUnifiedSearchQuery: (query: string) => void;
  
  // Search results
  unifiedSearchResults: UnifiedSearchResult[];
  setUnifiedSearchResults: (results: UnifiedSearchResult[]) => void;
  
  // Loading state
  unifiedSearching: boolean;
  setUnifiedSearching: (searching: boolean) => void;
  
  // Platform filter
  unifiedSearchPlatformFilter: 'all' | 'opencti' | 'openaev';
  setUnifiedSearchPlatformFilter: (filter: 'all' | 'opencti' | 'openaev') => void;
  
  // Entity type filter
  unifiedSearchTypeFilter: string;
  setUnifiedSearchTypeFilter: (filter: string) => void;
  
  // Search handler
  handleUnifiedSearch: (availablePlatforms: PlatformInfo[], queryOverride?: string) => Promise<void>;
  
  // Clear search
  clearSearch: () => void;
}

/**
 * Hook for managing unified search state
 */
export function useSearchState(): SearchStateReturn {
  const [unifiedSearchQuery, setUnifiedSearchQuery] = useState<string>('');
  const [unifiedSearchResults, setUnifiedSearchResults] = useState<UnifiedSearchResult[]>([]);
  const [unifiedSearching, setUnifiedSearching] = useState<boolean>(false);
  const [unifiedSearchPlatformFilter, setUnifiedSearchPlatformFilter] = useState<'all' | 'opencti' | 'openaev'>('all');
  const [unifiedSearchTypeFilter, setUnifiedSearchTypeFilter] = useState<string>('all');
  
  // Unified search handler - searches BOTH OpenCTI and OpenAEV
  const handleUnifiedSearch = useCallback(async (availablePlatforms: PlatformInfo[], queryOverride?: string) => {
    const searchQuery = queryOverride ?? unifiedSearchQuery;
    if (!searchQuery.trim()) return;
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
    
    setUnifiedSearching(true);
    const results: UnifiedSearchResult[] = [];

    // Search OpenCTI (all platforms)
    try {
      const octiResponse = await chrome.runtime.sendMessage({
        type: 'SEARCH_PLATFORM',
        payload: { searchTerm: searchQuery, limit: 20, platformType: 'opencti' },
      });

      if (octiResponse?.success && octiResponse.data) {
        for (const result of octiResponse.data) {
          const platformInfo = availablePlatforms.find(p => p.id === result.platformId);
          results.push({
            id: `opencti-${result.id}-${result.platformId}`,
            name: result.representative?.main || result.name || result.value || 'Unknown',
            type: result.entity_type || result.type || 'Unknown',
            description: result.description,
            source: 'opencti',
            platformId: result.platformId,
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
        type: 'SEARCH_PLATFORM',
        payload: { searchTerm: searchQuery, platformType: 'openaev' },
      });

      if (oaevResponse?.success && oaevResponse.data) {
        for (const result of oaevResponse.data) {
          const platformInfo = availablePlatforms.find(p => p.id === result.platformId);
          const entityClass = result._entityClass || '';
          const oaevType = getOAEVTypeFromClass(entityClass);
          results.push({
            id: `openaev-${result._id || result.asset_id || result.team_id || result.player_id || Math.random()}-${result.platformId}`,
            name: getOAEVEntityName(result, oaevType),
            type: oaevType,
            description: result.asset_description || result.team_description || result.scenario_description || undefined,
            source: 'openaev',
            platformId: result.platformId,
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
  }, [unifiedSearchQuery]);
  
  // Clear search state
  const clearSearch = useCallback(() => {
    setUnifiedSearchQuery('');
    setUnifiedSearchResults([]);
    setUnifiedSearchPlatformFilter('all');
    setUnifiedSearchTypeFilter('all');
  }, []);
  
  return {
    unifiedSearchQuery,
    setUnifiedSearchQuery,
    unifiedSearchResults,
    setUnifiedSearchResults,
    unifiedSearching,
    setUnifiedSearching,
    unifiedSearchPlatformFilter,
    setUnifiedSearchPlatformFilter,
    unifiedSearchTypeFilter,
    setUnifiedSearchTypeFilter,
    handleUnifiedSearch,
    clearSearch,
  };
}
