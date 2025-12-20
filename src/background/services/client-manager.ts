/**
 * Client Manager Service
 * 
 * Manages platform client instances (OpenCTI, OpenAEV, etc.)
 * 
 * NOTE: The actual client instances are stored in background/index.ts.
 * This service provides getter functions that are configured by background/index.ts
 * to access those clients. This avoids circular dependencies and state duplication.
 * 
 * Uses the shared client-registry for client getter management.
 */

import type { OpenCTIClient } from '../../shared/api/opencti-client';
import type { OpenAEVClient } from '../../shared/api/openaev-client';
import {
  getOpenCTIClients,
  getOpenAEVClients,
} from './client-registry';

/**
 * Platform client registry type
 */
export interface PlatformClientRegistry {
  opencti: Map<string, OpenCTIClient>;
  openaev: Map<string, OpenAEVClient>;
  // Add new platform client maps here as they are integrated
  // opengrc: Map<string, OpenGRCClient>;
}

// Re-export all client registry functions for backwards compatibility
export {
  setOpenCTIClientGetter,
  setOpenAEVClientGetter,
  setPrimaryOpenCTIClientGetter,
  getOpenCTIClients,
  getOpenAEVClients,
  getPrimaryOpenCTIClient,
  getFirstOpenAEVClient,
  hasOpenCTIClients,
  hasOpenAEVClients,
} from './client-registry';

/**
 * Get platform counts
 */
export function getPlatformCounts(): { opencti: number; openaev: number } {
  return {
    opencti: getOpenCTIClients().size,
    openaev: getOpenAEVClients().size,
  };
}
