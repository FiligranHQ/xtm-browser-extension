/**
 * OpenAEV Types
 * 
 * All OpenAEV-specific types including entity definitions, scenarios, and injects.
 * All types are prefixed with OAEV for consistency with OpenCTI (OCTI*) types.
 */

// ============================================================================
// Entity Types
// ============================================================================

/**
 * Entity types for OpenAEV platform
 * When adding new entity types, update the registry's entityTypes array as well
 */
export type OAEVEntityType = 
  | 'Asset' 
  | 'AssetGroup' 
  | 'Player' 
  | 'Team' 
  | 'AttackPattern' 
  | 'Finding' 
  | 'Scenario' 
  | 'Exercise' 
  | 'Organization' 
  | 'User'
  | 'Vulnerability';

/**
 * OpenAEV Player/User
 */
export interface OAEVPlayer {
  user_id: string;
  user_email: string;
  user_firstname?: string;
  user_lastname?: string;
  user_phone?: string;
  user_organization?: string;
  user_teams?: string[];
}

/**
 * OpenAEV Attack Pattern (MITRE ATT&CK technique)
 */
export interface OAEVAttackPattern {
  attack_pattern_id: string;
  attack_pattern_name: string;
  attack_pattern_external_id: string; // External technique ID (e.g., T1059)
  attack_pattern_description?: string;
  attack_pattern_platforms?: string[];
  attack_pattern_kill_chain_phases?: string[];
  attack_pattern_parent?: string; // UUID of parent technique (for sub-techniques)
  attack_pattern_permissions_required?: string[];
  attack_pattern_created_at?: string;
  attack_pattern_updated_at?: string;
}

/**
 * OpenAEV Finding
 */
export interface OAEVFinding {
  finding_id: string;
  finding_type: string; // text, number, port, portscan, ipv4, ipv6, credentials, cve
  finding_value: string; // Main attribute for matching
  finding_created_at?: string;
  finding_assets?: Array<{
    asset_id: string;
    asset_name: string;
  }>;
  finding_asset_groups?: Array<{
    asset_group_id: string;
    asset_group_name: string;
  }>;
}

/**
 * Generic detected platform entity (for non-OpenCTI platforms like OpenAEV, OpenGRC)
 * Platform is identified by the type prefix (e.g., 'oaev-Asset', 'ogrc-Control')
 */
export interface DetectedOAEVEntity {
  /** Entity type with platform prefix (e.g., 'oaev-Asset') */
  type: string;
  /** Display name of the entity */
  name: string;
  /** The matched text in the document */
  value?: string;
  startIndex: number;
  endIndex: number;
  found: boolean;
  entityId?: string;
  /** Raw entity data from the platform */
  entityData?: Record<string, unknown>;
  platformId?: string;
  /** Platform type identifier */
  platformType?: string;
}

// ============================================================================
// Asset Types
// ============================================================================

export type OAEVPlatform = 'Linux' | 'Windows' | 'MacOS' | 'Container' | 'Service' | 'Generic' | 'Internal' | 'Unknown';
export type OAEVArch = 'x86_64' | 'arm64' | 'Unknown' | 'ALL_ARCHITECTURES';

/**
 * OpenAEV Asset (Endpoint)
 * Consolidated definition for both entity detection and scenario creation
 */
export interface OAEVAsset {
  asset_id: string;
  asset_name: string;
  asset_description?: string;
  asset_type?: string;
  asset_tags?: string[];
  asset_created_at?: string;
  asset_updated_at?: string;
  asset_external_reference?: string;
  asset_last_seen?: string;
  asset_hostname?: string;
  asset_ips?: string[];
  asset_platform?: string;
  // Endpoint-specific fields (alternative field names from API)
  endpoint_id?: string;
  endpoint_name?: string;
  endpoint_hostname?: string;
  endpoint_ips?: string[];
  endpoint_mac_addresses?: string[];
  endpoint_platform?: OAEVPlatform | string;
  endpoint_arch?: OAEVArch | string;
  endpoint_seen_ip?: string;
  endpoint_is_eol?: boolean;
}

/**
 * OpenAEV Asset Group
 * Consolidated definition for both entity detection and scenario creation
 */
