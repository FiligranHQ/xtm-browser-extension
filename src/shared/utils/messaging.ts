/**
 * Messaging utilities for Chrome extension communication
 */

/**
 * Response wrapper type
 */
export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Create a success response
 */
export function successResponse<T>(data: T): MessageResponse<T> {
  return { success: true, data };
}

/**
 * Create an error response
 */
export function errorResponse(error: string | Error): MessageResponse<never> {
  const errorMessage = error instanceof Error ? error.message : error;
  return { success: false, error: errorMessage };
}
