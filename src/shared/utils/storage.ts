/**
 * Storage Utilities
 * 
 * Wrapper functions for browser storage API with type safety.
 */

import type { ExtensionSettings } from '../types';

// ============================================================================
// Settings Storage
// ============================================================================

/**
 * Get extension settings from storage
 */
export async function getSettings(): Promise<ExtensionSettings> {
  const result = await chrome.storage.local.get('settings');
  const settings = result.settings || {};
  
  const defaultSettings: ExtensionSettings = {
    openctiPlatforms: [],
    openaevPlatforms: [],
    theme: 'auto',
    autoScan: false,
    scanOnLoad: false,
    showNotifications: true,
  };
  
  return { ...defaultSettings, ...settings };
}

/**
 * Save extension settings to storage
 */
export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  await chrome.storage.local.set({ settings });
}

/**
 * Update specific settings
 */
export async function updateSettings(
  updates: Partial<ExtensionSettings>
): Promise<ExtensionSettings> {
  const current = await getSettings();
  const updated = { ...current, ...updates };
  await saveSettings(updated);
  return updated;
}

// ============================================================================
// Scan Results Cache
// ============================================================================

interface ScanCache {
  url: string;
  timestamp: number;
  results: {
    observables: unknown[];
    octiEntities: unknown[];
    cves: unknown[];
  };
}

/**
 * Get cached scan results for a URL
 */
export async function getCachedScan(url: string): Promise<ScanCache | null> {
  const result = await chrome.storage.local.get(`scan_${btoa(url)}`);
  const cache = result[`scan_${btoa(url)}`] as ScanCache | undefined;
  
  if (!cache) return null;
  
  // Cache expires after 5 minutes
  if (Date.now() - cache.timestamp > 5 * 60 * 1000) {
    await chrome.storage.local.remove(`scan_${btoa(url)}`);
    return null;
  }
  
  return cache;
}

/**
 * Cache scan results for a URL
 */
export async function cacheScanResults(
  url: string,
  results: ScanCache['results']
): Promise<void> {
  const cache: ScanCache = {
    url,
    timestamp: Date.now(),
    results,
  };
  await chrome.storage.local.set({ [`scan_${btoa(url)}`]: cache });
}

// ============================================================================
// Entity Names Cache (simple names list for quick detection)
// ============================================================================

interface EntityNamesCache {
  timestamp: number;
  names: string[];
}

/**
 * Get cached entity names
 */
export async function getCachedEntityNames(): Promise<string[]> {
  const result = await chrome.storage.local.get('entityNames');
  const cache = result.entityNames as EntityNamesCache | undefined;
  
  if (!cache) return [];
  
  // Cache expires after 1 hour
  if (Date.now() - cache.timestamp > 60 * 60 * 1000) {
    return [];
  }
  
  return cache.names;
}

/**
 * Cache entity names
 */
export async function cacheEntityNames(names: string[]): Promise<void> {
  const cache: EntityNamesCache = {
    timestamp: Date.now(),
    names,
  };
  await chrome.storage.local.set({ entityNames: cache });
}

// ============================================================================
// OpenCTI Entity Cache - Structured Entity Cache (Per-Platform)
// ============================================================================

export interface CachedEntity {
  id: string;
  name: string;
  aliases?: string[];
  x_mitre_id?: string; // MITRE ATT&CK ID for attack patterns (e.g., T1059, T1059.001)
  type: string;
  platformId?: string; // Track which platform this came from
}

// Minimum length for names/aliases to avoid false positives
const MIN_NAME_LENGTH = 4;

// Common terms that should be excluded from entity name matching
// These are generic words that may appear as aliases but cause false positives
const EXCLUDED_TERMS = new Set([
  'page',
  'test',
  'demo',
  'example',
  'sample',
  'default',
  'unknown',
  'none',
  'null',
  'undefined',
  'true',
  'false',
]);

