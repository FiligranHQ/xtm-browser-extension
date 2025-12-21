/**
 * Unit Tests for Client Registry Service
 * 
 * Tests the centralized registry for platform client getters.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the logger before importing the module
vi.mock('../../src/shared/utils/logger', () => ({
  loggers: {
    background: {
      debug: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
    },
  },
}));

// Need to dynamically import to reset module state between tests
async function importModule() {
  vi.resetModules();
  return import('../../src/background/services/client-registry');
}

// Mock client types
type MockOpenCTIClient = { id: string; type: 'opencti' };
type MockOpenAEVClient = { id: string; type: 'openaev' };

describe('Client Registry Service', () => {
  let registry: Awaited<ReturnType<typeof importModule>>;

  beforeEach(async () => {
    registry = await importModule();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // OpenCTI Client Tests
  // ============================================================================

  describe('OpenCTI Clients', () => {
    describe('setOpenCTIClientGetter', () => {
      it('should configure the OpenCTI client getter', () => {
        const clients = new Map<string, MockOpenCTIClient>([
          ['platform-1', { id: 'client-1', type: 'opencti' }],
        ]);
        const getter = () => clients;

        registry.setOpenCTIClientGetter(getter as unknown as () => Map<string, import('../../src/shared/api/opencti-client').OpenCTIClient>);

        // Should now return the clients
        const result = registry.getOpenCTIClients();
        expect(result.size).toBe(1);
        expect(result.get('platform-1')).toEqual({ id: 'client-1', type: 'opencti' });
      });
    });

    describe('getOpenCTIClients', () => {
      it('should return empty map if getter not configured', () => {
        const result = registry.getOpenCTIClients();
        expect(result).toBeInstanceOf(Map);
        expect(result.size).toBe(0);
      });

      it('should use the configured getter', () => {
        const clients = new Map<string, MockOpenCTIClient>([
          ['p1', { id: 'c1', type: 'opencti' }],
          ['p2', { id: 'c2', type: 'opencti' }],
        ]);
        registry.setOpenCTIClientGetter(() => clients as unknown as Map<string, import('../../src/shared/api/opencti-client').OpenCTIClient>);

        const result = registry.getOpenCTIClients();
        expect(result.size).toBe(2);
      });
    });

    describe('hasOpenCTIClients', () => {
      it('should return false if getter not configured', () => {
        expect(registry.hasOpenCTIClients()).toBe(false);
      });

      it('should return false if no clients', () => {
        registry.setOpenCTIClientGetter(() => new Map() as unknown as Map<string, import('../../src/shared/api/opencti-client').OpenCTIClient>);
        expect(registry.hasOpenCTIClients()).toBe(false);
      });

      it('should return true if clients exist', () => {
        const clients = new Map<string, MockOpenCTIClient>([
          ['p1', { id: 'c1', type: 'opencti' }],
        ]);
        registry.setOpenCTIClientGetter(() => clients as unknown as Map<string, import('../../src/shared/api/opencti-client').OpenCTIClient>);
        expect(registry.hasOpenCTIClients()).toBe(true);
      });
    });
  });

  // ============================================================================
  // OpenAEV Client Tests
  // ============================================================================

  describe('OpenAEV Clients', () => {
    describe('setOpenAEVClientGetter', () => {
      it('should configure the OpenAEV client getter', () => {
        const clients = new Map<string, MockOpenAEVClient>([
          ['aev-1', { id: 'aev-client-1', type: 'openaev' }],
        ]);
        const getter = () => clients;

        registry.setOpenAEVClientGetter(getter as unknown as () => Map<string, import('../../src/shared/api/openaev-client').OpenAEVClient>);

        const result = registry.getOpenAEVClients();
        expect(result.size).toBe(1);
      });
    });

    describe('getOpenAEVClients', () => {
      it('should return empty map if getter not configured', () => {
        const result = registry.getOpenAEVClients();
        expect(result).toBeInstanceOf(Map);
        expect(result.size).toBe(0);
      });
    });

    describe('getFirstOpenAEVClient', () => {
      it('should return undefined if no clients', () => {
        expect(registry.getFirstOpenAEVClient()).toBeUndefined();
      });

      it('should return first client', () => {
        const clients = new Map<string, MockOpenAEVClient>([
          ['aev-1', { id: 'first', type: 'openaev' }],
          ['aev-2', { id: 'second', type: 'openaev' }],
        ]);
        registry.setOpenAEVClientGetter(() => clients as unknown as Map<string, import('../../src/shared/api/openaev-client').OpenAEVClient>);

        const result = registry.getFirstOpenAEVClient();
        expect(result).toEqual({ id: 'first', type: 'openaev' });
      });
    });

    describe('hasOpenAEVClients', () => {
      it('should return false if getter not configured', () => {
        expect(registry.hasOpenAEVClients()).toBe(false);
      });

      it('should return true if clients exist', () => {
        const clients = new Map<string, MockOpenAEVClient>([
          ['aev-1', { id: 'c1', type: 'openaev' }],
        ]);
        registry.setOpenAEVClientGetter(() => clients as unknown as Map<string, import('../../src/shared/api/openaev-client').OpenAEVClient>);
        expect(registry.hasOpenAEVClients()).toBe(true);
      });
    });
  });

  // ============================================================================
  // Primary OpenCTI Client Tests
  // ============================================================================

  describe('Primary OpenCTI Client', () => {
    describe('setPrimaryOpenCTIClientGetter', () => {
      it('should configure the primary client getter', () => {
        const client: MockOpenCTIClient = { id: 'primary', type: 'opencti' };
        registry.setPrimaryOpenCTIClientGetter(() => client as unknown as import('../../src/shared/api/opencti-client').OpenCTIClient);

        const result = registry.getPrimaryOpenCTIClient();
        expect(result).toEqual(client);
      });
    });

    describe('getPrimaryOpenCTIClient', () => {
      it('should return null if getter not configured', () => {
        expect(registry.getPrimaryOpenCTIClient()).toBeNull();
      });

      it('should return the primary client', () => {
        const client: MockOpenCTIClient = { id: 'primary', type: 'opencti' };
        registry.setPrimaryOpenCTIClientGetter(() => client as unknown as import('../../src/shared/api/opencti-client').OpenCTIClient);

        expect(registry.getPrimaryOpenCTIClient()).toEqual(client);
      });

      it('should handle getter returning null', () => {
        registry.setPrimaryOpenCTIClientGetter(() => null);
        expect(registry.getPrimaryOpenCTIClient()).toBeNull();
      });
    });
  });
});
