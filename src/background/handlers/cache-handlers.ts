/**
 * Cache Management Message Handlers
 * 
 * Handles messages related to cache operations:
 * - OpenCTI cache clearing
 * - OpenAEV cache clearing
 * 
 * Note: REFRESH_CACHE and GET_CACHE_STATS are handled directly in background/index.ts
 * because they need direct access to the refresh functions and client state.
 */

import { type MessageHandler, successResponse } from './types';
import {
  clearOCTICacheForPlatform,
  clearAllOCTICaches,
  clearOAEVCacheForPlatform,
  clearAllOAEVCaches,
} from '../../shared/utils/storage';
import { loggers } from '../../shared/utils/logger';

const log = loggers.background;

/**
 * Clear OpenCTI cache handler
 */
export const handleClearOCTICache: MessageHandler = async (payload, sendResponse) => {
  const { platformId } = (payload as { platformId?: string }) || {};
  try {
    if (platformId) {
      await clearOCTICacheForPlatform(platformId);
      log.debug(`Cleared OpenCTI cache for platform ${platformId}`);
    } else {
      await clearAllOCTICaches();
      log.debug('Cleared all OpenCTI caches');
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
 * Export cache handlers
 * Note: Only includes clear handlers. REFRESH_CACHE and GET_CACHE_STATS
 * are handled directly in background/index.ts
 */
export const cacheHandlers: Record<string, MessageHandler> = {
  CLEAR_OCTI_CACHE: handleClearOCTICache,
  CLEAR_OAEV_CACHE: handleClearOAEVCache,
};