export interface OCTIEntityCache {
  timestamp: number;
  lastRefresh: number;
  platformId: string;
  entities: {
    'Threat-Actor-Group': CachedEntity[];
    'Threat-Actor-Individual': CachedEntity[];
    'Intrusion-Set': CachedEntity[];
    'Campaign': CachedEntity[];
    'Incident': CachedEntity[];
    'Malware': CachedEntity[];
    'Attack-Pattern': CachedEntity[];
    // Note: Vulnerability/CVE is NOT cached - searched in real-time
    'Sector': CachedEntity[];
    'Organization': CachedEntity[];
    'Individual': CachedEntity[];
    'Event': CachedEntity[];
    // Location types separated
    'Country': CachedEntity[];
    'Region': CachedEntity[];
    'City': CachedEntity[];
    'Administrative-Area': CachedEntity[];
    'Position': CachedEntity[];
  };
}

// Multi-platform cache structure
export interface MultiPlatformOCTICache {
  platforms: Record<string, OCTIEntityCache>;
}

const OCTI_CACHE_KEY = 'octiCacheMulti';
const OCTI_CACHE_DURATION = 60 * 60 * 1000; // 1 hour default
const OCTI_REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes

/**
 * Get the full multi-platform OpenCTI entity cache
 */
export async function getMultiPlatformOCTICache(): Promise<MultiPlatformOCTICache> {
  const result = await chrome.storage.local.get(OCTI_CACHE_KEY);
  const cache = result[OCTI_CACHE_KEY] as MultiPlatformOCTICache | undefined;
  
  if (!cache) return { platforms: {} };
  
  return cache;
}

/**
 * Get OpenCTI entity cache for a specific platform
 */
export async function getOCTICache(platformId?: string): Promise<OCTIEntityCache | null> {
  const multiCache = await getMultiPlatformOCTICache();
  
  if (!platformId) {
    // Return first available cache when no specific platform is requested
    const platformIds = Object.keys(multiCache.platforms);
    if (platformIds.length === 0) return null;
    return multiCache.platforms[platformIds[0]];
  }
  
  return multiCache.platforms[platformId] || null;
}

/**
 * Check if OpenCTI entity cache is expired for a platform
 */
export async function isOCTICacheExpired(platformId?: string): Promise<boolean> {
  const cache = await getOCTICache(platformId);
  if (!cache) return true;
  
  return Date.now() - cache.timestamp > OCTI_CACHE_DURATION;
}

/**
 * Check if OpenCTI entity cache needs refresh for a platform
 */
export async function shouldRefreshOCTICache(platformId?: string): Promise<boolean> {
  const cache = await getOCTICache(platformId);
  if (!cache) return true;
  
  return Date.now() - cache.lastRefresh > OCTI_REFRESH_INTERVAL;
}

/**
 * Save OpenCTI entity cache for a specific platform
 */
export async function saveOCTICache(cache: OCTIEntityCache, platformId: string): Promise<void> {
  const multiCache = await getMultiPlatformOCTICache();
  cache.platformId = platformId;
  multiCache.platforms[platformId] = cache;
  await chrome.storage.local.set({ [OCTI_CACHE_KEY]: multiCache });
}

/**
 * Update OpenCTI entity cache for a specific entity type on a platform
 */
export async function updateOCTICacheForType(
  entityType: keyof OCTIEntityCache['entities'],
  entities: CachedEntity[],
  platformId: string
): Promise<void> {
  let cache = await getOCTICache(platformId);
  
  if (!cache) {
    cache = createEmptyOCTICache(platformId);
  }
  
  cache.entities[entityType] = entities;
  cache.lastRefresh = Date.now();
  
  await saveOCTICache(cache, platformId);
}

/**
 * Add a single entity to the OpenCTI entity cache for a specific platform
 * This is used when creating new entities to avoid needing a full cache refresh
 */
export async function addEntityToOCTICache(
  entity: CachedEntity,
  platformId: string
): Promise<void> {
  let cache = await getOCTICache(platformId);
  
  if (!cache) {
    cache = createEmptyOCTICache(platformId);
  }
  
  // Determine the entity type key for the cache
  const entityType = entity.type as keyof OCTIEntityCache['entities'];
  
  // Check if this entity type exists in the cache structure
  if (!cache.entities[entityType]) {
    // Entity type not cached (e.g., Vulnerability) - skip
    return;
  }
  
  // Check if entity already exists in cache (by id)
  const existingIndex = cache.entities[entityType].findIndex(e => e.id === entity.id);
  if (existingIndex === -1) {
    // Add new entity
    cache.entities[entityType].push(entity);
  } else {
    // Update existing entity
    cache.entities[entityType][existingIndex] = entity;
  }
  
  await saveOCTICache(cache, platformId);
}

