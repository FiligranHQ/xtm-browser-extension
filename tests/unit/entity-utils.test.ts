/**
 * Unit Tests for Entity Utilities
 * 
 * Tests entity helper functions for OpenCTI and OpenAEV platforms.
 */

import { describe, it, expect } from 'vitest';
import {
  OBSERVABLE_TYPES,
  OPENCTI_ENTITY_TYPES,
  CONTAINER_TYPES,
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
} from '../../src/shared/utils/entity';

// ============================================================================
// Constants Tests
// ============================================================================

describe('OBSERVABLE_TYPES', () => {
  it('should contain common observable types', () => {
    expect(OBSERVABLE_TYPES).toContain('IPv4-Addr');
    expect(OBSERVABLE_TYPES).toContain('IPv6-Addr');
    expect(OBSERVABLE_TYPES).toContain('Domain-Name');
    expect(OBSERVABLE_TYPES).toContain('Url');
    expect(OBSERVABLE_TYPES).toContain('Email-Addr');
    expect(OBSERVABLE_TYPES).toContain('Mac-Addr');
    expect(OBSERVABLE_TYPES).toContain('StixFile');
  });

  it('should be a readonly array', () => {
    expect(Array.isArray(OBSERVABLE_TYPES)).toBe(true);
  });
});

describe('OPENCTI_ENTITY_TYPES', () => {
  it('should contain common entity types', () => {
    expect(OPENCTI_ENTITY_TYPES).toContain('Attack-Pattern');
    expect(OPENCTI_ENTITY_TYPES).toContain('Campaign');
    expect(OPENCTI_ENTITY_TYPES).toContain('Malware');
    expect(OPENCTI_ENTITY_TYPES).toContain('Threat-Actor-Group');
    expect(OPENCTI_ENTITY_TYPES).toContain('Intrusion-Set');
    expect(OPENCTI_ENTITY_TYPES).toContain('Vulnerability');
  });

  it('should contain location types', () => {
    expect(OPENCTI_ENTITY_TYPES).toContain('Country');
    expect(OPENCTI_ENTITY_TYPES).toContain('City');
    expect(OPENCTI_ENTITY_TYPES).toContain('Region');
  });

  it('should contain identity types', () => {
    expect(OPENCTI_ENTITY_TYPES).toContain('Organization');
    expect(OPENCTI_ENTITY_TYPES).toContain('Individual');
    expect(OPENCTI_ENTITY_TYPES).toContain('Sector');
  });
});

describe('CONTAINER_TYPES', () => {
  it('should contain container types', () => {
    expect(CONTAINER_TYPES).toContain('Report');
    expect(CONTAINER_TYPES).toContain('Grouping');
    expect(CONTAINER_TYPES).toContain('Case-Incident');
    expect(CONTAINER_TYPES).toContain('Case-Rfi');
    expect(CONTAINER_TYPES).toContain('Case-Rft');
    expect(CONTAINER_TYPES).toContain('Note');
  });
});

// ============================================================================
// isObservableType Tests
// ============================================================================

describe('isObservableType', () => {
  it('should return true for standard observable types', () => {
    expect(isObservableType('IPv4-Addr')).toBe(true);
    expect(isObservableType('IPv6-Addr')).toBe(true);
    expect(isObservableType('Domain-Name')).toBe(true);
    expect(isObservableType('Url')).toBe(true);
    expect(isObservableType('Email-Addr')).toBe(true);
    expect(isObservableType('Mac-Addr')).toBe(true);
    expect(isObservableType('StixFile')).toBe(true);
  });

  it('should return true for types with "Addr" suffix', () => {
    expect(isObservableType('SomeAddr')).toBe(true);
    expect(isObservableType('CustomAddr')).toBe(true);
  });

  it('should return true for types with "Observable" in name', () => {
    expect(isObservableType('CustomObservable')).toBe(true);
    expect(isObservableType('NetworkObservable')).toBe(true);
  });

  it('should be case insensitive', () => {
    expect(isObservableType('ipv4-addr')).toBe(true);
    expect(isObservableType('IPV4-ADDR')).toBe(true);
    expect(isObservableType('IPv4Addr')).toBe(true);
  });

  it('should return false for non-observable types', () => {
    expect(isObservableType('Malware')).toBe(false);
    expect(isObservableType('Threat-Actor')).toBe(false);
    expect(isObservableType('Campaign')).toBe(false);
  });
});

