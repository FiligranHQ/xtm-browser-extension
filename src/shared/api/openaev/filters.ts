/**
 * OpenAEV Filter Builders
 *
 * Centralized filter group builders for the OpenAEV REST API.
 * Separating filters from the client logic improves maintainability.
 */

import {
  ENTITY_TYPE_PATH_MAP,
  type FilterGroup,
  type SearchBody,
  type PayloadBuilderParams,
  type AtomicTestingBuilderParams,
  type InjectBuilderParams,
} from './types';


// ============================================================================
// Asset Filters
// ============================================================================

export function buildAssetSearchFilter(searchTerm: string): FilterGroup {
  return {
    mode: 'or',
    filters: [
      { key: 'asset_name', operator: 'contains', values: [searchTerm] },
      { key: 'endpoint_hostname', operator: 'contains', values: [searchTerm] },
      { key: 'endpoint_ips', operator: 'contains', values: [searchTerm] },
    ],
  };
}

// ============================================================================
// Asset Group Filters
// ============================================================================

export function buildAssetGroupSearchFilter(searchTerm: string): FilterGroup {
  return {
    mode: 'or',
    filters: [
      { key: 'asset_group_name', operator: 'contains', values: [searchTerm] },
    ],
  };
}

// ============================================================================
// Player Filters
// ============================================================================

export function buildPlayerSearchFilter(searchTerm: string): FilterGroup {
  return {
    mode: 'or',
    filters: [
      { key: 'user_email', operator: 'contains', values: [searchTerm] },
      { key: 'user_firstname', operator: 'contains', values: [searchTerm] },
      { key: 'user_lastname', operator: 'contains', values: [searchTerm] },
    ],
  };
}

// ============================================================================
// Team Filters
// ============================================================================

export function buildTeamSearchFilter(searchTerm: string): FilterGroup {
  return {
    mode: 'or',
    filters: [
      { key: 'team_name', operator: 'contains', values: [searchTerm] },
    ],
  };
}

// ============================================================================
// Payload Filters
// ============================================================================

export function buildDnsResolutionPayloadFilter(hostname: string): FilterGroup {
  // Note: payload_type is not a filterable field in OpenAEV API
  // Only dns_resolution_hostname is filterable, which uniquely identifies DnsResolution payloads
  return {
    mode: 'and',
    filters: [
      { key: 'dns_resolution_hostname', mode: 'or', operator: 'eq', values: [hostname] },
    ],
  };
}

export function buildPayloadByIdFilter(payloadId: string): FilterGroup {
  return {
    mode: 'and',
    filters: [
      { key: 'injector_contract_payload', mode: 'or', operator: 'eq', values: [payloadId] },
    ],
  };
}

// ============================================================================
// Kill Chain Filters
// ============================================================================

export function buildKillChainPhaseFilter(killChainPhase: string): FilterGroup {
  return {
    mode: 'and',
    filters: [
      { key: 'injector_contract_kill_chain_phases', operator: 'contains', values: [killChainPhase] },
    ],
  };
}

// ============================================================================
// Search Body Builders
// ============================================================================

/**
 * Build a search request body with pagination
 */
export function buildSearchBody(options: {
  page?: number;
  size?: number;
  filterGroup?: FilterGroup;
  textSearch?: string;
}): SearchBody {
  return {
    page: options.page ?? 0,
    size: options.size ?? 500,
    ...(options.filterGroup && { filterGroup: options.filterGroup }),
    ...(options.textSearch && { textSearch: options.textSearch }),
  };
}

/**
 * Build a paginated search body (no filters)
 */
export function buildPaginatedBody(page: number, size: number): SearchBody {
  return { page, size };
}

// ============================================================================
// URL Path Helper
// ============================================================================

/**
 * Get the URL path for an entity type
 */
export function getEntityPath(entityClass: string): string {
  return ENTITY_TYPE_PATH_MAP[entityClass] || '';
}

// ============================================================================
// Payload Body Builders
// ============================================================================

/**
 * Build a payload request body
 */
export function buildPayloadBody(input: PayloadBuilderParams): Record<string, unknown> {
  const body: Record<string, unknown> = {
    payload_type: input.payload_type,
    payload_name: input.payload_name,
    payload_description: input.payload_description || '',
    payload_platforms: input.payload_platforms,
    payload_source: input.payload_source || 'MANUAL',
    payload_status: input.payload_status || 'VERIFIED',
    payload_execution_arch: input.payload_execution_arch || 'ALL_ARCHITECTURES',
    payload_expectations: input.payload_expectations || ['PREVENTION', 'DETECTION'],
    payload_attack_patterns: input.payload_attack_patterns || [],
  };

  // Add type-specific fields
  if (input.payload_type === 'Command') {
    body.command_executor = input.command_executor;
    body.command_content = input.command_content;
  }
  if (input.payload_type === 'DnsResolution') {
    body.dns_resolution_hostname = input.dns_resolution_hostname;
  }

  // Add cleanup if provided
  if (input.payload_cleanup_executor) {
    body.payload_cleanup_executor = input.payload_cleanup_executor;
  }
  if (input.payload_cleanup_command) {
    body.payload_cleanup_command = input.payload_cleanup_command;
  }

  return body;
}

/**
 * Build a DNS resolution payload body
 */
export function buildDnsResolutionPayloadBody(input: {
  hostname: string;
  name: string;
  platforms: string[];
  attackPatternIds?: string[];
}): Record<string, unknown> {
  return {
    payload_type: 'DnsResolution',
    payload_name: input.name,
    payload_source: 'MANUAL',
    payload_status: 'VERIFIED',
    payload_platforms: input.platforms,
    payload_execution_arch: 'ALL_ARCHITECTURES',
    payload_expectations: ['PREVENTION', 'DETECTION'],
    dns_resolution_hostname: input.hostname,
    payload_attack_patterns: input.attackPatternIds || [],
  };
}

// ============================================================================
// Atomic Testing Body Builders
// ============================================================================

/**
 * Build an atomic testing request body
 */
export function buildAtomicTestingBody(input: AtomicTestingBuilderParams): Record<string, unknown> {
  return {
    inject_title: input.title,
    inject_description: input.description || '',
    inject_injector_contract: input.injectorContractId,
    inject_content: input.content || {},
    inject_assets: input.assetIds || [],
    inject_asset_groups: input.assetGroupIds || [],
    inject_teams: [],
    inject_all_teams: false,
  };
}

// ============================================================================
// Inject Body Builders
// ============================================================================

/**
 * Build an inject request body
 */
export function buildInjectBody(input: InjectBuilderParams): Record<string, unknown> {
  return {
    inject_title: input.inject_title,
    inject_description: input.inject_description || '',
    inject_injector_contract: input.inject_injector_contract,
    inject_content: input.inject_content || {},
    inject_depends_duration: input.inject_depends_duration || 0,
    inject_teams: input.inject_teams || [],
    inject_assets: input.inject_assets || [],
    inject_asset_groups: input.inject_asset_groups || [],
  };
}
