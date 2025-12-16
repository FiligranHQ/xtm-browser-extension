/**
 * Message Types
 * 
 * Types for extension messaging between background, content, and panel scripts.
 */

import type { DetectedObservable, DetectedSDO, DetectedPlatformEntity } from './observable';
import type { ObservableType, HashType, ContainerType, GraphQLResponse } from './stix';
import type { StixCyberObservable, StixDomainObject } from './stix';
import type { OAEVAsset } from './platform';

/**
 * Extension message format
 */
export interface ExtensionMessage {
  type: string;
  payload?: unknown;
}

/**
 * Message response format
 */
export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================================
// Scan Payloads
// ============================================================================

/**
 * Scan result payload
 */
export interface ScanResultPayload {
  observables?: DetectedObservable[];
  sdos?: DetectedSDO[];
  cves?: DetectedSDO[];
  /** 
   * Platform entities detected (non-OpenCTI platforms like OpenAEV)
   * Each entity has a type with platform prefix (e.g., 'oaev-Asset')
   */
  platformEntities?: DetectedPlatformEntity[];
  scanTime: number;
  url: string;
}

/**
 * Show entity panel payload
 */
export interface ShowEntityPanelPayload {
  /** 
   * Entity source type
   * 'observable' and 'sdo' are for OpenCTI
   * 'platform' is for any non-default platform (identified by entity type prefix)
   */
  entityType: 'observable' | 'sdo' | 'platform';
  entity: DetectedObservable | DetectedSDO | DetectedPlatformEntity;
}

/**
 * Add observable payload
 */
export interface AddObservablePayload {
  type: ObservableType;
  value: string;
  hashType?: HashType;
  createIndicator?: boolean;
}

/**
 * Create container payload
 */
export interface CreateContainerPayload {
  type: ContainerType;
  name: string;
  description?: string;
  content?: string;
  pageUrl: string;
  pageTitle: string;
  observableIds?: string[];
  generatePdf?: boolean;
}

// ============================================================================
// UI State Types
// ============================================================================

/**
 * Scan state
 */
export interface ScanState {
  isScanning: boolean;
  lastScanTime?: string;
  results?: ScanResultPayload;
  error?: string;
}

/**
 * Panel state
 */
export interface PanelState {
  isOpen: boolean;
  entity?: DetectedObservable | DetectedSDO | DetectedPlatformEntity;
  entityDetails?: StixCyberObservable | StixDomainObject | OAEVAsset;
  loading: boolean;
}

// Re-export for convenience
export type { GraphQLResponse };

