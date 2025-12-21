/**
 * Cache Manager Service Tests
 *
 * Tests for the cache management system for OpenCTI and OpenAEV platforms.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  checkAndRefreshAllOCTICaches,
  checkAndRefreshAllOAEVCaches,
  getCacheRefreshStatus,
  stopCacheRefresh,
} from '../../src/background/services/cache-manager';
import * as clientRegistry from '../../src/background/services/client-registry';
import type { OpenCTIClient } from '../../src/shared/api/opencti-client';
import type { OpenAEVClient } from '../../src/shared/api/openaev-client';

// Mock the storage module
vi.mock('../../src/shared/utils/storage', () => ({
  saveOCTICache: vi.fn().mockResolvedValue(undefined),
  shouldRefreshOCTICache: vi.fn().mockResolvedValue(true),
  createEmptyOCTICache: vi.fn((platformId) => ({
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
      'Tool': [],
      'Narrative': [],
      'Channel': [],
      'System': [],
    },
  })),
  saveOAEVCache: vi.fn().mockResolvedValue(undefined),
  shouldRefreshOAEVCache: vi.fn().mockResolvedValue(true),
  createEmptyOAEVCache: vi.fn((platformId) => ({
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
  })),
}));

vi.mock('../../src/shared/utils/logger', () => ({
  loggers: {
    background: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  },
}));

// Mock chrome.notifications
const mockChrome = {
  notifications: {
    create: vi.fn((id, opts, cb) => {
      if (cb) cb(id);
    }),
  },
  runtime: {
    getURL: vi.fn((path) => `chrome-extension://mock-id/${path}`),
    lastError: null,
  },
};

// Create mock clients
function createMockOpenCTIClient(platformId: string, platformName: string): OpenCTIClient {
  return {
    getPlatformInfo: vi.fn().mockReturnValue({ id: platformId, name: platformName }),
    fetchThreatActorGroups: vi.fn().mockResolvedValue([]),
    fetchThreatActorIndividuals: vi.fn().mockResolvedValue([]),
    fetchIntrusionSets: vi.fn().mockResolvedValue([]),
    fetchCampaigns: vi.fn().mockResolvedValue([]),
    fetchIncidents: vi.fn().mockResolvedValue([]),
    fetchMalware: vi.fn().mockResolvedValue([{ id: 'malware-1', name: 'TestMalware' }]),
    fetchAttackPatterns: vi.fn().mockResolvedValue([]),
    fetchSectors: vi.fn().mockResolvedValue([]),
    fetchOrganizations: vi.fn().mockResolvedValue([]),
    fetchIndividuals: vi.fn().mockResolvedValue([]),
    fetchEvents: vi.fn().mockResolvedValue([]),
    fetchCountries: vi.fn().mockResolvedValue([]),
    fetchRegions: vi.fn().mockResolvedValue([]),
    fetchCities: vi.fn().mockResolvedValue([]),
    fetchAdministrativeAreas: vi.fn().mockResolvedValue([]),
    fetchPositions: vi.fn().mockResolvedValue([]),
    fetchTools: vi.fn().mockResolvedValue([]),
    fetchNarratives: vi.fn().mockResolvedValue([]),
    fetchChannels: vi.fn().mockResolvedValue([]),
    fetchSystems: vi.fn().mockResolvedValue([]),
  } as unknown as OpenCTIClient;
}

function createMockOpenAEVClient(platformId: string, platformName: string): OpenAEVClient {
  return {
    getPlatformInfo: vi.fn().mockReturnValue({ id: platformId, name: platformName }),
    fetchAllEntitiesForCache: vi.fn().mockResolvedValue({
      assets: [{ asset_id: 'asset-1', asset_name: 'TestAsset' }],
      assetGroups: [],
      teams: [],
      players: [],
    }),
    getAllAttackPatterns: vi.fn().mockResolvedValue([]),
    getAllFindings: vi.fn().mockResolvedValue([]),
  } as unknown as OpenAEVClient;
}

describe('Cache Manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup chrome mock
    (globalThis as any).chrome = mockChrome;
    
    // Reset client registry to empty
    vi.spyOn(clientRegistry, 'getOpenCTIClients').mockReturnValue(new Map());
    vi.spyOn(clientRegistry, 'getOpenAEVClients').mockReturnValue(new Map());
  });

  afterEach(() => {
    stopCacheRefresh();
    delete (globalThis as any).chrome;
  });

  // ============================================================================
  // OpenCTI Cache Tests
  // ============================================================================

  describe('OpenCTI Cache', () => {
    describe('checkAndRefreshAllOCTICaches', () => {
      it('should return true when no clients configured', async () => {
        const result = await checkAndRefreshAllOCTICaches();
        expect(result).toBe(true);
      });

      it('should refresh cache when client is configured', async () => {
        const mockClient = createMockOpenCTIClient('platform-1', 'Test Platform');
        vi.spyOn(clientRegistry, 'getOpenCTIClients').mockReturnValue(
          new Map([['platform-1', mockClient]])
        );

        const result = await checkAndRefreshAllOCTICaches();

        expect(result).toBe(true);
        expect(mockClient.fetchMalware).toHaveBeenCalled();
      });

      it('should force refresh when forceRefresh is true', async () => {
        const { shouldRefreshOCTICache } = await import('../../src/shared/utils/storage');
        vi.mocked(shouldRefreshOCTICache).mockResolvedValue(false); // Cache is fresh

        const mockClient = createMockOpenCTIClient('platform-1', 'Test Platform');
        vi.spyOn(clientRegistry, 'getOpenCTIClients').mockReturnValue(
          new Map([['platform-1', mockClient]])
        );

        const result = await checkAndRefreshAllOCTICaches(true); // Force refresh

        expect(result).toBe(true);
        expect(mockClient.fetchMalware).toHaveBeenCalled();
      });

      it('should skip refresh when cache is fresh and not forced', async () => {
        const { shouldRefreshOCTICache } = await import('../../src/shared/utils/storage');
        vi.mocked(shouldRefreshOCTICache).mockResolvedValue(false);

        const mockClient = createMockOpenCTIClient('platform-1', 'Test Platform');
        vi.spyOn(clientRegistry, 'getOpenCTIClients').mockReturnValue(
          new Map([['platform-1', mockClient]])
        );

        await checkAndRefreshAllOCTICaches(false);

        expect(mockClient.fetchMalware).not.toHaveBeenCalled();
      });

    });
  });

  // ============================================================================
  // OpenAEV Cache Tests
  // ============================================================================

  describe('OpenAEV Cache', () => {
    describe('checkAndRefreshAllOAEVCaches', () => {
      it('should return true when no clients configured', async () => {
        const result = await checkAndRefreshAllOAEVCaches();
        expect(result).toBe(true);
      });

      it('should refresh cache when client is configured', async () => {
        const mockClient = createMockOpenAEVClient('oaev-platform-1', 'Test OAEV');
        vi.spyOn(clientRegistry, 'getOpenAEVClients').mockReturnValue(
          new Map([['oaev-platform-1', mockClient]])
        );

        const result = await checkAndRefreshAllOAEVCaches();

        expect(result).toBe(true);
        expect(mockClient.fetchAllEntitiesForCache).toHaveBeenCalled();
      });

      it('should force refresh when forceRefresh is true', async () => {
        const { shouldRefreshOAEVCache } = await import('../../src/shared/utils/storage');
        vi.mocked(shouldRefreshOAEVCache).mockResolvedValue(false);

        const mockClient = createMockOpenAEVClient('oaev-platform-1', 'Test OAEV');
        vi.spyOn(clientRegistry, 'getOpenAEVClients').mockReturnValue(
          new Map([['oaev-platform-1', mockClient]])
        );

        await checkAndRefreshAllOAEVCaches(true);

        expect(mockClient.fetchAllEntitiesForCache).toHaveBeenCalled();
      });

      it('should skip refresh when cache is fresh and not forced', async () => {
        const { shouldRefreshOAEVCache } = await import('../../src/shared/utils/storage');
        vi.mocked(shouldRefreshOAEVCache).mockResolvedValue(false);

        const mockClient = createMockOpenAEVClient('oaev-platform-1', 'Test OAEV');
        vi.spyOn(clientRegistry, 'getOpenAEVClients').mockReturnValue(
          new Map([['oaev-platform-1', mockClient]])
        );

        await checkAndRefreshAllOAEVCaches(false);

        expect(mockClient.fetchAllEntitiesForCache).not.toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // Cache Status Tests
  // ============================================================================

  describe('getCacheRefreshStatus', () => {
    it('should return refresh status', () => {
      const status = getCacheRefreshStatus();

      expect(status).toHaveProperty('octi');
      expect(status).toHaveProperty('oaev');
      expect(typeof status.octi).toBe('boolean');
      expect(typeof status.oaev).toBe('boolean');
    });

    it('should return false when not refreshing', () => {
      const status = getCacheRefreshStatus();

      expect(status.octi).toBe(false);
      expect(status.oaev).toBe(false);
    });
  });

  describe('stopCacheRefresh', () => {
    it('should be callable without error', () => {
      expect(() => stopCacheRefresh()).not.toThrow();
    });

    it('should be safe to call multiple times', () => {
      expect(() => {
        stopCacheRefresh();
        stopCacheRefresh();
        stopCacheRefresh();
      }).not.toThrow();
    });
  });
});