// ============================================================================
// isOpenCTIEntityType Tests
// ============================================================================

describe('isOpenCTIEntityType', () => {
  it('should return true for standard entity types', () => {
    expect(isOpenCTIEntityType('Attack-Pattern')).toBe(true);
    expect(isOpenCTIEntityType('Campaign')).toBe(true);
    expect(isOpenCTIEntityType('Malware')).toBe(true);
    expect(isOpenCTIEntityType('Threat-Actor-Group')).toBe(true);
    expect(isOpenCTIEntityType('Intrusion-Set')).toBe(true);
    expect(isOpenCTIEntityType('Vulnerability')).toBe(true);
  });

  it('should be case insensitive', () => {
    expect(isOpenCTIEntityType('attack-pattern')).toBe(true);
    expect(isOpenCTIEntityType('ATTACK-PATTERN')).toBe(true);
    expect(isOpenCTIEntityType('malware')).toBe(true);
  });

  it('should return false for observable types', () => {
    expect(isOpenCTIEntityType('IPv4-Addr')).toBe(false);
    expect(isOpenCTIEntityType('Domain-Name')).toBe(false);
  });

  it('should return false for unknown types', () => {
    expect(isOpenCTIEntityType('Unknown-Type')).toBe(false);
    expect(isOpenCTIEntityType('Custom')).toBe(false);
  });
});

// ============================================================================
// isIndicatorType Tests
// ============================================================================

describe('isIndicatorType', () => {
  it('should return true for indicator type', () => {
    expect(isIndicatorType('indicator')).toBe(true);
    expect(isIndicatorType('Indicator')).toBe(true);
    expect(isIndicatorType('INDICATOR')).toBe(true);
  });

  it('should return false for non-indicator types', () => {
    expect(isIndicatorType('Malware')).toBe(false);
    expect(isIndicatorType('IPv4-Addr')).toBe(false);
    expect(isIndicatorType('indicators')).toBe(false);
  });
});

// ============================================================================
// isVulnerabilityType Tests
// ============================================================================

describe('isVulnerabilityType', () => {
  it('should return true for vulnerability type', () => {
    expect(isVulnerabilityType('vulnerability')).toBe(true);
    expect(isVulnerabilityType('Vulnerability')).toBe(true);
    expect(isVulnerabilityType('VULNERABILITY')).toBe(true);
  });

  it('should return false for non-vulnerability types', () => {
    expect(isVulnerabilityType('Malware')).toBe(false);
    expect(isVulnerabilityType('CVE')).toBe(false);
    expect(isVulnerabilityType('vulnerabilities')).toBe(false);
  });
});

// ============================================================================
// isOCTIContainerType Tests
// ============================================================================

describe('isOCTIContainerType', () => {
  it('should return true for container types', () => {
    expect(isOCTIContainerType('Report')).toBe(true);
    expect(isOCTIContainerType('Grouping')).toBe(true);
    expect(isOCTIContainerType('Case-Incident')).toBe(true);
    expect(isOCTIContainerType('Case-Rfi')).toBe(true);
    expect(isOCTIContainerType('Note')).toBe(true);
  });

  it('should be case insensitive', () => {
    expect(isOCTIContainerType('report')).toBe(true);
    expect(isOCTIContainerType('REPORT')).toBe(true);
    expect(isOCTIContainerType('grouping')).toBe(true);
  });

  it('should return false for non-container types', () => {
    expect(isOCTIContainerType('Malware')).toBe(false);
    expect(isOCTIContainerType('Campaign')).toBe(false);
    expect(isOCTIContainerType('IPv4-Addr')).toBe(false);
  });
});

// ============================================================================
// getEntityId Tests
// ============================================================================

describe('getEntityId', () => {
  it('should extract id field', () => {
    expect(getEntityId({ id: 'entity-123' })).toBe('entity-123');
  });

  it('should extract standard_id field', () => {
    expect(getEntityId({ standard_id: 'standard-456' })).toBe('standard-456');
  });

  it('should extract entityId field', () => {
    expect(getEntityId({ entityId: 'entity-789' })).toBe('entity-789');
  });

  it('should extract entity_id field', () => {
    expect(getEntityId({ entity_id: 'entity_101' })).toBe('entity_101');
  });

  it('should extract _id field', () => {
    expect(getEntityId({ _id: '_id_202' })).toBe('_id_202');
  });

  it('should prefer id over other fields', () => {
    expect(getEntityId({ id: 'id1', standard_id: 'std1', _id: '_1' })).toBe('id1');
  });

  it('should return undefined for empty object', () => {
    expect(getEntityId({})).toBeUndefined();
  });
});

