/**
 * Messaging utilities for Chrome extension communication
 */

import { loggers } from './logger';

const log = loggers.shared;

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

/**
 * Send a message to the background script with type safety
 */
export async function sendToBackground<T = unknown>(
  type: string,
  payload?: unknown
): Promise<MessageResponse<T>> {
  try {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      return errorResponse('Chrome runtime not available');
    }
    
    const response = await chrome.runtime.sendMessage({ type, payload });
    return response as MessageResponse<T>;
  } catch (error) {
    log.error(`Failed to send message ${type}:`, error);
    return errorResponse(error instanceof Error ? error : 'Unknown error');
  }
}

/**
 * Send a message to a specific tab's content script
 */
export async function sendToTab<T = unknown>(
  tabId: number,
  type: string,
  payload?: unknown
): Promise<MessageResponse<T>> {
  try {
    if (typeof chrome === 'undefined' || !chrome.tabs?.sendMessage) {
      return errorResponse('Chrome tabs API not available');
    }
    
    const response = await chrome.tabs.sendMessage(tabId, { type, payload });
    return response as MessageResponse<T>;
  } catch (error) {
    log.error(`Failed to send message to tab ${tabId}:`, error);
    return errorResponse(error instanceof Error ? error : 'Unknown error');
  }
}

/**
 * Send a message to the active tab
 */
export async function sendToActiveTab<T = unknown>(
  type: string,
  payload?: unknown
): Promise<MessageResponse<T>> {
  try {
    if (typeof chrome === 'undefined' || !chrome.tabs?.query) {
      return errorResponse('Chrome tabs API not available');
    }
    
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      return errorResponse('No active tab found');
    }
    
    return sendToTab<T>(tab.id, type, payload);
  } catch (error) {
    log.error('Failed to send message to active tab:', error);
    return errorResponse(error instanceof Error ? error : 'Unknown error');
  }
}

/**
 * Handler type for message handlers
 */
export type MessageHandler<T = unknown, R = unknown> = (
  payload: T,
  sender: chrome.runtime.MessageSender
) => Promise<R> | R;

/**
 * Message handler registry type
 */
export type MessageHandlerRegistry = {
  [type: string]: MessageHandler<unknown, unknown>;
};

/**
 * Create a message listener with typed handlers
 */
export function createMessageListener(
  handlers: MessageHandlerRegistry,
  context: string = 'unknown'
): (
  message: { type: string; payload?: unknown },
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: MessageResponse) => void
) => boolean {
  return (message, sender, sendResponse) => {
    const handler = handlers[message.type];
    
    if (!handler) {
      // Return false to let other listeners handle the message
      return false;
    }
    
    // Execute handler asynchronously
    (async () => {
      try {
        const result = await handler(message.payload, sender);
        sendResponse(successResponse(result));
      } catch (error) {
        log.error(`[${context}] Error handling ${message.type}:`, error);
        sendResponse(errorResponse(error instanceof Error ? error : 'Unknown error'));
      }
    })();
    
    // Return true to indicate async response
    return true;
  };
}

/**
 * Wrap an async handler with timeout
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string = 'Operation'
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`${operation} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    
    promise
      .then((result) => {
        clearTimeout(timeout);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}

/**
 * Retry an operation with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    operationName?: string;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    operationName = 'Operation',
  } = options;
  
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxRetries) {
        const delay = Math.min(initialDelayMs * Math.pow(2, attempt), maxDelayMs);
        log.warn(`${operationName} failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error(`${operationName} failed after ${maxRetries + 1} attempts`);
}

