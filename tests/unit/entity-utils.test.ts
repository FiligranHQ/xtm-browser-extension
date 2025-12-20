/**
 * Unit Tests for Entity Utilities
 * 
 * Tests entity helper functions used across the application.
 */

import { describe, it, expect } from 'vitest';
import {
  isObservableType,
  isOpenCTIEntityType,
  isIndicatorType,
  isVulnerabilityType,
  isOCTIContainerType,
  getEntityId,
  getEntityName,
  getEntityType,
  getEntityPlatformId,
  getEntityPlatformType,
  getOAEVEntityName,
  getOAEVEntityId,
  getOAEVEntityUrl,
  getOAEVTypeFromClass,
  getOAEVEntityColor,
  OBSERVABLE_TYPES,
  OPENCTI_ENTITY_TYPES,
  CONTAINER_TYPES,
} from '../../src/shared/utils/entity';

// ============================================================================
// Observable Type Detection Tests
// ============================================================================

describe('isObservableType', () => {
  it('should return true for standard observable types', () => {
    const observables = [
      'IPv4-Addr',
      'IPv6-Addr',
      'Domain-Name',
      'Hostname',
      'Url',
      'Email-Addr',
      'Mac-Addr',
      'StixFile',
    ];

    for (const type of observables) {
      expect(isObservableType(type), `Should match ${type}`).toBe(true);
    }
  });

  it('should return true for types containing "Addr"', () => {
    expect(isObservableType('SomeAddr')).toBe(true);
    expect(isObservableType('CustomAddrType')).toBe(true);
  });

  it('should return true for types containing "Observable"', () => {
    expect(isObservableType('SomeObservable')).toBe(true);
    expect(isObservableType('CustomObservableType')).toBe(true);
  });

  it('should return false for non-observable types', () => {
    const nonObservables = [
      'Malware',
      'Campaign',
      'Threat-Actor-Group',
      'Report',
      'Indicator',
    ];

    for (const type of nonObservables) {
      expect(isObservableType(type), `Should not match ${type}`).toBe(false);
    }
  });

  it('should handle case insensitivity', () => {
    expect(isObservableType('ipv4-addr')).toBe(true);
    expect(isObservableType('IPV4-ADDR')).toBe(true);
    expect(isObservableType('Ipv4Addr')).toBe(true);
  });
});

// ============================================================================
// OpenCTI Entity Type Detection Tests
// ============================================================================

describe('isOpenCTIEntityType', () => {
  it('should return true for standard OpenCTI entity types', () => {
    const entityTypes = [
      'Attack-Pattern',
      'Campaign',
      'Malware',
      'Threat-Actor-Group',
      'Intrusion-Set',
      'Tool',
      'Vulnerability',
    ];

    for (const type of entityTypes) {
      expect(isOpenCTIEntityType(type), `Should match ${type}`).toBe(true);
    }
  });

  it('should return false for observable types', () => {
    expect(isOpenCTIEntityType('IPv4-Addr')).toBe(false);
    expect(isOpenCTIEntityType('Domain-Name')).toBe(false);
  });

  it('should handle case insensitivity', () => {
    expect(isOpenCTIEntityType('malware')).toBe(true);
    expect(isOpenCTIEntityType('MALWARE')).toBe(true);
    expect(isOpenCTIEntityType('Malware')).toBe(true);
  });
});

// ============================================================================
// Indicator and Vulnerability Detection Tests
// ============================================================================

describe('isIndicatorType', () => {
  it('should return true for indicator type', () => {
    expect(isIndicatorType('Indicator')).toBe(true);
    expect(isIndicatorType('indicator')).toBe(true);
    expect(isIndicatorType('INDICATOR')).toBe(true);
  });

  it('should return false for non-indicator types', () => {
    expect(isIndicatorType('Malware')).toBe(false);
    expect(isIndicatorType('Observable')).toBe(false);
  });
});

describe('isVulnerabilityType', () => {
  it('should return true for vulnerability type', () => {
    expect(isVulnerabilityType('Vulnerability')).toBe(true);
    expect(isVulnerabilityType('vulnerability')).toBe(true);
    expect(isVulnerabilityType('VULNERABILITY')).toBe(true);
  });

  it('should return false for non-vulnerability types', () => {
    expect(isVulnerabilityType('Malware')).toBe(false);
    expect(isVulnerabilityType('CVE-2021-44228')).toBe(false);
  });
});

