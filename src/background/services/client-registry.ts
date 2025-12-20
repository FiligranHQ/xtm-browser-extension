/**
 * Client Registry Service
 * 
 * Centralized registry for platform client getters.
 * This module eliminates duplication between cache-manager and client-manager
 * by providing a single source of truth for client getter functions.
 */

import { OpenCTIClient } from '../../shared/api/opencti-client';
import { OpenAEVClient } from '../../shared/api/openaev-client';
import { loggers } from '../../shared/utils/logger';

const log = loggers.background;

// ============================================================================
// Client Getter State
// ============================================================================

/**
 * Client getter functions - must be configured before use
 * These allow services to access the actual client instances
 * from the background script without circular dependencies
 */
let octiClientGetter: (() => Map<string, OpenCTIClient>) | null = null;
let oaevClientGetter: (() => Map<string, OpenAEVClient>) | null = null;
let primaryOctiClientGetter: (() => OpenCTIClient | null) | null = null;

// ============================================================================
// Configuration Functions
// ============================================================================

/**
 * Configure the OpenCTI client getter function
 */
export function setOpenCTIClientGetter(getter: () => Map<string, OpenCTIClient>): void {
  octiClientGetter = getter;
  log.debug('Client registry: OpenCTI client getter configured');
}

/**
 * Configure the OpenAEV client getter function
 */
export function setOpenAEVClientGetter(getter: () => Map<string, OpenAEVClient>): void {
  oaevClientGetter = getter;
  log.debug('Client registry: OpenAEV client getter configured');
}

/**
 * Configure the primary OpenCTI client getter function
 */
export function setPrimaryOpenCTIClientGetter(getter: () => OpenCTIClient | null): void {
  primaryOctiClientGetter = getter;
  log.debug('Client registry: Primary OpenCTI client getter configured');
}

// ============================================================================
// Client Access Functions
// ============================================================================

/**
 * Get OpenCTI clients using the configured getter
 */
export function getOpenCTIClients(): Map<string, OpenCTIClient> {
  if (!octiClientGetter) {
    log.warn('OpenCTI client getter not configured, returning empty map');
    return new Map();
  }
  return octiClientGetter();
}

/**
 * Get OpenAEV clients using the configured getter
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
 * Get first OpenAEV client (convenience function)
 */
export function getFirstOpenAEVClient(): OpenAEVClient | undefined {
  const clients = getOpenAEVClients();
  return clients.values().next().value;
}

/**
 * Check if OpenCTI clients are configured
 */
export function hasOpenCTIClients(): boolean {
  return octiClientGetter !== null && getOpenCTIClients().size > 0;
}

/**
 * Check if OpenAEV clients are configured
 */
export function hasOpenAEVClients(): boolean {
  return oaevClientGetter !== null && getOpenAEVClients().size > 0;
}

