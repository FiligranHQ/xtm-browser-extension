/**
 * OpenAEV REST API Types
 * 
 * Internal types for API requests and responses.
 * These are used by builder functions in filters.ts and the OpenAEV client.
 */

// ============================================================================
// Filter Types (API Request Shapes)
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
// Payload Builder Types (Internal to builders)
// ============================================================================

export type PayloadType = 'Command' | 'Executable' | 'FileDrop' | 'DnsResolution' | 'NetworkTraffic';

export interface PayloadBuilderParams {
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

// ============================================================================
// Atomic Testing Builder Types (Internal to builders)
// ============================================================================

export interface AtomicTestingBuilderParams {
  title: string;
  description?: string;
  injectorContractId: string;
  content?: Record<string, unknown>;
  assetIds?: string[];
  assetGroupIds?: string[];
}

// ============================================================================
// Inject Builder Types (Internal to builders)
// ============================================================================

export interface InjectBuilderParams {
  inject_title: string;
  inject_description?: string;
  inject_injector_contract: string;
  inject_content?: Record<string, unknown>;
  inject_depends_duration?: number;
  inject_teams?: string[];
  inject_assets?: string[];
  inject_asset_groups?: string[];
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
  'Vulnerability': 'admin/vulnerabilities',
};