// ============================================================================
// Container Type Detection Tests
// ============================================================================

describe('isOCTIContainerType', () => {
  it('should return true for container types', () => {
    const containers = ['Report', 'Grouping', 'Case-Incident', 'Note', 'Opinion'];

    for (const type of containers) {
      expect(isOCTIContainerType(type), `Should match ${type}`).toBe(true);
    }
  });

  it('should return false for non-container types', () => {
    expect(isOCTIContainerType('Malware')).toBe(false);
    expect(isOCTIContainerType('Campaign')).toBe(false);
  });
});

// ============================================================================
// Entity Property Extraction Tests
// ============================================================================

describe('getEntityId', () => {
  it('should extract id from different property names', () => {
    expect(getEntityId({ id: 'test-id-1' })).toBe('test-id-1');
    expect(getEntityId({ standard_id: 'test-id-2' })).toBe('test-id-2');
    expect(getEntityId({ entityId: 'test-id-3' })).toBe('test-id-3');
    expect(getEntityId({ entity_id: 'test-id-4' })).toBe('test-id-4');
    expect(getEntityId({ _id: 'test-id-5' })).toBe('test-id-5');
  });

  it('should return undefined if no id property exists', () => {
    expect(getEntityId({ name: 'test' })).toBeUndefined();
    expect(getEntityId({})).toBeUndefined();
  });

  it('should prioritize id over other properties', () => {
    expect(getEntityId({ id: 'primary', standard_id: 'fallback' })).toBe('primary');
  });
});

describe('getEntityName', () => {
  it('should extract name from different property names', () => {
    expect(getEntityName({ name: 'Test Entity' })).toBe('Test Entity');
    expect(getEntityName({ value: 'test-value' })).toBe('test-value');
    expect(getEntityName({ entity_name: 'entity-name' })).toBe('entity-name');
  });

  it('should extract name from representative.main', () => {
    expect(getEntityName({ representative: { main: 'Representative Name' } })).toBe('Representative Name');
  });

  it('should return "Unknown" if no name property exists', () => {
    expect(getEntityName({ id: 'test' })).toBe('Unknown');
    expect(getEntityName({})).toBe('Unknown');
  });
});

describe('getEntityType', () => {
  it('should extract type from different property names', () => {
    expect(getEntityType({ type: 'Malware' })).toBe('Malware');
    expect(getEntityType({ entity_type: 'Campaign' })).toBe('Campaign');
    expect(getEntityType({ entityType: 'Attack-Pattern' })).toBe('Attack-Pattern');
    expect(getEntityType({ _type: 'Tool' })).toBe('Tool');
  });

  it('should return "Unknown" if no type property exists', () => {
    expect(getEntityType({ name: 'test' })).toBe('Unknown');
    expect(getEntityType({})).toBe('Unknown');
  });
});

describe('getEntityPlatformId', () => {
  it('should extract platformId', () => {
    expect(getEntityPlatformId({ platformId: 'platform-123' })).toBe('platform-123');
  });

  it('should return undefined if no platformId exists', () => {
    expect(getEntityPlatformId({ name: 'test' })).toBeUndefined();
    expect(getEntityPlatformId({})).toBeUndefined();
  });
});

describe('getEntityPlatformType', () => {
  it('should extract platformType', () => {
    expect(getEntityPlatformType({ platformType: 'openaev' })).toBe('openaev');
  });

  it('should default to "opencti" if no platformType exists', () => {
    expect(getEntityPlatformType({ name: 'test' })).toBe('opencti');
    expect(getEntityPlatformType({})).toBe('opencti');
  });
});

// ============================================================================
// OpenAEV Entity Helper Tests
// ============================================================================

