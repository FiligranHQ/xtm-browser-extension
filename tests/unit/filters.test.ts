/**
 * Unit Tests for OpenAEV Filter Builders
 * 
 * Tests the filter builder functions for the OpenAEV REST API.
 */

import { describe, it, expect } from 'vitest';
import {
  buildAssetSearchFilter,
  buildAssetGroupSearchFilter,
  buildPlayerSearchFilter,
  buildTeamSearchFilter,
  buildDnsResolutionPayloadFilter,
  buildPayloadByIdFilter,
  buildKillChainPhaseFilter,
  buildSearchBody,
  buildPaginatedBody,
  getEntityPath,
  buildPayloadBody,
  buildDnsResolutionPayloadBody,
  buildAtomicTestingBody,
  buildInjectBody,
} from '../../src/shared/api/openaev/filters';

// ============================================================================
// Asset Filters Tests
// ============================================================================

describe('buildAssetSearchFilter', () => {
  it('should create filter for asset name search', () => {
    const filter = buildAssetSearchFilter('server-01');
    
    expect(filter.mode).toBe('or');
    expect(filter.filters).toHaveLength(3);
    expect(filter.filters[0]).toEqual({
      key: 'asset_name',
      operator: 'contains',
      values: ['server-01'],
    });
  });

  it('should include hostname filter', () => {
    const filter = buildAssetSearchFilter('test');
    
    const hostnameFilter = filter.filters.find(f => f.key === 'endpoint_hostname');
    expect(hostnameFilter).toBeDefined();
    expect(hostnameFilter?.values).toEqual(['test']);
  });

  it('should include IP filter', () => {
    const filter = buildAssetSearchFilter('192.168.1.1');
    
    const ipFilter = filter.filters.find(f => f.key === 'endpoint_ips');
    expect(ipFilter).toBeDefined();
    expect(ipFilter?.values).toEqual(['192.168.1.1']);
  });

  it('should handle empty search term', () => {
    const filter = buildAssetSearchFilter('');
    
    expect(filter.mode).toBe('or');
    expect(filter.filters).toHaveLength(3);
    expect(filter.filters[0].values).toEqual(['']);
  });

  it('should handle special characters', () => {
    const filter = buildAssetSearchFilter('server-name_01.local');
    
    expect(filter.filters[0].values).toEqual(['server-name_01.local']);
  });
});

// ============================================================================
// Asset Group Filters Tests
// ============================================================================

describe('buildAssetGroupSearchFilter', () => {
  it('should create filter for asset group name search', () => {
    const filter = buildAssetGroupSearchFilter('Production');
    
    expect(filter.mode).toBe('or');
    expect(filter.filters).toHaveLength(1);
    expect(filter.filters[0]).toEqual({
      key: 'asset_group_name',
      operator: 'contains',
      values: ['Production'],
    });
  });

  it('should handle multi-word search', () => {
    const filter = buildAssetGroupSearchFilter('Web Servers');
    
    expect(filter.filters[0].values).toEqual(['Web Servers']);
  });
});

// ============================================================================
// Player Filters Tests
// ============================================================================

describe('buildPlayerSearchFilter', () => {
  it('should create filter for email search', () => {
    const filter = buildPlayerSearchFilter('john@example.com');
    
    expect(filter.mode).toBe('or');
    expect(filter.filters).toHaveLength(3);
    
    const emailFilter = filter.filters.find(f => f.key === 'user_email');
    expect(emailFilter).toBeDefined();
    expect(emailFilter?.values).toEqual(['john@example.com']);
  });

  it('should include firstname filter', () => {
    const filter = buildPlayerSearchFilter('John');
    
    const firstnameFilter = filter.filters.find(f => f.key === 'user_firstname');
    expect(firstnameFilter).toBeDefined();
    expect(firstnameFilter?.values).toEqual(['John']);
  });

  it('should include lastname filter', () => {
    const filter = buildPlayerSearchFilter('Doe');
    
    const lastnameFilter = filter.filters.find(f => f.key === 'user_lastname');
    expect(lastnameFilter).toBeDefined();
    expect(lastnameFilter?.values).toEqual(['Doe']);
  });
});

