/**
 * Message Dispatcher Service
 * 
 * Centralized message routing using handler registries.
 * This reduces code duplication by delegating to handler modules.
 */

import { loggers } from '../../shared/utils/logger';
import {
  createHandlerRegistry,
  settingsHandlers,
  scanHandlers,
} from '../handlers';
import {
  errorResponse,
  createHandlerContext,
  type MessageHandler,
  type SendResponseFn,
} from '../handlers/types';
import type { ExtensionMessage } from '../../shared/types';

const log = loggers.background;

// Build the complete handler registry
const handlerRegistry = createHandlerRegistry();

// Add settings handlers
for (const [type, handler] of Object.entries(settingsHandlers)) {
  handlerRegistry.set(type, handler as MessageHandler);
}

// Add scan handlers  
for (const [type, handler] of Object.entries(scanHandlers)) {
  handlerRegistry.set(type, handler as MessageHandler);
}

// Handler context for all handlers
const handlerContext = createHandlerContext();

/**
 * Check if a message type has a registered handler
 */
export function hasHandler(messageType: string): boolean {
  return handlerRegistry.has(messageType);
}

/**
 * Get a registered handler by message type
 */
export function getHandler(messageType: string): MessageHandler | undefined {
  return handlerRegistry.get(messageType);
}

/**
 * Get all registered message types
 */
export function getRegisteredMessageTypes(): string[] {
  return Array.from(handlerRegistry.keys());
}

/**
 * Dispatch a message to the appropriate handler
 * 
 * @param message - The extension message to handle
 * @param sendResponse - Callback to send response
 * @returns true if handled by registry, false if not found
 */
export async function dispatchMessage(
  message: ExtensionMessage,
  sendResponse: SendResponseFn
): Promise<boolean> {
  const handler = handlerRegistry.get(message.type);
  
  if (handler) {
    try {
      await handler(message.payload, sendResponse, handlerContext);
      return true;
    } catch (error) {
      log.error(`Handler error for ${message.type}:`, error);
      sendResponse(errorResponse(
        error instanceof Error ? error.message : 'Handler error'
      ));
      return true;
    }
  }
  
  return false;
}

/**
 * Add a handler to the registry (for dynamic registration)
 */
export function registerHandler(type: string, handler: MessageHandler): void {
  handlerRegistry.set(type, handler);
}

/**
 * Remove a handler from the registry
 */
export function unregisterHandler(type: string): boolean {
  return handlerRegistry.delete(type);
}

// Export for type checking
export type { MessageHandler, SendResponseFn };

