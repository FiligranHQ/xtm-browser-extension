/**
 * Platform Handler Utilities
 * 
 * Common utilities for platform message handlers to reduce code duplication.
 */

import { loggers } from '../../shared/utils/logger';
import { errorResponse, successResponse } from '../../shared/types/common';
import type { ExtensionSettings } from '../../shared/types/settings';

const log = loggers.background;

/** Response function type */
export type SendResponse = (response: { success: boolean; data?: unknown; error?: string }) => void;

/** Generic platform client interface with getters */
export interface PlatformClientMap<T> {
  size: number;
  get(platformId: string): T | undefined;
  entries(): IterableIterator<[string, T]>;
  keys(): IterableIterator<string>;
}

/**
 * Check if clients are available and send error if not
 */
export function checkClientsConfigured<T>(
  clients: PlatformClientMap<T>,
  sendResponse: SendResponse,
  errorMessage = 'Not configured'
): boolean {
  if (clients.size === 0) {
    sendResponse(errorResponse(errorMessage));
    return false;
  }
  return true;
}

/**
 * Get a specific platform client or send error
 */
export function getClientOrError<T>(
  clients: PlatformClientMap<T>,
  platformId: string,
  sendResponse: SendResponse
): T | null {
  const client = clients.get(platformId);
  if (!client) {
    sendResponse(errorResponse('Platform not found'));
    return null;
  }
  return client;
}

/**
 * Get target platform client (specific or first available)
 */
export function getTargetClient<T>(
  clients: PlatformClientMap<T>,
  platformId?: string
): { client: T | undefined; targetPlatformId: string | undefined } {
  const targetPlatformId = platformId || clients.keys().next().value as string | undefined;
  const client = targetPlatformId ? clients.get(targetPlatformId) : undefined;
  return { client, targetPlatformId };
}

/**
 * Get target platform client or send error response.
 * Returns null and sends error response if client not found.
 * 
 * This is a convenience wrapper that combines getTargetClient with error handling,
 * reducing the common pattern of:
 * ```
 * const { client, targetPlatformId } = getTargetClient(clients, platformId);
 * if (!client || !targetPlatformId) {
 *   sendResponse(errorResponse('Platform not found'));
 *   return;
 * }
 * ```
 */
export function getTargetClientOrError<T>(
  clients: PlatformClientMap<T>,
  platformId: string | undefined,
  sendResponse: SendResponse
): { client: T; platformId: string } | null {
  const { client, targetPlatformId } = getTargetClient(clients, platformId);
  if (!client || !targetPlatformId) {
    sendResponse(errorResponse('Platform not found'));
    return null;
  }
  return { client, platformId: targetPlatformId };
}

/**
 * Fetch from single platform with platform ID attached to results
 */
export async function fetchFromSinglePlatform<T, R>(
  client: T,
  platformId: string,
  fetchFn: (client: T) => Promise<R[]>,
  sendResponse: SendResponse
): Promise<void> {
  try {
    const results = await fetchFn(client);
    sendResponse(successResponse(results.map(r => ({ ...r, platformId }))));
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Fetch failed',
    });
  }
}

/**
 * Fetch from all platforms in parallel with timeout and deduplication
 * @param clients - Map of platform clients
 * @param fetchFn - Function to call on each client
 * @param timeoutMs - Timeout in milliseconds
 * @param getItemId - Function to get unique ID from item (for deduplication)
 * @param logPrefix - Prefix for log messages
 */
export async function fetchFromAllPlatforms<T, R extends { id: string }>(
  clients: PlatformClientMap<T>,
  fetchFn: (client: T) => Promise<R[]>,
  timeoutMs: number,
  logPrefix = ''
): Promise<{ results: (R & { platformId: string })[]; errors: { platformId: string; error: unknown }[] }> {
  const allResults: (R & { platformId: string })[] = [];
  const errors: { platformId: string; error: unknown }[] = [];
  const seenIds = new Set<string>();
  
  const fetchPromises = Array.from(clients.entries()).map(async ([pId, client]) => {
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), timeoutMs)
      );
      const items = await Promise.race([fetchFn(client), timeoutPromise]);
      return { platformId: pId, items, error: null };
    } catch (e) {
      log.warn(`${logPrefix} Failed to fetch from platform ${pId}:`, e);
      return { platformId: pId, items: [] as R[], error: e };
    }
  });
  
  const results = await Promise.all(fetchPromises);
  
  for (const result of results) {
    if (result.error) {
      errors.push({ platformId: result.platformId, error: result.error });
    }
    for (const item of result.items) {
      if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        allResults.push({ ...item, platformId: result.platformId });
      }
    }
  }
  
  return { results: allResults, errors };
}

/**
 * Search across platforms in parallel with timeout
 * Results are NOT deduplicated (same entity can exist in multiple platforms)
 */
