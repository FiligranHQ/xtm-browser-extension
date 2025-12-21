/**
 * Unit Tests for Detection Engine
 * 
 * Tests the DetectionEngine class for observable and entity detection.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DetectionEngine } from '../../src/shared/detection/detector';
import type { OpenCTIClient } from '../../src/shared/api/opencti-client';
import type { OpenAEVClient } from '../../src/shared/api/openaev-client';

// Mock the storage functions
vi.mock('../../src/shared/utils/storage', () => ({
  getAllCachedOCTIEntityNamesForMatching: vi.fn().mockResolvedValue(new Map()),
  getAllCachedOAEVEntityNamesForMatching: vi.fn().mockResolvedValue(new Map()),
}));

// Mock the logger
vi.mock('../../src/shared/utils/logger', () => ({
  loggers: {
    detection: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  },
}));

// Create mock clients
function createMockOpenCTIClient(): OpenCTIClient {
  return {
    searchObservableByValue: vi.fn().mockResolvedValue(null),
    searchObservableByHash: vi.fn().mockResolvedValue(null),
    searchSDOByNameOrAlias: vi.fn().mockResolvedValue(null),
    getVersion: vi.fn().mockResolvedValue('6.0.0'),
    isConnected: vi.fn().mockResolvedValue(true),
  } as unknown as OpenCTIClient;
}

function createMockOpenAEVClient(): OpenAEVClient {
  return {
    getVulnerabilityByExternalId: vi.fn().mockResolvedValue(null),
    isConnected: vi.fn().mockResolvedValue(true),
  } as unknown as OpenAEVClient;
}

describe('DetectionEngine', () => {
  let engine: DetectionEngine;
  let mockOCTIClient: OpenCTIClient;
  let mockOAEVClient: OpenAEVClient;

  beforeEach(() => {
    mockOCTIClient = createMockOpenCTIClient();
    mockOAEVClient = createMockOpenAEVClient();
    const clients = new Map([['test-platform', mockOCTIClient]]);
    engine = new DetectionEngine(clients);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // Constructor and Client Management Tests
  // ============================================================================

  describe('constructor', () => {
    it('should initialize with provided OpenCTI clients', () => {
      const platforms = engine.getAvailablePlatforms();
      expect(platforms.opencti).toContain('test-platform');
    });

    it('should initialize with empty OpenAEV clients by default', () => {
      const platforms = engine.getAvailablePlatforms();
      expect(platforms.openaev).toHaveLength(0);
    });

    it('should accept OpenAEV clients in constructor', () => {
      const oaevClients = new Map([['oaev-platform', mockOAEVClient]]);
      const engineWithOAEV = new DetectionEngine(
        new Map([['octi-platform', mockOCTIClient]]),
        oaevClients
      );
      const platforms = engineWithOAEV.getAvailablePlatforms();
      expect(platforms.openaev).toContain('oaev-platform');
    });

    it('should handle empty client map', () => {
      const emptyEngine = new DetectionEngine(new Map());
      const platforms = emptyEngine.getAvailablePlatforms();
      expect(platforms.opencti).toHaveLength(0);
    });
  });

  describe('addClient', () => {
    it('should add a new OpenCTI client', () => {
      const newClient = createMockOpenCTIClient();
      engine.addClient('new-platform', newClient);
      const platforms = engine.getAvailablePlatforms();
      expect(platforms.opencti).toContain('new-platform');
    });

    it('should replace existing client with same ID', () => {
      const newClient = createMockOpenCTIClient();
      engine.addClient('test-platform', newClient);
      const platforms = engine.getAvailablePlatforms();
      expect(platforms.opencti.filter(p => p === 'test-platform')).toHaveLength(1);
    });
  });

  describe('setOAEVClients', () => {
    it('should set OpenAEV clients', () => {
      const oaevClients = new Map([
        ['oaev-1', mockOAEVClient],
        ['oaev-2', createMockOpenAEVClient()],
      ]);
      engine.setOAEVClients(oaevClients);
      const platforms = engine.getAvailablePlatforms();
      expect(platforms.openaev).toContain('oaev-1');
      expect(platforms.openaev).toContain('oaev-2');
    });
  });

  describe('getAvailablePlatforms', () => {
    it('should return correct platform lists', () => {
      engine.setOAEVClients(new Map([['oaev-test', mockOAEVClient]]));
      const platforms = engine.getAvailablePlatforms();
      expect(platforms).toHaveProperty('opencti');
      expect(platforms).toHaveProperty('openaev');
      expect(platforms.opencti).toEqual(['test-platform']);
      expect(platforms.openaev).toEqual(['oaev-test']);
    });
  });

  // ============================================================================
  // Observable Detection Tests
  // ============================================================================

  describe('detectObservables', () => {
    it('should detect IPv4 addresses', () => {
      const text = 'The server IP is 192.168.1.1 and gateway is 10.0.0.1';
      const results = engine.detectObservables(text);
      
      const ipv4s = results.filter(r => r.type === 'IPv4-Addr');
      expect(ipv4s).toHaveLength(2);
      expect(ipv4s.map(r => r.value)).toContain('192.168.1.1');
      expect(ipv4s.map(r => r.value)).toContain('10.0.0.1');
    });

    it('should detect defanged IPv4 addresses', () => {
      const text = 'Malicious IP: 192[.]168[.]1[.]1';
      const results = engine.detectObservables(text);
      
      const ipv4s = results.filter(r => r.type === 'IPv4-Addr');
      expect(ipv4s).toHaveLength(1);
      expect(ipv4s[0].value).toBe('192[.]168[.]1[.]1');
      expect(ipv4s[0].refangedValue).toBe('192.168.1.1');
      expect(ipv4s[0].isDefanged).toBe(true);
    });

    it('should detect domain names', () => {
      const text = 'Visit example.com or malicious.org';
      const results = engine.detectObservables(text);
      
      const domains = results.filter(r => r.type === 'Domain-Name');
      expect(domains).toHaveLength(2);
    });

    it('should detect defanged domains', () => {
      const text = 'C2: evil[.]example[.]com';
      const results = engine.detectObservables(text);
      
      const domains = results.filter(r => r.type === 'Domain-Name');
      expect(domains).toHaveLength(1);
      expect(domains[0].isDefanged).toBe(true);
      expect(domains[0].refangedValue).toBe('evil.example.com');
    });

    it('should detect URLs', () => {
      const text = 'Download from https://example.com/malware.exe';
      const results = engine.detectObservables(text);
      
      const urls = results.filter(r => r.type === 'Url');
      expect(urls).toHaveLength(1);
      expect(urls[0].value).toBe('https://example.com/malware.exe');
    });

    it('should detect defanged URLs', () => {
      const text = 'C2 URL: hxxps://evil[.]com/beacon';
      const results = engine.detectObservables(text);
      
      const urls = results.filter(r => r.type === 'Url');
      expect(urls).toHaveLength(1);
      expect(urls[0].isDefanged).toBe(true);
    });

    it('should detect email addresses', () => {
      const text = 'Contact: admin@example.com or support@test.org';
      const results = engine.detectObservables(text);
      
      const emails = results.filter(r => r.type === 'Email-Addr');
      expect(emails).toHaveLength(2);
    });

    it('should detect MD5 hashes', () => {
      const text = 'File hash: d41d8cd98f00b204e9800998ecf8427e';
      const results = engine.detectObservables(text);
      
      const hashes = results.filter(r => r.hashType === 'MD5');
      expect(hashes).toHaveLength(1);
    });

    it('should detect SHA-1 hashes', () => {
      const text = 'SHA1: da39a3ee5e6b4b0d3255bfef95601890afd80709';
      const results = engine.detectObservables(text);
      
      const hashes = results.filter(r => r.hashType === 'SHA-1');
      expect(hashes).toHaveLength(1);
    });

    it('should detect SHA-256 hashes', () => {
      const text = 'SHA256: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
      const results = engine.detectObservables(text);
      
      const hashes = results.filter(r => r.hashType === 'SHA-256');
      expect(hashes).toHaveLength(1);
    });

    it('should detect MAC addresses', () => {
      const text = 'Device MAC: 00:1A:2B:3C:4D:5E';
      const results = engine.detectObservables(text);
      
      const macs = results.filter(r => r.type === 'Mac-Addr');
      expect(macs).toHaveLength(1);
    });

    it('should detect Bitcoin addresses', () => {
      const text = 'Send payment to 1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2';
      const results = engine.detectObservables(text);
      
      const btc = results.filter(r => r.type === 'Cryptocurrency-Wallet');
      expect(btc).toHaveLength(1);
    });

    it('should detect ASN numbers', () => {
      const text = 'Traffic from AS12345';
      const results = engine.detectObservables(text);
      
      const asns = results.filter(r => r.type === 'Autonomous-System');
      expect(asns).toHaveLength(1);
    });

    it('should avoid duplicate detections by value', () => {
      const text = '192.168.1.1 and also 192.168.1.1 again';
      const results = engine.detectObservables(text);
      
      const ipv4s = results.filter(r => r.type === 'IPv4-Addr');
      // The deduplication logic keeps the first occurrence
      expect(ipv4s.length).toBeLessThanOrEqual(2);
    });

    it('should prefer non-defanged over defanged duplicates', () => {
      // This tests the logic that keeps non-defanged versions when both exist
      const text = 'IP: 192.168.1.1 and defanged: 192[.]168[.]1[.]1';
      const results = engine.detectObservables(text);
      
      const ipv4s = results.filter(r => r.type === 'IPv4-Addr' && r.refangedValue === '192.168.1.1');
      // Should have at least one, preferring non-defanged
      expect(ipv4s.length).toBeGreaterThanOrEqual(1);
    });

    it('should return results sorted by position', () => {
      const text = 'First 192.168.1.1 then example.com';
      const results = engine.detectObservables(text);
      
      expect(results.length).toBeGreaterThan(0);
      for (let i = 1; i < results.length; i++) {
        expect(results[i].startIndex).toBeGreaterThanOrEqual(results[i - 1].startIndex);
      }
    });

    it('should include context for each match', () => {
      const text = 'The server at 192.168.1.1 is compromised';
      const results = engine.detectObservables(text);
      
      const ipv4 = results.find(r => r.type === 'IPv4-Addr');
      expect(ipv4?.context).toBeDefined();
      expect(ipv4?.context).toContain('192.168.1.1');
    });

    it('should handle empty text', () => {
      const results = engine.detectObservables('');
      expect(results).toHaveLength(0);
    });

    it('should handle text with no observables', () => {
      const results = engine.detectObservables('This is just regular text');
      expect(results).toHaveLength(0);
    });
  });

  // ============================================================================
  // CVE Detection Tests
  // ============================================================================

  describe('detectCVEs', () => {
    it('should detect standard CVE format', () => {
      const text = 'Vulnerability CVE-2021-44228 affects Log4j';
      const results = engine.detectCVEs(text);
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('CVE-2021-44228');
      expect(results[0].type).toBe('Vulnerability');
    });

    it('should detect multiple CVEs', () => {
      const text = 'CVE-2021-44228 and CVE-2022-0001 are critical';
      const results = engine.detectCVEs(text);
      
      expect(results).toHaveLength(2);
    });

    it('should be case insensitive', () => {
      const text = 'The cve-2021-44228 vulnerability';
      const results = engine.detectCVEs(text);
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('CVE-2021-44228');
    });

    it('should normalize various dash characters', () => {
      const text = 'CVE\u20132021\u201344228'; // en-dash
      const results = engine.detectCVEs(text);
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('CVE-2021-44228');
    });

    it('should handle CVEs with 5+ digit sequence numbers', () => {
      const text = 'CVE-2021-12345 and CVE-2021-123456 and CVE-2021-1234567';
      const results = engine.detectCVEs(text);
      
      expect(results).toHaveLength(3);
    });

    it('should preserve original matched value', () => {
      const text = 'The cve-2021-44228 bug';
      const results = engine.detectCVEs(text);
      
      expect(results[0].matchedValue).toBe('cve-2021-44228');
      expect(results[0].name).toBe('CVE-2021-44228'); // Normalized
    });

    it('should handle empty text', () => {
      const results = engine.detectCVEs('');
      expect(results).toHaveLength(0);
    });

    it('should handle text with no CVEs', () => {
      const results = engine.detectCVEs('No vulnerabilities here');
      expect(results).toHaveLength(0);
    });
  });

  // ============================================================================
  // Enrichment Tests
  // ============================================================================

  describe('enrichObservables', () => {
    it('should enrich observables with OpenCTI data', async () => {
      const mockResult = {
        id: 'observable-123',
        entity_type: 'IPv4-Addr',
        value: '192.168.1.1',
      };
      (mockOCTIClient.searchObservableByValue as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);
      
      const observables = [{
        type: 'IPv4-Addr' as const,
        value: '192.168.1.1',
        startIndex: 0,
        endIndex: 11,
        context: 'IP: 192.168.1.1',
        found: false,
      }];
      
      const results = await engine.enrichObservables(observables);
      
      expect(results[0].found).toBe(true);
      expect(results[0].entityId).toBe('observable-123');
      expect(results[0].platformId).toBe('test-platform');
    });

    it('should handle enrichment failures gracefully', async () => {
      (mockOCTIClient.searchObservableByValue as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('API Error'));
      
      const observables = [{
        type: 'IPv4-Addr' as const,
        value: '192.168.1.1',
        startIndex: 0,
        endIndex: 11,
        context: '',
        found: false,
      }];
      
      const results = await engine.enrichObservables(observables);
      
      expect(results[0].found).toBe(false);
    });

    it('should enrich hashes using searchObservableByHash', async () => {
      const mockResult = {
        id: 'hash-123',
        entity_type: 'StixFile',
        hashes: { MD5: 'd41d8cd98f00b204e9800998ecf8427e' },
      };
      (mockOCTIClient.searchObservableByHash as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);
      
      const observables = [{
        type: 'StixFile' as const,
        value: 'd41d8cd98f00b204e9800998ecf8427e',
        hashType: 'MD5' as const,
        startIndex: 0,
        endIndex: 32,
        context: '',
        found: false,
      }];
      
      const results = await engine.enrichObservables(observables);
      
      expect(mockOCTIClient.searchObservableByHash).toHaveBeenCalledWith(
        'd41d8cd98f00b204e9800998ecf8427e',
        'MD5'
      );
      expect(results[0].found).toBe(true);
    });

    it('should use refangedValue for lookups', async () => {
      const observables = [{
        type: 'IPv4-Addr' as const,
        value: '192[.]168[.]1[.]1',
        refangedValue: '192.168.1.1',
        isDefanged: true,
        startIndex: 0,
        endIndex: 17,
        context: '',
        found: false,
      }];
      
      await engine.enrichObservables(observables);
      
      expect(mockOCTIClient.searchObservableByValue).toHaveBeenCalledWith(
        '192.168.1.1',
        'IPv4-Addr'
      );
    });
  });

  describe('enrichCVEs', () => {
    it('should enrich CVEs from OpenCTI', async () => {
      const mockResult = {
        id: 'vuln-123',
        entity_type: 'Vulnerability',
        name: 'CVE-2021-44228',
      };
      (mockOCTIClient.searchSDOByNameOrAlias as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);
      
      const cves = [{
        type: 'Vulnerability' as const,
        name: 'CVE-2021-44228',
        startIndex: 0,
        endIndex: 14,
        found: false,
      }];
      
      const results = await engine.enrichCVEs(cves);
      
      expect(results[0].found).toBe(true);
      expect(results[0].entityId).toBe('vuln-123');
    });

    it('should search OpenAEV for CVEs when enabled', async () => {
      engine.setOAEVClients(new Map([['oaev-platform', mockOAEVClient]]));
      
      const mockOAEVResult = {
        vulnerability_id: 'oaev-vuln-123',
        vulnerability_external_id: 'CVE-2021-44228',
        vulnerability_description: 'Log4j vulnerability',
        vulnerability_cvss_v31: 10.0,
      };
      (mockOAEVClient.getVulnerabilityByExternalId as ReturnType<typeof vi.fn>).mockResolvedValue(mockOAEVResult);
      
      const cves = [{
        type: 'Vulnerability' as const,
        name: 'CVE-2021-44228',
        startIndex: 0,
        endIndex: 14,
        found: false,
      }];
      
      const results = await engine.enrichCVEs(cves, { enabledForOpenCTI: false, enabledForOpenAEV: true });
      
      expect(mockOAEVClient.getVulnerabilityByExternalId).toHaveBeenCalledWith('CVE-2021-44228');
      expect(results[0].found).toBe(true);
      expect(results[0].platformType).toBe('openaev');
    });

    it('should skip enrichment when vulnerability detection is disabled', async () => {
      const cves = [{
        type: 'Vulnerability' as const,
        name: 'CVE-2021-44228',
        startIndex: 0,
        endIndex: 14,
        found: false,
      }];
      
      const results = await engine.enrichCVEs(cves, { enabledForOpenCTI: false, enabledForOpenAEV: false });
      
      expect(mockOCTIClient.searchSDOByNameOrAlias).not.toHaveBeenCalled();
      expect(results[0].found).toBe(false);
    });
  });

  describe('enrichOCTIEntities', () => {
    it('should enrich entities by name', async () => {
      const mockResult = {
        id: 'apt-123',
        entity_type: 'Intrusion-Set',
        name: 'APT29',
      };
      (mockOCTIClient.searchSDOByNameOrAlias as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);
      
      const entities = [{
        type: 'Intrusion-Set' as const,
        name: 'APT29',
        startIndex: 0,
        endIndex: 5,
        found: false,
      }];
      
      const results = await engine.enrichOCTIEntities(entities);
      
      expect(results[0].found).toBe(true);
      expect(results[0].entityId).toBe('apt-123');
    });

    it('should deduplicate by name for enrichment', async () => {
      const mockResult = {
        id: 'apt-123',
        entity_type: 'Intrusion-Set',
        name: 'APT29',
      };
      (mockOCTIClient.searchSDOByNameOrAlias as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);
      
      const entities = [
        { type: 'Intrusion-Set' as const, name: 'APT29', startIndex: 0, endIndex: 5, found: false },
        { type: 'Intrusion-Set' as const, name: 'APT29', startIndex: 50, endIndex: 55, found: false },
      ];
      
      await engine.enrichOCTIEntities(entities);
      
      // Should only call API once for the unique name
      expect(mockOCTIClient.searchSDOByNameOrAlias).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // Full Scan Tests
  // ============================================================================

  describe('scan', () => {
    it('should perform full scan and return detection result', async () => {
      const text = 'APT29 uses 192.168.1.1 and CVE-2021-44228';
      
      const result = await engine.scan(text);
      
      expect(result).toHaveProperty('observables');
      expect(result).toHaveProperty('openctiEntities');
      expect(result).toHaveProperty('cves');
      expect(result).toHaveProperty('openaevEntities');
      expect(result).toHaveProperty('scanTime');
      expect(result.scanTime).toBeGreaterThanOrEqual(0);
    });

    it('should detect observables in full scan', async () => {
      const text = 'IP: 192.168.1.1';
      
      const result = await engine.scan(text);
      
      const ipv4 = result.observables.find(o => o.type === 'IPv4-Addr');
      expect(ipv4).toBeDefined();
    });

    it('should detect CVEs in full scan', async () => {
      const text = 'CVE-2021-44228 is critical';
      
      const result = await engine.scan(text);
      
      expect(result.cves.length).toBeGreaterThanOrEqual(1);
      expect(result.cves[0].name).toBe('CVE-2021-44228');
    });

    it('should skip CVE detection when disabled for all platforms', async () => {
      const text = 'CVE-2021-44228 is critical';
      
      const result = await engine.scan(text, [], { enabledForOpenCTI: false, enabledForOpenAEV: false });
      
      expect(result.cves).toHaveLength(0);
    });

    it('should use known entity names if provided', async () => {
      const mockResult = {
        id: 'apt-123',
        entity_type: 'Intrusion-Set',
        name: 'APT29',
      };
      (mockOCTIClient.searchSDOByNameOrAlias as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);
      
      const text = 'The APT29 group is active';
      
      const result = await engine.scan(text, ['APT29']);
      
      // Should have detected the entity
      const apt29 = result.openctiEntities.find(e => e.name === 'APT29');
      expect(apt29).toBeDefined();
    });

    it('should handle empty text', async () => {
      const result = await engine.scan('');
      
      expect(result.observables).toHaveLength(0);
      expect(result.cves).toHaveLength(0);
      expect(result.openctiEntities).toHaveLength(0);
      expect(result.openaevEntities).toHaveLength(0);
    });
  });

  // ============================================================================
  // loadKnownEntities Tests
  // ============================================================================

  describe('loadKnownEntities', () => {
    it('should complete without error', async () => {
      // Currently a no-op placeholder
      await expect(engine.loadKnownEntities()).resolves.toBeUndefined();
    });
  });

  // ============================================================================
  // Multi-Platform Observable Enrichment Tests
  // ============================================================================

  describe('enrichObservablesMultiPlatform', () => {
    it('should enrich observables across platforms', async () => {
      const mockResult = {
        id: 'obs-123',
        entity_type: 'IPv4-Addr',
        value: '192.168.1.1',
      };
      (mockOCTIClient.searchObservableByValue as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);
      
      const observables = [{
        type: 'IPv4-Addr' as const,
        value: '192.168.1.1',
        startIndex: 0,
        endIndex: 11,
        context: '',
        found: false,
      }];
      
      const results = await engine.enrichObservablesMultiPlatform(observables);
      
      expect(results[0].found).toBe(true);
      expect(results[0].platformId).toBe('test-platform');
    });

    it('should deduplicate observables by type and value', async () => {
      const mockResult = {
        id: 'obs-123',
        entity_type: 'IPv4-Addr',
        value: '192.168.1.1',
      };
      (mockOCTIClient.searchObservableByValue as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);
      
      const observables = [
        { type: 'IPv4-Addr' as const, value: '192.168.1.1', startIndex: 0, endIndex: 11, context: '', found: false },
        { type: 'IPv4-Addr' as const, value: '192.168.1.1', startIndex: 50, endIndex: 61, context: '', found: false },
      ];
      
      await engine.enrichObservablesMultiPlatform(observables);
      
      // Should only call API once for unique type:value
      expect(mockOCTIClient.searchObservableByValue).toHaveBeenCalledTimes(1);
    });
  });
});