export interface OAEVAssetGroup {
  asset_group_id: string;
  asset_group_name: string;
  asset_group_description?: string;
  asset_group_assets?: string[];
  asset_group_dynamic_assets?: string[];
  asset_group_tags?: string[];
  asset_group_created_at?: string;
  asset_group_updated_at?: string;
  asset_group_external_reference?: string;
  asset_group_assets_number?: number;
}

/**
 * OpenAEV Team
 * Consolidated definition for both entity detection and scenario creation
 */
export interface OAEVTeam {
  team_id: string;
  team_name: string;
  team_description?: string;
  team_tags?: string[];
  team_created_at?: string;
  team_updated_at?: string;
  team_contextual?: boolean;
  team_users?: string[];
  team_users_number?: number;
}

// ============================================================================
// Scenario Types
// ============================================================================

/**
 * OpenAEV Scenario input for creation
 */
export interface OAEVScenarioInput {
  scenario_name: string;
  scenario_description?: string;
  scenario_subtitle?: string;
  scenario_category?: string;
  scenario_main_focus?: string;
  scenario_severity?: 'low' | 'medium' | 'high' | 'critical';
  scenario_tags?: string[];
}

/**
 * OpenAEV Scenario
 */
export interface OAEVScenario {
  scenario_id: string;
  scenario_name: string;
  scenario_description?: string;
  scenario_subtitle?: string;
  scenario_category?: string;
  scenario_created_at?: string;
  scenario_updated_at?: string;
}

/**
 * Available category options for OpenAEV scenarios
 * Matches OpenAEV scenarioCategories constant
 */
export const SCENARIO_CATEGORY_OPTIONS = [
  { value: 'global-crisis', label: 'Global Crisis' },
  { value: 'attack-scenario', label: 'Attack Scenario' },
  { value: 'media-pressure', label: 'Media Pressure' },
  { value: 'data-exfiltration', label: 'Data Exfiltration' },
  { value: 'capture-the-flag', label: 'Capture The Flag' },
  { value: 'vulnerability-exploitation', label: 'Vulnerability Exploitation' },
  { value: 'lateral-movement', label: 'Lateral Movement' },
  { value: 'url-filtering', label: 'URL Filtering' },
] as const;

/**
 * Available main focus options for OpenAEV scenarios
 * Matches OpenAEV Scenario.MAIN_FOCUS_* constants
 */
export const SCENARIO_MAIN_FOCUS_OPTIONS = [
  { value: 'incident-response', label: 'Incident Response' },
  { value: 'endpoint-protection', label: 'Endpoint Protection' },
  { value: 'web-filtering', label: 'Web Filtering' },
  { value: 'standard-operating-procedure', label: 'Standard Operating Procedures' },
  { value: 'crisis-communication', label: 'Crisis Communication' },
  { value: 'strategic-reaction', label: 'Strategic Reaction' },
] as const;

/**
 * Available severity options for OpenAEV scenarios
 * Matches OpenAEV Scenario.SEVERITY enum
 */
export const SCENARIO_SEVERITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
] as const;

/**
 * Default scenario form values matching OpenAEV defaults
 */
export const SCENARIO_DEFAULT_VALUES = {
  category: 'attack-scenario',
  mainFocus: 'incident-response',
  severity: 'high' as const,
};

// ============================================================================
// Kill Chain Phase Types
// ============================================================================

/**
 * OpenAEV Kill Chain Phase
 */
export interface OAEVKillChainPhase {
  phase_id: string;
  phase_kill_chain_name: string;
  phase_name: string;
  phase_order: number;
}

// ============================================================================
// Inject Types
// ============================================================================

/**
 * OpenAEV Injector Contract
 */
export interface OAEVInjectorContract {
  injector_contract_id: string;
  injector_contract_labels?: Record<string, string>;
  injector_contract_platforms?: string[];
  injector_contract_attack_patterns?: string[];
  injector_contract_kill_chain_phases?: string[];
  injector_contract_content?: string;
  injector_contract_payload_type?: string;
  injector_contract_injector_type?: string;
  injector_contract_arch?: OAEVArch | string;
  injector_contract_atomic_testing?: boolean;
  injector_contract_payload?: {
    payload_id?: string;
    payload_name?: string;
    payload_type?: string;
  };
  injector_name?: string;
  injector_type?: string;
}

