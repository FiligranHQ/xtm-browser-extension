// ============================================================================
// Configuration Types
// ============================================================================

import { PlatformType } from '../platform/registry';

export interface PlatformConfig {
  id: string;
  name: string;
  url: string;
  apiToken: string;
  enabled: boolean;
  lastConnected?: string;
  platformName?: string;
  platformVersion?: string;
  isEnterprise?: boolean;
  /** Platform type for identification */
  type?: PlatformType;
}

/**
 * Detection settings for entity scanning
 * Platform-agnostic - uses string arrays for entity type configuration
 */
export interface DetectionSettings {
  /** OpenCTI SDO entity types to detect */
  entityTypes?: string[];
  /** OpenCTI observable types to detect */
  observableTypes?: string[];
  /** Entity types to detect by platform (keyed by platform type, e.g., 'openaev') */
  platformEntityTypes?: Record<string, string[]>;
}

// ============================================================================
// AI Configuration Types
// ============================================================================

export type AIProvider = 'openai' | 'anthropic' | 'gemini' | 'xtm-one';

export interface AIModelInfo {
  id: string;
  name: string;
  description?: string;
}

export interface AISettings {
  enabled: boolean;
  provider?: AIProvider;
  apiKey?: string;
  // Model selection (optional, uses provider defaults if not set)
  model?: string;
  // Cached available models from the provider API
  availableModels?: AIModelInfo[];
  // Connection test result
  connectionTested?: boolean;
}

// Platform affinity options for scenario generation (matching OpenAEV/OpenCTI)
export const PLATFORM_AFFINITIES = [
  { value: 'windows', label: 'Windows' },
  { value: 'linux', label: 'Linux' },
  { value: 'macos', label: 'macOS' },
  { value: 'android', label: 'Android' },
  { value: 'ios', label: 'iOS' },
  { value: 'network', label: 'Network' },
  { value: 'containers', label: 'Containers' },
  { value: 'office-365', label: 'Office 365' },
  { value: 'azure-ad', label: 'Azure AD' },
  { value: 'google-workspace', label: 'Google Workspace' },
  { value: 'saas', label: 'SaaS' },
  { value: 'iaas', label: 'IaaS' },
  { value: 'pre', label: 'PRE' },
] as const;

// Type affinity options for scenario generation
export const TYPE_AFFINITIES = [
  { value: 'attack-scenario', label: 'Attack Scenario' },
  { value: 'incident-response', label: 'Incident Response' },
  { value: 'detection-validation', label: 'Detection Validation' },
  { value: 'threat-hunting', label: 'Threat Hunting' },
  { value: 'red-team', label: 'Red Team Exercise' },
  { value: 'purple-team', label: 'Purple Team Exercise' },
  { value: 'tabletop', label: 'Tabletop Exercise' },
  { value: 'crisis-management', label: 'Crisis Management' },
] as const;

export interface ExtensionSettings {
  // Multi-platform support - keyed by platform type
  // Each platform type has its own array of configured instances
  openctiPlatforms: PlatformConfig[];
  openaevPlatforms: PlatformConfig[];
  opengrcPlatforms?: PlatformConfig[]; // Future platform
  theme: 'auto' | 'light' | 'dark';
  autoScan: boolean;
  highlightColor?: string;
  scanOnLoad: boolean;
  showNotifications: boolean;
  detection?: DetectionSettings;
  // AI configuration (available only with EE platforms)
  ai?: AISettings;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  openctiPlatforms: [],
  openaevPlatforms: [],
  theme: 'auto',
  autoScan: false,
  scanOnLoad: false,
  showNotifications: true,
  detection: {
    // Entity types match the SDO cache structure (storage.ts SDOCache)
    entityTypes: [
      'Administrative-Area', 'Attack-Pattern', 'Campaign', 'City', 'Country', 'Event',
      'Incident', 'Individual', 'Intrusion-Set', 'Malware', 'Organization',
      'Position', 'Region', 'Sector', 'Threat-Actor-Group', 'Threat-Actor-Individual'
    ],
    observableTypes: [
      'Bank-Account', 'Cryptocurrency-Wallet', 'Domain-Name', 'Email-Addr',
      'Hostname', 'IPv4-Addr', 'IPv6-Addr', 'Mac-Addr', 'Phone-Number',
      'StixFile', 'Url', 'User-Agent'
    ],
    platformEntityTypes: {
      openaev: ['Asset', 'AssetGroup', 'AttackPattern', 'Player', 'Team', 'Finding'],
    },
  },
  ai: {
    enabled: false,
  },
};