// ============================================================================
// Team Filters Tests
// ============================================================================

describe('buildTeamSearchFilter', () => {
  it('should create filter for team name search', () => {
    const filter = buildTeamSearchFilter('Red Team');
    
    expect(filter.mode).toBe('or');
    expect(filter.filters).toHaveLength(1);
    expect(filter.filters[0]).toEqual({
      key: 'team_name',
      operator: 'contains',
      values: ['Red Team'],
    });
  });
});

// ============================================================================
// Payload Filters Tests
// ============================================================================

describe('buildDnsResolutionPayloadFilter', () => {
  it('should create filter for DNS hostname', () => {
    const filter = buildDnsResolutionPayloadFilter('malicious.example.com');
    
    expect(filter.mode).toBe('and');
    expect(filter.filters).toHaveLength(1);
    expect(filter.filters[0]).toEqual({
      key: 'dns_resolution_hostname',
      mode: 'or',
      operator: 'eq',
      values: ['malicious.example.com'],
    });
  });
});

describe('buildPayloadByIdFilter', () => {
  it('should create filter for payload ID', () => {
    const filter = buildPayloadByIdFilter('payload-123');
    
    expect(filter.mode).toBe('and');
    expect(filter.filters).toHaveLength(1);
    expect(filter.filters[0]).toEqual({
      key: 'injector_contract_payload',
      mode: 'or',
      operator: 'eq',
      values: ['payload-123'],
    });
  });
});

// ============================================================================
// Kill Chain Filters Tests
// ============================================================================

describe('buildKillChainPhaseFilter', () => {
  it('should create filter for kill chain phase', () => {
    const filter = buildKillChainPhaseFilter('execution');
    
    expect(filter.mode).toBe('and');
    expect(filter.filters).toHaveLength(1);
    expect(filter.filters[0]).toEqual({
      key: 'injector_contract_kill_chain_phases',
      operator: 'contains',
      values: ['execution'],
    });
  });
});

// ============================================================================
// Search Body Builders Tests
// ============================================================================

describe('buildSearchBody', () => {
  it('should create search body with default pagination', () => {
    const body = buildSearchBody({});
    
    expect(body.page).toBe(0);
    expect(body.size).toBe(500);
  });

  it('should create search body with custom pagination', () => {
    const body = buildSearchBody({ page: 2, size: 100 });
    
    expect(body.page).toBe(2);
    expect(body.size).toBe(100);
  });

  it('should include filter group when provided', () => {
    const filterGroup = buildAssetSearchFilter('test');
    const body = buildSearchBody({ filterGroup });
    
    expect(body.filterGroup).toEqual(filterGroup);
  });

  it('should include text search when provided', () => {
    const body = buildSearchBody({ textSearch: 'malware' });
    
    expect(body.textSearch).toBe('malware');
  });

  it('should include all options when provided', () => {
    const filterGroup = buildTeamSearchFilter('Red Team');
    const body = buildSearchBody({
      page: 1,
      size: 50,
      filterGroup,
      textSearch: 'attack',
    });
    
    expect(body.page).toBe(1);
    expect(body.size).toBe(50);
    expect(body.filterGroup).toEqual(filterGroup);
    expect(body.textSearch).toBe('attack');
  });

  it('should NOT include undefined properties', () => {
    const body = buildSearchBody({ page: 0 });
    
    expect(Object.keys(body)).toContain('page');
    expect(Object.keys(body)).toContain('size');
    expect(Object.keys(body)).not.toContain('filterGroup');
    expect(Object.keys(body)).not.toContain('textSearch');
  });
});

describe('buildPaginatedBody', () => {
  it('should create paginated body', () => {
    const body = buildPaginatedBody(0, 100);
    
    expect(body).toEqual({ page: 0, size: 100 });
  });

  it('should handle large page numbers', () => {
    const body = buildPaginatedBody(999, 500);
    
    expect(body.page).toBe(999);
    expect(body.size).toBe(500);
  });
});

// ============================================================================
// URL Path Helper Tests
// ============================================================================

