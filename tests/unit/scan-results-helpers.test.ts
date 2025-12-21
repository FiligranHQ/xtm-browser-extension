/**
 * Unit Tests for Scan Results Helpers
 * 
 * Tests utility functions for scan results view.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isSelectableForOpenCTI,
  isFoundInOpenCTI,
  getUniqueTypesFromMatches,
  formatTypeName,
  buildEntitiesForAI,
  filterEntities,
} from '../../src/panel/utils/scan-results-helpers';
import type { ScanResultEntity } from '../../src/shared/types/scan';

// Mock the platform registry
vi.mock('../../src/shared/platform/registry', () => ({
  getCanonicalTypeName: vi.fn((type: string) => type.replace('oaev-', '')),
  getUniqueCanonicalTypes: vi.fn((types: string[]) => [...new Set(types)]),
}));

// ============================================================================
// Helper to create mock entities
// ============================================================================

function createMockEntity(overrides: Partial<ScanResultEntity> = {}): ScanResultEntity {
  return {
    id: `entity-${Math.random().toString(36).substr(2, 9)}`,
    type: 'IPv4-Addr',
    name: 'Test Entity',
    value: '192.168.1.1',
    found: false,
    startIndex: 0,
    endIndex: 11,
    context: 'Test context',
    ...overrides,
  };
}

// ============================================================================
// isSelectableForOpenCTI Tests
// ============================================================================

describe('isSelectableForOpenCTI', () => {
  it('should return true for standard OpenCTI types', () => {
    expect(isSelectableForOpenCTI(createMockEntity({ type: 'IPv4-Addr' }))).toBe(true);
    expect(isSelectableForOpenCTI(createMockEntity({ type: 'Domain-Name' }))).toBe(true);
    expect(isSelectableForOpenCTI(createMockEntity({ type: 'Malware' }))).toBe(true);
    expect(isSelectableForOpenCTI(createMockEntity({ type: 'Intrusion-Set' }))).toBe(true);
    expect(isSelectableForOpenCTI(createMockEntity({ type: 'Vulnerability' }))).toBe(true);
  });

  it('should return false for OpenAEV types', () => {
    expect(isSelectableForOpenCTI(createMockEntity({ type: 'oaev-Asset' }))).toBe(false);
    expect(isSelectableForOpenCTI(createMockEntity({ type: 'oaev-AssetGroup' }))).toBe(false);
    expect(isSelectableForOpenCTI(createMockEntity({ type: 'oaev-Team' }))).toBe(false);
    expect(isSelectableForOpenCTI(createMockEntity({ type: 'oaev-Scenario' }))).toBe(false);
  });
});

// ============================================================================
// isFoundInOpenCTI Tests
// ============================================================================

describe('isFoundInOpenCTI', () => {
  it('should return false when entity is not found', () => {
    expect(isFoundInOpenCTI(createMockEntity({ found: false }))).toBe(false);
  });

  it('should return true when found with platformType opencti', () => {
    expect(isFoundInOpenCTI(createMockEntity({ 
      found: true, 
      platformType: 'opencti' 
    }))).toBe(true);
  });

  it('should return true when found with no platformType (default)', () => {
    expect(isFoundInOpenCTI(createMockEntity({ 
      found: true, 
      platformType: undefined 
    }))).toBe(true);
  });

  it('should return true when platformMatches includes opencti', () => {
    expect(isFoundInOpenCTI(createMockEntity({
      found: true,
      platformMatches: [
        { platformId: 'octi-1', platformType: 'opencti', type: 'IPv4-Addr', entityId: '123' },
      ],
    }))).toBe(true);
  });

  it('should return false when platformMatches only has openaev', () => {
    expect(isFoundInOpenCTI(createMockEntity({
      found: true,
      platformMatches: [
        { platformId: 'oaev-1', platformType: 'openaev', type: 'Asset', entityId: '123' },
      ],
    }))).toBe(false);
  });

  it('should return true when platformMatches has both opencti and openaev', () => {
    expect(isFoundInOpenCTI(createMockEntity({
      found: true,
      platformMatches: [
        { platformId: 'octi-1', platformType: 'opencti', type: 'IPv4-Addr', entityId: '123' },
        { platformId: 'oaev-1', platformType: 'openaev', type: 'Asset', entityId: '456' },
      ],
    }))).toBe(true);
  });
});

// ============================================================================
// getUniqueTypesFromMatches Tests
// ============================================================================

describe('getUniqueTypesFromMatches', () => {
  it('should return entity type when no platformMatches', () => {
    const entity = createMockEntity({ type: 'IPv4-Addr', platformMatches: undefined });
    const result = getUniqueTypesFromMatches(entity);
    
    expect(result.types).toEqual(['IPv4-Addr']);
    expect(result.hasMultipleTypes).toBe(false);
  });

  it('should return entity type when platformMatches is empty', () => {
    const entity = createMockEntity({ type: 'IPv4-Addr', platformMatches: [] });
    const result = getUniqueTypesFromMatches(entity);
    
    expect(result.types).toEqual(['IPv4-Addr']);
    expect(result.hasMultipleTypes).toBe(false);
  });

  it('should return unique types from platformMatches', () => {
    const entity = createMockEntity({
      type: 'IPv4-Addr',
      platformMatches: [
        { platformId: '1', platformType: 'opencti', type: 'IPv4-Addr', entityId: '1' },
        { platformId: '2', platformType: 'opencti', type: 'IPv4-Addr', entityId: '2' },
      ],
    });
    const result = getUniqueTypesFromMatches(entity);
    
    expect(result.types).toEqual(['IPv4-Addr']);
    expect(result.hasMultipleTypes).toBe(false);
  });

  it('should indicate multiple types when different types exist', () => {
    const entity = createMockEntity({
      type: 'IPv4-Addr',
      platformMatches: [
        { platformId: '1', platformType: 'opencti', type: 'IPv4-Addr', entityId: '1' },
        { platformId: '2', platformType: 'opencti', type: 'Indicator', entityId: '2' },
      ],
    });
    const result = getUniqueTypesFromMatches(entity);
    
    expect(result.types.length).toBe(2);
    expect(result.hasMultipleTypes).toBe(true);
  });
});

// ============================================================================
// formatTypeName Tests
// ============================================================================

describe('formatTypeName', () => {
  it('should format standard types', () => {
    expect(formatTypeName('IPv4-Addr')).toBe('IPv4-Addr');
    expect(formatTypeName('Domain-Name')).toBe('Domain-Name');
    expect(formatTypeName('Malware')).toBe('Malware');
  });

  it('should format OpenAEV types by removing prefix', () => {
    expect(formatTypeName('oaev-Asset')).toBe('Asset');
    expect(formatTypeName('oaev-Team')).toBe('Team');
  });
});

// ============================================================================
// buildEntitiesForAI Tests
// ============================================================================

describe('buildEntitiesForAI', () => {
  it('should filter out OpenAEV entities', () => {
    const entities = [
      createMockEntity({ type: 'IPv4-Addr', value: '1.1.1.1' }),
      createMockEntity({ type: 'oaev-Asset', name: 'Server1' }),
      createMockEntity({ type: 'Malware', name: 'TrojanX' }),
    ];
    
    const result = buildEntitiesForAI(entities);
    
    expect(result).toHaveLength(2);
    expect(result.map(e => e.type)).not.toContain('oaev-Asset');
  });

  it('should extract basic entity properties', () => {
    const entities = [
      createMockEntity({ type: 'IPv4-Addr', value: '192.168.1.1', name: 'IP Address' }),
    ];
    
    const result = buildEntitiesForAI(entities);
    
    expect(result[0]).toEqual({
      type: 'IPv4-Addr',
      value: '192.168.1.1',
      name: 'IP Address',
      aliases: undefined,
      externalId: undefined,
    });
  });

  it('should use value as name when name is missing', () => {
    const entities = [
      createMockEntity({ type: 'IPv4-Addr', value: '192.168.1.1', name: undefined }),
    ];
    
    const result = buildEntitiesForAI(entities);
    
    expect(result[0].name).toBe('192.168.1.1');
    expect(result[0].value).toBe('192.168.1.1');
  });

  it('should use name as value when value is missing', () => {
    const entities = [
      createMockEntity({ type: 'Malware', value: undefined, name: 'TrojanX' }),
    ];
    
    const result = buildEntitiesForAI(entities);
    
    expect(result[0].value).toBe('TrojanX');
    expect(result[0].name).toBe('TrojanX');
  });

  it('should extract aliases from entityData', () => {
    const entities = [
      createMockEntity({
        type: 'Intrusion-Set',
        name: 'APT29',
        entityData: { aliases: ['Cozy Bear', 'The Dukes'] },
      }),
    ];
    
    const result = buildEntitiesForAI(entities);
    
    expect(result[0].aliases).toEqual(['Cozy Bear', 'The Dukes']);
  });

  it('should extract x_opencti_aliases from entityData', () => {
    const entities = [
      createMockEntity({
        type: 'Malware',
        name: 'Emotet',
        entityData: { x_opencti_aliases: ['Geodo', 'Mealybug'] },
      }),
    ];
    
    const result = buildEntitiesForAI(entities);
    
    expect(result[0].aliases).toEqual(['Geodo', 'Mealybug']);
  });

  it('should extract x_mitre_id as externalId', () => {
    const entities = [
      createMockEntity({
        type: 'Attack-Pattern',
        name: 'Spearphishing',
        entityData: { x_mitre_id: 'T1566' },
      }),
    ];
    
    const result = buildEntitiesForAI(entities);
    
    expect(result[0].externalId).toBe('T1566');
  });

  it('should extract external_id as externalId', () => {
    const entities = [
      createMockEntity({
        type: 'Vulnerability',
        name: 'CVE-2021-44228',
        entityData: { external_id: 'CVE-2021-44228' },
      }),
    ];
    
    const result = buildEntitiesForAI(entities);
    
    expect(result[0].externalId).toBe('CVE-2021-44228');
  });

  it('should extract externalId from externalReferences', () => {
    const entities = [
      createMockEntity({
        type: 'Vulnerability',
        name: 'Log4Shell',
        entityData: { 
          externalReferences: [{ external_id: 'CVE-2021-44228' }] 
        },
      }),
    ];
    
    const result = buildEntitiesForAI(entities);
    
    expect(result[0].externalId).toBe('CVE-2021-44228');
  });

  it('should handle empty entities array', () => {
    const result = buildEntitiesForAI([]);
    expect(result).toEqual([]);
  });
});

// ============================================================================
// filterEntities Tests
// ============================================================================

describe('filterEntities', () => {
  const testEntities: ScanResultEntity[] = [
    createMockEntity({ type: 'IPv4-Addr', value: '192.168.1.1', found: true, discoveredByAI: false }),
    createMockEntity({ type: 'IPv4-Addr', value: '10.0.0.1', found: false, discoveredByAI: false }),
    createMockEntity({ type: 'Domain-Name', value: 'example.com', found: true, discoveredByAI: false }),
    createMockEntity({ type: 'Malware', name: 'TrojanX', value: 'trojanx.exe', found: false, discoveredByAI: true }),
    createMockEntity({ type: 'Intrusion-Set', name: 'APT29', value: 'apt29-activity', found: false, discoveredByAI: true }),
  ];

  describe('Found filter', () => {
    it('should filter found entities (excluding AI)', () => {
      const result = filterEntities(testEntities, 'found', 'all', '');
      
      expect(result).toHaveLength(2);
      expect(result.every(e => e.found && !e.discoveredByAI)).toBe(true);
    });

    it('should filter not-found entities (excluding AI)', () => {
      const result = filterEntities(testEntities, 'not-found', 'all', '');
      
      expect(result).toHaveLength(1);
      expect(result[0].value).toBe('10.0.0.1');
    });

    it('should filter AI-discovered entities', () => {
      const result = filterEntities(testEntities, 'ai-discovered', 'all', '');
      
      expect(result).toHaveLength(2);
      expect(result.every(e => e.discoveredByAI)).toBe(true);
    });

    it('should return all entities when filter is all', () => {
      const result = filterEntities(testEntities, 'all', 'all', '');
      
      expect(result).toHaveLength(5);
    });
  });

  describe('Type filter', () => {
    it('should filter by specific type', () => {
      const result = filterEntities(testEntities, 'all', 'IPv4-Addr', '');
      
      expect(result).toHaveLength(2);
      expect(result.every(e => e.type === 'IPv4-Addr')).toBe(true);
    });

    it('should return empty when type not found', () => {
      const result = filterEntities(testEntities, 'all', 'NonExistentType', '');
      
      expect(result).toHaveLength(0);
    });

    it('should return all when type filter is all', () => {
      const result = filterEntities(testEntities, 'all', 'all', '');
      
      expect(result).toHaveLength(5);
    });
  });

  describe('Search filter', () => {
    it('should filter by name', () => {
      const result = filterEntities(testEntities, 'all', 'all', 'APT29');
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('APT29');
    });

    it('should filter by value', () => {
      const result = filterEntities(testEntities, 'all', 'all', '192.168.1.1');
      
      expect(result).toHaveLength(1);
      expect(result[0].value).toBe('192.168.1.1');
    });

    it('should filter by type (with hyphens replaced)', () => {
      const result = filterEntities(testEntities, 'all', 'all', 'domain name');
      
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('Domain-Name');
    });

    it('should be case insensitive', () => {
      const result = filterEntities(testEntities, 'all', 'all', 'apt29');
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('APT29');
    });

    it('should handle whitespace-only search', () => {
      const result = filterEntities(testEntities, 'all', 'all', '   ');
      
      expect(result).toHaveLength(5);
    });

    it('should trim search query', () => {
      const result = filterEntities(testEntities, 'all', 'all', '  APT29  ');
      
      expect(result).toHaveLength(1);
    });
  });

  describe('Combined filters', () => {
    it('should combine found and type filters', () => {
      const result = filterEntities(testEntities, 'found', 'IPv4-Addr', '');
      
      expect(result).toHaveLength(1);
      expect(result[0].value).toBe('192.168.1.1');
    });

    it('should combine found, type, and search filters', () => {
      const result = filterEntities(testEntities, 'found', 'Domain-Name', 'example');
      
      expect(result).toHaveLength(1);
      expect(result[0].value).toBe('example.com');
    });

    it('should return empty when no match for combined filters', () => {
      const result = filterEntities(testEntities, 'not-found', 'Domain-Name', 'nonexistent');
      
      expect(result).toHaveLength(0);
    });

    it('should combine AI-discovered with type filter', () => {
      const result = filterEntities(testEntities, 'ai-discovered', 'Malware', '');
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('TrojanX');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty entities array', () => {
      const result = filterEntities([], 'all', 'all', '');
      expect(result).toEqual([]);
    });

    it('should handle entities with missing name/value', () => {
      const entities = [
        createMockEntity({ type: 'Test', name: undefined, value: undefined, found: true }),
      ];
      
      const result = filterEntities(entities, 'all', 'all', 'test');
      expect(result).toHaveLength(1); // Should match on type
    });
  });
});

