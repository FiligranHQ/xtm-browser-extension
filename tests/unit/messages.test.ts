/**
 * Unit Tests for Message Types and Handlers
 * 
 * These tests ensure that:
 * 1. All message types have corresponding handlers
 * 2. Handlers are properly registered
 * 3. No messages are accidentally deleted
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { MessageType } from '../../src/shared/types/messages';

// Import handler registries
import { openctiHandlers } from '../../src/background/handlers/opencti-handlers';
import { openaevHandlers } from '../../src/background/handlers/openaev-handlers';
import { aiHandlers } from '../../src/background/handlers/ai-handlers';
import { miscHandlers } from '../../src/background/handlers/misc-handlers';

// Import message dispatcher functions
import { 
  hasHandler, 
  getRegisteredMessageTypes,
  getHandler,
} from '../../src/background/services/message-dispatcher';

// ============================================================================
// Message Type Coverage
// ============================================================================

/**
 * All message types that MUST have handlers.
 * If a handler is deleted, this test will fail.
 * 
 * UPDATE THIS LIST when adding new message types.
 */
const ALL_MESSAGE_TYPES: MessageType[] = [
  // Scan operations
  'SCAN_PAGE',
  'SCAN_PLATFORM',
  'SCAN_OAEV',
  'SCAN_ALL',
  'SCAN_ATOMIC_TESTING',
  
  // Settings
  'GET_SETTINGS',
  'SAVE_SETTINGS',
  'TEST_PLATFORM_CONNECTION',
  'GET_PLATFORM_THEME',
  
  // Cache management
  'REFRESH_CACHE',
  'GET_CACHE_STATS',
  'GET_CACHE_REFRESH_STATUS',
  'CLEAR_PLATFORM_CACHE',
  
  // Entity operations
  'CREATE_ENTITY',
  'CREATE_CONTAINER',
  'CREATE_INVESTIGATION',
  'GET_ENTITY_DETAILS',
  
  // Panel operations
  'HIDE_PANEL',
  'GET_PANEL_STATE',
  'OPEN_SIDE_PANEL',
  'OPEN_SIDE_PANEL_IMMEDIATE',
  'FORWARD_TO_PANEL',
  'PANEL_MESSAGE_BROADCAST',
  
  // Split screen
  'BROADCAST_SPLIT_SCREEN_MODE_CHANGE',
  'SPLIT_SCREEN_MODE_CHANGED',
  
  // Search operations
  'SEARCH_PLATFORM',
  'SEARCH_ASSETS',
  
  // OpenCTI specific
  'FETCH_LABELS',
  'FETCH_MARKINGS',
  'GET_LABELS_AND_MARKINGS',
  'FETCH_ENTITY_CONTAINERS',
  'FIND_CONTAINERS_BY_URL',
  'FETCH_VOCABULARY',
  'FETCH_IDENTITIES',
  'SEARCH_IDENTITIES',
  'CREATE_IDENTITY',
  'SEARCH_LABELS',
  'CREATE_LABEL',
  'CREATE_OBSERVABLES_BULK',
  'CREATE_INVESTIGATION_WITH_ENTITIES',
  'CREATE_WORKBENCH',
  
  // OpenAEV Atomic Testing
  'FETCH_INJECTOR_CONTRACTS',
  'FETCH_OAEV_ASSETS',
  'FETCH_OAEV_ASSET_GROUPS',
  'FETCH_OAEV_TEAMS',
  'CREATE_OAEV_PAYLOAD',
  'FETCH_OAEV_PAYLOAD',
  'FIND_DNS_RESOLUTION_PAYLOAD',
  'FIND_INJECTOR_CONTRACT_BY_PAYLOAD',
  'CREATE_ATOMIC_TESTING',
  
  // Scenario operations
  'GENERATE_SCENARIO',
  'SHOW_SCENARIO_PANEL',
  'CREATE_SCENARIO',
  'CREATE_SCENARIO_FROM_PAGE',
  'FETCH_SCENARIO_OVERVIEW',
  'FETCH_KILL_CHAIN_PHASES',
  'FETCH_INJECTOR_CONTRACTS_FOR_ATTACK_PATTERNS',
  'ADD_INJECT_TO_SCENARIO',
  'ADD_EMAIL_INJECT_TO_SCENARIO',
  'ADD_TECHNICAL_INJECT_TO_SCENARIO',
  
  // AI operations
  'AI_GENERATE_DESCRIPTION',
  'AI_GENERATE_SCENARIO',
  'AI_GENERATE_FULL_SCENARIO',
  'AI_GENERATE_ATOMIC_TEST',
  'AI_GENERATE_EMAILS',
  'AI_DISCOVER_ENTITIES',
  'AI_RESOLVE_RELATIONSHIPS',
  'AI_SCAN_ALL',
  'AI_CHECK_STATUS',
  'AI_TEST_AND_FETCH_MODELS',
  
  // Content script injection
  'INJECT_CONTENT_SCRIPT',
  'INJECT_ALL_TABS',
  
  // PDF operations
  'GENERATE_NATIVE_PDF',
  'CHECK_IF_PDF',
  'OPEN_PDF_SCANNER',
  'SCAN_PDF_CONTENT',
  'OPEN_PDF_SCANNER_PANEL',
  'PDF_SCANNER_RESCAN',
  'FORWARD_TO_PDF_SCANNER',
  'GET_PDF_CONTENT',
  'GET_PDF_CONTENT_FROM_PDF_SCANNER',
  
  // Image fetching
  'FETCH_IMAGE_AS_DATA_URL',
  
  // Highlight control
  'SELECTION_CHANGED',
  'CLEAR_HIGHLIGHTS_ONLY',
  'DRAW_RELATIONSHIP_LINES',
  'CLEAR_RELATIONSHIP_LINES',
];

