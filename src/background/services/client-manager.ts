/**
 * Client Manager Service
 * 
 * Manages platform client instances (OpenCTI, OpenAEV, etc.)
 */

import { OpenCTIClient, resetOpenCTIClient } from '../../shared/api/opencti-client';
import { OpenAEVClient } from '../../shared/api/openaev-client';
import { DetectionEngine } from '../../shared/detection/detector';
import { loggers } from '../../shared/utils/logger';
import type { PlatformConfig } from '../../shared/types';

const log = loggers.background;

/**
 * Platform client registry type
 */
export interface PlatformClientRegistry {
  opencti: Map<string, OpenCTIClient>;
  openaev: Map<string, OpenAEVClient>;
  // Add new platform client maps here as they are integrated
  // opengrc: Map<string, OpenGRCClient>;
}

/**
 * Client Manager state
 */
interface ClientManagerState {
  clients: PlatformClientRegistry;
  primaryOpenCTIClient: OpenCTIClient | null;
  detectionEngine: DetectionEngine | null;
  cacheRefreshInProgress: boolean;
}

// Global state
const state: ClientManagerState = {
  clients: {
    opencti: new Map(),
    openaev: new Map(),
  },
  primaryOpenCTIClient: null,
  detectionEngine: null,
  cacheRefreshInProgress: false,
};

/**
 * Get OpenCTI clients map
 */
export function getOpenCTIClients(): Map<string, OpenCTIClient> {
  return state.clients.opencti;
}

/**
 * Get OpenAEV clients map
 */
export function getOpenAEVClients(): Map<string, OpenAEVClient> {
  return state.clients.openaev;
}

/**
 * Get primary OpenCTI client
 */
export function getPrimaryOpenCTIClient(): OpenCTIClient | null {
  return state.primaryOpenCTIClient;
}

/**
 * Set primary OpenCTI client
 */
export function setPrimaryOpenCTIClient(client: OpenCTIClient | null): void {
  state.primaryOpenCTIClient = client;
}

/**
 * Get detection engine
 */
export function getDetectionEngine(): DetectionEngine | null {
  return state.detectionEngine;
}

/**
 * Set detection engine
 */
export function setDetectionEngine(engine: DetectionEngine | null): void {
  state.detectionEngine = engine;
}

/**
 * Get cache refresh status
 */
export function isCacheRefreshInProgress(): boolean {
  return state.cacheRefreshInProgress;
}

/**
 * Set cache refresh status
 */
export function setCacheRefreshInProgress(inProgress: boolean): void {
  state.cacheRefreshInProgress = inProgress;
}

/**
 * Initialize OpenCTI client
 */
export async function initializeOpenCTIClient(
  platform: PlatformConfig,
  skipCacheRefresh = false
): Promise<OpenCTIClient> {
  log.info(`[${platform.id}] Initializing OpenCTI client for ${platform.name}...`);
  
  // Reset any existing client
  resetOpenCTIClient(platform.url);
  
  const client = new OpenCTIClient(platform.url, platform.apiKey);
  state.clients.opencti.set(platform.id, client);
  
  // Set as primary if first client
  if (!state.primaryOpenCTIClient) {
    state.primaryOpenCTIClient = client;
    log.info(`[${platform.id}] Set as primary OpenCTI client`);
  }
  
  // Initialize detection engine if not exists
  if (!state.detectionEngine) {
    state.detectionEngine = new DetectionEngine(client);
    log.info(`Detection engine initialized with primary client`);
  }
  
  return client;
}

/**
 * Initialize OpenAEV client
 */
export async function initializeOpenAEVClient(
  platform: PlatformConfig
): Promise<OpenAEVClient> {
  log.info(`[${platform.id}] Initializing OpenAEV client for ${platform.name}...`);
  
  const client = new OpenAEVClient(platform.url, platform.apiKey);
  state.clients.openaev.set(platform.id, client);
  
  return client;
}

/**
 * Remove a platform client
 */
export function removeClient(platformId: string, platformType: 'opencti' | 'openaev'): void {
  const clientMap = state.clients[platformType];
  const client = clientMap.get(platformId);
  
  if (client) {
    clientMap.delete(platformId);
    log.info(`[${platformId}] Removed ${platformType} client`);
    
    // If this was the primary OpenCTI client, select a new one
    if (platformType === 'opencti' && client === state.primaryOpenCTIClient) {
      const remainingClients = Array.from(state.clients.opencti.values());
      state.primaryOpenCTIClient = remainingClients[0] || null;
      
      if (state.primaryOpenCTIClient) {
        log.info(`Selected new primary OpenCTI client`);
      } else {
        state.detectionEngine = null;
        log.info(`No OpenCTI clients remaining, detection engine cleared`);
      }
    }
  }
}

/**
 * Clear all clients
 */
export function clearAllClients(): void {
  state.clients.opencti.clear();
  state.clients.openaev.clear();
  state.primaryOpenCTIClient = null;
  state.detectionEngine = null;
  log.info('All platform clients cleared');
}

/**
 * Get client for a specific platform
 */
export function getClientForPlatform(
  platformId: string,
  platformType: 'opencti' | 'openaev'
): OpenCTIClient | OpenAEVClient | undefined {
  return state.clients[platformType].get(platformId);
}

/**
 * Get OpenCTI client for a platform ID, or primary client if not found
 */
export function getOpenCTIClientOrPrimary(platformId?: string): OpenCTIClient | null {
  if (platformId) {
    const client = state.clients.opencti.get(platformId);
    if (client) return client;
  }
  return state.primaryOpenCTIClient;
}

/**
 * Get first OpenAEV client
 */
export function getFirstOpenAEVClient(): OpenAEVClient | undefined {
  return state.clients.openaev.values().next().value;
}

/**
 * Check if any OpenCTI clients are configured
 */
export function hasOpenCTIClients(): boolean {
  return state.clients.opencti.size > 0;
}

/**
 * Check if any OpenAEV clients are configured
 */
export function hasOpenAEVClients(): boolean {
  return state.clients.openaev.size > 0;
}

/**
 * Get platform counts
 */
export function getPlatformCounts(): { opencti: number; openaev: number } {
  return {
    opencti: state.clients.opencti.size,
    openaev: state.clients.openaev.size,
  };
}

