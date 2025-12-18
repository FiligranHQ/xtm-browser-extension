/**
 * Storage Utilities
 * 
 * Wrapper functions for browser storage API with type safety.
 */

import type { ExtensionSettings } from '../types/settings';

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
export async function getCachedOCTIEntityNames(): Promise<string[]> {
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
// OpenCTI Cache (Per-Platform)
// ============================================================================

export interface CachedOCTIEntity {
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
    'Threat-Actor-Group': CachedOCTIEntity[];
    'Threat-Actor-Individual': CachedOCTIEntity[];
    'Intrusion-Set': CachedOCTIEntity[];
    'Campaign': CachedOCTIEntity[];
    'Incident': CachedOCTIEntity[];
    'Malware': CachedOCTIEntity[];
    'Attack-Pattern': CachedOCTIEntity[];
    // Note: Vulnerability/CVE is NOT cached - searched in real-time
    'Sector': CachedOCTIEntity[];
    'Organization': CachedOCTIEntity[];
    'Individual': CachedOCTIEntity[];
    'Event': CachedOCTIEntity[];
    // Location types separated
    'Country': CachedOCTIEntity[];
    'Region': CachedOCTIEntity[];
    'City': CachedOCTIEntity[];
    'Administrative-Area': CachedOCTIEntity[];
    'Position': CachedOCTIEntity[];
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
 * Get the full multi-platform OpenCTI cache
 */
export async function getMultiPlatformOCTICache(): Promise<MultiPlatformOCTICache> {
  const result = await chrome.storage.local.get(OCTI_CACHE_KEY);
  const cache = result[OCTI_CACHE_KEY] as MultiPlatformOCTICache | undefined;
  
  if (!cache) return { platforms: {} };
  
  return cache;
}

/**
 * Get OpenCTI cache for a specific platform
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
 * Check if OpenCTI cache is expired for a platform
 */
export async function isOCTICacheExpired(platformId?: string): Promise<boolean> {
  const cache = await getOCTICache(platformId);
  if (!cache) return true;
  
  return Date.now() - cache.timestamp > OCTI_CACHE_DURATION;
}

/**
 * Check if OpenCTI cache needs refresh for a platform
 */
export async function shouldRefreshOCTICache(platformId?: string): Promise<boolean> {
  const cache = await getOCTICache(platformId);
  if (!cache) return true;
  
  return Date.now() - cache.lastRefresh > OCTI_REFRESH_INTERVAL;
}

/**
 * Maximum entities per type
 * With unlimitedStorage permission, the quota is much higher (100s of MB)
 * Set to 50000 to handle large OpenCTI instances while still providing some protection
 */
const MAX_ENTITIES_PER_TYPE = 50000;

/**
 * Flag to track if we've already warned about quota issues
 */
let quotaWarningShown = false;

/**
 * Trim cache to fit within limits
 */
function trimOCTICache(cache: OCTIEntityCache): OCTIEntityCache {
  for (const entityType of Object.keys(cache.entities) as (keyof OCTIEntityCache['entities'])[]) {
    if (cache.entities[entityType].length > MAX_ENTITIES_PER_TYPE) {
      // Keep only the most recent entities (assuming they're added in order)
      cache.entities[entityType] = cache.entities[entityType].slice(-MAX_ENTITIES_PER_TYPE);
    }
  }
  return cache;
}

/**
 * Safe storage set with quota error handling
 * Returns true if successful, false if quota exceeded
 */
async function safeStorageSet(data: Record<string, unknown>): Promise<boolean> {
  try {
    await chrome.storage.local.set(data);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('quota') || errorMessage.includes('QUOTA_BYTES')) {
      if (!quotaWarningShown) {
        console.warn('[Storage] Quota exceeded - cache will be limited. Extension continues to work without full cache.');
        quotaWarningShown = true;
      }
      return false;
    }
    // Re-throw non-quota errors
    throw error;
  }
}

/**
 * Save OpenCTI cache for a specific platform
 * Handles quota errors gracefully - the extension will still work without cache
 */
export async function saveOCTICache(cache: OCTIEntityCache, platformId: string): Promise<void> {
  const multiCache = await getMultiPlatformOCTICache();
  cache.platformId = platformId;
  
  // Trim cache to fit limits
  const trimmedCache = trimOCTICache(cache);
  multiCache.platforms[platformId] = trimmedCache;
  
  // Try to save
  let success = await safeStorageSet({ [OCTI_CACHE_KEY]: multiCache });
  
  if (!success) {
    // Quota exceeded - try with minimal cache (just entity names for detection)
    console.warn(`[Storage] Quota exceeded for platform ${platformId}, reducing cache size...`);
    
    // Create minimal cache with only essential data
    const minimalCache = createMinimalOCTICache(trimmedCache);
    multiCache.platforms[platformId] = minimalCache;
    
    success = await safeStorageSet({ [OCTI_CACHE_KEY]: multiCache });
    
    if (!success) {
      // Still failing - clear this platform's cache entirely
      console.warn(`[Storage] Still exceeding quota, clearing cache for platform ${platformId}`);
      delete multiCache.platforms[platformId];
      await safeStorageSet({ [OCTI_CACHE_KEY]: multiCache });
    }
  }
}

/**
 * Create minimal cache with only essential data for detection
 * This is a fallback when even the unlimited storage hits extreme cases
 */
function createMinimalOCTICache(cache: OCTIEntityCache): OCTIEntityCache {
  const minimal = createEmptyOCTICache(cache.platformId);
  minimal.timestamp = cache.timestamp;
  minimal.lastRefresh = cache.lastRefresh;
  
  // Keep only first 10000 entities per type with minimal data
  const MINIMAL_LIMIT = 10000;
  for (const entityType of Object.keys(cache.entities) as (keyof OCTIEntityCache['entities'])[]) {
    minimal.entities[entityType] = cache.entities[entityType]
      .slice(0, MINIMAL_LIMIT)
      .map(e => ({
        id: e.id,
        name: e.name,
        type: e.type,
        aliases: e.aliases?.slice(0, 5), // Limit aliases
        // Omit description to save space
      }));
  }
  
  return minimal;
}

/**
 * Update OpenCTI cache for a specific entity type on a platform
 */
export async function updateOCTICacheForType(
  entityType: keyof OCTIEntityCache['entities'],
  entities: CachedOCTIEntity[],
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
 * Add a single entity to the OpenCTI cache for a specific platform
 * This is used when creating new entities to avoid needing a full cache refresh
 */
export async function addEntityToOCTICache(
  entity: CachedOCTIEntity,
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
 * Create empty OpenCTI cache structure
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
 * Returns an array of entities per name to support entities with the same name but different types
 * (e.g., "Phishing" as both Malware and Attack Pattern)
 */
export async function getAllCachedOCTIEntityNamesForMatching(): Promise<Map<string, CachedOCTIEntity[]>> {
  const multiCache = await getMultiPlatformOCTICache();
  const nameMap = new Map<string, CachedOCTIEntity[]>();
  
  // Helper to add entity to map
  const addToMap = (key: string, entity: CachedOCTIEntity) => {
    const existing = nameMap.get(key);
    if (existing) {
      // Only add if not already in the array (by id)
      if (!existing.some(e => e.id === entity.id)) {
        existing.push(entity);
      }
    } else {
      nameMap.set(key, [entity]);
    }
  };
  
  // Merge entities from all platforms
  for (const [platformId, cache] of Object.entries(multiCache.platforms)) {
    for (const entityType of Object.keys(cache.entities) as Array<keyof OCTIEntityCache['entities']>) {
      for (const entity of cache.entities[entityType]) {
        // Add main name with platform info (only if long enough and not excluded)
        const entityWithPlatform = { ...entity, platformId };
        const nameLower = entity.name.toLowerCase();
        if (entity.name.length >= MIN_NAME_LENGTH && !EXCLUDED_TERMS.has(nameLower)) {
          addToMap(nameLower, entityWithPlatform);
        }
        
        // Add aliases (only if long enough and not excluded)
        if (entity.aliases) {
          for (const alias of entity.aliases) {
            const aliasLower = alias.toLowerCase();
            if (alias.length >= MIN_NAME_LENGTH && !EXCLUDED_TERMS.has(aliasLower)) {
              addToMap(aliasLower, entityWithPlatform);
            }
          }
        }
        
        // Add x_mitre_id for attack patterns (e.g., T1059, T1059.001)
        // These are short but specific identifiers, so we include them regardless of length
        if (entity.x_mitre_id) {
          addToMap(entity.x_mitre_id.toLowerCase(), entityWithPlatform);
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
 * Clear OpenCTI cache for a specific platform
 */
export async function clearOCTICacheForPlatform(platformId: string): Promise<void> {
  const multiCache = await getMultiPlatformOCTICache();
  delete multiCache.platforms[platformId];
  await chrome.storage.local.set({ [OCTI_CACHE_KEY]: multiCache });
}

/**
 * Clear all OpenCTI caches
 */
export async function clearAllOCTICaches(): Promise<void> {
  await chrome.storage.local.set({ [OCTI_CACHE_KEY]: { platforms: {} } });
}

/**
 * Clean up OpenCTI caches for platforms that no longer exist in settings
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
// OpenAEV Cache (Per-Platform)
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
 * Maximum entities per type for OpenAEV
 * With unlimitedStorage permission, we can handle larger datasets
 */
const MAX_OAEV_ENTITIES_PER_TYPE = 20000;

/**
 * Trim OpenAEV cache to fit within limits
 */
function trimOAEVCache(cache: OAEVCache): OAEVCache {
  if (cache.entities.Asset && cache.entities.Asset.length > MAX_OAEV_ENTITIES_PER_TYPE) {
    cache.entities.Asset = cache.entities.Asset.slice(-MAX_OAEV_ENTITIES_PER_TYPE);
  }
  if (cache.entities.AssetGroup && cache.entities.AssetGroup.length > MAX_OAEV_ENTITIES_PER_TYPE) {
    cache.entities.AssetGroup = cache.entities.AssetGroup.slice(-MAX_OAEV_ENTITIES_PER_TYPE);
  }
  if (cache.entities.AttackPattern && cache.entities.AttackPattern.length > MAX_OAEV_ENTITIES_PER_TYPE) {
    cache.entities.AttackPattern = cache.entities.AttackPattern.slice(-MAX_OAEV_ENTITIES_PER_TYPE);
  }
  if (cache.entities.Finding && cache.entities.Finding.length > MAX_OAEV_ENTITIES_PER_TYPE) {
    cache.entities.Finding = cache.entities.Finding.slice(-MAX_OAEV_ENTITIES_PER_TYPE);
  }
  if (cache.entities.Player && cache.entities.Player.length > MAX_OAEV_ENTITIES_PER_TYPE) {
    cache.entities.Player = cache.entities.Player.slice(-MAX_OAEV_ENTITIES_PER_TYPE);
  }
  if (cache.entities.Team && cache.entities.Team.length > MAX_OAEV_ENTITIES_PER_TYPE) {
    cache.entities.Team = cache.entities.Team.slice(-MAX_OAEV_ENTITIES_PER_TYPE);
  }
  return cache;
}

/**
 * Save OpenAEV cache for a specific platform
 * Handles quota errors gracefully - the extension will still work without cache
 */
export async function saveOAEVCache(cache: OAEVCache, platformId: string): Promise<void> {
  const multiCache = await getMultiPlatformOAEVCache();
  cache.platformId = platformId;
  
  // Trim cache to fit limits
  const trimmedCache = trimOAEVCache(cache);
  multiCache.platforms[platformId] = trimmedCache;
  
  // Try to save
  let success = await safeStorageSet({ [OAEV_CACHE_KEY]: multiCache });
  
  if (!success) {
    // Quota exceeded - try clearing this platform's cache
    console.warn(`[Storage] Quota exceeded for OpenAEV platform ${platformId}, clearing cache...`);
    delete multiCache.platforms[platformId];
    await safeStorageSet({ [OAEV_CACHE_KEY]: multiCache });
  }
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
export async function getAllCachedOAEVEntityNamesForMatching(): Promise<Map<string, CachedOAEVEntity[]>> {
  const multiCache = await getMultiPlatformOAEVCache();
  const nameMap = new Map<string, CachedOAEVEntity[]>();
  
  // Helper to add entity to map
  const addToMap = (key: string, entity: CachedOAEVEntity) => {
    const existing = nameMap.get(key);
    if (existing) {
      // Only add if not already in the array (by id)
      if (!existing.some(e => e.id === entity.id)) {
        existing.push(entity);
      }
    } else {
      nameMap.set(key, [entity]);
    }
  };
  
  for (const [platformId, cache] of Object.entries(multiCache.platforms)) {
    for (const entityType of Object.keys(cache.entities) as Array<keyof OAEVCache['entities']>) {
      for (const entity of cache.entities[entityType]) {
        const entityWithPlatform = { ...entity, platformId };
        // Add main name (only if long enough and not excluded)
        const nameLower = entity.name.toLowerCase();
        if (entity.name.length >= MIN_NAME_LENGTH && !EXCLUDED_TERMS.has(nameLower)) {
          addToMap(nameLower, entityWithPlatform);
        }
        
        // Add aliases (hostnames, IPs) - only if long enough and not excluded
        if (entity.aliases) {
          for (const alias of entity.aliases) {
            const aliasLower = alias.toLowerCase();
            if (alias.length >= MIN_NAME_LENGTH && !EXCLUDED_TERMS.has(aliasLower)) {
              addToMap(aliasLower, entityWithPlatform);
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

// ============================================================================
// Storage Quota Management
// ============================================================================

/**
 * Get storage usage information
 */
export async function getStorageUsage(): Promise<{ used: number; quota: number; percentage: number }> {
  try {
    // Get bytes in use
    const bytesInUse = await chrome.storage.local.getBytesInUse();
    // Chrome local storage quota is typically 10MB (10485760 bytes)
    const quota = chrome.storage.local.QUOTA_BYTES || 10485760;
    return {
      used: bytesInUse,
      quota,
      percentage: Math.round((bytesInUse / quota) * 100),
    };
  } catch {
    return { used: 0, quota: 10485760, percentage: 0 };
  }
}

/**
 * Clear all caches to recover from quota issues
 * This should only be called as a last resort
 */
export async function clearAllCaches(): Promise<void> {
  console.warn('[Storage] Clearing all caches to recover from quota issues');
  quotaWarningShown = false;
  
  try {
    // Clear OCTI cache
    await chrome.storage.local.remove(OCTI_CACHE_KEY);
  } catch (e) {
    console.error('[Storage] Failed to clear OCTI cache:', e);
  }
  
  try {
    // Clear OAEV cache
    await chrome.storage.local.remove(OAEV_CACHE_KEY);
  } catch (e) {
    console.error('[Storage] Failed to clear OAEV cache:', e);
  }
  
  try {
    // Clear entity names cache
    await chrome.storage.local.remove('entityNames');
  } catch (e) {
    console.error('[Storage] Failed to clear entity names cache:', e);
  }
  
  // Clear any scan caches (keys starting with 'scan_')
  try {
    const allStorage = await chrome.storage.local.get(null);
    const scanKeys = Object.keys(allStorage).filter(k => k.startsWith('scan_'));
    if (scanKeys.length > 0) {
      await chrome.storage.local.remove(scanKeys);
    }
  } catch (e) {
    console.error('[Storage] Failed to clear scan caches:', e);
  }
  
  console.log('[Storage] All caches cleared');
}

/**
 * Check if storage is near quota and warn
 * Returns true if storage is critically low (>90% used)
 */
export async function isStorageNearQuota(): Promise<boolean> {
  const usage = await getStorageUsage();
  if (usage.percentage > 90) {
    console.warn(`[Storage] Storage usage critical: ${usage.percentage}% (${Math.round(usage.used / 1024)}KB / ${Math.round(usage.quota / 1024)}KB)`);
    return true;
  }
  if (usage.percentage > 75) {
    console.log(`[Storage] Storage usage high: ${usage.percentage}%`);
  }
  return false;
}
