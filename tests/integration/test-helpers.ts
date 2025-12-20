/**
 * Integration Test Helpers
 * 
 * Shared utilities for integration tests to reduce code duplication.
 * Provides common patterns for API calls, pagination, and assertions.
 */

import { expect } from 'vitest';

/**
 * Configuration for API client
 */
export interface TestClientConfig {
  url: string;
  token: string;
}

/**
 * Pagination response format from OpenAEV
 */
export interface PaginatedResponse<T> {
  content: T[];
  totalPages?: number;
  totalElements?: number;
  page?: number;
  size?: number;
}

/**
 * Options for paginated fetch
 */
export interface PaginatedFetchOptions {
  pageSize?: number;
  maxPages?: number;
  startPage?: number;
}

/**
 * Result from paginated fetch
 */
export interface PaginatedFetchResult<T> {
  results: T[];
  pageCount: number;
  totalFetched: number;
}

/**
 * Make an authenticated API request
 */
export async function makeAuthenticatedRequest<T>(
  url: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Make a POST request with authentication
 */
export async function postAuthenticated<T>(
  url: string,
  token: string,
  body: unknown
): Promise<T> {
  return makeAuthenticatedRequest<T>(url, token, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Fetch all pages from a paginated endpoint
 * Handles both array and paginated response formats
 */
export async function fetchAllPages<T>(
  url: string,
  token: string,
  options: PaginatedFetchOptions = {}
): Promise<PaginatedFetchResult<T>> {
  const {
    pageSize = 10,
    maxPages = 100,
    startPage = 0,
  } = options;
  
  let allResults: T[] = [];
  let currentPage = startPage;
  let totalPages = 1;
  let pageCount = 0;
  
  while (currentPage < totalPages && pageCount < maxPages) {
    const result = await postAuthenticated<PaginatedResponse<T> | T[]>(
      url,
      token,
      { page: currentPage, size: pageSize }
    );
    
    // Handle paginated response
    if (result && typeof result === 'object' && 'content' in result) {
      allResults = allResults.concat(result.content);
      totalPages = result.totalPages || 1;
    } else if (Array.isArray(result)) {
      allResults = allResults.concat(result);
      totalPages = 1; // No pagination info
    }
    
    currentPage++;
    pageCount++;
  }
  
  return {
    results: allResults,
    pageCount,
    totalFetched: allResults.length,
  };
}

/**
 * Common test assertions for paginated results
 */
export function assertPaginatedResults<T extends { id?: string }>(
  result: PaginatedFetchResult<T>,
  idField: keyof T | ((item: T) => string | undefined)
): void {
  // Verify pagination worked
  expect(result.pageCount).toBeGreaterThanOrEqual(1);
  
  // Verify no duplicate IDs if we have results
  if (result.results.length > 0) {
    const getId = typeof idField === 'function' 
      ? idField 
      : (item: T) => item[idField] as string | undefined;
    
    const ids = result.results.map(getId).filter(Boolean);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  }
}

/**
 * Skip test helper with logging
 */
export function skipIfNotAvailable(
  isAvailable: boolean,
  context: { skip: () => void },
  serviceName: string,
  error?: string
): boolean {
  if (!isAvailable) {
    console.log(`Skipping: ${serviceName} not available${error ? ` - ${error}` : ''}`);
    context.skip();
    return true;
  }
  return false;
}

/**
 * Test retry helper for flaky tests
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: unknown;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  throw lastError;
}

/**
 * Create a test client wrapper with common methods
 */
export function createTestClient(config: TestClientConfig) {
  return {
    config,
    
    async get<T>(endpoint: string): Promise<T> {
      return makeAuthenticatedRequest<T>(
        `${config.url}${endpoint}`,
        config.token
      );
    },
    
    async post<T>(endpoint: string, body: unknown): Promise<T> {
      return postAuthenticated<T>(
        `${config.url}${endpoint}`,
        config.token,
        body
      );
    },
    
    async fetchPaginated<T>(
      endpoint: string,
      options?: PaginatedFetchOptions
    ): Promise<PaginatedFetchResult<T>> {
      return fetchAllPages<T>(
        `${config.url}${endpoint}`,
        config.token,
        options
      );
    },
  };
}

/**
 * Common entity ID extractors
 */
export const idExtractors = {
  asset: (item: Record<string, unknown>) => 
    (item.asset_id || item.endpoint_id || item.id) as string | undefined,
  
  finding: (item: Record<string, unknown>) => 
    (item.finding_id || item.id) as string | undefined,
  
  team: (item: Record<string, unknown>) => 
    (item.team_id || item.id) as string | undefined,
  
  attackPattern: (item: Record<string, unknown>) => 
    (item.attack_pattern_id || item.id) as string | undefined,
  
  generic: (item: Record<string, unknown>) => 
    item.id as string | undefined,
};

/**
 * Log test results summary
 */
export function logTestSummary(
  entityType: string,
  result: PaginatedFetchResult<unknown>
): void {
  console.log(
    `Fetched ${result.totalFetched} ${entityType}(s) in ${result.pageCount} page(s)`
  );
}