export async function searchAcrossPlatforms<T, R>(
  clients: PlatformClientMap<T>,
  platformId: string | undefined,
  searchFn: (client: T) => Promise<R[]>,
  timeoutMs: number,
  logPrefix = ''
): Promise<(R & { platformId: string })[]> {
  const clientsToSearch = platformId
    ? [[platformId, clients.get(platformId)] as const].filter(([_, c]) => c)
    : Array.from(clients.entries());
  
  const searchPromises = clientsToSearch.map(async ([pId, client]) => {
    if (!client) return { platformId: pId, results: [] as R[] };
    
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), timeoutMs)
      );
      const results = await Promise.race([searchFn(client), timeoutPromise]);
      return { platformId: pId, results };
    } catch (e) {
      log.warn(`${logPrefix} Search timeout/error for platform ${pId}:`, e);
      return { platformId: pId, results: [] as R[] };
    }
  });
  
  const searchResults = await Promise.all(searchPromises);
  return searchResults.flatMap(r => r.results.map(item => ({ ...item, platformId: r.platformId })));
}

/**
 * Standard error handler for message handlers
 */
export function handleError(
  error: unknown,
  sendResponse: SendResponse,
  defaultMessage: string
): void {
  sendResponse({
    success: false,
    error: error instanceof Error ? error.message : defaultMessage,
  });
}

/**
 * Create a handler that requires configured clients
 */
export function withClientCheck<T>(
  getClients: () => PlatformClientMap<T>,
  handler: (clients: PlatformClientMap<T>, sendResponse: SendResponse) => Promise<void>
): (sendResponse: SendResponse) => Promise<void> {
  return async (sendResponse) => {
    const clients = getClients();
    if (!checkClientsConfigured(clients, sendResponse)) return;
    await handler(clients, sendResponse);
  };
}

// ============================================================================
// Platform Connection Testing
// ============================================================================

/** Client interface for connection testing */
export interface TestableClient {
  testConnection(): Promise<unknown>;
}

/** Client factory function */
export type ClientFactory<T extends TestableClient> = (config: {
  id: string;
  name: string;
  url: string;
  apiToken: string;
  enabled: boolean;
}) => T;

/** Platform connection test request */
export interface ConnectionTestRequest {
  platformId?: string;
  url?: string;
  apiToken?: string;
  temporary?: boolean;
}

/** Platform connection test dependencies */
export interface ConnectionTestDeps<T extends TestableClient> {
  /** Get settings function */
  getSettings: () => Promise<ExtensionSettings>;
  /** Map of cached clients */
  clients: Map<string, T>;
  /** Client factory for creating new clients */
  createClient: ClientFactory<T>;
  /** Settings key for platform configs (e.g., 'openctiPlatforms' or 'openaevPlatforms') */
  settingsKey: 'openctiPlatforms' | 'openaevPlatforms';
  /** Connection timeout in ms */
  timeoutMs?: number;
}

/**
 * Test platform connection with support for both temporary and saved platforms.
 * 
 * This utility consolidates the duplicated connection testing logic that was in
 * background/index.ts for OpenCTI and OpenAEV platforms.
 * 
 * @example
 * ```typescript
 * await testPlatformConnection(
 *   { platformId: 'my-platform', temporary: false },
 *   {
 *     getSettings,
 *     clients: openCTIClients,
 *     createClient: (config) => new OpenCTIClient(config),
 *     settingsKey: 'openctiPlatforms',
 *   },
 *   sendResponse
 * );
 * ```
 */
export async function testPlatformConnection<T extends TestableClient>(
  request: ConnectionTestRequest,
  deps: ConnectionTestDeps<T>,
  sendResponse: SendResponse
): Promise<void> {
  const { platformId, url, apiToken, temporary } = request;
  const { getSettings, clients, createClient, settingsKey, timeoutMs = 30000 } = deps;

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Connection timeout')), timeoutMs)
  );

  try {
    if (temporary && url && apiToken) {
      // Test with temporary credentials
      const tempClient = createClient({
        id: 'temp',
        name: 'temp',
        url,
        apiToken,
        enabled: true,
      });
      const info = await Promise.race([tempClient.testConnection(), timeoutPromise]);
      sendResponse(successResponse(info));
    } else if (platformId) {
      // Test saved platform
      const currentSettings = await getSettings();
      let client = clients.get(platformId);
      
      if (!client) {
        const platformConfigs = currentSettings[settingsKey] || [];
        const platformConfig = platformConfigs.find(p => p.id === platformId);
        
        if (platformConfig?.url && platformConfig?.apiToken) {
          client = createClient({
            id: platformConfig.id,
            name: platformConfig.name,
            url: platformConfig.url,
            apiToken: platformConfig.apiToken,
            enabled: platformConfig.enabled ?? true,
          });
          clients.set(platformId, client);
        }
      }
      
      if (!client) {
        sendResponse(errorResponse('Platform not configured'));
        return;
      }
      
      const info = await Promise.race([client.testConnection(), timeoutPromise]);
      sendResponse(successResponse(info));
    } else {
      sendResponse(errorResponse('Missing platformId or temporary credentials'));
    }
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    });
  }
}

