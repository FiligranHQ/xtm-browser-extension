/**
 * Background Message Handler Types
 * 
 * Common types and utilities for message handlers
 */

/**
 * Message response type
 */
export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Send response function type
 */
export type SendResponseFn = (response: MessageResponse) => void;

/**
 * Message handler context
 * Contains all the dependencies handlers need
 */
export interface HandlerContext {
  // Response helpers
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

/**
 * Create a success response
 */
export function successResponse<T>(data: T): MessageResponse<T> {
  return { success: true, data };
}

/**
 * Create an error response
 */
export function errorResponse(error: string): MessageResponse {
  return { success: false, error };
}

/**
 * Create handler context
 */
export function createHandlerContext(): HandlerContext {
  return {
    successResponse,
    errorResponse,
  };
}

