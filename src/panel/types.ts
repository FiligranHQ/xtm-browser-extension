/**
 * Panel Types
 * Centralized type definitions for the panel component
 */

// Panel modes
export type PanelMode =
  | 'empty'
  | 'loading'
  | 'entity'
  | 'not-found'
  | 'add'
  | 'preview'
  | 'platform-select'
  | 'container-type'
  | 'container-form'
  | 'investigation'
  | 'search'
  | 'search-results'
  | 'existing-containers'
  | 'atomic-testing'
  | 'unified-search'
  | 'import-results'
  | 'scan-results'
  | 'scenario-overview'
  | 'scenario-form'
  | 'add-selection';

// Platform match in scan results
export interface ScanResultPlatformMatch {
  platformId: string;
  platformType: 'opencti' | 'openaev';
  entityId?: string;
  entityData?: unknown;
  type: string;
}

// Scan result entity
export interface ScanResultEntity {
  id: string;
  type: string;
  name: string;
  value?: string;
  found: boolean;
  entityId?: string;
  platformId?: string;
  platformType?: 'opencti' | 'openaev';
  entityData?: unknown;
  platformMatches?: ScanResultPlatformMatch[];
  discoveredByAI?: boolean;
  aiReason?: string;
  aiConfidence?: 'high' | 'medium' | 'low';
}

// Import results statistics
export interface ImportResults {
  success: boolean;
  total: number;
  created: Array<{ id: string; type: string; value: string }>;
  failed: Array<{ type: string; value: string; error?: string }>;
  platformName: string;
}

// Entity data from platform
export interface EntityData {
  id?: string;
  type?: string;
  name?: string;
  description?: string;
  confidence?: number;
  created?: string;
  modified?: string;
  created_at?: string;
  updated_at?: string;
  value?: string;
  existsInPlatform?: boolean;
  aliases?: string[];
  x_opencti_score?: number;
  entity_type?: string;
  standard_id?: string;
  objectMarking?: Array<{ definition: string; x_opencti_color?: string }>;
  objectLabel?: Array<{ value: string; color: string }>;
  createdBy?: { id: string; name: string };
  creators?: Array<{ id: string; name: string }>;
  representative?: { main?: string };
  // Vulnerability CVSS fields
  x_opencti_cvss_base_score?: number;
  x_opencti_cvss_base_severity?: string;
  x_opencti_cvss_attack_vector?: string;
  x_opencti_cisa_kev?: boolean;
  x_opencti_epss_score?: number;
  x_opencti_epss_percentile?: number;
  // Threat Actor fields
  first_seen?: string;
  last_seen?: string;
  goals?: string[];
  // Malware fields
  malware_types?: string[];
  is_family?: boolean;
  // Multi-platform support
  _platformId?: string;
  _platformType?: string;
  _isNonDefaultPlatform?: boolean;
  platformId?: string;
  // Allow additional properties
  [key: string]: unknown;
}

// Container data
export interface ContainerData {
  id: string;
  entity_type: string;
  name: string;
  created: string;
  modified: string;
  createdBy?: { id: string; name: string };
  description?: string;
  _platformId?: string;
}

// Search result extends EntityData
export interface SearchResult extends EntityData {
  _platformId?: string;
}

// Platform info
export interface PlatformInfo {
  id: string;
  name: string;
  url: string;
  version?: string;
  isEnterprise?: boolean;
  type?: 'opencti' | 'openaev';
}

// Unified search result
export interface UnifiedSearchResult {
  id: string;
  type: string;
  name: string;
  description?: string;
  source: 'opencti' | 'openaev';
  platformId: string;
  platformName: string;
  entityId?: string;
  entityData?: unknown;
  data?: Record<string, unknown>;
}

// Merged search result (for grouping across platforms)
export interface MergedSearchResult {
  representativeKey: string;
  name: string;
  type: string;
  platforms: Array<{
    platformId: string;
    platformName: string;
    result: SearchResult;
  }>;
}

// AI settings
export interface AISettings {
  enabled: boolean;
  provider?: string;
  available: boolean;
}

// Resolved relationship from AI
export interface ResolvedRelationship {
  fromIndex: number;
  toIndex: number;
  relationshipType: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  excerpt?: string;
}

// Container specific fields
export interface ContainerSpecificFields {
  report_types: string[];
  context: string;
  severity: string;
  priority: string;
  response_types: string[];
  createdBy: string;
}

// Scenario form data
export interface ScenarioFormData {
  name: string;
  description: string;
  subtitle: string;
  category: string;
}

// Selected inject for scenario
export interface SelectedInject {
  attackPatternId: string;
  attackPatternName: string;
  contractId: string;
  contractLabel: string;
  delayMinutes: number;
}

// Scenario email content
export interface ScenarioEmail {
  attackPatternId: string;
  subject: string;
  body: string;
}

// Scenario overview data
export interface ScenarioOverviewData {
  attackPatterns: Array<{
    id: string;
    name: string;
    externalId: string;
    description?: string;
    killChainPhases: string[];
    contracts: unknown[];
  }>;
  killChainPhases: Array<{
    phase_id: string;
    phase_kill_chain_name: string;
    phase_name: string;
    phase_order: number;
  }>;
  pageTitle: string;
  pageUrl: string;
  pageDescription: string;
}

// Atomic testing target
export interface AtomicTestingTarget {
  type: string;
  value: string;
  name: string;
  entityId?: string;
  platformId?: string;
  data?: unknown;
}

// AI generated payload for atomic testing
export interface AIGeneratedPayload {
  name: string;
  description: string;
  executor: string;
  command: string;
  cleanupCommand?: string;
  cleanupExecutor?: string;
  platform: string;
}

// AI generated scenario
export interface AIGeneratedScenario {
  name: string;
  description: string;
  subtitle?: string;
  category?: string;
  injects: Array<{
    title: string;
    description: string;
    type: string;
    content?: string;
    executor?: string;
    delayMinutes?: number;
    subject?: string;
    body?: string;
  }>;
}

// Container form state
export interface ContainerFormState {
  name: string;
  description: string;
  content: string;
}

// Multi-platform result for navigation
export interface MultiPlatformResult {
  platformId: string;
  platformName: string;
  entity: EntityData;
}

// AI settings state
export interface AISettingsState {
  enabled: boolean;
  provider?: string;
  available: boolean;
}

// Label option for autocomplete
export interface LabelOption {
  id: string;
  value: string;
  color: string;
}

// Marking option for autocomplete
export interface MarkingOption {
  id: string;
  definition: string;
}

// Vocabulary option for dropdowns
export interface VocabularyOption {
  id: string;
  name: string;
}

// Author option for autocomplete
export interface AuthorOption {
  id: string;
  name: string;
  entity_type: string;
}

// Investigation entity
export interface InvestigationEntity {
  id: string;
  type: string;
  value: string;
  name?: string;
  standard_id?: string;
}

// OpenAEV search result
export interface OAEVSearchResult {
  id: string;
  type: string;
  name: string;
  description?: string;
  platformId?: string;
  entityData?: unknown;
}

// Raw attack pattern from scan
export interface RawAttackPattern {
  id: string;
  entityId: string;
  name: string;
  externalId?: string;
  description?: string;
  killChainPhases?: string[];
  platformId?: string;
}