// ============================================================================
// getEntityName Tests
// ============================================================================

describe('getEntityName', () => {
  it('should extract name field', () => {
    expect(getEntityName({ name: 'Test Entity' })).toBe('Test Entity');
  });

  it('should extract value field for observables', () => {
    expect(getEntityName({ value: '192.168.1.1' })).toBe('192.168.1.1');
  });

  it('should extract representative.main field', () => {
    expect(getEntityName({ representative: { main: 'Main Rep' } })).toBe('Main Rep');
  });

  it('should extract entity_name field', () => {
    expect(getEntityName({ entity_name: 'Entity Name' })).toBe('Entity Name');
  });

  it('should prefer name over value', () => {
    expect(getEntityName({ name: 'Name', value: 'Value' })).toBe('Name');
  });

  it('should return Unknown for empty object', () => {
    expect(getEntityName({})).toBe('Unknown');
  });
});

// ============================================================================
// getEntityType Tests
// ============================================================================

describe('getEntityType', () => {
  it('should extract type field', () => {
    expect(getEntityType({ type: 'Malware' })).toBe('Malware');
  });

  it('should extract entity_type field', () => {
    expect(getEntityType({ entity_type: 'Campaign' })).toBe('Campaign');
  });

  it('should extract entityType field', () => {
    expect(getEntityType({ entityType: 'Indicator' })).toBe('Indicator');
  });

  it('should extract _type field', () => {
    expect(getEntityType({ _type: 'Report' })).toBe('Report');
  });

  it('should prefer type over other fields', () => {
    expect(getEntityType({ type: 'Type1', entity_type: 'Type2' })).toBe('Type1');
  });

  it('should return Unknown for empty object', () => {
    expect(getEntityType({})).toBe('Unknown');
  });
});

// ============================================================================
// getEntityPlatformId Tests
// ============================================================================

describe('getEntityPlatformId', () => {
  it('should extract platformId field', () => {
    expect(getEntityPlatformId({ platformId: 'platform-123' })).toBe('platform-123');
  });

  it('should return undefined when not present', () => {
    expect(getEntityPlatformId({})).toBeUndefined();
    expect(getEntityPlatformId({ platform_id: 'wrong-field' })).toBeUndefined();
  });
});

// ============================================================================
// getEntityPlatformType Tests
// ============================================================================

describe('getEntityPlatformType', () => {
  it('should extract platformType field', () => {
    expect(getEntityPlatformType({ platformType: 'openaev' })).toBe('openaev');
    expect(getEntityPlatformType({ platformType: 'opencti' })).toBe('opencti');
  });

  it('should default to opencti when not present', () => {
    expect(getEntityPlatformType({})).toBe('opencti');
  });
});

// ============================================================================
// getOAEVEntityName Tests
// ============================================================================

