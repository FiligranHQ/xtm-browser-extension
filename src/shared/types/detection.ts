/**
 * Detection Types
 * 
 * Types related to entity detection and matching.
 */

import type { StixCyberObservable, StixDomainObject } from './index';

// ============================================================================
// Observable Detection Types
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
// OpenCTI Entity Detection Types
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
  entityData?: StixDomainObject;
  platformId?: string;
  // The actual text that was matched (may differ from name if matched via alias or x_mitre_id)
  matchedValue?: string;
  // All platforms where this entity was found (for multi-platform navigation)
  platformMatches?: PlatformMatch[];
}

// Legacy aliases for backward compatibility
/** @deprecated Use OCTIEntityType instead */
export type SDOType = OCTIEntityType;
/** @deprecated Use DetectedOCTIEntity instead */
export type DetectedSDO = DetectedOCTIEntity;

// ============================================================================
// Platform Entity Detection Types
// ============================================================================

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