describe('getOAEVEntityName', () => {
  it('should extract Asset name', () => {
    expect(getOAEVEntityName({ endpoint_name: 'Server-01' }, 'Asset')).toBe('Server-01');
    expect(getOAEVEntityName({ asset_name: 'Server-02' }, 'Asset')).toBe('Server-02');
    expect(getOAEVEntityName({ name: 'Server-03' }, 'Asset')).toBe('Server-03');
    expect(getOAEVEntityName({}, 'Asset')).toBe('Unknown Asset');
  });

  it('should extract AssetGroup name', () => {
    expect(getOAEVEntityName({ asset_group_name: 'Production Servers' }, 'AssetGroup')).toBe('Production Servers');
    expect(getOAEVEntityName({ name: 'Test Group' }, 'AssetGroup')).toBe('Test Group');
    expect(getOAEVEntityName({}, 'AssetGroup')).toBe('Unknown Asset Group');
  });

  it('should extract Player name from first and last name', () => {
    expect(getOAEVEntityName({ user_firstname: 'John', user_lastname: 'Doe' }, 'Player')).toBe('John Doe');
    expect(getOAEVEntityName({ user_firstname: 'John' }, 'Player')).toBe('John');
    expect(getOAEVEntityName({ user_lastname: 'Doe' }, 'Player')).toBe('Doe');
  });

  it('should fall back to email for Player', () => {
    expect(getOAEVEntityName({ user_email: 'john@example.com' }, 'Player')).toBe('john@example.com');
    expect(getOAEVEntityName({}, 'Player')).toBe('Unknown Player');
  });

  it('should extract Team name', () => {
    expect(getOAEVEntityName({ team_name: 'Red Team' }, 'Team')).toBe('Red Team');
    expect(getOAEVEntityName({}, 'Team')).toBe('Unknown Team');
  });

  it('should extract Scenario name', () => {
    expect(getOAEVEntityName({ scenario_name: 'Ransomware Simulation' }, 'Scenario')).toBe('Ransomware Simulation');
    expect(getOAEVEntityName({}, 'Scenario')).toBe('Unknown Scenario');
  });

  it('should extract AttackPattern name', () => {
    expect(getOAEVEntityName({ attack_pattern_name: 'Phishing' }, 'AttackPattern')).toBe('Phishing');
    expect(getOAEVEntityName({}, 'AttackPattern')).toBe('Unknown Attack Pattern');
  });

  it('should extract Finding name from value', () => {
    expect(getOAEVEntityName({ finding_value: 'CVE-2021-44228' }, 'Finding')).toBe('CVE-2021-44228');
    expect(getOAEVEntityName({}, 'Finding')).toBe('Unknown Finding');
  });

  it('should extract Vulnerability name', () => {
    expect(getOAEVEntityName({ vulnerability_external_id: 'CVE-2023-1234' }, 'Vulnerability')).toBe('CVE-2023-1234');
    expect(getOAEVEntityName({}, 'Vulnerability')).toBe('Unknown Vulnerability');
  });
});

describe('getOAEVEntityId', () => {
  it('should extract Asset ID', () => {
    expect(getOAEVEntityId({ endpoint_id: 'ep-123' }, 'Asset')).toBe('ep-123');
    expect(getOAEVEntityId({ asset_id: 'as-123' }, 'Asset')).toBe('as-123');
    expect(getOAEVEntityId({ id: 'id-123' }, 'Asset')).toBe('id-123');
  });

  it('should extract various entity type IDs', () => {
    expect(getOAEVEntityId({ asset_group_id: 'ag-123' }, 'AssetGroup')).toBe('ag-123');
    expect(getOAEVEntityId({ user_id: 'usr-123' }, 'Player')).toBe('usr-123');
    expect(getOAEVEntityId({ team_id: 'tm-123' }, 'Team')).toBe('tm-123');
    expect(getOAEVEntityId({ scenario_id: 'sc-123' }, 'Scenario')).toBe('sc-123');
    expect(getOAEVEntityId({ attack_pattern_id: 'ap-123' }, 'AttackPattern')).toBe('ap-123');
    expect(getOAEVEntityId({ finding_id: 'fn-123' }, 'Finding')).toBe('fn-123');
  });

  it('should return empty string if no ID found', () => {
    expect(getOAEVEntityId({}, 'Asset')).toBe('');
    expect(getOAEVEntityId({}, 'Team')).toBe('');
  });
});