describe('getOAEVEntityName', () => {
  describe('Asset type', () => {
    it('should extract endpoint_name', () => {
      expect(getOAEVEntityName({ endpoint_name: 'Server-01' }, 'Asset')).toBe('Server-01');
    });

    it('should fall back to asset_name', () => {
      expect(getOAEVEntityName({ asset_name: 'Asset-01' }, 'Asset')).toBe('Asset-01');
    });

    it('should fall back to name', () => {
      expect(getOAEVEntityName({ name: 'Generic' }, 'Asset')).toBe('Generic');
    });

    it('should return default for empty', () => {
      expect(getOAEVEntityName({}, 'Asset')).toBe('Unknown Asset');
    });
  });

  describe('AssetGroup type', () => {
    it('should extract asset_group_name', () => {
      expect(getOAEVEntityName({ asset_group_name: 'Group-01' }, 'AssetGroup')).toBe('Group-01');
    });

    it('should return default for empty', () => {
      expect(getOAEVEntityName({}, 'AssetGroup')).toBe('Unknown Asset Group');
    });
  });

  describe('Player/User type', () => {
    it('should combine first and last name', () => {
      expect(getOAEVEntityName({ user_firstname: 'John', user_lastname: 'Doe' }, 'Player')).toBe('John Doe');
      expect(getOAEVEntityName({ user_firstname: 'John', user_lastname: 'Doe' }, 'User')).toBe('John Doe');
    });

    it('should use first name only if last name missing', () => {
      expect(getOAEVEntityName({ user_firstname: 'John' }, 'Player')).toBe('John');
    });

    it('should use last name only if first name missing', () => {
      expect(getOAEVEntityName({ user_lastname: 'Doe' }, 'Player')).toBe('Doe');
    });

    it('should fall back to email', () => {
      expect(getOAEVEntityName({ user_email: 'john@example.com' }, 'Player')).toBe('john@example.com');
    });

    it('should return default for empty', () => {
      expect(getOAEVEntityName({}, 'Player')).toBe('Unknown Player');
    });
  });

  describe('Team type', () => {
    it('should extract team_name', () => {
      expect(getOAEVEntityName({ team_name: 'Red Team' }, 'Team')).toBe('Red Team');
    });

    it('should return default for empty', () => {
      expect(getOAEVEntityName({}, 'Team')).toBe('Unknown Team');
    });
  });

  describe('Organization type', () => {
    it('should extract organization_name', () => {
      expect(getOAEVEntityName({ organization_name: 'Acme Corp' }, 'Organization')).toBe('Acme Corp');
    });

    it('should return default for empty', () => {
      expect(getOAEVEntityName({}, 'Organization')).toBe('Unknown Organization');
    });
  });

  describe('Scenario type', () => {
    it('should extract scenario_name', () => {
      expect(getOAEVEntityName({ scenario_name: 'Test Scenario' }, 'Scenario')).toBe('Test Scenario');
    });

    it('should return default for empty', () => {
      expect(getOAEVEntityName({}, 'Scenario')).toBe('Unknown Scenario');
    });
  });

  describe('Exercise type', () => {
    it('should extract exercise_name', () => {
      expect(getOAEVEntityName({ exercise_name: 'Simulation 1' }, 'Exercise')).toBe('Simulation 1');
    });

    it('should return default for empty', () => {
      expect(getOAEVEntityName({}, 'Exercise')).toBe('Unknown Simulation');
    });
  });

  describe('AttackPattern type', () => {
    it('should extract attack_pattern_name', () => {
      expect(getOAEVEntityName({ attack_pattern_name: 'Phishing' }, 'AttackPattern')).toBe('Phishing');
    });

    it('should return default for empty', () => {
      expect(getOAEVEntityName({}, 'AttackPattern')).toBe('Unknown Attack Pattern');
    });
  });

  describe('Finding type', () => {
    it('should extract finding_value', () => {
      expect(getOAEVEntityName({ finding_value: 'CVE-2021-44228' }, 'Finding')).toBe('CVE-2021-44228');
    });

    it('should return default for empty', () => {
      expect(getOAEVEntityName({}, 'Finding')).toBe('Unknown Finding');
    });
  });

  describe('Vulnerability type', () => {
    it('should extract vulnerability_external_id', () => {
      expect(getOAEVEntityName({ vulnerability_external_id: 'CVE-2021-44228' }, 'Vulnerability')).toBe('CVE-2021-44228');
    });

    it('should fall back to vulnerability_cisa_vulnerability_name', () => {
      expect(getOAEVEntityName({ vulnerability_cisa_vulnerability_name: 'Log4Shell' }, 'Vulnerability')).toBe('Log4Shell');
    });

    it('should return default for empty', () => {
      expect(getOAEVEntityName({}, 'Vulnerability')).toBe('Unknown Vulnerability');
    });
  });

  describe('Unknown type', () => {
    it('should extract name field', () => {
      expect(getOAEVEntityName({ name: 'Custom' }, 'Custom')).toBe('Custom');
    });

    it('should return default for empty', () => {
      expect(getOAEVEntityName({}, 'Custom')).toBe('Unknown');
    });
  });
});

// ============================================================================
// getOAEVEntityId Tests
// ============================================================================

