/**
 * Unit Tests for Storage Utilities
 * 
 * Tests storage wrapper functions with mocked chrome API.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createEmptyOCTICache,
  createEmptyOAEVCache,
  getSettings,
  saveSettings,
  updateSettings,
  sessionStorage,
  getCachedScan,
  cacheScanResults,
  getCachedOCTIEntityNames,
  cacheEntityNames,
  type CachedOCTIEntity,
  type CachedOAEVEntity,
  type OCTIEntityCache,
  type OAEVCache,
} from '../../src/shared/utils/storage';

// Mock logger
vi.mock('../../src/shared/utils/logger', () => ({
  loggers: {
    storage: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  },
}));

// Setup chrome mock for storage operations
const mockLocalStorage: Record<string, unknown> = {};
const mockSessionStorage: Record<string, unknown> = {};

beforeEach(() => {
  // Reset storage mocks
  Object.keys(mockLocalStorage).forEach(key => delete mockLocalStorage[key]);
  Object.keys(mockSessionStorage).forEach(key => delete mockSessionStorage[key]);
  
  // Setup chrome mock
  global.chrome = {
    storage: {
      local: {
        get: vi.fn((keys) => {
          if (typeof keys === 'string') {
            return Promise.resolve({ [keys]: mockLocalStorage[keys] });
          }
          const result: Record<string, unknown> = {};
          for (const key of keys) {
            if (mockLocalStorage[key] !== undefined) {
              result[key] = mockLocalStorage[key];
            }
          }
          return Promise.resolve(result);
        }),
        set: vi.fn((data) => {
          Object.assign(mockLocalStorage, data);
          return Promise.resolve();
        }),
        remove: vi.fn((keys) => {
          if (typeof keys === 'string') {
            delete mockLocalStorage[keys];
          } else {
            for (const key of keys) {
              delete mockLocalStorage[key];
            }
          }
          return Promise.resolve();
        }),
      },
      session: {
        get: vi.fn((keys) => {
          if (typeof keys === 'string') {
            return Promise.resolve({ [keys]: mockSessionStorage[keys] });
          }
          return Promise.resolve({});
        }),
        set: vi.fn((data) => {
          Object.assign(mockSessionStorage, data);
          return Promise.resolve();
        }),
        remove: vi.fn((keys) => {
          if (typeof keys === 'string') {
            delete mockSessionStorage[keys];
          }
          return Promise.resolve();
        }),
      },
    },
  } as unknown as typeof chrome;
});

afterEach(() => {
  vi.clearAllMocks();
});

// ============================================================================
// Session Storage Tests
// ============================================================================

describe('sessionStorage', () => {
  describe('get', () => {
    it('should get value from session storage', async () => {
      mockSessionStorage['testKey'] = 'testValue';
      const result = await sessionStorage.get<string>('testKey');
      expect(result).toBe('testValue');
    });

    it('should return undefined for non-existent key', async () => {
      const result = await sessionStorage.get('nonExistent');
      expect(result).toBeUndefined();
    });

    it('should handle errors gracefully', async () => {
      (chrome.storage.session.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Test error'));
      const result = await sessionStorage.get('testKey');
      expect(result).toBeUndefined();
    });
  });

  describe('set', () => {
    it('should set value in session storage', async () => {
      await sessionStorage.set('testKey', 'testValue');
      expect(chrome.storage.session.set).toHaveBeenCalledWith({ testKey: 'testValue' });
    });

    it('should handle complex values', async () => {
      const complexValue = { foo: 'bar', nested: { array: [1, 2, 3] } };
      await sessionStorage.set('complex', complexValue);
      expect(chrome.storage.session.set).toHaveBeenCalledWith({ complex: complexValue });
    });

    it('should handle errors gracefully', async () => {
      (chrome.storage.session.set as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Test error'));
      // Should not throw
      await expect(sessionStorage.set('testKey', 'value')).resolves.toBeUndefined();
    });
  });

  describe('remove', () => {
    it('should remove value from session storage', async () => {
      await sessionStorage.remove('testKey');
      expect(chrome.storage.session.remove).toHaveBeenCalledWith('testKey');
    });

    it('should handle errors gracefully', async () => {
      (chrome.storage.session.remove as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Test error'));
      // Should not throw
      await expect(sessionStorage.remove('testKey')).resolves.toBeUndefined();
    });
  });
});

// ============================================================================
// Settings Storage Tests
// ============================================================================

describe('getSettings', () => {
  it('should return default settings when none saved', async () => {
    const settings = await getSettings();
    
    expect(settings.theme).toBe('auto');
    expect(settings.autoScan).toBe(false);
    expect(settings.showNotifications).toBe(true);
    expect(settings.openctiPlatforms).toEqual([]);
    expect(settings.openaevPlatforms).toEqual([]);
  });

  it('should merge saved settings with defaults', async () => {
    mockLocalStorage['settings'] = {
      theme: 'dark',
      autoScan: true,
    };

    const settings = await getSettings();
    
    expect(settings.theme).toBe('dark');
    expect(settings.autoScan).toBe(true);
    expect(settings.showNotifications).toBe(true); // default
  });

  it('should return complete saved settings', async () => {
    mockLocalStorage['settings'] = {
      theme: 'light',
      autoScan: true,
      showNotifications: false,
      openctiPlatforms: [{ id: 'p1', name: 'Test', url: 'http://test', apiToken: 'token', enabled: true }],
      openaevPlatforms: [],
    };

    const settings = await getSettings();
    
    expect(settings.openctiPlatforms).toHaveLength(1);
    expect(settings.openctiPlatforms[0].name).toBe('Test');
  });
});

describe('saveSettings', () => {
  it('should save settings to storage', async () => {
    const settings = {
      theme: 'dark' as const,
      autoScan: true,
      showNotifications: false,
      openctiPlatforms: [],
      openaevPlatforms: [],
    };

    await saveSettings(settings);

    expect(chrome.storage.local.set).toHaveBeenCalledWith({ settings });
  });
});

describe('updateSettings', () => {
  it('should merge partial updates with existing settings', async () => {
    mockLocalStorage['settings'] = {
      theme: 'light',
      autoScan: false,
      showNotifications: true,
      openctiPlatforms: [],
      openaevPlatforms: [],
    };

    const updated = await updateSettings({ theme: 'dark' });

    expect(updated.theme).toBe('dark');
    expect(updated.autoScan).toBe(false); // unchanged
    expect(chrome.storage.local.set).toHaveBeenCalled();
  });
});

// ============================================================================
// Scan Cache Tests
// ============================================================================

describe('getCachedScan', () => {
  it('should return null for non-existent cache', async () => {
    const result = await getCachedScan('https://example.com');
    expect(result).toBeNull();
  });

  it('should return cached scan if fresh', async () => {
    const url = 'https://example.com';
    const cache = {
      url,
      timestamp: Date.now(),
      results: {
        observables: [{ id: 1 }],
        octiEntities: [],
        cves: [],
      },
    };
    mockLocalStorage[`scan_${btoa(url)}`] = cache;

    const result = await getCachedScan(url);

    expect(result).toEqual(cache);
  });

  it('should return null for expired cache (5+ minutes old)', async () => {
    const url = 'https://example.com';
    const cache = {
      url,
      timestamp: Date.now() - 6 * 60 * 1000, // 6 minutes ago
      results: { observables: [], octiEntities: [], cves: [] },
    };
    mockLocalStorage[`scan_${btoa(url)}`] = cache;

    const result = await getCachedScan(url);

    expect(result).toBeNull();
    expect(chrome.storage.local.remove).toHaveBeenCalled();
  });
});

describe('cacheScanResults', () => {
  it('should cache scan results with timestamp', async () => {
    const url = 'https://example.com';
    const results = {
      observables: [{ type: 'IPv4-Addr', value: '192.168.1.1' }],
      octiEntities: [],
      cves: [],
    };

    await cacheScanResults(url, results);

    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        [`scan_${btoa(url)}`]: expect.objectContaining({
          url,
          results,
          timestamp: expect.any(Number),
        }),
      })
    );
  });
});

// ============================================================================
// Entity Names Cache Tests
// ============================================================================

describe('getCachedOCTIEntityNames', () => {
  it('should return empty array when no cache', async () => {
    const result = await getCachedOCTIEntityNames();
    expect(result).toEqual([]);
  });

  it('should return cached names if fresh', async () => {
    mockLocalStorage['entityNames'] = {
      timestamp: Date.now(),
      names: ['APT29', 'Emotet', 'Cobalt Strike'],
    };

    const result = await getCachedOCTIEntityNames();

    expect(result).toEqual(['APT29', 'Emotet', 'Cobalt Strike']);
  });

  it('should return empty for expired cache (1+ hour old)', async () => {
    mockLocalStorage['entityNames'] = {
      timestamp: Date.now() - 61 * 60 * 1000, // 61 minutes ago
      names: ['APT29'],
    };

    const result = await getCachedOCTIEntityNames();

    expect(result).toEqual([]);
  });
});

describe('cacheEntityNames', () => {
  it('should cache entity names with timestamp', async () => {
    const names = ['APT29', 'Emotet'];

    await cacheEntityNames(names);

    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      entityNames: expect.objectContaining({
        names,
        timestamp: expect.any(Number),
      }),
    });
  });
});

// ============================================================================
// Empty Cache Creation Tests
// ============================================================================

describe('createEmptyOCTICache', () => {
  it('should create cache with default platform ID', () => {
    const cache = createEmptyOCTICache();
    
    expect(cache.platformId).toBe('default');
    expect(cache.timestamp).toBeGreaterThan(0);
    expect(cache.lastRefresh).toBeGreaterThan(0);
  });

  it('should create cache with specified platform ID', () => {
    const cache = createEmptyOCTICache('my-platform');
    
    expect(cache.platformId).toBe('my-platform');
  });

  it('should create cache with all entity type arrays', () => {
    const cache = createEmptyOCTICache();
    
    const expectedTypes = [
      'Threat-Actor-Group',
      'Threat-Actor-Individual',
      'Intrusion-Set',
      'Campaign',
      'Incident',
      'Malware',
      'Attack-Pattern',
      'Sector',
      'Organization',
      'Individual',
      'Event',
      'Country',
      'Region',
      'City',
      'Administrative-Area',
      'Position',
      'Tool',
      'Narrative',
      'Channel',
      'System',
    ];

    for (const type of expectedTypes) {
      expect(cache.entities[type as keyof OCTIEntityCache['entities']]).toBeDefined();
      expect(Array.isArray(cache.entities[type as keyof OCTIEntityCache['entities']])).toBe(true);
      expect(cache.entities[type as keyof OCTIEntityCache['entities']]).toHaveLength(0);
    }
  });

  it('should set timestamp and lastRefresh to current time', () => {
    const before = Date.now();
    const cache = createEmptyOCTICache();
    const after = Date.now();

    expect(cache.timestamp).toBeGreaterThanOrEqual(before);
    expect(cache.timestamp).toBeLessThanOrEqual(after);
    expect(cache.lastRefresh).toBeGreaterThanOrEqual(before);
    expect(cache.lastRefresh).toBeLessThanOrEqual(after);
  });
});

describe('createEmptyOAEVCache', () => {
  it('should create cache with default platform ID', () => {
    const cache = createEmptyOAEVCache();
    
    expect(cache.platformId).toBe('default');
    expect(cache.timestamp).toBeGreaterThan(0);
    expect(cache.lastRefresh).toBeGreaterThan(0);
  });

  it('should create cache with specified platform ID', () => {
    const cache = createEmptyOAEVCache('oaev-platform');
    
    expect(cache.platformId).toBe('oaev-platform');
  });

  it('should create cache with all entity type arrays', () => {
    const cache = createEmptyOAEVCache();
    
    const expectedTypes = [
      'Asset',
      'AssetGroup',
      'Team',
      'Player',
      'AttackPattern',
      'Finding',
    ];

    for (const type of expectedTypes) {
      expect(cache.entities[type as keyof OAEVCache['entities']]).toBeDefined();
      expect(Array.isArray(cache.entities[type as keyof OAEVCache['entities']])).toBe(true);
      expect(cache.entities[type as keyof OAEVCache['entities']]).toHaveLength(0);
    }
  });
});

// ============================================================================
// Cache Entity Type Tests
// ============================================================================

describe('CachedOCTIEntity structure', () => {
  it('should accept valid entity structure', () => {
    const entity: CachedOCTIEntity = {
      id: 'threat-actor--123',
      name: 'APT29',
      aliases: ['Cozy Bear', 'The Dukes'],
      x_mitre_id: undefined,
      type: 'Threat-Actor-Group',
      platformId: 'platform-1',
    };

    expect(entity.id).toBe('threat-actor--123');
    expect(entity.name).toBe('APT29');
    expect(entity.aliases).toHaveLength(2);
    expect(entity.type).toBe('Threat-Actor-Group');
  });

  it('should work with attack patterns and x_mitre_id', () => {
    const entity: CachedOCTIEntity = {
      id: 'attack-pattern--456',
      name: 'Phishing',
      aliases: ['Phishing for Information'],
      x_mitre_id: 'T1566',
      type: 'Attack-Pattern',
      platformId: 'platform-1',
    };

    expect(entity.x_mitre_id).toBe('T1566');
  });

  it('should work without optional fields', () => {
    const entity: CachedOCTIEntity = {
      id: 'malware--789',
      name: 'Emotet',
      type: 'Malware',
    };

    expect(entity.aliases).toBeUndefined();
    expect(entity.x_mitre_id).toBeUndefined();
    expect(entity.platformId).toBeUndefined();
  });
});

describe('CachedOAEVEntity structure', () => {
  it('should accept valid entity structure for Asset', () => {
    const entity: CachedOAEVEntity = {
      id: 'asset-123',
      name: 'Production Server',
      aliases: ['prod-srv-01', '192.168.1.100'],
      type: 'Asset',
      platformId: 'oaev-platform',
    };

    expect(entity.id).toBe('asset-123');
    expect(entity.name).toBe('Production Server');
    expect(entity.type).toBe('Asset');
    expect(entity.aliases).toContain('192.168.1.100');
  });

  it('should accept valid entity structure for Team', () => {
    const entity: CachedOAEVEntity = {
      id: 'team-456',
      name: 'Red Team Alpha',
      type: 'Team',
      platformId: 'oaev-platform',
    };

    expect(entity.type).toBe('Team');
  });

  it('should accept valid entity structure for Player', () => {
    const entity: CachedOAEVEntity = {
      id: 'player-789',
      name: 'John Doe',
      aliases: ['john.doe@example.com'],
      type: 'Player',
      platformId: 'oaev-platform',
    };

    expect(entity.type).toBe('Player');
    expect(entity.aliases).toContain('john.doe@example.com');
  });

  it('should accept valid entity structure for AttackPattern', () => {
    const entity: CachedOAEVEntity = {
      id: 'ap-123',
      name: 'Phishing',
      aliases: ['T1566'],
      type: 'AttackPattern',
      platformId: 'oaev-platform',
    };

    expect(entity.type).toBe('AttackPattern');
  });

  it('should accept valid entity structure for Finding', () => {
    const entity: CachedOAEVEntity = {
      id: 'finding-123',
      name: 'CVE-2021-44228',
      type: 'Finding',
      platformId: 'oaev-platform',
    };

    expect(entity.type).toBe('Finding');
  });
});

// ============================================================================
// Cache Structure Integrity Tests
// ============================================================================

describe('Cache Structure Integrity', () => {
  it('should ensure OCTI cache can be serialized and deserialized', () => {
    const cache = createEmptyOCTICache('test-platform');
    
    // Add some test data
    cache.entities['Malware'].push({
      id: 'malware--test',
      name: 'Test Malware',
      type: 'Malware',
      aliases: ['Test', 'Alias'],
    });

    const serialized = JSON.stringify(cache);
    const deserialized = JSON.parse(serialized) as OCTIEntityCache;

    expect(deserialized.platformId).toBe('test-platform');
    expect(deserialized.entities['Malware']).toHaveLength(1);
    expect(deserialized.entities['Malware'][0].name).toBe('Test Malware');
  });

  it('should ensure OAEV cache can be serialized and deserialized', () => {
    const cache = createEmptyOAEVCache('test-oaev');
    
    // Add some test data
    cache.entities['Asset'].push({
      id: 'asset--test',
      name: 'Test Asset',
      type: 'Asset',
      platformId: 'test-oaev',
    });

    const serialized = JSON.stringify(cache);
    const deserialized = JSON.parse(serialized) as OAEVCache;

    expect(deserialized.platformId).toBe('test-oaev');
    expect(deserialized.entities['Asset']).toHaveLength(1);
    expect(deserialized.entities['Asset'][0].name).toBe('Test Asset');
  });

  it('should handle large entity lists in OCTI cache', () => {
    const cache = createEmptyOCTICache();
    
    // Add many entities
    for (let i = 0; i < 1000; i++) {
      cache.entities['Malware'].push({
        id: `malware--${i}`,
        name: `Malware ${i}`,
        type: 'Malware',
      });
    }

    expect(cache.entities['Malware']).toHaveLength(1000);
  });

  it('should handle large entity lists in OAEV cache', () => {
    const cache = createEmptyOAEVCache();
    
    // Add many entities
    for (let i = 0; i < 1000; i++) {
      cache.entities['Asset'].push({
        id: `asset--${i}`,
        name: `Asset ${i}`,
        type: 'Asset',
        platformId: 'test',
      });
    }

    expect(cache.entities['Asset']).toHaveLength(1000);
  });
});