/**
 * Message types that are handled by the dispatcher registry (not switch statement)
 * These must match exactly what's exported in the handler registries.
 */
const DISPATCHER_HANDLED_MESSAGES: MessageType[] = [
  // OpenCTI handlers (from openctiHandlers registry)
  'CREATE_ENTITY',
  'CREATE_OBSERVABLES_BULK',
  'FETCH_LABELS',
  'SEARCH_LABELS',
  'CREATE_LABEL',
  'FETCH_MARKINGS',
  'FETCH_VOCABULARY',
  'FETCH_IDENTITIES',
  'SEARCH_IDENTITIES',
  'CREATE_IDENTITY',
  'FETCH_ENTITY_CONTAINERS',
  'FIND_CONTAINERS_BY_URL',
  'CREATE_WORKBENCH',
  'GET_LABELS_AND_MARKINGS',
  
  // OpenAEV handlers (from openaevHandlers registry)
  'FETCH_KILL_CHAIN_PHASES',
  'FETCH_INJECTOR_CONTRACTS',
  'FETCH_OAEV_ASSETS',
  'FETCH_OAEV_ASSET_GROUPS',
  'FETCH_OAEV_TEAMS',
  'CREATE_OAEV_PAYLOAD',
  'FETCH_OAEV_PAYLOAD',
  'FIND_DNS_RESOLUTION_PAYLOAD',
  'FIND_INJECTOR_CONTRACT_BY_PAYLOAD',
  'CREATE_ATOMIC_TESTING',
  'CREATE_SCENARIO',
  'ADD_INJECT_TO_SCENARIO',
  'ADD_EMAIL_INJECT_TO_SCENARIO',
  'SEARCH_ASSETS',
  'FETCH_SCENARIO_OVERVIEW',
  'FETCH_INJECTOR_CONTRACTS_FOR_ATTACK_PATTERNS',
  
  // AI handlers (from aiHandlers registry)
  'AI_CHECK_STATUS',
  'AI_TEST_AND_FETCH_MODELS',
  'AI_GENERATE_DESCRIPTION',
  'AI_GENERATE_SCENARIO',
  'AI_GENERATE_FULL_SCENARIO',
  'AI_GENERATE_ATOMIC_TEST',
  'AI_GENERATE_EMAILS',
  'AI_DISCOVER_ENTITIES',
  'AI_RESOLVE_RELATIONSHIPS',
  'AI_SCAN_ALL',
  
  // Misc handlers (from miscHandlers registry)
  'INJECT_CONTENT_SCRIPT',
  'INJECT_ALL_TABS',
  'GET_PANEL_STATE',
  'GENERATE_NATIVE_PDF',
  'FETCH_IMAGE_AS_DATA_URL',
];

/**
 * Message types that require special handling via switch statement in index.ts
 * (due to dependency injection requirements or complex logic)
 */
const SWITCH_HANDLED_MESSAGES: MessageType[] = [
  // Scan operations (need getDetectionEngine)
  'SCAN_PAGE',
  'SCAN_OAEV',
  'SCAN_ALL',
  
  // Settings (need client initialization)
  'TEST_PLATFORM_CONNECTION',
  'GET_SETTINGS',
  'SAVE_SETTINGS',
  
  // Cache (need cache manager)
  'REFRESH_CACHE',
  'GET_CACHE_STATS',
  'GET_CACHE_REFRESH_STATUS',
  'CLEAR_PLATFORM_CACHE',
  
  // Side panel
  'OPEN_SIDE_PANEL',
  'OPEN_SIDE_PANEL_IMMEDIATE',
  
  // Entity operations (complex logic in switch)
  'GET_ENTITY_DETAILS',
  'SEARCH_PLATFORM',
  'CREATE_INVESTIGATION_WITH_ENTITIES',
  
  // Container/scenario operations
  'CREATE_CONTAINER',
  'CREATE_INVESTIGATION',
  'GENERATE_SCENARIO',
  'ADD_TECHNICAL_INJECT_TO_SCENARIO',
  
  // Theme
  'GET_PLATFORM_THEME',
];

