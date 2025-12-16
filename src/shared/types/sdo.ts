/**
 * OpenCTI Entity Types
 * 
 * Types for OpenCTI entities (STIX Domain Objects) and detection
 */

import type { StixDomainObject } from './stix';
import type { PlatformMatch } from './observable';

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
  entityData?: StixDomainObject;
  aliases?: string[];
  x_mitre_id?: string;
  platformId?: string;
  // All platforms where this entity was found (for multi-platform navigation)
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
  entityData?: StixDomainObject;
  platformId: string;
}

// Legacy aliases for backward compatibility during migration
/** @deprecated Use OCTIEntityType instead */
export type SDOType = OCTIEntityType;
/** @deprecated Use DetectedOCTIEntity instead */
export type DetectedSDO = DetectedOCTIEntity;
/** @deprecated Use OCTIEntityMatch instead */
export type SDOMatch = OCTIEntityMatch;