// ============================================================================
// Observable Types
// ============================================================================

export type ObservableType =
  | 'IPv4-Addr'
  | 'IPv6-Addr'
  | 'Domain-Name'
  | 'Hostname'
  | 'Url'
  | 'Email-Addr'
  | 'File'
  | 'StixFile'
  | 'Artifact'
  | 'Mac-Addr'
  | 'Autonomous-System'
  | 'Cryptocurrency-Wallet'
  | 'User-Account'
  | 'Windows-Registry-Key'
  | 'Directory'
  | 'Process'
  | 'Software'
  | 'X509-Certificate'
  | 'Text'
  | 'User-Agent'
  | 'Phone-Number'
  | 'Bank-Account'
  | 'Payment-Card'
  | 'Credential'
  | 'Tracking-Number'
  | 'Media-Content';

export type HashType = 'MD5' | 'SHA-1' | 'SHA-256' | 'SHA-512' | 'SSDEEP';

export interface PlatformMatch {
  platformId: string;
  entityId: string;
  entityData?: StixCyberObservable | StixDomainObject;
}

export interface DetectedObservable {
  type: ObservableType;
  value: string;
  /** 
   * Refanged value for cache/API lookups (e.g., example.com from example[.]com)
   * If not defanged, this is the same as value
   */
  refangedValue?: string;
  /** True if the detected value was defanged (e.g., example[.]com) */
  isDefanged?: boolean;
  hashType?: HashType;
  startIndex: number;
  endIndex: number;
  context?: string;
  found: boolean;
  entityId?: string;
  entityData?: StixCyberObservable;
  platformId?: string;
  // All platforms where this entity was found (for multi-platform navigation)
  platformMatches?: PlatformMatch[];
}

// ============================================================================
// SDO Types (STIX Domain Objects)
// ============================================================================

export type SDOType =
  | 'Intrusion-Set'
  | 'Malware'
  | 'Threat-Actor'
  | 'Campaign'
  | 'Vulnerability'
  | 'Attack-Pattern'
  | 'Tool'
  | 'Incident'
  | 'Infrastructure'
  | 'Indicator';

export interface DetectedSDO {
  type: SDOType;
  name: string;
  aliases?: string[];
  startIndex: number;
  endIndex: number;
  found: boolean;
  entityId?: string;
  entityData?: StixDomainObject;
  platformId?: string;
  // All platforms where this entity was found (for multi-platform navigation)
  platformMatches?: PlatformMatch[];
}

// ============================================================================
// Platform-Specific Entity Types
// ============================================================================

/**
 * Entity types for OpenAEV platform
 * When adding new entity types, update the registry's entityTypes array as well
 */
export type OAEVEntityType = 'Asset' | 'AssetGroup' | 'Player' | 'Team' | 'AttackPattern' | 'Finding' | 'Scenario' | 'Exercise' | 'Organization' | 'User';

/**
 * Generic platform entity type (can be from any platform)
 * The actual type depends on the platform prefix
 */
export type PlatformEntityType = string;

export interface OAEVAsset {
  asset_id: string;
  asset_name: string;
  asset_description?: string;
  asset_hostname?: string;
  asset_ips?: string[];
  // Alternative field names from different API versions/endpoints
  endpoint_id?: string;
  endpoint_name?: string;
  endpoint_hostname?: string;
  endpoint_ips?: string[];
  endpoint_platform?: string;
  asset_platform?: string;
  asset_type?: string;
  asset_tags?: string[];
  asset_last_seen?: string;
}

