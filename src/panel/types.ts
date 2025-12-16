/**
 * Panel Types
 * 
 * Type definitions for the panel component state and data structures.
 */

import type { PlatformType } from '../shared/platform';

// Panel Mode Types
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
  | 'oaev-search' 
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

// Entity data structure
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

// Multi-platform result
export interface MultiPlatformResult {
  platformId: string;
  platformName: string;
  entity: EntityData;
}

// Merged search result
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

// Unified search result
export interface UnifiedSearchResult {
  id: string;
  name: string;
  type: string;
  description?: string;
  source: 'opencti' | 'openaev';
  platformId: string;
  platformName: string;
  entityId: string;
  data?: Record<string, unknown>;
}

// Container form state
export interface ContainerFormState {
  name: string;
  description: string;
  content: string;
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

// AI settings state
export interface AISettingsState {
  enabled: boolean;
  provider?: string;
  available: boolean;
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

// Selected inject
export interface SelectedInject {
  attackPatternId: string;
  attackPatternName: string;
  contractId: string;
  contractLabel: string;
  delayMinutes: number;
}

// Scenario email
export interface ScenarioEmail {
  attackPatternId: string;
  subject: string;
  body: string;
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

// Resolved relationship
export interface ResolvedRelationship {
  fromIndex: number;
  toIndex: number;
  relationshipType: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  excerpt?: string;
}

// Investigation entity
export interface InvestigationEntity {
  id: string;
  type: string;
  name: string;
  value?: string;
  platformId?: string;
  selected: boolean;
}

// Atomic testing target
export interface AtomicTestingTarget {
  id?: string;
  entityId?: string;
  name: string;
  type: string;
  data?: unknown;
}

// Label option
export interface LabelOption {
  id: string;
  value: string;
  color: string;
}

// Marking option
export interface MarkingOption {
  id: string;
  definition: string;
}

// Vocabulary option
export interface VocabularyOption {
  id: string;
  name: string;
}

// Author option
export interface AuthorOption {
  id: string;
  name: string;
  entity_type: string;
}

// Toast options
export interface ToastOptions {
  type: 'success' | 'info' | 'warning' | 'error';
  message: string;
  action?: { label: string; type: 'scroll_to_first' | 'close_panel' | 'custom' };
  persistent?: boolean;
  duration?: number;
}

