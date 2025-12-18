/**
 * UI State Types
 * 
 * Types for panel state and scan state management.
 */

import type { ScanResultPayload } from './messages';
import type { DetectedOAEVEntity, OAEVAsset } from './openaev';
import type {
  OCTIStixCyberObservable,
  OCTIStixDomainObject,
  DetectedOCTIEntity,
} from './opencti';
import type { DetectedObservable } from './observables';

// ============================================================================
// Scan State
// ============================================================================

export interface ScanState {
  isScanning: boolean;
  lastScanTime?: string;
  results?: ScanResultPayload;
  error?: string;
}

// ============================================================================
// Panel State
// ============================================================================

export interface PanelState {
  isOpen: boolean;
  entity?: DetectedObservable | DetectedOCTIEntity | DetectedOAEVEntity;
  entityDetails?: OCTIStixCyberObservable | OCTIStixDomainObject | OAEVAsset;
  loading: boolean;
}