/**
 * Create empty OpenCTI entity cache structure
 */
export function createEmptyOCTICache(platformId: string = 'default'): OCTIEntityCache {
  return {
    timestamp: Date.now(),
    lastRefresh: Date.now(),
    platformId,
    entities: {
      'Threat-Actor-Group': [],
      'Threat-Actor-Individual': [],
      'Intrusion-Set': [],
      'Campaign': [],
      'Incident': [],
      'Malware': [],
      'Attack-Pattern': [],
      'Sector': [],
      'Organization': [],
      'Individual': [],
      'Event': [],
      'Country': [],
      'Region': [],
      'City': [],
      'Administrative-Area': [],
      'Position': [],
    },
  };
}

/**
 * Get all entity names and aliases for matching from ALL platforms (merged)
 * Filters out names/aliases shorter than MIN_NAME_LENGTH and excluded terms to avoid false positives
 */
export async function getAllCachedEntityNamesForMatching(): Promise<Map<string, CachedEntity>> {
  const multiCache = await getMultiPlatformOCTICache();
  const nameMap = new Map<string, CachedEntity>();
  
  // Merge entities from all platforms
  for (const [platformId, cache] of Object.entries(multiCache.platforms)) {
    for (const entityType of Object.keys(cache.entities) as Array<keyof OCTIEntityCache['entities']>) {
      for (const entity of cache.entities[entityType]) {
        // Add main name with platform info (only if long enough and not excluded)
        const entityWithPlatform = { ...entity, platformId };
        const nameLower = entity.name.toLowerCase();
        if (entity.name.length >= MIN_NAME_LENGTH && !EXCLUDED_TERMS.has(nameLower)) {
          nameMap.set(nameLower, entityWithPlatform);
        }
        
        // Add aliases (only if long enough and not excluded)
        if (entity.aliases) {
          for (const alias of entity.aliases) {
            const aliasLower = alias.toLowerCase();
            if (alias.length >= MIN_NAME_LENGTH && !EXCLUDED_TERMS.has(aliasLower)) {
              nameMap.set(aliasLower, entityWithPlatform);
            }
          }
        }
        
        // Add x_mitre_id for attack patterns (e.g., T1059, T1059.001)
        // These are short but specific identifiers, so we include them regardless of length
        if (entity.x_mitre_id) {
          nameMap.set(entity.x_mitre_id.toLowerCase(), entityWithPlatform);
        }
      }
    }
  }
  
  return nameMap;
}

/**
 * Get cache statistics (combined from all platforms)
 */
export async function getOCTICacheStats(platformId?: string): Promise<{
  total: number;
  byType: Record<string, number>;
  age: number;
  isExpired: boolean;
  platformCount?: number;
} | null> {
  if (platformId) {
    // Stats for specific platform
    const cache = await getOCTICache(platformId);
    if (!cache) return null;
    
    const byType: Record<string, number> = {};
    let total = 0;
    
    for (const [type, entities] of Object.entries(cache.entities)) {
      byType[type] = entities.length;
      total += entities.length;
    }
    
    return {
      total,
      byType,
      age: Date.now() - cache.timestamp,
      isExpired: Date.now() - cache.timestamp > OCTI_CACHE_DURATION,
    };
  }
  
  // Combined stats from all platforms
  const multiCache = await getMultiPlatformOCTICache();
  const platformIds = Object.keys(multiCache.platforms);
  
  if (platformIds.length === 0) return null;
  
  const byType: Record<string, number> = {};
  let total = 0;
  let oldestTimestamp = Date.now();
  
  for (const cache of Object.values(multiCache.platforms)) {
    for (const [type, entities] of Object.entries(cache.entities)) {
      byType[type] = (byType[type] || 0) + entities.length;
      total += entities.length;
    }
    if (cache.timestamp < oldestTimestamp) {
      oldestTimestamp = cache.timestamp;
    }
  }
  
  return {
    total,
    byType,
    age: Date.now() - oldestTimestamp,
    isExpired: Date.now() - oldestTimestamp > OCTI_CACHE_DURATION,
    platformCount: platformIds.length,
  };
}

/**
 * Clear OpenCTI entity cache for a specific platform
 */
