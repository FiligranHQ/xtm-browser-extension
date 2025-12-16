/**
 * Cache Management Message Handlers
 * 
 * Handles messages related to cache operations:
 * - SDO cache refresh and stats
 * - OpenAEV cache refresh and stats
 * - Cache clearing
 */

import { type MessageHandler, successResponse, errorResponse } from './types';
import {
  getSettings,
  getSDOCacheStats,
  getMultiPlatformSDOCache,
  getMultiPlatformOAEVCache,
  clearSDOCacheForPlatform,
  clearAllSDOCaches,
  clearOAEVCacheForPlatform,
  clearAllOAEVCaches,
} from '../../shared/utils/storage';
import { hasOpenCTIClients, hasOpenAEVClients } from '../services/client-manager';
import { loggers } from '../../shared/utils/logger';

const log = loggers.background;

// Cache refresh state - these would be managed by the main background script
// For now, we'll import them from a shared location
let isCacheRefreshing = false;
let isOAEVCacheRefreshing = false;

// Refresh functions - these need to be provided by the main background script
let refreshSDOCache: () => Promise<void>;
let refreshOAEVCache: () => Promise<void>;

/**
 * Initialize cache handlers with refresh functions
 */
export function initializeCacheHandlers(
  sdoRefreshFn: () => Promise<void>,
  oaevRefreshFn: () => Promise<void>,
  getCacheRefreshStatus: () => { sdo: boolean; oaev: boolean }
) {
  refreshSDOCache = sdoRefreshFn;
  refreshOAEVCache = oaevRefreshFn;
  
  // Update status getters
  const originalGetStatus = getCacheRefreshStatus;
  setInterval(() => {
    const status = originalGetStatus();
    isCacheRefreshing = status.sdo;
    isOAEVCacheRefreshing = status.oaev;
  }, 100);
}

/**
 * Refresh SDO cache handler
 */
export const handleRefreshSDOCache: MessageHandler = async (_payload, sendResponse) => {
  if (!hasOpenCTIClients() && !hasOpenAEVClients()) {
    sendResponse(errorResponse('Not configured'));
    return;
  }

  try {
    // Refresh both OpenCTI and OpenAEV caches
    const refreshPromises: Promise<void>[] = [];
    if (hasOpenCTIClients() && refreshSDOCache) {
      refreshPromises.push(refreshSDOCache());
    }
    if (hasOpenAEVClients() && refreshOAEVCache) {
      refreshPromises.push(refreshOAEVCache());
    }
    await Promise.all(refreshPromises);

    const stats = await getSDOCacheStats();
    sendResponse(successResponse(stats));
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Cache refresh failed',
    });
  }
};

/**
 * Get SDO cache stats handler
 */