describe('getOAEVEntityUrl', () => {
  const baseUrl = 'https://openaev.example.com';

  it('should generate correct URLs for Asset', () => {
    expect(getOAEVEntityUrl(baseUrl, 'Asset', '123')).toBe('https://openaev.example.com/admin/assets/endpoints/123');
  });

  it('should generate correct URLs for AssetGroup', () => {
    expect(getOAEVEntityUrl(baseUrl, 'AssetGroup', '456')).toBe('https://openaev.example.com/admin/assets/asset_groups/456');
  });

  it('should generate correct URLs for Team', () => {
    expect(getOAEVEntityUrl(baseUrl, 'Team', '789')).toBe('https://openaev.example.com/admin/teams/789');
  });

  it('should generate correct URLs for Player', () => {
    expect(getOAEVEntityUrl(baseUrl, 'Player', 'p123')).toBe('https://openaev.example.com/admin/teams/players/p123');
    expect(getOAEVEntityUrl(baseUrl, 'User', 'u123')).toBe('https://openaev.example.com/admin/teams/players/u123');
  });

  it('should generate correct URLs for Scenario', () => {
    expect(getOAEVEntityUrl(baseUrl, 'Scenario', 's123')).toBe('https://openaev.example.com/admin/scenarios/s123');
  });

  it('should generate correct URLs for Exercise', () => {
    expect(getOAEVEntityUrl(baseUrl, 'Exercise', 'e123')).toBe('https://openaev.example.com/admin/simulations/e123');
  });

  it('should handle trailing slash in base URL', () => {
    expect(getOAEVEntityUrl('https://openaev.example.com/', 'Team', '123'))
      .toBe('https://openaev.example.com/admin/teams/123');
  });

  it('should return base URL for unknown types', () => {
    expect(getOAEVEntityUrl(baseUrl, 'UnknownType', '123')).toBe('https://openaev.example.com');
  });
});

describe('getOAEVTypeFromClass', () => {
  it('should convert class names to types', () => {
    expect(getOAEVTypeFromClass('Endpoint')).toBe('Asset');
    expect(getOAEVTypeFromClass('AssetGroup')).toBe('AssetGroup');
    expect(getOAEVTypeFromClass('User')).toBe('User');
    expect(getOAEVTypeFromClass('Player')).toBe('Player');
    expect(getOAEVTypeFromClass('Team')).toBe('Team');
    expect(getOAEVTypeFromClass('AttackPattern')).toBe('AttackPattern');
    expect(getOAEVTypeFromClass('Finding')).toBe('Finding');
  });

  it('should handle fully qualified class names', () => {
    expect(getOAEVTypeFromClass('io.openaev.model.Endpoint')).toBe('Asset');
    expect(getOAEVTypeFromClass('com.filigran.Team')).toBe('Team');
  });

  it('should return original name for unknown classes', () => {
    expect(getOAEVTypeFromClass('CustomType')).toBe('CustomType');
  });
});

describe('getOAEVEntityColor', () => {
  it('should return correct colors for known types', () => {
    expect(getOAEVEntityColor('Asset')).toBe('#009688');
    expect(getOAEVEntityColor('Team')).toBe('#66bb6a');
    expect(getOAEVEntityColor('Player')).toBe('#7e57c2');
    expect(getOAEVEntityColor('AttackPattern')).toBe('#d4e157');
    expect(getOAEVEntityColor('Finding')).toBe('#ec407a');
    expect(getOAEVEntityColor('Vulnerability')).toBe('#795548');
  });

  it('should return default color for unknown types', () => {
    expect(getOAEVEntityColor('UnknownType')).toBe('#e91e63');
  });
});

// ============================================================================
// Constants Export Tests
// ============================================================================

describe('Constants', () => {
  it('should export OBSERVABLE_TYPES as a non-empty array', () => {
    expect(Array.isArray(OBSERVABLE_TYPES)).toBe(true);
    expect(OBSERVABLE_TYPES.length).toBeGreaterThan(0);
  });

  it('should export OPENCTI_ENTITY_TYPES as a non-empty array', () => {
    expect(Array.isArray(OPENCTI_ENTITY_TYPES)).toBe(true);
    expect(OPENCTI_ENTITY_TYPES.length).toBeGreaterThan(0);
  });

  it('should export CONTAINER_TYPES as a non-empty array', () => {
    expect(Array.isArray(CONTAINER_TYPES)).toBe(true);
    expect(CONTAINER_TYPES.length).toBeGreaterThan(0);
  });
});

