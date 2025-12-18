/**
 * Client Manager Service
 * 
 * Manages platform client instances (OpenCTI, OpenAEV, etc.)
 * 
 * NOTE: The actual client instances are stored in background/index.ts.
 * This service provides getter functions that are configured by background/index.ts
 * to access those clients. This avoids circular dependencies and state duplication.
 */

import { OpenCTIClient } from '../../shared/api/opencti-client';
import { OpenAEVClient } from '../../shared/api/openaev-client';
import { loggers } from '../../shared/utils/logger';

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

// ============================================================================
// Client Getter Configuration
// ============================================================================

/**
 * Client getter functions - configured by background/index.ts
 * These allow the client manager to access the actual client instances
 */
let octiClientGetter: (() => Map<string, OpenCTIClient>) | null = null;
let oaevClientGetter: (() => Map<string, OpenAEVClient>) | null = null;
let primaryOctiClientGetter: (() => OpenCTIClient | null) | null = null;

/**
 * Configure the OpenCTI client getter function
 */
export function setOpenCTIClientGetter(getter: () => Map<string, OpenCTIClient>): void {
  octiClientGetter = getter;
  log.debug('Client manager: OpenCTI client getter configured');
}

/**
 * Configure the OpenAEV client getter function
 */
export function setOpenAEVClientGetter(getter: () => Map<string, OpenAEVClient>): void {
  oaevClientGetter = getter;
  log.debug('Client manager: OpenAEV client getter configured');
}

/**
 * Configure the primary OpenCTI client getter function
 */
export function setPrimaryOpenCTIClientGetter(getter: () => OpenCTIClient | null): void {
  primaryOctiClientGetter = getter;
  log.debug('Client manager: Primary OpenCTI client getter configured');
}

/**
 * Get OpenCTI clients map
 */
export function getOpenCTIClients(): Map<string, OpenCTIClient> {
  if (!octiClientGetter) {
    log.warn('OpenCTI client getter not configured, returning empty map');
    return new Map();
  }
  return octiClientGetter();
}

/**
 * Get OpenAEV clients map
 */
export function getOpenAEVClients(): Map<string, OpenAEVClient> {
  if (!oaevClientGetter) {
    log.warn('OpenAEV client getter not configured, returning empty map');
    return new Map();
  }
  return oaevClientGetter();
}

/**
 * Get primary OpenCTI client
 */
export function getPrimaryOpenCTIClient(): OpenCTIClient | null {
  if (!primaryOctiClientGetter) {
    log.warn('Primary OpenCTI client getter not configured, returning null');
    return null;
  }
  return primaryOctiClientGetter();
}

/**
 * Get first OpenAEV client
 */
export function getFirstOpenAEVClient(): OpenAEVClient | undefined {
  const clients = getOpenAEVClients();
  return clients.values().next().value;
}

/**
 * Check if any OpenCTI clients are configured
 */
export function hasOpenCTIClients(): boolean {
  return getOpenCTIClients().size > 0;
}

/**
 * Check if any OpenAEV clients are configured
 */
export function hasOpenAEVClients(): boolean {
  return getOpenAEVClients().size > 0;
}

/**
 * Get platform counts
 */
export function getPlatformCounts(): { opencti: number; openaev: number } {
  return {
    opencti: getOpenCTIClients().size,
    openaev: getOpenAEVClients().size,
  };
}