export async function clearOCTICacheForPlatform(platformId: string): Promise<void> {
  const multiCache = await getMultiPlatformOCTICache();
  delete multiCache.platforms[platformId];
  await chrome.storage.local.set({ [OCTI_CACHE_KEY]: multiCache });
}

/**
 * Clear all OpenCTI entity caches
 */
export async function clearAllOCTICaches(): Promise<void> {
  await chrome.storage.local.set({ [OCTI_CACHE_KEY]: { platforms: {} } });
}

/**
 * Clean up OpenCTI entity caches for platforms that no longer exist in settings
 */
export async function cleanupOrphanedOCTICaches(validPlatformIds: string[]): Promise<void> {
  const multiCache = await getMultiPlatformOCTICache();
  const existingPlatformIds = Object.keys(multiCache.platforms);
  
  let modified = false;
  for (const platformId of existingPlatformIds) {
    if (!validPlatformIds.includes(platformId)) {
      delete multiCache.platforms[platformId];
      modified = true;
    }
  }
  
  if (modified) {
    await chrome.storage.local.set({ [OCTI_CACHE_KEY]: multiCache });
  }
}

// ============================================================================
// OpenAEV Cache - Structured Entity Cache (Per-Platform)
// ============================================================================

export interface CachedOAEVEntity {
  id: string;
  name: string;
  aliases?: string[];
  type: 'Asset' | 'AssetGroup' | 'Team' | 'Player' | 'AttackPattern' | 'Finding';
  platformId: string;
  // Allow index access for compatibility with Record<string, unknown>
  [key: string]: string | string[] | undefined;
}

export interface OAEVCache {
  timestamp: number;
  lastRefresh: number;
  platformId: string;
  entities: {
    'Asset': CachedOAEVEntity[];
    'AssetGroup': CachedOAEVEntity[];
    'Team': CachedOAEVEntity[];
    'Player': CachedOAEVEntity[];
    'AttackPattern': CachedOAEVEntity[];
    'Finding': CachedOAEVEntity[];
  };
}

export interface MultiPlatformOAEVCache {
  platforms: Record<string, OAEVCache>;
}

const OAEV_CACHE_KEY = 'oaevCacheMulti';
const OAEV_CACHE_DURATION = 60 * 60 * 1000; // 1 hour default
const OAEV_REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes

/**
 * Get the full multi-platform OpenAEV cache
 */
export async function getMultiPlatformOAEVCache(): Promise<MultiPlatformOAEVCache> {
  const result = await chrome.storage.local.get(OAEV_CACHE_KEY);
  const cache = result[OAEV_CACHE_KEY] as MultiPlatformOAEVCache | undefined;
  
  if (!cache) return { platforms: {} };
  
  return cache;
}

/**
 * Get OpenAEV cache for a specific platform
 */
export async function getOAEVCache(platformId?: string): Promise<OAEVCache | null> {
  const multiCache = await getMultiPlatformOAEVCache();
  
  if (!platformId) {
    const platformIds = Object.keys(multiCache.platforms);
    if (platformIds.length === 0) return null;
    return multiCache.platforms[platformIds[0]];
  }
  
  return multiCache.platforms[platformId] || null;
}

/**
 * Check if OpenAEV cache needs refresh for a platform
 */
export async function shouldRefreshOAEVCache(platformId?: string): Promise<boolean> {
  const cache = await getOAEVCache(platformId);
  if (!cache) return true;
  
  return Date.now() - cache.lastRefresh > OAEV_REFRESH_INTERVAL;
}

/**
 * Save OpenAEV cache for a specific platform
 */
export async function saveOAEVCache(cache: OAEVCache, platformId: string): Promise<void> {
  const multiCache = await getMultiPlatformOAEVCache();
  cache.platformId = platformId;
  multiCache.platforms[platformId] = cache;
  await chrome.storage.local.set({ [OAEV_CACHE_KEY]: multiCache });
}

/**
 * Create empty OpenAEV cache structure
 */
export function createEmptyOAEVCache(platformId: string = 'default'): OAEVCache {
  return {
    timestamp: Date.now(),
    lastRefresh: Date.now(),
    platformId,
    entities: {
      'Asset': [],
      'AssetGroup': [],
      'Team': [],
      'Player': [],
      'AttackPattern': [],
      'Finding': [],
    },
  };
}