describe('getEntityPath', () => {
  it('should return correct path for endpoints', () => {
    const path = getEntityPath('endpoint');
    // Check based on ENTITY_TYPE_PATH_MAP
    expect(typeof path).toBe('string');
  });

  it('should return empty string for unknown entity type', () => {
    const path = getEntityPath('unknown_entity');
    expect(path).toBe('');
  });
});

// ============================================================================
// Payload Body Builders Tests
// ============================================================================

describe('buildPayloadBody', () => {
  it('should create Command payload body', () => {
    const body = buildPayloadBody({
      payload_type: 'Command',
      payload_name: 'Test Command',
      payload_platforms: ['Windows'],
      command_executor: 'powershell',
      command_content: 'Get-Process',
    });
    
    expect(body.payload_type).toBe('Command');
    expect(body.payload_name).toBe('Test Command');
    expect(body.payload_platforms).toEqual(['Windows']);
    expect(body.command_executor).toBe('powershell');
    expect(body.command_content).toBe('Get-Process');
    expect(body.payload_source).toBe('MANUAL');
    expect(body.payload_status).toBe('VERIFIED');
  });

  it('should create DnsResolution payload body', () => {
    const body = buildPayloadBody({
      payload_type: 'DnsResolution',
      payload_name: 'DNS Test',
      payload_platforms: ['Linux', 'Windows'],
      dns_resolution_hostname: 'test.example.com',
    });
    
    expect(body.payload_type).toBe('DnsResolution');
    expect(body.dns_resolution_hostname).toBe('test.example.com');
  });

  it('should include description when provided', () => {
    const body = buildPayloadBody({
      payload_type: 'Command',
      payload_name: 'Test',
      payload_description: 'This is a test payload',
      payload_platforms: ['Linux'],
    });
    
    expect(body.payload_description).toBe('This is a test payload');
  });

  it('should include attack patterns when provided', () => {
    const body = buildPayloadBody({
      payload_type: 'Command',
      payload_name: 'Test',
      payload_platforms: ['Windows'],
      payload_attack_patterns: ['attack-pattern-1', 'attack-pattern-2'],
    });
    
    expect(body.payload_attack_patterns).toEqual(['attack-pattern-1', 'attack-pattern-2']);
  });

  it('should include cleanup commands when provided', () => {
    const body = buildPayloadBody({
      payload_type: 'Command',
      payload_name: 'Test',
      payload_platforms: ['Windows'],
      command_executor: 'powershell',
      command_content: 'New-Item test.txt',
      payload_cleanup_executor: 'powershell',
      payload_cleanup_command: 'Remove-Item test.txt',
    });
    
    expect(body.payload_cleanup_executor).toBe('powershell');
    expect(body.payload_cleanup_command).toBe('Remove-Item test.txt');
  });

  it('should use default values when not provided', () => {
    const body = buildPayloadBody({
      payload_type: 'Command',
      payload_name: 'Test',
      payload_platforms: ['Linux'],
    });
    
    expect(body.payload_description).toBe('');
    expect(body.payload_source).toBe('MANUAL');
    expect(body.payload_status).toBe('VERIFIED');
    expect(body.payload_execution_arch).toBe('ALL_ARCHITECTURES');
    expect(body.payload_expectations).toEqual(['PREVENTION', 'DETECTION']);
    expect(body.payload_attack_patterns).toEqual([]);
  });

  it('should allow custom source and status', () => {
    const body = buildPayloadBody({
      payload_type: 'Command',
      payload_name: 'Test',
      payload_platforms: ['Linux'],
      payload_source: 'CALDERA',
      payload_status: 'UNVERIFIED',
    });
    
    expect(body.payload_source).toBe('CALDERA');
    expect(body.payload_status).toBe('UNVERIFIED');
  });
});