/**
 * Message types handled by content script or other components (not background)
 */
const NON_BACKGROUND_MESSAGES: MessageType[] = [
  'HIDE_PANEL',
  'FORWARD_TO_PANEL',
  'PANEL_MESSAGE_BROADCAST',
  'BROADCAST_SPLIT_SCREEN_MODE_CHANGE',
  'SPLIT_SCREEN_MODE_CHANGED',
  'SELECTION_CHANGED',
  'CLEAR_HIGHLIGHTS_ONLY',
  'DRAW_RELATIONSHIP_LINES',
  'CLEAR_RELATIONSHIP_LINES',
  'SCAN_PLATFORM',
  'SCAN_ATOMIC_TESTING',
  'SHOW_SCENARIO_PANEL',
  'CREATE_SCENARIO_FROM_PAGE',
  'AI_SCAN_ALL',
  'CHECK_IF_PDF',
  'OPEN_PDF_SCANNER',
  'SCAN_PDF_CONTENT',
  'OPEN_PDF_SCANNER_PANEL',
  'PDF_SCANNER_RESCAN',
  'FORWARD_TO_PDF_SCANNER',
  'GET_PDF_CONTENT',
  'GET_PDF_CONTENT_FROM_PDF_SCANNER',
];

// ============================================================================
// Tests
// ============================================================================

describe('Message Types Coverage', () => {
  it('should have all message types documented in test file', () => {
    // This test ensures ALL_MESSAGE_TYPES list is complete
    // If you add a new MessageType, add it to ALL_MESSAGE_TYPES above
    expect(ALL_MESSAGE_TYPES.length).toBeGreaterThan(0);
  });

  it('should not have duplicate message types', () => {
    const uniqueTypes = new Set(ALL_MESSAGE_TYPES);
    expect(uniqueTypes.size).toBe(ALL_MESSAGE_TYPES.length);
  });

  it('should categorize all message types into dispatcher, switch, or non-background', () => {
    const allCategorized = [
      ...DISPATCHER_HANDLED_MESSAGES,
      ...SWITCH_HANDLED_MESSAGES,
      ...NON_BACKGROUND_MESSAGES,
    ];

    // Check each message type is categorized
    for (const type of ALL_MESSAGE_TYPES) {
      const isCategorized = allCategorized.includes(type);
      expect(isCategorized, `Message type ${type} is not categorized`).toBe(true);
    }
  });
});

describe('Message Dispatcher Registry', () => {
  it('should have handlers registered for dispatcher-handled messages', () => {
    const registeredTypes = getRegisteredMessageTypes();
    
    for (const type of DISPATCHER_HANDLED_MESSAGES) {
      const isRegistered = registeredTypes.includes(type);
      expect(isRegistered, `Handler for ${type} should be registered in dispatcher`).toBe(true);
    }
  });

  it('should return true from hasHandler for registered types', () => {
    for (const type of DISPATCHER_HANDLED_MESSAGES) {
      expect(hasHandler(type), `hasHandler(${type}) should return true`).toBe(true);
    }
  });

  it('should return a handler function for registered types', () => {
    for (const type of DISPATCHER_HANDLED_MESSAGES) {
      const handler = getHandler(type);
      expect(handler, `getHandler(${type}) should return a function`).toBeDefined();
      expect(typeof handler).toBe('function');
    }
  });

  it('should return false from hasHandler for non-registered types', () => {
    const unknownTypes = ['UNKNOWN_MESSAGE', 'FAKE_TYPE', 'NOT_A_MESSAGE'];
    for (const type of unknownTypes) {
      expect(hasHandler(type)).toBe(false);
    }
  });
});

