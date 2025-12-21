/**
 * Storage Utilities Tests
 * 
 * Tests for browser storage API wrappers with type safety.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  sessionStorage,
  getSettings,
  saveSettings,
  updateSettings,
  getCachedScan,
  cacheScanResults,
  getCachedOCTIEntityNames,
  cacheEntityNames,
  getMultiPlatformOCTICache,
  getOCTICache,
  isOCTICacheExpired,
  shouldRefreshOCTICache,
  saveOCTICache,
  updateOCTICacheForType,
  addEntityToOCTICache,
  createEmptyOCTICache,
  getAllCachedOCTIEntityNamesForMatching,
  getOCTICacheStats,
  clearOCTICacheForPlatform,
  clearAllOCTICaches,
  cleanupOrphanedOCTICaches,
  getMultiPlatformOAEVCache,
  getOAEVCache,
  shouldRefreshOAEVCache,
  saveOAEVCache,
  createEmptyOAEVCache,
  getAllCachedOAEVEntityNamesForMatching,
  getOAEVCacheStats,
  clearOAEVCacheForPlatform,
  clearAllOAEVCaches,
  cleanupOrphanedOAEVCaches,
  getStorageUsage,
  clearAllCaches,
  isStorageNearQuota,
  type OCTIEntityCache,
  type CachedOCTIEntity,
  type OAEVCache,
  type CachedOAEVEntity,
} from '../../src/shared/utils/storage';

// ============================================================================
// Test Setup - Extended Chrome Mock
// ============================================================================

let mockStorage: Record<string, unknown> = {};

const mockChromeStorage = {
  local: {
    get: vi.fn(async (keys: string | string[] | null) => {
      if (keys === null) return { ...mockStorage };
      if (typeof keys === 'string') {
        return { [keys]: mockStorage[keys] };
      }
      const result: Record<string, unknown> = {};
      for (const key of keys) {
        if (mockStorage[key] !== undefined) {
          result[key] = mockStorage[key];
        }
      }
      return result;
    }),
    set: vi.fn(async (data: Record<string, unknown>) => {
      Object.assign(mockStorage, data);
    }),
    remove: vi.fn(async (keys: string | string[]) => {
      const keysArray = Array.isArray(keys) ? keys : [keys];
      for (const key of keysArray) {
        delete mockStorage[key];
      }
    }),
    clear: vi.fn(async () => {
      mockStorage = {};
    }),
    getBytesInUse: vi.fn(async () => 1024),
    QUOTA_BYTES: 10485760,
  },
  session: {
    get: vi.fn(async (key: string) => {
      return { [key]: mockStorage[`session_${key}`] };
    }),
    set: vi.fn(async (data: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(data)) {
        mockStorage[`session_${key}`] = value;
      }
    }),
    remove: vi.fn(async (key: string) => {
      delete mockStorage[`session_${key}`];
    }),
  },
};

// Save original chrome
const originalChrome = (globalThis as any).chrome;

beforeEach(() => {
  mockStorage = {};
  vi.clearAllMocks();
  
  // Setup chrome mock
  (globalThis as any).chrome = {
    storage: mockChromeStorage,
  };
});

afterEach(() => {
  // Restore original chrome
  (globalThis as any).chrome = originalChrome;
});

// ============================================================================
// Session Storage Tests
// ============================================================================

describe('sessionStorage', () => {
  describe('when session storage is available', () => {
    it('should get value from session storage', async () => {
      mockStorage['session_testKey'] = 'testValue';
      
      const result = await sessionStorage.get('testKey');
      
      expect(mockChromeStorage.session.get).toHaveBeenCalledWith('testKey');
      expect(result).toBe('testValue');
    });

    it('should return undefined for missing key', async () => {
      const result = await sessionStorage.get('missingKey');
      
      expect(result).toBeUndefined();
    });

    it('should set value in session storage', async () => {
      await sessionStorage.set('testKey', { data: 'value' });
      
      expect(mockChromeStorage.session.set).toHaveBeenCalledWith({ testKey: { data: 'value' } });
    });

    it('should remove value from session storage', async () => {
      await sessionStorage.remove('testKey');
      
      expect(mockChromeStorage.session.remove).toHaveBeenCalledWith('testKey');
    });
  });

  describe('when session storage is not available', () => {
    beforeEach(() => {
      // Remove session storage to simulate fallback
      (globalThis as any).chrome = {
        storage: {
          local: mockChromeStorage.local,
          // session is undefined
        },
      };
    });

    it('should fallback to local storage with prefix for get', async () => {
      mockStorage['_session_testKey'] = 'fallbackValue';
      
      const result = await sessionStorage.get('testKey');
      
      expect(mockChromeStorage.local.get).toHaveBeenCalledWith('_session_testKey');
      expect(result).toBe('fallbackValue');
    });

    it('should fallback to local storage with prefix for set', async () => {
      await sessionStorage.set('testKey', 'value');
      
      expect(mockChromeStorage.local.set).toHaveBeenCalledWith({ '_session_testKey': 'value' });
    });

    it('should fallback to local storage with prefix for remove', async () => {
      await sessionStorage.remove('testKey');
      
      expect(mockChromeStorage.local.remove).toHaveBeenCalledWith('_session_testKey');
    });
  });

  describe('error handling', () => {
    it('should return undefined on get error', async () => {
      mockChromeStorage.session.get.mockRejectedValueOnce(new Error('Storage error'));
      
      const result = await sessionStorage.get('testKey');
      
      expect(result).toBeUndefined();
    });

    it('should handle set error gracefully', async () => {
      mockChromeStorage.session.set.mockRejectedValueOnce(new Error('Storage error'));
      
      // Should not throw
      await expect(sessionStorage.set('key', 'value')).resolves.toBeUndefined();
    });

    it('should handle remove error gracefully', async () => {
      mockChromeStorage.session.remove.mockRejectedValueOnce(new Error('Storage error'));
      
      // Should not throw
      await expect(sessionStorage.remove('key')).resolves.toBeUndefined();
    });
  });
});

// ============================================================================
// Settings Storage Tests
// ============================================================================

describe('Settings Storage', () => {
  describe('getSettings', () => {
    it('should return default settings when no settings exist', async () => {
      const settings = await getSettings();
      
      expect(settings).toEqual({
        openctiPlatforms: [],
        openaevPlatforms: [],
        theme: 'auto',
        autoScan: false,
        showNotifications: true,
      });
    });

    it('should return stored settings merged with defaults', async () => {
      mockStorage['settings'] = {
        theme: 'dark',
        autoScan: true,
      };
      
      const settings = await getSettings();
      
      expect(settings).toEqual({
        openctiPlatforms: [],
        openaevPlatforms: [],
        theme: 'dark',
        autoScan: true,
        showNotifications: true,
      });
    });

    it('should return complete stored settings', async () => {
      const storedSettings = {
        openctiPlatforms: [{ id: '1', url: 'https://octi.example.com' }],
        openaevPlatforms: [],
        theme: 'light',
        autoScan: true,
        showNotifications: false,
      };
      mockStorage['settings'] = storedSettings;
      
      const settings = await getSettings();
      
      expect(settings).toEqual(storedSettings);
    });
  });

  describe('saveSettings', () => {
    it('should save settings to storage', async () => {
      const settings = {
        openctiPlatforms: [],
        openaevPlatforms: [],
        theme: 'dark' as const,
        autoScan: true,
        showNotifications: false,
      };
      
      await saveSettings(settings);
      
      expect(mockStorage['settings']).toEqual(settings);
    });
  });

  describe('updateSettings', () => {
    it('should update specific settings', async () => {
      mockStorage['settings'] = {
        theme: 'auto',
        autoScan: false,
      };
      
      const updated = await updateSettings({ theme: 'dark' });
      
      expect(updated.theme).toBe('dark');
      expect(updated.autoScan).toBe(false);
    });

    it('should return the updated settings', async () => {
      const updated = await updateSettings({ autoScan: true });
      
      expect(updated.autoScan).toBe(true);
      expect(mockStorage['settings']).toEqual(updated);
    });
  });
});

// ============================================================================
// Scan Cache Tests
// ============================================================================

describe('Scan Cache', () => {
  const testUrl = 'https://example.com/page';
  const encodedUrl = `scan_${btoa(testUrl)}`;
  
  describe('getCachedScan', () => {
    it('should return null for non-existent cache', async () => {
      const result = await getCachedScan(testUrl);
      
      expect(result).toBeNull();
    });

    it('should return cached scan results', async () => {
      const cache = {
        url: testUrl,
        timestamp: Date.now(),
        results: {
          observables: [{ type: 'ipv4', value: '1.2.3.4' }],
          octiEntities: [],
          cves: [],
        },
      };
      mockStorage[encodedUrl] = cache;
      
      const result = await getCachedScan(testUrl);
      
      expect(result).toEqual(cache);
    });

    it('should return null for expired cache (> 5 minutes)', async () => {
      const cache = {
        url: testUrl,
        timestamp: Date.now() - 6 * 60 * 1000, // 6 minutes ago
        results: { observables: [], octiEntities: [], cves: [] },
      };
      mockStorage[encodedUrl] = cache;
      
      const result = await getCachedScan(testUrl);
      
      expect(result).toBeNull();
      expect(mockStorage[encodedUrl]).toBeUndefined();
    });

    it('should keep cache that is less than 5 minutes old', async () => {
      const cache = {
        url: testUrl,
        timestamp: Date.now() - 4 * 60 * 1000, // 4 minutes ago
        results: { observables: [], octiEntities: [], cves: [] },
      };
      mockStorage[encodedUrl] = cache;
      
      const result = await getCachedScan(testUrl);
      
      expect(result).toEqual(cache);
    });
  });

  describe('cacheScanResults', () => {
    it('should cache scan results', async () => {
      const results = {
        observables: [{ type: 'ipv4', value: '10.0.0.1' }],
        octiEntities: [],
        cves: [],
      };
      
      await cacheScanResults(testUrl, results);
      
      const cached = mockStorage[encodedUrl] as any;
      expect(cached.url).toBe(testUrl);
      expect(cached.results).toEqual(results);
      expect(cached.timestamp).toBeCloseTo(Date.now(), -2);
    });
  });
});

// ============================================================================
// Entity Names Cache Tests
// ============================================================================

describe('Entity Names Cache', () => {
  describe('getCachedOCTIEntityNames', () => {
    it('should return empty array for non-existent cache', async () => {
      const names = await getCachedOCTIEntityNames();
      
      expect(names).toEqual([]);
    });

    it('should return cached names', async () => {
      mockStorage['entityNames'] = {
        timestamp: Date.now(),
        names: ['APT28', 'Lazarus Group', 'Emotet'],
      };
      
      const names = await getCachedOCTIEntityNames();
      
      expect(names).toEqual(['APT28', 'Lazarus Group', 'Emotet']);
    });

    it('should return empty array for expired cache (> 1 hour)', async () => {
      mockStorage['entityNames'] = {
        timestamp: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
        names: ['APT28'],
      };
      
      const names = await getCachedOCTIEntityNames();
      
      expect(names).toEqual([]);
    });
  });

  describe('cacheEntityNames', () => {
    it('should cache entity names', async () => {
      await cacheEntityNames(['APT28', 'Lazarus Group']);
      
      const cached = mockStorage['entityNames'] as any;
      expect(cached.names).toEqual(['APT28', 'Lazarus Group']);
      expect(cached.timestamp).toBeCloseTo(Date.now(), -2);
    });
  });
});

// ============================================================================
// OpenCTI Cache Tests
// ============================================================================

describe('OpenCTI Cache', () => {
  const testPlatformId = 'platform-1';
  
  describe('createEmptyOCTICache', () => {
    it('should create cache with default platformId', () => {
      const cache = createEmptyOCTICache();
      
      expect(cache.platformId).toBe('default');
      expect(cache.timestamp).toBeCloseTo(Date.now(), -2);
      expect(cache.lastRefresh).toBeCloseTo(Date.now(), -2);
    });

    it('should create cache with specified platformId', () => {
      const cache = createEmptyOCTICache(testPlatformId);
      
      expect(cache.platformId).toBe(testPlatformId);
    });

    it('should initialize all entity arrays as empty', () => {
      const cache = createEmptyOCTICache();
      
      expect(cache.entities['Threat-Actor-Group']).toEqual([]);
      expect(cache.entities['Malware']).toEqual([]);
      expect(cache.entities['Attack-Pattern']).toEqual([]);
      expect(cache.entities['Campaign']).toEqual([]);
    });
  });

  describe('getMultiPlatformOCTICache', () => {
    it('should return empty platforms when no cache exists', async () => {
      const cache = await getMultiPlatformOCTICache();
      
      expect(cache).toEqual({ platforms: {} });
    });

    it('should return cached platforms', async () => {
      const platformCache = createEmptyOCTICache(testPlatformId);
      mockStorage['octiCacheMulti'] = {
        platforms: { [testPlatformId]: platformCache },
      };
      
      const cache = await getMultiPlatformOCTICache();
      
      expect(Object.keys(cache.platforms)).toContain(testPlatformId);
    });
  });

  describe('getOCTICache', () => {
    it('should return null when no cache exists', async () => {
      const cache = await getOCTICache(testPlatformId);
      
      expect(cache).toBeNull();
    });

    it('should return first available cache when no platformId specified', async () => {
      const platformCache = createEmptyOCTICache(testPlatformId);
      mockStorage['octiCacheMulti'] = {
        platforms: { [testPlatformId]: platformCache },
      };
      
      const cache = await getOCTICache();
      
      expect(cache?.platformId).toBe(testPlatformId);
    });

    it('should return null when no platforms and no platformId specified', async () => {
      mockStorage['octiCacheMulti'] = { platforms: {} };
      
      const cache = await getOCTICache();
      
      expect(cache).toBeNull();
    });

    it('should return specific platform cache', async () => {
      const platform1Cache = createEmptyOCTICache('platform-1');
      const platform2Cache = createEmptyOCTICache('platform-2');
      mockStorage['octiCacheMulti'] = {
        platforms: {
          'platform-1': platform1Cache,
          'platform-2': platform2Cache,
        },
      };
      
      const cache = await getOCTICache('platform-2');
      
      expect(cache?.platformId).toBe('platform-2');
    });
  });

  describe('isOCTICacheExpired', () => {
    it('should return true when no cache exists', async () => {
      const expired = await isOCTICacheExpired(testPlatformId);
      
      expect(expired).toBe(true);
    });

    it('should return true when cache is older than 1 hour', async () => {
      const platformCache = createEmptyOCTICache(testPlatformId);
      platformCache.timestamp = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago
      mockStorage['octiCacheMulti'] = {
        platforms: { [testPlatformId]: platformCache },
      };
      
      const expired = await isOCTICacheExpired(testPlatformId);
      
      expect(expired).toBe(true);
    });

    it('should return false when cache is fresh', async () => {
      const platformCache = createEmptyOCTICache(testPlatformId);
      mockStorage['octiCacheMulti'] = {
        platforms: { [testPlatformId]: platformCache },
      };
      
      const expired = await isOCTICacheExpired(testPlatformId);
      
      expect(expired).toBe(false);
    });
  });

  describe('shouldRefreshOCTICache', () => {
    it('should return true when no cache exists', async () => {
      const shouldRefresh = await shouldRefreshOCTICache(testPlatformId);
      
      expect(shouldRefresh).toBe(true);
    });

    it('should return true when last refresh is older than 30 minutes', async () => {
      const platformCache = createEmptyOCTICache(testPlatformId);
      platformCache.lastRefresh = Date.now() - 35 * 60 * 1000; // 35 minutes ago
      mockStorage['octiCacheMulti'] = {
        platforms: { [testPlatformId]: platformCache },
      };
      
      const shouldRefresh = await shouldRefreshOCTICache(testPlatformId);
      
      expect(shouldRefresh).toBe(true);
    });

    it('should return false when recently refreshed', async () => {
      const platformCache = createEmptyOCTICache(testPlatformId);
      mockStorage['octiCacheMulti'] = {
        platforms: { [testPlatformId]: platformCache },
      };
      
      const shouldRefresh = await shouldRefreshOCTICache(testPlatformId);
      
      expect(shouldRefresh).toBe(false);
    });
  });

  describe('saveOCTICache', () => {
    it('should save cache for platform', async () => {
      const cache = createEmptyOCTICache(testPlatformId);
      cache.entities['Malware'].push({
        id: 'malware-1',
        name: 'Emotet',
        type: 'Malware',
      });
      
      await saveOCTICache(cache, testPlatformId);
      
      const saved = mockStorage['octiCacheMulti'] as any;
      expect(saved.platforms[testPlatformId].entities['Malware']).toHaveLength(1);
    });

    it('should set platformId on cache', async () => {
      const cache = createEmptyOCTICache('other');
      
      await saveOCTICache(cache, testPlatformId);
      
      const saved = mockStorage['octiCacheMulti'] as any;
      expect(saved.platforms[testPlatformId].platformId).toBe(testPlatformId);
    });
  });

  describe('updateOCTICacheForType', () => {
    it('should create cache if not exists', async () => {
      const entities: CachedOCTIEntity[] = [
        { id: '1', name: 'APT28', type: 'Threat-Actor-Group' },
      ];
      
      await updateOCTICacheForType('Threat-Actor-Group', entities, testPlatformId);
      
      const saved = mockStorage['octiCacheMulti'] as any;
      expect(saved.platforms[testPlatformId].entities['Threat-Actor-Group']).toEqual(entities);
    });

    it('should update existing cache type', async () => {
      const platformCache = createEmptyOCTICache(testPlatformId);
      platformCache.entities['Malware'].push({ id: 'old', name: 'OldMalware', type: 'Malware' });
      mockStorage['octiCacheMulti'] = {
        platforms: { [testPlatformId]: platformCache },
      };
      
      const newEntities: CachedOCTIEntity[] = [
        { id: 'new', name: 'NewMalware', type: 'Malware' },
      ];
      
      await updateOCTICacheForType('Malware', newEntities, testPlatformId);
      
      const saved = mockStorage['octiCacheMulti'] as any;
      expect(saved.platforms[testPlatformId].entities['Malware']).toEqual(newEntities);
    });
  });

  describe('addEntityToOCTICache', () => {
    it('should add new entity to cache', async () => {
      const platformCache = createEmptyOCTICache(testPlatformId);
      mockStorage['octiCacheMulti'] = {
        platforms: { [testPlatformId]: platformCache },
      };
      
      const entity: CachedOCTIEntity = {
        id: 'malware-new',
        name: 'NewMalware',
        type: 'Malware',
      };
      
      await addEntityToOCTICache(entity, testPlatformId);
      
      const saved = mockStorage['octiCacheMulti'] as any;
      expect(saved.platforms[testPlatformId].entities['Malware']).toContainEqual(entity);
    });

    it('should update existing entity in cache', async () => {
      const platformCache = createEmptyOCTICache(testPlatformId);
      platformCache.entities['Malware'].push({
        id: 'malware-1',
        name: 'OldName',
        type: 'Malware',
      });
      mockStorage['octiCacheMulti'] = {
        platforms: { [testPlatformId]: platformCache },
      };
      
      const updatedEntity: CachedOCTIEntity = {
        id: 'malware-1',
        name: 'NewName',
        type: 'Malware',
      };
      
      await addEntityToOCTICache(updatedEntity, testPlatformId);
      
      const saved = mockStorage['octiCacheMulti'] as any;
      expect(saved.platforms[testPlatformId].entities['Malware']).toHaveLength(1);
      expect(saved.platforms[testPlatformId].entities['Malware'][0].name).toBe('NewName');
    });

    it('should create cache if not exists', async () => {
      const entity: CachedOCTIEntity = {
        id: 'malware-1',
        name: 'TestMalware',
        type: 'Malware',
      };
      
      await addEntityToOCTICache(entity, testPlatformId);
      
      const saved = mockStorage['octiCacheMulti'] as any;
      expect(saved.platforms[testPlatformId].entities['Malware']).toContainEqual(entity);
    });

    it('should skip entity types not in cache structure', async () => {
      const platformCache = createEmptyOCTICache(testPlatformId);
      mockStorage['octiCacheMulti'] = {
        platforms: { [testPlatformId]: platformCache },
      };
      
      const entity: CachedOCTIEntity = {
        id: 'vuln-1',
        name: 'CVE-2024-1234',
        type: 'Vulnerability' as any, // Not in cache structure
      };
      
      await addEntityToOCTICache(entity, testPlatformId);
      
      // Should not throw, and no changes to known types
      const saved = mockStorage['octiCacheMulti'] as any;
      expect(saved.platforms[testPlatformId].entities['Malware']).toHaveLength(0);
    });
  });

  describe('getAllCachedOCTIEntityNamesForMatching', () => {
    it('should return empty map when no cache', async () => {
      const nameMap = await getAllCachedOCTIEntityNamesForMatching();
      
      expect(nameMap.size).toBe(0);
    });

    it('should return names from all platforms', async () => {
      const platform1Cache = createEmptyOCTICache('platform-1');
      platform1Cache.entities['Malware'].push({
        id: '1',
        name: 'Emotet',
        type: 'Malware',
      });
      
      const platform2Cache = createEmptyOCTICache('platform-2');
      platform2Cache.entities['Threat-Actor-Group'].push({
        id: '2',
        name: 'APT28',
        aliases: ['Fancy Bear', 'Sofacy'],
        type: 'Threat-Actor-Group',
      });
      
      mockStorage['octiCacheMulti'] = {
        platforms: {
          'platform-1': platform1Cache,
          'platform-2': platform2Cache,
        },
      };
      
      const nameMap = await getAllCachedOCTIEntityNamesForMatching();
      
      expect(nameMap.get('emotet')).toBeDefined();
      expect(nameMap.get('apt28')).toBeDefined();
      expect(nameMap.get('fancy bear')).toBeDefined();
      expect(nameMap.get('sofacy')).toBeDefined();
    });

    it('should include x_mitre_id for attack patterns', async () => {
      const platformCache = createEmptyOCTICache(testPlatformId);
      platformCache.entities['Attack-Pattern'].push({
        id: '1',
        name: 'Command and Scripting Interpreter',
        type: 'Attack-Pattern',
        x_mitre_id: 'T1059',
      });
      
      mockStorage['octiCacheMulti'] = {
        platforms: { [testPlatformId]: platformCache },
      };
      
      const nameMap = await getAllCachedOCTIEntityNamesForMatching();
      
      expect(nameMap.get('t1059')).toBeDefined();
    });

    it('should filter out short names (< 4 chars)', async () => {
      const platformCache = createEmptyOCTICache(testPlatformId);
      platformCache.entities['Malware'].push({
        id: '1',
        name: 'APT', // 3 chars - should be excluded
        type: 'Malware',
      });
      
      mockStorage['octiCacheMulti'] = {
        platforms: { [testPlatformId]: platformCache },
      };
      
      const nameMap = await getAllCachedOCTIEntityNamesForMatching();
      
      expect(nameMap.get('apt')).toBeUndefined();
    });

    it('should filter out excluded terms', async () => {
      const platformCache = createEmptyOCTICache(testPlatformId);
      platformCache.entities['Malware'].push({
        id: '1',
        name: 'TestMalware',
        aliases: ['test', 'demo', 'example'], // Should be excluded
        type: 'Malware',
      });
      
      mockStorage['octiCacheMulti'] = {
        platforms: { [testPlatformId]: platformCache },
      };
      
      const nameMap = await getAllCachedOCTIEntityNamesForMatching();
      
      expect(nameMap.get('testmalware')).toBeDefined();
      expect(nameMap.get('test')).toBeUndefined();
      expect(nameMap.get('demo')).toBeUndefined();
      expect(nameMap.get('example')).toBeUndefined();
    });
  });

  describe('getOCTICacheStats', () => {
    it('should return null when no cache', async () => {
      const stats = await getOCTICacheStats(testPlatformId);
      
      expect(stats).toBeNull();
    });

    it('should return stats for specific platform', async () => {
      const platformCache = createEmptyOCTICache(testPlatformId);
      platformCache.entities['Malware'].push({ id: '1', name: 'Emotet', type: 'Malware' });
      platformCache.entities['Malware'].push({ id: '2', name: 'Ryuk', type: 'Malware' });
      platformCache.entities['Threat-Actor-Group'].push({ id: '3', name: 'APT28', type: 'Threat-Actor-Group' });
      
      mockStorage['octiCacheMulti'] = {
        platforms: { [testPlatformId]: platformCache },
      };
      
      const stats = await getOCTICacheStats(testPlatformId);
      
      expect(stats).not.toBeNull();
      expect(stats!.total).toBe(3);
      expect(stats!.byType['Malware']).toBe(2);
      expect(stats!.byType['Threat-Actor-Group']).toBe(1);
      expect(stats!.isExpired).toBe(false);
    });

    it('should return combined stats for all platforms', async () => {
      const platform1Cache = createEmptyOCTICache('platform-1');
      platform1Cache.entities['Malware'].push({ id: '1', name: 'Emotet', type: 'Malware' });
      
      const platform2Cache = createEmptyOCTICache('platform-2');
      platform2Cache.entities['Malware'].push({ id: '2', name: 'Ryuk', type: 'Malware' });
      
      mockStorage['octiCacheMulti'] = {
        platforms: {
          'platform-1': platform1Cache,
          'platform-2': platform2Cache,
        },
      };
      
      const stats = await getOCTICacheStats();
      
      expect(stats).not.toBeNull();
      expect(stats!.total).toBe(2);
      expect(stats!.platformCount).toBe(2);
    });
  });

  describe('clearOCTICacheForPlatform', () => {
    it('should clear cache for specific platform', async () => {
      const platform1Cache = createEmptyOCTICache('platform-1');
      const platform2Cache = createEmptyOCTICache('platform-2');
      mockStorage['octiCacheMulti'] = {
        platforms: {
          'platform-1': platform1Cache,
          'platform-2': platform2Cache,
        },
      };
      
      await clearOCTICacheForPlatform('platform-1');
      
      const saved = mockStorage['octiCacheMulti'] as any;
      expect(saved.platforms['platform-1']).toBeUndefined();
      expect(saved.platforms['platform-2']).toBeDefined();
    });
  });

  describe('clearAllOCTICaches', () => {
    it('should clear all platform caches', async () => {
      mockStorage['octiCacheMulti'] = {
        platforms: {
          'platform-1': createEmptyOCTICache('platform-1'),
          'platform-2': createEmptyOCTICache('platform-2'),
        },
      };
      
      await clearAllOCTICaches();
      
      const saved = mockStorage['octiCacheMulti'] as any;
      expect(saved.platforms).toEqual({});
    });
  });

  describe('cleanupOrphanedOCTICaches', () => {
    it('should remove caches for platforms not in valid list', async () => {
      mockStorage['octiCacheMulti'] = {
        platforms: {
          'platform-1': createEmptyOCTICache('platform-1'),
          'platform-2': createEmptyOCTICache('platform-2'),
          'platform-3': createEmptyOCTICache('platform-3'),
        },
      };
      
      await cleanupOrphanedOCTICaches(['platform-1', 'platform-3']);
      
      const saved = mockStorage['octiCacheMulti'] as any;
      expect(saved.platforms['platform-1']).toBeDefined();
      expect(saved.platforms['platform-2']).toBeUndefined();
      expect(saved.platforms['platform-3']).toBeDefined();
    });

    it('should not modify storage if no orphans', async () => {
      mockStorage['octiCacheMulti'] = {
        platforms: {
          'platform-1': createEmptyOCTICache('platform-1'),
        },
      };
      
      await cleanupOrphanedOCTICaches(['platform-1', 'platform-2']);
      
      // Storage should not be modified if no orphans
      expect(mockChromeStorage.local.set).not.toHaveBeenCalled();
    });
  });
});

// ============================================================================
// OpenAEV Cache Tests
// ============================================================================

describe('OpenAEV Cache', () => {
  const testPlatformId = 'oaev-platform-1';

  describe('createEmptyOAEVCache', () => {
    it('should create cache with default platformId', () => {
      const cache = createEmptyOAEVCache();
      
      expect(cache.platformId).toBe('default');
      expect(cache.entities['Asset']).toEqual([]);
      expect(cache.entities['AssetGroup']).toEqual([]);
      expect(cache.entities['Team']).toEqual([]);
    });

    it('should create cache with specified platformId', () => {
      const cache = createEmptyOAEVCache(testPlatformId);
      
      expect(cache.platformId).toBe(testPlatformId);
    });
  });

  describe('getMultiPlatformOAEVCache', () => {
    it('should return empty platforms when no cache exists', async () => {
      const cache = await getMultiPlatformOAEVCache();
      
      expect(cache).toEqual({ platforms: {} });
    });
  });

  describe('getOAEVCache', () => {
    it('should return null when no cache exists', async () => {
      const cache = await getOAEVCache(testPlatformId);
      
      expect(cache).toBeNull();
    });

    it('should return first available cache when no platformId specified', async () => {
      const platformCache = createEmptyOAEVCache(testPlatformId);
      mockStorage['oaevCacheMulti'] = {
        platforms: { [testPlatformId]: platformCache },
      };
      
      const cache = await getOAEVCache();
      
      expect(cache?.platformId).toBe(testPlatformId);
    });
  });

  describe('shouldRefreshOAEVCache', () => {
    it('should return true when no cache exists', async () => {
      const shouldRefresh = await shouldRefreshOAEVCache(testPlatformId);
      
      expect(shouldRefresh).toBe(true);
    });

    it('should return true when last refresh is older than 30 minutes', async () => {
      const platformCache = createEmptyOAEVCache(testPlatformId);
      platformCache.lastRefresh = Date.now() - 35 * 60 * 1000;
      mockStorage['oaevCacheMulti'] = {
        platforms: { [testPlatformId]: platformCache },
      };
      
      const shouldRefresh = await shouldRefreshOAEVCache(testPlatformId);
      
      expect(shouldRefresh).toBe(true);
    });

    it('should return false when recently refreshed', async () => {
      const platformCache = createEmptyOAEVCache(testPlatformId);
      mockStorage['oaevCacheMulti'] = {
        platforms: { [testPlatformId]: platformCache },
      };
      
      const shouldRefresh = await shouldRefreshOAEVCache(testPlatformId);
      
      expect(shouldRefresh).toBe(false);
    });
  });

  describe('saveOAEVCache', () => {
    it('should save cache for platform', async () => {
      const cache = createEmptyOAEVCache(testPlatformId);
      cache.entities['Asset'].push({
        id: 'asset-1',
        name: 'Server-01',
        type: 'Asset',
        platformId: testPlatformId,
      });
      
      await saveOAEVCache(cache, testPlatformId);
      
      const saved = mockStorage['oaevCacheMulti'] as any;
      expect(saved.platforms[testPlatformId].entities['Asset']).toHaveLength(1);
    });
  });

  describe('getAllCachedOAEVEntityNamesForMatching', () => {
    it('should return empty map when no cache', async () => {
      const nameMap = await getAllCachedOAEVEntityNamesForMatching();
      
      expect(nameMap.size).toBe(0);
    });

    it('should return names from all platforms', async () => {
      const platformCache = createEmptyOAEVCache(testPlatformId);
      platformCache.entities['Asset'].push({
        id: '1',
        name: 'WebServer01',
        type: 'Asset',
        platformId: testPlatformId,
      });
      platformCache.entities['Team'].push({
        id: '2',
        name: 'Security Team',
        type: 'Team',
        platformId: testPlatformId,
      });
      
      mockStorage['oaevCacheMulti'] = {
        platforms: { [testPlatformId]: platformCache },
      };
      
      const nameMap = await getAllCachedOAEVEntityNamesForMatching();
      
      expect(nameMap.get('webserver01')).toBeDefined();
      expect(nameMap.get('security team')).toBeDefined();
    });
  });

  describe('getOAEVCacheStats', () => {
    it('should return null when no cache', async () => {
      const stats = await getOAEVCacheStats(testPlatformId);
      
      expect(stats).toBeNull();
    });

    it('should return stats for specific platform', async () => {
      const platformCache = createEmptyOAEVCache(testPlatformId);
      platformCache.entities['Asset'].push({ id: '1', name: 'Asset1', type: 'Asset', platformId: testPlatformId });
      platformCache.entities['Asset'].push({ id: '2', name: 'Asset2', type: 'Asset', platformId: testPlatformId });
      
      mockStorage['oaevCacheMulti'] = {
        platforms: { [testPlatformId]: platformCache },
      };
      
      const stats = await getOAEVCacheStats(testPlatformId);
      
      expect(stats).not.toBeNull();
      expect(stats!.total).toBe(2);
      expect(stats!.byType['Asset']).toBe(2);
    });
  });

  describe('clearOAEVCacheForPlatform', () => {
    it('should clear cache for specific platform', async () => {
      mockStorage['oaevCacheMulti'] = {
        platforms: {
          'platform-1': createEmptyOAEVCache('platform-1'),
          'platform-2': createEmptyOAEVCache('platform-2'),
        },
      };
      
      await clearOAEVCacheForPlatform('platform-1');
      
      const saved = mockStorage['oaevCacheMulti'] as any;
      expect(saved.platforms['platform-1']).toBeUndefined();
      expect(saved.platforms['platform-2']).toBeDefined();
    });
  });

  describe('clearAllOAEVCaches', () => {
    it('should clear all platform caches', async () => {
      mockStorage['oaevCacheMulti'] = {
        platforms: {
          'platform-1': createEmptyOAEVCache('platform-1'),
        },
      };
      
      await clearAllOAEVCaches();
      
      const saved = mockStorage['oaevCacheMulti'] as any;
      expect(saved.platforms).toEqual({});
    });
  });

  describe('cleanupOrphanedOAEVCaches', () => {
    it('should remove caches for platforms not in valid list', async () => {
      mockStorage['oaevCacheMulti'] = {
        platforms: {
          'platform-1': createEmptyOAEVCache('platform-1'),
          'platform-2': createEmptyOAEVCache('platform-2'),
        },
      };
      
      await cleanupOrphanedOAEVCaches(['platform-1']);
      
      const saved = mockStorage['oaevCacheMulti'] as any;
      expect(saved.platforms['platform-1']).toBeDefined();
      expect(saved.platforms['platform-2']).toBeUndefined();
    });
  });
});

// ============================================================================
// Storage Quota Management Tests
// ============================================================================

describe('Storage Quota Management', () => {
  describe('getStorageUsage', () => {
    it('should return storage usage info', async () => {
      mockChromeStorage.local.getBytesInUse.mockResolvedValueOnce(5242880);
      
      const usage = await getStorageUsage();
      
      expect(usage.used).toBe(5242880);
      expect(usage.quota).toBe(10485760);
      expect(usage.percentage).toBe(50);
    });

    it('should return default values on error', async () => {
      mockChromeStorage.local.getBytesInUse.mockRejectedValueOnce(new Error('Not available'));
      
      const usage = await getStorageUsage();
      
      expect(usage.used).toBe(0);
      expect(usage.percentage).toBe(0);
    });
  });

  describe('isStorageNearQuota', () => {
    it('should return true when usage is above 90%', async () => {
      mockChromeStorage.local.getBytesInUse.mockResolvedValueOnce(9500000);
      
      const nearQuota = await isStorageNearQuota();
      
      expect(nearQuota).toBe(true);
    });

    it('should return false when usage is below 90%', async () => {
      mockChromeStorage.local.getBytesInUse.mockResolvedValueOnce(1024);
      
      const nearQuota = await isStorageNearQuota();
      
      expect(nearQuota).toBe(false);
    });
  });

  describe('clearAllCaches', () => {
    it('should clear all cache keys', async () => {
      mockStorage['octiCacheMulti'] = { platforms: {} };
      mockStorage['oaevCacheMulti'] = { platforms: {} };
      mockStorage['entityNames'] = { names: [] };
      mockStorage['scan_test'] = {};
      
      await clearAllCaches();
      
      expect(mockChromeStorage.local.remove).toHaveBeenCalledWith('octiCacheMulti');
      expect(mockChromeStorage.local.remove).toHaveBeenCalledWith('oaevCacheMulti');
      expect(mockChromeStorage.local.remove).toHaveBeenCalledWith('entityNames');
    });

    it('should clear scan caches', async () => {
      mockStorage['scan_abc'] = {};
      mockStorage['scan_xyz'] = {};
      mockStorage['settings'] = {};
      
      await clearAllCaches();
      
      expect(mockChromeStorage.local.remove).toHaveBeenCalledWith(['scan_abc', 'scan_xyz']);
    });

    it('should handle errors gracefully', async () => {
      mockChromeStorage.local.remove.mockRejectedValueOnce(new Error('Remove failed'));
      
      // Should not throw
      await expect(clearAllCaches()).resolves.toBeUndefined();
    });
  });
});
