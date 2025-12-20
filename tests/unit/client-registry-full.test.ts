/**
 * Unit Tests for Client Registry
 * 
 * Tests the centralized client registry for platform clients.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  setOpenCTIClientGetter,
  setOpenAEVClientGetter,
  setPrimaryOpenCTIClientGetter,
  getOpenCTIClients,
  getOpenAEVClients,
  getPrimaryOpenCTIClient,
  getFirstOpenAEVClient,
  hasOpenCTIClients,
  hasOpenAEVClients,
} from '../../src/background/services/client-registry';

// ============================================================================
// Mock Clients
// ============================================================================

const createMockOpenCTIClient = (name: string) => ({
  name,
  getPlatformInfo: () => ({ name, url: `https://${name}.example.com` }),
  // Add other mock methods as needed
});

const createMockOpenAEVClient = (name: string) => ({
  name,
  getPlatformInfo: () => ({ name, url: `https://${name}.example.com` }),
  // Add other mock methods as needed
});

// ============================================================================
// Tests
// ============================================================================

describe('Client Registry', () => {
  beforeEach(() => {
    // Reset the registry by setting null getters
    // Note: This requires the registry to support reset or we test indirectly
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // OpenCTI Client Tests
  // ============================================================================

  describe('OpenCTI Clients', () => {
    describe('setOpenCTIClientGetter', () => {
      it('should configure the OpenCTI client getter', () => {
        const mockClients = new Map<string, any>([
          ['platform-1', createMockOpenCTIClient('Platform 1')],
        ]);
        
        setOpenCTIClientGetter(() => mockClients);
        
        const clients = getOpenCTIClients();
        expect(clients.size).toBe(1);
        expect(clients.has('platform-1')).toBe(true);
      });
    });

    describe('getOpenCTIClients', () => {
      it('should return clients from the configured getter', () => {
        const mockClients = new Map<string, any>([
          ['p1', createMockOpenCTIClient('P1')],
          ['p2', createMockOpenCTIClient('P2')],
        ]);
        
        setOpenCTIClientGetter(() => mockClients);
        
        const clients = getOpenCTIClients();
        expect(clients.size).toBe(2);
        expect(clients.get('p1')?.name).toBe('P1');
        expect(clients.get('p2')?.name).toBe('P2');
      });

      it('should return updated clients if getter changes', () => {
        const mockClients1 = new Map<string, any>([
          ['p1', createMockOpenCTIClient('P1')],
        ]);
        
        setOpenCTIClientGetter(() => mockClients1);
        expect(getOpenCTIClients().size).toBe(1);
        
        const mockClients2 = new Map<string, any>([
          ['p1', createMockOpenCTIClient('P1')],
          ['p2', createMockOpenCTIClient('P2')],
          ['p3', createMockOpenCTIClient('P3')],
        ]);
        
        setOpenCTIClientGetter(() => mockClients2);
        expect(getOpenCTIClients().size).toBe(3);
      });
    });

    describe('hasOpenCTIClients', () => {
      it('should return true when clients are configured', () => {
        const mockClients = new Map<string, any>([
          ['p1', createMockOpenCTIClient('P1')],
        ]);
        
        setOpenCTIClientGetter(() => mockClients);
        
        expect(hasOpenCTIClients()).toBe(true);
      });

      it('should return false when no clients', () => {
        setOpenCTIClientGetter(() => new Map());
        
        expect(hasOpenCTIClients()).toBe(false);
      });
    });

    describe('getPrimaryOpenCTIClient', () => {
      it('should return the primary client when configured', () => {
        const mockClient = createMockOpenCTIClient('Primary');
        
        setPrimaryOpenCTIClientGetter(() => mockClient as any);
        
        const primary = getPrimaryOpenCTIClient();
        expect(primary).toBeDefined();
        expect((primary as any)?.name).toBe('Primary');
      });

      it('should return null when primary not configured', () => {
        setPrimaryOpenCTIClientGetter(() => null);
        
        const primary = getPrimaryOpenCTIClient();
        expect(primary).toBeNull();
      });
    });
  });

  // ============================================================================
  // OpenAEV Client Tests
  // ============================================================================

  describe('OpenAEV Clients', () => {
    describe('setOpenAEVClientGetter', () => {
      it('should configure the OpenAEV client getter', () => {
        const mockClients = new Map<string, any>([
          ['oaev-1', createMockOpenAEVClient('OAEV 1')],
        ]);
        
        setOpenAEVClientGetter(() => mockClients);
        
        const clients = getOpenAEVClients();
        expect(clients.size).toBe(1);
        expect(clients.has('oaev-1')).toBe(true);
      });
    });

    describe('getOpenAEVClients', () => {
      it('should return clients from the configured getter', () => {
        const mockClients = new Map<string, any>([
          ['oaev-1', createMockOpenAEVClient('OAEV1')],
          ['oaev-2', createMockOpenAEVClient('OAEV2')],
        ]);
        
        setOpenAEVClientGetter(() => mockClients);
        
        const clients = getOpenAEVClients();
        expect(clients.size).toBe(2);
        expect(clients.get('oaev-1')?.name).toBe('OAEV1');
        expect(clients.get('oaev-2')?.name).toBe('OAEV2');
      });
    });

    describe('hasOpenAEVClients', () => {
      it('should return true when clients are configured', () => {
        const mockClients = new Map<string, any>([
          ['oaev-1', createMockOpenAEVClient('OAEV1')],
        ]);
        
        setOpenAEVClientGetter(() => mockClients);
        
        expect(hasOpenAEVClients()).toBe(true);
      });

      it('should return false when no clients', () => {
        setOpenAEVClientGetter(() => new Map());
        
        expect(hasOpenAEVClients()).toBe(false);
      });
    });

    describe('getFirstOpenAEVClient', () => {
      it('should return the first client', () => {
        const mockClients = new Map<string, any>([
          ['oaev-1', createMockOpenAEVClient('OAEV1')],
          ['oaev-2', createMockOpenAEVClient('OAEV2')],
        ]);
        
        setOpenAEVClientGetter(() => mockClients);
        
        const first = getFirstOpenAEVClient();
        expect(first).toBeDefined();
        expect((first as any)?.name).toBe('OAEV1');
      });

      it('should return undefined when no clients', () => {
        setOpenAEVClientGetter(() => new Map());
        
        const first = getFirstOpenAEVClient();
        expect(first).toBeUndefined();
      });
    });
  });

  // ============================================================================
  // Multiple Clients Tests
  // ============================================================================

  describe('Multiple Clients', () => {
    it('should handle both OpenCTI and OpenAEV clients', () => {
      const octiClients = new Map<string, any>([
        ['octi-1', createMockOpenCTIClient('OCTI1')],
      ]);
      
      const oaevClients = new Map<string, any>([
        ['oaev-1', createMockOpenAEVClient('OAEV1')],
      ]);
      
      setOpenCTIClientGetter(() => octiClients);
      setOpenAEVClientGetter(() => oaevClients);
      
      expect(getOpenCTIClients().size).toBe(1);
      expect(getOpenAEVClients().size).toBe(1);
      expect(hasOpenCTIClients()).toBe(true);
      expect(hasOpenAEVClients()).toBe(true);
    });

    it('should handle dynamic client changes', () => {
      let octiClients = new Map<string, any>();
      let oaevClients = new Map<string, any>();
      
      setOpenCTIClientGetter(() => octiClients);
      setOpenAEVClientGetter(() => oaevClients);
      
      expect(hasOpenCTIClients()).toBe(false);
      expect(hasOpenAEVClients()).toBe(false);
      
      // Add clients dynamically
      octiClients.set('octi-1', createMockOpenCTIClient('OCTI1'));
      oaevClients.set('oaev-1', createMockOpenAEVClient('OAEV1'));
      
      expect(hasOpenCTIClients()).toBe(true);
      expect(hasOpenAEVClients()).toBe(true);
      
      // Remove clients
      octiClients.clear();
      
      expect(hasOpenCTIClients()).toBe(false);
      expect(hasOpenAEVClients()).toBe(true);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty platform IDs', () => {
      const mockClients = new Map<string, any>([
        ['', createMockOpenCTIClient('Empty ID')],
      ]);
      
      setOpenCTIClientGetter(() => mockClients);
      
      const clients = getOpenCTIClients();
      expect(clients.size).toBe(1);
      expect(clients.has('')).toBe(true);
    });

    it('should handle special characters in platform IDs', () => {
      const mockClients = new Map<string, any>([
        ['platform/with/slashes', createMockOpenCTIClient('Slashes')],
        ['platform-with-dashes', createMockOpenCTIClient('Dashes')],
        ['platform_with_underscores', createMockOpenCTIClient('Underscores')],
      ]);
      
      setOpenCTIClientGetter(() => mockClients);
      
      const clients = getOpenCTIClients();
      expect(clients.size).toBe(3);
    });

    it('should handle getter that returns new Map each time', () => {
      let callCount = 0;
      
      setOpenCTIClientGetter(() => {
        callCount++;
        return new Map([
          ['p1', createMockOpenCTIClient(`P1-${callCount}`)],
        ]);
      });
      
      const clients1 = getOpenCTIClients();
      const clients2 = getOpenCTIClients();
      
      // Each call should invoke the getter
      expect(callCount).toBe(2);
      // But they should both have clients
      expect(clients1.size).toBe(1);
      expect(clients2.size).toBe(1);
    });
  });
});

