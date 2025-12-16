/**
 * SDO Types (STIX Domain Objects)
 * 
 * Types for STIX Domain Objects and detection
 */

import type { StixDomainObject } from './stix';
import type { PlatformMatch } from './observable';

/**
 * SDO type enum
 */
export type SDOType =
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
 * Detected SDO from page scanning
 */
export interface DetectedSDO {
  type: SDOType;
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
 * SDO match for detection
 */
export interface SDOMatch {
  type: SDOType;
  name: string;
  aliases?: string[];
  x_mitre_id?: string;
  entityId: string;
  entityData?: StixDomainObject;
  platformId: string;
}

