/**
 * Unit Tests for Entity Utilities
 * 
 * Tests helper functions for working with entities across platforms.
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
// Type Constants Tests
// ============================================================================

describe('Entity Type Constants', () => {
  describe('OBSERVABLE_TYPES', () => {
    it('should contain common observable types', () => {
      expect(OBSERVABLE_TYPES).toContain('IPv4-Addr');
      expect(OBSERVABLE_TYPES).toContain('IPv6-Addr');
      expect(OBSERVABLE_TYPES).toContain('Domain-Name');
      expect(OBSERVABLE_TYPES).toContain('Url');
      expect(OBSERVABLE_TYPES).toContain('Email-Addr');
      expect(OBSERVABLE_TYPES).toContain('StixFile');
    });
  });

  describe('OPENCTI_ENTITY_TYPES', () => {
    it('should contain common STIX domain object types', () => {
      expect(OPENCTI_ENTITY_TYPES).toContain('Attack-Pattern');
      expect(OPENCTI_ENTITY_TYPES).toContain('Campaign');
      expect(OPENCTI_ENTITY_TYPES).toContain('Intrusion-Set');
      expect(OPENCTI_ENTITY_TYPES).toContain('Malware');
      expect(OPENCTI_ENTITY_TYPES).toContain('Threat-Actor-Group');
      expect(OPENCTI_ENTITY_TYPES).toContain('Vulnerability');
    });
  });

  describe('CONTAINER_TYPES', () => {
    it('should contain container types', () => {
      expect(CONTAINER_TYPES).toContain('Report');
      expect(CONTAINER_TYPES).toContain('Grouping');
      expect(CONTAINER_TYPES).toContain('Case-Incident');
      expect(CONTAINER_TYPES).toContain('Note');
    });
  });
});

// ============================================================================
// Type Checking Functions Tests
// ============================================================================

describe('Type Checking Functions', () => {
  describe('isObservableType', () => {
    it('should return true for observable types', () => {
      expect(isObservableType('IPv4-Addr')).toBe(true);
      expect(isObservableType('Domain-Name')).toBe(true);
      expect(isObservableType('Url')).toBe(true);
      expect(isObservableType('Email-Addr')).toBe(true);
    });

    it('should handle case insensitivity', () => {
      expect(isObservableType('ipv4-addr')).toBe(true);
      expect(isObservableType('IPV4-ADDR')).toBe(true);
    });

    it('should match types containing "Addr"', () => {
      expect(isObservableType('SomeNewAddr')).toBe(true);
    });

    it('should match types containing "Observable"', () => {
      expect(isObservableType('StixCyberObservable')).toBe(true);
    });

    it('should return false for non-observable types', () => {
      expect(isObservableType('Attack-Pattern')).toBe(false);
      expect(isObservableType('Malware')).toBe(false);
    });
  });

  describe('isOpenCTIEntityType', () => {
    it('should return true for OpenCTI entity types', () => {
      expect(isOpenCTIEntityType('Attack-Pattern')).toBe(true);
      expect(isOpenCTIEntityType('Malware')).toBe(true);
      expect(isOpenCTIEntityType('Intrusion-Set')).toBe(true);
    });

    it('should be case insensitive', () => {
      expect(isOpenCTIEntityType('attack-pattern')).toBe(true);
      expect(isOpenCTIEntityType('MALWARE')).toBe(true);
    });

    it('should return false for non-entity types', () => {
      expect(isOpenCTIEntityType('IPv4-Addr')).toBe(false);
      expect(isOpenCTIEntityType('Unknown')).toBe(false);
    });
  });

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
      expect(isVulnerabilityType('CVE')).toBe(false);
      expect(isVulnerabilityType('Malware')).toBe(false);
    });
  });

  describe('isOCTIContainerType', () => {
    it('should return true for container types', () => {
      expect(isOCTIContainerType('Report')).toBe(true);
      expect(isOCTIContainerType('Grouping')).toBe(true);
      expect(isOCTIContainerType('Note')).toBe(true);
    });

    it('should be case insensitive', () => {
      expect(isOCTIContainerType('report')).toBe(true);
      expect(isOCTIContainerType('GROUPING')).toBe(true);
    });

    it('should return false for non-container types', () => {
      expect(isOCTIContainerType('Malware')).toBe(false);
      expect(isOCTIContainerType('Observable')).toBe(false);
    });
  });
});

// ============================================================================
// Entity Property Extraction Tests
// ============================================================================

describe('Entity Property Extraction', () => {
  describe('getEntityId', () => {
    it('should get id from various properties', () => {
      expect(getEntityId({ id: 'test-id' })).toBe('test-id');
      expect(getEntityId({ standard_id: 'std-id' })).toBe('std-id');
      expect(getEntityId({ entityId: 'entity-id' })).toBe('entity-id');
      expect(getEntityId({ entity_id: 'ent-id' })).toBe('ent-id');
      expect(getEntityId({ _id: '_id' })).toBe('_id');
    });

    it('should return undefined for missing id', () => {
      expect(getEntityId({})).toBeUndefined();
      expect(getEntityId({ name: 'test' })).toBeUndefined();
    });

    it('should prioritize id over other properties', () => {
      expect(getEntityId({ id: 'primary', standard_id: 'secondary' })).toBe('primary');
    });
  });

  describe('getEntityName', () => {
    it('should get name from various properties', () => {
      expect(getEntityName({ name: 'Test Name' })).toBe('Test Name');
      expect(getEntityName({ value: 'Test Value' })).toBe('Test Value');
      expect(getEntityName({ representative: { main: 'Main Rep' } })).toBe('Main Rep');
      expect(getEntityName({ entity_name: 'Entity Name' })).toBe('Entity Name');
    });

    it('should return Unknown for missing name', () => {
      expect(getEntityName({})).toBe('Unknown');
      expect(getEntityName({ id: 'test' })).toBe('Unknown');
    });
  });

  describe('getEntityType', () => {
    it('should get type from various properties', () => {
      expect(getEntityType({ type: 'Malware' })).toBe('Malware');
      expect(getEntityType({ entity_type: 'Attack-Pattern' })).toBe('Attack-Pattern');
      expect(getEntityType({ entityType: 'Campaign' })).toBe('Campaign');
      expect(getEntityType({ _type: '_Type' })).toBe('_Type');
    });

    it('should return Unknown for missing type', () => {
      expect(getEntityType({})).toBe('Unknown');
    });
  });

  describe('getEntityPlatformId', () => {
    it('should extract platformId', () => {
      expect(getEntityPlatformId({ platformId: 'platform-123' })).toBe('platform-123');
    });

    it('should return undefined for missing platformId', () => {
      expect(getEntityPlatformId({})).toBeUndefined();
    });
  });

  describe('getEntityPlatformType', () => {
    it('should extract platformType', () => {
      expect(getEntityPlatformType({ platformType: 'openaev' })).toBe('openaev');
    });

    it('should default to opencti for missing platformType', () => {
      expect(getEntityPlatformType({})).toBe('opencti');
    });
  });
});

// ============================================================================
// OpenAEV Entity Functions Tests
// ============================================================================

describe('OpenAEV Entity Functions', () => {
  describe('getOAEVEntityName', () => {
    it('should get Asset name', () => {
      expect(getOAEVEntityName({ endpoint_name: 'Server1' }, 'Asset')).toBe('Server1');
      expect(getOAEVEntityName({ asset_name: 'Server2' }, 'Asset')).toBe('Server2');
      expect(getOAEVEntityName({}, 'Asset')).toBe('Unknown Asset');
    });

    it('should get AssetGroup name', () => {
      expect(getOAEVEntityName({ asset_group_name: 'Group1' }, 'AssetGroup')).toBe('Group1');
      expect(getOAEVEntityName({}, 'AssetGroup')).toBe('Unknown Asset Group');
    });

    it('should get Player/User name', () => {
      expect(getOAEVEntityName({ user_firstname: 'John', user_lastname: 'Doe' }, 'Player')).toBe('John Doe');
      expect(getOAEVEntityName({ user_firstname: 'Jane' }, 'User')).toBe('Jane');
      expect(getOAEVEntityName({ user_email: 'test@example.com' }, 'Player')).toBe('test@example.com');
      expect(getOAEVEntityName({}, 'Player')).toBe('Unknown Player');
    });

    it('should get Team name', () => {
      expect(getOAEVEntityName({ team_name: 'Red Team' }, 'Team')).toBe('Red Team');
      expect(getOAEVEntityName({}, 'Team')).toBe('Unknown Team');
    });

    it('should get Organization name', () => {
      expect(getOAEVEntityName({ organization_name: 'Acme Corp' }, 'Organization')).toBe('Acme Corp');
      expect(getOAEVEntityName({}, 'Organization')).toBe('Unknown Organization');
    });

    it('should get Scenario name', () => {
      expect(getOAEVEntityName({ scenario_name: 'Test Scenario' }, 'Scenario')).toBe('Test Scenario');
      expect(getOAEVEntityName({}, 'Scenario')).toBe('Unknown Scenario');
    });

    it('should get Exercise name', () => {
      expect(getOAEVEntityName({ exercise_name: 'Exercise 1' }, 'Exercise')).toBe('Exercise 1');
      expect(getOAEVEntityName({}, 'Exercise')).toBe('Unknown Simulation');
    });

    it('should get AttackPattern name', () => {
      expect(getOAEVEntityName({ attack_pattern_name: 'Phishing' }, 'AttackPattern')).toBe('Phishing');
      expect(getOAEVEntityName({}, 'AttackPattern')).toBe('Unknown Attack Pattern');
    });

    it('should get Finding name', () => {
      expect(getOAEVEntityName({ finding_value: 'Finding 1' }, 'Finding')).toBe('Finding 1');
      expect(getOAEVEntityName({}, 'Finding')).toBe('Unknown Finding');
    });

    it('should get Vulnerability name', () => {
      expect(getOAEVEntityName({ vulnerability_external_id: 'CVE-2021-1234' }, 'Vulnerability')).toBe('CVE-2021-1234');
      expect(getOAEVEntityName({ vulnerability_cisa_vulnerability_name: 'Log4Shell' }, 'Vulnerability')).toBe('Log4Shell');
      expect(getOAEVEntityName({}, 'Vulnerability')).toBe('Unknown Vulnerability');
    });

    it('should handle default case', () => {
      expect(getOAEVEntityName({ name: 'Generic' }, 'Unknown')).toBe('Generic');
      expect(getOAEVEntityName({}, 'Unknown')).toBe('Unknown');
    });
  });

  describe('getOAEVEntityId', () => {
    it('should get Asset ID', () => {
      expect(getOAEVEntityId({ endpoint_id: 'ep-123' }, 'Asset')).toBe('ep-123');
      expect(getOAEVEntityId({ asset_id: 'as-123' }, 'Asset')).toBe('as-123');
    });

    it('should get AssetGroup ID', () => {
      expect(getOAEVEntityId({ asset_group_id: 'ag-123' }, 'AssetGroup')).toBe('ag-123');
    });

    it('should get Player/User ID', () => {
      expect(getOAEVEntityId({ user_id: 'user-123' }, 'Player')).toBe('user-123');
      expect(getOAEVEntityId({ user_id: 'user-456' }, 'User')).toBe('user-456');
    });

    it('should get Team ID', () => {
      expect(getOAEVEntityId({ team_id: 'team-123' }, 'Team')).toBe('team-123');
    });

    it('should get Organization ID', () => {
      expect(getOAEVEntityId({ organization_id: 'org-123' }, 'Organization')).toBe('org-123');
    });

    it('should get Scenario ID', () => {
      expect(getOAEVEntityId({ scenario_id: 'scen-123' }, 'Scenario')).toBe('scen-123');
    });

    it('should get Exercise ID', () => {
      expect(getOAEVEntityId({ exercise_id: 'ex-123' }, 'Exercise')).toBe('ex-123');
    });

    it('should get AttackPattern ID', () => {
      expect(getOAEVEntityId({ attack_pattern_id: 'ap-123' }, 'AttackPattern')).toBe('ap-123');
    });

    it('should get Finding ID', () => {
      expect(getOAEVEntityId({ finding_id: 'find-123' }, 'Finding')).toBe('find-123');
    });

    it('should get Vulnerability ID', () => {
      expect(getOAEVEntityId({ vulnerability_id: 'vuln-123' }, 'Vulnerability')).toBe('vuln-123');
    });

    it('should fall back to generic id', () => {
      expect(getOAEVEntityId({ id: 'generic-id' }, 'Asset')).toBe('generic-id');
      expect(getOAEVEntityId({ _id: 'underscore-id' }, 'Unknown')).toBe('underscore-id');
    });

    it('should return empty string for missing ID', () => {
      expect(getOAEVEntityId({}, 'Asset')).toBe('');
    });
  });

  describe('getOAEVEntityUrl', () => {
    const baseUrl = 'https://openaev.example.com';

    it('should build Asset URL', () => {
      expect(getOAEVEntityUrl(baseUrl, 'Asset', 'asset-123')).toBe(`${baseUrl}/admin/assets/endpoints/asset-123`);
    });

    it('should build AssetGroup URL', () => {
      expect(getOAEVEntityUrl(baseUrl, 'AssetGroup', 'ag-123')).toBe(`${baseUrl}/admin/assets/asset_groups/ag-123`);
    });

    it('should build Player/User URL', () => {
      expect(getOAEVEntityUrl(baseUrl, 'Player', 'player-123')).toBe(`${baseUrl}/admin/teams/players/player-123`);
      expect(getOAEVEntityUrl(baseUrl, 'User', 'user-123')).toBe(`${baseUrl}/admin/teams/players/user-123`);
    });

    it('should build Team URL', () => {
      expect(getOAEVEntityUrl(baseUrl, 'Team', 'team-123')).toBe(`${baseUrl}/admin/teams/team-123`);
    });

    it('should build Organization URL', () => {
      expect(getOAEVEntityUrl(baseUrl, 'Organization', 'org-123')).toBe(`${baseUrl}/admin/teams/organizations/org-123`);
    });

    it('should build Scenario URL', () => {
      expect(getOAEVEntityUrl(baseUrl, 'Scenario', 'scen-123')).toBe(`${baseUrl}/admin/scenarios/scen-123`);
    });

    it('should build Exercise URL', () => {
      expect(getOAEVEntityUrl(baseUrl, 'Exercise', 'ex-123')).toBe(`${baseUrl}/admin/simulations/ex-123`);
    });

    it('should build AttackPattern URL', () => {
      expect(getOAEVEntityUrl(baseUrl, 'AttackPattern', 'ap-123')).toBe(`${baseUrl}/admin/attack_patterns/ap-123`);
    });

    it('should build Finding URL', () => {
      expect(getOAEVEntityUrl(baseUrl, 'Finding', 'find-123')).toBe(`${baseUrl}/admin/findings/find-123`);
    });

    it('should build Vulnerability URL', () => {
      expect(getOAEVEntityUrl(baseUrl, 'Vulnerability', 'vuln-123')).toBe(`${baseUrl}/admin/vulnerabilities/vuln-123`);
    });

    it('should handle trailing slash in base URL', () => {
      expect(getOAEVEntityUrl(`${baseUrl}/`, 'Asset', 'asset-123')).toBe(`${baseUrl}/admin/assets/endpoints/asset-123`);
    });

    it('should return base URL for unknown type', () => {
      expect(getOAEVEntityUrl(baseUrl, 'Unknown', 'id')).toBe(baseUrl);
    });
  });

  describe('getOAEVTypeFromClass', () => {
    it('should map Java class names to types', () => {
      expect(getOAEVTypeFromClass('Endpoint')).toBe('Asset');
      expect(getOAEVTypeFromClass('AssetGroup')).toBe('AssetGroup');
      expect(getOAEVTypeFromClass('User')).toBe('User');
      expect(getOAEVTypeFromClass('Player')).toBe('Player');
      expect(getOAEVTypeFromClass('Team')).toBe('Team');
      expect(getOAEVTypeFromClass('Organization')).toBe('Organization');
      expect(getOAEVTypeFromClass('AttackPattern')).toBe('AttackPattern');
      expect(getOAEVTypeFromClass('Scenario')).toBe('Scenario');
      expect(getOAEVTypeFromClass('Exercise')).toBe('Exercise');
      expect(getOAEVTypeFromClass('Finding')).toBe('Finding');
      expect(getOAEVTypeFromClass('Vulnerability')).toBe('Vulnerability');
    });

    it('should handle full package names', () => {
      expect(getOAEVTypeFromClass('io.openbas.model.Endpoint')).toBe('Asset');
      expect(getOAEVTypeFromClass('com.example.Team')).toBe('Team');
    });

    it('should return original for unknown types', () => {
      expect(getOAEVTypeFromClass('SomeOtherClass')).toBe('SomeOtherClass');
    });
  });

  describe('getOAEVEntityColor', () => {
    it('should return correct colors for known types', () => {
      expect(getOAEVEntityColor('Asset')).toBe('#009688');
      expect(getOAEVEntityColor('AssetGroup')).toBe('#26a69a');
      expect(getOAEVEntityColor('Player')).toBe('#7e57c2');
      expect(getOAEVEntityColor('User')).toBe('#7e57c2');
      expect(getOAEVEntityColor('Team')).toBe('#66bb6a');
      expect(getOAEVEntityColor('Organization')).toBe('#3f51b5');
      expect(getOAEVEntityColor('Scenario')).toBe('#ab47bc');
      expect(getOAEVEntityColor('Exercise')).toBe('#ff7043');
      expect(getOAEVEntityColor('AttackPattern')).toBe('#d4e157');
      expect(getOAEVEntityColor('Finding')).toBe('#ec407a');
      expect(getOAEVEntityColor('Vulnerability')).toBe('#795548');
    });

    it('should return default color for unknown types', () => {
      expect(getOAEVEntityColor('Unknown')).toBe('#e91e63');
      expect(getOAEVEntityColor('Custom')).toBe('#e91e63');
    });
  });
});

