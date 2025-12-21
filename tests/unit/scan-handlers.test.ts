/**
 * Tests for background/handlers/scan-handlers.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleScanPage,
  handleScanOAEV,
  handleScanAll,
  scanForOAEVEntities,
  mergeScanResults,
  type ScanHandlerDependencies,
} from '../../src/background/handlers/scan-handlers';
import type { ScanResultPayload } from '../../src/shared/types/messages';

// Mock the dependencies
vi.mock('../../src/shared/utils/storage', () => ({
  getSettings: vi.fn().mockResolvedValue({
    detection: {
      disabledObservableTypes: [],
      disabledOpenCTITypes: [],
      disabledOpenAEVTypes: [],
    },
  }),
  getAllCachedOAEVEntityNamesForMatching: vi.fn().mockResolvedValue(new Map()),
  getMultiPlatformOAEVCache: vi.fn().mockResolvedValue({ platforms: {} }),
}));

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

describe('scanForOAEVEntities', () => {
  it('should find entities in text', () => {
    const content = 'The Production Web Server is affected by this vulnerability.';
    const entityMap = new Map([
      ['production web server', [{ id: 'asset-1', name: 'Production Web Server', type: 'Asset', platformId: 'plat-1' }]],
    ]);

    const results = scanForOAEVEntities(content, entityMap, false);

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Production Web Server');
    expect(results[0].type).toBe('Asset');
    expect(results[0].entityId).toBe('asset-1');
  });

  it('should skip short names (less than 4 characters)', () => {
    const content = 'The API has an issue';
    const entityMap = new Map([
      ['api', [{ id: 'asset-1', name: 'API', type: 'Asset', platformId: 'plat-1' }]],
    ]);

    const results = scanForOAEVEntities(content, entityMap, false);

    expect(results).toHaveLength(0);
  });

  it('should match longer names before shorter ones', () => {
    const content = 'The Production Web Server Main is under attack';
    const entityMap = new Map([
      ['production web server', [{ id: 'asset-1', name: 'Production Web Server', type: 'Asset', platformId: 'plat-1' }]],
      ['production web server main', [{ id: 'asset-2', name: 'Production Web Server Main', type: 'Asset', platformId: 'plat-1' }]],
    ]);

    const results = scanForOAEVEntities(content, entityMap, false);

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Production Web Server Main');
    expect(results[0].entityId).toBe('asset-2');
  });

  it('should exclude AttackPatterns when includeAttackPatterns is false', () => {
    const content = 'The attacker used Phishing for access';
    const entityMap = new Map([
      ['phishing', [{ id: 'attack-1', name: 'Phishing', type: 'AttackPattern', platformId: 'plat-1' }]],
    ]);

    const results = scanForOAEVEntities(content, entityMap, false);

    expect(results).toHaveLength(0);
  });

  it('should include AttackPatterns when includeAttackPatterns is true', () => {
    const content = 'The attacker used Phishing techniques';
    const entityMap = new Map([
      ['phishing', [{ id: 'attack-1', name: 'Phishing', type: 'AttackPattern', platformId: 'plat-1' }]],
    ]);

    const results = scanForOAEVEntities(content, entityMap, true);

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Phishing');
    expect(results[0].type).toBe('AttackPattern');
  });

  it('should not match partial words', () => {
    const content = 'TheServerIsDown';
    const entityMap = new Map([
      ['server', [{ id: 'asset-1', name: 'Server', type: 'Asset', platformId: 'plat-1' }]],
    ]);

    const results = scanForOAEVEntities(content, entityMap, false);

    expect(results).toHaveLength(0);
  });

  it('should match multiple entities with different types', () => {
    const content = 'Check the Database Server status';
    const entityMap = new Map([
      ['database server', [
        { id: 'asset-1', name: 'Database Server', type: 'Asset', platformId: 'plat-1' },
        { id: 'group-1', name: 'Database Server', type: 'AssetGroup', platformId: 'plat-1' },
      ]],
    ]);

    const results = scanForOAEVEntities(content, entityMap, false);

    expect(results).toHaveLength(2);
    expect(results.map(r => r.type).sort()).toEqual(['Asset', 'AssetGroup']);
  });

  it('should skip parent MITRE IDs followed by dot', () => {
    const content = 'Attack T1566.001 was used';
    const entityMap = new Map([
      ['t1566', [{ id: 'attack-1', name: 'T1566', type: 'AttackPattern', platformId: 'plat-1' }]],
      ['t1566.001', [{ id: 'attack-2', name: 'T1566.001', type: 'AttackPattern', platformId: 'plat-1' }]],
    ]);

    const results = scanForOAEVEntities(content, entityMap, true);

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('T1566.001');
  });

  it('should avoid overlapping ranges', () => {
    const content = 'The Test Server Main handles requests';
    const entityMap = new Map([
      ['test server main', [{ id: 'asset-1', name: 'Test Server Main', type: 'Asset', platformId: 'plat-1' }]],
      ['server main', [{ id: 'asset-2', name: 'Server Main', type: 'Asset', platformId: 'plat-1' }]],
    ]);

    const results = scanForOAEVEntities(content, entityMap, false);

    // Should only match the longer one since they overlap
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Test Server Main');
  });

  it('should handle empty content', () => {
    const content = '';
    const entityMap = new Map([
      ['server', [{ id: 'asset-1', name: 'Server', type: 'Asset', platformId: 'plat-1' }]],
    ]);

    const results = scanForOAEVEntities(content, entityMap, false);

    expect(results).toHaveLength(0);
  });

  it('should handle empty entity map', () => {
    const content = 'The server is running';
    const entityMap = new Map<string, { id: string; name: string; type: string; platformId: string }[]>();

    const results = scanForOAEVEntities(content, entityMap, false);

    expect(results).toHaveLength(0);
  });

  it('should include correct metadata in results', () => {
    const content = 'Check the Main Server for issues';
    const entityMap = new Map([
      ['main server', [{ id: 'asset-123', name: 'Main Server', type: 'Asset', platformId: 'platform-456' }]],
    ]);

    const results = scanForOAEVEntities(content, entityMap, false);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      platformType: 'openaev',
      type: 'Asset',
      name: 'Main Server',
      value: 'Main Server',
      found: true,
      entityId: 'asset-123',
      platformId: 'platform-456',
    });
    expect(results[0].startIndex).toBeGreaterThanOrEqual(0);
    expect(results[0].endIndex).toBeGreaterThan(results[0].startIndex);
  });
});

describe('mergeScanResults', () => {
  it('should merge OpenCTI and OpenAEV results', () => {
    const openCTIResult: ScanResultPayload = {
      observables: [{ type: 'IPv4-Addr', value: '1.2.3.4', found: true, startIndex: 0, endIndex: 7 }],
      openctiEntities: [],
      cves: [],
      openaevEntities: [],
      scanTime: 100,
      url: 'https://example.com',
    };

    const oaevEntities: ScanResultPayload['openaevEntities'] = [
      {
        platformType: 'openaev',
        type: 'Asset',
        name: 'Server',
        value: 'Server',
        startIndex: 10,
        endIndex: 16,
        found: true,
        entityId: 'asset-1',
        platformId: 'plat-1',
      },
    ];

    const merged = mergeScanResults(openCTIResult, oaevEntities);

    expect(merged.observables).toHaveLength(1);
    expect(merged.openaevEntities).toHaveLength(1);
    expect(merged.scanTime).toBe(100);
    expect(merged.url).toBe('https://example.com');
  });

  it('should combine existing openaev entities', () => {
    const openCTIResult: ScanResultPayload = {
      observables: [],
      openctiEntities: [],
      cves: [],
      openaevEntities: [
        {
          platformType: 'openaev',
          type: 'Asset',
          name: 'Server1',
          value: 'Server1',
          startIndex: 0,
          endIndex: 7,
          found: true,
        },
      ],
      scanTime: 100,
      url: 'https://example.com',
    };

    const oaevEntities: ScanResultPayload['openaevEntities'] = [
      {
        platformType: 'openaev',
        type: 'Asset',
        name: 'Server2',
        value: 'Server2',
        startIndex: 10,
        endIndex: 17,
        found: true,
      },
    ];

    const merged = mergeScanResults(openCTIResult, oaevEntities);

    expect(merged.openaevEntities).toHaveLength(2);
  });

  it('should handle empty oaev entities', () => {
    const openCTIResult: ScanResultPayload = {
      observables: [{ type: 'Domain-Name', value: 'example.com', found: true, startIndex: 0, endIndex: 11 }],
      openctiEntities: [],
      cves: [],
      openaevEntities: [],
      scanTime: 50,
      url: 'https://test.com',
    };

    const merged = mergeScanResults(openCTIResult, []);

    expect(merged.observables).toHaveLength(1);
    expect(merged.openaevEntities).toHaveLength(0);
  });

  it('should handle undefined oaev entities', () => {
    const openCTIResult: ScanResultPayload = {
      observables: [],
      openctiEntities: [],
      cves: [],
      openaevEntities: undefined as unknown as ScanResultPayload['openaevEntities'],
      scanTime: 0,
      url: 'https://test.com',
    };

    const merged = mergeScanResults(openCTIResult, undefined as unknown as ScanResultPayload['openaevEntities']);

    expect(merged.openaevEntities).toHaveLength(0);
  });
});

describe('handleScanPage', () => {
  let mockSendResponse: ReturnType<typeof vi.fn>;
  let mockDeps: ScanHandlerDependencies;

  beforeEach(() => {
    mockSendResponse = vi.fn();
    mockDeps = {
      getDetectionEngine: vi.fn().mockReturnValue(null),
      getOpenAEVClients: vi.fn().mockReturnValue(new Map()),
    };
  });

  it('should return error when detection engine is not configured', async () => {
    await handleScanPage(
      { content: 'test', url: 'https://example.com' },
      mockSendResponse,
      mockDeps
    );

    expect(mockSendResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'OpenCTI not configured',
      })
    );
  });

  it('should scan successfully with detection engine', async () => {
    const mockEngine = {
      scan: vi.fn().mockResolvedValue({
        observables: [{ type: 'IPv4-Addr', value: '1.2.3.4', found: true, startIndex: 0, endIndex: 7 }],
        openctiEntities: [],
        cves: [],
        scanTime: 100,
      }),
    };
    mockDeps.getDetectionEngine = vi.fn().mockReturnValue(mockEngine);

    await handleScanPage(
      { content: 'IP: 1.2.3.4', url: 'https://example.com' },
      mockSendResponse,
      mockDeps
    );

    expect(mockSendResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          observables: expect.any(Array),
          url: 'https://example.com',
        }),
      })
    );
  });

  it('should handle scan errors gracefully', async () => {
    const mockEngine = {
      scan: vi.fn().mockRejectedValue(new Error('Scan failed')),
    };
    mockDeps.getDetectionEngine = vi.fn().mockReturnValue(mockEngine);

    await handleScanPage(
      { content: 'test', url: 'https://example.com' },
      mockSendResponse,
      mockDeps
    );

    expect(mockSendResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Scan failed',
      })
    );
  });
});

describe('handleScanOAEV', () => {
  let mockSendResponse: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSendResponse = vi.fn();
  });

  it('should return success with empty results when no cache', async () => {
    await handleScanOAEV(
      { content: 'test content', url: 'https://example.com' },
      mockSendResponse
    );

    expect(mockSendResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          openaevEntities: [],
          url: 'https://example.com',
        }),
      })
    );
  });
});

describe('handleScanAll', () => {
  let mockSendResponse: ReturnType<typeof vi.fn>;
  let mockDeps: ScanHandlerDependencies;

  beforeEach(() => {
    mockSendResponse = vi.fn();
    mockDeps = {
      getDetectionEngine: vi.fn().mockReturnValue(null),
      getOpenAEVClients: vi.fn().mockReturnValue(new Map()),
    };
  });

  it('should return success even without detection engine', async () => {
    await handleScanAll(
      { content: 'test', url: 'https://example.com' },
      mockSendResponse,
      mockDeps
    );

    expect(mockSendResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          observables: [],
          openctiEntities: [],
          cves: [],
          openaevEntities: [],
          url: 'https://example.com',
        }),
      })
    );
  });

  it('should combine results from both platforms', async () => {
    const mockEngine = {
      scan: vi.fn().mockResolvedValue({
        observables: [{ type: 'IPv4-Addr', value: '1.2.3.4', found: true, startIndex: 0, endIndex: 7 }],
        openctiEntities: [],
        cves: [],
        scanTime: 100,
      }),
    };
    mockDeps.getDetectionEngine = vi.fn().mockReturnValue(mockEngine);

    await handleScanAll(
      { content: 'IP: 1.2.3.4', url: 'https://example.com' },
      mockSendResponse,
      mockDeps
    );

    expect(mockSendResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          observables: expect.any(Array),
        }),
      })
    );
  });

  it('should handle scan errors gracefully', async () => {
    const mockEngine = {
      scan: vi.fn().mockRejectedValue(new Error('Detection failed')),
    };
    mockDeps.getDetectionEngine = vi.fn().mockReturnValue(mockEngine);

    await handleScanAll(
      { content: 'test', url: 'https://example.com' },
      mockSendResponse,
      mockDeps
    );

    // Should still succeed even if OpenCTI scan fails
    expect(mockSendResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
      })
    );
  });
});