/**
 * Get all OpenAEV entity names for matching from ALL platforms (merged)
 * Filters out names/aliases shorter than MIN_NAME_LENGTH and excluded terms to avoid false positives
 */
export async function getAllCachedOAEVEntityNamesForMatching(): Promise<Map<string, CachedOAEVEntity>> {
  const multiCache = await getMultiPlatformOAEVCache();
  const nameMap = new Map<string, CachedOAEVEntity>();
  
  for (const [platformId, cache] of Object.entries(multiCache.platforms)) {
    for (const entityType of Object.keys(cache.entities) as Array<keyof OAEVCache['entities']>) {
      for (const entity of cache.entities[entityType]) {
        const entityWithPlatform = { ...entity, platformId };
        // Add main name (only if long enough and not excluded)
        const nameLower = entity.name.toLowerCase();
        if (entity.name.length >= MIN_NAME_LENGTH && !EXCLUDED_TERMS.has(nameLower)) {
          nameMap.set(nameLower, entityWithPlatform);
        }
        
        // Add aliases (hostnames, IPs) - only if long enough and not excluded
        if (entity.aliases) {
          for (const alias of entity.aliases) {
            const aliasLower = alias.toLowerCase();
            if (alias.length >= MIN_NAME_LENGTH && !EXCLUDED_TERMS.has(aliasLower)) {
              nameMap.set(aliasLower, entityWithPlatform);
            }
          }
        }
      }
    }
  }
  
  return nameMap;
}

/**
 * Get OpenAEV cache statistics
 */
export async function getOAEVCacheStats(platformId?: string): Promise<{
  total: number;
  byType: Record<string, number>;
  age: number;
  isExpired: boolean;
  platformCount?: number;
} | null> {
  if (platformId) {
    const cache = await getOAEVCache(platformId);
    if (!cache) return null;
    
    const byType: Record<string, number> = {};
    let total = 0;
    
    for (const [type, entities] of Object.entries(cache.entities)) {
      byType[type] = entities.length;
      total += entities.length;
    }
    
    return {
      total,
      byType,
      age: Date.now() - cache.timestamp,
      isExpired: Date.now() - cache.timestamp > OAEV_CACHE_DURATION,
    };
  }
  
  // Combined stats from all platforms
  const multiCache = await getMultiPlatformOAEVCache();
  const platformIds = Object.keys(multiCache.platforms);
  
  if (platformIds.length === 0) return null;
  
  const byType: Record<string, number> = {};
  let total = 0;
  let oldestTimestamp = Date.now();
  
  for (const cache of Object.values(multiCache.platforms)) {
    for (const [type, entities] of Object.entries(cache.entities)) {
      byType[type] = (byType[type] || 0) + entities.length;
      total += entities.length;
    }
    if (cache.timestamp < oldestTimestamp) {
      oldestTimestamp = cache.timestamp;
    }
  }
  
  return {
    total,
    byType,
    age: Date.now() - oldestTimestamp,
    isExpired: Date.now() - oldestTimestamp > OAEV_CACHE_DURATION,
    platformCount: platformIds.length,
  };
}

/**
 * Clear OpenAEV cache for a specific platform
 */
export async function clearOAEVCacheForPlatform(platformId: string): Promise<void> {
  const multiCache = await getMultiPlatformOAEVCache();
  delete multiCache.platforms[platformId];
  await chrome.storage.local.set({ [OAEV_CACHE_KEY]: multiCache });
}

/**
 * Clear all OpenAEV caches
 */
export async function clearAllOAEVCaches(): Promise<void> {
  await chrome.storage.local.set({ [OAEV_CACHE_KEY]: { platforms: {} } });
}

/**
 * Clean up OpenAEV caches for platforms that no longer exist in settings
 */
export async function cleanupOrphanedOAEVCaches(validPlatformIds: string[]): Promise<void> {
  const multiCache = await getMultiPlatformOAEVCache();
  const existingPlatformIds = Object.keys(multiCache.platforms);
  
  let modified = false;
  for (const platformId of existingPlatformIds) {
    if (!validPlatformIds.includes(platformId)) {
      delete multiCache.platforms[platformId];
      modified = true;
    }
  }
  
  if (modified) {
    await chrome.storage.local.set({ [OAEV_CACHE_KEY]: multiCache });
  }
}
