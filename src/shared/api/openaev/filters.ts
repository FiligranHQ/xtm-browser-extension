/**
 * OpenAEV Filter Builders
 *
 * Centralized filter group builders for the OpenAEV REST API.
 * Separating filters from the client logic improves maintainability.
 */

// ============================================================================
// Filter Group Types
// ============================================================================

export interface Filter {
  key: string;
  operator: 'eq' | 'contains' | 'starts_with' | 'not_eq';
  values: string[];
  mode?: 'or' | 'and';
}

export interface FilterGroup {
  mode: 'or' | 'and';
  filters: Filter[];
}

export interface SearchBody {
  page?: number;
  size?: number;
  filterGroup?: FilterGroup;
  textSearch?: string;
}

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
  return {
    mode: 'and',
    filters: [
      { key: 'payload_type', mode: 'or', operator: 'eq', values: ['DnsResolution'] },
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
// URL Path Mapping
// ============================================================================

export const ENTITY_TYPE_PATH_MAP: Record<string, string> = {
  'Asset': 'admin/assets/endpoints',
  'AssetGroup': 'admin/assets/asset_groups',
  'User': 'admin/teams/players',
  'Player': 'admin/teams/players',
  'Team': 'admin/teams/teams',
  'Organization': 'admin/teams/organizations',
  'Scenario': 'admin/scenarios',
  'Exercise': 'admin/simulations',
  'AttackPattern': 'admin/attack_patterns',
  'Finding': 'admin/findings',
};

/**
 * Get the URL path for an entity type
 */
export function getEntityPath(entityClass: string): string {
  return ENTITY_TYPE_PATH_MAP[entityClass] || '';
}

// ============================================================================
// Payload Types
// ============================================================================

export type PayloadType = 'Command' | 'Executable' | 'FileDrop' | 'DnsResolution' | 'NetworkTraffic';

export interface PayloadInput {
  payload_type: PayloadType;
  payload_name: string;
  payload_description?: string;
  payload_platforms: string[];
  payload_source?: string;
  payload_status?: string;
  payload_execution_arch?: string;
  payload_expectations?: string[];
  payload_attack_patterns?: string[];
  // Command-specific
  command_executor?: string;
  command_content?: string;
  // Cleanup
  payload_cleanup_executor?: string | null;
  payload_cleanup_command?: string | null;
  // DNS Resolution-specific
  dns_resolution_hostname?: string;
}

/**
 * Build a payload request body
 */
export function buildPayloadBody(input: PayloadInput): Record<string, unknown> {
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
// Atomic Testing Types
// ============================================================================

export interface AtomicTestingInput {
  title: string;
  description?: string;
  injectorContractId: string;
  content?: Record<string, unknown>;
  assetIds?: string[];
  assetGroupIds?: string[];
}

/**
 * Build an atomic testing request body
 */
export function buildAtomicTestingBody(input: AtomicTestingInput): Record<string, unknown> {
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
// Inject Types
// ============================================================================

export interface InjectInput {
  inject_title: string;
  inject_description?: string;
  inject_injector_contract: string;
  inject_content?: Record<string, unknown>;
  inject_depends_duration?: number;
  inject_teams?: string[];
  inject_assets?: string[];
  inject_asset_groups?: string[];
}
