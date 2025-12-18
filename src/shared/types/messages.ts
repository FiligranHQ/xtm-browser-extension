/**
 * Message Types for Extension Communication
 * 
 * Defines all message types used for communication between
 * background script, content script, popup, and panel.
 */

import type {
  DetectedObservable,
  ObservableType,
  HashType,
} from './observables';
import type {
  DetectedOCTIEntity,
  OCTIContainerType,
} from './opencti';
import type { DetectedOAEVEntity } from './openaev';

// ============================================================================
// Message Type Enumeration
// ============================================================================

export type MessageType =
  | 'SCAN_PAGE'
  | 'SCAN_RESULT'
  | 'HIGHLIGHT_OBSERVABLE'
  | 'SHOW_ENTITY_PANEL'
  | 'HIDE_PANEL'
  | 'ADD_OBSERVABLE'
  | 'ADD_OBSERVABLES_BULK'
  | 'CREATE_ENTITY'
  | 'CREATE_CONTAINER'
  | 'CREATE_INVESTIGATION'
  | 'ADD_TO_INVESTIGATION'
  | 'GET_SETTINGS'
  | 'SAVE_SETTINGS'
  | 'TEST_PLATFORM_CONNECTION'
  | 'GET_ENTITY_DETAILS'
  | 'SEARCH_PLATFORM'
  | 'SEARCH_ASSETS'
  | 'GENERATE_SCENARIO'
  | 'GET_PLATFORM_THEME'
  | 'REFRESH_CACHE'
  | 'GET_CACHE_STATS'
  | 'SELECTION_CHANGED'
  | 'SHOW_PREVIEW_PANEL'
  | 'PREVIEW_SELECTION'
  | 'SHOW_BULK_IMPORT_PANEL'
  | 'SHOW_UNIFIED_SEARCH_PANEL'
  | 'SHOW_CONTAINER_PANEL'
  | 'SHOW_INVESTIGATION_PANEL'
  | 'GET_PANEL_STATE'
  | 'FETCH_LABELS'
  | 'FETCH_MARKINGS'
  | 'CREATE_OBSERVABLES_BULK'
  | 'CREATE_INVESTIGATION_WITH_ENTITIES'
  | 'GET_LABELS_AND_MARKINGS'
  | 'FETCH_ENTITY_CONTAINERS'
  | 'FIND_CONTAINERS_BY_URL'
  | 'FETCH_VOCABULARY'
  | 'FETCH_IDENTITIES'
  | 'GET_CACHE_REFRESH_STATUS'
  | 'CLEAR_PLATFORM_CACHE'
  | 'CREATE_WORKBENCH'
  | 'SCAN_PLATFORM'
  | 'SCAN_OAEV'
  // Atomic Testing
  | 'SCAN_ATOMIC_TESTING'
  | 'SHOW_ATOMIC_TESTING_PANEL'
  | 'ATOMIC_TESTING_SCAN_RESULTS'
  | 'ATOMIC_TESTING_SELECT'
  | 'FETCH_INJECTOR_CONTRACTS'
  | 'FETCH_OAEV_ASSETS'
  | 'FETCH_OAEV_ASSET_GROUPS'
  | 'FETCH_OAEV_TEAMS'
  | 'CREATE_OAEV_PAYLOAD'
  | 'FETCH_OAEV_PAYLOAD'
  | 'FIND_DNS_RESOLUTION_PAYLOAD'
  | 'FIND_INJECTOR_CONTRACT_BY_PAYLOAD'
  | 'CREATE_ATOMIC_TESTING'
  // Content Script Injection
  | 'INJECT_CONTENT_SCRIPT'
  | 'INJECT_ALL_TABS'
  | 'PING'
  // AI Features
  | 'AI_GENERATE_DESCRIPTION'
  | 'AI_GENERATE_SCENARIO'
  | 'AI_GENERATE_FULL_SCENARIO'
  | 'AI_GENERATE_ATOMIC_TEST'
  | 'AI_GENERATE_EMAILS'
  | 'AI_DISCOVER_ENTITIES'
  | 'AI_RESOLVE_RELATIONSHIPS'
  | 'AI_CHECK_STATUS'
  // AI Scenario Creation
  | 'ADD_EMAIL_INJECT_TO_SCENARIO'
  | 'ADD_TECHNICAL_INJECT_TO_SCENARIO'
  // Scenario Generation
  | 'OPEN_SCENARIO_PANEL'
  | 'SHOW_SCENARIO_PANEL'
  | 'CREATE_SCENARIO'
  | 'FETCH_SCENARIO_OVERVIEW'
  | 'FETCH_KILL_CHAIN_PHASES'
  | 'FETCH_INJECTOR_CONTRACTS_FOR_ATTACK_PATTERNS'
  | 'ADD_INJECT_TO_SCENARIO'
  | 'CREATE_SCENARIO_FROM_PAGE'
  // Unified scan
  | 'SCAN_ALL'
  // AI model management
  | 'AI_TEST_AND_FETCH_MODELS'
  // PDF Generation
  | 'GENERATE_NATIVE_PDF'
  // Image fetching (for CORS bypass)
  | 'FETCH_IMAGE_AS_DATA_URL';

// ============================================================================
// Message Interfaces
// ============================================================================

export interface ExtensionMessage {
  type: MessageType;
  payload?: unknown;
}

// ============================================================================
// Message Payload Types
// ============================================================================

export interface ScanPagePayload {
  url: string;
  title: string;
  content: string;
}

export interface ScanResultPayload {
  /** Observable Types detected (IPs, domains, hashes, etc.) */
  observables: DetectedObservable[];
  /** OpenCTI Types detected (Threat Actors, Malware, etc.) */
  openctiEntities: DetectedOCTIEntity[];
  /** CVEs (Vulnerabilities) - separate array for special handling */
  cves?: DetectedOCTIEntity[];
  /** OpenAEV Types detected (Assets, Teams, Players, etc.) */
  openaevEntities?: DetectedOAEVEntity[];
  /** AI-discovered entities (persisted for panel re-open) */
  aiDiscoveredEntities?: Array<{
    id: string;
    type: string;
    name: string;
    value: string;
    aiReason?: string;
    aiConfidence?: 'high' | 'medium' | 'low';
  }>;
  scanTime: number;
  url: string;
}

export interface ShowEntityPanelPayload {
  /** 
   * Entity source type
   * 'observable' and 'octi' are for OpenCTI
   * 'platform' is for any non-default platform (identified by entity type prefix)
   */
  entityType: 'observable' | 'octi' | 'platform';
  entity: DetectedObservable | DetectedOCTIEntity | DetectedOAEVEntity;
}

export interface AddObservablePayload {
  type: ObservableType;
  value: string;
  hashType?: HashType;
  createIndicator?: boolean;
}

export interface CreateContainerPayload {
  type: OCTIContainerType;
  name: string;
  description?: string;
  content?: string;
  pageUrl: string;
  pageTitle: string;
  observableIds?: string[];
  generatePdf?: boolean;
}