export const handleGetSDOCacheStats: MessageHandler = async (_payload, sendResponse) => {
  try {
    const multiCache = await getMultiPlatformSDOCache();
    const oaevMultiCache = await getMultiPlatformOAEVCache();

    // Build per-platform stats for OpenCTI
    const openctiPlatformStats: Array<{
      platformId: string;
      platformName: string;
      total: number;
      timestamp: number;
      age: number;
      byType: Record<string, number>;
    }> = [];

    // Build per-platform stats for OpenAEV
    const oaevPlatformStats: Array<{
      platformId: string;
      platformName: string;
      total: number;
      timestamp: number;
      age: number;
      byType: Record<string, number>;
    }> = [];

    // Get platform names from settings
    const currentSettings = await getSettings();
    const openctiPlatformNameMap = new Map<string, string>();
    for (const p of currentSettings.openctiPlatforms || []) {
      openctiPlatformNameMap.set(p.id, p.name);
    }
    const oaevPlatformNameMap = new Map<string, string>();
    for (const p of currentSettings.openaevPlatforms || []) {
      oaevPlatformNameMap.set(p.id, p.name);
    }

    let grandTotal = 0;
    let oldestTimestamp = Date.now();

    // OpenCTI stats - include all configured platforms
    const processedOpenctiPlatforms = new Set<string>();
    for (const [platformId, cache] of Object.entries(multiCache.platforms)) {
      let platformTotal = 0;
      const byType: Record<string, number> = {};
      for (const [type, entities] of Object.entries(cache.entities)) {
        const count = entities.length;
        if (count > 0) {
          byType[type] = count;
        }
        platformTotal += count;
      }
      grandTotal += platformTotal;
      if (cache.timestamp < oldestTimestamp) {
        oldestTimestamp = cache.timestamp;
      }

      openctiPlatformStats.push({
        platformId,
        platformName: openctiPlatformNameMap.get(platformId) || platformId,
        total: platformTotal,
        timestamp: cache.timestamp,
        age: Date.now() - cache.timestamp,
        byType,
      });
      processedOpenctiPlatforms.add(platformId);
    }

    // Add platforms from settings that don't have cache entries yet
    for (const p of currentSettings.openctiPlatforms || []) {
      if (p.url && p.apiToken && !processedOpenctiPlatforms.has(p.id)) {
        openctiPlatformStats.push({
          platformId: p.id,
          platformName: p.name,
          total: 0,
          timestamp: 0,
          age: 0,
          byType: {},
        });
      }
    }

    // OpenAEV stats - include all configured platforms
    const processedOaevPlatforms = new Set<string>();
    let oaevGrandTotal = 0;
    for (const [platformId, cache] of Object.entries(oaevMultiCache.platforms)) {
      let platformTotal = 0;
      const byType: Record<string, number> = {};
      for (const [type, entities] of Object.entries(cache.entities)) {
        const count = entities.length;
        if (count > 0) {
          byType[type] = count;
        }
        platformTotal += count;
      }
      oaevGrandTotal += platformTotal;
      grandTotal += platformTotal;
      if (cache.timestamp < oldestTimestamp) {
        oldestTimestamp = cache.timestamp;
      }

      oaevPlatformStats.push({
        platformId,
        platformName: oaevPlatformNameMap.get(platformId) || platformId,
        total: platformTotal,
        timestamp: cache.timestamp,
        age: Date.now() - cache.timestamp,
        byType,
      });
      processedOaevPlatforms.add(platformId);
    }

    // Add OpenAEV platforms from settings that don't have cache entries yet
    for (const p of currentSettings.openaevPlatforms || []) {
      if (p.url && p.apiToken && !processedOaevPlatforms.has(p.id)) {
        oaevPlatformStats.push({
          platformId: p.id,
          platformName: p.name,
          total: 0,
          timestamp: 0,
          age: 0,
          byType: {},
        });
      }
    }

    sendResponse({
      success: true,
      data: {
        total: grandTotal,
        byPlatform: openctiPlatformStats,
        oaevByPlatform: oaevPlatformStats,
        oaevTotal: oaevGrandTotal,
        age: grandTotal > 0 ? Date.now() - oldestTimestamp : 0,
        isRefreshing: isCacheRefreshing || isOAEVCacheRefreshing,
      },
    });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get cache stats',
    });
  }
};

/**
 * Get cache refresh status handler
 */
export const handleGetCacheRefreshStatus: MessageHandler = async (_payload, sendResponse) => {
  sendResponse({ success: true, data: { isRefreshing: isCacheRefreshing || isOAEVCacheRefreshing } });
};

/**
 * Clear SDO cache handler
 */
export const handleClearSDOCache: MessageHandler = async (payload, sendResponse) => {
  const { platformId } = (payload as { platformId?: string }) || {};
  try {
    if (platformId) {
      await clearSDOCacheForPlatform(platformId);
      log.debug(`Cleared SDO cache for platform ${platformId}`);
    } else {
      await clearAllSDOCaches();
      log.debug('Cleared all SDO caches');
    }
    sendResponse(successResponse(null));
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to clear cache'
    });
  }
};

/**
 * Clear OpenAEV cache handler
 */
export const handleClearOAEVCache: MessageHandler = async (payload, sendResponse) => {
  const { platformId } = (payload as { platformId?: string }) || {};
  try {
    if (platformId) {
      await clearOAEVCacheForPlatform(platformId);
      log.debug(`Cleared OpenAEV cache for platform ${platformId}`);
    } else {
      await clearAllOAEVCaches();
      log.debug('Cleared all OpenAEV caches');
    }
    sendResponse(successResponse(null));
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to clear OpenAEV cache'
    });
  }
};

/**
 * Export all cache handlers
 */
export const cacheHandlers: Record<string, MessageHandler> = {
  REFRESH_SDO_CACHE: handleRefreshSDOCache,
  GET_SDO_CACHE_STATS: handleGetSDOCacheStats,
  GET_CACHE_REFRESH_STATUS: handleGetCacheRefreshStatus,
  // Note: CLEAR_PLATFORM_CACHE is now a unified handler in background/index.ts
  // Individual handlers (handleClearSDOCache, handleClearOAEVCache) are kept for potential direct use
};