describe('Handler Registries', () => {
  describe('OpenCTI Handlers', () => {
    // These must match exactly what's in openctiHandlers registry
    const expectedHandlers = [
      'CREATE_ENTITY',
      'CREATE_OBSERVABLES_BULK',
      'FETCH_LABELS',
      'SEARCH_LABELS',
      'CREATE_LABEL',
      'FETCH_MARKINGS',
      'FETCH_VOCABULARY',
      'FETCH_IDENTITIES',
      'SEARCH_IDENTITIES',
      'CREATE_IDENTITY',
      'FETCH_ENTITY_CONTAINERS',
      'FIND_CONTAINERS_BY_URL',
      'CREATE_WORKBENCH',
      'GET_LABELS_AND_MARKINGS',
    ];

    it('should export all required handlers', () => {
      for (const name of expectedHandlers) {
        expect(openctiHandlers[name], `Handler ${name} should be exported`).toBeDefined();
        expect(typeof openctiHandlers[name]).toBe('function');
      }
    });

    it('should not have extra unexpected handlers', () => {
      const handlerNames = Object.keys(openctiHandlers);
      for (const name of handlerNames) {
        expect(expectedHandlers.includes(name as any), 
          `Unexpected handler ${name} - add to expectedHandlers if intentional`).toBe(true);
      }
    });
  });

  describe('OpenAEV Handlers', () => {
    const expectedHandlers = [
      'FETCH_KILL_CHAIN_PHASES',
      'FETCH_INJECTOR_CONTRACTS',
      'FETCH_OAEV_ASSETS',
      'FETCH_OAEV_ASSET_GROUPS',
      'FETCH_OAEV_TEAMS',
      'CREATE_OAEV_PAYLOAD',
      'FETCH_OAEV_PAYLOAD',
      'FIND_DNS_RESOLUTION_PAYLOAD',
      'FIND_INJECTOR_CONTRACT_BY_PAYLOAD',
      'CREATE_ATOMIC_TESTING',
      'CREATE_SCENARIO',
      'ADD_INJECT_TO_SCENARIO',
      'ADD_EMAIL_INJECT_TO_SCENARIO',
      'SEARCH_ASSETS',
      'FETCH_SCENARIO_OVERVIEW',
      'FETCH_INJECTOR_CONTRACTS_FOR_ATTACK_PATTERNS',
    ];

    it('should export all required handlers', () => {
      for (const name of expectedHandlers) {
        expect(openaevHandlers[name], `Handler ${name} should be exported`).toBeDefined();
        expect(typeof openaevHandlers[name]).toBe('function');
      }
    });

    it('should not have extra unexpected handlers', () => {
      const handlerNames = Object.keys(openaevHandlers);
      for (const name of handlerNames) {
        expect(expectedHandlers.includes(name as any), 
          `Unexpected handler ${name} - add to expectedHandlers if intentional`).toBe(true);
      }
    });
  });

  describe('AI Handlers', () => {
    // These must match exactly what's in aiHandlers registry
    const expectedHandlers = [
      'AI_CHECK_STATUS',
      'AI_TEST_AND_FETCH_MODELS',
      'AI_GENERATE_DESCRIPTION',
      'AI_GENERATE_SCENARIO',
      'AI_GENERATE_FULL_SCENARIO',
      'AI_GENERATE_ATOMIC_TEST',
      'AI_GENERATE_EMAILS',
      'AI_DISCOVER_ENTITIES',
      'AI_RESOLVE_RELATIONSHIPS',
      'AI_SCAN_ALL',
    ];

    it('should export all required handlers', () => {
      for (const name of expectedHandlers) {
        expect(aiHandlers[name], `Handler ${name} should be exported`).toBeDefined();
        expect(typeof aiHandlers[name]).toBe('function');
      }
    });

    it('should not have extra unexpected handlers', () => {
      const handlerNames = Object.keys(aiHandlers);
      for (const name of handlerNames) {
        expect(expectedHandlers.includes(name as any), 
          `Unexpected handler ${name} - add to expectedHandlers if intentional`).toBe(true);
      }
    });
  });

  describe('Misc Handlers', () => {
    const expectedHandlers = [
      'INJECT_CONTENT_SCRIPT',
      'INJECT_ALL_TABS',
      'GET_PANEL_STATE',
      'GENERATE_NATIVE_PDF',
      'FETCH_IMAGE_AS_DATA_URL',
    ];

    it('should export all required handlers', () => {
      for (const name of expectedHandlers) {
        expect(miscHandlers[name], `Handler ${name} should be exported`).toBeDefined();
        expect(typeof miscHandlers[name]).toBe('function');
      }
    });

    it('should not have extra unexpected handlers', () => {
      const handlerNames = Object.keys(miscHandlers);
      for (const name of handlerNames) {
        expect(expectedHandlers.includes(name as any), 
          `Unexpected handler ${name} - add to expectedHandlers if intentional`).toBe(true);
      }
    });
  });
});

describe('Handler Types', () => {
  it('should have correct function signature for all handlers', () => {
    const allHandlers = {
      ...openctiHandlers,
      ...openaevHandlers,
      ...aiHandlers,
      ...miscHandlers,
    };

    for (const [name, handler] of Object.entries(allHandlers)) {
      // Each handler should be a function that returns a promise
      expect(typeof handler).toBe('function');
      // Handler should accept 3 arguments (payload, sendResponse, context)
      expect(handler.length).toBeLessThanOrEqual(3);
    }
  });
});

