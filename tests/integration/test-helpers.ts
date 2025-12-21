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
 * Create a test guard function for a specific service
 * Returns a function that can be called at the start of each test
 * to skip if the service is not available
 * 
 * @example
 * const skipIfUnavailable = createServiceGuard(() => isOpenAEVAvailable, 'OpenAEV', () => connectionError);
 * 
 * it('should do something', async (context) => {
 *   if (skipIfUnavailable(context)) return;
 *   // ... test logic
 * });
 */
export function createServiceGuard(
  isAvailable: () => boolean,
  serviceName: string,
  getError?: () => string | undefined
): (context: { skip: () => void }) => boolean {
  return (context: { skip: () => void }): boolean => {
    if (!isAvailable()) {
      const error = getError?.();
      console.log(`Skipping: ${serviceName} not available${error ? ` - ${error}` : ''}`);
      context.skip();
      return true;
    }
    return false;
  };
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

// ============================================================================
// Test Suite Setup Utilities
// ============================================================================

/**
 * Context object for test availability checking
 */
export interface TestContext {
  skip: () => void;
}

/**
 * State for a platform connection
 */
export interface PlatformConnectionState {
  isAvailable: boolean;
  connectionError: string | null;
}

/**
 * Create a unified skip check function for tests.
 * This is a simplified version that reduces the boilerplate:
 * 
 * @example
 * ```typescript
 * const { isAvailable, connectionError, skipIfUnavailable } = createPlatformTestState('OpenAEV');
 * 
 * it('should do something', async (context) => {
 *   if (skipIfUnavailable(context)) return;
 *   // ... test logic
 * });
 * ```
 */
export function createPlatformTestState(platformName: string): {
  state: PlatformConnectionState;
  skipIfUnavailable: (context: TestContext) => boolean;
  setAvailable: (available: boolean) => void;
  setConnectionError: (error: string | null) => void;
} {
  const state: PlatformConnectionState = {
    isAvailable: false,
    connectionError: null,
  };

  const skipIfUnavailable = (context: TestContext): boolean => {
    if (!state.isAvailable) {
      const errorMsg = state.connectionError || 'Not available';
      console.log(`Skipping: ${platformName} not available - ${errorMsg}`);
      context.skip();
      return true;
    }
    return false;
  };

  return {
    state,
    skipIfUnavailable,
    setAvailable: (available: boolean) => { state.isAvailable = available; },
    setConnectionError: (error: string | null) => { state.connectionError = error; },
  };
}

/**
 * Common assertions for entity list results
 */
export function assertEntityList<T>(
  results: T[],
  options: {
    minLength?: number;
    requireArrayResult?: boolean;
  } = {}
): void {
  const { minLength = 0, requireArrayResult = true } = options;
  
  if (requireArrayResult) {
    expect(Array.isArray(results)).toBe(true);
  }
  
  if (minLength > 0) {
    expect(results.length).toBeGreaterThanOrEqual(minLength);
  }
}

/**
 * Common assertions for search results
 */
export function assertSearchResults<T extends { name?: string }>(
  results: T[],
  searchTerm: string,
  options: {
    checkNameMatch?: boolean;
  } = {}
): void {
  expect(Array.isArray(results)).toBe(true);
  
  if (options.checkNameMatch && searchTerm && results.length > 0) {
    // At least one result should contain the search term (case-insensitive)
    const searchLower = searchTerm.toLowerCase();
    const hasMatch = results.some(r => 
      r.name?.toLowerCase().includes(searchLower)
    );
    expect(hasMatch).toBe(true);
  }
}

/**
 * Create a cleanup tracker for created entities
 */
export function createCleanupTracker<TClient>(
  deleteMethod: (client: TClient, id: string) => Promise<void>
): {
  createdIds: string[];
  trackId: (id: string) => void;
  cleanup: (client: TClient) => Promise<void>;
} {
  const createdIds: string[] = [];
  
  return {
    createdIds,
    trackId: (id: string) => { createdIds.push(id); },
    cleanup: async (client: TClient) => {
      for (const id of createdIds) {
        try {
          await deleteMethod(client, id);
        } catch {
          // Ignore cleanup errors
        }
      }
      createdIds.length = 0;
    },
  };
}

