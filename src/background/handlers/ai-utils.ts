/**
 * AI Handler Utilities
 * 
 * Common utilities for AI message handlers to reduce code duplication.
 * Consolidates patterns from:
 * - handleAIGenerateFullScenario
 * - handleAIGenerateAtomicTest
 * - handleAIGenerateEmails
 * - handleAIDiscoverEntities
 * - handleAIResolveRelationships
 */

import { getSettings } from '../../shared/utils/storage';
import { successResponse, errorResponse, type SendResponseFn } from '../../shared/types/common';
import { loggers } from '../../shared/utils/logger';
import { AIClient, isAIAvailable } from '../../shared/api/ai-client';
import { parseAIJsonResponse } from '../../shared/api/ai/json-parser';

const log = loggers.background;

// ============================================================================
// Types
// ============================================================================

/** AI response from the client */
export interface AIResponse {
  success: boolean;
  content?: string;
  error?: string;
}

/** Options for AI request execution */
export interface AIRequestOptions<TRequest, TResponse> {
  /** Handler name for logging */
  handlerName: string;
  /** The request payload */
  request: TRequest;
  /** Max content length for truncation (optional) */
  maxContentLength?: number;
  /** Field to truncate in the request (e.g., 'pageContent', 'context') */
  truncateField?: keyof TRequest;
  /** Function to execute the AI request */
  executeRequest: (client: AIClient, request: TRequest) => Promise<AIResponse>;
  /** Optional validator for parsed response (returns error message if invalid) */
  validateResponse?: (parsed: TResponse) => string | null;
  /** Optional transform function for the parsed response */
  transformResponse?: (parsed: TResponse) => unknown;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build error message for JSON parsing failures
 */
export function buildParsingErrorMessage(content: string, customCheck?: { key: string; found: boolean }): string {
  const contentPreview = content.substring(0, 200);
  const hasJson = content.includes('{') && content.includes('}');
  
  let detail: string;
  if (customCheck) {
    detail = customCheck.found 
      ? `Found "${customCheck.key}" but structure is invalid.`
      : `Missing "${customCheck.key}".`;
  } else {
    detail = hasJson ? 'JSON found but malformed.' : 'No JSON structure detected.';
  }
  
  return `AI response parsing failed. ${detail} Preview: "${contentPreview}..."`;
}

/**
 * Truncate a string field if it exceeds max length
 */
export function truncateContent(
  content: string | undefined,
  maxLength: number,
  handlerName: string
): string | undefined {
  if (!content || content.length <= maxLength) {
    return content;
  }
  
  log.warn(`[${handlerName}] Content too large (${content.length} chars), truncating to ${maxLength}`);
  return content.substring(0, maxLength) + '\n\n[Content truncated due to size]';
}

// ============================================================================
// Main Execution Functions
// ============================================================================

/**
 * Execute an AI request with standard error handling and response parsing.
 * 
 * This utility consolidates the common pattern across AI handlers:
 * 1. Check AI availability
 * 2. Create AI client
 * 3. Optionally truncate content
 * 4. Execute request
 * 5. Parse JSON response
 * 6. Validate and transform response
 * 7. Handle errors consistently
 * 
 * @example
 * ```typescript
 * await executeAIRequest({
 *   handlerName: 'AI_GENERATE_ATOMIC_TEST',
 *   request: payload,
 *   maxContentLength: 8000,
 *   truncateField: 'context',
 *   executeRequest: (client, req) => client.generateAtomicTest(req),
 *   validateResponse: (parsed) => parsed ? null : 'Failed to parse response',
 * }, sendResponse);
 * ```
 */
export async function executeAIRequest<TRequest, TResponse>(
  options: AIRequestOptions<TRequest, TResponse>,
  sendResponse: SendResponseFn
): Promise<void> {
  const {
    handlerName,
    request: originalRequest,
    maxContentLength,
    truncateField,
    executeRequest,
    validateResponse,
    transformResponse,
  } = options;

  // Check AI availability
  const settings = await getSettings();
  if (!isAIAvailable(settings.ai)) {
    sendResponse(errorResponse('AI not configured'));
    return;
  }

  try {
    const aiClient = new AIClient(settings.ai!);
    const request = { ...originalRequest };

    // Truncate content if needed
    if (maxContentLength && truncateField) {
      const fieldValue = request[truncateField];
      if (typeof fieldValue === 'string') {
        (request as Record<string, unknown>)[truncateField as string] = truncateContent(
          fieldValue,
          maxContentLength,
          handlerName
        );
      }
    }

    // Execute the AI request
    const response = await executeRequest(aiClient, request);

    log.debug(`[${handlerName}] AI response success:`, response.success);

    if (response.success && response.content) {
      // Parse JSON response
      const parsed = parseAIJsonResponse<TResponse>(response.content);

      if (!parsed) {
        log.error(`[${handlerName}] Failed to parse AI response. Raw (first 1000):`, response.content.substring(0, 1000));
        sendResponse({
          success: false,
          error: buildParsingErrorMessage(response.content),
        });
        return;
      }

      // Validate if validator provided
      if (validateResponse) {
        const validationError = validateResponse(parsed);
        if (validationError) {
          log.error(`[${handlerName}] Validation failed:`, validationError);
          sendResponse({
            success: false,
            error: validationError,
          });
          return;
        }
      }

      // Transform and send response
      const result = transformResponse ? transformResponse(parsed) : parsed;
      log.debug(`[${handlerName}] Successfully processed response`);
      sendResponse(successResponse(result));
    } else {
      log.error(`[${handlerName}] AI generation failed:`, response.error);
      sendResponse({
        success: false,
        error: response.error || 'AI failed to generate content',
      });
    }
  } catch (error) {
    log.error(`[${handlerName}] Exception:`, error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'AI generation failed unexpectedly',
    });
  }
}

/**
 * Simple wrapper for AI requests that don't need JSON parsing.
 * Used for handlers like AI_GENERATE_DESCRIPTION that return raw text.
 */
export async function executeSimpleAIRequest<TRequest>(
  handlerName: string,
  request: TRequest,
  executeRequest: (client: AIClient, request: TRequest) => Promise<AIResponse>,
  sendResponse: SendResponseFn
): Promise<void> {
  const settings = await getSettings();
  if (!isAIAvailable(settings.ai)) {
    sendResponse(errorResponse('AI not configured'));
    return;
  }

  try {
    const aiClient = new AIClient(settings.ai!);
    const response = await executeRequest(aiClient, request);
    sendResponse({ 
      success: response.success, 
      data: response.content, 
      error: response.error,
    });
  } catch (error) {
    log.error(`[${handlerName}] Exception:`, error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'AI generation failed',
    });
  }
}

/**
 * Check if AI is configured and available.
 * Returns the AIClient if available, null otherwise (and sends error response).
 */
export async function getAIClientOrError(
  sendResponse: SendResponseFn
): Promise<AIClient | null> {
  const settings = await getSettings();
  if (!isAIAvailable(settings.ai)) {
    sendResponse(errorResponse('AI not configured'));
    return null;
  }
  return new AIClient(settings.ai!);
}

