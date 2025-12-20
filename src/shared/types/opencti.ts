/**
 * OpenCTI Types
 * 
 * All OpenCTI-specific types including STIX objects, entity definitions, containers,
 * and GraphQL API types. All types are prefixed with OCTI for consistency with 
 * OpenAEV (OAEV*) types.
 */

// ============================================================================
// GraphQL API Types
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

// ============================================================================
// Platform Info
// ============================================================================

export interface OCTIPlatformInfo {
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
  | 'Indicator'
  | 'Narrative'
  | 'Channel'
  | 'System';

// ============================================================================
// STIX Base Types
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

export interface OCTIFileData {
  id: string;
  name: string;
  metaData?: {
    mimetype?: string;
  };
}

// ============================================================================
// STIX Cyber Observables (SCO)
// ============================================================================

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

// ============================================================================
// STIX Domain Objects (SDO)
// ============================================================================

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

// ============================================================================
// Detection Types
// ============================================================================

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
  matchedValue?: string;
  platformMatches?: PlatformMatch[];
}

// Import PlatformMatch for DetectedOCTIEntity
import type { PlatformMatch } from './platform';

// ============================================================================
// Container Types
// ============================================================================

export type OCTIContainerType = 'Report' | 'Case-Incident' | 'Case-Rfi' | 'Case-Rft' | 'Grouping';

export interface OCTIContainerCreateInput {
  type: OCTIContainerType;
  name: string;
  description?: string;
  content?: string;
  published?: string;
  created?: string;
  report_types?: string[];
  context?: string;
  severity?: string;
  priority?: string;
  response_types?: string[];
  objects?: string[];
  objectMarking?: string[];
  objectLabel?: string[];
  createdBy?: string;
  externalReferences?: OCTIExternalReferenceInput[];
  createAsDraft?: boolean;
}

export interface OCTIExternalReferenceInput {
  source_name: string;
  description?: string;
  url?: string;
  external_id?: string;
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

// ============================================================================
// Search Types
// ============================================================================

export interface OCTISearchResult {
  id: string;
  entity_type: string;
  name?: string;
  observable_value?: string;
  x_opencti_score?: number;
  objectMarking?: OCTIMarkingDefinition[];
}
