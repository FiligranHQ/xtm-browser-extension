/**
 * Unit Tests for OpenAEV Client
 * 
 * Tests the OpenAEV REST API client functionality.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenAEVClient } from '../../src/shared/api/openaev-client';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock the logger
vi.mock('../../src/shared/utils/logger', () => ({
  loggers: {
    openaev: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  },
}));

// Helper to create mock responses
function createMockResponse<T>(data: T) {
  return {
    ok: true,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  };
}

function createErrorResponse(status: number, body: string) {
  return {
    ok: false,
    status,
    json: () => Promise.reject(new Error(body)),
    text: () => Promise.resolve(body),
  };
}

function createPaginatedResponse<T>(content: T[], page: number, totalPages: number, totalElements: number) {
  return createMockResponse({
    content,
    totalPages,
    totalElements,
    size: content.length,
    number: page,
    numberOfElements: content.length,
    first: page === 0,
    last: page === totalPages - 1,
    empty: content.length === 0,
  });
}

describe('OpenAEVClient', () => {
  let client: OpenAEVClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new OpenAEVClient({
      id: 'test-platform',
      name: 'Test OpenAEV',
      url: 'https://demo.openaev.io',
      apiToken: 'test-token-123',
      enabled: true,
      type: 'openaev',
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ============================================================================
  // Connection Tests
  // ============================================================================

  describe('testConnection', () => {
    it('should return success with user info', async () => {
      const mockUser = { user_id: 'u-123', user_email: 'test@example.com', user_firstname: 'Test' };
      const mockSettings = { platform_name: 'Test Platform', platform_version: '1.0.0' };

      mockFetch
        .mockResolvedValueOnce(createMockResponse(mockUser))
        .mockResolvedValueOnce(createMockResponse(mockSettings));

      const result = await client.testConnection();

      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockUser);
      expect(result.platform_name).toBe('Test Platform');
    });

    it('should return success even if settings fail', async () => {
      const mockUser = { user_id: 'u-123' };

      mockFetch
        .mockResolvedValueOnce(createMockResponse(mockUser))
        .mockRejectedValueOnce(new Error('Settings failed'));

      const result = await client.testConnection();

      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockUser);
    });

    it('should throw error on connection failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(client.testConnection()).rejects.toThrow('Network error');
    });
  });

  describe('fetchPlatformSettings', () => {
    it('should return platform settings', async () => {
      const mockSettings = {
        platform_name: 'Test',
        platform_theme: 'dark',
        platform_lang: 'en',
        platform_version: '1.0.0',
        platform_license: { license_is_enterprise: true },
      };
      mockFetch.mockResolvedValueOnce(createMockResponse(mockSettings));

      const result = await client.fetchPlatformSettings();

      expect(result).toEqual(mockSettings);
    });

    it('should return null on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Failed'));

      const result = await client.fetchPlatformSettings();

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // Asset Tests
  // ============================================================================

  describe('searchAssets', () => {
    it('should search assets', async () => {
      const mockAssets = [
        { asset_id: 'a-1', asset_name: 'Server1' },
        { asset_id: 'a-2', asset_name: 'Server2' },
      ];
      mockFetch.mockResolvedValueOnce(createMockResponse({ content: mockAssets }));

      const results = await client.searchAssets('Server');

      expect(results).toHaveLength(2);
      expect(results[0].asset_name).toBe('Server1');
    });

    it('should return empty array on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Search failed'));

      const results = await client.searchAssets('test');

      expect(results).toHaveLength(0);
    });
  });

  describe('getAsset', () => {
    it('should get asset by ID', async () => {
      const mockAsset = { asset_id: 'a-123', asset_name: 'Web Server' };
      mockFetch.mockResolvedValueOnce(createMockResponse(mockAsset));

      const result = await client.getAsset('a-123');

      expect(result).toEqual(mockAsset);
    });

    it('should return null on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Not found'));

      const result = await client.getAsset('invalid');

      expect(result).toBeNull();
    });
  });

  describe('getAllAssets', () => {
    it('should paginate through all assets', async () => {
      mockFetch
        .mockResolvedValueOnce(createPaginatedResponse([{ asset_id: 'a-1' }], 0, 2, 2))
        .mockResolvedValueOnce(createPaginatedResponse([{ asset_id: 'a-2' }], 1, 2, 2));

      const results = await client.getAllAssets();

      expect(results).toHaveLength(2);
    });

    it('should return empty array on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Failed'));

      const results = await client.getAllAssets();

      expect(results).toHaveLength(0);
    });
  });

  // ============================================================================
  // Asset Group Tests
  // ============================================================================

  describe('searchAssetGroups', () => {
    it('should search asset groups', async () => {
      const mockGroups = [{ asset_group_id: 'ag-1', asset_group_name: 'Production' }];
      mockFetch.mockResolvedValueOnce(createMockResponse({ content: mockGroups }));

      const results = await client.searchAssetGroups('Prod');

      expect(results).toHaveLength(1);
    });
  });

  describe('getAssetGroup', () => {
    it('should get asset group by ID', async () => {
      const mockGroup = { asset_group_id: 'ag-1', asset_group_name: 'Production' };
      mockFetch.mockResolvedValueOnce(createMockResponse(mockGroup));

      const result = await client.getAssetGroup('ag-1');

      expect(result).toEqual(mockGroup);
    });
  });

  describe('getAllAssetGroups', () => {
    it('should get all asset groups', async () => {
      mockFetch.mockResolvedValueOnce(createPaginatedResponse([{ asset_group_id: 'ag-1' }], 0, 1, 1));

      const results = await client.getAllAssetGroups();

      expect(results).toHaveLength(1);
    });
  });

  // ============================================================================
  // Player Tests
  // ============================================================================

  describe('searchPlayers', () => {
    it('should search players', async () => {
      const mockPlayers = [{ user_id: 'u-1', user_email: 'user@test.com' }];
      mockFetch.mockResolvedValueOnce(createMockResponse({ content: mockPlayers }));

      const results = await client.searchPlayers('user');

      expect(results).toHaveLength(1);
    });
  });

  describe('getPlayer', () => {
    it('should get player by ID', async () => {
      const mockPlayer = { user_id: 'u-1', user_email: 'user@test.com' };
      mockFetch.mockResolvedValueOnce(createMockResponse([mockPlayer]));

      const result = await client.getPlayer('u-1');

      expect(result).toEqual(mockPlayer);
    });

    it('should return null when no player found', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse([]));

      const result = await client.getPlayer('invalid');

      expect(result).toBeNull();
    });
  });

  describe('getAllPlayers', () => {
    it('should get all players', async () => {
      mockFetch.mockResolvedValueOnce(createPaginatedResponse([{ user_id: 'u-1' }], 0, 1, 1));

      const results = await client.getAllPlayers();

      expect(results).toHaveLength(1);
    });
  });

  // ============================================================================
  // Team Tests
  // ============================================================================

  describe('searchTeams', () => {
    it('should search teams', async () => {
      const mockTeams = [{ team_id: 't-1', team_name: 'Red Team' }];
      mockFetch.mockResolvedValueOnce(createMockResponse({ content: mockTeams }));

      const results = await client.searchTeams('Red');

      expect(results).toHaveLength(1);
    });
  });

  describe('getTeam', () => {
    it('should get team by ID', async () => {
      const mockTeam = { team_id: 't-1', team_name: 'Red Team' };
      mockFetch.mockResolvedValueOnce(createMockResponse(mockTeam));

      const result = await client.getTeam('t-1');

      expect(result).toEqual(mockTeam);
    });
  });

  describe('getAllTeams', () => {
    it('should get all teams', async () => {
      mockFetch.mockResolvedValueOnce(createPaginatedResponse([{ team_id: 't-1' }], 0, 1, 1));

      const results = await client.getAllTeams();

      expect(results).toHaveLength(1);
    });
  });

  // ============================================================================
  // Attack Pattern Tests
  // ============================================================================

  describe('getAttackPattern', () => {
    it('should get attack pattern by ID', async () => {
      const mockAP = { attack_pattern_id: 'ap-1', attack_pattern_name: 'T1059' };
      mockFetch.mockResolvedValueOnce(createMockResponse(mockAP));

      const result = await client.getAttackPattern('ap-1');

      expect(result).toEqual(mockAP);
    });
  });

  describe('getAllAttackPatterns', () => {
    it('should get all attack patterns', async () => {
      mockFetch.mockResolvedValueOnce(createPaginatedResponse([
        { attack_pattern_id: 'ap-1', attack_pattern_name: 'T1059' },
      ], 0, 1, 1));

      const results = await client.getAllAttackPatterns();

      expect(results).toHaveLength(1);
    });
  });

  describe('getAttackPatternUrl', () => {
    it('should return correct URL', () => {
      const url = client.getAttackPatternUrl('ap-123');
      expect(url).toBe('https://demo.openaev.io/admin/attack_patterns/ap-123');
    });
  });

  // ============================================================================
  // Finding Tests
  // ============================================================================

  describe('getFinding', () => {
    it('should get finding by ID', async () => {
      const mockFinding = { finding_id: 'f-1', finding_value: '192.168.1.1' };
      mockFetch.mockResolvedValueOnce(createMockResponse(mockFinding));

      const result = await client.getFinding('f-1');

      expect(result).toEqual(mockFinding);
    });
  });

  describe('getAllFindings', () => {
    it('should get all findings with pagination', async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse({
          content: [{ finding_id: 'f-1' }],
          totalPages: 2,
          totalElements: 2,
        }))
        .mockResolvedValueOnce(createMockResponse({
          content: [{ finding_id: 'f-2' }],
          totalPages: 2,
          totalElements: 2,
        }));

      const results = await client.getAllFindings();

      expect(results).toHaveLength(2);
    });
  });

  describe('getFindingUrl', () => {
    it('should return correct URL', () => {
      const url = client.getFindingUrl('f-123');
      expect(url).toBe('https://demo.openaev.io/admin/findings/f-123');
    });
  });

  // ============================================================================
  // Vulnerability Tests
  // ============================================================================

  describe('getVulnerabilityByExternalId', () => {
    it('should get vulnerability by CVE ID', async () => {
      const mockVuln = {
        vulnerability_id: 'v-1',
        vulnerability_external_id: 'CVE-2021-44228',
        vulnerability_cvss_v31: 10.0,
      };
      mockFetch.mockResolvedValueOnce(createMockResponse(mockVuln));

      const result = await client.getVulnerabilityByExternalId('CVE-2021-44228');

      expect(result).toEqual(mockVuln);
    });

    it('should return null when not found (404)', async () => {
      mockFetch.mockResolvedValueOnce(createErrorResponse(404, 'Not Found'));

      const result = await client.getVulnerabilityByExternalId('CVE-9999-9999');

      expect(result).toBeNull();
    });

    it('should return null on empty result', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({}));

      const result = await client.getVulnerabilityByExternalId('CVE-2021-44228');

      expect(result).toBeNull();
    });
  });

  describe('getVulnerability', () => {
    it('should get vulnerability by ID', async () => {
      const mockVuln = { vulnerability_id: 'v-1', vulnerability_external_id: 'CVE-2021-44228' };
      mockFetch.mockResolvedValueOnce(createMockResponse(mockVuln));

      const result = await client.getVulnerability('v-1');

      expect(result).toEqual(mockVuln);
    });
  });

  describe('getVulnerabilityUrl', () => {
    it('should return correct URL', () => {
      const url = client.getVulnerabilityUrl('v-123');
      expect(url).toBe('https://demo.openaev.io/admin/vulnerabilities/v-123');
    });
  });

  // ============================================================================
  // Cache Management Tests
  // ============================================================================

  describe('Tag Cache', () => {
    it('should fetch and cache tags', async () => {
      const mockTags = [
        { tag_id: 't-1', tag_name: 'critical' },
        { tag_id: 't-2', tag_name: 'high' },
      ];
      mockFetch.mockResolvedValueOnce(createMockResponse(mockTags));

      await client.fetchAllTags();
      const resolved = client.resolveTagIds(['t-1', 't-2']);

      expect(resolved).toContain('critical');
      expect(resolved).toContain('high');
    });

    it('should handle tag fetch failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Failed'));

      await client.fetchAllTags();
      const resolved = client.resolveTagIds(['t-1']);

      // Should return original ID when not cached
      expect(resolved).toContain('t-1');
    });

    it('should return empty array for empty/undefined tags', () => {
      expect(client.resolveTagIds([])).toHaveLength(0);
      expect(client.resolveTagIds(undefined)).toHaveLength(0);
    });

    it('ensureTagsCached should fetch if cache empty', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse([{ tag_id: 't-1', tag_name: 'test' }]));

      await client.ensureTagsCached();

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('Kill Chain Phases Cache', () => {
    it('should fetch and cache kill chain phases', async () => {
      const mockPhases = [
        { phase_id: 'p-1', phase_kill_chain_name: 'mitre', phase_name: 'Execution', phase_order: 2 },
      ];
      mockFetch.mockResolvedValueOnce(createMockResponse(mockPhases));

      await client.fetchAllKillChainPhases();
      const resolved = client.resolveKillChainPhaseIds(['p-1']);

      expect(resolved).toContain('Execution');
    });

    it('should return empty array for empty/undefined phases', () => {
      expect(client.resolveKillChainPhaseIds([])).toHaveLength(0);
      expect(client.resolveKillChainPhaseIds(undefined)).toHaveLength(0);
    });
  });

  describe('Attack Patterns Cache', () => {
    it('should fetch and cache attack patterns', async () => {
      mockFetch.mockResolvedValueOnce(createPaginatedResponse([
        { attack_pattern_id: 'ap-1', attack_pattern_name: 'PowerShell', attack_pattern_external_id: 'T1059.001' },
      ], 0, 1, 1));

      await client.fetchAllAttackPatternsForCache();
      const resolved = client.resolveAttackPatternId('ap-1');

      expect(resolved).toBe('PowerShell (T1059.001)');
    });

    it('should handle attack pattern without external ID', async () => {
      mockFetch.mockResolvedValueOnce(createPaginatedResponse([
        { attack_pattern_id: 'ap-2', attack_pattern_name: 'Custom Pattern' },
      ], 0, 1, 1));

      await client.fetchAllAttackPatternsForCache();
      const resolved = client.resolveAttackPatternId('ap-2');

      expect(resolved).toBe('Custom Pattern');
    });

    it('should return ID when not cached', () => {
      const resolved = client.resolveAttackPatternId('unknown-id');
      expect(resolved).toBe('unknown-id');
    });

    it('should return undefined for undefined input', () => {
      expect(client.resolveAttackPatternId(undefined)).toBeUndefined();
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('request error handling', () => {
    it('should throw on API error', async () => {
      mockFetch.mockResolvedValueOnce(createErrorResponse(500, 'Internal Server Error'));

      await expect(client.getAsset('test')).resolves.toBeNull();
    });
  });

  // ============================================================================
  // URL Generation Tests
  // ============================================================================

  describe('URL generation', () => {
    it('should remove trailing slashes from base URL', () => {
      const clientWithSlash = new OpenAEVClient({
        id: 'test',
        name: 'Test',
        url: 'https://demo.openaev.io///',
        apiToken: 'token',
        enabled: true,
        type: 'openaev',
      });
      
      const url = clientWithSlash.getVulnerabilityUrl('v-123');
      expect(url).toBe('https://demo.openaev.io/admin/vulnerabilities/v-123');
    });
  });
});

