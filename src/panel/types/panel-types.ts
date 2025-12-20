/**
 * Panel Types
 * Centralized type definitions for the panel component
 * 
 * IMPORTANT: Common types should be defined in shared/types/ and imported here.
 * Only panel-specific types should be defined in this file.
 */

import type { OAEVInjectorContract } from '../../shared/types/openaev';
import type { 
  ScanResultEntity, 
  ScanResultPlatformMatch, 
  ImportResults 
} from '../../shared/types/scan';
import type { 
  GeneratedAtomicTest, 
  GeneratedScenario,
  ResolvedRelationship
} from '../../shared/api/ai/types';

// Re-export shared types used by panel components
export type { ScanResultEntity, ScanResultPlatformMatch, ImportResults };
export type { ResolvedRelationship };

// Type aliases for backward compatibility
export type AIGeneratedPayload = GeneratedAtomicTest;
export type AIGeneratedScenario = GeneratedScenario;

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
  | 'existing-containers'
  | 'atomic-testing'
  | 'unified-search'
  | 'import-results'
  | 'scan-results'
  | 'scenario-overview'
  | 'scenario-form'
  | 'add-selection';

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
  /** Platform instance ID (which platform this entity belongs to) */
  platformId?: string;
  /** Platform type: 'opencti' | 'openaev' */
  platformType?: string;
  /** Flag indicating non-OpenCTI platform (derived from platformType !== 'opencti') */
  isNonDefaultPlatform?: boolean;
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
  /** Platform instance ID */
  platformId?: string;
}

// Search result is equivalent to EntityData (used for search results)
export type SearchResult = EntityData;

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

// AI UI state for the panel (different from shared AISettings which is configuration)
export interface PanelAIState {
  enabled: boolean;
  provider?: string;
  available: boolean;
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
  mainFocus: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// Selected inject for scenario
export interface SelectedInject {
  attackPatternId: string;
  attackPatternName: string;
  contractId: string;
  contractLabel: string;
  delayMinutes: number;
  // Additional fields for AI-generated injects
  title?: string;
  description?: string;
  type?: string;
  content?: string;
  executor?: string;
  subject?: string;
  body?: string;
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
    entityId?: string;
    platformId?: string;
  }>;
  killChainPhases: Array<{
    phase_id: string;
    phase_kill_chain_name: string;
    phase_name: string;
    phase_order: number;
  }>;
  pageTitle?: string;
  pageUrl?: string;
  pageDescription?: string;
}

// Atomic testing target
export interface AtomicTestingTarget {
  type: string;
  value: string;
  name: string;
  entityId?: string;
  platformId?: string;
  data: {
    hasContracts?: boolean;
    contractCount?: number;
    availablePlatforms?: string[];
    attack_pattern_external_id?: string;
    entityId?: string;
    attack_pattern_id?: string;
    id?: string;
    [key: string]: unknown;
  };
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
  platformId?: string;
}

// Investigation entity
export interface InvestigationEntity {
  id: string;
  type: string;
  name?: string;
  value?: string;
  platformId?: string;
  selected: boolean;
  standard_id?: string;
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

// Attack pattern for scenario building (from OpenAEV)
export interface ScenarioAttackPattern {
  id: string;
  name: string;
  externalId?: string;
  description?: string;
  killChainPhases?: string[] | Array<{ phase_name?: string; kill_chain_name?: string }>;
  contracts?: OAEVInjectorContract[];
  entityId?: string;
  platformId?: string;
}

// Email timeline item for scenario form
export interface EmailTimelineItem {
  attackPatternId: string;
  attackPatternName: string;
  externalId?: string;
  killChainPhases?: string[] | Array<{ phase_name?: string }>;
  delayMinutes: number;
}
