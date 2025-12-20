/**
 * Unit Tests for Message Dispatcher
 * 
 * Tests the centralized message routing system.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  hasHandler,
  getHandler,
  getRegisteredMessageTypes,
  dispatchMessage,
  registerHandler,
  unregisterHandler,
} from '../../src/background/services/message-dispatcher';
import type { ExtensionMessage } from '../../src/shared/types/messages';

describe('Message Dispatcher', () => {
  describe('hasHandler', () => {
    it('should return true for registered handlers', () => {
      // Pick some handlers we know are registered
      const knownHandlers = [
        'CREATE_ENTITY',
        'AI_GENERATE_DESCRIPTION',
        'FETCH_OAEV_ASSETS',
      ];

      for (const type of knownHandlers) {
        expect(hasHandler(type)).toBe(true);
      }
    });

    it('should return false for unknown handlers', () => {
      expect(hasHandler('UNKNOWN_MESSAGE_TYPE')).toBe(false);
      expect(hasHandler('')).toBe(false);
      expect(hasHandler('random_string')).toBe(false);
    });
  });

  describe('getHandler', () => {
    it('should return a function for registered handlers', () => {
      const handler = getHandler('CREATE_ENTITY');
      expect(handler).toBeDefined();
      expect(typeof handler).toBe('function');
    });

    it('should return undefined for unknown handlers', () => {
      expect(getHandler('UNKNOWN_MESSAGE_TYPE')).toBeUndefined();
    });
  });

  describe('getRegisteredMessageTypes', () => {
    it('should return an array', () => {
      const types = getRegisteredMessageTypes();
      expect(Array.isArray(types)).toBe(true);
    });

    it('should contain known message types', () => {
      const types = getRegisteredMessageTypes();
      expect(types).toContain('CREATE_ENTITY');
      expect(types).toContain('AI_GENERATE_DESCRIPTION');
    });

    it('should not be empty', () => {
      const types = getRegisteredMessageTypes();
      expect(types.length).toBeGreaterThan(0);
    });
  });

  describe('dispatchMessage', () => {
    it('should return true when handler exists', async () => {
      const message: ExtensionMessage = {
        type: 'GET_PANEL_STATE',
      };
      const sendResponse = vi.fn();

      const handled = await dispatchMessage(message, sendResponse);
      
      expect(handled).toBe(true);
    });

    it('should return false when handler does not exist', async () => {
      const message: ExtensionMessage = {
        type: 'UNKNOWN_TYPE' as any,
      };
      const sendResponse = vi.fn();

      const handled = await dispatchMessage(message, sendResponse);
      
      expect(handled).toBe(false);
      expect(sendResponse).not.toHaveBeenCalled();
    });

    it('should call sendResponse on handler error', async () => {
      // Register a handler that throws
      const errorHandler = vi.fn().mockRejectedValue(new Error('Test error'));
      registerHandler('TEST_ERROR_HANDLER', errorHandler);

      const message: ExtensionMessage = {
        type: 'TEST_ERROR_HANDLER' as any,
      };
      const sendResponse = vi.fn();

      const handled = await dispatchMessage(message, sendResponse);
      
      expect(handled).toBe(true);
      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Test error',
        })
      );

      // Cleanup
      unregisterHandler('TEST_ERROR_HANDLER');
    });
  });

  describe('registerHandler', () => {
    it('should register a new handler', () => {
      const testHandler = vi.fn();
      
      expect(hasHandler('TEST_NEW_HANDLER')).toBe(false);
      
      registerHandler('TEST_NEW_HANDLER', testHandler);
      
      expect(hasHandler('TEST_NEW_HANDLER')).toBe(true);
      expect(getHandler('TEST_NEW_HANDLER')).toBe(testHandler);

      // Cleanup
      unregisterHandler('TEST_NEW_HANDLER');
    });

    it('should overwrite existing handler', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      
      registerHandler('TEST_OVERWRITE', handler1);
      expect(getHandler('TEST_OVERWRITE')).toBe(handler1);
      
      registerHandler('TEST_OVERWRITE', handler2);
      expect(getHandler('TEST_OVERWRITE')).toBe(handler2);

      // Cleanup
      unregisterHandler('TEST_OVERWRITE');
    });
  });

  describe('unregisterHandler', () => {
    it('should remove a registered handler', () => {
      const testHandler = vi.fn();
      registerHandler('TEST_REMOVE', testHandler);
      
      expect(hasHandler('TEST_REMOVE')).toBe(true);
      
      const result = unregisterHandler('TEST_REMOVE');
      
      expect(result).toBe(true);
      expect(hasHandler('TEST_REMOVE')).toBe(false);
    });

    it('should return false for non-existent handler', () => {
      const result = unregisterHandler('NEVER_REGISTERED');
      expect(result).toBe(false);
    });
  });
});

describe('Handler Registration Integrity', () => {
  it('should have consistent handler count', () => {
    const types = getRegisteredMessageTypes();
    // This test will fail if handlers are accidentally removed
    // Update this number when adding/removing handlers
    expect(types.length).toBeGreaterThanOrEqual(40);
  });

  it('should have handlers from all modules', () => {
    const types = getRegisteredMessageTypes();
    
    // Check at least one handler from each module
    expect(types).toContain('CREATE_ENTITY'); // opencti
    expect(types).toContain('FETCH_OAEV_ASSETS'); // openaev
    expect(types).toContain('AI_GENERATE_DESCRIPTION'); // ai
    expect(types).toContain('INJECT_CONTENT_SCRIPT'); // misc
  });
});

