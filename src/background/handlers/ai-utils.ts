/**
 * AI handler utilities
 *
 * Boilerplate shared by every XTM One agent invocation: availability check,
 * client construction, content truncation, uniform error mapping.
 */

import { getSettings } from '../../shared/utils/storage';
import { errorResponse, type SendResponseFn, successResponse } from '../../shared/types/common';
import { loggers } from '../../shared/utils/logger';
import { AIClient, isAIAvailable, type XtmOneTaskResponse } from '../../shared/api/ai-client';

const log = loggers.background;

// ============================================================================
// Helpers
// ============================================================================

/**
 * Truncate a long string field before sending it to XTM One. We could let the
 * platform do this, but truncating here keeps payload sizes predictable in
 * the browser extension messaging layer.
 */
export function truncateContent(
  content: string | undefined,
  maxLength: number,
  handlerName: string,
): string | undefined {
  if (!content || content.length <= maxLength) {
    return content;
  }
  log.warn(`[${handlerName}] Content too large (${content.length} chars), truncating to ${maxLength}`);
  return content.substring(0, maxLength) + '\n\n[Content truncated due to size]';
}

// ============================================================================
// Execution helpers
// ============================================================================

/**
 * Run an XTM One task and forward its structured payload as a successResponse.
 *
 * The optional `truncateField` hook trims a single string field (typically
 * `pageContent` or `context`) before sending. The optional `transform` hook
 * reshapes the agent response before it leaves the background script (used
 * for entity deduplication and relationship validation).
 */
export async function executeAITask<TRequest extends object, TResponse, TOutput>(
  handlerName: string,
  request: TRequest,
  execute: (client: AIClient, request: TRequest) => Promise<XtmOneTaskResponse<TResponse>>,
  sendResponse: SendResponseFn,
  options: {
    truncateField?: keyof TRequest;
    transform?: (data: TResponse) => TOutput;
  } = {},
): Promise<void> {
  const settings = await getSettings();
  if (!isAIAvailable(settings.ai)) {
    sendResponse(errorResponse('AI is not configured. Configure XTM One in extension settings.'));
    return;
  }

  let client: AIClient;
  try {
    client = new AIClient(settings.ai!);
  } catch (error) {
    sendResponse(errorResponse(error instanceof Error ? error.message : 'Failed to initialize AI client'));
    return;
  }

  const payload = { ...request } as TRequest;
  if (options.truncateField) {
    const fieldValue = payload[options.truncateField];
    if (typeof fieldValue === 'string') {
      (payload as Record<string, unknown>)[options.truncateField as string] = truncateContent(
        fieldValue,
        client.getMaxContentLength(),
        handlerName,
      );
    }
  }

  let response: XtmOneTaskResponse<TResponse>;
  try {
    response = await execute(client, payload);
  } catch (error) {
    log.error(`[${handlerName}] Exception:`, error);
    sendResponse(errorResponse(error instanceof Error ? error.message : 'XTM One call failed unexpectedly'));
    return;
  }

  log.debug(`[${handlerName}] XTM One response success:`, response.success, 'status:', response.status);

  if (!response.success || response.data === undefined) {
    sendResponse(errorResponse(response.error || 'XTM One returned no data'));
    return;
  }

  try {
    const result = options.transform ? options.transform(response.data) : response.data;
    sendResponse(successResponse(result));
  } catch (error) {
    // Contract violation surfaced by a transform hook (e.g. required array missing).
    log.error(`[${handlerName}] Transform failed:`, error);
    sendResponse(errorResponse(error instanceof Error ? error.message : 'Invalid XTM One response shape'));
  }
}
