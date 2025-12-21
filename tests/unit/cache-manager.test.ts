/**
 * Tests for background/services/cache-manager.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getCacheRefreshStatus,
  stopCacheRefresh,
  checkAndRefreshAllOCTICaches,
  checkAndRefreshAllOAEVCaches,
} from '../../src/background/services/cache-manager';
import {
  setOpenCTIClientGetter,
  setOpenAEVClientGetter,
} from '../../src/background/services/client-registry';

// Mock dependencies
vi.mock('../../src/shared/utils/logger', () => ({
  loggers: {
    background: {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  },
}));

vi.mock('../../src/shared/utils/storage', () => ({
  saveOCTICache: vi.fn().mockResolvedValue(undefined),
  shouldRefreshOCTICache: vi.fn().mockResolvedValue(true),
  createEmptyOCTICache: vi.fn((platformId: string) => ({
    platformId,
    lastUpdated: 0,
    entities: {},
  })),
  saveOAEVCache: vi.fn().mockResolvedValue(undefined),
  shouldRefreshOAEVCache: vi.fn().mockResolvedValue(true),
  createEmptyOAEVCache: vi.fn((platformId: string) => ({
    platformId,
    lastUpdated: 0,
    entities: {},
  })),
}));

// Mock chrome notifications API
beforeEach(() => {
  globalThis.chrome = {
    notifications: {
      create: vi.fn((id, options, callback) => {
        if (callback) callback(id);
      }),
    },
    runtime: {
      getURL: vi.fn((path) => `chrome-extension://test/${path}`),
      lastError: null,
    },
  } as unknown as typeof chrome;
});

describe('Cache Manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset client getters
    setOpenCTIClientGetter(() => new Map());
    setOpenAEVClientGetter(() => new Map());
    // Stop any running intervals
    stopCacheRefresh();
  });

  afterEach(() => {
    stopCacheRefresh();
    vi.restoreAllMocks();
  });

  describe('getCacheRefreshStatus', () => {
    it('should return initial status as false for both', () => {
      const status = getCacheRefreshStatus();
      
      expect(status.octi).toBe(false);
      expect(status.oaev).toBe(false);
    });
  });

  describe('stopCacheRefresh', () => {
    it('should stop all cache refresh intervals', () => {
      stopCacheRefresh();
      
      // Should not throw and status should be false
      const status = getCacheRefreshStatus();
      expect(status.octi).toBe(false);
      expect(status.oaev).toBe(false);
    });
  });

  describe('checkAndRefreshAllOCTICaches', () => {
    it('should return true when no OpenCTI clients are configured', async () => {
      setOpenCTIClientGetter(() => new Map());
      
      const result = await checkAndRefreshAllOCTICaches();
      
      expect(result).toBe(true);
    });

    it('should handle single platform cache refresh', async () => {
      const mockClient = {
        getPlatformInfo: () => ({ name: 'Test OpenCTI', url: 'https://test.opencti.io' }),
        fetchThreatActorGroups: vi.fn().mockResolvedValue([]),
        fetchThreatActorIndividuals: vi.fn().mockResolvedValue([]),
        fetchIntrusionSets: vi.fn().mockResolvedValue([]),
        fetchCampaigns: vi.fn().mockResolvedValue([]),
        fetchIncidents: vi.fn().mockResolvedValue([]),
        fetchMalware: vi.fn().mockResolvedValue([]),
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
      };
      
      const clients = new Map([['platform-1', mockClient]]);
      setOpenCTIClientGetter(() => clients as any);
      
      const result = await checkAndRefreshAllOCTICaches(true);
      
      // Empty entities means no success
      expect(result).toBe(false);
    });

    it('should refresh cache with entities', async () => {
      const mockClient = {
        getPlatformInfo: () => ({ name: 'Test OpenCTI', url: 'https://test.opencti.io' }),
        fetchThreatActorGroups: vi.fn().mockResolvedValue([{ id: 'ta-1', name: 'APT29' }]),
        fetchThreatActorIndividuals: vi.fn().mockResolvedValue([]),
        fetchIntrusionSets: vi.fn().mockResolvedValue([]),
        fetchCampaigns: vi.fn().mockResolvedValue([]),
        fetchIncidents: vi.fn().mockResolvedValue([]),
        fetchMalware: vi.fn().mockResolvedValue([{ id: 'mal-1', name: 'Emotet' }]),
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
      };
      
      const clients = new Map([['platform-1', mockClient]]);
      setOpenCTIClientGetter(() => clients as any);
      
      const result = await checkAndRefreshAllOCTICaches(true);
      
      expect(result).toBe(true);
    });

    it('should handle fetch errors gracefully', async () => {
      const mockClient = {
        getPlatformInfo: () => ({ name: 'Test OpenCTI', url: 'https://test.opencti.io' }),
        fetchThreatActorGroups: vi.fn().mockRejectedValue(new Error('Network error')),
        fetchThreatActorIndividuals: vi.fn().mockRejectedValue(new Error('Network error')),
        fetchIntrusionSets: vi.fn().mockRejectedValue(new Error('Network error')),
        fetchCampaigns: vi.fn().mockRejectedValue(new Error('Network error')),
        fetchIncidents: vi.fn().mockRejectedValue(new Error('Network error')),
        fetchMalware: vi.fn().mockRejectedValue(new Error('Network error')),
        fetchAttackPatterns: vi.fn().mockRejectedValue(new Error('Network error')),
        fetchSectors: vi.fn().mockRejectedValue(new Error('Network error')),
        fetchOrganizations: vi.fn().mockRejectedValue(new Error('Network error')),
        fetchIndividuals: vi.fn().mockRejectedValue(new Error('Network error')),
        fetchEvents: vi.fn().mockRejectedValue(new Error('Network error')),
        fetchCountries: vi.fn().mockRejectedValue(new Error('Network error')),
        fetchRegions: vi.fn().mockRejectedValue(new Error('Network error')),
        fetchCities: vi.fn().mockRejectedValue(new Error('Network error')),
        fetchAdministrativeAreas: vi.fn().mockRejectedValue(new Error('Network error')),
        fetchPositions: vi.fn().mockRejectedValue(new Error('Network error')),
        fetchTools: vi.fn().mockRejectedValue(new Error('Network error')),
        fetchNarratives: vi.fn().mockRejectedValue(new Error('Network error')),
        fetchChannels: vi.fn().mockRejectedValue(new Error('Network error')),
        fetchSystems: vi.fn().mockRejectedValue(new Error('Network error')),
      };
      
      const clients = new Map([['platform-1', mockClient]]);
      setOpenCTIClientGetter(() => clients as any);
      
      const result = await checkAndRefreshAllOCTICaches(true);
      
      // Should return false on all failures
      expect(result).toBe(false);
    });
  });

  describe('checkAndRefreshAllOAEVCaches', () => {
    it('should return true when no OpenAEV clients are configured', async () => {
      setOpenAEVClientGetter(() => new Map());
      
      const result = await checkAndRefreshAllOAEVCaches();
      
      expect(result).toBe(true);
    });

    it('should handle single platform cache refresh', async () => {
      const mockClient = {
        getPlatformInfo: () => ({ name: 'Test OpenAEV', url: 'https://test.openaev.io' }),
        fetchAllEntitiesForCache: vi.fn().mockResolvedValue({
          assets: [],
          assetGroups: [],
          teams: [],
          players: [],
        }),
        getAllAttackPatterns: vi.fn().mockResolvedValue([]),
        getAllFindings: vi.fn().mockResolvedValue([]),
      };
      
      const clients = new Map([['platform-1', mockClient]]);
      setOpenAEVClientGetter(() => clients as any);
      
      const result = await checkAndRefreshAllOAEVCaches(true);
      
      // Empty entities means no success
      expect(result).toBe(false);
    });

    it('should refresh cache with entities', async () => {
      const mockClient = {
        getPlatformInfo: () => ({ name: 'Test OpenAEV', url: 'https://test.openaev.io' }),
        fetchAllEntitiesForCache: vi.fn().mockResolvedValue({
          assets: [{ endpoint_id: 'ep-1', endpoint_name: 'Server1' }],
          assetGroups: [{ asset_group_id: 'ag-1', asset_group_name: 'Production' }],
          teams: [{ team_id: 'tm-1', team_name: 'Red Team' }],
          players: [{ user_id: 'usr-1', user_firstname: 'John', user_lastname: 'Doe' }],
        }),
        getAllAttackPatterns: vi.fn().mockResolvedValue([
          { attack_pattern_id: 'ap-1', attack_pattern_name: 'Phishing' },
        ]),
        getAllFindings: vi.fn().mockResolvedValue([]),
      };
      
      const clients = new Map([['platform-1', mockClient]]);
      setOpenAEVClientGetter(() => clients as any);
      
      const result = await checkAndRefreshAllOAEVCaches(true);
      
      expect(result).toBe(true);
    });

    it('should handle fetch errors gracefully', async () => {
      const mockClient = {
        getPlatformInfo: () => ({ name: 'Test OpenAEV', url: 'https://test.openaev.io' }),
        fetchAllEntitiesForCache: vi.fn().mockRejectedValue(new Error('Network error')),
        getAllAttackPatterns: vi.fn().mockRejectedValue(new Error('Network error')),
        getAllFindings: vi.fn().mockRejectedValue(new Error('Network error')),
      };
      
      const clients = new Map([['platform-1', mockClient]]);
      setOpenAEVClientGetter(() => clients as any);
      
      const result = await checkAndRefreshAllOAEVCaches(true);
      
      // Should return false on all failures
      expect(result).toBe(false);
    });
  });

  describe('Multiple platforms', () => {
    it('should handle multiple OpenCTI platforms', async () => {
      const createMockClient = (name: string, hasEntities: boolean) => ({
        getPlatformInfo: () => ({ name, url: `https://${name}.opencti.io` }),
        fetchThreatActorGroups: vi.fn().mockResolvedValue(hasEntities ? [{ id: 'ta-1', name: 'APT' }] : []),
        fetchThreatActorIndividuals: vi.fn().mockResolvedValue([]),
        fetchIntrusionSets: vi.fn().mockResolvedValue([]),
        fetchCampaigns: vi.fn().mockResolvedValue([]),
        fetchIncidents: vi.fn().mockResolvedValue([]),
        fetchMalware: vi.fn().mockResolvedValue([]),
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
      });
      
      const clients = new Map([
        ['platform-1', createMockClient('Platform1', true)],
        ['platform-2', createMockClient('Platform2', true)],
      ]);
      setOpenCTIClientGetter(() => clients as any);
      
      const result = await checkAndRefreshAllOCTICaches(true);
      
      expect(result).toBe(true);
    });
  });
});

