/**
 * Shared Types
 * 
 * Central type definitions for the XTM browser extension.
 * Platform-specific types are in their dedicated files:
 * - ./opencti.ts - OpenCTI types
 * - ./openaev.ts - OpenAEV types
 * - ./messages.ts - Message types for extension communication
 */

import { PlatformType } from '../platform/registry';
import type { DetectedOAEVEntity, OAEVAsset } from './openaev';
import type { ScanResultPayload } from './messages';

// Re-export OpenCTI types for backward compatibility
export type {
  OCTIEntityType,
  OCTIBaseEntity,
  OCTIMarkingDefinition,
  OCTILabel,
  OCTIIdentity,
  OCTIExternalReference,
  OCTIFileData,
  OCTIStixCyberObservable,
  OCTIIndicator,
  OCTIStixDomainObject,
  DetectedOCTIEntity,
  OCTIContainerType,
  OCTIContainerCreateInput,
  OCTIExternalReferenceInput,
  InvestigationCreateInput,
  Investigation,
  OCTISearchResult,
} from './opencti';

// Import for internal use
import type {
  OCTIStixCyberObservable,
  OCTIStixDomainObject,
  DetectedOCTIEntity,
} from './opencti';

// ============================================================================
// Configuration Types
// ============================================================================

export interface PlatformConfig {
  id: string;
  name: string;
  url: string;
  apiToken: string;
  enabled: boolean;
  lastConnected?: string;
  platformName?: string;
  platformVersion?: string;
  isEnterprise?: boolean;
  type?: PlatformType;
}

export interface DetectionSettings {
  disabledObservableTypes?: string[];
  disabledOpenCTITypes?: string[];
  disabledOpenAEVTypes?: string[];
}

export interface ExtensionSettings {
  openctiPlatforms: PlatformConfig[];
  openaevPlatforms: PlatformConfig[];
  opengrcPlatforms?: PlatformConfig[];
  theme: 'light' | 'dark' | 'auto';
  autoScan: boolean;
  highlightColor?: string;
  showNotifications: boolean;
  detection?: DetectionSettings;
  ai?: AISettings;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  openctiPlatforms: [],
  openaevPlatforms: [],
  theme: 'dark',
  autoScan: false,
  showNotifications: true,
  detection: {
    disabledObservableTypes: [],
    disabledOpenCTITypes: [],
    disabledOpenAEVTypes: [],
  },
  ai: {},
};

// ============================================================================
// AI Configuration Types
// ============================================================================

export type AIProvider = 'openai' | 'anthropic' | 'gemini' | 'xtm-one';

export interface AIModelInfo {
  id: string;
  name: string;
  description?: string;
}

export interface AISettings {
  provider?: AIProvider;
  apiKey?: string;
  model?: string;
  availableModels?: AIModelInfo[];
  connectionTested?: boolean;
}

export const PLATFORM_AFFINITIES = [
  { value: 'windows', label: 'Windows' },
  { value: 'linux', label: 'Linux' },
  { value: 'macos', label: 'macOS' },
  { value: 'android', label: 'Android' },
  { value: 'ios', label: 'iOS' },
  { value: 'network', label: 'Network' },
  { value: 'containers', label: 'Containers' },
  { value: 'office-365', label: 'Office 365' },
  { value: 'azure-ad', label: 'Azure AD' },
  { value: 'google-workspace', label: 'Google Workspace' },
  { value: 'saas', label: 'SaaS' },
  { value: 'iaas', label: 'IaaS' },
  { value: 'pre', label: 'PRE' },
] as const;

export const TYPE_AFFINITIES = [
  { value: 'attack-scenario', label: 'Attack Scenario' },
  { value: 'incident-response', label: 'Incident Response' },
  { value: 'detection-validation', label: 'Detection Validation' },
  { value: 'threat-hunting', label: 'Threat Hunting' },
  { value: 'red-team', label: 'Red Team Exercise' },
  { value: 'purple-team', label: 'Purple Team Exercise' },
  { value: 'tabletop', label: 'Tabletop Exercise' },
  { value: 'crisis-management', label: 'Crisis Management' },
] as const;

// ============================================================================
// Observable Types
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

// ============================================================================
// Multi-Platform Types
// ============================================================================

export interface PlatformMatch {
  platformId: string;
  entityId: string;
  entityData?: OCTIStixCyberObservable | OCTIStixDomainObject | Record<string, unknown>;
  platformType?: 'opencti' | 'openaev' | string;
  type?: string;
}

export type EnrichmentPlatformType = 'opencti' | 'openaev';

export interface EnrichmentMatch {
  platformId: string;
  platformType: EnrichmentPlatformType;
  entityId: string;
  entityType: string;
  entityData: Record<string, unknown>;
}

export type EnrichableEntityCategory = 'vulnerability' | 'observable';

export type PlatformEntityType = string;

// ============================================================================
// API Response Types
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

export interface PlatformInfo {
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
// UI State Types
// ============================================================================

export interface ScanState {
  isScanning: boolean;
  lastScanTime?: string;
  results?: ScanResultPayload;
  error?: string;
}

export interface PanelState {
  isOpen: boolean;
  entity?: DetectedObservable | DetectedOCTIEntity | DetectedOAEVEntity;
  entityDetails?: OCTIStixCyberObservable | OCTIStixDomainObject | OAEVAsset;
  loading: boolean;
}