describe('getOAEVEntityId', () => {
  it('should extract Asset ID', () => {
    expect(getOAEVEntityId({ endpoint_id: 'ep-123' }, 'Asset')).toBe('ep-123');
    expect(getOAEVEntityId({ asset_id: 'asset-456' }, 'Asset')).toBe('asset-456');
  });

  it('should extract AssetGroup ID', () => {
    expect(getOAEVEntityId({ asset_group_id: 'ag-123' }, 'AssetGroup')).toBe('ag-123');
  });

  it('should extract Player/User ID', () => {
    expect(getOAEVEntityId({ user_id: 'user-123' }, 'Player')).toBe('user-123');
    expect(getOAEVEntityId({ user_id: 'user-456' }, 'User')).toBe('user-456');
  });

  it('should extract Team ID', () => {
    expect(getOAEVEntityId({ team_id: 'team-123' }, 'Team')).toBe('team-123');
  });

  it('should extract Organization ID', () => {
    expect(getOAEVEntityId({ organization_id: 'org-123' }, 'Organization')).toBe('org-123');
  });

  it('should extract Scenario ID', () => {
    expect(getOAEVEntityId({ scenario_id: 'scen-123' }, 'Scenario')).toBe('scen-123');
  });

  it('should extract Exercise ID', () => {
    expect(getOAEVEntityId({ exercise_id: 'ex-123' }, 'Exercise')).toBe('ex-123');
  });

  it('should extract AttackPattern ID', () => {
    expect(getOAEVEntityId({ attack_pattern_id: 'ap-123' }, 'AttackPattern')).toBe('ap-123');
  });

  it('should extract Finding ID', () => {
    expect(getOAEVEntityId({ finding_id: 'find-123' }, 'Finding')).toBe('find-123');
  });

  it('should extract Vulnerability ID', () => {
    expect(getOAEVEntityId({ vulnerability_id: 'vuln-123' }, 'Vulnerability')).toBe('vuln-123');
  });

  it('should fall back to id or _id', () => {
    expect(getOAEVEntityId({ id: 'generic-id' }, 'Unknown')).toBe('generic-id');
    expect(getOAEVEntityId({ _id: '_generic_id' }, 'Unknown')).toBe('_generic_id');
  });

  it('should return empty string for missing ID', () => {
    expect(getOAEVEntityId({}, 'Asset')).toBe('');
    expect(getOAEVEntityId({}, 'Unknown')).toBe('');
  });
});

// ============================================================================
// getOAEVEntityUrl Tests
// ============================================================================

describe('getOAEVEntityUrl', () => {
  const baseUrl = 'https://openaev.example.com';

  it('should generate Asset URL', () => {
    expect(getOAEVEntityUrl(baseUrl, 'Asset', 'asset-123')).toBe(
      'https://openaev.example.com/admin/assets/endpoints/asset-123'
    );
  });

  it('should generate AssetGroup URL', () => {
    expect(getOAEVEntityUrl(baseUrl, 'AssetGroup', 'ag-123')).toBe(
      'https://openaev.example.com/admin/assets/asset_groups/ag-123'
    );
  });

  it('should generate Player URL', () => {
    expect(getOAEVEntityUrl(baseUrl, 'Player', 'player-123')).toBe(
      'https://openaev.example.com/admin/teams/players/player-123'
    );
    expect(getOAEVEntityUrl(baseUrl, 'User', 'user-123')).toBe(
      'https://openaev.example.com/admin/teams/players/user-123'
    );
  });

  it('should generate Team URL', () => {
    expect(getOAEVEntityUrl(baseUrl, 'Team', 'team-123')).toBe(
      'https://openaev.example.com/admin/teams/team-123'
    );
  });

  it('should generate Organization URL', () => {
    expect(getOAEVEntityUrl(baseUrl, 'Organization', 'org-123')).toBe(
      'https://openaev.example.com/admin/teams/organizations/org-123'
    );
  });

  it('should generate Scenario URL', () => {
    expect(getOAEVEntityUrl(baseUrl, 'Scenario', 'scen-123')).toBe(
      'https://openaev.example.com/admin/scenarios/scen-123'
    );
  });

  it('should generate Exercise URL', () => {
    expect(getOAEVEntityUrl(baseUrl, 'Exercise', 'ex-123')).toBe(
      'https://openaev.example.com/admin/simulations/ex-123'
    );
  });

  it('should generate AttackPattern URL', () => {
    expect(getOAEVEntityUrl(baseUrl, 'AttackPattern', 'ap-123')).toBe(
      'https://openaev.example.com/admin/attack_patterns/ap-123'
    );
  });

  it('should generate Finding URL', () => {
    expect(getOAEVEntityUrl(baseUrl, 'Finding', 'find-123')).toBe(
      'https://openaev.example.com/admin/findings/find-123'
    );
  });

  it('should generate Vulnerability URL', () => {
    expect(getOAEVEntityUrl(baseUrl, 'Vulnerability', 'vuln-123')).toBe(
      'https://openaev.example.com/admin/vulnerabilities/vuln-123'
    );
  });

  it('should return base URL for unknown type', () => {
    expect(getOAEVEntityUrl(baseUrl, 'Unknown', 'id-123')).toBe(baseUrl);
  });

  it('should strip trailing slash from base URL', () => {
    expect(getOAEVEntityUrl('https://example.com/', 'Asset', 'id')).toBe(
      'https://example.com/admin/assets/endpoints/id'
    );
  });
});

