/**
 * Test Setup
 * 
 * Common setup and utilities for all tests.
 */

import { beforeAll, afterAll, vi } from 'vitest';

// Mock chrome API for unit tests
const mockChrome = {
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    getURL: vi.fn((path: string) => `chrome-extension://mock-id/${path}`),
    lastError: null,
  },
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
    },
    session: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
    },
  },
  tabs: {
    query: vi.fn(),
    sendMessage: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  contextMenus: {
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    removeAll: vi.fn(),
  },
  action: {
    setIcon: vi.fn(),
    setBadgeText: vi.fn(),
    setBadgeBackgroundColor: vi.fn(),
  },
  sidePanel: {
    open: vi.fn(),
    setOptions: vi.fn(),
  },
};

// Make chrome available globally for tests
beforeAll(() => {
  (globalThis as any).chrome = mockChrome;
});

afterAll(() => {
  delete (globalThis as any).chrome;
});

// Export mock for custom test manipulation
export { mockChrome };

// Utility to create a mock OpenCTI client response
export function createMockOpenCTIResponse<T>(data: T, success = true) {
  return {
    success,
    data,
    error: success ? undefined : 'Mock error',
  };
}

// Utility to create a mock OpenAEV client response
export function createMockOpenAEVResponse<T>(data: T, success = true) {
  return {
    success,
    data,
    error: success ? undefined : 'Mock error',
  };
}

// Test data generators
export function generateMockSDO(type: string, name: string, id?: string) {
  return {
    id: id || `${type}--${crypto.randomUUID()}`,
    type,
    name,
    aliases: [],
    description: `Mock ${type}: ${name}`,
    created: new Date().toISOString(),
    modified: new Date().toISOString(),
  };
}

export function generateMockObservable(type: string, value: string) {
  return {
    id: `observable--${crypto.randomUUID()}`,
    type,
    value,
    x_opencti_score: 50,
    created: new Date().toISOString(),
    modified: new Date().toISOString(),
  };
}

export function generateMockOAEVEntity(type: string, name: string, id?: string) {
  return {
    asset_id: id || crypto.randomUUID(),
    asset_name: name,
    asset_type: type,
    asset_description: `Mock ${type}: ${name}`,
  };
}
