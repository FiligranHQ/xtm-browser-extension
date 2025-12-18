// ============================================================================
// Configuration Types
// ============================================================================

import { PlatformType } from '../platform/registry';
import type { 
  DetectedOAEVEntity,
  OAEVAsset,
  OAEVAttackPattern,
} from './openaev';
import type { ScanResultPayload } from './messages';

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
 * Detection settings for scanning
 * Uses "disabled" arrays (empty = all enabled by default)
 * 
 * Types are organized as:
 * - Observable Types: IPs, domains, hashes, etc.
 * - OpenCTI Types: Threat Actors, Malware, etc.
 * - OpenAEV Types: Assets, Teams, Players, etc.
 */
export interface DetectionSettings {
  /** Observable Types to EXCLUDE from detection */
  disabledObservableTypes?: string[];
  /** OpenCTI Types to EXCLUDE from detection */
  disabledOpenCTITypes?: string[];
  /** OpenAEV Types to EXCLUDE from detection */
  disabledOpenAEVTypes?: string[];
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
  theme: 'light' | 'dark' | 'auto';
  autoScan: boolean;
  highlightColor?: string;
  showNotifications: boolean;
  detection?: DetectionSettings;
  // AI configuration (available only with EE platforms)
  ai?: AISettings;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  openctiPlatforms: [],
  openaevPlatforms: [],
  theme: 'dark',
  autoScan: false,
  showNotifications: true,
  detection: {
    // Empty disabled arrays = all types enabled by default
    disabledObservableTypes: [],
    disabledOpenCTITypes: [],
    disabledOpenAEVTypes: [],
  },
  ai: {
    // AI settings - no default provider/key
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
  entityData?: OCTIStixCyberObservable | OCTIStixDomainObject | Record<string, unknown>;
  /** Platform type identifier (e.g., 'opencti', 'openaev') */
  platformType?: 'opencti' | 'openaev' | string;
  /** Entity type (for display in multi-type results) */
  type?: string;
}

// ============================================================================
// Multi-Platform Enrichment Types
// ============================================================================
// These types support cross-platform entity enrichment (e.g., CVE/Vulnerability
// found in both OpenCTI and OpenAEV, or future Observable enrichment in OpenAEV)

/**
 * Supported platform types for enrichment
 */
export type EnrichmentPlatformType = 'opencti' | 'openaev';

/**
 * A single platform match result from enrichment
 */
export interface EnrichmentMatch {
  /** Platform identifier (e.g., 'opencti-prod', 'openaev-dev') */
  platformId: string;
  /** Platform type */
  platformType: EnrichmentPlatformType;
  /** Entity ID in the platform */
  entityId: string;
  /** Entity type in the platform (e.g., 'Vulnerability', 'oaev-Vulnerability') */
  entityType: string;
  /** Raw entity data from the platform */
  entityData: Record<string, unknown>;
}

/**
 * Enrichable entity categories - for future multi-platform enrichment routing
 */
export type EnrichableEntityCategory = 'vulnerability' | 'observable';

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
  entityData?: OCTIStixCyberObservable;
  platformId?: string;
  /** All platforms where this entity was found (for multi-platform navigation) */
  platformMatches?: PlatformMatch[];
}

// ============================================================================
// OpenCTI Entity Types
// ============================================================================

export type OCTIEntityType =
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

export interface DetectedOCTIEntity {
  type: OCTIEntityType;
  name: string;
  aliases?: string[];
  startIndex: number;
  endIndex: number;
  found: boolean;
  entityId?: string;
  entityData?: OCTIStixDomainObject;
  platformId?: string;
  // The actual text that was matched (may differ from name if matched via alias or x_mitre_id)
  matchedValue?: string;
  // All platforms where this entity was found (for multi-platform navigation)
  platformMatches?: PlatformMatch[];
}

// ============================================================================
// OpenAEV Entity Types (re-exported from ./openaev.ts)
// ============================================================================

/**
 * Generic platform entity type (can be from any platform)
 * The actual type depends on the platform prefix
 */
export type PlatformEntityType = string;

// ============================================================================
// OpenCTI Entity Types
// ============================================================================

