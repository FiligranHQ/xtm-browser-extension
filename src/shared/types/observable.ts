/**
 * Observable Types
 * 
 * Types for STIX Cyber Observables (SCOs)
 */

import type { StixCyberObservable, StixDomainObject } from './stix';

/**
 * Observable type enum
 */
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

/**
 * Hash type enum
 */
export type HashType = 'MD5' | 'SHA-1' | 'SHA-256' | 'SHA-512' | 'SSDEEP';

/**
 * Platform match for multi-platform entities
 */
export interface PlatformMatch {
  platformId: string;
  entityId: string;
  entityData?: StixCyberObservable | StixDomainObject;
}

/**
 * Detected observable from page scanning
 */
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

/**
 * Observable regex pattern
 */
export interface ObservablePattern {
  type: ObservableType;
  pattern: RegExp;
  hashType?: HashType;
  validator?: (value: string) => boolean;
}