describe('buildDnsResolutionPayloadBody', () => {
  it('should create DNS resolution payload body', () => {
    const body = buildDnsResolutionPayloadBody({
      hostname: 'c2.evil.com',
      name: 'C2 DNS Check',
      platforms: ['Windows', 'Linux'],
    });
    
    expect(body.payload_type).toBe('DnsResolution');
    expect(body.payload_name).toBe('C2 DNS Check');
    expect(body.dns_resolution_hostname).toBe('c2.evil.com');
    expect(body.payload_platforms).toEqual(['Windows', 'Linux']);
    expect(body.payload_source).toBe('MANUAL');
    expect(body.payload_status).toBe('VERIFIED');
    expect(body.payload_attack_patterns).toEqual([]);
  });

  it('should include attack pattern IDs when provided', () => {
    const body = buildDnsResolutionPayloadBody({
      hostname: 'test.com',
      name: 'DNS Test',
      platforms: ['Windows'],
      attackPatternIds: ['ap-1', 'ap-2'],
    });
    
    expect(body.payload_attack_patterns).toEqual(['ap-1', 'ap-2']);
  });
});

// ============================================================================
// Atomic Testing Body Builders Tests
// ============================================================================

describe('buildAtomicTestingBody', () => {
  it('should create atomic testing body', () => {
    const body = buildAtomicTestingBody({
      title: 'Test Atomic',
      injectorContractId: 'contract-123',
    });
    
    expect(body.inject_title).toBe('Test Atomic');
    expect(body.inject_injector_contract).toBe('contract-123');
    expect(body.inject_description).toBe('');
    expect(body.inject_content).toEqual({});
    expect(body.inject_assets).toEqual([]);
    expect(body.inject_asset_groups).toEqual([]);
    expect(body.inject_teams).toEqual([]);
    expect(body.inject_all_teams).toBe(false);
  });

  it('should include description when provided', () => {
    const body = buildAtomicTestingBody({
      title: 'Test',
      description: 'This is a test description',
      injectorContractId: 'contract-123',
    });
    
    expect(body.inject_description).toBe('This is a test description');
  });

  it('should include assets when provided', () => {
    const body = buildAtomicTestingBody({
      title: 'Test',
      injectorContractId: 'contract-123',
      assetIds: ['asset-1', 'asset-2'],
    });
    
    expect(body.inject_assets).toEqual(['asset-1', 'asset-2']);
  });

  it('should include asset groups when provided', () => {
    const body = buildAtomicTestingBody({
      title: 'Test',
      injectorContractId: 'contract-123',
      assetGroupIds: ['group-1', 'group-2'],
    });
    
    expect(body.inject_asset_groups).toEqual(['group-1', 'group-2']);
  });

  it('should include content when provided', () => {
    const body = buildAtomicTestingBody({
      title: 'Test',
      injectorContractId: 'contract-123',
      content: { key: 'value', nested: { data: true } },
    });
    
    expect(body.inject_content).toEqual({ key: 'value', nested: { data: true } });
  });
});

// ============================================================================
// Inject Body Builders Tests
// ============================================================================

describe('buildInjectBody', () => {
  it('should create inject body', () => {
    const body = buildInjectBody({
      inject_title: 'Test Inject',
      inject_injector_contract: 'contract-456',
    });
    
    expect(body.inject_title).toBe('Test Inject');
    expect(body.inject_injector_contract).toBe('contract-456');
    expect(body.inject_description).toBe('');
    expect(body.inject_content).toEqual({});
    expect(body.inject_depends_duration).toBe(0);
    expect(body.inject_teams).toEqual([]);
    expect(body.inject_assets).toEqual([]);
    expect(body.inject_asset_groups).toEqual([]);
  });

  it('should include all options when provided', () => {
    const body = buildInjectBody({
      inject_title: 'Full Inject',
      inject_description: 'Full description',
      inject_injector_contract: 'contract-789',
      inject_content: { command: 'whoami' },
      inject_depends_duration: 300,
      inject_teams: ['team-1'],
      inject_assets: ['asset-1'],
      inject_asset_groups: ['group-1'],
    });
    
    expect(body.inject_title).toBe('Full Inject');
    expect(body.inject_description).toBe('Full description');
    expect(body.inject_injector_contract).toBe('contract-789');
    expect(body.inject_content).toEqual({ command: 'whoami' });
    expect(body.inject_depends_duration).toBe(300);
    expect(body.inject_teams).toEqual(['team-1']);
    expect(body.inject_assets).toEqual(['asset-1']);
    expect(body.inject_asset_groups).toEqual(['group-1']);
  });
});

