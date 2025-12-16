/**
 * Base API Client
 * 
 * Common functionality for all platform API clients.
 * Provides base request handling, error management, and pagination utilities.
 */

import { loggers } from '../utils/logger';

const log = loggers.api;

// User-Agent for API requests
export const USER_AGENT = 'xtm-browser-extension/0.0.4';

// Default timeouts (in ms)
export const DEFAULT_TIMEOUT = 30000;
export const CONNECTION_TIMEOUT = 10000;

/**
 * Base API error class
 */
export class APIError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'APIError';
  }
}

/**
 * Rate limit error
 */
export class RateLimitError extends APIError {
  constructor(
    message: string,
    public readonly retryAfter?: number
  ) {
    super(message, 429, 'RATE_LIMITED');
    this.name = 'RateLimitError';
  }
}

/**
 * Authentication error
 */
export class AuthError extends APIError {
  constructor(message: string) {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'AuthError';
  }
}

/**
 * Base request options
 */
export interface BaseRequestOptions {
  timeout?: number;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/**
 * Paginated response format (Spring Boot style)
 */
export interface PaginatedResponse<T> {
  content: T[];
  totalPages: number;
  totalElements: number;
  size: number;
  number: number;
  numberOfElements: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

/**
 * GraphQL response format
 */
export interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{
    message: string;
    extensions?: {
      code?: string;
      [key: string]: unknown;
    };
  }>;
}

/**
 * Base API Client
 */
export abstract class BaseAPIClient {
  protected baseUrl: string;
  protected apiToken: string;
  protected platformId: string;
  protected platformName: string;

  constructor(config: {
    url: string;
    apiToken: string;
    id?: string;
    name?: string;
  }) {
    this.baseUrl = config.url.replace(/\/+$/, '');
    this.apiToken = config.apiToken;
    this.platformId = config.id || 'default';
    this.platformName = config.name || 'Platform';
  }

  /**
   * Get base headers for requests
   */
  protected getBaseHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiToken}`,
      'User-Agent': USER_AGENT,
    };
  }

  /**
   * Make a fetch request with timeout
   */
  protected async fetchWithTimeout(
    url: string,
    options: RequestInit = {},
    timeout: number = DEFAULT_TIMEOUT
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Handle HTTP response errors
   */
  protected handleResponseError(response: Response): never {
    if (response.status === 401) {
      throw new AuthError('Authentication failed - check your API token');
    }
    if (response.status === 403) {
      throw new APIError('Access denied - insufficient permissions', 403, 'FORBIDDEN');
    }
    if (response.status === 404) {
      throw new APIError('Resource not found', 404, 'NOT_FOUND');
    }
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      throw new RateLimitError(
        'Rate limit exceeded',
        retryAfter ? parseInt(retryAfter, 10) : undefined
      );
    }
    throw new APIError(
      `HTTP error: ${response.status} ${response.statusText}`,
      response.status
    );
  }

  /**
   * Log API request/response for debugging
   */
  protected logRequest(
    method: string,
    endpoint: string,
    duration?: number
  ): void {
    log.debug(`[${this.platformName}] ${method} ${endpoint}${duration ? ` (${duration}ms)` : ''}`);
  }

  /**
   * Fetch all pages of a paginated endpoint
   */
  protected async fetchAllPages<T>(
    fetchPage: (page: number, size: number) => Promise<PaginatedResponse<T>>,
    pageSize: number = 500
  ): Promise<T[]> {
    const allItems: T[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const response = await fetchPage(page, pageSize);
      allItems.push(...response.content);
      hasMore = !response.last && response.content.length > 0;
      page++;
    }

    return allItems;
  }

  /**
   * Retry a request with exponential backoff
   */
  protected async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Don't retry auth errors or client errors (4xx except 429)
        if (error instanceof AuthError) {
          throw error;
        }
        if (error instanceof APIError && error.status && error.status >= 400 && error.status < 500 && error.status !== 429) {
          throw error;
        }

        // Wait before retry with exponential backoff
        if (attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Operation failed after retries');
  }

  /**
   * Abstract method for connection test
   */
  abstract testConnection(): Promise<{
    success: boolean;
    version?: string;
    user?: string;
    enterprise_edition?: boolean;
  }>;
}

/**
 * Utility to create a timeout promise
 */
export function createTimeoutPromise<T>(ms: number, message = 'Operation timed out'): Promise<T> {
  return new Promise<T>((_, reject) => {
    setTimeout(() => reject(new APIError(message, undefined, 'TIMEOUT')), ms);
  });
}

/**
 * Race a promise against a timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message?: string
): Promise<T> {
  return Promise.race([
    promise,
    createTimeoutPromise<T>(ms, message),
  ]);
}

