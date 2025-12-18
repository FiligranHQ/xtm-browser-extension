/**
 * Observable Types
 * 
 * Types for cyber threat intelligence observables (IoCs).
 */

import type { OCTIStixCyberObservable } from './opencti';
import type { PlatformMatch } from './platform';

// ============================================================================
// Observable Type Definitions
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

// ============================================================================
// Detected Observable
// ============================================================================

export interface DetectedObservable {
  type: ObservableType;
  value: string;
  refangedValue?: string;
  isDefanged?: boolean;
  hashType?: HashType;
  startIndex: number;
  endIndex: number;
  context?: string;
  found: boolean;
  entityId?: string;
  entityData?: OCTIStixCyberObservable;
  platformId?: string;
  platformMatches?: PlatformMatch[];
}
