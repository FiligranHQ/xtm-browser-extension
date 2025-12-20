/**
 * Background Message Handler Types
 * 
 * Handler-specific types and utilities.
 */

import { successResponse, errorResponse, type MessageResponse, type SendResponseFn } from '../../shared/types/common';

// Re-export for convenience
export { successResponse, errorResponse, type MessageResponse, type SendResponseFn };

// ============================================================================
// Handler-Specific Types
// ============================================================================

/**
 * Message handler context
 * Contains all the dependencies handlers need
 */
export interface HandlerContext {
  successResponse: <T>(data: T) => MessageResponse<T>;
  errorResponse: (error: string) => MessageResponse;
}

/**
 * Message handler function type
 */
export type MessageHandler = (
  payload: unknown,
  sendResponse: SendResponseFn,
  context: HandlerContext
) => Promise<void>;

/**
 * Message handler registry type
 */
export type MessageHandlerRegistry = Map<string, MessageHandler>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create handler context
 */
export function createHandlerContext(): HandlerContext {
  return {
    successResponse,
    errorResponse: (error: string) => errorResponse(error),
  };
}
