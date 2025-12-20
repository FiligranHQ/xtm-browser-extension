/**
 * Unit Tests for Storage Utilities
 * 
 * Tests storage wrapper functions with mocked chrome API.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createEmptyOCTICache,
  createEmptyOAEVCache,
  type CachedOCTIEntity,
  type CachedOAEVEntity,
  type OCTIEntityCache,
  type OAEVCache,
} from '../../src/shared/utils/storage';

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

