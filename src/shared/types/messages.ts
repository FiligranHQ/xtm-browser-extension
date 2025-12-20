/**
 * Message Types for Extension Communication
 * 
 * Defines all message types used for communication between
 * background script, content script, popup, and panel.
 */

import type {
  DetectedObservable,
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
  | 'HIDE_PANEL'
  | 'CREATE_ENTITY'
  | 'CREATE_CONTAINER'
  | 'CREATE_INVESTIGATION'
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
  | 'GET_PANEL_STATE'
  | 'OPEN_SIDE_PANEL'
  | 'OPEN_SIDE_PANEL_IMMEDIATE'
  | 'FORWARD_TO_PANEL'
  | 'PANEL_MESSAGE_BROADCAST'
  | 'BROADCAST_SPLIT_SCREEN_MODE_CHANGE'
  | 'SPLIT_SCREEN_MODE_CHANGED'
  | 'FETCH_LABELS'
  | 'FETCH_MARKINGS'
  | 'CREATE_OBSERVABLES_BULK'
  | 'CREATE_INVESTIGATION_WITH_ENTITIES'
  | 'GET_LABELS_AND_MARKINGS'
  | 'FETCH_ENTITY_CONTAINERS'
  | 'FIND_CONTAINERS_BY_URL'
  | 'FETCH_VOCABULARY'
  | 'FETCH_IDENTITIES'
  | 'SEARCH_IDENTITIES'
  | 'CREATE_IDENTITY'
  | 'SEARCH_LABELS'
  | 'CREATE_LABEL'
  | 'GET_CACHE_REFRESH_STATUS'
  | 'CLEAR_PLATFORM_CACHE'
  | 'CREATE_WORKBENCH'
  | 'SCAN_PLATFORM'
  | 'SCAN_OAEV'
  // Atomic Testing
  | 'SCAN_ATOMIC_TESTING'
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
  // AI Features
  | 'AI_GENERATE_DESCRIPTION'
  | 'AI_GENERATE_SCENARIO'
  | 'AI_GENERATE_FULL_SCENARIO'
  | 'AI_GENERATE_ATOMIC_TEST'
  | 'AI_GENERATE_EMAILS'
  | 'AI_DISCOVER_ENTITIES'
  | 'AI_RESOLVE_RELATIONSHIPS'
  | 'AI_SCAN_ALL'
  | 'AI_CHECK_STATUS'
  // AI Scenario Creation
  | 'ADD_EMAIL_INJECT_TO_SCENARIO'
  | 'ADD_TECHNICAL_INJECT_TO_SCENARIO'
  // Scenario Generation
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
  | 'FETCH_IMAGE_AS_DATA_URL'
  // PDF Scanner
  | 'CHECK_IF_PDF'
  | 'OPEN_PDF_SCANNER'
  | 'SCAN_PDF_CONTENT'
  | 'OPEN_PDF_SCANNER_PANEL'
  | 'PDF_SCANNER_RESCAN'
  | 'FORWARD_TO_PDF_SCANNER'
  // Content Script Highlight Control
  | 'CLEAR_HIGHLIGHTS_ONLY'
  // PDF Content for AI
  | 'GET_PDF_CONTENT'
  | 'GET_PDF_CONTENT_FROM_PDF_SCANNER';

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

/**
 * CREATE_CONTAINER message payload
 * Contains all fields needed to create a container in OpenCTI
 */
export interface CreateContainerPayload {
  type: OCTIContainerType | string;
  name: string;
  description?: string;
  content?: string;
  /** Label IDs to attach */
  labels?: string[];
  /** Marking definition IDs */
  markings?: string[];
  /** Existing entity IDs to add to container */
  entities?: string[];
  /** Entities to create before adding to container */
  entitiesToCreate?: Array<{ type: string; value: string }>;
  /** Platform ID for multi-platform support */
  platformId?: string;
  /** PDF attachment (base64 encoded) */
  pdfAttachment?: { data: string; filename: string } | null;
  /** Source page URL */
  pageUrl?: string;
  /** Source page title */
  pageTitle?: string;
  // Type-specific fields (Report, Case-Incident, etc.)
  report_types?: string[];
  context?: string;
  severity?: string;
  priority?: string;
  response_types?: string[];
  createdBy?: string;
  /** Create container as draft (EE only) */
  createAsDraft?: boolean;
  /** Relationships to create between entities */
  relationshipsToCreate?: Array<{
    fromEntityIndex: number;
    toEntityIndex: number;
    relationship_type: string;
    description?: string;
  }>;
  /** For update mode: existing container ID */
  updateContainerId?: string;
  /** Original published date (for Reports) */
  published?: string;
  /** Original created date */
  created?: string;
}
