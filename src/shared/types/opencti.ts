/**
 * OpenCTI Types
 * 
 * All OpenCTI-specific types including STIX objects and entity definitions.
 * All types are prefixed with OCTI for consistency with OpenAEV (OAEV*) types.
 */

import type { PlatformMatch } from './index';

// ============================================================================
// STIX Base Types
// ============================================================================

/**
 * Base STIX object interface
 */
export interface OCTIStixBaseObject {
  id: string;
  standard_id?: string;
  entity_type: string;
  created?: string;
  modified?: string;
  revoked?: boolean;
  confidence?: number;
  lang?: string;
  labels?: Array<{ id: string; value: string; color?: string }>;
  objectMarking?: Array<{ id: string; definition?: string; definition_type?: string; x_opencti_color?: string }>;
  createdBy?: { id: string; name?: string; entity_type?: string };
  objectLabel?: Array<{ id: string; value: string; color?: string }>;
}

/**
 * STIX Cyber Observable (SCO)
 */
export interface OCTIStixCyberObservable extends OCTIStixBaseObject {
  observable_value: string;
  value?: string;
  x_opencti_score?: number;
  x_opencti_description?: string;
  // Hash-specific fields
  hashes?: {
    MD5?: string;
    'SHA-1'?: string;
    'SHA-256'?: string;
    'SHA-512'?: string;
    SSDEEP?: string;
  };
  // File-specific fields
  name?: string;
  size?: number;
  mime_type?: string;
  // Network-specific fields
  rir?: string;
  asn?: string;
  // Related indicators
  indicators?: {
    edges?: Array<{
      node?: {
        id: string;
        name?: string;
        pattern?: string;
        valid_from?: string;
        valid_until?: string;
      };
    }>;
  };
}

/**
 * STIX Domain Object (SDO)
 */
export interface OCTIStixDomainObject extends OCTIStixBaseObject {
  name: string;
  aliases?: string[];
  description?: string;
  x_mitre_id?: string;
  first_seen?: string;
  last_seen?: string;
  threat_actor_types?: string[];
  sophistication?: string;
  resource_level?: string;
  primary_motivation?: string;
  secondary_motivations?: string[];
  goals?: string[];
  roles?: string[];
  country?: {
    id: string;
    name?: string;
    x_opencti_aliases?: string[];
  };
  malware_types?: string[];
  is_family?: boolean;
  architecture_execution_envs?: string[];
  implementation_languages?: string[];
  capabilities?: string[];
  kill_chain_phases?: Array<{ kill_chain_name: string; phase_name: string }>;
  x_opencti_base_severity?: string;
  // External references
  externalReferences?: {
    edges?: Array<{
      node?: {
        id: string;
        source_name?: string;
        external_id?: string;
        url?: string;
        description?: string;
      };
    }>;
  };
}

/**
 * STIX Relationship
 */
export interface OCTIStixRelationship extends OCTIStixBaseObject {
  relationship_type: string;
  description?: string;
  start_time?: string;
  stop_time?: string;
  from?: OCTIStixBaseObject;
  to?: OCTIStixBaseObject;
}

// ============================================================================
// Container Types
// ============================================================================

/**
 * OpenCTI container types
 */
export type OCTIContainerType = 'Report' | 'Grouping' | 'Note' | 'Case-Incident' | 'Case-Rfi' | 'Case-Rft';

/**
 * Container create input
 */
export interface OCTIContainerCreateInput {
  type: OCTIContainerType;
  name: string;
  description?: string;
  content?: string;
  objects?: string[];
  objectLabel?: string[];
  objectMarking?: string[];
  report_types?: string[];
  context?: string;
  severity?: string;
  priority?: string;
  response_types?: string[];
  createdBy?: string;
  createAsDraft?: boolean;
  published?: string;
  created?: string;
}

// ============================================================================
// Entity Types
// ============================================================================

/**
 * OpenCTI entity type enum
 */
export type OCTIEntityType =
  | 'Intrusion-Set'
  | 'Malware'
  | 'Threat-Actor'
  | 'Threat-Actor-Group'
  | 'Threat-Actor-Individual'
  | 'Attack-Pattern'
  | 'Campaign'
  | 'Incident'
  | 'Vulnerability'
  | 'Tool'
  | 'Infrastructure'
  | 'Sector'
  | 'Organization'
  | 'Individual'
  | 'Event'
  | 'Country'
  | 'Region'
  | 'City'
  | 'Administrative-Area'
  | 'Position'
  | 'Report'
  | 'Note'
  | 'Grouping'
  | 'Case-Incident'
  | 'Case-Rfi'
  | 'Case-Rft'
  | 'Feedback';

/**
 * Detected OpenCTI entity from page scanning
 */
export interface DetectedOCTIEntity {
  type: OCTIEntityType;
  name: string;
  value: string;
  startIndex: number;
  endIndex: number;
  context?: string;
  found: boolean;
  entityId?: string;
  entityData?: OCTIStixDomainObject;
  aliases?: string[];
  x_mitre_id?: string;
  platformId?: string;
  platformMatches?: PlatformMatch[];
}

/**
 * OpenCTI entity match for detection
 */
export interface OCTIEntityMatch {
  type: OCTIEntityType;
  name: string;
  aliases?: string[];
  x_mitre_id?: string;
  entityId: string;
  entityData?: OCTIStixDomainObject;
  platformId: string;
}

// ============================================================================
// Type Aliases for backward compatibility (deprecated, use OCTI* versions)
// ============================================================================

/** @deprecated Use OCTIStixBaseObject */
export type StixBaseObject = OCTIStixBaseObject;
/** @deprecated Use OCTIStixCyberObservable */
export type StixCyberObservable = OCTIStixCyberObservable;
/** @deprecated Use OCTIStixDomainObject */
export type StixDomainObject = OCTIStixDomainObject;
/** @deprecated Use OCTIStixRelationship */
export type StixRelationship = OCTIStixRelationship;
/** @deprecated Use OCTIContainerType */
export type ContainerType = OCTIContainerType;
/** @deprecated Use OCTIContainerCreateInput */
export type ContainerCreateInput = OCTIContainerCreateInput;