export interface OCTIBaseEntity {
  id: string;
  standard_id: string;
  entity_type: string;
  parent_types: string[];
  created_at: string;
  updated_at: string;
  created?: string;
  modified?: string;
}

export interface OCTIMarkingDefinition {
  id: string;
  definition_type: string;
  definition: string;
  x_opencti_order: number;
  x_opencti_color: string;
}

export interface OCTILabel {
  id: string;
  value: string;
  color: string;
}

export interface OCTIIdentity extends OCTIBaseEntity {
  name: string;
  description?: string;
  identity_class: string;
  x_opencti_aliases?: string[];
}

export interface OCTIExternalReference {
  id: string;
  source_name: string;
  description?: string;
  url?: string;
  external_id?: string;
}

export interface OCTIStixCyberObservable extends OCTIBaseEntity {
  observable_value: string;
  x_opencti_description?: string;
  x_opencti_score?: number;
  objectMarking?: OCTIMarkingDefinition[];
  objectLabel?: OCTILabel[];
  createdBy?: OCTIIdentity;
  indicators?: OCTIIndicator[];
  // Type-specific fields
  value?: string;
  name?: string;
  hashes?: Record<string, string>;
}

export interface OCTIStixDomainObject extends OCTIBaseEntity {
  name: string;
  description?: string;
  aliases?: string[];
  x_opencti_aliases?: string[];
  objectMarking?: OCTIMarkingDefinition[];
  objectLabel?: OCTILabel[];
  createdBy?: OCTIIdentity;
  externalReferences?: OCTIExternalReference[];
  confidence?: number;
  revoked?: boolean;
  // Images
  x_opencti_files?: OCTIFileData[];
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

export interface OCTIIndicator extends OCTIBaseEntity {
  name: string;
  description?: string;
  pattern: string;
  pattern_type: string;
  valid_from?: string;
  valid_until?: string;
  x_opencti_score?: number;
  x_opencti_main_observable_type?: string;
}

export interface OCTIFileData {
  id: string;
  name: string;
  metaData?: {
    mimetype?: string;
  };
}


// ============================================================================
// OpenCTI Container Types
// ============================================================================

export type OCTIContainerType = 'Report' | 'Case-Incident' | 'Case-Rfi' | 'Case-Rft' | 'Grouping';

export interface OCTIContainerCreateInput {
  type: OCTIContainerType;
  name: string;
  description?: string;
  content?: string;
  published?: string; // For Report type - to avoid duplicates during update
  created?: string; // For non-Report types - to avoid duplicates during update
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
  externalReferences?: OCTIExternalReferenceInput[];
  // Draft mode - creates container in a new draft workspace
  createAsDraft?: boolean;
}

export interface OCTIExternalReferenceInput {
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
    platform_title?: string;
  };
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

export interface OCTISearchResult {
  id: string;
  entity_type: string;
  name?: string;
  observable_value?: string;
  x_opencti_score?: number;
  objectMarking?: OCTIMarkingDefinition[];
}

// ============================================================================
// OpenAEV Types (re-exported from ./openaev.ts)
// - Scenario types: OAEVScenarioInput, OAEVScenario, SCENARIO_*_OPTIONS
// - Asset types: OAEVAsset, OAEVAssetGroup, OAEVTeam, OAEVPlatform, OAEVArch
// - Inject types: OAEVKillChainPhase, OAEVInjectorContract, OAEVInjectInput
// - Overview types: ScenarioOverviewAttackPattern, ScenarioOverviewData
// ============================================================================

// ============================================================================
// Message Types (imported from ./messages.ts)
// ============================================================================

// Message types are in ./messages.ts - import directly from there

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
  entity?: DetectedObservable | DetectedOCTIEntity | DetectedOAEVEntity;
  entityDetails?: OCTIStixCyberObservable | OCTIStixDomainObject | OAEVAsset;
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
  injector_contract_content?: Record<string, unknown>;
}

export interface AtomicTestingInput {
  inject_title: string;
  inject_description?: string;
  inject_injector_contract: string;
  inject_content?: Record<string, unknown>;
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
