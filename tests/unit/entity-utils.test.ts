/**
 * Unit Tests for Entity Utilities
 * 
 * Tests helper functions for working with entities across different platforms.
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
// Constant Arrays Tests
// ============================================================================

describe('OBSERVABLE_TYPES', () => {
  it('should include all expected observable types', () => {
    expect(OBSERVABLE_TYPES).toContain('IPv4-Addr');
    expect(OBSERVABLE_TYPES).toContain('IPv6-Addr');
    expect(OBSERVABLE_TYPES).toContain('Domain-Name');
    expect(OBSERVABLE_TYPES).toContain('Url');
    expect(OBSERVABLE_TYPES).toContain('Email-Addr');
    expect(OBSERVABLE_TYPES).toContain('StixFile');
    expect(OBSERVABLE_TYPES).toContain('Cryptocurrency-Wallet');
  });

  it('should have correct length', () => {
    expect(OBSERVABLE_TYPES.length).toBe(13);
  });
});

describe('OPENCTI_ENTITY_TYPES', () => {
  it('should include threat intelligence types', () => {
    expect(OPENCTI_ENTITY_TYPES).toContain('Intrusion-Set');
    expect(OPENCTI_ENTITY_TYPES).toContain('Malware');
    expect(OPENCTI_ENTITY_TYPES).toContain('Threat-Actor-Group');
    expect(OPENCTI_ENTITY_TYPES).toContain('Campaign');
    expect(OPENCTI_ENTITY_TYPES).toContain('Attack-Pattern');
    expect(OPENCTI_ENTITY_TYPES).toContain('Vulnerability');
  });

  it('should include location types', () => {
    expect(OPENCTI_ENTITY_TYPES).toContain('Location');
    expect(OPENCTI_ENTITY_TYPES).toContain('City');
    expect(OPENCTI_ENTITY_TYPES).toContain('Country');
    expect(OPENCTI_ENTITY_TYPES).toContain('Region');
  });

  it('should include identity types', () => {
    expect(OPENCTI_ENTITY_TYPES).toContain('Identity');
    expect(OPENCTI_ENTITY_TYPES).toContain('Individual');
    expect(OPENCTI_ENTITY_TYPES).toContain('Organization');
    expect(OPENCTI_ENTITY_TYPES).toContain('Sector');
  });
});

describe('CONTAINER_TYPES', () => {
  it('should include report types', () => {
    expect(CONTAINER_TYPES).toContain('Report');
    expect(CONTAINER_TYPES).toContain('Grouping');
  });

  it('should include case types', () => {
    expect(CONTAINER_TYPES).toContain('Case-Incident');
    expect(CONTAINER_TYPES).toContain('Case-Rfi');
    expect(CONTAINER_TYPES).toContain('Case-Rft');
  });

  it('should include feedback and task', () => {
    expect(CONTAINER_TYPES).toContain('Feedback');
    expect(CONTAINER_TYPES).toContain('Task');
    expect(CONTAINER_TYPES).toContain('Note');
    expect(CONTAINER_TYPES).toContain('Opinion');
  });
});

// ============================================================================
// Type Check Functions Tests
// ============================================================================

describe('isObservableType', () => {
  it('should return true for known observable types', () => {
    expect(isObservableType('IPv4-Addr')).toBe(true);
    expect(isObservableType('IPv6-Addr')).toBe(true);
    expect(isObservableType('Domain-Name')).toBe(true);
    expect(isObservableType('Email-Addr')).toBe(true);
    expect(isObservableType('Url')).toBe(true);
    expect(isObservableType('StixFile')).toBe(true);
  });

  it('should return true for types containing Addr', () => {
    expect(isObservableType('SomeAddr')).toBe(true);
    expect(isObservableType('TestAddr')).toBe(true);
  });

  it('should return true for types containing Observable', () => {
    expect(isObservableType('SomeObservable')).toBe(true);
    expect(isObservableType('TestObservable')).toBe(true);
  });

  it('should be case insensitive', () => {
    expect(isObservableType('ipv4addr')).toBe(true);
    expect(isObservableType('IPV4ADDR')).toBe(true);
    expect(isObservableType('Ipv4Addr')).toBe(true);
  });

  it('should return false for non-observable types', () => {
    expect(isObservableType('Malware')).toBe(false);
    expect(isObservableType('Campaign')).toBe(false);
    expect(isObservableType('Intrusion-Set')).toBe(false);
    expect(isObservableType('Report')).toBe(false);
  });
});

describe('isOpenCTIEntityType', () => {
  it('should return true for valid OpenCTI entity types', () => {
    expect(isOpenCTIEntityType('Intrusion-Set')).toBe(true);
    expect(isOpenCTIEntityType('Malware')).toBe(true);
    expect(isOpenCTIEntityType('Campaign')).toBe(true);
    expect(isOpenCTIEntityType('Attack-Pattern')).toBe(true);
    expect(isOpenCTIEntityType('Vulnerability')).toBe(true);
    expect(isOpenCTIEntityType('Tool')).toBe(true);
  });

  it('should be case insensitive', () => {
    expect(isOpenCTIEntityType('intrusion-set')).toBe(true);
    expect(isOpenCTIEntityType('MALWARE')).toBe(true);
    expect(isOpenCTIEntityType('CaMpAiGn')).toBe(true);
  });

  it('should return false for observable types', () => {
    expect(isOpenCTIEntityType('IPv4-Addr')).toBe(false);
    expect(isOpenCTIEntityType('Domain-Name')).toBe(false);
    expect(isOpenCTIEntityType('StixFile')).toBe(false);
  });

  it('should return false for unknown types', () => {
    expect(isOpenCTIEntityType('UnknownType')).toBe(false);
    expect(isOpenCTIEntityType('')).toBe(false);
    expect(isOpenCTIEntityType('RandomString')).toBe(false);
  });
});

describe('isIndicatorType', () => {
  it('should return true for indicator', () => {
    expect(isIndicatorType('indicator')).toBe(true);
    expect(isIndicatorType('Indicator')).toBe(true);
    expect(isIndicatorType('INDICATOR')).toBe(true);
  });

  it('should return false for non-indicator types', () => {
    expect(isIndicatorType('Malware')).toBe(false);
    expect(isIndicatorType('Campaign')).toBe(false);
    expect(isIndicatorType('IPv4-Addr')).toBe(false);
  });
});

describe('isVulnerabilityType', () => {
  it('should return true for vulnerability', () => {
    expect(isVulnerabilityType('vulnerability')).toBe(true);
    expect(isVulnerabilityType('Vulnerability')).toBe(true);
    expect(isVulnerabilityType('VULNERABILITY')).toBe(true);
  });

  it('should return false for non-vulnerability types', () => {
    expect(isVulnerabilityType('Malware')).toBe(false);
    expect(isVulnerabilityType('Campaign')).toBe(false);
    expect(isVulnerabilityType('CVE-2021-44228')).toBe(false);
  });
});

describe('isOCTIContainerType', () => {
  it('should return true for container types', () => {
    expect(isOCTIContainerType('Report')).toBe(true);
    expect(isOCTIContainerType('Grouping')).toBe(true);
    expect(isOCTIContainerType('Case-Incident')).toBe(true);
    expect(isOCTIContainerType('Case-Rfi')).toBe(true);
    expect(isOCTIContainerType('Case-Rft')).toBe(true);
    expect(isOCTIContainerType('Note')).toBe(true);
    expect(isOCTIContainerType('Opinion')).toBe(true);
    expect(isOCTIContainerType('Task')).toBe(true);
    expect(isOCTIContainerType('Feedback')).toBe(true);
  });

  it('should be case insensitive', () => {
    expect(isOCTIContainerType('report')).toBe(true);
    expect(isOCTIContainerType('REPORT')).toBe(true);
    expect(isOCTIContainerType('case-incident')).toBe(true);
  });

  it('should return false for non-container types', () => {
    expect(isOCTIContainerType('Malware')).toBe(false);
    expect(isOCTIContainerType('Campaign')).toBe(false);
    expect(isOCTIContainerType('IPv4-Addr')).toBe(false);
  });
});

// ============================================================================
// Entity Accessor Functions Tests
// ============================================================================

describe('getEntityId', () => {
  it('should get id from id field', () => {
    expect(getEntityId({ id: 'entity-123' })).toBe('entity-123');
  });

  it('should get id from standard_id field', () => {
    expect(getEntityId({ standard_id: 'standard-123' })).toBe('standard-123');
  });

  it('should get id from entityId field', () => {
    expect(getEntityId({ entityId: 'entityId-123' })).toBe('entityId-123');
  });

  it('should get id from entity_id field', () => {
    expect(getEntityId({ entity_id: 'entity_id-123' })).toBe('entity_id-123');
  });

  it('should get id from _id field', () => {
    expect(getEntityId({ _id: '_id-123' })).toBe('_id-123');
  });

  it('should prioritize id over other fields', () => {
    expect(getEntityId({ id: 'primary', standard_id: 'secondary' })).toBe('primary');
  });

  it('should return undefined when no id field exists', () => {
    expect(getEntityId({ name: 'test' })).toBeUndefined();
    expect(getEntityId({})).toBeUndefined();
  });
});

describe('getEntityName', () => {
  it('should get name from name field', () => {
    expect(getEntityName({ name: 'Test Entity' })).toBe('Test Entity');
  });

  it('should get name from value field', () => {
    expect(getEntityName({ value: '192.168.1.1' })).toBe('192.168.1.1');
  });

  it('should get name from representative.main field', () => {
    expect(getEntityName({ representative: { main: 'Rep Name' } })).toBe('Rep Name');
  });

  it('should get name from entity_name field', () => {
    expect(getEntityName({ entity_name: 'Entity Name' })).toBe('Entity Name');
  });

  it('should prioritize name over other fields', () => {
    expect(getEntityName({ name: 'primary', value: 'secondary' })).toBe('primary');
  });

  it('should return Unknown when no name field exists', () => {
    expect(getEntityName({ id: 'test' })).toBe('Unknown');
    expect(getEntityName({})).toBe('Unknown');
  });
});

describe('getEntityType', () => {
  it('should get type from type field', () => {
    expect(getEntityType({ type: 'Malware' })).toBe('Malware');
  });

  it('should get type from entity_type field', () => {
    expect(getEntityType({ entity_type: 'Campaign' })).toBe('Campaign');
  });

  it('should get type from entityType field', () => {
    expect(getEntityType({ entityType: 'Intrusion-Set' })).toBe('Intrusion-Set');
  });

  it('should get type from _type field', () => {
    expect(getEntityType({ _type: 'Tool' })).toBe('Tool');
  });

  it('should prioritize type over other fields', () => {
    expect(getEntityType({ type: 'primary', entity_type: 'secondary' })).toBe('primary');
  });

  it('should return Unknown when no type field exists', () => {
    expect(getEntityType({ name: 'test' })).toBe('Unknown');
    expect(getEntityType({})).toBe('Unknown');
  });
});

describe('getEntityPlatformId', () => {
  it('should get platformId', () => {
    expect(getEntityPlatformId({ platformId: 'platform-123' })).toBe('platform-123');
  });

  it('should return undefined when no platformId', () => {
    expect(getEntityPlatformId({ id: 'test' })).toBeUndefined();
    expect(getEntityPlatformId({})).toBeUndefined();
  });
});

describe('getEntityPlatformType', () => {
  it('should get platformType', () => {
    expect(getEntityPlatformType({ platformType: 'openaev' })).toBe('openaev');
    expect(getEntityPlatformType({ platformType: 'opencti' })).toBe('opencti');
  });

  it('should default to opencti when no platformType', () => {
    expect(getEntityPlatformType({ id: 'test' })).toBe('opencti');
    expect(getEntityPlatformType({})).toBe('opencti');
  });
});

// ============================================================================
// OpenAEV Entity Functions Tests
// ============================================================================

describe('getOAEVEntityName', () => {
  it('should get Asset name', () => {
    expect(getOAEVEntityName({ endpoint_name: 'Server1' }, 'Asset')).toBe('Server1');
    expect(getOAEVEntityName({ asset_name: 'Server2' }, 'Asset')).toBe('Server2');
    expect(getOAEVEntityName({ name: 'Server3' }, 'Asset')).toBe('Server3');
    expect(getOAEVEntityName({}, 'Asset')).toBe('Unknown Asset');
  });

  it('should get AssetGroup name', () => {
    expect(getOAEVEntityName({ asset_group_name: 'Group1' }, 'AssetGroup')).toBe('Group1');
    expect(getOAEVEntityName({ name: 'Group2' }, 'AssetGroup')).toBe('Group2');
    expect(getOAEVEntityName({}, 'AssetGroup')).toBe('Unknown Asset Group');
  });

  it('should get Player/User name', () => {
    expect(getOAEVEntityName({ user_firstname: 'John', user_lastname: 'Doe' }, 'Player')).toBe('John Doe');
    expect(getOAEVEntityName({ user_firstname: 'Jane' }, 'Player')).toBe('Jane');
    expect(getOAEVEntityName({ user_email: 'user@test.com' }, 'User')).toBe('user@test.com');
    expect(getOAEVEntityName({}, 'Player')).toBe('Unknown Player');
  });

  it('should get Team name', () => {
    expect(getOAEVEntityName({ team_name: 'Team Alpha' }, 'Team')).toBe('Team Alpha');
    expect(getOAEVEntityName({ name: 'Team Beta' }, 'Team')).toBe('Team Beta');
    expect(getOAEVEntityName({}, 'Team')).toBe('Unknown Team');
  });

  it('should get Organization name', () => {
    expect(getOAEVEntityName({ organization_name: 'Org1' }, 'Organization')).toBe('Org1');
    expect(getOAEVEntityName({}, 'Organization')).toBe('Unknown Organization');
  });

  it('should get Scenario name', () => {
    expect(getOAEVEntityName({ scenario_name: 'Scenario1' }, 'Scenario')).toBe('Scenario1');
    expect(getOAEVEntityName({}, 'Scenario')).toBe('Unknown Scenario');
  });

  it('should get Exercise name', () => {
    expect(getOAEVEntityName({ exercise_name: 'Exercise1' }, 'Exercise')).toBe('Exercise1');
    expect(getOAEVEntityName({}, 'Exercise')).toBe('Unknown Simulation');
  });

  it('should get AttackPattern name', () => {
    expect(getOAEVEntityName({ attack_pattern_name: 'Spearphishing' }, 'AttackPattern')).toBe('Spearphishing');
    expect(getOAEVEntityName({}, 'AttackPattern')).toBe('Unknown Attack Pattern');
  });

  it('should get Finding name', () => {
    expect(getOAEVEntityName({ finding_value: 'Critical Finding' }, 'Finding')).toBe('Critical Finding');
    expect(getOAEVEntityName({}, 'Finding')).toBe('Unknown Finding');
  });

  it('should get Vulnerability name', () => {
    expect(getOAEVEntityName({ vulnerability_external_id: 'CVE-2021-44228' }, 'Vulnerability')).toBe('CVE-2021-44228');
    expect(getOAEVEntityName({ vulnerability_cisa_vulnerability_name: 'Log4j' }, 'Vulnerability')).toBe('Log4j');
    expect(getOAEVEntityName({}, 'Vulnerability')).toBe('Unknown Vulnerability');
  });

  it('should handle unknown type with name fallback', () => {
    expect(getOAEVEntityName({ name: 'Custom' }, 'Unknown')).toBe('Custom');
    expect(getOAEVEntityName({}, 'Unknown')).toBe('Unknown');
  });
});

describe('getOAEVEntityId', () => {
  it('should get Asset id', () => {
    expect(getOAEVEntityId({ endpoint_id: 'ep-123' }, 'Asset')).toBe('ep-123');
    expect(getOAEVEntityId({ asset_id: 'asset-123' }, 'Asset')).toBe('asset-123');
    expect(getOAEVEntityId({ id: 'id-123' }, 'Asset')).toBe('id-123');
  });

  it('should get AssetGroup id', () => {
    expect(getOAEVEntityId({ asset_group_id: 'ag-123' }, 'AssetGroup')).toBe('ag-123');
    expect(getOAEVEntityId({ id: 'id-123' }, 'AssetGroup')).toBe('id-123');
  });

  it('should get Player/User id', () => {
    expect(getOAEVEntityId({ user_id: 'user-123' }, 'Player')).toBe('user-123');
    expect(getOAEVEntityId({ user_id: 'user-456' }, 'User')).toBe('user-456');
  });

  it('should get Team id', () => {
    expect(getOAEVEntityId({ team_id: 'team-123' }, 'Team')).toBe('team-123');
  });

  it('should get Organization id', () => {
    expect(getOAEVEntityId({ organization_id: 'org-123' }, 'Organization')).toBe('org-123');
  });

  it('should get Scenario id', () => {
    expect(getOAEVEntityId({ scenario_id: 'scenario-123' }, 'Scenario')).toBe('scenario-123');
  });

  it('should get Exercise id', () => {
    expect(getOAEVEntityId({ exercise_id: 'ex-123' }, 'Exercise')).toBe('ex-123');
  });

  it('should get AttackPattern id', () => {
    expect(getOAEVEntityId({ attack_pattern_id: 'ap-123' }, 'AttackPattern')).toBe('ap-123');
  });

  it('should get Finding id', () => {
    expect(getOAEVEntityId({ finding_id: 'find-123' }, 'Finding')).toBe('find-123');
  });

  it('should get Vulnerability id', () => {
    expect(getOAEVEntityId({ vulnerability_id: 'vuln-123' }, 'Vulnerability')).toBe('vuln-123');
  });

  it('should handle default case with _id fallback', () => {
    expect(getOAEVEntityId({ _id: '_id-123' }, 'Unknown')).toBe('_id-123');
    expect(getOAEVEntityId({ id: 'id-123' }, 'Unknown')).toBe('id-123');
    expect(getOAEVEntityId({}, 'Unknown')).toBe('');
  });
});

describe('getOAEVEntityUrl', () => {
  const baseUrl = 'https://openaev.example.com';

  it('should generate Asset URL (with overview)', () => {
    expect(getOAEVEntityUrl(baseUrl, 'Asset', 'asset-123')).toBe(`${baseUrl}/admin/assets/endpoints/asset-123`);
  });

  it('should generate AssetGroup URL (list with filter)', () => {
    const url = getOAEVEntityUrl(baseUrl, 'AssetGroup', 'ag-123');
    expect(url).toContain(`${baseUrl}/admin/assets/asset_groups`);
    expect(url).toContain('?query=');
  });

  it('should generate Player/User URL (list with filter)', () => {
    const playerUrl = getOAEVEntityUrl(baseUrl, 'Player', 'player-123');
    expect(playerUrl).toContain(`${baseUrl}/admin/teams/players`);
    expect(playerUrl).toContain('?query=');
    
    const userUrl = getOAEVEntityUrl(baseUrl, 'User', 'user-123');
    expect(userUrl).toContain(`${baseUrl}/admin/teams/players`);
    expect(userUrl).toContain('?query=');
  });

  it('should generate Team URL (list page)', () => {
    expect(getOAEVEntityUrl(baseUrl, 'Team', 'team-123')).toBe(`${baseUrl}/admin/teams/teams`);
  });

  it('should generate Organization URL (list page)', () => {
    expect(getOAEVEntityUrl(baseUrl, 'Organization', 'org-123')).toBe(`${baseUrl}/admin/teams/organizations`);
  });

  it('should generate Scenario URL (with overview)', () => {
    expect(getOAEVEntityUrl(baseUrl, 'Scenario', 'scenario-123')).toBe(`${baseUrl}/admin/scenarios/scenario-123`);
  });

  it('should generate Exercise URL (with overview)', () => {
    expect(getOAEVEntityUrl(baseUrl, 'Exercise', 'ex-123')).toBe(`${baseUrl}/admin/simulations/ex-123`);
  });

  it('should generate AttackPattern URL (list page)', () => {
    expect(getOAEVEntityUrl(baseUrl, 'AttackPattern', 'ap-123')).toBe(`${baseUrl}/admin/settings/taxonomies/attack_patterns`);
  });

  it('should generate Finding URL (list with filter)', () => {
    const url = getOAEVEntityUrl(baseUrl, 'Finding', 'find-123');
    expect(url).toContain(`${baseUrl}/admin/findings`);
    expect(url).toContain('?query=');
  });

  it('should generate Vulnerability URL (list with filter)', () => {
    const url = getOAEVEntityUrl(baseUrl, 'Vulnerability', 'vuln-123');
    expect(url).toContain(`${baseUrl}/admin/settings/taxonomies/vulnerabilities`);
    expect(url).toContain('?query=');
  });

  it('should return base URL for unknown type', () => {
    expect(getOAEVEntityUrl(baseUrl, 'Unknown', 'id-123')).toBe(baseUrl);
  });

  it('should remove trailing slash from base URL', () => {
    expect(getOAEVEntityUrl('https://openaev.example.com/', 'Asset', 'asset-123'))
      .toBe('https://openaev.example.com/admin/assets/endpoints/asset-123');
  });
});

describe('getOAEVTypeFromClass', () => {
  it('should map Endpoint to Asset', () => {
    expect(getOAEVTypeFromClass('Endpoint')).toBe('Asset');
    expect(getOAEVTypeFromClass('com.openaev.model.Endpoint')).toBe('Asset');
  });

  it('should map AssetGroup correctly', () => {
    expect(getOAEVTypeFromClass('AssetGroup')).toBe('AssetGroup');
  });

  it('should map User correctly', () => {
    expect(getOAEVTypeFromClass('User')).toBe('User');
    expect(getOAEVTypeFromClass('Player')).toBe('Player');
  });

  it('should map Team correctly', () => {
    expect(getOAEVTypeFromClass('Team')).toBe('Team');
  });

  it('should map Organization correctly', () => {
    expect(getOAEVTypeFromClass('Organization')).toBe('Organization');
  });

  it('should map AttackPattern correctly', () => {
    expect(getOAEVTypeFromClass('AttackPattern')).toBe('AttackPattern');
  });

  it('should map Scenario correctly', () => {
    expect(getOAEVTypeFromClass('Scenario')).toBe('Scenario');
  });

  it('should map Exercise correctly', () => {
    expect(getOAEVTypeFromClass('Exercise')).toBe('Exercise');
  });

  it('should map Finding correctly', () => {
    expect(getOAEVTypeFromClass('Finding')).toBe('Finding');
  });

  it('should map Vulnerability correctly', () => {
    expect(getOAEVTypeFromClass('Vulnerability')).toBe('Vulnerability');
  });

  it('should return unknown class names as-is', () => {
    expect(getOAEVTypeFromClass('CustomType')).toBe('CustomType');
    expect(getOAEVTypeFromClass('com.example.CustomType')).toBe('CustomType');
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

  it('should return default pink for unknown types', () => {
    expect(getOAEVEntityColor('Unknown')).toBe('#e91e63');
    expect(getOAEVEntityColor('CustomType')).toBe('#e91e63');
    expect(getOAEVEntityColor('')).toBe('#e91e63');
  });
});