// ============================================================================
// getOAEVTypeFromClass Tests
// ============================================================================

describe('getOAEVTypeFromClass', () => {
  it('should convert Endpoint to Asset', () => {
    expect(getOAEVTypeFromClass('Endpoint')).toBe('Asset');
    expect(getOAEVTypeFromClass('io.openbas.Endpoint')).toBe('Asset');
  });

  it('should keep AssetGroup as is', () => {
    expect(getOAEVTypeFromClass('AssetGroup')).toBe('AssetGroup');
  });

  it('should convert User to User', () => {
    expect(getOAEVTypeFromClass('User')).toBe('User');
  });

  it('should keep Player as is', () => {
    expect(getOAEVTypeFromClass('Player')).toBe('Player');
  });

  it('should keep Team as is', () => {
    expect(getOAEVTypeFromClass('Team')).toBe('Team');
  });

  it('should keep Organization as is', () => {
    expect(getOAEVTypeFromClass('Organization')).toBe('Organization');
  });

  it('should keep AttackPattern as is', () => {
    expect(getOAEVTypeFromClass('AttackPattern')).toBe('AttackPattern');
  });

  it('should keep Scenario as is', () => {
    expect(getOAEVTypeFromClass('Scenario')).toBe('Scenario');
  });

  it('should keep Exercise as is', () => {
    expect(getOAEVTypeFromClass('Exercise')).toBe('Exercise');
  });

  it('should keep Finding as is', () => {
    expect(getOAEVTypeFromClass('Finding')).toBe('Finding');
  });

  it('should keep Vulnerability as is', () => {
    expect(getOAEVTypeFromClass('Vulnerability')).toBe('Vulnerability');
  });

  it('should return the simple name for unknown classes', () => {
    expect(getOAEVTypeFromClass('io.openbas.CustomClass')).toBe('CustomClass');
    expect(getOAEVTypeFromClass('Unknown')).toBe('Unknown');
  });
});

// ============================================================================
// getOAEVEntityColor Tests
// ============================================================================

describe('getOAEVEntityColor', () => {
  it('should return Teal for Asset', () => {
    expect(getOAEVEntityColor('Asset')).toBe('#009688');
  });

  it('should return Light Teal for AssetGroup', () => {
    expect(getOAEVEntityColor('AssetGroup')).toBe('#26a69a');
  });

  it('should return Deep Purple for Player/User', () => {
    expect(getOAEVEntityColor('Player')).toBe('#7e57c2');
    expect(getOAEVEntityColor('User')).toBe('#7e57c2');
  });

  it('should return Light Green for Team', () => {
    expect(getOAEVEntityColor('Team')).toBe('#66bb6a');
  });

  it('should return Indigo for Organization', () => {
    expect(getOAEVEntityColor('Organization')).toBe('#3f51b5');
  });

  it('should return Purple for Scenario', () => {
    expect(getOAEVEntityColor('Scenario')).toBe('#ab47bc');
  });

  it('should return Deep Orange for Exercise', () => {
    expect(getOAEVEntityColor('Exercise')).toBe('#ff7043');
  });

  it('should return Yellow-green for AttackPattern', () => {
    expect(getOAEVEntityColor('AttackPattern')).toBe('#d4e157');
  });

  it('should return Pink for Finding', () => {
    expect(getOAEVEntityColor('Finding')).toBe('#ec407a');
  });

  it('should return Brown for Vulnerability', () => {
    expect(getOAEVEntityColor('Vulnerability')).toBe('#795548');
  });

  it('should return Pink for unknown types', () => {
    expect(getOAEVEntityColor('Unknown')).toBe('#e91e63');
  });
});