export interface OAEVAssetGroup {
  asset_group_id: string;
  asset_group_name: string;
  asset_group_description?: string;
  asset_group_assets_number?: number;
  asset_group_tags?: string[];
}

export interface OAEVPlayer {
  user_id: string;
  user_email: string;
  user_firstname?: string;
  user_lastname?: string;
  user_phone?: string;
  user_organization?: string;
  user_teams?: string[];
}

export interface OAEVTeam {
  team_id: string;
  team_name: string;
  team_description?: string;
  team_users_number?: number;
  team_tags?: string[];
}

export interface OAEVAttackPattern {
  attack_pattern_id: string;
  attack_pattern_name: string;
  attack_pattern_external_id: string; // External technique ID (e.g., T1059)
  attack_pattern_description?: string;
  attack_pattern_platforms?: string[];
  attack_pattern_kill_chain_phases?: string[];
}

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
export interface DetectedPlatformEntity {
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
// OpenCTI Entity Types
// ============================================================================

export interface BaseEntity {
  id: string;
  standard_id: string;
  entity_type: string;
  parent_types: string[];
  created_at: string;
  updated_at: string;
  created?: string;
  modified?: string;
}

export interface MarkingDefinition {
  id: string;
  definition_type: string;
  definition: string;
  x_opencti_order: number;
  x_opencti_color: string;
}

export interface Label {
  id: string;
  value: string;
  color: string;
}

export interface Identity extends BaseEntity {
  name: string;
  description?: string;
  identity_class: string;
  x_opencti_aliases?: string[];
}

export interface ExternalReference {
  id: string;
  source_name: string;
  description?: string;
  url?: string;
  external_id?: string;
}

export interface StixCyberObservable extends BaseEntity {
  observable_value: string;
  x_opencti_description?: string;
  x_opencti_score?: number;
  objectMarking?: MarkingDefinition[];
  objectLabel?: Label[];
  createdBy?: Identity;
  indicators?: Indicator[];
  // Type-specific fields
  value?: string;
  name?: string;
  hashes?: Record<string, string>;
}

export interface StixDomainObject extends BaseEntity {
  name: string;
  description?: string;
  aliases?: string[];
  x_opencti_aliases?: string[];
  objectMarking?: MarkingDefinition[];
  objectLabel?: Label[];
  createdBy?: Identity;
  externalReferences?: ExternalReference[];
  confidence?: number;
  revoked?: boolean;
  // Images
  x_opencti_files?: FileData[];
  // Type-specific fields
  first_seen?: string;
  last_seen?: string;
  goals?: string[];
  resource_level?: string;
  primary_motivation?: string;
  secondary_motivations?: string[];
  threat_actor_types?: string[];
  malware_types?: string[];
  is_family?: boolean;
  // Vulnerability specific
  x_opencti_cvss_base_score?: number;
  x_opencti_cvss_base_severity?: string;
  x_opencti_epss_score?: number;
  x_opencti_cisa_kev?: boolean;
}

export interface Indicator extends BaseEntity {
  name: string;
  description?: string;
  pattern: string;
  pattern_type: string;
  valid_from?: string;
  valid_until?: string;
  x_opencti_score?: number;
  x_opencti_main_observable_type?: string;
}

export interface FileData {
  id: string;
  name: string;
  metaData?: {
    mimetype?: string;
  };
}

// ============================================================================
// Container Types
// ============================================================================

export type ContainerType = 'Report' | 'Case-Incident' | 'Case-Rfi' | 'Case-Rft' | 'Grouping';

export interface ContainerCreateInput {
  type: ContainerType;
  name: string;
  description?: string;
  content?: string;
  published?: string;
  // Report-specific
  report_types?: string[];
  // Grouping-specific (mandatory)
  context?: string;
  // Case-specific
  severity?: string;
  priority?: string;
  response_types?: string[];
  // Common fields
  objects?: string[];
  objectMarking?: string[];
  objectLabel?: string[];
  createdBy?: string;
  externalReferences?: ExternalReferenceInput[];
}

export interface ExternalReferenceInput {
  source_name: string;
  description?: string;
  url?: string;
  external_id?: string;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface GraphQLResponse<T> {
  data?: T;
  errors?: GraphQLError[];
}

export interface GraphQLError {
  message: string;
  name?: string;
  data?: Record<string, unknown>;
}

export interface PlatformInfo {
  version: string;
  enterprise_edition?: boolean;
  me?: {
    name?: string;
    user_email?: string;
  };
  settings?: {
    platform_theme?: string;
    platform_title?: string;
  };
}

// ============================================================================
// Theme Types (from OpenCTI platform)
// ============================================================================

export interface OpenCTITheme {
  id: string;
  name: string;
  theme_background: string;
  theme_paper: string;
  theme_nav: string;
  theme_primary: string;
  theme_secondary: string;
  theme_accent: string;
  theme_text_color: string;
  theme_logo?: string | null;
  theme_logo_collapsed?: string | null;
  theme_logo_login?: string | null;
}

export interface PlatformSettings {
  platform_title?: string;
  platform_theme?: OpenCTITheme;
  platform_url?: string;
}

// ============================================================================
// Investigation (Workbench) Types
// ============================================================================

export interface InvestigationCreateInput {
  name: string;
  description?: string;
  investigated_entities_ids?: string[];
}

export interface Investigation {
  id: string;
  name: string;
  description?: string;
  type: 'investigation';
  investigated_entities_ids?: string[];
  created_at: string;
  updated_at: string;
}

export interface SearchResult {
  id: string;
  entity_type: string;
  name?: string;
  observable_value?: string;
  x_opencti_score?: number;
  objectMarking?: MarkingDefinition[];
}

// ============================================================================
// OpenAEV Scenario Types
// ============================================================================

export interface OAEVScenarioInput {
  scenario_name: string;
  scenario_description?: string;
  scenario_subtitle?: string;
  scenario_category?: string;
  scenario_tags?: string[];
}

export interface OAEVScenario {
  scenario_id: string;
  scenario_name: string;
  scenario_description?: string;
  scenario_subtitle?: string;
  scenario_category?: string;
  scenario_created_at?: string;
  scenario_updated_at?: string;
}

export interface OAEVKillChainPhase {
  phase_id: string;
  phase_kill_chain_name: string;
  phase_name: string;
  phase_order: number;
}

export interface OAEVInjectorContract {
  injector_contract_id: string;
  injector_contract_labels?: Record<string, string>;
  injector_contract_platforms?: string[];
  injector_contract_attack_patterns?: string[];
  injector_contract_kill_chain_phases?: string[];
  injector_contract_content?: string;
  injector_contract_payload_type?: string;
  injector_name?: string;
  injector_type?: string;
}

export interface OAEVInjectInput {
  inject_title: string;
  inject_description?: string;
  inject_injector_contract: string;
  inject_content?: Record<string, any>;
  inject_depends_duration?: number; // Duration in seconds from scenario start
  inject_depends_on?: string; // ID of the inject this depends on
}

export interface ScenarioOverviewAttackPattern {
  id: string;
  name: string;
  externalId: string;
  description?: string;
  killChainPhases: string[];
  contracts: OAEVInjectorContract[];
}

export interface ScenarioOverviewData {
  attackPatterns: ScenarioOverviewAttackPattern[];
  killChainPhases: OAEVKillChainPhase[];
  pageTitle: string;
  pageUrl: string;
  pageDescription: string;
}

// ============================================================================
// Message Types (for extension communication)
// ============================================================================

export type MessageType =
  | 'SCAN_PAGE'
  | 'SCAN_RESULT'
  | 'HIGHLIGHT_OBSERVABLE'
  | 'SHOW_ENTITY_PANEL'
  | 'HIDE_PANEL'
  | 'ADD_OBSERVABLE'
  | 'ADD_OBSERVABLES_BULK'
  | 'CREATE_CONTAINER'
  | 'CREATE_INVESTIGATION'
  | 'ADD_TO_INVESTIGATION'
  | 'GET_SETTINGS'
  | 'SAVE_SETTINGS'
  | 'TEST_CONNECTION'
  | 'TEST_OPENAEV_CONNECTION'
  | 'TEST_PLATFORM_CONNECTION'
  | 'TEST_PLATFORM_CONNECTION_TEMP'
  | 'GET_ENTITY_DETAILS'
  | 'SEARCH_ENTITIES'
  | 'SEARCH_ASSETS'
  | 'GENERATE_SCENARIO'
  | 'GET_PLATFORM_THEME'
  | 'GET_PLATFORM_SETTINGS'
  | 'REFRESH_SDO_CACHE'
  | 'GET_SDO_CACHE_STATS'
  | 'SELECTION_CHANGED'
  | 'SHOW_PREVIEW_PANEL'
  | 'PREVIEW_SELECTION'
  | 'SHOW_BULK_IMPORT_PANEL'
  | 'OPEN_SEARCH_PANEL'
  | 'OPEN_OAEV_SEARCH_PANEL'
  | 'SHOW_SEARCH_PANEL'
  | 'SHOW_OAEV_SEARCH_PANEL'
  | 'SEARCH_OAEV'
  | 'SHOW_CONTAINER_PANEL'
  | 'SHOW_INVESTIGATION_PANEL'
  | 'GET_PANEL_STATE'
  | 'FETCH_LABELS'
  | 'FETCH_MARKINGS'
  | 'CREATE_OBSERVABLES_BULK'
  | 'CREATE_INVESTIGATION_WITH_ENTITIES'
  | 'GET_LABELS_AND_MARKINGS'
  | 'FETCH_ENTITY_CONTAINERS'
  | 'FIND_CONTAINERS_BY_URL'
  | 'FETCH_VOCABULARY'
  | 'FETCH_IDENTITIES'
  | 'GET_CACHE_REFRESH_STATUS'
  | 'CLEAR_SDO_CACHE'
  | 'CLEAR_OAEV_CACHE'
  | 'CREATE_WORKBENCH'
  | 'SCAN_OAEV'
  | 'GET_OAEV_ENTITY_DETAILS'
  // Atomic Testing
  | 'SCAN_ATOMIC_TESTING'
  | 'SHOW_ATOMIC_TESTING_PANEL'
  | 'ATOMIC_TESTING_SCAN_RESULTS'
  | 'ATOMIC_TESTING_SELECT'
  | 'FETCH_INJECTOR_CONTRACTS'
  | 'FETCH_OAEV_ASSETS'
  | 'FETCH_OAEV_ASSET_GROUPS'
  | 'FETCH_OAEV_TEAMS'
  | 'CREATE_OAEV_PAYLOAD'
  | 'FETCH_OAEV_PAYLOAD'
  | 'FIND_DNS_RESOLUTION_PAYLOAD'
  | 'FIND_INJECTOR_CONTRACT_BY_PAYLOAD'
  | 'CREATE_ATOMIC_TESTING'
  // Content Script Injection
  | 'INJECT_CONTENT_SCRIPT'
  | 'INJECT_ALL_TABS'
  | 'PING'
  // AI Features
  | 'AI_GENERATE_DESCRIPTION'
  | 'AI_GENERATE_SCENARIO'
  | 'AI_GENERATE_ATOMIC_TEST'
  | 'AI_GENERATE_EMAILS'
  | 'AI_CHECK_STATUS'
  // Scenario Generation
  | 'OPEN_SCENARIO_PANEL'
  | 'SHOW_SCENARIO_PANEL'
  | 'CREATE_SCENARIO'
  | 'FETCH_SCENARIO_OVERVIEW'
  | 'FETCH_KILL_CHAIN_PHASES'
  | 'FETCH_INJECTOR_CONTRACTS_FOR_ATTACK_PATTERNS'
  | 'ADD_INJECT_TO_SCENARIO'
  | 'CREATE_SCENARIO_FROM_PAGE'
  // Unified scan
  | 'SCAN_ALL'
  // AI model management
  | 'AI_TEST_AND_FETCH_MODELS';

export interface ExtensionMessage {
  type: MessageType;
  payload?: unknown;
}

export interface ScanPagePayload {
  url: string;
  title: string;
  content: string;
}

export interface ScanResultPayload {
  /** OpenCTI observables detected */
  observables: DetectedObservable[];
  /** OpenCTI SDOs (STIX Domain Objects) detected */
  sdos: DetectedSDO[];
  /** CVEs (Vulnerabilities) - separate array for special handling */
  cves?: DetectedSDO[];
  /** 
   * Platform entities detected (non-OpenCTI platforms like OpenAEV)
   * Each entity has a type with platform prefix (e.g., 'oaev-Asset')
   */
  platformEntities?: DetectedPlatformEntity[];
  scanTime: number;
  url: string;
}

export interface ShowEntityPanelPayload {
  /** 
   * Entity source type
   * 'observable' and 'sdo' are for OpenCTI
   * 'platform' is for any non-default platform (identified by entity type prefix)
   */
  entityType: 'observable' | 'sdo' | 'platform';
  entity: DetectedObservable | DetectedSDO | DetectedPlatformEntity;
}

export interface AddObservablePayload {
  type: ObservableType;
  value: string;
  hashType?: HashType;
  createIndicator?: boolean;
}

export interface CreateContainerPayload {
  type: ContainerType;
  name: string;
  description?: string;
  content?: string;
  pageUrl: string;
  pageTitle: string;
  observableIds?: string[];
  generatePdf?: boolean;
}

// ============================================================================
// UI State Types
// ============================================================================

export interface ScanState {
  isScanning: boolean;
  lastScanTime?: string;
  results?: ScanResultPayload;
  error?: string;
}

export interface PanelState {
  isOpen: boolean;
  entity?: DetectedObservable | DetectedSDO | DetectedPlatformEntity;
  entityDetails?: StixCyberObservable | StixDomainObject | OAEVAsset;
  loading: boolean;
}

// ============================================================================
// Atomic Testing Types (OpenAEV)
// ============================================================================

export interface InjectorContract {
  injector_contract_id: string;
  injector_contract_labels?: Record<string, string>;
  injector_contract_injector_type?: string;
  injector_contract_injector?: {
    injector_id: string;
    injector_name: string;
    injector_type: string;
  };
  injector_contract_payload_type?: string;
  injector_contract_platforms?: string[];
  // NOTE: This is a List<String> of attack pattern UUIDs from OpenAEV API, not objects!
  injector_contract_attack_patterns?: string[];
  injector_contract_content?: any;
}

export interface AtomicTestingInput {
  inject_title: string;
  inject_description?: string;
  inject_injector_contract: string;
  inject_content?: Record<string, any>;
  inject_teams?: string[];
  inject_assets?: string[];
  inject_asset_groups?: string[];
  inject_all_teams?: boolean;
  inject_tags?: string[];
}

export interface PayloadCreateInput {
  payload_type: 'Command' | 'Executable' | 'FileDrop' | 'DnsResolution' | 'NetworkTraffic';
  payload_name: string;
  payload_source: 'COMMUNITY' | 'FILIGRAN' | 'MANUAL';
  payload_status: 'VERIFIED' | 'UNVERIFIED' | 'DEPRECATED';
  payload_platforms: string[];
  payload_execution_arch?: 'ALL_ARCHITECTURES' | 'x86_64' | 'arm64';
  payload_expectations?: string[];
  payload_description?: string;
  dns_resolution_hostname?: string;
  payload_attack_patterns?: string[];
  payload_tags?: string[];
}

export interface OAEVPayload {
  payload_id: string;
  payload_name: string;
  payload_type: string;
  payload_platforms: string[];
  payload_injector_contract?: InjectorContract;
}

export interface AtomicTestingResult {
  inject_id: string;
  inject_title: string;
  inject_type: string;
  inject_status?: {
    name: string;
    label: string;
  };
}

// Atomic testing scan detection
export interface DetectedAtomicTarget {
  id: string;
  type: 'attack-pattern' | 'domain' | 'hostname';
  name: string;
  value: string;
  platformId: string;
  platformName: string;
  // For attack patterns - linked injector contracts
  injectorContracts?: InjectorContract[];
  // Original entity data if from cache
  entityData?: OAEVAttackPattern;
}
